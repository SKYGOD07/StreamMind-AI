'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { 
  Gamepad2, 
  Sparkles, 
  MessageSquare, 
  ShieldAlert, 
  TrendingUp, 
  Smile, 
  ChevronRight, 
  ChevronLeft, 
  Play, 
  HelpCircle,
  Tv,
  Loader2,
  User as UserIcon,
  LogOut
} from 'lucide-react';
import { Toaster, toast } from 'react-hot-toast';

const GOAL_OPTIONS = [
  { id: 'Detect important questions', label: 'Detect important questions', icon: HelpCircle, desc: 'Extract viewer questions instantly' },
  { id: 'Detect hype moments', label: 'Detect hype moments', icon: Sparkles, desc: 'Flag excitement & emote waves' },
  { id: 'Moderate spam', label: 'Moderate spam', icon: ShieldAlert, desc: 'Catch duplicate texts & links' },
  { id: 'Track audience mood', label: 'Track audience mood', icon: Smile, desc: 'Real-time sentiment analyzer' },
  { id: 'Never miss important messages', icon: MessageSquare, label: 'Never miss important messages', desc: 'Prioritize VIP/subscriber chats' },
  { id: 'Increase engagement', label: 'Increase engagement', icon: TrendingUp, desc: 'AI-generated interactive prompts' }
];

const PRESETS = [
  { theme: 'Valorant ranked with viewers', goals: ['Detect important questions', 'Detect hype moments', 'Increase engagement'], instructions: 'Notify me when viewers ask to play together. Highlight any questions about gameplay specs.' },
  { theme: 'Tech podcast about AI Agents', goals: ['Detect important questions', 'Track audience mood', 'Never miss important messages'], instructions: 'Highlight sponsorship questions. Ignore minor coding debates. Prioritize VIP viewers.' },
  { theme: 'Japan travel IRL stream', goals: ['Detect hype moments', 'Track audience mood', 'Increase engagement'], instructions: 'Alert me when sentiment drops. Highlight restaurant recommendations or directions suggested by chat.' }
];

export default function OnboardingPage() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [streamerName, setStreamerName] = useState('KickGamer');
  const [mode, setMode] = useState<'demo' | 'live'>('demo');
  
  // Wizard States
  const [theme, setTheme] = useState('');
  const [selectedGoals, setSelectedGoals] = useState<string[]>(['Detect important questions', 'Detect hype moments']);
  const [instructions, setInstructions] = useState('');
  const [isLoadingSession, setIsLoadingSession] = useState(true);
  const [userSession, setUserSession] = useState<any>(null);

  // Check session status on mount
  useEffect(() => {
    async function checkSession() {
      try {
        const res = await fetch('/api/auth/session');
        const data = await res.json();
        if (data.authenticated) {
          setUserSession(data);
          setStreamerName(data.profile?.kickUsername || data.user.name || 'KickGamer');
          // If they logged in via KICK, default to live mode
          if (data.user.provider === 'kick') {
            setMode('live');
          }
        }
      } catch (err) {
        console.error('Error fetching session:', err);
      } finally {
        setIsLoadingSession(false);
      }
    }
    checkSession();
  }, []);

  // Handle Preset Click
  const selectPreset = (preset: typeof PRESETS[0]) => {
    setTheme(preset.theme);
    setSelectedGoals(preset.goals);
    setInstructions(preset.instructions);
    toast.success('Loaded preset details!');
  };

  // Toggle Goal Select
  const toggleGoal = (goalId: string) => {
    if (selectedGoals.includes(goalId)) {
      setSelectedGoals(selectedGoals.filter(g => g !== goalId));
    } else {
      setSelectedGoals([...selectedGoals, goalId]);
    }
  };

  // Submit / Launch
  const handleLaunch = () => {
    if (!theme.trim()) {
      toast.error('Please describe what today\'s stream is about!');
      setStep(1);
      return;
    }
    
    // Save to local storage to carry over configuration to the dashboard (fallback/socket initialization)
    const sessionConfig = {
      streamerName,
      theme,
      goals: selectedGoals,
      instructions,
      mode,
      profileId: userSession?.profile?.id || null,
      accessToken: userSession?.profile?.accessToken || null
    };
    
    localStorage.setItem('streammind_session_config', JSON.stringify(sessionConfig));
    toast.success('Launching StreamMind AI Co-pilot...');
    
    setTimeout(() => {
      router.push('/dashboard');
    }, 1200);
  };

  // Log Out handler
  const handleLogout = async () => {
    try {
      await fetch('/api/auth/session', { method: 'DELETE' });
      toast.success('Logged out successfully.');
      router.push('/');
    } catch (e) {
      console.error(e);
      toast.error('Failed to log out.');
    }
  };

  if (isLoadingSession) {
    return (
      <div className="min-h-screen bg-kick-dark text-gray-100 flex flex-col items-center justify-center p-4 cyber-grid">
        <Loader2 className="w-10 h-10 text-kick-green animate-spin" />
        <p className="text-sm text-gray-400 mt-4 font-semibold">Loading setup wizard...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-kick-dark text-gray-100 cyber-grid flex flex-col items-center justify-center p-4 relative overflow-hidden">
      <Toaster position="top-right" reverseOrder={false} />
      
      {/* Decorative neon spots */}
      <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-[#53FC18]/5 rounded-full blur-[120px]" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-[#53FC18]/5 rounded-full blur-[120px]" />

      {/* Header Profile Bar */}
      <div className="absolute top-6 right-6 z-20 flex items-center gap-3 bg-kick-panel/60 border border-kick-border backdrop-blur-md px-4 py-2 rounded-2xl">
        {userSession?.user ? (
          <>
            {userSession.user.image ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img 
                src={userSession.user.image} 
                alt={userSession.user.name} 
                className="w-7 h-7 rounded-full border border-kick-green/40"
              />
            ) : (
              <UserIcon className="w-4 h-4 text-kick-green" />
            )}
            <div className="flex flex-col text-left">
              <span className="text-xs font-bold text-white leading-none">{userSession.user.name}</span>
              <span className="text-[9px] text-gray-400 font-mono capitalize">{userSession.user.provider} Mode</span>
            </div>
            <button 
              onClick={handleLogout}
              className="p-1.5 rounded-lg text-gray-400 hover:text-red-400 hover:bg-kick-border/40 transition-all cursor-pointer ml-2"
              title="Logout"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </>
        ) : (
          <div className="flex items-center gap-2 text-xs text-gray-400">
            <span className="w-2 h-2 rounded-full bg-yellow-500 animate-pulse"></span>
            Guest Streamer (Demo Mode)
          </div>
        )}
      </div>

      {/* Main Container */}
      <div className="w-full max-w-3xl z-10 my-8">
        {/* Progress Tracker */}
        <div className="flex items-center justify-between mb-8 max-w-md mx-auto px-4">
          <div className="flex items-center gap-2">
            <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-all border ${step >= 1 ? 'bg-kick-green text-kick-dark border-kick-green shadow-[0_0_10px_rgba(83,252,24,0.3)]' : 'bg-kick-dark border-kick-border text-gray-500'}`}>1</div>
            <span className={`text-xs font-semibold ${step >= 1 ? 'text-white' : 'text-gray-500'}`}>Theme</span>
          </div>
          <div className="flex-1 h-[1px] bg-kick-border mx-3" />
          <div className="flex items-center gap-2">
            <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-all border ${step >= 2 ? 'bg-kick-green text-kick-dark border-kick-green shadow-[0_0_10px_rgba(83,252,24,0.3)]' : 'bg-kick-dark border-kick-border text-gray-500'}`}>2</div>
            <span className={`text-xs font-semibold ${step >= 2 ? 'text-white' : 'text-gray-500'}`}>Goals</span>
          </div>
          <div className="flex-1 h-[1px] bg-kick-border mx-3" />
          <div className="flex items-center gap-2">
            <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-all border ${step >= 3 ? 'bg-kick-green text-kick-dark border-kick-green shadow-[0_0_10px_rgba(83,252,24,0.3)]' : 'bg-kick-dark border-kick-border text-gray-500'}`}>3</div>
            <span className={`text-xs font-semibold ${step >= 3 ? 'text-white' : 'text-gray-500'}`}>AI Rules</span>
          </div>
        </div>

        {/* Wizard Panel */}
        <div className="glass-panel border border-kick-border rounded-3xl p-6 md:p-8 shadow-2xl relative overflow-hidden backdrop-blur-md">
          {/* STEP 1: Stream Theme */}
          {step === 1 && (
            <div className="space-y-6 animate-fade-in-up">
              <div>
                <h2 className="text-xl font-bold text-white">Step 1: What are we streaming today?</h2>
                <p className="text-sm text-gray-400 mt-1">Describe your stream theme so the AI Co-pilot has context on the discussion topics.</p>
              </div>

              <div className="space-y-2">
                <label className="block text-xs font-semibold uppercase text-gray-400">Stream Theme / Topic</label>
                <input 
                  type="text"
                  placeholder="e.g., Valorant ranked with viewers"
                  value={theme}
                  onChange={(e) => setTheme(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl bg-kick-dark border border-kick-border text-white placeholder-gray-500 focus:outline-none focus:border-kick-green transition-all"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase text-gray-400 mb-3">Or choose a pre-configured template:</label>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  {PRESETS.map((p, idx) => (
                    <div 
                      key={idx}
                      onClick={() => selectPreset(p)}
                      className="p-4 rounded-xl border border-kick-border bg-kick-panel hover:bg-kick-panel-hover hover:border-kick-green/40 transition-all cursor-pointer flex flex-col justify-between"
                    >
                      <span className="text-xs text-kick-green font-bold uppercase">Preset {idx + 1}</span>
                      <h4 className="text-sm font-semibold text-white mt-1">{p.theme}</h4>
                      <p className="text-[11px] text-gray-400 mt-2 line-clamp-2">{p.instructions}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* STEP 2: Goal Selection */}
          {step === 2 && (
            <div className="space-y-6 animate-fade-in-up">
              <div>
                <h2 className="text-xl font-bold text-white">Step 2: What are today's goals?</h2>
                <p className="text-sm text-gray-400 mt-1">Select the moderation and analysis tasks you want the AI Co-pilot to focus on.</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {GOAL_OPTIONS.map((goal) => {
                  const Icon = goal.icon;
                  const isSelected = selectedGoals.includes(goal.id);
                  return (
                    <div 
                      key={goal.id}
                      onClick={() => toggleGoal(goal.id)}
                      className={`p-4 rounded-2xl border transition-all cursor-pointer flex items-start gap-3 select-none ${
                        isSelected 
                          ? 'bg-kick-green/5 border-kick-green/60 text-white' 
                          : 'bg-kick-panel border-kick-border text-gray-300 hover:bg-kick-panel-hover'
                      }`}
                    >
                      <div className={`p-2 rounded-xl mt-0.5 ${isSelected ? 'bg-kick-green text-kick-dark' : 'bg-kick-dark text-gray-400'}`}>
                        <Icon className="w-4 h-4" />
                      </div>
                      <div>
                        <h4 className="font-semibold text-sm">{goal.label}</h4>
                        <p className="text-xs text-gray-400 mt-0.5">{goal.desc}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* STEP 3: AI Context & Mode */}
          {step === 3 && (
            <div className="space-y-6 animate-fade-in-up">
              <div>
                <h2 className="text-xl font-bold text-white">Step 3: Anything AI should know?</h2>
                <p className="text-sm text-gray-400 mt-1">Provide specific rules, vip accounts, sponsorship details, or filters for the co-pilot.</p>
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase text-gray-400 mb-2">Custom AI Instructions</label>
                <textarea 
                  rows={3}
                  placeholder="e.g., Highlight sponsorship questions. Ignore political discussions. Prioritize VIP viewers."
                  value={instructions}
                  onChange={(e) => setInstructions(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl bg-kick-dark border border-kick-border text-white placeholder-gray-500 focus:outline-none focus:border-kick-green transition-all resize-none"
                />
              </div>

              <div className="p-4 rounded-xl border border-kick-border bg-kick-panel space-y-4">
                <label className="block text-xs font-semibold uppercase text-gray-400">Connection Mode</label>
                
                <div className="grid grid-cols-2 gap-3">
                  <button 
                    type="button"
                    onClick={() => setMode('demo')}
                    className={`py-3 px-4 rounded-xl border font-bold text-sm transition-all cursor-pointer ${
                      mode === 'demo'
                        ? 'bg-kick-green text-kick-dark border-kick-green'
                        : 'bg-kick-dark border-kick-border text-gray-400 hover:text-white'
                    }`}
                  >
                    Simulated Demo Mode
                  </button>
                  <button 
                    type="button"
                    disabled={userSession?.user?.provider !== 'kick'}
                    onClick={() => {
                      if (userSession?.user?.provider === 'kick') {
                        setMode('live');
                      }
                    }}
                    className={`py-3 px-4 rounded-xl border font-bold text-sm transition-all cursor-pointer ${
                      userSession?.user?.provider !== 'kick'
                        ? 'opacity-40 cursor-not-allowed bg-kick-dark border-kick-border text-gray-600'
                        : mode === 'live'
                          ? 'bg-kick-green text-kick-dark border-kick-green'
                          : 'bg-kick-dark border-kick-border text-gray-400 hover:text-white'
                    }`}
                    title={userSession?.user?.provider !== 'kick' ? "Live Mode is only available after logging in via KICK" : ""}
                  >
                    Live KICK Mode
                  </button>
                </div>

                {mode === 'live' ? (
                  <div className="space-y-1.5 pt-1 animate-fade-in-up">
                    <p className="text-xs text-kick-green font-semibold">
                      ✓ Connected directly to KICK Channel: @{streamerName}
                    </p>
                    <p className="text-[10px] text-gray-400 leading-relaxed">
                      StreamMind AI will connect directly to your channel's public chat feed. Go live on OBS Studio to start streaming.
                    </p>
                  </div>
                ) : (
                  <p className="text-[11px] text-gray-400 pt-1 leading-relaxed">
                    🟢 Demo Mode uses local Websockets to feed high-fidelity chat messages matching your preset topic. No live stream required.
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Navigation Controls */}
          <div className="flex items-center justify-between mt-8 pt-6 border-t border-kick-border">
            {step > 1 ? (
              <button 
                onClick={() => setStep(step - 1)}
                className="px-5 py-2.5 rounded-xl bg-kick-border hover:bg-kick-border/80 text-white text-sm font-semibold transition-all flex items-center gap-1.5 cursor-pointer"
              >
                <ChevronLeft className="w-4 h-4" />
                Back
              </button>
            ) : (
              <button 
                onClick={() => router.push('/')}
                className="px-5 py-2.5 rounded-xl bg-kick-border hover:bg-kick-border/80 text-white text-sm font-semibold transition-all flex items-center gap-1.5 cursor-pointer"
              >
                Cancel
              </button>
            )}

            {step < 3 ? (
              <button 
                onClick={() => {
                  if (step === 1 && !theme.trim()) {
                    toast.error('Please describe your stream!');
                    return;
                  }
                  setStep(step + 1);
                }}
                className="px-6 py-2.5 rounded-xl bg-kick-green text-kick-dark text-sm font-bold hover:shadow-[0_0_15px_rgba(83,252,24,0.3)] transition-all flex items-center gap-1.5 cursor-pointer"
              >
                Next
                <ChevronRight className="w-4 h-4 text-kick-dark" />
              </button>
            ) : (
              <button 
                onClick={handleLaunch}
                className="px-6 py-2.5 rounded-xl bg-kick-green text-kick-dark text-sm font-bold hover:shadow-[0_0_20px_rgba(83,252,24,0.5)] transition-all flex items-center gap-2 cursor-pointer animate-pulse"
              >
                <Tv className="w-4 h-4" />
                Launch Stream Co-pilot
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
