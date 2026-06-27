'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { 
  Tv, 
  Sparkles, 
  ArrowRight, 
  Zap, 
  Loader2 
} from 'lucide-react';
import { Toaster, toast } from 'react-hot-toast';
import { ResponsiveContainer, AreaChart, Area } from 'recharts';

// Cryptographic PKCE Helpers for KICK OAuth
function dec2hex(dec: number) {
  return ('0' + dec.toString(16)).substr(-2);
}

function generateCodeVerifier() {
  const array = new Uint32Array(56);
  window.crypto.getRandomValues(array);
  return Array.from(array, dec2hex).join('');
}

async function sha256(plain: string) {
  const encoder = new TextEncoder();
  const data = encoder.encode(plain);
  return window.crypto.subtle.digest('SHA-256', data);
}

function base64urlencode(a: ArrayBuffer) {
  let str = "";
  const bytes = new Uint8Array(a);
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    str += String.fromCharCode(bytes[i]);
  }
  return btoa(str)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

async function generateCodeChallenge(v: string) {
  const hashed = await sha256(v);
  return base64urlencode(hashed);
}

export default function LandingPage() {
  const router = useRouter();
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const [loadingText, setLoadingText] = useState('');
  
  // Right side mock chat states
  const [mockChats, setMockChats] = useState<any[]>([
    { id: 1, sender: 'GamerG1', text: 'OMG nice double kill! 🔥🚀', toxicity: 0.0, badge: 'sub' },
    { id: 2, sender: 'LurkBoss', text: 'what monitor is that?', toxicity: 0.0, badge: 'none' },
    { id: 3, sender: 'ModSquad', text: 'Keep it clean in chat guys!', toxicity: 0.0, badge: 'mod' }
  ]);
  
  const [chartData, setChartData] = useState<any[]>([
    { value: 30 }, { value: 45 }, { value: 35 }, { value: 60 }, { value: 50 }, { value: 85 }, { value: 70 }
  ]);

  // Handle callback authorization code if redirected from Kick
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const code = params.get('code');
    if (code) {
      handleKickCallback(code);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Simulated live dashboard card animations (sentiment wave and mock chat)
  useEffect(() => {
    const chatInterval = setInterval(() => {
      const names = ['VipSniper', 'ScamBot01', 'NeonRider', 'HypeGamer', 'ToxicPlayer7'];
      const texts = [
        'is this stream sponsored?',
        'Claim free skins at free-vbuck-legit.net !!!',
        'Valorant gameplay looks so smooth today! 🔥',
        'POG WHAT A PLAY!',
        'ur garbage at this game trash'
      ];
      
      const rIdx = Math.floor(Math.random() * names.length);
      const name = names[rIdx];
      const text = texts[rIdx];
      
      const isSpam = text.includes('.net');
      const isToxic = text.includes('garbage') || text.includes('trash');
      
      const newChat = {
        id: Date.now(),
        sender: name,
        text,
        badge: name === 'VipSniper' ? 'vip' : name === 'NeonRider' ? 'sub' : 'none',
        isSpam,
        isToxic
      };

      setMockChats(prev => [...prev.slice(-4), newChat]);
      
      // Animate charts values
      setChartData(prev => {
        const nextVal = Math.floor(Math.random() * 50) + 40;
        return [...prev.slice(1), { value: nextVal }];
      });
    }, 2800);

    return () => clearInterval(chatInterval);
  }, []);

  const handleKickCallback = async (code: string) => {
    setIsAuthenticating(true);
    setLoadingText('Exchanging KICK Authorization Token...');
    const toastId = toast.loading('Connecting your KICK channel...');
    try {
      const verifier = localStorage.getItem('kick_pkce_verifier');
      if (!verifier) {
        throw new Error('Missing code verifier. Please start KICK login again.');
      }

      const response = await fetch('/api/kick-token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ code, code_verifier: verifier })
      });

      const tokenData = await response.json();
      if (!response.ok) {
        throw new Error(tokenData.error || 'Failed to exchange token.');
      }

      // Exchange Kick user info to get username & userId
      const userRes = await fetch('https://api.kick.com/public/v1/users', {
        headers: {
          'Authorization': `Bearer ${tokenData.access_token}`,
          'Accept': 'application/json'
        }
      });
      
      const kickUser = await userRes.json();
      const username = kickUser.name || 'KickStreamer';
      const userId = String(kickUser.user_id || '12345');

      // Now login user on our backend API
      const authRes = await fetch('/api/auth/session', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          action: 'login_kick',
          name: username,
          kickUsername: username,
          kickUserId: userId,
          image: kickUser.profile_picture || null
        })
      });

      const authData = await authRes.json();
      if (!authRes.ok) {
        throw new Error(authData.error || 'Failed to initialize session.');
      }

      localStorage.removeItem('kick_pkce_verifier');
      toast.success(`Welcome back, @${username}!`, { id: toastId });
      
      // Clean query parameters from URL
      window.history.replaceState({}, document.title, window.location.pathname);

      setTimeout(() => {
        router.push('/onboarding');
      }, 1000);
    } catch (e: any) {
      console.error(e);
      toast.error(e.message || 'KICK Authentication failed.', { id: toastId });
      setIsAuthenticating(false);
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  };

  // Launch KICK OAuth
  const handleKickLogin = async () => {
    setIsAuthenticating(true);
    setLoadingText('Redirecting to KICK Developer Portal...');
    try {
      const verifier = generateCodeVerifier();
      const challenge = await generateCodeChallenge(verifier);
      
      localStorage.setItem('kick_pkce_verifier', verifier);
      
      const clientId = process.env.NEXT_PUBLIC_KICK_CLIENT_ID || '01KW42MWDGAQ7NMX52PCP86TAG';
      const redirectUri = process.env.NEXT_PUBLIC_KICK_REDIRECT_URI || 'http://localhost:3000/';
      const scope = 'user:read channel:read';
      const state = 'streammind_oauth_state_' + Math.random().toString(36).substring(2, 10);
      
      const authUrl = `https://id.kick.com/oauth/authorize?response_type=code&client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=${encodeURIComponent(scope)}&code_challenge=${challenge}&code_challenge_method=S256&state=${state}`;
      
      window.location.href = authUrl;
    } catch (err) {
      console.error(err);
      toast.error('Failed to start KICK OAuth flow.');
      setIsAuthenticating(false);
    }
  };

  // Launch Demo Mode instantly (no login)
  const handleDemoLaunch = async () => {
    setIsAuthenticating(true);
    setLoadingText('Starting Instant Demo Session...');
    try {
      const res = await fetch('/api/auth/session', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          action: 'login_demo',
          name: 'Demo Streamer'
        })
      });

      if (!res.ok) throw new Error('Failed to create demo session');

      toast.success('Launching demo setup!');
      setTimeout(() => {
        router.push('/onboarding');
      }, 1000);
    } catch (err) {
      console.error(err);
      toast.error('Failed to start demo.');
      setIsAuthenticating(false);
    }
  };

  if (isAuthenticating) {
    return (
      <div className="min-h-screen bg-kick-dark text-gray-100 cyber-grid flex flex-col items-center justify-center p-4">
        <div className="glass-panel rounded-3xl p-8 flex flex-col items-center gap-4 max-w-sm text-center border-kick-green/30 shadow-[0_0_30px_rgba(83,252,24,0.15)]">
          <Loader2 className="w-10 h-10 text-kick-green animate-spin" />
          <h2 className="text-xl font-bold text-white">StreamMind AI</h2>
          <p className="text-xs text-gray-400 leading-relaxed font-mono">
            {loadingText}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-kick-dark text-gray-100 flex flex-col md:flex-row relative overflow-hidden font-sans">
      <Toaster position="top-right" reverseOrder={false} />
      
      {/* Background Decorative Neons */}
      <div className="absolute top-[-20%] left-[-10%] w-[60%] h-[60%] bg-[#53FC18]/5 rounded-full blur-[140px] pointer-events-none" />
      <div className="absolute bottom-[-20%] right-[-10%] w-[60%] h-[60%] bg-[#53FC18]/5 rounded-full blur-[140px] pointer-events-none" />

      {/* Left Panel: Content & Call-to-actions */}
      <div className="w-full md:w-1/2 flex flex-col justify-center px-8 md:px-16 py-12 z-10">
        <div className="max-w-md space-y-8 text-left">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-kick-green rounded-2xl flex items-center justify-center shadow-[0_0_15px_rgba(83,252,24,0.4)]">
              <Tv className="w-6 h-6 text-kick-dark" />
            </div>
            <span className="text-xl font-black tracking-wider text-white">
              StreamMind <span className="text-kick-green">AI</span>
            </span>
          </div>

          <div className="space-y-4">
            <h1 className="text-4xl md:text-5xl font-black text-white leading-tight tracking-tight">
              The Real-Time <span className="text-kick-green text-glow">Co-Pilot</span> for KICK Streamers
            </h1>
            <p className="text-sm text-gray-400 leading-relaxed">
              Drown out chat noise. StreamMind AI analyzes chat sentiment, filters duplicates, tracks unanswered questions, and generates actionable moderator alerts in real-time.
            </p>
          </div>

          <div className="space-y-4 pt-4">
            <button 
              onClick={handleKickLogin}
              className="w-full py-4 px-6 rounded-2xl bg-kick-green text-kick-dark font-black text-sm hover:shadow-[0_0_25px_rgba(83,252,24,0.45)] hover:scale-[1.01] active:scale-[0.99] transition-all cursor-pointer flex items-center justify-center gap-2"
            >
              Continue with KICK
              <ArrowRight className="w-4 h-4 text-kick-dark" />
            </button>

            <div className="flex items-center justify-between text-xs text-gray-500 py-2">
              <div className="w-[40%] h-[1px] bg-kick-border" />
              <span>OR</span>
              <div className="w-[40%] h-[1px] bg-kick-border" />
            </div>

            <button 
              onClick={handleDemoLaunch}
              className="w-full py-3.5 px-6 rounded-2xl bg-kick-panel border border-kick-border text-gray-300 hover:text-white hover:border-kick-green/40 font-bold text-sm transition-all cursor-pointer flex items-center justify-center gap-2"
            >
              <Zap className="w-4 h-4 text-kick-green" />
              Try Demo Instantly (No Login)
            </button>
          </div>

          <p className="text-[10px] text-gray-500 text-center font-mono">
            Requires KICK account for live mode. Demo mode initializes instantly.
          </p>
        </div>
      </div>

      {/* Right Panel: High-fidelity Live Visualization Mockup */}
      <div className="w-full md:w-1/2 flex items-center justify-center px-6 md:px-12 py-12 bg-kick-dark/40 border-l border-kick-border/40 relative">
        <div className="w-full max-w-lg glass-panel rounded-3xl border border-kick-border p-6 shadow-2xl space-y-6 relative overflow-hidden backdrop-blur-md">
          {/* Neon scanline accent */}
          <div className="absolute top-0 left-0 w-full h-[2px] bg-gradient-to-r from-transparent via-kick-green to-transparent opacity-80" />
          
          <div className="flex items-center justify-between border-b border-kick-border pb-4">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-kick-green animate-pulse"></span>
              <span className="text-xs font-bold text-gray-300 uppercase tracking-widest">Co-pilot HUD Active</span>
            </div>
            <div className="px-2 py-0.5 rounded bg-kick-green/10 border border-kick-green/20 text-[9px] font-mono text-kick-green">
              98.4% Confidence
            </div>
          </div>

          {/* Recharts wave chart */}
          <div className="h-28 w-full relative">
            <div className="absolute top-2 left-2 z-10 text-[10px] text-gray-500 font-mono">Hype Velocity wave</div>
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData}>
                <defs>
                  <linearGradient id="hypeGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#53FC18" stopOpacity={0.2}/>
                    <stop offset="95%" stopColor="#53FC18" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <Area 
                  type="monotone" 
                  dataKey="value" 
                  stroke="#53FC18" 
                  strokeWidth={2}
                  fillOpacity={1} 
                  fill="url(#hypeGrad)" 
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          {/* Scrolling Mock Chat Feed */}
          <div className="space-y-2.5">
            <span className="text-[10px] text-gray-400 font-semibold uppercase block tracking-wider">Live Chat Filters</span>
            <div className="space-y-2 max-h-[180px] overflow-hidden flex flex-col justify-end">
              {mockChats.map((chat) => (
                <div 
                  key={chat.id}
                  className={`p-2 rounded-xl border text-[11px] text-left transition-all duration-300 ${
                    chat.isSpam 
                      ? 'bg-yellow-950/15 border-yellow-500/20 opacity-60' 
                      : chat.isToxic 
                        ? 'bg-red-950/15 border-red-500/20'
                        : 'bg-kick-panel/30 border-kick-border/40 hover:bg-kick-panel/60'
                  }`}
                >
                  <div className="flex items-center gap-1.5 mb-0.5 font-sans">
                    {chat.badge === 'mod' && <span className="text-[8px] text-red-400 font-black">MOD</span>}
                    {chat.badge === 'sub' && <span className="text-[8px] text-kick-green font-black">SUB</span>}
                    {chat.badge === 'vip' && <span className="text-[8px] text-purple-400 font-black">VIP</span>}
                    <span className="font-bold text-kick-green">{chat.sender}</span>
                  </div>
                  <p className="text-gray-300 leading-tight">{chat.text}</p>
                  
                  {chat.isSpam && (
                    <span className="text-[8px] text-yellow-500 font-bold block mt-1">⚠️ Flagged as Spam Link</span>
                  )}
                  {chat.isToxic && (
                    <span className="text-[8px] text-red-500 font-bold block mt-1">🚨 High Toxicity Warning</span>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
