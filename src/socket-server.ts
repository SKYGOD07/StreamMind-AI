import 'dotenv/config';
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
    origin: '*',
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
  allMessages: ProcessedChatMessage[]; // Full session message log (in-memory)
  previousHypeLevel: 'low' | 'medium' | 'high';
  disconnectLive?: () => void;
  startTime: number;
  totalMessageCount: number;
}

let activeSession: ActiveSession | null = null;

// Helper: safe DB write (never crashes the process)
async function safeDbWrite<T>(operation: () => Promise<T>, label: string): Promise<T | null> {
  try {
    return await operation();
  } catch (error: any) {
    console.warn(`[DB WARN] ${label} failed (non-fatal):`, error?.message || error);
    return null;
  }
}

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
    accessToken?: string;
  }) => {
    console.log('Starting stream session:', data);
    
    // Stop any existing session first
    await stopCurrentSession();

    try {
      // 1. Try to save session to database (non-fatal if it fails)
      const session = await safeDbWrite(
        () => db.streamSession.create({
          data: {
            theme: data.theme,
            goals: data.goals.join(','),
            instructions: data.instructions,
            mode: data.mode,
            streamerName: data.streamerName || 'KickStreamer',
            isActive: true
          }
        }),
        'session.create'
      );

      const sessionId = session?.id || `mem-${Date.now()}`;

      // 2. Initialize active session memory
      activeSession = {
        sessionId,
        theme: data.theme,
        goals: data.goals,
        instructions: data.instructions,
        mode: data.mode,
        aiInterval: null,
        messageBuffer: [],
        allMessages: [],
        previousHypeLevel: 'low',
        startTime: Date.now(),
        totalMessageCount: 0
      };

      socket.emit('session-started', {
        sessionId,
        theme: data.theme,
        goals: data.goals,
        instructions: data.instructions,
        mode: data.mode
      });

      // Notify other connections
      socket.broadcast.emit('session-status', {
        active: true,
        sessionId,
        theme: data.theme,
        goals: data.goals,
        instructions: data.instructions,
        mode: data.mode
      });

      // Log initial milestone
      const now = new Date();
      const timeStr = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
      
      await safeDbWrite(
        () => db.timelineEvent.create({
          data: {
            sessionId,
            time: timeStr,
            type: 'custom',
            description: `🟢 StreamMind AI initialized in ${data.mode === 'demo' ? 'Simulated Demo' : 'Live KICK'} Mode.`
          }
        }),
        'timeline.init'
      );

      // Refresh timeline for client
      await emitTimeline(sessionId);

      // 3. Define message handler (ALL IN-MEMORY — no DB writes per message)
      const handleIncomingMessage = (rawMsg: any) => {
        if (!activeSession) return;

        // Run through pre-processing pipeline
        const processed = pipelineService.processMessage(rawMsg);
        const msgId = `msg-${activeSession.totalMessageCount++}`;
        const msgWithId = { ...processed, id: msgId };

        // Store in memory only
        activeSession.messageBuffer.push(msgWithId);
        activeSession.allMessages.push(msgWithId);

        // Keep allMessages capped at 500 to prevent memory issues
        if (activeSession.allMessages.length > 500) {
          activeSession.allMessages = activeSession.allMessages.slice(-400);
        }

        // Broadcast message to dashboard feed
        io.emit('new-message', {
          id: msgId,
          sender: processed.sender,
          text: processed.text,
          badge: processed.badge,
          isSpam: processed.isSpam,
          isQuestion: processed.isQuestion,
          sentiment: processed.sentiment,
          toxicity: processed.toxicity,
          timestamp: new Date().toISOString()
        });

        // If toxicity is super high, emit mod alert instantly
        if (processed.toxicity > 0.7) {
          io.emit('mod-alert', {
            id: msgId,
            type: 'toxicity',
            message: `Toxicity detected from user @${processed.sender}: "${processed.text}"`,
            severity: 'high'
          });
        }
      };

      // 4. Connect source (demo or live)
      if (data.mode === 'demo') {
        kickService.startSimulation(data.theme, data.goals, handleIncomingMessage);
      } else {
        const conn = kickService.connectLiveChat(
          data.streamerName || 'KickStreamer',
          handleIncomingMessage,
          data.accessToken
        );
        activeSession.disconnectLive = conn.disconnect;
      }

      // 5. Start periodic AI & statistics loop (runs every 25 seconds)
      activeSession.aiInterval = setInterval(async () => {
        await runBatchAnalysis();
      }, 25000);

      // Trigger initial fast analysis after 5 seconds
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
  socket.on('send-chat-message', (data: { sender: string; text: string; badge: string }) => {
    if (!activeSession) return;
    
    const rawMsg = {
      sender: data.sender || 'Viewer',
      text: data.text,
      badge: (data.badge || 'none') as any,
      timestamp: new Date()
    };
    
    // Run through standard pipeline processor
    const processed = pipelineService.processMessage(rawMsg);
    const msgId = `custom-${activeSession.totalMessageCount++}`;
    const msgWithId = { ...processed, id: msgId };

    // Store in memory
    activeSession.messageBuffer.push(msgWithId);
    activeSession.allMessages.push(msgWithId);

    // Broadcast message
    io.emit('new-message', {
      id: msgId,
      sender: processed.sender,
      text: processed.text,
      badge: processed.badge,
      isSpam: processed.isSpam,
      isQuestion: processed.isQuestion,
      sentiment: processed.sentiment,
      toxicity: processed.toxicity,
      timestamp: new Date().toISOString()
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

        const msgId = `hype-${activeSession!.totalMessageCount++}`;
        const msgWithId = { ...processed, id: msgId };
        activeSession!.messageBuffer.push(msgWithId);
        activeSession!.allMessages.push(msgWithId);

        io.emit('new-message', {
          id: msgId,
          sender: processed.sender,
          text: processed.text,
          badge: processed.badge,
          isSpam: processed.isSpam,
          isQuestion: processed.isQuestion,
          sentiment: processed.sentiment,
          toxicity: processed.toxicity,
          timestamp: new Date().toISOString()
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

        const msgId = `spam-${activeSession!.totalMessageCount++}`;
        const msgWithId = { ...processed, id: msgId };
        activeSession!.messageBuffer.push(msgWithId);
        activeSession!.allMessages.push(msgWithId);

        io.emit('new-message', {
          id: msgId,
          sender: processed.sender,
          text: processed.text,
          badge: processed.badge,
          isSpam: processed.isSpam,
          isQuestion: processed.isQuestion,
          sentiment: processed.sentiment,
          toxicity: processed.toxicity,
          timestamp: new Date().toISOString()
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

        const msgId = `toxic-${activeSession!.totalMessageCount++}`;
        const msgWithId = { ...processed, id: msgId };
        activeSession!.messageBuffer.push(msgWithId);
        activeSession!.allMessages.push(msgWithId);

        io.emit('new-message', {
          id: msgId,
          sender: processed.sender,
          text: processed.text,
          badge: processed.badge,
          isSpam: processed.isSpam,
          isQuestion: processed.isQuestion,
          sentiment: processed.sentiment,
          toxicity: processed.toxicity,
          timestamp: new Date().toISOString()
        });
      }, i * 300);
    });
  });

  // Handle dashboard one-click action
  socket.on('one-click-action', (data: {
    type: 'question' | 'recommendation';
    action: 'addressed' | 'pin' | 'ignore';
    id: string;
  }) => {
    if (!activeSession) return;
    console.log('Action performed:', data);

    if (data.type === 'question') {
      // Update in-memory question state
      if (data.action === 'addressed' || data.action === 'ignore') {
        // Mark in allMessages so questions-update reflects it
        const msg = activeSession.allMessages.find(m => m.id === data.id);
        if (msg) {
          if (data.action === 'addressed') {
            (msg as any).isAddressed = true;
          } else {
            msg.isQuestion = false;
          }
        }
      }
      io.emit('action-completed', { type: 'question', action: data.action, id: data.id });
    } else if (data.type === 'recommendation') {
      io.emit('action-completed', { type: 'recommendation', action: data.action, id: data.id });
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

  // Save the AI insights to database (non-fatal)
  await safeDbWrite(
    () => db.aIInsight.create({
      data: {
        sessionId: activeSession!.sessionId,
        summary: aiReport.summary,
        questions: JSON.stringify(aiReport.questions),
        topics: JSON.stringify(aiReport.topics),
        recommendations: JSON.stringify(aiReport.recommendations)
      }
    }),
    'aiInsight.create'
  );

  // 4. Analyze changes for timeline logging
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

  // 5. Calculate messages per minute
  const elapsedMs = Date.now() - activeSession.startTime;
  const elapsedMin = Math.max(1, elapsedMs / 60000);
  const messagesPerMin = Math.round(activeSession.totalMessageCount / elapsedMin);

  // 6. Broadcast all calculated metrics to dashboard
  io.emit('dashboard-update', {
    summary: aiReport.summary,
    topics: aiReport.topics,
    recommendations: aiReport.recommendations,
    sentiment: aiReport.sentiment,
    hypeLevel,
    hypeScore,
    messagesPerMin,
    stats: {
      total: batchStats.messageCount,
      spam: batchStats.spamCount,
      questions: batchStats.questionCount,
      toxicity: batchStats.averageToxicity
    }
  });

  // Build questions list from in-memory allMessages
  const questionsInMemory = activeSession.allMessages
    .filter(m => m.isQuestion && !(m as any).isAddressed)
    .slice(-10)
    .reverse()
    .map(q => ({
      id: q.id,
      question: q.text,
      asker: q.sender,
      timestamp: q.timestamp,
      importance: q.toxicity > 0.5 ? 'high' : 'medium'
    }));

  io.emit('questions-update', questionsInMemory);
}

/**
 * Emits the updated timeline events list
 */
async function emitTimeline(sessionId: string) {
  try {
    const events = await db.timelineEvent.findMany({
      where: { sessionId },
      orderBy: { timestamp: 'desc' }
    });
    io.emit('timeline-update', events);
  } catch {
    // If DB read fails, emit what we have from memory
    io.emit('timeline-update', []);
  }
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
  await safeDbWrite(
    () => db.timelineEvent.create({
      data: {
        sessionId: sessId,
        time: timeStr,
        type: 'custom',
        description: '🔴 Stream ended. StreamMind AI dashboard compiled final recap.'
      }
    }),
    'timeline.end'
  );

  // Mark session inactive in DB
  await safeDbWrite(
    () => db.streamSession.update({
      where: { id: sessId },
      data: { isActive: false }
    }),
    'session.deactivate'
  );

  // Get final timeline
  let finalTimeline: any[] = [];
  try {
    finalTimeline = await db.timelineEvent.findMany({
      where: { sessionId: sessId },
      orderBy: { timestamp: 'asc' }
    });
  } catch {
    console.warn('[DB WARN] Could not fetch final timeline.');
  }

  activeSession = null;
  return finalTimeline;
}

// Start HTTP and WS server
httpServer.listen(PORT, () => {
  const hasApiKey = !!process.env.OPENROUTER_API_KEY;
  console.log(`StreamMind AI Realtime server listening on port ${PORT}`);
  console.log(hasApiKey 
    ? '✅ OpenRouter API key loaded — using LIVE AI analysis.' 
    : '⚠️  OPENROUTER_API_KEY not found — running in Simulated AI mode.'
  );
});
