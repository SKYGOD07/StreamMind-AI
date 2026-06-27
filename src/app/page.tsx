'use client';

import React, { useState } from 'react';
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
  Tv
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
      mode
    };
    
    localStorage.setItem('streammind_session_config', JSON.stringify(sessionConfig));
    toast.success('Launching StreamMind AI Co-pilot...');
    
    setTimeout(() => {
      router.push('/dashboard');
    }, 1200);
  };

  // Quick Demo Fast Path for Judges
  const handleQuickDemo = () => {
    const defaultPreset = PRESETS[0]; // Valorant Preset
    const sessionConfig = {
      streamerName: 'DemoStreamer',
      theme: defaultPreset.theme,
      goals: defaultPreset.goals,
      instructions: defaultPreset.instructions,
      mode: 'demo' as const
    };
    localStorage.setItem('streammind_session_config', JSON.stringify(sessionConfig));
    toast.success('Launching Instant Demo mode!');
    setTimeout(() => {
      router.push('/dashboard');
    }, 800);
  };

  return (
    <div className="min-h-screen bg-kick-dark text-gray-100 cyber-grid flex flex-col items-center justify-center p-4 relative overflow-hidden">
      <Toaster position="top-right" reverseOrder={false} />
      
      {/* Decorative neon spots */}
      <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-[#53FC18]/5 rounded-full blur-[120px]" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-[#53FC18]/5 rounded-full blur-[120px]" />

      {/* Main Container */}
      <div className="w-full max-w-3xl z-10 my-8">
        
        {/* Header */}
        <div className="text-center mb-8 flex flex-col items-center">
          <div className="flex items-center gap-2 px-4 py-1.5 rounded-full glass-panel border-[#53FC18]/20 text-kick-green text-sm mb-4 animate-pulse">
            <Gamepad2 className="w-4 h-4" />
            <span>KICK STREAMER COPILOT v1.0</span>
          </div>
          <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight bg-gradient-to-r from-white via-gray-200 to-[#53FC18] bg-clip-text text-transparent glow-text">
            StreamMind AI
          </h1>
          <p className="mt-2 text-gray-400 max-w-lg text-sm md:text-base">
            Analyze chat in real-time. Block spam. Extract critical viewer questions. Streamline moderation and supercharge audience engagement.
          </p>
        </div>

        {/* Quick Demo Panel for Judges */}
        <div className="glass-panel border-kick-green/30 p-6 rounded-2xl mb-8 flex flex-col md:flex-row items-center justify-between gap-4 relative overflow-hidden">
          <div className="absolute top-0 right-0 bg-kick-green text-kick-dark text-[10px] font-bold px-2.5 py-0.5 rounded-bl-lg">
            JUDGES QUICK START
          </div>
          <div>
            <h3 className="text-lg font-bold text-kick-green flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-kick-green" />
              Skip Setup & Try Instant Demo
            </h3>
            <p className="text-sm text-gray-400 mt-1">
              Launches simulated dashboard immediately with populated chat feeds, spam triggers, sentiment charts, and timeline recaps.
            </p>
          </div>
          <button 
            onClick={handleQuickDemo}
            className="w-full md:w-auto px-6 py-3 rounded-xl bg-kick-green text-kick-dark font-bold hover:shadow-[0_0_20px_rgba(83,252,24,0.4)] transition-all duration-300 flex items-center justify-center gap-2 cursor-pointer whitespace-nowrap"
          >
            <Play className="w-4 h-4 fill-kick-dark" />
            Use Demo Stream
          </button>
        </div>

        {/* Main Wizard Form */}
        <div className="glass-panel rounded-3xl p-6 md:p-8 relative">
          
          {/* Top Wizard Steps Indicator */}
          <div className="flex items-center justify-between mb-8 pb-6 border-b border-kick-border">
            <div className="flex items-center gap-4">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm transition-all duration-300 ${
                step >= 1 ? 'bg-kick-green text-kick-dark glow-border' : 'bg-kick-border text-gray-500'
              }`}>1</div>
              <span className={`text-sm hidden sm:inline ${step >= 1 ? 'text-white font-semibold' : 'text-gray-500'}`}>Theme</span>
            </div>
            <div className="flex-1 h-[2px] bg-kick-border mx-4" />
            <div className="flex items-center gap-4">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm transition-all duration-300 ${
                step >= 2 ? 'bg-kick-green text-kick-dark glow-border' : 'bg-kick-border text-gray-500'
              }`}>2</div>
              <span className={`text-sm hidden sm:inline ${step >= 2 ? 'text-white font-semibold' : 'text-gray-500'}`}>Goals</span>
            </div>
            <div className="flex-1 h-[2px] bg-kick-border mx-4" />
            <div className="flex items-center gap-4">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm transition-all duration-300 ${
                step >= 3 ? 'bg-kick-green text-kick-dark glow-border' : 'bg-kick-border text-gray-500'
              }`}>3</div>
              <span className={`text-sm hidden sm:inline ${step >= 3 ? 'text-white font-semibold' : 'text-gray-500'}`}>AI Rules</span>
            </div>
          </div>

          {/* STEP 1: Theme & Presets */}
          {step === 1 && (
            <div className="space-y-6 animate-fade-in-up">
              <div>
                <h2 className="text-xl font-bold text-white">Step 1: What is today's stream about?</h2>
                <p className="text-sm text-gray-400 mt-1">AI uses this context to classify chat queries, identify game details, and filter topics.</p>
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase text-gray-400 mb-2">Stream Title / Theme</label>
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
                    onClick={() => setMode('live')}
                    className={`py-3 px-4 rounded-xl border font-bold text-sm transition-all cursor-pointer ${
                      mode === 'live'
                        ? 'bg-kick-green text-kick-dark border-kick-green'
                        : 'bg-kick-dark border-kick-border text-gray-400 hover:text-white'
                    }`}
                  >
                    Live KICK Mode
                  </button>
                </div>

                {mode === 'live' ? (
                  <div className="space-y-2 pt-2 animate-fade-in-up">
                    <label className="block text-[11px] text-gray-400">Enter KICK Channel Username</label>
                    <input 
                      type="text"
                      placeholder="e.g. Ninja"
                      value={streamerName}
                      onChange={(e) => setStreamerName(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg bg-kick-dark border border-kick-border text-white text-sm focus:outline-none focus:border-kick-green"
                    />
                    <p className="text-[10px] text-yellow-500">
                      * Live integration will attempt connection to the Kick Channel chat feed. If credentials are empty, it runs simulated OAuth callback.
                    </p>
                  </div>
                ) : (
                  <p className="text-[11px] text-gray-400 pt-1">
                    🟢 Demo Mode uses local Websockets to feed high-fidelity chat messages matching your preset topic. No OAuth credentials required.
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
              <div />
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
