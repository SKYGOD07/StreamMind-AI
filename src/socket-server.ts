import { createServer } from 'http';
import { Server } from 'socket.io';
import { db } from './lib/db';
import { aiService } from './services/ai.service';
import { pipelineService, ProcessedChatMessage } from './services/pipeline.service';
import { kickService } from './services/kick.service';
import { analyticsService } from './services/analytics.service';

const PORT = Number(process.env.SOCKET_PORT) || 3001;

const httpServer = createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/plain' });
  res.end('StreamMind AI WebSocket Server\n');
});

const io = new Server(httpServer, {
  cors: {
    origin: '*', // Allow connections from Next.js dashboard
    methods: ['GET', 'POST']
  }
});

// Keep track of active session loops
interface ActiveSession {
  sessionId: string;
  theme: string;
  goals: string[];
  instructions: string;
  mode: 'live' | 'demo';
  aiInterval: NodeJS.Timeout | null;
  messageBuffer: ProcessedChatMessage[];
  previousHypeLevel: 'low' | 'medium' | 'high';
  disconnectLive?: () => void;
}

let activeSession: ActiveSession | null = null;

io.on('connection', (socket) => {
  console.log(`Client connected: ${socket.id}`);

  // Send current session state if it exists
  if (activeSession) {
    socket.emit('session-status', {
      active: true,
      sessionId: activeSession.sessionId,
      theme: activeSession.theme,
      goals: activeSession.goals,
      instructions: activeSession.instructions,
      mode: activeSession.mode
    });
  } else {
    socket.emit('session-status', { active: false });
  }

  // Handle session start
  socket.on('start-session', async (data: {
    theme: string;
    goals: string[];
    instructions: string;
    mode: 'live' | 'demo';
    streamerName?: string;
  }) => {
    console.log('Starting stream session:', data);
    
    // Stop any existing session first
    await stopCurrentSession();

    try {
      // 1. Save session to database
      const session = await db.streamSession.create({
        data: {
          theme: data.theme,
          goals: data.goals.join(','),
          instructions: data.instructions,
          mode: data.mode,
          streamerName: data.streamerName || 'KickStreamer',
          isActive: true
        }
      });

      // 2. Initialize active session memory
      activeSession = {
        sessionId: session.id,
        theme: data.theme,
        goals: data.goals,
        instructions: data.instructions,
        mode: data.mode,
        aiInterval: null,
        messageBuffer: [],
        previousHypeLevel: 'low'
      };

      socket.emit('session-started', {
        sessionId: session.id,
        theme: session.theme,
        goals: data.goals,
        instructions: session.instructions,
        mode: session.mode
      });

      // Notify other connections
      socket.broadcast.emit('session-status', {
        active: true,
        sessionId: session.id,
        theme: session.theme,
        goals: data.goals,
        instructions: session.instructions,
        mode: session.mode
      });

      // Log initial milestone
      const now = new Date();
      const timeStr = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
      await db.timelineEvent.create({
        data: {
          sessionId: session.id,
          time: timeStr,
          type: 'custom',
          description: `🟢 Stream Mind AI initialized in ${data.mode === 'demo' ? 'Simulated Demo' : 'Live KICK'} Mode.`
        }
      });

      // Refresh timeline for client
      await emitTimeline(session.id);

      // 3. Define message handler
      const handleIncomingMessage = async (rawMsg: any) => {
        if (!activeSession) return;

        // Run through pre-processing pipeline (deduplication, rule engine, question/spam detection)
        const processed = pipelineService.processMessage(rawMsg);
        
        // Save to DB
        const savedMsg = await db.chatMessage.create({
          data: {
            sessionId: activeSession.sessionId,
            sender: processed.sender,
            text: processed.text,
            isSpam: processed.isSpam,
            isQuestion: processed.isQuestion,
            sentiment: processed.sentiment,
            toxicity: processed.toxicity,
            badge: processed.badge
          }
        });

        // Add to active session batch buffer
        activeSession.messageBuffer.push({
          ...processed,
          id: savedMsg.id
        });

        // Broadcast raw message to dashboard feed
        io.emit('new-message', {
          id: savedMsg.id,
          sender: savedMsg.sender,
          text: savedMsg.text,
          badge: savedMsg.badge,
          isSpam: savedMsg.isSpam,
          isQuestion: savedMsg.isQuestion,
          sentiment: savedMsg.sentiment,
          toxicity: savedMsg.toxicity,
          timestamp: savedMsg.timestamp
        });

        // If toxicity is super high, emit mod alert instantly (low latency response)
        if (savedMsg.toxicity > 0.7) {
          io.emit('mod-alert', {
            id: savedMsg.id,
            type: 'toxicity',
            message: `Toxicity detected from user @${savedMsg.sender}: "${savedMsg.text}"`,
            severity: 'high'
          });
        }
      };

      // 4. Connect source (demo or live)
      if (data.mode === 'demo') {
        kickService.startSimulation(data.theme, data.goals, handleIncomingMessage);
      } else {
        const conn = kickService.connectLiveChat(data.streamerName || 'KickStreamer', handleIncomingMessage);
        activeSession.disconnectLive = conn.disconnect;
      }

      // 5. Start periodic AI & statistics loop (runs every 25 seconds)
      activeSession.aiInterval = setInterval(async () => {
        await runBatchAnalysis();
      }, 25000);

      // Trigger initial fast analysis after 5 seconds to load UI widgets quickly
      setTimeout(async () => {
        if (activeSession && activeSession.messageBuffer.length > 0) {
          await runBatchAnalysis();
        }
      }, 5000);

    } catch (error) {
      console.error('Error starting stream session:', error);
      socket.emit('session-error', { message: 'Failed to start session.' });
    }
  });

  // Handle manual viewer message (sent from dashboard for testing)
  socket.on('send-chat-message', async (data: { sender: string; text: string; badge: string }) => {
    if (!activeSession) return;
    
    // Inject custom message into loop
    const rawMsg = {
      sender: data.sender || 'Viewer',
      text: data.text,
      badge: (data.badge || 'none') as any,
      timestamp: new Date()
    };
    
    // Run through standard pipeline processor
    const processed = pipelineService.processMessage(rawMsg);
    
    // Save to DB
    const savedMsg = await db.chatMessage.create({
      data: {
        sessionId: activeSession.sessionId,
        sender: processed.sender,
        text: processed.text,
        isSpam: processed.isSpam,
        isQuestion: processed.isQuestion,
        sentiment: processed.sentiment,
        toxicity: processed.toxicity,
        badge: processed.badge
      }
    });

    // Add to buffer
    activeSession.messageBuffer.push({
      ...processed,
      id: savedMsg.id
    });

    // Broadcast message
    io.emit('new-message', {
      id: savedMsg.id,
      sender: savedMsg.sender,
      text: savedMsg.text,
      badge: savedMsg.badge,
      isSpam: savedMsg.isSpam,
      isQuestion: savedMsg.isQuestion,
      sentiment: savedMsg.sentiment,
      toxicity: savedMsg.toxicity,
      timestamp: savedMsg.timestamp
    });
  });

  // Actionable triggers (spikes) for judges / developers
  socket.on('trigger-hype-spike', () => {
    if (!activeSession) return;
    console.log('Triggering simulated hype spike...');
    
    const hypeMessages = [
      'LETS GOOOOOO!!!! 🔥🔥🔥',
      'OMG WHAT A PLAY!',
      'POG POG POG POG POG',
      'HYPE HYPE HYPE 🚀🚀🚀🚀',
      'insane gameplay right here!',
      'GG GG GG GG GG',
      'UNBELIEVABLE ACING OMG',
      'W STREAMER!',
      'LET HIM COOK!!!',
      'OMG 🔥🔥🔥🚀🚀🚀'
    ];

    hypeMessages.forEach((text, i) => {
      setTimeout(() => {
        if (!activeSession) return;
        const sender = `HypeViewer_${Math.floor(Math.random() * 100)}`;
        const processed = pipelineService.processMessage({
          sender,
          text,
          badge: 'sub',
          timestamp: new Date()
        });

        db.chatMessage.create({
          data: {
            sessionId: activeSession.sessionId,
            sender: processed.sender,
            text: processed.text,
            isSpam: processed.isSpam,
            isQuestion: processed.isQuestion,
            sentiment: processed.sentiment,
            toxicity: processed.toxicity,
            badge: processed.badge
          }
        }).then(savedMsg => {
          activeSession?.messageBuffer.push({ ...processed, id: savedMsg.id });
          io.emit('new-message', savedMsg);
        });
      }, i * 200);
    });

    io.emit('mod-alert', {
      id: 'hype-spike',
      type: 'hype',
      message: 'Excitement spike: Chat volume and CAPS messages increased rapidly!',
      severity: 'low'
    });
  });

  socket.on('trigger-spam-spike', () => {
    if (!activeSession) return;
    console.log('Triggering simulated spam flood...');

    const spamMessages = [
      'CLAIM FREE SKINS AT scam-skins.com!',
      'CLAIM FREE SKINS AT scam-skins.com!',
      'get free vbucks instantly: bit.ly/freerobux-now',
      'get free vbucks instantly: bit.ly/freerobux-now',
      'win free gift cards click here bit.ly/freerobux-now',
      'CLAIM FREE SKINS AT scam-skins.com!',
      'CLAIM FREE SKINS AT scam-skins.com!'
    ];

    spamMessages.forEach((text, i) => {
      setTimeout(() => {
        if (!activeSession) return;
        const sender = `BotUser_${Math.floor(Math.random() * 10)}`;
        const processed = pipelineService.processMessage({
          sender,
          text,
          badge: 'none',
          timestamp: new Date()
        });

        db.chatMessage.create({
          data: {
            sessionId: activeSession.sessionId,
            sender: processed.sender,
            text: processed.text,
            isSpam: processed.isSpam,
            isQuestion: processed.isQuestion,
            sentiment: processed.sentiment,
            toxicity: processed.toxicity,
            badge: processed.badge
          }
        }).then(savedMsg => {
          activeSession?.messageBuffer.push({ ...processed, id: savedMsg.id });
          io.emit('new-message', savedMsg);
        });
      }, i * 250);
    });

    io.emit('mod-alert', {
      id: 'spam-spike',
      type: 'spam',
      message: 'Moderation Warning: Scam links and repetitive posts detected!',
      severity: 'medium'
    });
  });

  socket.on('trigger-toxic-spike', () => {
    if (!activeSession) return;
    console.log('Triggering simulated toxicity wave...');

    const toxicMessages = [
      'you are trash uninstall this game immediately shit',
      'bitch noob wtf why are you so bad',
      'this stream is garbage, worst streamer ever',
      'asshole player cheating hack game'
    ];

    toxicMessages.forEach((text, i) => {
      setTimeout(() => {
        if (!activeSession) return;
        const sender = `ToxicGamer_${Math.floor(Math.random() * 10)}`;
        const processed = pipelineService.processMessage({
          sender,
          text,
          badge: 'none',
          timestamp: new Date()
        });

        db.chatMessage.create({
          data: {
            sessionId: activeSession.sessionId,
            sender: processed.sender,
            text: processed.text,
            isSpam: processed.isSpam,
            isQuestion: processed.isQuestion,
            sentiment: processed.sentiment,
            toxicity: processed.toxicity,
            badge: processed.badge
          }
        }).then(savedMsg => {
          activeSession?.messageBuffer.push({ ...processed, id: savedMsg.id });
          io.emit('new-message', savedMsg);
        });
      }, i * 300);
    });
  });

  // Handle dashboard one-click action
  socket.on('one-click-action', async (data: {
    type: 'question' | 'recommendation';
    action: 'addressed' | 'pin' | 'ignore';
    id: string; // chatMessageId or tip index/id
  }) => {
    if (!activeSession) return;
    console.log('Action performed:', data);

    try {
      if (data.type === 'question') {
        if (data.action === 'addressed') {
          await db.chatMessage.update({
            where: { id: data.id },
            data: { isAddressed: true }
          });
          
          // Inform client to remove/update question in list
          io.emit('action-completed', { type: 'question', action: 'addressed', id: data.id });
        } else if (data.action === 'pin') {
          // Send event to dashboard to pin question
          io.emit('action-completed', { type: 'question', action: 'pin', id: data.id });
        } else if (data.action === 'ignore') {
          await db.chatMessage.update({
            where: { id: data.id },
            data: { isQuestion: false } // Demote from question list
          });
          io.emit('action-completed', { type: 'question', action: 'ignore', id: data.id });
        }
      } else if (data.type === 'recommendation') {
        // Recommendations are transient, tell client to resolve card
        io.emit('action-completed', { type: 'recommendation', action: data.action, id: data.id });
      }
    } catch (e) {
      console.error('Error executing one-click-action:', e);
    }
  });

  // Handle session end
  socket.on('end-session', async () => {
    console.log('Ending stream session...');
    const recap = await stopCurrentSession();
    socket.emit('session-ended', { recap });
    socket.broadcast.emit('session-status', { active: false });
  });

  socket.on('disconnect', () => {
    console.log(`Client disconnected: ${socket.id}`);
  });
});

/**
 * Runs the pre-processed analytics and triggers LLM analysis on consolidated batch
 */
async function runBatchAnalysis() {
  if (!activeSession) return;

  const messagesToAnalyze = [...activeSession.messageBuffer];
  activeSession.messageBuffer = []; // Clear buffer for next cycle

  // 1. Run pipeline aggregator
  const batchStats = pipelineService.aggregateBatch(messagesToAnalyze);
  
  if (batchStats.messageCount === 0) {
    // Keep sending basic metrics to show socket heartbeats
    io.emit('metrics-update', {
      hypeLevel: 'low',
      hypeScore: 5,
      sentiment: { positive: 50, neutral: 45, negative: 5 }
    });
    return;
  }

  // 2. Compute live hype gauge details
  const { level: hypeLevel, score: hypeScore } = analyticsService.calculateHype(batchStats);
  
  // 3. Trigger OpenRouter AI for high-level summaries and recommendations
  const aiReport = await aiService.analyzeChat(
    activeSession.theme,
    activeSession.goals,
    activeSession.instructions,
    batchStats
  );

  // Save the AI insights to database
  const savedInsight = await db.aIInsight.create({
    data: {
      sessionId: activeSession.sessionId,
      summary: aiReport.summary,
      questions: JSON.stringify(aiReport.questions),
      topics: JSON.stringify(aiReport.topics),
      recommendations: JSON.stringify(aiReport.recommendations)
    }
  });

  // 4. Update questions table for easy lookup in case of one-click actions
  for (const q of aiReport.questions) {
    // Find matching message in database to mark isQuestion = true
    const matchingMsg = await db.chatMessage.findFirst({
      where: {
        sessionId: activeSession.sessionId,
        sender: q.asker,
        text: { contains: q.question.substring(0, Math.min(q.question.length, 20)) }
      }
    });

    if (matchingMsg) {
      await db.chatMessage.update({
        where: { id: matchingMsg.id },
        data: { isQuestion: true }
      });
    }
  }

  // 5. Analyze changes for timeline logging (e.g. hype transitions, spam)
  const timelineEvent = await analyticsService.detectTimelineEvents(
    activeSession.sessionId,
    batchStats,
    hypeLevel,
    activeSession.previousHypeLevel
  );

  activeSession.previousHypeLevel = hypeLevel;

  if (timelineEvent) {
    await emitTimeline(activeSession.sessionId);
  }

  // 6. Broadcast all calculated metrics to dashboard
  io.emit('dashboard-update', {
    insightId: savedInsight.id,
    summary: aiReport.summary,
    topics: aiReport.topics,
    recommendations: aiReport.recommendations, // contains tips and confidence scores
    sentiment: aiReport.sentiment,
    hypeLevel,
    hypeScore,
    messageSpeed: batchStats.messageCount * 2, // messages/min estimate
    stats: {
      total: batchStats.messageCount,
      spam: batchStats.spamCount,
      questions: batchStats.questionCount,
      toxicity: batchStats.averageToxicity
    }
  });

  // Send update for questions separately so that they include DB ids
  const questionsInDb = await db.chatMessage.findMany({
    where: {
      sessionId: activeSession.sessionId,
      isQuestion: true,
      isAddressed: false
    },
    orderBy: { timestamp: 'desc' },
    take: 10
  });

  io.emit('questions-update', questionsInDb.map(q => ({
    id: q.id,
    question: q.text,
    asker: q.sender,
    timestamp: q.timestamp,
    importance: q.toxicity > 0.5 ? 'high' : 'medium'
  })));
}

/**
 * Emits the updated timeline events list
 */
async function emitTimeline(sessionId: string) {
  const events = await db.timelineEvent.findMany({
    where: { sessionId },
    orderBy: { timestamp: 'desc' }
  });
  io.emit('timeline-update', events);
}

/**
 * Stops simulation loops, records end timeline event, and cleans state
 */
async function stopCurrentSession(): Promise<any[]> {
  if (!activeSession) return [];

  // Stop simulation or disconnect live WebSocket
  if (activeSession.mode === 'demo') {
    kickService.stopSimulation();
  } else if (activeSession.disconnectLive) {
    activeSession.disconnectLive();
  }

  if (activeSession.aiInterval) {
    clearInterval(activeSession.aiInterval);
  }

  const sessId = activeSession.sessionId;

  // Log final milestone
  const now = new Date();
  const timeStr = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
  await db.timelineEvent.create({
    data: {
      sessionId: sessId,
      time: timeStr,
      type: 'custom',
      description: '🔴 Stream ended. StreamMind AI dashboard compiled final recap.'
    }
  });

  // Mark session inactive in DB
  await db.streamSession.update({
    where: { id: sessId },
    data: { isActive: false }
  });

  // Get final timeline
  const finalTimeline = await db.timelineEvent.findMany({
    where: { sessionId: sessId },
    orderBy: { timestamp: 'asc' }
  });

  activeSession = null;
  return finalTimeline;
}

// Start HTTP and WS server
httpServer.listen(PORT, () => {
  console.log(`StreamMind AI Realtime server listening on port ${PORT}`);
});
