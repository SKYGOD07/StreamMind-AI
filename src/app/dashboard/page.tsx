'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { 
  Menu,
  X,
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
  LogOut,
  RefreshCw,
  Award,
  Pin,
  Wrench,
  ChevronDown,
  ChevronUp,
  Activity,
  Sliders,
  Tv,
  Search,
  Bell,
  SlidersHorizontal,
  User,
  Plus,
  Trash2,
  Copy,
  FolderSync
} from 'lucide-react';
import { io, Socket } from 'socket.io-client';
import { Toaster, toast } from 'react-hot-toast';
import { ResponsiveContainer, AreaChart, Area } from 'recharts';

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
  type: 'hype' | 'game_request' | 'question_spike' | 'toxicity_spike' | 'custom' | 'clip_moment';
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
  
  // Navigation Architecture
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [activeTab, setActiveTab] = useState<'hud' | 'live' | 'obs' | 'ai' | 'clips' | 'analytics' | 'recaps'>('hud');
  
  // Global states & Modals
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [settingsActiveTab, setSettingsActiveTab] = useState<'general' | 'obs' | 'ai' | 'appearance' | 'notifications' | 'keyboard'>('general');
  const [showSearchModal, setShowSearchModal] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [activeTheme, setActiveTheme] = useState<'cyber-green' | 'purple-neon' | 'blue-aurora' | 'red-crimson'>('cyber-green');
  const [searchQuery, setSearchQuery] = useState('');
  
  // Floating AI Orb Suggestions
  const [showOrbTooltip, setShowOrbTooltip] = useState(false);

  // Stream Session States
  const [streamerName, setStreamerName] = useState('KickStreamer');
  const [theme, setTheme] = useState('General Chat');
  const [goals, setGoals] = useState<string[]>([]);
  const [instructions, setInstructions] = useState('');
  const [mode, setMode] = useState<'demo' | 'live'>('demo');
  
  // Dashboard UI Data States
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [aiSummary, setAiSummary] = useState('Analyzing chat feed. First insights ready in 20 seconds...');
  const [questions, setQuestions] = useState<Array<{ id: string; question: string; asker: string; importance: string }>>([]);
  const [topics, setTopics] = useState<string[]>([]);
  const [recommendations, setRecommendations] = useState<CoPilotRecommendation[]>([]);
  const [sentiment, setSentiment] = useState({ positive: 50, neutral: 45, negative: 5 });
  const [hypeLevel, setHypeLevel] = useState<'low' | 'medium' | 'high'>('low');
  const [hypeScore, setHypeScore] = useState(0);
  const [messagesPerMin, setMessagesPerMin] = useState(0);
  const [uptime, setUptime] = useState('00:00:00');
  const [timeline, setTimeline] = useState<TimelineEvent[]>([]);
  const [modAlerts, setModAlerts] = useState<Array<{ id: string; message: string; severity: 'low' | 'medium' | 'high'; timestamp?: string }>>([]);
  
  // Stream Recap Data
  const [showRecap, setShowRecap] = useState(false);
  const [recapTimeline, setRecapTimeline] = useState<TimelineEvent[]>([]);
  const [recapData, setRecapData] = useState<any>(null);
  const [pinnedQuestion, setPinnedQuestion] = useState<string | null>(null);
  
  // Custom Chat Inputs
  const [customMsgText, setCustomMsgText] = useState('');
  const [customMsgSender, setCustomMsgSender] = useState('JudgeViewer');
  const [customMsgBadge, setCustomMsgBadge] = useState<'none' | 'vip' | 'sub' | 'mod'>('none');
  
  // Dev Tools Panel Toggle
  const [showDevTools, setShowDevTools] = useState(false);
  const [aiLastSync, setAiLastSync] = useState<number>(0);

  // Settings Configuration States
  const [streamUrl, setStreamUrl] = useState('rtmps://stream.kick.com/live');
  const [streamKey, setStreamKey] = useState('');
  const [backupKey, setBackupKey] = useState('');
  const [kickChannelId, setKickChannelId] = useState('');
  const [systemPrompt, setSystemPrompt] = useState('You are StreamMind AI, a live creator co-pilot for KICK streams.');
  const [questionPriority, setQuestionPriority] = useState<'high' | 'medium' | 'low'>('high');
  const [vipInput, setVipInput] = useState('');
  const [vips, setVips] = useState<string[]>(['SKYGOD07', 'KickNinja', 'ModeratorBot']);
  const [blockedWordInput, setBlockedWordInput] = useState('');
  const [blockedWords, setBlockedWords] = useState<string[]>(['scam', 'hack', 'cheat', 'robux']);
  const [toxicityThreshold, setToxicityThreshold] = useState(0.6);

  // Live status states
  const [isLive, setIsLive] = useState(false);
  const [viewerCount, setViewerCount] = useState(0);
  const [category, setCategory] = useState('');
  const [isCheckingLive, setIsCheckingLive] = useState(false);

  // Sparkline Chart Data for Hype Velocity
  const [hypeSparklineData, setHypeSparklineData] = useState<any[]>([
    { value: 10 }, { value: 15 }, { value: 12 }, { value: 20 }, { value: 18 }, { value: 30 }, { value: 25 }, { value: 40 }, { value: 35 }, { value: 50 }
  ]);

  // Timers and references
  const chatContainerRef = useRef<HTMLDivElement>(null);
  const uptimeIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const fallbackIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const socketRef = useRef<Socket | null>(null);
  const profileMenuRef = useRef<HTMLDivElement>(null);

  // Click outside to close ChatGPT profile menu
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (profileMenuRef.current && !profileMenuRef.current.contains(event.target as Node)) {
        setShowProfileMenu(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Keyboard shortcut listeners (CTRL + K)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setShowSearchModal(prev => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Fetch KICK Live Status from public API
  const checkLiveStatus = useCallback(async (channel: string) => {
    if (!channel || channel === 'DemoStreamer' || channel === 'KickGamer') {
      setIsLive(false);
      return;
    }
    setIsCheckingLive(true);
    try {
      const res = await fetch(`https://kick.com/api/v2/channels/${channel}`);
      if (!res.ok) throw new Error('Channel not found');
      const data = await res.json();
      
      if (data.livestream) {
        setIsLive(true);
        setViewerCount(data.livestream.viewer_count || 0);
        setCategory(data.livestream.categories?.[0]?.name || 'Just Chatting');
      } else {
        setIsLive(false);
      }
    } catch (e) {
      console.warn('Failed to fetch Kick live status:', e);
      setIsLive(false);
    } finally {
      setIsCheckingLive(false);
    }
  }, []);

  // Load manually stored configurations from database
  const loadProfileSettings = useCallback(async () => {
    try {
      const res = await fetch('/api/auth/session');
      const data = await res.json();
      if (data.authenticated && data.profile) {
        setStreamUrl(data.profile.streamUrl || 'rtmps://stream.kick.com/live');
        setStreamKey(data.profile.streamKey || '');
        if (data.profile.kickUsername) {
          checkLiveStatus(data.profile.kickUsername);
        }
      }
    } catch (e) {
      console.error('Failed to load profile settings:', e);
    }
  }, [checkLiveStatus]);

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

  // Scroll to bottom of chat
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

  // Poll Kick stream status every 30 seconds if live mode is active
  useEffect(() => {
    if (mode !== 'live' || !streamerName || streamerName === 'DemoStreamer' || streamerName === 'KickGamer') return;
    
    checkLiveStatus(streamerName);
    const interval = setInterval(() => {
      checkLiveStatus(streamerName);
    }, 30000);
    
    return () => clearInterval(interval);
  }, [mode, streamerName, checkLiveStatus]);

  // Main Socket Connection & Fallback Init
  useEffect(() => {
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
        streamerName: config.streamerName,
        accessToken: (config as any).accessToken
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
      
      setHypeSparklineData(prev => {
        return [...prev.slice(1), { value: data.hypeScore }];
      });
      
      setAiLastSync(Date.now());
    });

    socketInstance.on('questions-update', (qs: any[]) => {
      setQuestions(qs);
    });

    socketInstance.on('timeline-update', (events: any[]) => {
      setTimeline(events);
    });

    socketInstance.on('mod-alert', (alert: any) => {
      const formattedAlert = { 
        ...alert, 
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) 
      };
      setModAlerts(prev => [formattedAlert, ...prev.slice(0, 15)]);
      toast(alert.message, {
        icon: alert.severity === 'high' ? '🚨' : '⚠️',
        style: {
          background: '#090C12',
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
      setRecapData(data.recap);
      setRecapTimeline(data.timeline || []);
      setShowRecap(true);
      toast.success('Session completed.');
    });

    loadProfileSettings();

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
        id: `local-${messageCounter}-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
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

      // Handle spam alerts
      if (isSpam && Math.random() < 0.3) {
        setModAlerts(prev => [{
          id: `alert-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
          message: `Spam alert from @${rSender}: "${rText}"`,
          severity: 'medium',
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        }, ...prev.slice(0, 15)]);
      }
      
      // Handle toxicity alerts
      if (isToxic && Math.random() < 0.4) {
        setModAlerts(prev => [{
          id: `alert-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
          message: `Toxicity: "${rText}" by @${rSender}`,
          severity: 'high',
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        }, ...prev.slice(0, 15)]);
      }

      // Add questions list
      if (isQuestion && !isSpam && Math.random() < 0.5) {
        setQuestions(prev => {
          if (prev.some(q => q.question === rText)) return prev;
          return [...prev, {
            id: `q-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
            question: rText,
            asker: rSender,
            importance: Math.random() > 0.5 ? 'high' : 'medium'
          }];
        });
      }

      // Update mock sparkline and summary details
      if (messageCounter % 4 === 0) {
        setHypeScore(prev => {
          const nextVal = Math.min(100, Math.max(0, prev + (Math.random() > 0.45 ? 12 : -10)));
          setHypeLevel(nextVal > 70 ? 'high' : nextVal > 30 ? 'medium' : 'low');
          setHypeSparklineData(prevSpark => [...prevSpark.slice(1), { value: nextVal }]);
          return nextVal;
        });

        // Insert mock timeline events
        if (Math.random() < 0.25) {
          const eventsList = [
            { type: 'hype' as const, desc: '🔥 Hype wave in chat! Viewer engagement spiked.' },
            { type: 'game_request' as const, desc: '🎮 Viewers requesting gameplay lobby queue change.' },
            { type: 'clip_moment' as const, desc: '🎬 AI Clip Opportunity Detected: repeated "CLIP IT" in chat feed.' }
          ];
          const choice = eventsList[Math.floor(Math.random() * eventsList.length)];
          setTimeline(prev => [{
            id: `evt-${Date.now()}`,
            time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            type: choice.type,
            description: choice.desc
          }, ...prev]);
        }
      }
    }, 2800);
  }, [chatMessages.length, timeline]);

  const handleAction = (type: 'question' | 'recommendation', action: 'addressed' | 'pin' | 'ignore', id: string) => {
    if (isConnected && socket) {
      socket.emit('one-click-action', { type, action, id });
    } else {
      if (type === 'question') {
        if (action === 'addressed' || action === 'ignore') {
          setQuestions(prev => prev.filter(q => q.id !== id));
          toast.success(action === 'addressed' ? 'Question addressed!' : 'Question dismissed.');
        } else if (action === 'pin') {
          const found = questions.find(q => q.id === id);
          if (found) setPinnedQuestion(found.question);
          toast.success('Question pinned to HUD!');
        }
      } else {
        setRecommendations(prev => prev.filter((_, idx) => idx !== Number(id)));
        toast.success('Recommendation addressed!');
      }
    }
  };

  // Trigger simulated spike from dev tools
  const triggerSpike = (type: 'hype' | 'spam' | 'toxic') => {
    if (isConnected && socket) {
      socket.emit(`trigger-${type}-spike`);
    } else {
      const nowString = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      if (type === 'hype') {
        setHypeScore(85);
        setHypeLevel('high');
        setTimeline(prev => [{
          id: `evt-hype-${Date.now()}`,
          time: nowString,
          type: 'hype',
          description: '🔥 Hype wave in chat! Viewer engagement spiked.'
        }, ...prev]);
        toast.success('Simulated Hype wave injected.');
      } else if (type === 'spam') {
        setModAlerts(prev => [{
          id: `alert-spam-${Date.now()}`,
          message: 'Moderation Warning: Scam links detected in chat.',
          severity: 'medium',
          timestamp: nowString
        }, ...prev]);
        toast('Simulated Spam links injected.', { icon: '⚠️' });
      } else {
        setModAlerts(prev => [{
          id: `alert-toxic-${Date.now()}`,
          message: 'Toxicity Warning: Offensive messages increasing in feed.',
          severity: 'high',
          timestamp: nowString
        }, ...prev]);
        toast.error('Simulated Toxicity wave injected.');
      }
    }
  };

  // Send custom chat message
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
        isSpam: customMsgText.includes('bit.ly') || customMsgText.includes('.net'),
        isQuestion: customMsgText.includes('?'),
        sentiment: customMsgText.includes('🔥') ? 'positive' : customMsgText.includes('noob') ? 'negative' : 'neutral',
        toxicity: customMsgText.includes('noob') ? 0.8 : 0.0,
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

  // End stream session
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
      
      setRecapData({
        summary: `Successfully completed simulated stream co-pilot for "${theme}". Chat remained active with ${chatMessages.length} total messages processed and highlighted key viewer questions.`,
        topTopics: ['valorant', 'giveaway', 'specs'],
        sentimentScore: 82.5,
        peakHypeAt: nowString,
        uptime: uptime,
        messageCount: chatMessages.length,
        eventCount: finalEvents.length
      });
      setRecapTimeline(finalEvents);
      setShowRecap(true);
      toast.success('Session completed.');
    }
  };

  // Dynamic Theme Styling
  const getThemeClass = () => {
    return `theme-${activeTheme}`;
  };

  // UI Helpers: Calculate Community Health
  const calculateCommunityHealth = () => {
    const sentimentBonus = sentiment.positive * 0.5;
    const neutralBonus = sentiment.neutral * 0.2;
    const toxicityDeduction = modAlerts.filter(a => a.severity === 'high').length * 4;
    return Math.max(0, Math.min(100, Math.round(50 + sentimentBonus + neutralBonus - toxicityDeduction)));
  };

  const communityScore = calculateCommunityHealth();
  const latestClipOpportunity = timeline.find(e => e.type === 'clip_moment');

  // Linear search handler
  const getFilteredItems = () => {
    if (!searchQuery.trim()) return [];
    const query = searchQuery.toLowerCase();
    
    const matchedMsgs = chatMessages
      .filter(m => m.text.toLowerCase().includes(query) || m.sender.toLowerCase().includes(query))
      .map(m => ({ type: 'chat', label: `@${m.sender}: "${m.text}"`, link: 'hud' }));
      
    const matchedQuestions = questions
      .filter(q => q.question.toLowerCase().includes(query) || q.asker.toLowerCase().includes(query))
      .map(q => ({ type: 'question', label: `Question from @${q.asker}: "${q.question}"`, link: 'hud' }));

    const matchedEvents = timeline
      .filter(e => e.description.toLowerCase().includes(query))
      .map(e => ({ type: 'event', label: `[Event] ${e.description}`, link: 'hud' }));

    return [...matchedMsgs, ...matchedQuestions, ...matchedEvents].slice(0, 6);
  };

  return (
    <div className={`h-screen flex overflow-hidden bg-kick-dark text-gray-100 ${getThemeClass()} font-sans relative`}>
      <Toaster position="top-right" />
      
      {/* Radial Glass Accent Spot */}
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-kick-green-glow rounded-full blur-[140px] pointer-events-none z-0" />

      {/* ──────────────────────────────────────────────────────────── */}
      {/* LAYER 1: GLOBAL NAVIGATION RAIL (Collapsible Left Sidebar)   */}
      {/* ──────────────────────────────────────────────────────────── */}
      <aside 
        style={{ width: isSidebarCollapsed ? '72px' : '280px' }}
        className="glass-sidebar h-full flex flex-col justify-between shrink-0 transition-all duration-300 cubic-bezier(.4,0,.2,1) z-30 select-none relative"
      >
        <div className="flex flex-col">
          {/* Logo Section */}
          <div className="h-16 flex items-center justify-between px-4 border-b border-kick-border">
            <div className="flex items-center gap-3 overflow-hidden">
              <div className="w-8 h-8 rounded-xl bg-kick-green flex items-center justify-center font-black text-kick-dark shrink-0">S</div>
              {!isSidebarCollapsed && (
                <span className="text-sm font-black text-white tracking-wider whitespace-nowrap">
                  StreamMind <span className="text-kick-green">AI</span>
                </span>
              )}
            </div>
            <button 
              onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
              className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-kick-border/40 cursor-pointer"
              title={isSidebarCollapsed ? "Expand Sidebar" : "Collapse Sidebar"}
            >
              <Menu className="w-4 h-4" />
            </button>
          </div>

          {/* Navigation Links */}
          <nav className="p-3 space-y-1.5">
            {[
              { id: 'hud', label: 'Dashboard HUD', icon: Tv },
              { id: 'obs', label: 'OBS Studio', icon: Sliders },
              { id: 'ai', label: 'AI Rules', icon: Wrench },
              { id: 'recaps', label: 'Stream Recaps', icon: Award }
            ].map(item => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => {
                    if (item.id === 'obs' || item.id === 'ai') {
                      setSettingsActiveTab(item.id === 'obs' ? 'obs' : 'ai');
                      setShowSettingsModal(true);
                    } else {
                      setActiveTab(item.id as any);
                    }
                  }}
                  className={`w-full flex items-center gap-3 px-3 py-3 rounded-xl transition-all font-semibold text-xs cursor-pointer group relative ${
                    isActive 
                      ? 'bg-kick-green/10 text-kick-green border border-kick-green/20' 
                      : 'text-gray-400 hover:bg-kick-panel-hover hover:text-white border border-transparent'
                  }`}
                >
                  <Icon className="w-4 h-4 shrink-0" />
                  {!isSidebarCollapsed && <span>{item.label}</span>}
                  
                  {/* Collapsed Tooltip */}
                  {isSidebarCollapsed && (
                    <div className="absolute left-16 bg-kick-dark border border-kick-border text-[10px] text-white px-2.5 py-1 rounded-lg opacity-0 group-hover:opacity-100 pointer-events-none transition-all delay-100 whitespace-nowrap shadow-xl z-50">
                      {item.label}
                    </div>
                  )}
                </button>
              );
            })}
          </nav>
        </div>

        {/* Bottom Profile dropdown (ChatGPT style) */}
        <div className="p-3 border-t border-kick-border relative" ref={profileMenuRef}>
          <div 
            onClick={() => setShowProfileMenu(!showProfileMenu)}
            className="flex items-center justify-between p-2 rounded-2xl hover:bg-kick-panel-hover cursor-pointer transition-all border border-transparent hover:border-kick-border"
          >
            <div className="flex items-center gap-2.5 overflow-hidden">
              <div className="w-8 h-8 rounded-full bg-kick-green/20 border border-kick-green/40 flex items-center justify-center font-bold text-kick-green text-xs shrink-0 uppercase">
                {streamerName.slice(0,2)}
              </div>
              {!isSidebarCollapsed && (
                <div className="flex flex-col text-left overflow-hidden">
                  <span className="text-xs font-bold text-white leading-none whitespace-nowrap">@{streamerName}</span>
                  <span className="text-[9px] text-gray-500 font-mono mt-0.5 whitespace-nowrap capitalize">{mode} mode</span>
                </div>
              )}
            </div>
            {!isSidebarCollapsed && <ChevronUp className="w-3.5 h-3.5 text-gray-400 shrink-0" />}
          </div>

          {/* ChatGPT profile dropdown popup */}
          {showProfileMenu && (
            <div className="absolute bottom-16 left-3 right-3 bg-[#090C12]/95 backdrop-blur-2xl border border-kick-border rounded-2xl p-2.5 shadow-2xl flex flex-col gap-1.5 z-40 animate-fade-in-up text-left">
              <div className="px-2.5 py-1.5 border-b border-kick-border/60">
                <span className="text-[10px] text-gray-500 font-bold uppercase tracking-wider block">KICK Account Linked</span>
                <span className="text-xs text-white font-bold block mt-0.5">@{streamerName}</span>
              </div>
              <button 
                onClick={() => { setShowSettingsModal(true); setSettingsActiveTab('general'); setShowProfileMenu(false); }}
                className="w-full text-left px-2.5 py-2 rounded-xl text-xs font-semibold text-gray-300 hover:bg-kick-panel-hover hover:text-white cursor-pointer"
              >
                Profile Settings
              </button>
              <button 
                onClick={() => { setShowSettingsModal(true); setSettingsActiveTab('appearance'); setShowProfileMenu(false); }}
                className="w-full text-left px-2.5 py-2 rounded-xl text-xs font-semibold text-gray-300 hover:bg-kick-panel-hover hover:text-white cursor-pointer"
              >
                Keyboard Shortcuts
              </button>
              <button 
                onClick={handleEndSession}
                className="w-full text-left px-2.5 py-2 rounded-xl text-xs font-semibold text-red-400 hover:bg-red-950/20 cursor-pointer border-t border-kick-border/40 mt-1"
              >
                Log Out Session
              </button>
            </div>
          )}
        </div>
      </aside>

      {/* Main Workspace Frame */}
      <div className="flex-1 flex flex-col overflow-hidden relative z-10">
        
        {/* ──────────────────────────────────────────────────────────── */}
        {/* LAYER 2: TOP COMMAND BAR (72px)                              */}
        {/* ──────────────────────────────────────────────────────────── */}
        <header className="h-[72px] glass-topbar px-6 flex items-center justify-between shrink-0 select-none z-20">
          {/* Left Breadcrumbs */}
          <div className="flex items-center gap-3">
            <span className="text-[11px] font-bold text-gray-400 uppercase tracking-widest">Dashboard</span>
            <span className="text-xs text-gray-600">/</span>
            <span className="text-[11px] font-black text-kick-green uppercase tracking-widest">HUD Mode</span>
          </div>

          {/* Center search button (Linear Ctrl+K style) */}
          <div className="flex-1 max-w-md mx-6 hidden sm:block">
            <button 
              onClick={() => setShowSearchModal(true)}
              className="w-full flex items-center justify-between px-3 py-2 rounded-xl bg-kick-dark/60 border border-kick-border text-gray-500 hover:text-gray-300 hover:border-kick-border/80 transition-all text-xs font-medium cursor-pointer"
            >
              <div className="flex items-center gap-2">
                <Search className="w-3.5 h-3.5" />
                <span>Search everything...</span>
              </div>
              <span className="text-[10px] bg-kick-panel border border-kick-border px-1.5 py-0.5 rounded-md font-mono">
                Ctrl + K
              </span>
            </button>
          </div>

          {/* Right widgets */}
          <div className="flex items-center gap-3">
            {/* Live Indicator */}
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-kick-dark border border-kick-border select-none">
              <span className={`w-2 h-2 rounded-full ${
                (mode === 'demo' || isLive) ? 'bg-red-500 animate-pulse shadow-[0_0_8px_#EF4444]' : 'bg-gray-500'
              }`} />
              <span className="text-[10px] font-black text-white uppercase leading-none">
                {(mode === 'demo' || isLive) ? 'LIVE' : 'OFFLINE'}
              </span>
            </div>

            {/* Health Score */}
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-kick-dark border border-kick-border select-none" title="Community Health Score">
              <span className="text-[10px] text-gray-500 font-bold uppercase">Health:</span>
              <span className="text-[10px] font-black text-kick-green">{communityScore}/100</span>
            </div>

            {/* Chat Velocity */}
            <div className="hidden md:flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-kick-dark border border-kick-border select-none" title="Chat Velocity">
              <Activity className="w-3 h-3 text-kick-green" />
              <span className="text-[10px] font-black text-white font-mono">{messagesPerMin} msg/min</span>
            </div>

            {/* Notification button with counter */}
            <button 
              onClick={() => setShowNotifications(true)}
              className="p-2 rounded-xl bg-kick-dark border border-kick-border text-gray-400 hover:text-white relative cursor-pointer"
            >
              <Bell className="w-4 h-4" />
              {modAlerts.length > 0 && (
                <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-white rounded-full flex items-center justify-center text-[9px] font-bold">
                  {modAlerts.length}
                </span>
              )}
            </button>

            {/* Settings button */}
            <button 
              onClick={() => setShowSettingsModal(true)}
              className="p-2 rounded-xl bg-kick-dark border border-kick-border text-gray-400 hover:text-white cursor-pointer"
            >
              <SlidersHorizontal className="w-4 h-4" />
            </button>
          </div>
        </header>

        {/* ──────────────────────────────────────────────────────────── */}
        {/* LAYER 3: MAIN HUD WORKSPACE LAYOUT (Bento Grid)              */}
        {/* ──────────────────────────────────────────────────────────── */}
        <main className="flex-1 flex overflow-hidden p-6 gap-6 relative select-none">
          
          {/* ═══ LEFT PANEL: Live Chat ═══ */}
          <div className="w-[32%] xl:w-[28%] flex flex-col bento-card select-none">
            {/* Header */}
            <div className="px-5 py-4 border-b border-kick-border flex items-center justify-between shrink-0 bg-kick-panel/20 rounded-t-3xl">
              <span className="text-xs font-black text-white uppercase tracking-wider flex items-center gap-1.5">
                <MessageSquare className="w-3.5 h-3.5 text-kick-green" />
                Live Chat Feed
              </span>
              <span className="text-[9px] text-gray-500 font-mono font-bold bg-kick-dark px-1.5 py-0.5 rounded-lg border border-kick-border">
                {chatMessages.length} Messages
              </span>
            </div>

            {/* Chat Body */}
            <div ref={chatContainerRef} className="flex-1 overflow-y-auto p-4 space-y-3 min-h-0 select-text">
              {chatMessages.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-gray-500 py-10">
                  <MessageSquare className="w-6 h-6 text-kick-green/30 mb-2" />
                  <p className="text-xs text-gray-400 font-semibold">Waiting for chat...</p>
                </div>
              ) : (
                chatMessages.map(msg => (
                  <div 
                    key={msg.id}
                    className={`p-2.5 rounded-2xl border text-[11px] leading-relaxed transition-all duration-300 text-left ${
                      msg.isSpam 
                        ? 'bg-yellow-950/10 border-yellow-500/20' 
                        : msg.toxicity > toxicityThreshold
                          ? 'bg-red-950/10 border-red-500/20'
                          : msg.badge === 'vip'
                            ? 'bg-purple-950/10 border-purple-500/20'
                            : 'bg-kick-panel/20 border-kick-border/40 hover:border-kick-border/80'
                    }`}
                  >
                    <div className="flex items-center gap-1.5 mb-1 select-none">
                      {msg.badge === 'mod' && <span className="text-[7.5px] bg-red-500/10 text-red-400 border border-red-500/20 px-1 rounded font-black font-mono">MOD</span>}
                      {msg.badge === 'sub' && <span className="text-[7.5px] bg-kick-green/10 text-kick-green border border-kick-green/20 px-1 rounded font-black font-mono">SUB</span>}
                      {msg.badge === 'vip' && <span className="text-[7.5px] bg-purple-500/10 text-purple-400 border border-purple-500/20 px-1 rounded font-black font-mono">VIP</span>}
                      <span className="font-extrabold text-kick-green">@{msg.sender}</span>
                      <span className="text-[9px] text-gray-500 font-mono ml-auto">{msg.timestamp}</span>
                    </div>
                    <p className="text-gray-300 font-medium">{msg.text}</p>
                    
                    {msg.isSpam && (
                      <span className="text-[8px] text-yellow-500 font-bold block mt-1.5 select-none">⚠️ Flagged as Link Spam</span>
                    )}
                    {msg.toxicity > toxicityThreshold && (
                      <span className="text-[8px] text-red-500 font-bold block mt-1.5 select-none">🚨 High Toxicity Warning</span>
                    )}
                  </div>
                ))
              )}
            </div>

            {/* Custom dev input */}
            {mode === 'demo' && (
              <div className="p-3 border-t border-kick-border bg-kick-dark/30 rounded-b-3xl">
                <div className="flex gap-2">
                  <input 
                    type="text" 
                    placeholder="Inject message text..."
                    value={customMsgText}
                    onChange={(e) => setCustomMsgText(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && sendCustomMessage()}
                    className="flex-1 px-3 py-2 rounded-xl bg-kick-dark border border-kick-border text-xs text-white focus:outline-none focus:border-kick-green"
                  />
                  <button 
                    onClick={sendCustomMessage}
                    className="p-2 rounded-xl bg-kick-green text-kick-dark hover:shadow-[0_0_10px_var(--neon-glow)] transition-all cursor-pointer"
                  >
                    <Send className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* ═══ RIGHT COLUMN: Bento HUD cards ═══ */}
          <div className="flex-1 flex flex-col gap-6 overflow-hidden">
            
            {/* Row 1: AI Attention Radar + AI Producer (Bento) */}
            <div className="grid grid-cols-2 gap-6 min-h-0 flex-1">
              
              {/* AI Attention Radar (BENTO HERO) */}
              <div className="bento-card flex flex-col">
                <div className="px-5 py-4 border-b border-kick-border bg-kick-panel/20 rounded-t-3xl flex items-center justify-between shrink-0">
                  <span className="text-xs font-black text-white uppercase tracking-wider flex items-center gap-1.5">
                    <AlertTriangle className="w-3.5 h-3.5 text-yellow-500" />
                    AI Attention Radar
                  </span>
                  <span className="text-[9px] bg-red-500/10 text-red-400 border border-red-500/20 px-1.5 py-0.5 rounded font-black font-mono">
                    HIGH PRIORITY
                  </span>
                </div>

                <div className="flex-1 p-5 overflow-y-auto space-y-3 min-h-0 text-left select-text">
                  {/* Priority 1: Toxicity alerts */}
                  {modAlerts.filter(a => a.severity === 'high').length > 0 && (
                    <div className="p-3.5 rounded-2xl bg-red-950/10 border border-red-500/20 flex gap-2.5 items-start">
                      <div className="w-2 h-2 rounded-full bg-red-500 animate-ping mt-1.5 shrink-0" />
                      <div>
                        <span className="text-xs font-bold text-red-400 block">Toxicity Warning Spike</span>
                        <p className="text-[11px] text-gray-300 mt-1">Aggressive chatter waves flagged by AI filtering models. Active review suggested.</p>
                      </div>
                    </div>
                  )}

                  {/* Priority 2: Pinned questions */}
                  {questions.length > 0 ? (
                    <div className="p-3.5 rounded-2xl bg-yellow-950/10 border border-yellow-500/20 flex gap-2.5 items-start">
                      <div className="w-2 h-2 rounded-full bg-yellow-500 animate-pulse mt-1.5 shrink-0" />
                      <div>
                        <span className="text-xs font-bold text-yellow-500 block">{questions.length} Unaddressed Viewer Questions</span>
                        <p className="text-[11px] text-gray-300 mt-1">First Priority: Mark addressed or pin to hud to keep engagement high.</p>
                      </div>
                    </div>
                  ) : (
                    <div className="p-3.5 rounded-2xl bg-kick-panel/20 border border-kick-border/40 flex gap-2.5 items-start">
                      <div className="w-2 h-2 rounded-full bg-kick-green mt-1.5 shrink-0" />
                      <div>
                        <span className="text-xs font-bold text-gray-400 block">Chat Questions Clear</span>
                        <p className="text-[11px] text-gray-500 mt-0.5">All viewer questions are currently marked as addressed.</p>
                      </div>
                    </div>
                  )}

                  {/* Priority 3: Pinned indicators */}
                  {pinnedQuestion && (
                    <div className="p-3.5 rounded-2xl bg-purple-950/10 border border-purple-500/20 flex gap-2.5 items-start">
                      <Pin className="w-3.5 h-3.5 text-purple-400 fill-purple-400 shrink-0 mt-0.5" />
                      <div>
                        <span className="text-xs font-bold text-purple-400 block">Pinned Dashboard HUD Notice</span>
                        <p className="text-[11px] text-gray-200 mt-1">"{pinnedQuestion}"</p>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* AI Producer Mode */}
              <div className="bento-card flex flex-col">
                <div className="px-5 py-4 border-b border-kick-border bg-kick-panel/20 rounded-t-3xl flex items-center justify-between shrink-0">
                  <span className="text-xs font-black text-white uppercase tracking-wider flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-kick-green" />
                    AI Producer Board
                  </span>
                </div>

                <div className="flex-1 p-5 overflow-y-auto space-y-4 min-h-0 text-left">
                  {recommendations.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center text-gray-500">
                      <Sparkles className="w-6 h-6 text-kick-green/30 animate-pulse mb-1.5" />
                      <p className="text-xs">Gathering stream suggestions...</p>
                    </div>
                  ) : (
                    recommendations.slice(0, 2).map((rec, index) => (
                      <div key={index} className="p-3.5 rounded-2xl bg-kick-dark/40 border border-kick-border/80 relative">
                        <div className="absolute top-3.5 right-3.5 bg-kick-green text-kick-dark px-1.5 py-0.5 rounded-lg text-[9px] font-black font-mono">
                          {rec.confidence}% Confidence
                        </div>
                        <h4 className="text-xs font-bold text-kick-green uppercase pr-14 leading-none">{rec.tip}</h4>
                        <p className="text-[11px] text-gray-400 mt-2 leading-relaxed">{rec.reason}</p>
                        
                        <div className="mt-3 flex gap-2">
                          <button 
                            onClick={() => handleAction('recommendation', 'addressed', index.toString())}
                            className="flex-1 py-1.5 rounded-xl bg-kick-green text-kick-dark font-black text-[10px] cursor-pointer hover:shadow-[0_0_8px_var(--neon-glow)] transition-all text-center"
                          >
                            Execute
                          </button>
                          <button 
                            onClick={() => handleAction('recommendation', 'ignore', index.toString())}
                            className="px-3 py-1.5 rounded-xl bg-kick-border text-gray-400 hover:text-white text-[10px] cursor-pointer text-center"
                          >
                            Dismiss
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>

            {/* Row 2: AI Summary + Clip Detector + Hype Sparkline */}
            <div className="grid grid-cols-3 gap-6 shrink-0 h-48">
              
              {/* AI Summary */}
              <div className="bento-card p-4 flex flex-col text-left">
                <span className="text-[10px] text-gray-500 font-bold uppercase tracking-wider mb-2 block">AI Live Summary</span>
                <div className="flex-1 overflow-y-auto text-[11px] text-gray-300 leading-relaxed min-h-0 select-text">
                  {aiSummary}
                </div>
              </div>

              {/* Hype Velocity Wave sparkline */}
              <div className="bento-card p-4 flex flex-col justify-between text-left">
                <div>
                  <span className="text-[10px] text-gray-500 font-bold uppercase tracking-wider mb-1 block">Hype Velocity Wave</span>
                  <div className="flex items-baseline gap-2 mt-1">
                    <span className="text-2xl font-black text-white font-mono">{hypeScore}/100</span>
                    <span className="text-[10px] text-kick-green font-bold font-mono">
                      {hypeLevel === 'high' ? '⚡ SPIKE (+12%)' : '🟢 STABLE'}
                    </span>
                  </div>
                </div>

                {/* Animated Recharts Sparkline */}
                <div className="h-16 w-full mt-2">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={hypeSparklineData}>
                      <defs>
                        <linearGradient id="hypeSparkGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="var(--neon-color)" stopOpacity={0.25}/>
                          <stop offset="95%" stopColor="var(--neon-color)" stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                      <Area 
                        type="monotone" 
                        dataKey="value" 
                        stroke="var(--neon-color)" 
                        strokeWidth={2}
                        fillOpacity={1} 
                        fill="url(#hypeSparkGrad)" 
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* AI Clip Detector */}
              <div className="bento-card p-4 flex flex-col justify-between text-left">
                <div>
                  <span className="text-[10px] text-gray-500 font-bold uppercase tracking-wider block">AI Clip Detector</span>
                  {latestClipOpportunity ? (
                    <div className="mt-2 space-y-1">
                      <div className="flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-kick-green animate-ping shrink-0" />
                        <span className="text-[11px] font-extrabold text-white">Clip Opportunity Detected</span>
                      </div>
                      <p className="text-[10px] text-gray-400 line-clamp-2 mt-1">
                        {latestClipOpportunity.description}
                      </p>
                    </div>
                  ) : (
                    <p className="text-[11px] text-gray-500 italic mt-3">
                      Monitoring chat velocity and emote surges for clip moments...
                    </p>
                  )}
                </div>

                {latestClipOpportunity && (
                  <button 
                    onClick={() => {
                      toast.success('Clip marker generated at ' + uptime);
                    }}
                    className="w-full py-1.5 rounded-xl bg-kick-green text-kick-dark text-[10px] font-black hover:shadow-[0_0_8px_var(--neon-glow)] transition-all cursor-pointer text-center"
                  >
                    Create OBS Marker
                  </button>
                )}
              </div>
            </div>

            {/* Row 3: Horizontal Timeline Heatmap Axis */}
            <div className="bento-card px-5 py-3 shrink-0 flex items-center justify-between text-left">
              <div className="flex items-center gap-4 w-full">
                <span className="text-[10px] text-gray-500 font-bold uppercase tracking-wider shrink-0">Timeline Heatmap</span>
                
                {/* Horizontal scale */}
                <div className="flex-1 h-2.5 rounded bg-kick-dark/50 border border-kick-border relative select-none">
                  {/* Hype spikes dots */}
                  {timeline.map((evt, idx) => {
                    const colors = evt.type === 'hype' ? 'bg-kick-green shadow-[0_0_6px_#53FC18]' : evt.type === 'clip_moment' ? 'bg-purple-500' : 'bg-yellow-500';
                    const leftPos = Math.min(95, 10 + idx * 25);
                    return (
                      <div 
                        key={evt.id}
                        style={{ left: `${leftPos}%` }}
                        className={`absolute top-0.5 w-1.5 h-1.5 rounded-full ${colors} cursor-pointer group`}
                        title={evt.description}
                      >
                        {/* Heatmap Tooltip */}
                        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-kick-dark border border-kick-border text-[9px] text-white p-2 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap shadow-xl z-30 pointer-events-none">
                          <span className="font-bold font-mono mr-1 text-kick-green">[{evt.time}]</span>
                          {evt.description}
                        </div>
                      </div>
                    );
                  })}
                </div>
                
                <span className="text-[10px] text-gray-500 font-mono font-bold shrink-0">{uptime}</span>
              </div>
            </div>

          </div>
        </main>
      </div>

      {/* ──────────────────────────────────────────────────────────── */}
      {/* FLOATING AI ORB (Pulsating active helper)                     */}
      {/* ──────────────────────────────────────────────────────────── */}
      <div className="fixed bottom-6 right-6 z-40 flex items-center gap-2 select-none">
        {showOrbTooltip && (
          <div className="glass-modal rounded-2xl p-3 max-w-xs text-left animate-fade-in-up">
            <span className="text-[9px] text-kick-green font-bold uppercase block tracking-wider">AI Producer Notice</span>
            <p className="text-[11px] text-white mt-1 leading-relaxed">
              {recommendations.length > 0 
                ? recommendations[0].action 
                : "Audience sentiment is positive. Keep driving active chat discussion!"}
            </p>
          </div>
        )}
        <button 
          onMouseEnter={() => setShowOrbTooltip(true)}
          onMouseLeave={() => setShowOrbTooltip(false)}
          onClick={() => setShowOrbTooltip(!showOrbTooltip)}
          className="w-12 h-12 rounded-full bg-[#090C18]/90 border border-kick-green/40 flex items-center justify-center shadow-[0_0_20px_var(--neon-glow)] cursor-pointer hover:scale-105 active:scale-95 transition-all animate-pulse-glow"
        >
          <Sparkles className="w-5 h-5 text-kick-green" />
        </button>
      </div>

      {/* ──────────────────────────────────────────────────────────── */}
      {/* SLIDE-OVER NOTIFICATION CENTER (420px)                        */}
      {/* ──────────────────────────────────────────────────────────── */}
      {showNotifications && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex justify-end animate-fade-in">
          <div className="w-[420px] h-full glass-slideover p-6 flex flex-col justify-between text-left">
            <div className="flex flex-col flex-1 min-h-0">
              <div className="flex items-center justify-between border-b border-kick-border pb-4 shrink-0">
                <span className="text-sm font-extrabold text-white uppercase tracking-wider flex items-center gap-2">
                  <Bell className="w-4 h-4 text-kick-green" />
                  Notification Center
                </span>
                <button onClick={() => setShowNotifications(false)} className="text-gray-400 hover:text-white cursor-pointer">
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Alerts List */}
              <div className="flex-1 overflow-y-auto py-4 space-y-3 min-h-0">
                {modAlerts.length === 0 ? (
                  <p className="text-xs text-gray-500 italic py-6 text-center">No new alert updates.</p>
                ) : (
                  modAlerts.map(alert => (
                    <div key={alert.id} className={`p-3.5 rounded-2xl border text-[11px] leading-relaxed relative ${
                      alert.severity === 'high' 
                        ? 'bg-red-950/10 border-red-500/20 text-red-200' 
                        : 'bg-yellow-950/10 border-yellow-500/20 text-yellow-200'
                    }`}>
                      <span className="absolute top-3.5 right-3.5 text-[9px] text-gray-500 font-mono">
                        {alert.timestamp || 'Just now'}
                      </span>
                      <h4 className="font-bold uppercase tracking-wider pr-14 leading-none">
                        {alert.severity === 'high' ? '🚨 High Warning' : '⚠️ Moderation Warning'}
                      </h4>
                      <p className="text-gray-300 mt-2">{alert.message}</p>
                    </div>
                  ))
                )}
              </div>
            </div>

            <button 
              onClick={() => { setModAlerts([]); toast.success('Cleared all alerts'); }}
              className="w-full py-2.5 rounded-xl bg-kick-border hover:bg-kick-border/80 text-white text-xs font-bold transition-all cursor-pointer text-center shrink-0 mt-4"
            >
              Clear All Alerts
            </button>
          </div>
        </div>
      )}

      {/* ──────────────────────────────────────────────────────────── */}
      {/* CENTERED SPLIT-SIDEBAR SETTINGS MODAL (1100px x 700px)       */}
      {/* ──────────────────────────────────────────────────────────── */}
      {showSettingsModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-md z-50 flex items-center justify-center p-4 animate-fade-in">
          <div className="w-[1100px] h-[700px] glass-modal rounded-[28px] overflow-hidden flex flex-col">
            
            {/* Modal Header */}
            <div className="h-16 border-b border-kick-border px-6 flex items-center justify-between shrink-0 bg-kick-dark/20 text-left">
              <span className="text-sm font-extrabold text-white uppercase tracking-widest flex items-center gap-2">
                <Sliders className="w-4 h-4 text-kick-green" />
                SaaS Console Settings
              </span>
              <button 
                onClick={() => setShowSettingsModal(false)}
                className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-kick-border/40 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="flex-1 flex overflow-hidden">
              {/* Modal Left Sidebar */}
              <div className="w-[240px] border-r border-kick-border bg-kick-dark/45 p-4 flex flex-col gap-1 select-none text-left">
                {[
                  { id: 'general', label: 'General / Profile' },
                  { id: 'obs', label: 'OBS Studio Config' },
                  { id: 'ai', label: 'AI Prompt Rules' },
                  { id: 'appearance', label: 'Appearance Theme' }
                ].map(item => (
                  <button
                    key={item.id}
                    onClick={() => setSettingsActiveTab(item.id as any)}
                    className={`w-full text-left px-3.5 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                      settingsActiveTab === item.id 
                        ? 'bg-kick-green/10 text-kick-green border border-kick-green/20' 
                        : 'text-gray-400 hover:bg-kick-panel-hover hover:text-white border border-transparent'
                    }`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>

              {/* Modal Right Content Panel */}
              <div className="flex-1 p-8 overflow-y-auto text-left select-text">
                
                {/* 1. GENERAL / PROFILE SETTINGS */}
                {settingsActiveTab === 'general' && (
                  <div className="space-y-6">
                    <div>
                      <h3 className="text-lg font-bold text-white leading-none">General Profile Setup</h3>
                      <p className="text-xs text-gray-400 mt-1">Configure profile details and linked stream details.</p>
                    </div>
                    
                    <div className="space-y-4">
                      <div className="space-y-1.5">
                        <label className="text-xs font-semibold text-gray-400">Streamer Display Name</label>
                        <input 
                          type="text" 
                          value={streamerName}
                          onChange={(e) => setStreamerName(e.target.value)}
                          className="w-full max-w-md px-3.5 py-2 rounded-xl bg-kick-dark border border-kick-border text-white text-xs focus:outline-none focus:border-kick-green"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-xs font-semibold text-gray-400">KICK API Channel Reference</label>
                        <div className="flex gap-2">
                          <input 
                            type="text" 
                            value={streamerName}
                            disabled
                            className="w-full max-w-sm px-3.5 py-2 rounded-xl bg-kick-panel border border-kick-border text-gray-500 text-xs focus:outline-none font-mono"
                          />
                          <button 
                            onClick={() => checkLiveStatus(streamerName)}
                            className="px-4 py-2 rounded-xl bg-kick-border hover:bg-kick-border/80 text-xs font-bold transition-all cursor-pointer"
                          >
                            Sync Status
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* 2. DEEP OBS SETTINGS */}
                {settingsActiveTab === 'obs' && (
                  <div className="space-y-6">
                    <div>
                      <h3 className="text-lg font-bold text-white leading-none">OBS Encoder & RTMP Configurations</h3>
                      <p className="text-xs text-gray-400 mt-1">Setup primary custom server integrations and stream outputs.</p>
                    </div>

                    {/* Stream Health stats mock */}
                    <div className="grid grid-cols-3 gap-4">
                      <div className="p-3.5 bg-kick-dark border border-kick-border rounded-2xl">
                        <span className="text-[10px] text-gray-500 font-bold block uppercase">Quality</span>
                        <span className="text-sm font-black text-kick-green block mt-1">Excellent</span>
                      </div>
                      <div className="p-3.5 bg-kick-dark border border-kick-border rounded-2xl">
                        <span className="text-[10px] text-gray-500 font-bold block uppercase">Packet Loss</span>
                        <span className="text-sm font-black text-white block mt-1 font-mono">0.1%</span>
                      </div>
                      <div className="p-3.5 bg-kick-dark border border-kick-border rounded-2xl">
                        <span className="text-[10px] text-gray-500 font-bold block uppercase">Dropped Frames</span>
                        <span className="text-sm font-black text-white block mt-1 font-mono">2</span>
                      </div>
                    </div>

                    <div className="space-y-4 pt-2">
                      <div className="space-y-1.5">
                        <div className="flex justify-between max-w-lg">
                          <label className="text-xs font-semibold text-gray-400">Primary RTMP Server URL</label>
                          <button 
                            onClick={() => { navigator.clipboard.writeText(streamUrl); toast.success('Server URL copied!'); }}
                            className="text-[10px] text-kick-green hover:underline cursor-pointer"
                          >
                            Copy
                          </button>
                        </div>
                        <input 
                          type="text" 
                          value={streamUrl}
                          onChange={(e) => setStreamUrl(e.target.value)}
                          className="w-full max-w-lg px-3.5 py-2.5 rounded-xl bg-kick-dark border border-kick-border text-white text-xs focus:outline-none focus:border-kick-green"
                          placeholder="rtmps://stream.kick.com/live"
                        />
                      </div>

                      <div className="space-y-1.5">
                        <div className="flex justify-between max-w-lg">
                          <label className="text-xs font-semibold text-gray-400">Primary Stream Key</label>
                          <button 
                            onClick={() => { navigator.clipboard.writeText(streamKey); toast.success('Stream Key copied!'); }}
                            className="text-[10px] text-kick-green hover:underline cursor-pointer"
                          >
                            Copy
                          </button>
                        </div>
                        <input 
                          type="password" 
                          value={streamKey}
                          onChange={(e) => setStreamKey(e.target.value)}
                          className="w-full max-w-lg px-3.5 py-2.5 rounded-xl bg-kick-dark border border-kick-border text-white text-xs focus:outline-none focus:border-kick-green font-mono"
                          placeholder="live_xxxxxxxxxxxx"
                        />
                      </div>

                      {/* Encoder specs widget */}
                      <div className="p-4 bg-kick-panel/20 border border-kick-border rounded-2xl max-w-lg">
                        <h4 className="text-xs font-bold text-white uppercase tracking-wider mb-2">Recommended Encoder specs (1080p60)</h4>
                        <div className="text-[11px] text-gray-400 space-y-1 font-mono">
                          <div>• Bitrate: <span className="text-white">6000 kbps</span></div>
                          <div>• Rate Control: <span className="text-white">CBR</span></div>
                          <div>• Hardware Encoder: <span className="text-white">NVIDIA NVENC H.264 / AV1</span></div>
                          <div>• Keyframe Interval: <span className="text-white">2s</span></div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* 3. AI PROMPT RULES & TUNING */}
                {settingsActiveTab === 'ai' && (
                  <div className="space-y-6">
                    <div>
                      <h3 className="text-lg font-bold text-white leading-none">AI Prompt Rules Tuning</h3>
                      <p className="text-xs text-gray-400 mt-1">Instruct the co-pilot, prioritize viewers, and set toxicity filters.</p>
                    </div>

                    <div className="space-y-4">
                      {/* Prompt editor */}
                      <div className="space-y-1.5">
                        <label className="text-xs font-semibold text-gray-400">System Guidelines Instruction Prompt</label>
                        <textarea 
                          rows={3}
                          value={systemPrompt}
                          onChange={(e) => setSystemPrompt(e.target.value)}
                          className="w-full max-w-xl px-3.5 py-2 rounded-xl bg-kick-dark border border-kick-border text-white text-xs focus:outline-none focus:border-kick-green resize-none"
                        />
                      </div>

                      {/* Toxicity Threshold */}
                      <div className="space-y-2 max-w-xl bg-kick-dark/30 p-4 border border-kick-border rounded-2xl">
                        <div className="flex justify-between items-baseline select-none">
                          <label className="text-xs font-semibold text-gray-400">AI Toxicity Alert Sensitivity</label>
                          <span className="text-xs text-kick-green font-bold font-mono">{Math.round(toxicityThreshold * 100)}%</span>
                        </div>
                        <input 
                          type="range" 
                          min="0.1" 
                          max="0.9" 
                          step="0.05"
                          value={toxicityThreshold}
                          onChange={(e) => setToxicityThreshold(parseFloat(e.target.value))}
                          className="w-full accent-kick-green cursor-pointer mt-1"
                        />
                        <span className="text-[10px] text-gray-500 block leading-normal mt-1.5">
                          Toxicity score triggers when content exceeds threshold. Lower scores trigger more alerts.
                        </span>
                      </div>

                      {/* VIP listing */}
                      <div className="space-y-2 max-w-xl">
                        <label className="text-xs font-semibold text-gray-400">Prioritized VIP Viewer Accounts</label>
                        <div className="flex gap-2">
                          <input 
                            type="text" 
                            placeholder="Add VIP username..."
                            value={vipInput}
                            onChange={(e) => setVipInput(e.target.value)}
                            className="flex-1 px-3 py-1.5 rounded-xl bg-kick-dark border border-kick-border text-xs text-white focus:outline-none focus:border-kick-green"
                          />
                          <button 
                            onClick={() => {
                              if (vipInput.trim() && !vips.includes(vipInput)) {
                                setVips([...vips, vipInput.trim()]);
                                setVipInput('');
                                toast.success('VIP Added!');
                              }
                            }}
                            className="px-3.5 rounded-xl bg-kick-green text-kick-dark cursor-pointer flex items-center justify-center"
                          >
                            <Plus className="w-4 h-4" />
                          </button>
                        </div>
                        <div className="flex flex-wrap gap-2 pt-1.5 select-none">
                          {vips.map(vip => (
                            <span key={vip} className="flex items-center gap-1 bg-purple-950/15 border border-purple-500/20 text-purple-400 text-[10px] font-bold px-2 py-0.5 rounded-lg">
                              @{vip}
                              <button onClick={() => setVips(vips.filter(v => v !== vip))} className="text-purple-400 hover:text-red-400 cursor-pointer">
                                <X className="w-3 h-3" />
                              </button>
                            </span>
                          ))}
                        </div>
                      </div>

                      {/* Blocked Words */}
                      <div className="space-y-2 max-w-xl">
                        <label className="text-xs font-semibold text-gray-400">Blocked Words & Link Filters</label>
                        <div className="flex gap-2">
                          <input 
                            type="text" 
                            placeholder="Add blocked word..."
                            value={blockedWordInput}
                            onChange={(e) => setBlockedWordInput(e.target.value)}
                            className="flex-1 px-3 py-1.5 rounded-xl bg-kick-dark border border-kick-border text-xs text-white focus:outline-none focus:border-kick-green"
                          />
                          <button 
                            onClick={() => {
                              if (blockedWordInput.trim() && !blockedWords.includes(blockedWordInput)) {
                                setBlockedWords([...blockedWords, blockedWordInput.trim()]);
                                setBlockedWordInput('');
                                toast.success('Word blocked!');
                              }
                            }}
                            className="px-3.5 rounded-xl bg-kick-green text-kick-dark cursor-pointer flex items-center justify-center"
                          >
                            <Plus className="w-4 h-4" />
                          </button>
                        </div>
                        <div className="flex flex-wrap gap-2 pt-1.5 select-none">
                          {blockedWords.map(word => (
                            <span key={word} className="flex items-center gap-1 bg-red-950/15 border border-red-500/20 text-red-400 text-[10px] font-bold px-2 py-0.5 rounded-lg">
                              {word}
                              <button onClick={() => setBlockedWords(blockedWords.filter(w => w !== word))} className="text-red-400 hover:text-white cursor-pointer">
                                <X className="w-3 h-3" />
                              </button>
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* 4. APPEARANCE SETTINGS */}
                {settingsActiveTab === 'appearance' && (
                  <div className="space-y-6">
                    <div>
                      <h3 className="text-lg font-bold text-white leading-none">Appearance Neon Theme</h3>
                      <p className="text-xs text-gray-400 mt-1">Select your signature cockpit color.</p>
                    </div>

                    <div className="grid grid-cols-2 gap-4 max-w-lg select-none">
                      {[
                        { id: 'cyber-green', label: 'Cyber Green', color: 'bg-[#53FC18]', glow: 'shadow-[0_0_8px_#53FC18]' },
                        { id: 'purple-neon', label: 'Purple Neon', color: 'bg-purple-500', glow: 'shadow-[0_0_8px_#A855F7]' },
                        { id: 'blue-aurora', label: 'Blue Aurora', color: 'bg-cyan-500', glow: 'shadow-[0_0_8px_#06B6D4]' },
                        { id: 'red-crimson', label: 'Red Crimson', color: 'bg-red-500', glow: 'shadow-[0_0_8px_#EF4444]' }
                      ].map(themeItem => (
                        <div
                          key={themeItem.id}
                          onClick={() => {
                            setActiveTheme(themeItem.id as any);
                            toast.success(`Theme switched to ${themeItem.label}!`);
                          }}
                          className={`p-4 rounded-2xl border transition-all cursor-pointer flex items-center justify-between ${
                            activeTheme === themeItem.id
                              ? 'bg-kick-panel border-kick-green'
                              : 'bg-kick-dark border-kick-border hover:bg-kick-panel-hover'
                          }`}
                        >
                          <span className="text-xs font-bold text-white">{themeItem.label}</span>
                          <div className={`w-3.5 h-3.5 rounded-full ${themeItem.color} ${themeItem.glow}`} />
                        </div>
                      ))}
                    </div>
                  </div>
                )}

              </div>
            </div>

            {/* Modal Footer */}
            <div className="h-16 border-t border-kick-border px-6 flex items-center justify-end gap-3 shrink-0 bg-kick-dark/20">
              <button 
                onClick={() => setShowSettingsModal(false)}
                className="px-5 py-2 rounded-xl bg-kick-border text-xs font-bold hover:bg-kick-border/80 cursor-pointer"
              >
                Close
              </button>
              <button 
                onClick={async () => {
                  try {
                    const res = await fetch('/api/streamer/settings', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ streamUrl, streamKey })
                    });
                    if (!res.ok) throw new Error('Save failed');
                    toast.success('Settings saved to database!');
                    setShowSettingsModal(false);
                  } catch (e: any) {
                    toast.error('Failed to save settings.');
                  }
                }}
                className="px-5 py-2 rounded-xl bg-kick-green text-kick-dark text-xs font-black hover:shadow-[0_0_10px_var(--neon-glow)] cursor-pointer"
              >
                Save Configurations
              </button>
            </div>

          </div>
        </div>
      )}

      {/* ──────────────────────────────────────────────────────────── */}
      {/* LAYER 6: LINEAR COMMAND SEARCH MODAL (Ctrl + K)               */}
      {/* ──────────────────────────────────────────────────────────── */}
      {showSearchModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-md z-50 flex items-start justify-center p-4 pt-[15vh] animate-fade-in">
          <div className="w-full max-w-lg glass-modal rounded-2xl overflow-hidden flex flex-col max-h-[50vh]">
            {/* Search Input */}
            <div className="flex items-center gap-3 px-4 py-3.5 border-b border-kick-border bg-kick-dark/30">
              <Search className="w-4 h-4 text-kick-green shrink-0" />
              <input
                type="text"
                placeholder="Search messages, questions, alerts..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="flex-1 bg-transparent border-none text-white text-xs placeholder-gray-500 focus:outline-none"
                autoFocus
              />
              <button onClick={() => setShowSearchModal(false)} className="text-gray-400 hover:text-white cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Results */}
            <div className="flex-1 overflow-y-auto p-2 text-left">
              {searchQuery.trim() === '' ? (
                <div className="py-8 text-center text-gray-500 text-xs">
                  Type query keys to search this session data
                </div>
              ) : getFilteredItems().length === 0 ? (
                <div className="py-8 text-center text-gray-500 text-xs">
                  No matching details found.
                </div>
              ) : (
                <div className="space-y-1">
                  {getFilteredItems().map((item, idx) => (
                    <div 
                      key={idx}
                      onClick={() => {
                        setShowSearchModal(false);
                        toast.success('Navigated matching entry!');
                      }}
                      className="p-2.5 rounded-xl hover:bg-kick-panel-hover cursor-pointer transition-all flex items-center justify-between text-xs"
                    >
                      <span className="text-white line-clamp-1 pr-6 font-semibold">{item.label}</span>
                      <span className="text-[9px] bg-kick-green/10 text-kick-green border border-kick-green/20 px-2 py-0.5 rounded-md font-mono capitalize">
                        {item.type}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ──────────────────────────────────────────────────────────── */}
      {/* LAYER 7: STREAM RECAP OVERLAY                                 */}
      {/* ──────────────────────────────────────────────────────────── */}
      {showRecap && (
        <div className="absolute inset-0 bg-[#030712]/95 backdrop-blur-xl z-50 flex items-center justify-center p-4">
          <div className="w-full max-w-2xl bg-kick-panel border border-kick-green/30 rounded-3xl p-6 md:p-8 flex flex-col max-h-[85vh] shadow-[0_0_40px_var(--neon-glow)] animate-fade-in-up">
            
            {/* Header */}
            <div className="text-center pb-4 border-b border-kick-border">
              <div className="text-3xl mb-2">🏆</div>
              <h2 className="text-xl font-black text-white font-sans">Tonight's Stream Story</h2>
              <p className="text-xs text-gray-400 mt-1">Session story recap for @{streamerName}</p>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-4 gap-3 my-4 select-none">
              <div className="p-3 bg-kick-dark border border-kick-border rounded-2xl text-center">
                <span className="text-[10px] text-gray-500 font-bold uppercase block">Uptime</span>
                <span className="text-sm font-black text-white block font-mono">{recapData?.uptime || uptime}</span>
              </div>
              <div className="p-3 bg-kick-dark border border-kick-border rounded-2xl text-center">
                <span className="text-[10px] text-gray-500 font-bold uppercase block">Messages</span>
                <span className="text-sm font-black text-kick-green block">{recapData?.messageCount || chatMessages.length}</span>
              </div>
              <div className="p-3 bg-kick-dark border border-kick-border rounded-2xl text-center">
                <span className="text-[10px] text-gray-500 font-bold uppercase block">Sentiment</span>
                <span className="text-sm font-black text-white block">{recapData?.sentimentScore || 78.5}%</span>
              </div>
              <div className="p-3 bg-kick-dark border border-kick-border rounded-2xl text-center">
                <span className="text-[10px] text-gray-500 font-bold uppercase block">Peak Hype</span>
                <span className="text-sm font-black text-white block font-mono">{recapData?.peakHypeAt || 'N/A'}</span>
              </div>
            </div>

            {/* Recap Story summary (Narrative layout) */}
            {recapData?.summary && (
              <div className="p-5 bg-kick-green/5 border border-kick-green/20 rounded-2xl mb-4 text-left">
                <h4 className="text-xs font-bold text-kick-green uppercase mb-2">Tonight's Stream Story</h4>
                <p className="text-xs text-gray-200 leading-relaxed font-sans">
                  {recapData.summary}
                </p>
                {recapData.topTopics && (
                  <div className="mt-4 flex items-center gap-2 flex-wrap">
                    <span className="text-[10px] text-gray-500 font-bold uppercase">Discussed Topics:</span>
                    {recapData.topTopics.map((topic: string, idx: number) => (
                      <span key={idx} className="px-2.5 py-0.5 rounded-lg bg-kick-dark border border-kick-border text-[10px] text-white">
                        #{topic}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Timeline Events list */}
            <div className="flex-1 overflow-y-auto min-h-0 text-left">
              <h4 className="text-xs text-gray-400 font-bold uppercase mb-3 flex items-center gap-1">
                <Clock className="w-3 h-3 text-kick-green" />
                Stream Milestones Axis
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
            <div className="pt-4 border-t border-kick-border flex gap-3 mt-4 shrink-0">
              <button 
                onClick={() => { setShowRecap(false); router.push('/'); }}
                className="flex-1 py-2.5 rounded-xl bg-kick-border hover:bg-kick-border/80 text-white font-bold text-sm transition-all cursor-pointer text-center"
              >
                Back to Setup
              </button>
              <button 
                onClick={() => { setShowRecap(false); window.location.reload(); }}
                className="flex-1 py-2.5 rounded-xl bg-kick-green text-kick-dark font-bold text-sm hover:shadow-[0_0_12px_rgba(83,252,24,0.3)] transition-all cursor-pointer text-center"
              >
                Restart Co-pilot
              </button>
            </div>

          </div>
        </div>
      )}

      {/* Dev Tools trigger */}
      <div className="fixed bottom-6 left-6 z-40 select-none">
        <button
          onClick={() => setShowDevTools(!showDevTools)}
          className="p-2.5 rounded-full bg-kick-panel border border-kick-border text-gray-400 hover:text-white cursor-pointer shadow-lg"
          title="Toggle Spike Injectors"
        >
          <Wrench className="w-4 h-4" />
        </button>
      </div>

      {/* DEV TOOLS FLOATING MODAL */}
      {showDevTools && (
        <div className="fixed bottom-20 left-6 w-80 glass-modal rounded-2xl border-kick-green/30 p-4 z-40 text-left animate-fade-in-up">
          <div className="flex items-center justify-between border-b border-kick-border pb-2 mb-3">
            <span className="text-xs font-black text-kick-green uppercase">Developer Tools</span>
            <button onClick={() => setShowDevTools(false)} className="text-gray-400 hover:text-white cursor-pointer">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
          <div className="space-y-3">
            <div>
              <span className="text-[10px] text-gray-500 font-bold uppercase block mb-1.5">Trigger Spikes</span>
              <div className="flex gap-2">
                <button onClick={() => triggerSpike('hype')} className="flex-1 py-1.5 rounded bg-kick-dark border border-kick-green/20 hover:bg-kick-green/10 text-[10px] font-bold text-kick-green cursor-pointer">🔥 Hype</button>
                <button onClick={() => triggerSpike('spam')} className="flex-1 py-1.5 rounded bg-kick-dark border border-yellow-500/20 hover:bg-yellow-500/10 text-[10px] font-bold text-yellow-500 cursor-pointer">⚠️ Spam</button>
                <button onClick={() => triggerSpike('toxic')} className="flex-1 py-1.5 rounded bg-kick-dark border border-red-500/20 hover:bg-red-500/10 text-[10px] font-bold text-red-500 cursor-pointer">🚨 Toxic</button>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
