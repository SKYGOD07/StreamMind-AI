'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { 
  MessageSquare, 
  Sparkles, 
  HelpCircle, 
  AlertTriangle, 
  TrendingUp, 
  Compass, 
  Clock, 
  Send,
  Zap,
  Shield,
  Check,
  X,
  LogOut,
  RefreshCw,
  Award,
  Pin,
  Wrench,
  ChevronDown,
  ChevronUp,
  Activity
} from 'lucide-react';
import { io, Socket } from 'socket.io-client';
import { Toaster, toast } from 'react-hot-toast';

interface ChatMessage {
  id: string;
  sender: string;
  text: string;
  badge: 'mod' | 'sub' | 'vip' | 'none';
  isSpam: boolean;
  isQuestion: boolean;
  sentiment: 'positive' | 'neutral' | 'negative';
  toxicity: number;
  timestamp: string;
}

interface TimelineEvent {
  id: string;
  time: string;
  type: 'hype' | 'game_request' | 'question_spike' | 'toxicity_spike' | 'custom';
  description: string;
}

interface CoPilotRecommendation {
  tip: string;
  action: string;
  confidence: number;
  reason: string;
}

export default function Dashboard() {
  const router = useRouter();
  const [socket, setSocket] = useState<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [isUsingFallback, setIsUsingFallback] = useState(false);
  
  // Stream Session States
  const [streamerName, setStreamerName] = useState('KickStreamer');
  const [theme, setTheme] = useState('General Chat');
  const [goals, setGoals] = useState<string[]>([]);
  const [instructions, setInstructions] = useState('');
  const [mode, setMode] = useState<'demo' | 'live'>('demo');
  
  // Dashboard UI States
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [aiSummary, setAiSummary] = useState('');
  const [questions, setQuestions] = useState<Array<{ id: string; question: string; asker: string; importance: string }>>([]);
  const [topics, setTopics] = useState<string[]>([]);
  const [recommendations, setRecommendations] = useState<CoPilotRecommendation[]>([]);
  const [sentiment, setSentiment] = useState({ positive: 50, neutral: 45, negative: 5 });
  const [hypeLevel, setHypeLevel] = useState<'low' | 'medium' | 'high'>('low');
  const [hypeScore, setHypeScore] = useState(0);
  const [messagesPerMin, setMessagesPerMin] = useState(0);
  const [uptime, setUptime] = useState('00:00:00');
  const [timeline, setTimeline] = useState<TimelineEvent[]>([]);
  const [modAlerts, setModAlerts] = useState<Array<{ id: string; message: string; severity: 'low' | 'medium' | 'high' }>>([]);
  
  // Custom Chat Inputs
  const [customMsgText, setCustomMsgText] = useState('');
  const [customMsgSender, setCustomMsgSender] = useState('JudgeViewer');
  const [customMsgBadge, setCustomMsgBadge] = useState<'none' | 'vip' | 'sub' | 'mod'>('none');
  
  // Stream Recap overlay
  const [showRecap, setShowRecap] = useState(false);
  const [recapTimeline, setRecapTimeline] = useState<TimelineEvent[]>([]);
  const [pinnedQuestion, setPinnedQuestion] = useState<string | null>(null);
  
  // Dev Tools Panel
  const [showDevTools, setShowDevTools] = useState(false);

  // AI sync state
  const [aiLastSync, setAiLastSync] = useState<number>(0);
  
  // Timers and references
  const chatEndRef = useRef<HTMLDivElement>(null);
  const chatContainerRef = useRef<HTMLDivElement>(null);
  const uptimeIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const fallbackIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const socketRef = useRef<Socket | null>(null);
  
  // Uptime ticker
  useEffect(() => {
    let seconds = 0;
    uptimeIntervalRef.current = setInterval(() => {
      seconds++;
      const hrs = Math.floor(seconds / 3600).toString().padStart(2, '0');
      const mins = Math.floor((seconds % 3600) / 60).toString().padStart(2, '0');
      const secs = (seconds % 60).toString().padStart(2, '0');
      setUptime(`${hrs}:${mins}:${secs}`);
    }, 1000);

    return () => {
      if (uptimeIntervalRef.current) clearInterval(uptimeIntervalRef.current);
    };
  }, []);

  // Scroll to bottom of chat only if user is already near the bottom
  useEffect(() => {
    const container = chatContainerRef.current;
    if (container) {
      const isAtBottom = container.scrollHeight - container.scrollTop - container.clientHeight < 150;
      if (isAtBottom || chatMessages.length <= 1) {
        container.scrollTo({
          top: container.scrollHeight,
          behavior: 'smooth'
        });
      }
    }
  }, [chatMessages]);

  // Main Socket Connection & Fallback Init
  useEffect(() => {
    // Load config from localStorage
    const savedConfigStr = localStorage.getItem('streammind_session_config');
    let config = {
      streamerName: 'DemoStreamer',
      theme: 'Valorant Ranked',
      goals: ['Detect important questions', 'Detect hype moments'],
      instructions: 'Highlight giveaway and sponsorship info.',
      mode: 'demo' as const
    };

    if (savedConfigStr) {
      try {
        config = JSON.parse(savedConfigStr);
        setStreamerName(config.streamerName);
        setTheme(config.theme);
        setGoals(config.goals);
        setInstructions(config.instructions);
        setMode(config.mode);
      } catch (e) {
        console.error(e);
      }
    }

    // Connect to local custom Socket.io server
    const socketUrl = 'http://localhost:3001';
    const socketInstance = io(socketUrl, {
      timeout: 4000,
      reconnectionAttempts: 2
    });

    socketRef.current = socketInstance;
    setSocket(socketInstance);

    socketInstance.on('connect', () => {
      setIsConnected(true);
      setIsUsingFallback(false);
      toast.success('Connected to WebSocket Server');

      socketInstance.emit('start-session', {
        theme: config.theme,
        goals: config.goals,
        instructions: config.instructions,
        mode: config.mode,
        streamerName: config.streamerName
      });
    });

    socketInstance.on('connect_error', () => {
      setIsConnected(false);
      setIsUsingFallback(true);
      startLocalFallbackSimulator(config);
    });

    socketInstance.on('session-started', (data) => {
      toast.success(`Session started: ${data.mode === 'demo' ? 'Simulated' : 'Live'} mode`);
    });

    socketInstance.on('new-message', (msg: any) => {
      setChatMessages(prev => [...prev.slice(-80), {
        id: msg.id,
        sender: msg.sender,
        text: msg.text,
        badge: msg.badge,
        isSpam: msg.isSpam,
        isQuestion: msg.isQuestion,
        sentiment: msg.sentiment,
        toxicity: msg.toxicity,
        timestamp: new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      }]);
    });

    socketInstance.on('dashboard-update', (data: any) => {
      setAiSummary(data.summary);
      setTopics(data.topics);
      setRecommendations(data.recommendations);
      setSentiment(data.sentiment);
      setHypeLevel(data.hypeLevel);
      setHypeScore(data.hypeScore);
      if (data.messagesPerMin !== undefined) setMessagesPerMin(data.messagesPerMin);
      setAiLastSync(Date.now());
    });

    socketInstance.on('questions-update', (qs: any[]) => {
      setQuestions(qs);
    });

    socketInstance.on('timeline-update', (events: any[]) => {
      setTimeline(events);
    });

    socketInstance.on('mod-alert', (alert: any) => {
      setModAlerts(prev => [alert, ...prev.slice(0, 15)]);
      toast(alert.message, {
        icon: alert.severity === 'high' ? '🚨' : '⚠️',
        style: {
          background: '#11151D',
          color: '#fff',
          border: `1px solid ${alert.severity === 'high' ? '#EF4444' : '#F59E0B'}`
        }
      });
    });

    socketInstance.on('action-completed', (data: any) => {
      if (data.type === 'question') {
        if (data.action === 'addressed') {
          setQuestions(prev => prev.filter(q => q.id !== data.id));
          toast.success('Question marked addressed!');
        } else if (data.action === 'pin') {
          // Find question text to pin
          setQuestions(prev => {
            const found = prev.find(q => q.id === data.id);
            if (found) setPinnedQuestion(found.question);
            return prev;
          });
          toast.success('Question pinned to HUD!');
        } else if (data.action === 'ignore') {
          setQuestions(prev => prev.filter(q => q.id !== data.id));
          toast.success('Question dismissed.');
        }
      } else if (data.type === 'recommendation') {
        setRecommendations(prev => prev.filter((_, idx) => idx !== Number(data.id)));
        toast.success('Recommendation actioned!');
      }
    });

    socketInstance.on('session-ended', (data: any) => {
      setRecapTimeline(data.recap || []);
      setShowRecap(true);
      toast.success('Session completed.');
    });

    return () => {
      socketInstance.disconnect();
      if (fallbackIntervalRef.current) clearInterval(fallbackIntervalRef.current);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Client-Side Fallback Simulator
  const startLocalFallbackSimulator = useCallback((config: any) => {
    toast.error('WebSocket offline — running local simulator.');
    
    const initialEvents: TimelineEvent[] = [
      { id: '1', time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }), type: 'custom', description: '🟢 Local simulator initialized.' }
    ];
    setTimeline(initialEvents);

    const mockSenders = ['LurkMax', 'GamerElite', 'VipCode', 'PandaEye', 'DevTester', 'ScamBot44'];
    const textPool = [
      'What specs do you use on your setup?',
      'OMG WHAT A SHOT! 🔥🚀',
      'gg noob teammate',
      'Can I play with you next lobby?',
      'Check out this cool game site bit.ly/win-robux-hack',
      'This stream is sponsored right?',
      'hype train incoming lets gooo!',
      'What keyboard is that? Sounds like red switches.',
      'Valorant gameplay looks very smooth today',
      'Is the giveaway command active right now?',
      'scam check: claim skins free-skins.com'
    ];

    let messageCounter = 0;
    
    fallbackIntervalRef.current = setInterval(() => {
      messageCounter++;
      
      const rSender = mockSenders[Math.floor(Math.random() * mockSenders.length)];
      const rText = textPool[Math.floor(Math.random() * textPool.length)];
      const rBadge = rSender === 'VipCode' ? 'vip' : rSender === 'DevTester' ? 'mod' : 'none';
      
      const isQuestion = rText.includes('?');
      const isSpam = rText.includes('bit.ly') || rText.includes('free-skins.com');
      const isToxic = rText.includes('noob') || rText.includes('trash');

      const newMsg: ChatMessage = {
        id: `local-${messageCounter}`,
        sender: rSender,
        text: rText,
        badge: rBadge as any,
        isSpam,
        isQuestion: isQuestion && !isSpam,
        sentiment: isToxic ? 'negative' : rText.includes('🔥') ? 'positive' : 'neutral',
        toxicity: isToxic ? 0.8 : isSpam ? 0.9 : 0.0,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      };

      setChatMessages(prev => [...prev.slice(-60), newMsg]);

      if (isSpam && Math.random() < 0.3) {
        setModAlerts(prev => [{
          id: `alert-${Date.now()}`,
          message: `Spam alert from @${rSender}: "${rText}"`,
          severity: 'medium'
        }, ...prev.slice(0, 15)]);
      }
      
      if (isToxic && Math.random() < 0.4) {
        setModAlerts(prev => [{
          id: `alert-${Date.now()}`,
          message: `Toxicity: "${rText}" by @${rSender}`,
          severity: 'high'
        }, ...prev.slice(0, 15)]);
      }

      if (isQuestion && !isSpam && Math.random() < 0.5) {
        setQuestions(prev => {
          if (prev.some(q => q.question === rText)) return prev;
          return [...prev, {
            id: `q-${Date.now()}`,
            question: rText,
            asker: rSender,
            importance: Math.random() > 0.5 ? 'high' : 'medium'
          }].slice(0, 8);
        });
      }

      if (messageCounter % 8 === 0) {
        const scores = [35, 68, 89, 24];
        const newScore = scores[Math.floor(Math.random() * scores.length)];
        setHypeScore(newScore);
        setHypeLevel(newScore > 70 ? 'high' : newScore > 40 ? 'medium' : 'low');
        setMessagesPerMin(Math.floor(Math.random() * 40) + 15);

        const summaryPools = [
          `Chat is asking about your stream: ${config.theme}. Keyboard switches and lobby invitations trending.`,
          `Audience discussing giveaways. Positive sentiment has risen due to gameplay hype.`,
          `Brief spam flood intercepted. Rule engine flagged scam link domains.`
        ];
        setAiSummary(summaryPools[Math.floor(Math.random() * summaryPools.length)]);

        setRecommendations([
          {
            tip: 'Viewers want to join the lobby.',
            action: 'Pin discord lobby room link and run a queue poll.',
            confidence: 94,
            reason: 'Multiple viewers requested to play together.'
          },
          {
            tip: 'Positive sentiment is high.',
            action: 'Do a quick subscriber shoutout.',
            confidence: 88,
            reason: 'Chat is in a great mood — reinforce it.'
          }
        ]);

        setTopics(config.theme.toLowerCase().includes('valorant') 
          ? ['Lobby', 'Sensitivity', 'Aim', 'Giveaway', 'Vandal'] 
          : ['Coding', 'Gemini', 'SQLite', 'Dashboard', 'Vercel']
        );

        setAiLastSync(Date.now());

        if (newScore > 75) {
          setTimeline(prev => [{
            id: `event-${Date.now()}`,
            time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            type: 'hype',
            description: '🔥 Huge hype spike detected!'
          }, ...prev]);
        }
      }
    }, 1800);
  }, []);

  // One-Click Action handler
  const handleAction = (type: 'question' | 'recommendation', action: 'addressed' | 'pin' | 'ignore', id: string) => {
    if (isConnected && socket) {
      socket.emit('one-click-action', { type, action, id });
    } else {
      if (type === 'question') {
        if (action === 'addressed') {
          setQuestions(prev => prev.filter(q => q.id !== id));
          toast.success('Question marked addressed!');
        } else if (action === 'pin') {
          const q = questions.find(item => item.id === id);
          if (q) {
            setPinnedQuestion(q.question);
            toast.success('Question pinned to HUD!');
          }
        } else if (action === 'ignore') {
          setQuestions(prev => prev.filter(q => q.id !== id));
          toast.success('Question dismissed.');
        }
      } else if (type === 'recommendation') {
        setRecommendations(prev => prev.filter((_, idx) => idx !== Number(id)));
        toast.success('Recommendation actioned!');
      }
    }
  };

  // Developer spike triggers
  const triggerSpike = (spikeType: 'hype' | 'spam' | 'toxic') => {
    if (isConnected && socket) {
      socket.emit(`trigger-${spikeType}-spike`);
      toast.success(`${spikeType} spike triggered`);
    } else {
      toast.success(`Simulated ${spikeType} spike`);
      const nowString = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

      if (spikeType === 'hype') {
        setHypeScore(95);
        setHypeLevel('high');
        setSentiment({ positive: 80, neutral: 15, negative: 5 });
        
        const spikeMsgs: ChatMessage[] = Array.from({ length: 6 }).map((_, i) => ({
          id: `spike-hype-${i}-${Date.now()}`,
          sender: `HypeLover_${i}`,
          text: 'POGGERS LETS GOOOO !!! 🔥🔥🔥🚀',
          badge: 'sub' as const,
          isSpam: false,
          isQuestion: false,
          sentiment: 'positive' as const,
          toxicity: 0.0,
          timestamp: nowString
        }));
        setChatMessages(prev => [...prev, ...spikeMsgs]);
        
        setTimeline(prev => [{
          id: `evt-${Date.now()}`,
          time: nowString,
          type: 'hype' as const,
          description: '🔥 Huge hype spike detected!'
        }, ...prev]);

      } else if (spikeType === 'spam') {
        setSentiment({ positive: 30, neutral: 30, negative: 40 });
        const spikeMsgs: ChatMessage[] = Array.from({ length: 5 }).map((_, i) => ({
          id: `spike-spam-${i}-${Date.now()}`,
          sender: `BotSpam_${i}`,
          text: 'CLAIM FREE ROBUX AT scam-robux-link.xyz !!!',
          badge: 'none' as const,
          isSpam: true,
          isQuestion: false,
          sentiment: 'negative' as const,
          toxicity: 0.85,
          timestamp: nowString
        }));
        setChatMessages(prev => [...prev, ...spikeMsgs]);

        setModAlerts(prev => [{
          id: `alert-${Date.now()}`,
          message: 'Spam spike: Scam URL links blocked.',
          severity: 'medium'
        }, ...prev]);

        setTimeline(prev => [{
          id: `evt-${Date.now()}`,
          time: nowString,
          type: 'toxicity_spike' as const,
          description: '⚠️ Spam flood detected.'
        }, ...prev]);

      } else if (spikeType === 'toxic') {
        setSentiment({ positive: 20, neutral: 30, negative: 50 });
        const spikeMsgs: ChatMessage[] = Array.from({ length: 4 }).map((_, i) => ({
          id: `spike-toxic-${i}-${Date.now()}`,
          sender: `ToxicTroll_${i}`,
          text: 'streamer is absolute garbage at this game noob',
          badge: 'none' as const,
          isSpam: false,
          isQuestion: false,
          sentiment: 'negative' as const,
          toxicity: 0.8,
          timestamp: nowString
        }));
        setChatMessages(prev => [...prev, ...spikeMsgs]);

        setModAlerts(prev => [{
          id: `alert-${Date.now()}`,
          message: 'High toxicity detected in chat.',
          severity: 'high'
        }, ...prev]);

        setTimeline(prev => [{
          id: `evt-${Date.now()}`,
          time: nowString,
          type: 'toxicity_spike' as const,
          description: '🚨 Toxic messages increasing.'
        }, ...prev]);
      }
    }
  };

  // Send a custom chat message
  const sendCustomMessage = () => {
    if (!customMsgText.trim()) return;

    if (isConnected && socket) {
      socket.emit('send-chat-message', {
        sender: customMsgSender,
        text: customMsgText,
        badge: customMsgBadge
      });
    } else {
      const newMsg: ChatMessage = {
        id: `custom-msg-${Date.now()}`,
        sender: customMsgSender,
        text: customMsgText,
        badge: customMsgBadge,
        isSpam: customMsgText.includes('bit.ly'),
        isQuestion: customMsgText.includes('?'),
        sentiment: 'neutral',
        toxicity: 0.0,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      };
      setChatMessages(prev => [...prev, newMsg]);
      
      if (newMsg.isQuestion) {
        setQuestions(prev => [{
          id: `q-${Date.now()}`,
          question: newMsg.text,
          asker: newMsg.sender,
          importance: 'high'
        }, ...prev]);
      }
    }

    setCustomMsgText('');
  };

  // End Session
  const handleEndSession = () => {
    if (isConnected && socket) {
      socket.emit('end-session');
    } else {
      if (fallbackIntervalRef.current) clearInterval(fallbackIntervalRef.current);
      
      const nowString = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      const finalEvents = [
        ...timeline,
        {
          id: `evt-end-${Date.now()}`,
          time: nowString,
          type: 'custom' as const,
          description: '🔴 Stream ended. Final recap compiled.'
        }
      ].reverse();
      
      setRecapTimeline(finalEvents);
      setShowRecap(true);
      toast.success('Session completed.');
    }
  };

  // Format "time ago" for AI sync
  const getAiSyncLabel = () => {
    if (!aiLastSync) return 'Waiting for data...';
    const secsAgo = Math.floor((Date.now() - aiLastSync) / 1000);
    if (secsAgo < 5) return 'Just now';
    if (secsAgo < 60) return `${secsAgo}s ago`;
    return `${Math.floor(secsAgo / 60)}m ago`;
  };

  // Hype color
  const hypeColor = hypeLevel === 'high' ? '#EF4444' : hypeLevel === 'medium' ? '#F59E0B' : '#53FC18';

  return (
    <div className="h-screen bg-kick-dark text-gray-100 flex flex-col overflow-hidden">
      <Toaster position="top-right" />

      {/* ──── TOP BAR ──── */}
      <header className="h-14 border-b border-kick-border bg-kick-panel/60 backdrop-blur px-4 md:px-6 flex items-center justify-between shrink-0 z-20">
        
        {/* Left: Logo + Status */}
        <div className="flex items-center gap-3">
          <div className="w-7 h-7 rounded-lg bg-kick-green flex items-center justify-center font-black text-kick-dark text-sm">S</div>
          <span className="text-sm font-extrabold text-white hidden sm:inline">StreamMind AI</span>
          
          <div className="h-4 w-px bg-kick-border" />
          
          <div className="flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
            <span className="text-xs font-bold text-white uppercase">LIVE</span>
          </div>

          <div className="h-4 w-px bg-kick-border hidden sm:block" />

          <div className="hidden sm:flex items-center gap-1 text-xs text-gray-400">
            <Clock className="w-3 h-3" />
            <span className="font-mono font-bold text-white">{uptime}</span>
          </div>

          <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
            mode === 'demo' 
              ? 'bg-kick-green/10 text-kick-green border border-kick-green/20' 
              : 'bg-blue-500/10 text-blue-400 border border-blue-500/20'
          }`}>
            {mode === 'demo' ? 'DEMO' : 'LIVE KICK'}
          </span>

          {isUsingFallback && (
            <span className="px-1.5 py-0.5 rounded bg-yellow-500/10 text-yellow-500 border border-yellow-500/20 text-[9px] font-bold animate-pulse">
              OFFLINE
            </span>
          )}
        </div>

        {/* Right: Stats + Controls */}
        <div className="flex items-center gap-3">
          <div className="hidden md:flex items-center gap-2 text-xs text-gray-400">
            <Activity className="w-3.5 h-3.5 text-kick-green" />
            <span className="font-bold text-white">{messagesPerMin}</span>
            <span>msg/min</span>
          </div>

          <div className="h-4 w-px bg-kick-border hidden md:block" />

          <button 
            onClick={() => setShowDevTools(!showDevTools)}
            className={`p-1.5 rounded-lg border transition-all cursor-pointer ${
              showDevTools 
                ? 'bg-kick-green/10 border-kick-green/30 text-kick-green' 
                : 'bg-kick-panel border-kick-border text-gray-400 hover:text-white'
            }`}
            title="Developer Tools"
          >
            <Wrench className="w-3.5 h-3.5" />
          </button>

          <button 
            onClick={handleEndSession}
            className="bg-red-500/80 hover:bg-red-500 text-white px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer"
          >
            End Stream
          </button>
        </div>
      </header>

      {/* ──── PINNED QUESTION HUD ──── */}
      {pinnedQuestion && (
        <div className="bg-kick-green/10 border-b border-kick-green/30 px-4 py-2 flex items-center justify-between text-sm shrink-0">
          <div className="flex items-center gap-2 text-kick-green font-semibold text-xs">
            <Pin className="w-3.5 h-3.5 fill-kick-green" />
            <span className="uppercase">Pinned:</span>
            <span className="text-white font-medium italic">"{pinnedQuestion}"</span>
          </div>
          <button onClick={() => setPinnedQuestion(null)} className="text-gray-400 hover:text-white cursor-pointer">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* ──── MAIN 2-COLUMN LAYOUT ──── */}
      <div className="flex-1 flex overflow-hidden">
        
        {/* ═══ LEFT COLUMN: Live Chat ═══ */}
        <div className="w-full lg:w-[38%] xl:w-[35%] flex flex-col border-r border-kick-border">
          
          {/* Chat Header */}
          <div className="px-4 py-2.5 border-b border-kick-border bg-kick-panel/30 flex items-center justify-between shrink-0">
            <h3 className="font-bold text-white text-sm flex items-center gap-1.5">
              <MessageSquare className="w-3.5 h-3.5 text-kick-green" />
              Live Chat
            </h3>
            <span className="text-[10px] text-gray-500 font-mono">{chatMessages.length} msgs</span>
          </div>

          {/* Chat Messages */}
          <div ref={chatContainerRef} className="flex-1 overflow-y-auto p-3 space-y-2 min-h-0">
            {chatMessages.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-gray-500">
                <MessageSquare className="w-6 h-6 mb-2 stroke-[1.5] opacity-50" />
                <p className="text-xs">Waiting for chat messages...</p>
              </div>
            ) : (
              chatMessages.map((msg) => (
                <div 
                  key={msg.id} 
                  className={`px-2.5 py-2 rounded-lg border transition-all text-[13px] ${
                    msg.isSpam 
                      ? 'bg-yellow-950/15 border-yellow-500/20 opacity-60' 
                      : msg.toxicity > 0.5 
                        ? 'bg-red-950/15 border-red-500/20'
                        : 'bg-transparent border-transparent hover:bg-kick-panel/30'
                  }`}
                >
                  <div className="flex items-center gap-1.5 mb-0.5">
                    {msg.badge === 'mod' && (
                      <Shield className="w-3 h-3 text-red-400" />
                    )}
                    {msg.badge === 'vip' && (
                      <span className="text-[8px] text-purple-400 font-black">VIP</span>
                    )}
                    {msg.badge === 'sub' && (
                      <span className="text-[8px] text-kick-green font-black">SUB</span>
                    )}
                    <span className="text-xs font-bold text-kick-green">{msg.sender}</span>
                    <span className="text-[10px] text-gray-600 ml-auto font-mono">{msg.timestamp}</span>
                  </div>
                  <p className="text-gray-200 leading-relaxed break-words">{msg.text}</p>
                  {msg.isSpam && (
                    <span className="text-[9px] text-yellow-500 font-bold mt-0.5 inline-block">⚠ SPAM</span>
                  )}
                  {msg.toxicity > 0.5 && !msg.isSpam && (
                    <span className="text-[9px] text-red-400 font-bold mt-0.5 inline-block">🚨 TOXIC {(msg.toxicity * 100).toFixed(0)}%</span>
                  )}
                </div>
              ))
            )}
            <div ref={chatEndRef} />
          </div>

          {/* Chat Input */}
          <div className="p-3 border-t border-kick-border bg-kick-panel/20 shrink-0">
            <div className="flex gap-2">
              <input 
                type="text"
                placeholder="Type a message..."
                value={customMsgText}
                onChange={(e) => setCustomMsgText(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && sendCustomMessage()}
                className="flex-1 px-3 py-2 rounded-lg bg-kick-dark border border-kick-border text-white text-xs placeholder-gray-500 focus:outline-none focus:border-kick-green/50"
              />
              <button 
                onClick={sendCustomMessage}
                className="p-2 rounded-lg bg-kick-green text-kick-dark hover:shadow-[0_0_8px_rgba(83,252,24,0.3)] transition-all cursor-pointer"
              >
                <Send className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>

        {/* ═══ RIGHT COLUMN: AI Insights ═══ */}
        <div className="hidden lg:flex flex-1 flex-col overflow-y-auto p-4 gap-4">
          
          {/* Row 1: AI Summary + Hype Meter */}
          <div className="grid grid-cols-3 gap-4">
            {/* AI Summary (takes 2 cols) */}
            <div className="col-span-2 glass-panel rounded-xl p-4">
              <div className="flex items-center justify-between mb-2">
                <h3 className="font-bold text-white text-sm flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-kick-green" />
                  AI Stream Summary
                </h3>
                <span className="flex items-center gap-1 text-[10px] text-gray-500">
                  <RefreshCw className={`w-3 h-3 ${aiLastSync ? 'text-kick-green' : 'text-gray-600'}`} />
                  {getAiSyncLabel()}
                </span>
              </div>
              {aiSummary ? (
                <p className="text-gray-300 text-xs leading-relaxed bg-kick-dark/30 p-3 rounded-lg border border-kick-border/30 italic">
                  "{aiSummary}"
                </p>
              ) : (
                <div className="text-gray-500 text-xs bg-kick-dark/30 p-3 rounded-lg border border-kick-border/30 flex items-center gap-2">
                  <RefreshCw className="w-3 h-3 animate-spin" />
                  Analyzing chat — first summary in ~25 seconds...
                </div>
              )}
            </div>

            {/* Hype Meter */}
            <div className="glass-panel rounded-xl p-4 flex flex-col items-center justify-center">
              <div className="relative w-16 h-16 flex items-center justify-center mb-1">
                <svg className="w-full h-full transform -rotate-90">
                  <circle cx="32" cy="32" r="26" stroke="#222C3A" strokeWidth="5" fill="transparent" />
                  <circle 
                    cx="32" cy="32" r="26" 
                    stroke={hypeColor} strokeWidth="5" fill="transparent" 
                    strokeDasharray={163.4}
                    strokeDashoffset={163.4 - (163.4 * hypeScore) / 100}
                    className="transition-all duration-700"
                  />
                </svg>
                <div className="absolute flex flex-col items-center">
                  <span className="text-lg font-black text-white">{hypeScore}%</span>
                </div>
              </div>
              <span className="text-[10px] font-bold uppercase" style={{ color: hypeColor }}>{hypeLevel} HYPE</span>
              <div className="flex items-center gap-0.5 mt-1.5 w-full">
                <div className={`h-1 flex-1 rounded ${hypeLevel === 'low' ? 'bg-kick-green' : 'bg-kick-border'}`} />
                <div className={`h-1 flex-1 rounded ${hypeLevel === 'medium' ? 'bg-yellow-500' : 'bg-kick-border'}`} />
                <div className={`h-1 flex-1 rounded ${hypeLevel === 'high' ? 'bg-red-500 animate-pulse' : 'bg-kick-border'}`} />
              </div>
            </div>
          </div>

          {/* Row 2: Questions + Co-Pilot Advisor */}
          <div className="grid grid-cols-2 gap-4">
            {/* Unaddressed Questions */}
            <div className="glass-panel rounded-xl flex flex-col max-h-72">
              <div className="px-4 py-2.5 border-b border-kick-border flex items-center justify-between shrink-0">
                <h3 className="font-bold text-white text-sm flex items-center gap-1.5">
                  <HelpCircle className="w-3.5 h-3.5 text-kick-green" />
                  Questions
                </h3>
                {questions.length > 0 && (
                  <span className="text-[10px] bg-kick-green/10 text-kick-green border border-kick-green/20 px-1.5 py-0.5 rounded font-bold">
                    {questions.length}
                  </span>
                )}
              </div>

              <div className="flex-1 p-3 overflow-y-auto space-y-2 min-h-0">
                {questions.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-gray-500 py-6">
                    <Check className="w-5 h-5 text-kick-green/50 mb-1" />
                    <p className="text-xs">No pending questions</p>
                  </div>
                ) : (
                  questions.map((q) => (
                    <div key={q.id} className="p-2.5 bg-kick-panel/40 border border-kick-border rounded-lg hover:border-kick-green/20 transition-all group">
                      <div className="flex items-center gap-1.5 mb-1">
                        <span className="text-[10px] text-kick-green font-bold">@{q.asker}</span>
                        <span className={`text-[9px] px-1 rounded font-bold ${
                          q.importance === 'high' 
                            ? 'bg-red-500/10 text-red-400' 
                            : 'bg-yellow-500/10 text-yellow-500'
                        }`}>
                          {q.importance.toUpperCase()}
                        </span>
                      </div>
                      <p className="text-xs text-white leading-relaxed mb-1.5">"{q.question}"</p>
                      <div className="flex items-center gap-1 opacity-70 group-hover:opacity-100 transition-opacity">
                        <button 
                          onClick={() => handleAction('question', 'addressed', q.id)}
                          className="p-1 rounded bg-kick-green/10 text-kick-green hover:bg-kick-green hover:text-kick-dark transition-all cursor-pointer" title="Address"
                        >
                          <Check className="w-3 h-3" />
                        </button>
                        <button 
                          onClick={() => handleAction('question', 'pin', q.id)}
                          className="p-1 rounded bg-kick-dark text-gray-400 hover:text-kick-green transition-all cursor-pointer" title="Pin"
                        >
                          <Pin className="w-3 h-3" />
                        </button>
                        <button 
                          onClick={() => handleAction('question', 'ignore', q.id)}
                          className="p-1 rounded bg-kick-dark text-gray-400 hover:text-red-400 transition-all cursor-pointer" title="Dismiss"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* AI Co-Pilot Advisor */}
            <div className="glass-panel rounded-xl flex flex-col max-h-72">
              <div className="px-4 py-2.5 border-b border-kick-border flex items-center justify-between shrink-0">
                <h3 className="font-bold text-white text-sm flex items-center gap-1.5">
                  <Award className="w-3.5 h-3.5 text-kick-green" />
                  AI Co-Pilot
                </h3>
              </div>

              <div className="flex-1 p-3 overflow-y-auto space-y-2 min-h-0">
                {recommendations.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-gray-500 py-6">
                    <Sparkles className="w-5 h-5 text-kick-green/50 mb-1" />
                    <p className="text-xs">Gathering insights...</p>
                  </div>
                ) : (
                  recommendations.map((rec, index) => (
                    <div key={index} className="p-3 bg-kick-panel/40 border border-kick-green/20 rounded-lg relative">
                      <div className="absolute top-2 right-2 bg-kick-green text-kick-dark px-1.5 py-0.5 rounded text-[9px] font-black">
                        {rec.confidence}%
                      </div>
                      <h4 className="text-xs font-bold text-kick-green uppercase pr-10">{rec.tip}</h4>
                      <p className="text-[11px] text-gray-400 mt-0.5">{rec.reason}</p>
                      <div className="mt-2 flex items-center justify-between gap-2 bg-kick-dark p-1.5 rounded border border-kick-border">
                        <span className="text-[11px] text-white font-semibold flex-1">{rec.action}</span>
                        <div className="flex gap-1 shrink-0">
                          <button 
                            onClick={() => handleAction('recommendation', 'addressed', index.toString())}
                            className="px-2 py-0.5 rounded bg-kick-green text-kick-dark font-bold text-[9px] cursor-pointer hover:shadow-[0_0_8px_rgba(83,252,24,0.3)]"
                          >
                            Do It
                          </button>
                          <button 
                            onClick={() => handleAction('recommendation', 'ignore', index.toString())}
                            className="px-1.5 py-0.5 rounded bg-kick-border text-gray-400 hover:text-white text-[9px] cursor-pointer"
                          >
                            Skip
                          </button>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

          {/* Row 3: Sentiment + Trending Topics + Mod Alerts */}
          <div className="grid grid-cols-3 gap-4">
            
            {/* Sentiment */}
            <div className="glass-panel rounded-xl p-4">
              <h3 className="font-bold text-white text-xs mb-3 flex items-center gap-1.5">
                <TrendingUp className="w-3.5 h-3.5 text-kick-green" />
                Audience Mood
              </h3>
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-gray-400 flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-kick-green" /> Positive</span>
                  <span className="font-bold text-white">{sentiment.positive}%</span>
                </div>
                <div className="w-full bg-kick-border rounded-full h-1.5">
                  <div className="bg-kick-green h-1.5 rounded-full transition-all duration-500" style={{ width: `${sentiment.positive}%` }} />
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-gray-400 flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-gray-500" /> Neutral</span>
                  <span className="font-bold text-white">{sentiment.neutral}%</span>
                </div>
                <div className="w-full bg-kick-border rounded-full h-1.5">
                  <div className="bg-gray-500 h-1.5 rounded-full transition-all duration-500" style={{ width: `${sentiment.neutral}%` }} />
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-gray-400 flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-red-500" /> Negative</span>
                  <span className="font-bold text-white">{sentiment.negative}%</span>
                </div>
                <div className="w-full bg-kick-border rounded-full h-1.5">
                  <div className="bg-red-500 h-1.5 rounded-full transition-all duration-500" style={{ width: `${sentiment.negative}%` }} />
                </div>
              </div>
            </div>

            {/* Trending Topics */}
            <div className="glass-panel rounded-xl p-4">
              <h3 className="font-bold text-white text-xs mb-3">Trending Topics</h3>
              {topics.length === 0 ? (
                <p className="text-xs text-gray-500">Analyzing chat topics...</p>
              ) : (
                <div className="flex flex-wrap gap-1.5">
                  {topics.map((t, i) => (
                    <span key={i} className="px-2 py-1 bg-kick-dark border border-kick-border rounded text-[11px] font-semibold text-white">
                      <span className="text-kick-green font-mono mr-1">#{i + 1}</span>{t}
                    </span>
                  ))}
                </div>
              )}
            </div>

            {/* Mod Alerts */}
            <div className="glass-panel rounded-xl p-4 flex flex-col max-h-48 overflow-hidden">
              <h3 className="font-bold text-white text-xs mb-2 flex items-center gap-1.5">
                <AlertTriangle className="w-3.5 h-3.5 text-yellow-500" />
                Mod Alerts
              </h3>
              <div className="flex-1 overflow-y-auto space-y-1.5 min-h-0">
                {modAlerts.length === 0 ? (
                  <p className="text-xs text-gray-500 italic">No warnings.</p>
                ) : (
                  modAlerts.slice(0, 5).map(alert => (
                    <div key={alert.id} className={`p-1.5 rounded border text-[10px] ${
                      alert.severity === 'high' 
                        ? 'bg-red-950/15 border-red-500/20 text-red-300' 
                        : 'bg-yellow-950/15 border-yellow-500/20 text-yellow-300'
                    }`}>
                      <span className="mr-1">{alert.severity === 'high' ? '🚨' : '⚠️'}</span>
                      {alert.message}
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

          {/* Row 4: Timeline */}
          <div className="glass-panel rounded-xl flex flex-col max-h-52">
            <div className="px-4 py-2.5 border-b border-kick-border flex items-center justify-between shrink-0">
              <h3 className="font-bold text-white text-sm flex items-center gap-1.5">
                <Compass className="w-3.5 h-3.5 text-kick-green" />
                Stream Timeline
              </h3>
              <span className="text-[10px] text-gray-500 font-mono">{timeline.length} events</span>
            </div>
            <div className="flex-1 p-3 overflow-y-auto min-h-0">
              {timeline.length === 0 ? (
                <p className="text-xs text-gray-500 italic py-3 text-center">Timeline will populate as events happen...</p>
              ) : (
                <div className="space-y-2 relative before:absolute before:left-1.5 before:top-1.5 before:bottom-1.5 before:w-px before:bg-kick-border">
                  {timeline.map((evt) => (
                    <div key={evt.id} className="relative pl-5">
                      <div className={`absolute left-0 top-1.5 w-[7px] h-[7px] rounded-full ${
                        evt.type === 'hype' 
                          ? 'bg-kick-green ring-2 ring-kick-green/20' 
                          : evt.type === 'toxicity_spike'
                            ? 'bg-yellow-500 ring-2 ring-yellow-500/20'
                            : 'bg-blue-400 ring-2 ring-blue-400/20'
                      }`} />
                      <div className="flex items-center gap-1.5">
                        <span className="text-[10px] text-gray-500 font-mono bg-kick-dark px-1 py-0.5 rounded">{evt.time}</span>
                        <span className="text-[10px] uppercase font-bold" style={{
                          color: evt.type === 'hype' ? '#53FC18' : evt.type === 'toxicity_spike' ? '#F59E0B' : '#60A5FA'
                        }}>{evt.type.replace('_', ' ')}</span>
                      </div>
                      <p className="text-xs text-white mt-0.5">{evt.description}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

        </div>
      </div>

      {/* ──── FLOATING DEV TOOLS PANEL ──── */}
      {showDevTools && (
        <div className="fixed bottom-4 right-4 w-80 glass-panel rounded-xl border border-kick-green/20 shadow-[0_0_20px_rgba(0,0,0,0.5)] z-50 animate-fade-in-up">
          <div className="px-4 py-2.5 border-b border-kick-border flex items-center justify-between">
            <h4 className="text-xs font-bold text-kick-green uppercase flex items-center gap-1.5">
              <Wrench className="w-3 h-3" />
              Developer Tools
            </h4>
            <button onClick={() => setShowDevTools(false)} className="text-gray-400 hover:text-white cursor-pointer">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
          <div className="p-3 space-y-3">
            {/* Spike Triggers */}
            <div>
              <span className="text-[10px] text-gray-500 font-bold uppercase block mb-1.5">Spike Triggers</span>
              <div className="flex gap-2">
                <button 
                  onClick={() => triggerSpike('hype')}
                  className="flex-1 px-2 py-1.5 rounded-lg bg-kick-dark border border-kick-green/20 text-kick-green text-xs font-bold hover:bg-kick-green/10 cursor-pointer"
                >
                  🔥 Hype
                </button>
                <button 
                  onClick={() => triggerSpike('spam')}
                  className="flex-1 px-2 py-1.5 rounded-lg bg-kick-dark border border-yellow-500/20 text-yellow-500 text-xs font-bold hover:bg-yellow-500/10 cursor-pointer"
                >
                  ⚠️ Spam
                </button>
                <button 
                  onClick={() => triggerSpike('toxic')}
                  className="flex-1 px-2 py-1.5 rounded-lg bg-kick-dark border border-red-500/20 text-red-500 text-xs font-bold hover:bg-red-500/10 cursor-pointer"
                >
                  🚨 Toxic
                </button>
              </div>
            </div>

            {/* Inject Custom Message */}
            <div>
              <span className="text-[10px] text-gray-500 font-bold uppercase block mb-1.5">Inject Message</span>
              <div className="flex gap-1.5 mb-1.5">
                <input 
                  type="text"
                  placeholder="Sender"
                  value={customMsgSender}
                  onChange={(e) => setCustomMsgSender(e.target.value)}
                  className="w-1/2 px-2 py-1 text-[11px] rounded bg-kick-dark border border-kick-border text-white focus:outline-none focus:border-kick-green/50"
                />
                <select 
                  value={customMsgBadge}
                  onChange={(e) => setCustomMsgBadge(e.target.value as any)}
                  className="w-1/2 px-2 py-1 text-[11px] rounded bg-kick-dark border border-kick-border text-gray-400 focus:outline-none"
                >
                  <option value="none">No Badge</option>
                  <option value="sub">Subscriber</option>
                  <option value="vip">VIP</option>
                  <option value="mod">Moderator</option>
                </select>
              </div>
              <div className="flex gap-1.5">
                <input 
                  type="text"
                  placeholder="Message text..."
                  value={customMsgText}
                  onChange={(e) => setCustomMsgText(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && sendCustomMessage()}
                  className="flex-1 px-2 py-1.5 rounded bg-kick-dark border border-kick-border text-white text-[11px] placeholder-gray-500 focus:outline-none focus:border-kick-green/50"
                />
                <button 
                  onClick={sendCustomMessage}
                  className="p-1.5 rounded bg-kick-green text-kick-dark cursor-pointer"
                >
                  <Send className="w-3 h-3" />
                </button>
              </div>
            </div>

            {/* Session Info */}
            <div className="pt-2 border-t border-kick-border">
              <div className="text-[10px] text-gray-500 space-y-0.5">
                <div>Streamer: <span className="text-white font-semibold">{streamerName}</span></div>
                <div>Theme: <span className="text-white font-semibold">{theme}</span></div>
                <div>Mode: <span className="text-kick-green font-semibold">{mode === 'demo' ? 'Simulated' : 'Live KICK'}</span></div>
                <div>Socket: <span className={isConnected ? 'text-kick-green' : 'text-yellow-500'}>{isConnected ? 'Connected' : 'Fallback'}</span></div>
              </div>
              <button 
                onClick={() => router.push('/')}
                className="w-full mt-2 py-1.5 rounded bg-kick-border hover:bg-red-950/20 hover:text-red-400 text-xs font-semibold transition-all flex items-center justify-center gap-1 cursor-pointer text-gray-400"
              >
                <LogOut className="w-3 h-3" />
                Back to Setup
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ──── STREAM RECAP OVERLAY ──── */}
      {showRecap && (
        <div className="absolute inset-0 bg-kick-dark/95 backdrop-blur z-50 flex items-center justify-center p-4">
          <div className="w-full max-w-2xl bg-kick-panel border border-kick-green/30 rounded-2xl p-6 md:p-8 flex flex-col max-h-[85vh] shadow-[0_0_40px_rgba(83,252,24,0.1)] animate-fade-in-up">
            
            {/* Header */}
            <div className="text-center pb-4 border-b border-kick-border">
              <div className="text-3xl mb-2">🏆</div>
              <h2 className="text-xl font-black text-white">Stream Recap</h2>
              <p className="text-xs text-gray-400 mt-1">Session analytics for @{streamerName}</p>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-3 gap-3 my-4">
              <div className="p-3 bg-kick-dark border border-kick-border rounded-xl text-center">
                <span className="text-[10px] text-gray-500 font-bold uppercase block">Uptime</span>
                <span className="text-sm font-black text-white block font-mono">{uptime}</span>
              </div>
              <div className="p-3 bg-kick-dark border border-kick-border rounded-xl text-center">
                <span className="text-[10px] text-gray-500 font-bold uppercase block">Messages</span>
                <span className="text-sm font-black text-kick-green block">{chatMessages.length}</span>
              </div>
              <div className="p-3 bg-kick-dark border border-kick-border rounded-xl text-center">
                <span className="text-[10px] text-gray-500 font-bold uppercase block">Events</span>
                <span className="text-sm font-black text-white block">{timeline.length}</span>
              </div>
            </div>

            {/* Timeline */}
            <div className="flex-1 overflow-y-auto min-h-0">
              <h4 className="text-xs text-gray-400 font-bold uppercase mb-3 flex items-center gap-1">
                <Clock className="w-3 h-3 text-kick-green" />
                Event Log
              </h4>
              <div className="space-y-3 border-l border-kick-border ml-2 pl-4">
                {recapTimeline.length === 0 ? (
                  <p className="text-xs text-gray-500 italic">No events recorded.</p>
                ) : (
                  recapTimeline.map(evt => (
                    <div key={evt.id} className="relative">
                      <div className="absolute -left-[21px] top-1.5 w-2 h-2 rounded-full bg-kick-green" />
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] text-gray-500 font-mono bg-kick-dark px-1 py-0.5 rounded">{evt.time}</span>
                        <span className="text-[9px] bg-kick-green/10 text-kick-green px-1 rounded font-bold uppercase">{evt.type}</span>
                      </div>
                      <p className="text-xs text-white mt-0.5">{evt.description}</p>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Footer */}
            <div className="pt-4 border-t border-kick-border flex gap-3 mt-4">
              <button 
                onClick={() => {
                  setShowRecap(false);
                  router.push('/');
                }}
                className="flex-1 py-2.5 rounded-xl bg-kick-border hover:bg-kick-border/80 text-white font-bold text-sm transition-all cursor-pointer text-center"
              >
                Back to Setup
              </button>
              <button 
                onClick={() => {
                  setShowRecap(false);
                  window.location.reload();
                }}
                className="flex-1 py-2.5 rounded-xl bg-kick-green text-kick-dark font-bold text-sm hover:shadow-[0_0_12px_rgba(83,252,24,0.3)] transition-all cursor-pointer text-center"
              >
                Restart Co-pilot
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
}
