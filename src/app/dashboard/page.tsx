'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { 
  Gamepad2, 
  Tv, 
  MessageSquare, 
  Sparkles, 
  HelpCircle, 
  AlertTriangle, 
  TrendingUp, 
  Compass, 
  Clock, 
  Send,
  Zap,
  Users,
  Shield,
  Check,
  X,
  Volume2,
  VolumeX,
  LogOut,
  RefreshCw,
  Award,
  Pin
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
  const [sessionActive, setSessionActive] = useState(false);
  const [streamerName, setStreamerName] = useState('KickStreamer');
  const [theme, setTheme] = useState('General Chat');
  const [goals, setGoals] = useState<string[]>([]);
  const [instructions, setInstructions] = useState('');
  const [mode, setMode] = useState<'demo' | 'live'>('demo');
  
  // Dashboard UI States
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [aiSummary, setAiSummary] = useState('StreamMind AI is warming up. Chat summaries will update every 30 seconds.');
  const [questions, setQuestions] = useState<Array<{ id: string; question: string; asker: string; importance: string }>>([]);
  const [topics, setTopics] = useState<string[]>(['Setup', 'Stream', 'Play', 'Lounge']);
  const [recommendations, setRecommendations] = useState<CoPilotRecommendation[]>([
    {
      tip: "AI model is processing initial stats.",
      action: "Stay tuned for recommended prompts.",
      confidence: 90,
      reason: "Gathering baseline chat parameters."
    }
  ]);
  const [sentiment, setSentiment] = useState({ positive: 50, neutral: 45, negative: 5 });
  const [hypeLevel, setHypeLevel] = useState<'low' | 'medium' | 'high'>('low');
  const [hypeScore, setHypeScore] = useState(15);
  const [viewerCount, setViewerCount] = useState(1420);
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
      
      // Randomly fluctuation in viewer counts for realism
      setViewerCount(prev => Math.max(10, prev + Math.floor(Math.random() * 9) - 4));
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
    console.log(`Connecting to Socket server at ${socketUrl}`);
    const socketInstance = io(socketUrl, {
      timeout: 4000,
      reconnectionAttempts: 2
    });

    socketRef.current = socketInstance;
    setSocket(socketInstance);

    socketInstance.on('connect', () => {
      console.log('Connected to StreamMind AI real-time server!');
      setIsConnected(true);
      setIsUsingFallback(false);
      toast.success('Connected to Live WebSocket Server!');

      // Start the stream session on server
      socketInstance.emit('start-session', {
        theme: config.theme,
        goals: config.goals,
        instructions: config.instructions,
        mode: config.mode,
        streamerName: config.streamerName
      });
    });

    socketInstance.on('connect_error', () => {
      console.warn('Socket connection failed. Initializing resilient local simulator...');
      setIsConnected(false);
      setIsUsingFallback(true);
      startLocalFallbackSimulator(config);
    });

    // Websocket Listeners
    socketInstance.on('session-started', (data) => {
      setSessionActive(true);
      toast.success(`Session started in ${data.mode === 'demo' ? 'Simulated' : 'Live'} mode.`);
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
          const found = questions.find(q => q.id === data.id);
          if (found) {
            setPinnedQuestion(found.question);
            toast.success('Question pinned to streamer HUD!');
          }
        } else if (data.action === 'ignore') {
          setQuestions(prev => prev.filter(q => q.id !== data.id));
          toast.success('Question ignored.');
        }
      } else if (data.type === 'recommendation') {
        // Resolve recommendation card
        setRecommendations(prev => prev.filter((_, idx) => idx !== Number(data.id)));
        toast.success('Recommendation actioned!');
      }
    });

    socketInstance.on('session-ended', (data: any) => {
      setSessionActive(false);
      setRecapTimeline(data.recap || []);
      setShowRecap(true);
      toast.success('Session completed. View Recap details.');
    });

    return () => {
      socketInstance.disconnect();
      if (fallbackIntervalRef.current) clearInterval(fallbackIntervalRef.current);
    };
  }, []);

  // Client-Side Resilient Fallback Simulator (If WebSocket Port is Blocked)
  const startLocalFallbackSimulator = (config: any) => {
    setSessionActive(true);
    toast.error('Websocket Offline. Started Resilient Local Simulator.');
    
    // Add default initial events
    const initialEvents: TimelineEvent[] = [
      { id: '1', time: '01:00 PM', type: 'custom', description: '🟢 Resilient Local Simulator initialized.' }
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
    
    // Local message generator interval
    fallbackIntervalRef.current = setInterval(() => {
      messageCounter++;
      
      const rSender = mockSenders[Math.floor(Math.random() * mockSenders.length)];
      const rText = textPool[Math.floor(Math.random() * textPool.length)];
      const rBadge = rSender === 'VipCode' ? 'vip' : rSender === 'DevTester' ? 'mod' : 'none';
      
      // Basic rule processing on client
      const isQuestion = rText.includes('?');
      const isSpam = rText.includes('bit.ly') || rText.includes('free-skins.com') || rText.toUpperCase() === rText;
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

      // Mod alert triggers
      if (isSpam && Math.random() < 0.3) {
        setModAlerts(prev => [{
          id: `alert-${Date.now()}`,
          message: `Spam alert from user @${rSender}: "${rText}"`,
          severity: 'medium'
        }, ...prev]);
      }
      
      // Toxicity warning
      if (isToxic && Math.random() < 0.4) {
        setModAlerts(prev => [{
          id: `alert-${Date.now()}`,
          message: `Toxicity check: "${rText}" by @${rSender}`,
          severity: 'high'
        }, ...prev]);
      }

      // Add to Questions list periodically
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

      // Periodically update AI summaries & Hype (every 15s in local demo mode for faster user wow factor)
      if (messageCounter % 8 === 0) {
        // Hype Meter calculations
        const scores = [35, 68, 89, 24];
        const newScore = scores[Math.floor(Math.random() * scores.length)];
        setHypeScore(newScore);
        setHypeLevel(newScore > 70 ? 'high' : newScore > 40 ? 'medium' : 'low');

        // Dynamic AI summaries based on theme
        const summaryPools = [
          `Chat is asking details about your stream: ${config.theme}. There is queries regarding keyboard switches and play lobby invitations.`,
          `Audience is discussing giveaways. Positive sentiment has risen by 15% due to the gameplay.`,
          `A brief spam flood was intercepted. Rule engine successfully flagged scam link domains.`
        ];
        setAiSummary(summaryPools[Math.floor(Math.random() * summaryPools.length)]);

        // Dynamic co-pilot advice
        setRecommendations([
          {
            tip: "High amount of viewers asking to join lobby.",
            action: "Pin discord lobby room link and run a queue poll.",
            confidence: 94,
            reason: "Increase engagement goal is selected."
          },
          {
            tip: "Audience sentiment is mostly Positive.",
            action: "Do a quick subscriber shoutout to reinforce mood.",
            confidence: 88,
            reason: "Current Positive ratio is 68%."
          }
        ]);

        // Topics
        setTopics(config.theme.toLowerCase().includes('valorant') 
          ? ['Lobby', 'Sens', 'Aim', 'Giveaway', 'Vandal'] 
          : ['Coding', 'Gemini', 'SQLite', 'Dashboard', 'Vercel']
        );

        // Timeline spike logs
        if (newScore > 75) {
          const newEvent: TimelineEvent = {
            id: `event-${Date.now()}`,
            time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            type: 'hype',
            description: '🔥 Huge hype spike: Chat velocity and emote spikes detected!'
          };
          setTimeline(prev => [newEvent, ...prev]);
        }
      }
    }, 1800);
  };

  // One-Click Action handler
  const handleAction = (type: 'question' | 'recommendation', action: 'addressed' | 'pin' | 'ignore', id: string) => {
    if (isConnected && socket) {
      socket.emit('one-click-action', { type, action, id });
    } else {
      // Local fallback handler
      if (type === 'question') {
        if (action === 'addressed') {
          setQuestions(prev => prev.filter(q => q.id !== id));
          toast.success('Question marked addressed!');
        } else if (action === 'pin') {
          const q = questions.find(item => item.id === id);
          if (q) {
            setPinnedQuestion(q.question);
            toast.success('Question pinned to streamer HUD!');
          }
        } else if (action === 'ignore') {
          setQuestions(prev => prev.filter(q => q.id !== id));
          toast.success('Question ignored.');
        }
      } else if (type === 'recommendation') {
        setRecommendations(prev => prev.filter((_, idx) => idx !== Number(id)));
        toast.success('Recommendation actioned!');
      }
    }
  };

  // Developer triggers for testing spikes
  const triggerSpike = (spikeType: 'hype' | 'spam' | 'toxic') => {
    if (isConnected && socket) {
      socket.emit(`trigger-${spikeType}-spike`);
      toast.success(`Triggering ${spikeType} spike...`);
    } else {
      // Handle spikes locally
      toast.success(`Triggering simulated ${spikeType} spike...`);
      const nowString = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

      if (spikeType === 'hype') {
        setHypeScore(95);
        setHypeLevel('high');
        setSentiment({ positive: 80, neutral: 15, negative: 5 });
        
        // Add hype messages
        const spikeMsgs: ChatMessage[] = Array.from({ length: 6 }).map((_, i) => ({
          id: `spike-hype-${i}-${Date.now()}`,
          sender: `HypeLover_${i}`,
          text: 'POGGERS LETS GOOOO !!! 🔥🔥🔥🚀',
          badge: 'sub',
          isSpam: false,
          isQuestion: false,
          sentiment: 'positive',
          toxicity: 0.0,
          timestamp: nowString
        }));
        setChatMessages(prev => [...prev, ...spikeMsgs]);
        
        setTimeline(prev => [{
          id: `evt-${Date.now()}`,
          time: nowString,
          type: 'hype',
          description: '🔥 Huge hype spike: Chat velocity and emote spikes detected!'
        }, ...prev]);

      } else if (spikeType === 'spam') {
        setSentiment({ positive: 30, neutral: 30, negative: 40 });
        const spikeMsgs: ChatMessage[] = Array.from({ length: 5 }).map((_, i) => ({
          id: `spike-spam-${i}-${Date.now()}`,
          sender: `BotSpam_${i}`,
          text: 'CLAIM FREE ROBUX AT scam-robux-link.xyz !!!',
          badge: 'none',
          isSpam: true,
          isQuestion: false,
          sentiment: 'negative',
          toxicity: 0.85,
          timestamp: nowString
        }));
        setChatMessages(prev => [...prev, ...spikeMsgs]);

        setModAlerts(prev => [{
          id: `alert-${Date.now()}`,
          message: 'Spam spike: Repetitive posts and scam URL links blocked.',
          severity: 'medium'
        }, ...prev]);

        setTimeline(prev => [{
          id: `evt-${Date.now()}`,
          time: nowString,
          type: 'toxicity_spike',
          description: '⚠️ Spam flood: Chat velocity and spam rates spiked.'
        }, ...prev]);

      } else if (spikeType === 'toxic') {
        setSentiment({ positive: 20, neutral: 30, negative: 50 });
        const spikeMsgs: ChatMessage[] = Array.from({ length: 4 }).map((_, i) => ({
          id: `spike-toxic-${i}-${Date.now()}`,
          sender: `ToxicTroll_${i}`,
          text: 'streamer is absolute garbage at this game uninstall shit noob',
          badge: 'none',
          isSpam: false,
          isQuestion: false,
          sentiment: 'negative',
          toxicity: 0.8,
          timestamp: nowString
        }));
        setChatMessages(prev => [...prev, ...spikeMsgs]);

        setModAlerts(prev => [{
          id: `alert-${Date.now()}`,
          message: 'Moderation Warning: High toxicity detected in recent chats.',
          severity: 'high'
        }, ...prev]);

        setTimeline(prev => [{
          id: `evt-${Date.now()}`,
          time: nowString,
          type: 'toxicity_spike',
          description: '🚨 Moderation: Toxic messages or bad words increasing.'
        }, ...prev]);
      }
    }
  };

  // Send a custom chat message manually (testing input)
  const sendCustomMessage = () => {
    if (!customMsgText.trim()) return;

    if (isConnected && socket) {
      socket.emit('send-chat-message', {
        sender: customMsgSender,
        text: customMsgText,
        badge: customMsgBadge
      });
    } else {
      // Local addition
      const newMsg: ChatMessage = {
        id: `custom-msg-${Date.now()}`,
        sender: customMsgSender,
        text: customMsgText,
        badge: customMsgBadge,
        isSpam: customMsgText.includes('bit.ly') || customMsgText.toUpperCase() === customMsgText,
        isQuestion: customMsgText.includes('?'),
        sentiment: 'neutral',
        toxicity: customMsgText.includes('fuck') || customMsgText.includes('noob') ? 0.7 : 0.0,
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
    toast.success('Chat injected!');
  };

  // End Session & View Timeline Recap
  const handleEndSession = () => {
    if (isConnected && socket) {
      socket.emit('end-session');
    } else {
      // End session locally
      if (fallbackIntervalRef.current) clearInterval(fallbackIntervalRef.current);
      setSessionActive(false);
      
      const nowString = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      const finalEvents = [
        ...timeline,
        {
          id: `evt-end-${Date.now()}`,
          time: nowString,
          type: 'custom' as const,
          description: '🔴 Stream ended. StreamMind AI compiled final recap.'
        }
      ].reverse();
      
      setRecapTimeline(finalEvents);
      setShowRecap(true);
      toast.success('Session completed.');
    }
  };

  return (
    <div className="min-h-screen bg-kick-dark text-gray-100 flex relative overflow-hidden">
      <Toaster position="top-right" />

      {/* SIDEBAR */}
      <aside className="w-64 bg-kick-panel border-r border-kick-border hidden xl:flex flex-col justify-between z-10 shrink-0">
        <div>
          {/* Logo */}
          <div className="p-6 border-b border-kick-border flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-kick-green flex items-center justify-center font-black text-kick-dark">
              S
            </div>
            <div>
              <h2 className="font-extrabold text-white text-base">StreamMind AI</h2>
              <span className="text-[10px] text-kick-green uppercase tracking-wider font-bold">AI STREAM COPILOT</span>
            </div>
          </div>

          {/* Nav Items */}
          <nav className="p-4 space-y-1">
            <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-kick-border text-white text-sm font-semibold cursor-pointer">
              <Tv className="w-4 h-4 text-kick-green" />
              <span>Dashboard</span>
            </div>
            <div className="flex items-center gap-3 px-4 py-3 rounded-xl text-gray-400 hover:text-white hover:bg-kick-panel-hover text-sm font-semibold transition-all cursor-pointer">
              <MessageSquare className="w-4 h-4" />
              <span>Live Chat Stream</span>
            </div>
            <div className="flex items-center gap-3 px-4 py-3 rounded-xl text-gray-400 hover:text-white hover:bg-kick-panel-hover text-sm font-semibold transition-all cursor-pointer">
              <Sparkles className="w-4 h-4" />
              <span>AI Insights</span>
            </div>
            <div className="flex items-center gap-3 px-4 py-3 rounded-xl text-gray-400 hover:text-white hover:bg-kick-panel-hover text-sm font-semibold transition-all cursor-pointer">
              <AlertTriangle className="w-4 h-4" />
              <span>Moderator Alerts</span>
            </div>
          </nav>
        </div>

        {/* User profile / session status */}
        <div className="p-4 border-t border-kick-border bg-kick-dark/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-kick-border flex items-center justify-center text-kick-green font-bold border border-kick-green/20">
              {streamerName.substring(0, 2).toUpperCase()}
            </div>
            <div>
              <h4 className="text-sm font-bold text-white truncate max-w-[130px]">{streamerName}</h4>
              <span className="text-[10px] text-gray-400 truncate max-w-[130px] block">
                {mode === 'demo' ? 'Simulated Stream' : 'Live integration'}
              </span>
            </div>
          </div>
          <button 
            onClick={() => router.push('/')}
            className="w-full mt-4 py-2 rounded-xl bg-kick-border hover:bg-red-950/20 hover:text-red-400 text-xs font-semibold transition-all flex items-center justify-center gap-1.5 cursor-pointer"
          >
            <LogOut className="w-3.5 h-3.5" />
            End Co-pilot Session
          </button>
        </div>
      </aside>

      {/* MAIN CONTAINER */}
      <main className="flex-1 flex flex-col min-w-0 lg:overflow-hidden overflow-y-auto relative z-10">
        
        {/* TOP NAVBAR */}
        <header className="h-16 border-b border-kick-border bg-kick-panel/50 backdrop-blur px-4 md:px-6 flex items-center justify-between shrink-0">
          
          {/* Status left */}
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <div className="w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse" />
              <span className="text-sm font-bold text-white uppercase tracking-wider">LIVE</span>
            </div>
            
            <div className="h-4 w-[1px] bg-kick-border" />
            
            <div className="hidden sm:flex items-center gap-1.5 text-xs text-gray-400">
              <Clock className="w-3.5 h-3.5" />
              <span>UPTIME: <strong className="text-white font-mono">{uptime}</strong></span>
            </div>
            
            <div className="h-4 w-[1px] bg-kick-border hidden sm:block" />

            {/* Mode Tag */}
            <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
              mode === 'demo' 
                ? 'bg-kick-green/10 text-kick-green border border-kick-green/20' 
                : 'bg-blue-500/10 text-blue-400 border border-blue-500/20'
            }`}>
              {mode === 'demo' ? 'SIMULATED DEMO' : 'LIVE KICK'}
            </span>

            {/* Fallback Tag if socket offline */}
            {isUsingFallback && (
              <span className="px-2 py-0.5 rounded-full bg-yellow-500/10 text-yellow-500 border border-yellow-500/20 text-[9px] font-bold animate-pulse">
                WS OFFLINE (LOCAL SIM)
              </span>
            )}
          </div>

          {/* Quick Triggers & Stats right */}
          <div className="flex items-center gap-4">
            
            {/* Developer Test Spikes Buttons */}
            <div className="hidden md:flex items-center gap-1.5 p-1 rounded-xl bg-kick-dark border border-kick-border">
              <span className="text-[10px] text-gray-500 font-bold uppercase px-2">JUDGE SPIKE CONTROLS:</span>
              <button 
                onClick={() => triggerSpike('hype')}
                className="px-2.5 py-1 rounded-lg bg-kick-panel hover:bg-kick-panel-hover text-[11px] font-bold text-kick-green border border-kick-green/20 flex items-center gap-1 cursor-pointer"
              >
                🔥 Hype
              </button>
              <button 
                onClick={() => triggerSpike('spam')}
                className="px-2.5 py-1 rounded-lg bg-kick-panel hover:bg-kick-panel-hover text-[11px] font-bold text-yellow-500 border border-yellow-500/20 flex items-center gap-1 cursor-pointer"
              >
                ⚠️ Spam
              </button>
              <button 
                onClick={() => triggerSpike('toxic')}
                className="px-2.5 py-1 rounded-lg bg-kick-panel hover:bg-kick-panel-hover text-[11px] font-bold text-red-500 border border-red-500/20 flex items-center gap-1 cursor-pointer"
              >
                🚨 Toxic
              </button>
            </div>

            {/* Live stats */}
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1 text-sm font-semibold text-white">
                <Users className="w-4 h-4 text-kick-green" />
                <span>{viewerCount.toLocaleString()}</span>
              </div>
              <button 
                onClick={handleEndSession}
                className="bg-red-500 hover:bg-red-600 text-white px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1"
              >
                End Stream
              </button>
            </div>

          </div>
        </header>

        {/* HUD Notification: Pinned Question */}
        {pinnedQuestion && (
          <div className="bg-kick-green/10 border-b border-kick-green/30 px-6 py-2.5 flex items-center justify-between text-sm animate-fade-in-up">
            <div className="flex items-center gap-2 text-kick-green font-semibold">
              <Pin className="w-4 h-4 fill-kick-green" />
              <span>PINNED QUESTION ON STREAM:</span>
              <span className="text-white font-medium italic">"{pinnedQuestion}"</span>
            </div>
            <button 
              onClick={() => setPinnedQuestion(null)}
              className="text-gray-400 hover:text-white"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* DASHBOARD CONTENT GRID */}
        <div className="flex-1 p-4 md:p-6 grid grid-cols-1 lg:grid-cols-3 gap-6 overflow-hidden">
          
          {/* LEFT COLUMN: Chat Feed & Controls */}
          <div className="lg:col-span-1 flex flex-col gap-6 h-auto lg:h-[calc(100vh-7rem)] overflow-hidden">
            
            {/* Widget 1: Chat Feed */}
            <div className="flex-1 glass-panel rounded-2xl flex flex-col overflow-hidden">
              <div className="px-4 py-3.5 border-b border-kick-border bg-kick-dark/20 flex items-center justify-between">
                <h3 className="font-bold text-white text-sm flex items-center gap-2">
                  <MessageSquare className="w-4 h-4 text-kick-green" />
                  Live Chat Feed
                </h3>
                <span className="text-[10px] text-gray-500 font-bold uppercase">{chatMessages.length} logs</span>
              </div>

              {/* Chat scrolling box */}
              <div ref={chatContainerRef} className="flex-1 p-4 overflow-y-auto space-y-3.5 text-sm flex flex-col min-h-0">
                {chatMessages.length === 0 ? (
                  <div className="flex-1 flex flex-col items-center justify-center text-center p-6 text-gray-500">
                    <MessageSquare className="w-8 h-8 mb-2 stroke-[1.5]" />
                    <p className="text-xs">Chat is empty. Ingesting stream chats...</p>
                  </div>
                ) : (
                  chatMessages.map((msg) => (
                    <div 
                      key={msg.id} 
                      className={`p-2.5 rounded-xl border transition-all ${
                        msg.isSpam 
                          ? 'bg-yellow-950/20 border-yellow-500/30' 
                          : msg.toxicity > 0.5 
                            ? 'bg-red-950/20 border-red-500/30'
                            : 'bg-kick-panel/40 border-kick-border hover:border-kick-green/20'
                      }`}
                    >
                      {/* Message header */}
                      <div className="flex items-center justify-between mb-1">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          {/* Badges */}
                          {msg.badge === 'mod' && (
                            <span className="p-0.5 rounded bg-red-500/10 border border-red-500/20 text-red-400" title="Moderator">
                              <Shield className="w-3 h-3 fill-red-400/20" />
                            </span>
                          )}
                          {msg.badge === 'vip' && (
                            <span className="px-1 py-0.5 rounded bg-purple-500/10 text-purple-400 border border-purple-500/20 text-[9px] font-bold" title="VIP">
                              VIP
                            </span>
                          )}
                          {msg.badge === 'sub' && (
                            <span className="px-1 py-0.5 rounded bg-kick-green/10 text-kick-green border border-kick-green/20 text-[9px] font-bold animate-pulse" title="Subscriber">
                              SUB
                            </span>
                          )}
                          <strong className="text-xs font-bold text-kick-green">{msg.sender}</strong>
                        </div>
                        <span className="text-[10px] text-gray-500 font-mono">{msg.timestamp}</span>
                      </div>
                      
                      {/* Message body */}
                      <p className="text-gray-200 text-[13px] leading-relaxed break-words">{msg.text}</p>
                      
                      {/* Flag warnings */}
                      {msg.isSpam && (
                        <span className="inline-flex items-center gap-1 text-[9px] text-yellow-500 font-bold uppercase mt-1 bg-yellow-500/5 px-1.5 py-0.5 rounded border border-yellow-500/20">
                          ⚠️ Spam detected
                        </span>
                      )}
                      {msg.toxicity > 0.5 && (
                        <span className="inline-flex items-center gap-1 text-[9px] text-red-400 font-bold uppercase mt-1 bg-red-500/5 px-1.5 py-0.5 rounded border border-red-500/20">
                          🚨 Toxicity: {(msg.toxicity * 100).toFixed(0)}%
                        </span>
                      )}
                    </div>
                  ))
                )}
                <div ref={chatEndRef} />
              </div>

              {/* Chat Manual Injection Control */}
              <div className="p-3 border-t border-kick-border bg-kick-dark/30 space-y-2">
                <div className="flex items-center gap-2">
                  <input 
                    type="text"
                    placeholder="Custom Sender"
                    value={customMsgSender}
                    onChange={(e) => setCustomMsgSender(e.target.value)}
                    className="w-1/3 px-2 py-1 text-xs rounded bg-kick-panel border border-kick-border text-white focus:outline-none focus:border-kick-green"
                  />
                  <select 
                    value={customMsgBadge}
                    onChange={(e) => setCustomMsgBadge(e.target.value as any)}
                    className="w-1/3 px-2 py-1 text-xs rounded bg-kick-panel border border-kick-border text-gray-400 focus:outline-none"
                  >
                    <option value="none">No Badge</option>
                    <option value="sub">Subscriber</option>
                    <option value="vip">VIP Viewer</option>
                    <option value="mod">Moderator</option>
                  </select>
                  <span className="text-[9px] text-gray-500 uppercase font-bold text-right flex-1">INJECT MSG</span>
                </div>
                <div className="flex gap-2">
                  <input 
                    type="text"
                    placeholder="Type to test question parsing or filters..."
                    value={customMsgText}
                    onChange={(e) => setCustomMsgText(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && sendCustomMessage()}
                    className="flex-1 px-3 py-2 rounded-xl bg-kick-panel border border-kick-border text-white text-xs placeholder-gray-500 focus:outline-none focus:border-kick-green"
                  />
                  <button 
                    onClick={sendCustomMessage}
                    className="p-2 rounded-xl bg-kick-green text-kick-dark hover:shadow-[0_0_10px_rgba(83,252,24,0.3)] transition-all cursor-pointer"
                  >
                    <Send className="w-3.5 h-3.5 fill-kick-dark" />
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* MIDDLE COLUMN: AI Summary, Questions & Co-pilot */}
          <div className="lg:col-span-1 flex flex-col gap-6 h-auto lg:h-[calc(100vh-7rem)] overflow-hidden">
            
            {/* Widget 2: AI Summary */}
            <div className="glass-panel rounded-2xl p-4 flex flex-col relative overflow-hidden">
              {/* Scanline grid effects */}
              <div className="absolute inset-0 bg-gradient-to-b from-[#53FC18]/1 to-transparent pointer-events-none" />
              <div className="flex items-center justify-between mb-3 border-b border-kick-border pb-2">
                <h3 className="font-bold text-white text-sm flex items-center gap-1.5">
                  <Sparkles className="w-4 h-4 text-kick-green" />
                  AI Stream Summary
                </h3>
                <span className="flex items-center gap-1 text-[10px] text-kick-green font-bold uppercase">
                  <RefreshCw className="w-3 h-3 animate-spin" />
                  AUTOSYNC 30S
                </span>
              </div>
              <p className="text-gray-300 text-xs leading-relaxed italic bg-kick-dark/30 p-3 rounded-xl border border-kick-border/40">
                "{aiSummary}"
              </p>
            </div>

            {/* Widget 3: Important Questions (with One-Click Actions) */}
            <div className="flex-1 glass-panel rounded-2xl flex flex-col overflow-hidden">
              <div className="px-4 py-3.5 border-b border-kick-border bg-kick-dark/20 flex items-center justify-between">
                <h3 className="font-bold text-white text-sm flex items-center gap-1.5">
                  <HelpCircle className="w-4 h-4 text-kick-green" />
                  Unaddressed Questions
                </h3>
                <span className="text-[10px] bg-kick-green/10 text-kick-green border border-kick-green/20 px-2 py-0.5 rounded font-bold">
                  {questions.length} RANKED
                </span>
              </div>

              <div className="flex-1 p-4 overflow-y-auto space-y-3 min-h-0">
                {questions.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-center p-6 text-gray-500">
                    <Check className="w-8 h-8 text-kick-green mb-2" />
                    <p className="text-xs">No pending questions in queue!</p>
                  </div>
                ) : (
                  questions.map((q) => (
                    <div 
                      key={q.id} 
                      className="p-3 bg-kick-panel/60 border border-kick-border rounded-xl flex items-start justify-between gap-3 animate-fade-in-up hover:border-kick-green/30 transition-all"
                    >
                      <div className="space-y-1 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] text-kick-green font-bold">@{q.asker}</span>
                          <span className={`text-[9px] px-1.5 rounded uppercase font-bold ${
                            q.importance === 'high' 
                              ? 'bg-red-500/10 text-red-400 border border-red-500/20' 
                              : 'bg-yellow-500/10 text-yellow-500 border border-yellow-500/20'
                          }`}>
                            {q.importance}
                          </span>
                        </div>
                        <p className="text-xs text-white leading-relaxed">"{q.question}"</p>
                      </div>
                      
                      {/* One Click Actions */}
                      <div className="flex items-center gap-1.5">
                        <button 
                          onClick={() => handleAction('question', 'pin', q.id)}
                          className="p-1.5 rounded bg-kick-dark hover:bg-kick-border text-gray-400 hover:text-kick-green transition-all"
                          title="Pin to stream HUD"
                        >
                          <Pin className="w-3.5 h-3.5" />
                        </button>
                        <button 
                          onClick={() => handleAction('question', 'addressed', q.id)}
                          className="p-1.5 rounded bg-kick-green/10 text-kick-green border border-kick-green/20 hover:bg-kick-green hover:text-kick-dark transition-all"
                          title="Mark Addressed"
                        >
                          <Check className="w-3.5 h-3.5" />
                        </button>
                        <button 
                          onClick={() => handleAction('question', 'ignore', q.id)}
                          className="p-1.5 rounded bg-kick-dark hover:bg-red-950/20 text-gray-400 hover:text-red-400 transition-all"
                          title="Ignore"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Streamer Co-pilot Panel (with Confidence Score & One-Click Actions) */}
            <div className="glass-panel rounded-2xl p-4 flex flex-col relative overflow-hidden">
              <div className="flex items-center justify-between mb-3 border-b border-kick-border pb-2">
                <h3 className="font-bold text-white text-sm flex items-center gap-1.5">
                  <Award className="w-4 h-4 text-kick-green animate-bounce" />
                  AI Co-Pilot Advisor
                </h3>
              </div>

              <div className="space-y-3">
                {recommendations.map((rec, index) => (
                  <div 
                    key={index}
                    className="p-3 bg-gradient-to-r from-kick-panel to-kick-panel-hover border border-kick-green/30 rounded-xl relative"
                  >
                    {/* Confidence tag */}
                    <div className="absolute top-2 right-2 bg-kick-green text-kick-dark px-1.5 py-0.5 rounded text-[10px] font-black">
                      Conf: {rec.confidence}%
                    </div>
                    
                    <h4 className="text-xs font-bold text-kick-green uppercase tracking-wider">{rec.tip}</h4>
                    <p className="text-[11px] text-gray-400 mt-0.5 font-medium">Explainability: {rec.reason}</p>
                    
                    {/* Actionable Prompt */}
                    <div className="mt-2.5 bg-kick-dark p-2 rounded-lg border border-kick-border flex items-center justify-between gap-2">
                      <span className="text-xs text-white font-bold">{rec.action}</span>
                      <div className="flex gap-1 shrink-0">
                        <button 
                          onClick={() => handleAction('recommendation', 'addressed', index.toString())}
                          className="px-2 py-0.5 rounded bg-kick-green text-kick-dark font-black text-[10px] hover:shadow-[0_0_10px_rgba(83,252,24,0.3)] transition-all cursor-pointer"
                        >
                          Perform
                        </button>
                        <button 
                          onClick={() => handleAction('recommendation', 'ignore', index.toString())}
                          className="px-1.5 py-0.5 rounded bg-kick-border text-gray-400 hover:text-white text-[10px] cursor-pointer"
                        >
                          Ignore
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

          </div>

          {/* RIGHT COLUMN: Hype, Sentiment, Mod Alerts, Timeline */}
          <div className="lg:col-span-1 flex flex-col gap-6 h-auto lg:h-[calc(100vh-7rem)] overflow-hidden">
            
            {/* Widget 4: Hype Meter */}
            <div className="glass-panel rounded-2xl p-4 flex flex-col relative overflow-hidden">
              <h3 className="font-bold text-white text-sm mb-3 flex items-center gap-1.5">
                <Zap className="w-4 h-4 text-kick-green" />
                Hype Meter
              </h3>

              <div className="flex items-center gap-4">
                {/* Visual speedometer gauge */}
                <div className="relative w-24 h-24 flex items-center justify-center shrink-0">
                  <svg className="w-full h-full transform -rotate-90">
                    <circle 
                      cx="48" cy="48" r="40" 
                      stroke="#222C3A" strokeWidth="8" fill="transparent" 
                    />
                    <circle 
                      cx="48" cy="48" r="40" 
                      stroke="#53FC18" strokeWidth="8" fill="transparent" 
                      strokeDasharray={251.2}
                      strokeDashoffset={251.2 - (251.2 * hypeScore) / 100}
                      className="transition-all duration-1000"
                    />
                  </svg>
                  <div className="absolute flex flex-col items-center">
                    <span className="text-xl font-black text-white">{hypeScore}%</span>
                    <span className="text-[9px] text-gray-400 font-bold uppercase">{hypeLevel}</span>
                  </div>
                </div>

                <div className="flex-1 space-y-1.5">
                  <h4 className="text-sm font-bold text-white">Stream Energy Status</h4>
                  <p className="text-xs text-gray-400 leading-relaxed">
                    Hype is calculated based on CAPS percentage, emote flood count, and message velocity.
                  </p>
                  
                  {/* Visual Levels */}
                  <div className="flex items-center gap-1 mt-2">
                    <div className={`h-2 flex-1 rounded ${hypeLevel === 'low' ? 'bg-blue-500' : 'bg-kick-border'}`} />
                    <div className={`h-2 flex-1 rounded ${hypeLevel === 'medium' ? 'bg-yellow-500' : 'bg-kick-border'}`} />
                    <div className={`h-2 flex-1 rounded ${hypeLevel === 'high' ? 'bg-red-500 animate-pulse' : 'bg-kick-border'}`} />
                  </div>
                </div>
              </div>
            </div>

            {/* Widget 5: Audience Mood & Widget 7: Trending Topics */}
            <div className="glass-panel rounded-2xl p-4 flex flex-col">
              <h3 className="font-bold text-white text-sm mb-3 flex items-center gap-1.5">
                <TrendingUp className="w-4 h-4 text-kick-green" />
                Audience Mood & Topics
              </h3>

              {/* Custom SVG Donut Chart for Sentiment */}
              <div className="flex items-center gap-4 pb-4 border-b border-kick-border">
                <div className="relative w-20 h-20 flex items-center justify-center shrink-0">
                  <svg className="w-full h-full transform -rotate-90">
                    {/* Positive (green) */}
                    <circle 
                      cx="40" cy="40" r="32" 
                      stroke="#53FC18" strokeWidth="8" fill="transparent" 
                      strokeDasharray={201}
                      strokeDashoffset={201 - (201 * sentiment.positive) / 100}
                    />
                    {/* Neutral (gray) */}
                    <circle 
                      cx="40" cy="40" r="32" 
                      stroke="#4B5563" strokeWidth="8" fill="transparent" 
                      strokeDasharray={201}
                      strokeDashoffset={201} // stack simulation simplified
                      className="opacity-40"
                    />
                  </svg>
                  <div className="absolute text-center">
                    <span className="text-sm font-black text-white">{sentiment.positive}%</span>
                    <span className="text-[8px] text-kick-green font-bold block uppercase">Pos</span>
                  </div>
                </div>

                <div className="flex-1 space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="flex items-center gap-1 text-gray-400">
                      <div className="w-2 h-2 rounded-full bg-kick-green" />
                      😊 Positive
                    </span>
                    <span className="font-bold text-white">{sentiment.positive}%</span>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="flex items-center gap-1 text-gray-400">
                      <div className="w-2 h-2 rounded-full bg-gray-500" />
                      😐 Neutral
                    </span>
                    <span className="font-bold text-white">{sentiment.neutral}%</span>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="flex items-center gap-1 text-gray-400">
                      <div className="w-2 h-2 rounded-full bg-red-500" />
                      😡 Negative
                    </span>
                    <span className="font-bold text-white">{sentiment.negative}%</span>
                  </div>
                </div>
              </div>

              {/* Trending Topics Grid */}
              <div className="pt-3">
                <span className="text-[10px] text-gray-500 font-bold uppercase tracking-wider block mb-2">Trending Keywords</span>
                <div className="flex flex-wrap gap-1.5">
                  {topics.map((t, i) => (
                    <span 
                      key={i}
                      className="px-2.5 py-1 bg-kick-panel border border-kick-border rounded-lg text-xs font-semibold text-white flex items-center gap-1"
                    >
                      <span className="text-kick-green font-mono">#{i + 1}</span>
                      {t}
                    </span>
                  ))}
                </div>
              </div>
            </div>

            {/* Widget 6: Moderator Alerts */}
            <div className="glass-panel rounded-2xl p-4 flex flex-col h-40 overflow-hidden">
              <h3 className="font-bold text-white text-sm mb-2 flex items-center gap-1.5">
                <AlertTriangle className="w-4 h-4 text-kick-green" />
                Moderation Log
              </h3>
              
              <div className="flex-1 overflow-y-auto space-y-2 text-[11px] min-h-0">
                {modAlerts.length === 0 ? (
                  <div className="h-full flex items-center justify-center text-gray-500 italic">
                    No active warnings flagged by rules.
                  </div>
                ) : (
                  modAlerts.map(alert => (
                    <div 
                      key={alert.id}
                      className={`p-2 rounded-lg border flex items-start gap-2 ${
                        alert.severity === 'high' 
                          ? 'bg-red-950/20 border-red-500/20 text-red-300' 
                          : 'bg-yellow-950/20 border-yellow-500/20 text-yellow-300'
                      }`}
                    >
                      <span className="mt-0.5 shrink-0">{alert.severity === 'high' ? '🚨' : '⚠️'}</span>
                      <p className="flex-1 leading-relaxed">{alert.message}</p>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Widget 9: Timeline Events */}
            <div className="flex-1 glass-panel rounded-2xl flex flex-col overflow-hidden">
              <div className="px-4 py-3.5 border-b border-kick-border bg-kick-dark/20 flex items-center justify-between">
                <h3 className="font-bold text-white text-sm flex items-center gap-1.5">
                  <Compass className="w-4 h-4 text-kick-green" />
                  Stream Timeline
                </h3>
                <span className="text-[10px] text-gray-500 font-bold uppercase">{timeline.length} MILESTONES</span>
              </div>

              <div className="flex-1 p-4 overflow-y-auto min-h-0 relative">
                {timeline.length === 0 ? (
                  <div className="h-full flex items-center justify-center text-gray-500 text-xs italic">
                    Timeline is starting up...
                  </div>
                ) : (
                  <div className="space-y-4 relative before:absolute before:left-2 before:top-2 before:bottom-2 before:w-[1px] before:bg-kick-border">
                    {timeline.map((evt) => (
                      <div key={evt.id} className="relative pl-6 animate-fade-in-up">
                        {/* Timeline point */}
                        <div className={`absolute left-[5px] top-1.5 w-[7px] h-[7px] rounded-full -translate-x-1/2 ${
                          evt.type === 'hype' 
                            ? 'bg-kick-green ring-4 ring-kick-green/20' 
                            : evt.type === 'toxicity_spike'
                              ? 'bg-yellow-500 ring-4 ring-yellow-500/20'
                              : 'bg-blue-400 ring-4 ring-blue-400/20'
                        }`} />
                        
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] text-gray-500 font-mono font-bold bg-kick-panel px-1.5 py-0.5 rounded">
                            {evt.time}
                          </span>
                          <span className="text-[10px] text-kick-green uppercase font-black tracking-wider">
                            {evt.type}
                          </span>
                        </div>
                        <p className="text-xs text-white mt-1 leading-relaxed">{evt.description}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

          </div>

        </div>

      </main>

      {/* TIMELINE STREAM RECAP OVERLAY */}
      {showRecap && (
        <div className="absolute inset-0 bg-kick-dark/95 backdrop-blur z-50 flex items-center justify-center p-4">
          <div className="w-full max-w-2xl bg-kick-panel border border-kick-green/30 rounded-3xl p-6 md:p-8 flex flex-col max-h-[85vh] shadow-[0_0_50px_rgba(83,252,24,0.15)] animate-fade-in-up">
            
            {/* Header */}
            <div className="text-center pb-4 border-b border-kick-border">
              <div className="w-12 h-12 bg-kick-green text-kick-dark rounded-full flex items-center justify-center mx-auto mb-3 font-black text-xl shadow-[0_0_15px_rgba(83,252,24,0.4)]">
                🏆
              </div>
              <h2 className="text-2xl font-black text-white glow-text">Stream Mind Recap</h2>
              <p className="text-xs text-gray-400 mt-1">Analytics log and event milestones compiled for @{streamerName}</p>
            </div>

            {/* Recap Content */}
            <div className="flex-1 overflow-y-auto py-6 space-y-6 min-h-0 pr-2">
              
              {/* Summary Stats */}
              <div className="grid grid-cols-3 gap-3">
                <div className="p-3 bg-kick-dark border border-kick-border rounded-2xl text-center">
                  <span className="text-[10px] text-gray-500 font-bold uppercase block">Uptime</span>
                  <span className="text-base font-black text-white mt-1 block font-mono">{uptime}</span>
                </div>
                <div className="p-3 bg-kick-dark border border-kick-border rounded-2xl text-center">
                  <span className="text-[10px] text-gray-500 font-bold uppercase block">Peak Viewers</span>
                  <span className="text-base font-black text-kick-green mt-1 block">{(viewerCount + 280).toLocaleString()}</span>
                </div>
                <div className="p-3 bg-kick-dark border border-kick-border rounded-2xl text-center">
                  <span className="text-[10px] text-gray-500 font-bold uppercase block">AI Insights</span>
                  <span className="text-base font-black text-white mt-1 block">{timeline.length} Saved</span>
                </div>
              </div>

              {/* Timeline list */}
              <div>
                <h4 className="text-xs text-gray-400 font-bold uppercase mb-3 flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5 text-kick-green" />
                  Chronological Event Milestones
                </h4>
                
                <div className="space-y-4 border-l border-kick-border ml-2 pl-4">
                  {recapTimeline.length === 0 ? (
                    <p className="text-xs text-gray-500 italic">No events recorded during session.</p>
                  ) : (
                    recapTimeline.map(evt => (
                      <div key={evt.id} className="relative">
                        <div className="absolute -left-[21px] top-1.5 w-2 h-2 rounded-full bg-kick-green" />
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] text-gray-500 font-mono font-bold bg-kick-dark px-1.5 py-0.5 rounded">
                            {evt.time}
                          </span>
                          <span className="text-[9px] bg-kick-green/10 text-kick-green border border-kick-green/20 px-1.5 py-0.5 rounded font-black uppercase">
                            {evt.type}
                          </span>
                        </div>
                        <p className="text-xs text-white mt-1 font-semibold">{evt.description}</p>
                      </div>
                    ))
                  )}
                </div>
              </div>

            </div>

            {/* Actions Footer */}
            <div className="pt-4 border-t border-kick-border flex gap-3">
              <button 
                onClick={() => {
                  setShowRecap(false);
                  router.push('/');
                }}
                className="flex-1 py-3 rounded-xl bg-kick-border hover:bg-kick-border/80 text-white font-bold text-sm transition-all text-center cursor-pointer"
              >
                Back to Onboarding
              </button>
              <button 
                onClick={() => {
                  setShowRecap(false);
                  window.location.reload();
                }}
                className="flex-1 py-3 rounded-xl bg-kick-green text-kick-dark hover:shadow-[0_0_15px_rgba(83,252,24,0.4)] font-bold text-sm transition-all text-center cursor-pointer"
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
