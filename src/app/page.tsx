'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { 
  ArrowRight, 
  Zap, 
  Loader2,
  Menu,
  X,
  Shield,
  Brain,
  Film,
  Eye,
  TrendingUp,
  BarChart3,
  ChevronDown,
  ChevronUp,
  Sparkles,
  Check,
  Volume2,
  VolumeX,
  Play,
  RotateCcw
} from 'lucide-react';
import { Toaster, toast } from 'react-hot-toast';

// ─── PKCE Helpers ───
function dec2hex(dec: number) { return ('0' + dec.toString(16)).substr(-2); }
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
  for (let i = 0; i < bytes.byteLength; i++) str += String.fromCharCode(bytes[i]);
  return btoa(str).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
async function generateCodeChallenge(v: string) {
  const hashed = await sha256(v);
  return base64urlencode(hashed);
}

export default function LandingPage() {
  const router = useRouter();
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const [loadingText, setLoadingText] = useState('');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [activeFaq, setActiveFaq] = useState<number | null>(null);
  const [scrollY, setScrollY] = useState(0);

  // Stateful interactive components for "industry-defining" UI
  const [shieldActive, setShieldActive] = useState(true);
  const [selectedSegment, setSelectedSegment] = useState<'qna' | 'game' | 'collab'>('game');
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [radarPingCount, setRadarPingCount] = useState(3);
  const [chartPoints, setChartPoints] = useState<number[]>([30, 45, 38, 62, 55, 78, 68, 92, 85, 99]);

  const containerRef = React.useRef<HTMLDivElement>(null);

  // Mouse movement tracker to set CSS custom properties for interactive background spotlight
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      containerRef.current.style.setProperty('--mouse-x', `${x}px`);
      containerRef.current.style.setProperty('--mouse-y', `${y}px`);
    };
    window.addEventListener('mousemove', handleMouseMove);
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, []);

  // Scroll tracking for floating navbar capsule transition
  useEffect(() => {
    const handleScroll = () => setScrollY(window.scrollY);
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Update dynamic metrics sparklines in real-time
  useEffect(() => {
    const interval = setInterval(() => {
      setChartPoints(prev => {
        const nextVal = Math.floor(Math.random() * 30) + 60;
        return [...prev.slice(1), nextVal];
      });
      if (Math.random() > 0.8) {
        setRadarPingCount(c => (c < 8 ? c + 1 : 2));
      }
    }, 2500);
    return () => clearInterval(interval);
  }, []);

  // Handle KICK OAuth callback
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const code = params.get('code');
    if (code) handleKickCallback(code);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleKickCallback = async (code: string) => {
    setIsAuthenticating(true);
    setLoadingText('Connecting channel...');
    try {
      const verifier = localStorage.getItem('kick_pkce_verifier');
      if (!verifier) throw new Error('Authentication parameters lost.');

      const response = await fetch('/api/kick-token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code, code_verifier: verifier })
      });
      const tokenData = await response.json();
      if (!response.ok) throw new Error(tokenData.error || 'Connection failed.');

      const userRes = await fetch('https://api.kick.com/public/v1/users', {
        headers: { 'Authorization': `Bearer ${tokenData.access_token}`, 'Accept': 'application/json' }
      });
      const kickUserRaw = await userRes.json();
      const kickUser = kickUserRaw?.data?.[0] || kickUserRaw?.user || kickUserRaw || {};
      const username = kickUser.username || kickUser.name || kickUser.slug || 'KickStreamer';
      const userId = String(kickUser.user_id || kickUser.id || '0');

      const authRes = await fetch('/api/auth/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'login_kick', name: username, kickUsername: username,
          kickUserId: userId, image: kickUser.profile_pic || kickUser.profile_picture || null
        })
      });
      const authData = await authRes.json();
      if (!authRes.ok) throw new Error(authData.error || 'Session failed.');

      localStorage.removeItem('kick_pkce_verifier');
      toast.success(`Connected: @${username}`);
      window.history.replaceState({}, document.title, window.location.pathname);
      setTimeout(() => { router.push('/onboarding'); }, 1000);
    } catch (e: any) {
      console.error(e);
      toast.error(e.message || 'Verification failed.');
      setIsAuthenticating(false);
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  };

  const handleKickLogin = async () => {
    setIsAuthenticating(true);
    setLoadingText('Loading secure KICK link...');
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
      toast.error('Authentication flow rejected.');
      setIsAuthenticating(false);
    }
  };

  const handleDemoLaunch = async () => {
    setIsAuthenticating(true);
    setLoadingText('Loading sandbox environment...');
    try {
      const res = await fetch('/api/auth/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'login_demo', name: 'Demo Streamer' })
      });
      if (!res.ok) throw new Error('Sandbox failed');
      toast.success('Entering sandbox mode');
      setTimeout(() => { router.push('/onboarding'); }, 800);
    } catch (err) {
      console.error(err);
      toast.error('Sandbox failed to initialize.');
      setIsAuthenticating(false);
    }
  };

  const faqs = [
    { q: 'How does StreamMind link to KICK?', a: 'StreamMind utilizes standard secure KICK OAuth 2.1 authentication to read public channel events without requiring password access.' },
    { q: 'Is a credit card required for sandbox testing?', a: 'No. Demo Sandbox mode operates instantly without accounts, credit cards, or external connections.' },
    { q: 'How do custom AI triggers behave?', a: 'You can write natural language commands during onboarding to teach the AI what to highlight, flag, or ignore.' }
  ];

  const isFloating = scrollY > 60;

  return (
    <div ref={containerRef} className="min-h-screen bg-[#030305] text-[#F4F4F6] font-sans overflow-x-hidden relative selection:bg-[#4EBD3D]/20 selection:text-[#4EBD3D] lando-grid-bg">
      <Toaster position="top-right" />

      {/* Interactive mouse-following cursor spotlight overlay */}
      <div 
        className="pointer-events-none absolute inset-0 z-0 opacity-100"
        style={{
          background: 'radial-gradient(800px circle at var(--mouse-x, 50%) var(--mouse-y, 50%), rgba(78, 189, 61, 0.05), transparent 80%)'
        }}
      />

      {/* Subtle Dynamic Status Pill (iPhone dynamic style) */}
      {isAuthenticating && (
        <div className="fixed top-6 left-1/2 -translate-x-1/2 z-50 bg-[#0F0F12]/90 backdrop-blur-md border border-[#4EBD3D]/30 px-5 py-2.5 rounded-full flex items-center gap-3 shadow-2xl transition-all duration-300">
          <Loader2 className="w-3.5 h-3.5 text-[#4EBD3D] animate-spin" />
          <span className="text-[10px] font-mono tracking-widest text-[#8E8E93] uppercase">{loadingText}</span>
        </div>
      )}

      {/* ──────────────────────────────────────────────────────────── */}
      {/* FLOATING CAPSULE NAVIGATION (Shrinks and wraps on scroll)     */}
      {/* ──────────────────────────────────────────────────────────── */}
      <nav className={`fixed z-50 transition-all duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] ${
        isFloating 
          ? 'top-4 left-1/2 -translate-x-1/2 w-[92%] max-w-[1100px] bg-[#0c0c0e]/85 backdrop-blur-2xl border border-white/[0.08] rounded-full px-8 py-3.5 shadow-[0_24px_64px_-12px_rgba(0,0,0,0.95)] scale-[0.98]' 
          : 'top-0 left-0 w-full bg-transparent border-b border-transparent px-10 py-6 scale-[1]'
      }`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <span className="w-4 h-4 bg-[#4EBD3D] rounded-sm shrink-0 shadow-[0_0_12px_rgba(78,189,61,0.4)] animate-pulse" />
            <span className="text-sm font-bold tracking-tight text-white flex items-center font-display uppercase tracking-widest">
              StreamMind
            </span>
          </div>

          <div className="hidden md:flex items-center gap-8 text-[11px] font-mono text-neutral-400 uppercase tracking-widest">
            <a href="#features" className="hover:text-white transition-colors">01 / Features</a>
            <a href="#integration" className="hover:text-white transition-colors">02 / Workflow</a>
            <a href="#support" className="hover:text-white transition-colors">03 / Support</a>
          </div>

          <div className="hidden md:flex items-center gap-3">
            <button 
              onClick={handleDemoLaunch}
              className="px-4 py-1.5 text-xs text-neutral-400 hover:text-white transition-colors cursor-pointer font-mono"
            >
              Demo Sandbox
            </button>
            <button 
              onClick={handleKickLogin}
              className="px-5 py-2 bg-[#121214] border border-white/[0.08] hover:border-[#4EBD3D]/30 text-xs font-semibold text-white rounded-full transition-all cursor-pointer shadow-lg hover:shadow-black"
            >
              Connect KICK
            </button>
          </div>

          <button 
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            className="md:hidden p-2 text-neutral-400 hover:text-white cursor-pointer"
          >
            {isMobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>

        {/* Mobile menu dropdown */}
        {isMobileMenuOpen && (
          <div className="md:hidden mt-4 pt-4 border-t border-white/[0.06] space-y-3 text-sm font-medium">
            <a href="#features" onClick={() => setIsMobileMenuOpen(false)} className="block text-neutral-400 hover:text-white py-1">01 / Features</a>
            <a href="#integration" onClick={() => setIsMobileMenuOpen(false)} className="block text-neutral-400 hover:text-white py-1">02 / Workflow</a>
            <a href="#support" onClick={() => setIsMobileMenuOpen(false)} className="block text-neutral-400 hover:text-white py-1">03 / Support</a>
            <hr className="border-white/[0.06]" />
            <button onClick={handleDemoLaunch} className="w-full py-2.5 text-center text-xs text-neutral-400 border border-white/[0.06] rounded-full cursor-pointer">DEMO SANDBOX</button>
            <button onClick={handleKickLogin} className="w-full py-2.5 text-center text-xs bg-[#121214] border border-white/[0.08] rounded-full font-semibold cursor-pointer">CONNECT KICK</button>
          </div>
        )}
      </nav>

      {/* ──────────────────────────────────────────────────────────── */}
      {/* HERO SECTION (Sleek display copy + 3D HUD perspective block) */}
      {/* ──────────────────────────────────────────────────────────── */}
      <section className="relative pt-32 pb-24 md:pt-48 md:pb-36 overflow-hidden">
        {/* Glow meshes */}
        <div className="absolute top-[20%] right-[10%] w-[600px] h-[600px] glow-mesh-radial rounded-full blur-[140px] pointer-events-none select-none" />
        <div className="absolute bottom-[10%] left-[5%] w-[400px] h-[400px] glow-mesh-radial rounded-full blur-[120px] pointer-events-none select-none opacity-40" />

        <div className="max-w-[1200px] mx-auto px-6 grid lg:grid-cols-[1.1fr_0.9fr] gap-16 items-center w-full">
          {/* Left: Dynamic Headings & Action Bars */}
          <div className="space-y-10 text-left">
            <div className="inline-flex items-center gap-2.5 px-3.5 py-1.5 rounded-full bg-[#4EBD3D]/5 border border-[#4EBD3D]/10 text-[#4EBD3D] text-[10px] font-mono uppercase tracking-widest">
              <span className="w-1.5 h-1.5 rounded-full bg-[#4EBD3D] glow-accent-dot animate-pulse" />
              INTELLIGENT LIVESTREAM COMPANION
            </div>

            <h1 className="text-5xl sm:text-7xl font-extrabold tracking-tight text-white leading-[0.95] font-display uppercase">
              CO-PILOT
              <br />
              <span className="text-[#4EBD3D] drop-shadow-[0_0_35px_rgba(78,189,61,0.25)]">YOUR LIVE</span>
              <br />
              BROADCAST.
            </h1>

            <p className="text-base text-neutral-400 max-w-md leading-relaxed">
              StreamMind operates directly within KICK streams. Process viewer metrics, execute visual automations, and manage chat shield protection modules.
            </p>

            <div className="flex flex-col sm:flex-row items-center gap-4">
              <button 
                onClick={handleKickLogin}
                className="w-full sm:w-auto px-8 py-4 bg-[#4EBD3D] text-black font-semibold text-xs rounded-full hover:brightness-105 transition-all cursor-pointer flex items-center justify-center gap-2.5 shadow-lg shadow-[#4EBD3D]/15"
              >
                CONNECT ACCOUNT
                <ArrowRight className="w-4 h-4" />
              </button>
              <button 
                onClick={handleDemoLaunch}
                className="w-full sm:w-auto px-8 py-4 bg-[#121214] border border-white/[0.08] hover:border-white/[0.15] text-xs font-semibold rounded-full text-white transition-all cursor-pointer"
              >
                LAUNCH SANDBOX
              </button>
            </div>

            <p className="text-[10px] text-neutral-600 font-mono tracking-widest uppercase">
              Secure Auth Protocol • Sandbox Active • KICK API Sync
            </p>
          </div>

          {/* Right: Gorgeous 3D perspective dashboard HUD */}
          <div className="relative animate-float w-full max-w-[440px] mx-auto lg:mx-0">
            <div className="premium-glass-hud hud-card-perspective p-6 space-y-6 relative overflow-hidden border border-white/[0.06] bg-[#0c0c0e]/80">
              
              {/* Header block */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-2.5 h-2.5 rounded-full bg-[#4EBD3D] glow-accent-dot animate-pulse" />
                  <span className="text-[10px] font-bold text-white uppercase tracking-widest font-mono">Stream HUD Console</span>
                </div>
                <div className="flex gap-1">
                  <div className="w-1.5 h-1.5 rounded-full bg-neutral-600" />
                  <div className="w-1.5 h-1.5 rounded-full bg-neutral-600" />
                  <div className="w-1.5 h-1.5 rounded-full bg-neutral-600" />
                </div>
              </div>

              {/* Sparkline curve */}
              <div className="bg-white/[0.02] border border-white/[0.04] rounded-2xl p-4 space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-[9px] font-mono text-neutral-400 uppercase">Hype Velocity Chart</span>
                  <span className="text-[10px] font-bold text-[#4EBD3D] font-mono">Active (100FPS)</span>
                </div>
                <div className="h-16 flex items-end gap-1.5 pt-2">
                  {chartPoints.map((point, idx) => (
                    <div 
                      key={idx} 
                      className="flex-1 bg-gradient-to-t from-[#4EBD3D]/20 to-[#4EBD3D] rounded-t-sm transition-all duration-700 ease-[cubic-bezier(0.16,1,0.3,1)]" 
                      style={{ height: `${point}%` }}
                    />
                  ))}
                </div>
              </div>

              {/* AI suggestion panel */}
              <div className="bg-[#4EBD3D]/[0.02] border border-[#4EBD3D]/10 rounded-2xl p-4 flex gap-3 items-start">
                <div className="w-6 h-6 rounded-lg bg-[#4EBD3D]/10 flex items-center justify-center shrink-0">
                  <Sparkles className="w-3.5 h-3.5 text-[#4EBD3D]" />
                </div>
                <div className="space-y-0.5">
                  <span className="text-[9px] font-bold text-[#4EBD3D] uppercase tracking-wider block">AI Suggestion</span>
                  <p className="text-[10px] text-neutral-300 leading-relaxed">
                    Engagement levels are peak. Trigger a highlighted interactive Q&A session.
                  </p>
                </div>
              </div>

              {/* Scanline light effect */}
              <div className="absolute inset-0 pointer-events-none overflow-hidden rounded-3xl opacity-[0.02]">
                <div className="w-full h-px bg-white animate-scanline" />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ──────────────────────────────────────────────────────────── */}
      {/* BENTO INTERACTIVE GRID (Highly custom SaaS widget cards)     */}
      {/* ──────────────────────────────────────────────────────────── */}
      <section id="features" className="py-24 border-t border-white/[0.04] bg-[#030305]">
        <div className="max-w-[1200px] mx-auto px-6">
          
          <div className="mb-16 space-y-3">
            <span className="text-[10px] font-mono text-[#4EBD3D] uppercase tracking-widest block">Operational Core</span>
            <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-white font-display uppercase">Interactive Module Stack</h2>
            <p className="text-xs text-neutral-400 max-w-sm leading-relaxed">
              Test and coordinate custom modules directly within this control view.
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            
            {/* CARD 1: Chat Shield (Interactive toggle + dynamic list) */}
            <div className="premium-glass-hud p-6 flex flex-col justify-between min-h-[260px] group cursor-default">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-[9px] font-mono text-neutral-500 tracking-wider uppercase">Shielding</span>
                  {/* Neomorphic switch */}
                  <button 
                    onClick={() => {
                      setShieldActive(!shieldActive);
                      toast.success(shieldActive ? "Shield Off" : "Shield Active");
                    }}
                    className={`w-10 h-5 rounded-full p-0.5 transition-all duration-300 flex items-center cursor-pointer ${
                      shieldActive ? 'bg-[#4EBD3D]' : 'bg-neutral-800'
                    }`}
                  >
                    <div className={`w-4 h-4 rounded-full bg-white transition-all ${
                      shieldActive ? 'translate-x-5' : 'translate-x-0'
                    }`} />
                  </button>
                </div>
                <h3 className="text-sm font-semibold text-white tracking-tight">Active Threat Blocker</h3>
                <p className="text-xs text-neutral-400 leading-relaxed">
                  Toggle the neural filter. When active, spam messages are tagged and removed dynamically.
                </p>
                <div className="flex flex-wrap gap-1.5 pt-2">
                  {['spamlink', 'freeGems', 'toxicPhrasing'].map(word => (
                    <span 
                      key={word} 
                      className={`text-[9px] font-mono px-2 py-0.5 rounded border transition-colors ${
                        shieldActive 
                          ? 'border-red-900/30 bg-red-950/20 text-red-400 hover:border-red-500/40' 
                          : 'border-white/[0.04] bg-white/[0.02] text-neutral-600'
                      }`}
                    >
                      {word}
                    </span>
                  ))}
                </div>
              </div>
            </div>

            {/* CARD 2: Co-Pilot Producer (Interactive segment selection) */}
            <div className="premium-glass-hud p-6 flex flex-col justify-between min-h-[260px] group cursor-default">
              <div className="space-y-4">
                <span className="text-[9px] font-mono text-neutral-500 tracking-wider uppercase block">Production</span>
                <h3 className="text-sm font-semibold text-white tracking-tight">Segment Coordinator</h3>
                <p className="text-xs text-neutral-400 leading-relaxed">
                  Define current segment types to deliver contextual prompts.
                </p>
                
                {/* Interactive segment items */}
                <div className="space-y-2 pt-2">
                  {[
                    { id: 'game', label: 'Gameplay' },
                    { id: 'qna', label: 'Interactive Q&A' },
                    { id: 'collab', label: 'Sponsorship' }
                  ].map(seg => (
                    <div 
                      key={seg.id}
                      onClick={() => setSelectedSegment(seg.id as any)}
                      className={`px-3 py-1.5 rounded-lg border text-[10px] font-mono flex items-center justify-between cursor-pointer transition-all ${
                        selectedSegment === seg.id 
                          ? 'border-[#4EBD3D]/30 bg-[#4EBD3D]/5 text-[#4EBD3D]' 
                          : 'border-white/[0.04] bg-white/[0.01] text-neutral-400 hover:border-white/[0.1]'
                      }`}
                    >
                      <span>{seg.label}</span>
                      {selectedSegment === seg.id && <span className="w-1.5 h-1.5 rounded-full bg-[#4EBD3D]" />}
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* CARD 3: Radar Focus (Live Radar pulse scanner) */}
            <div className="premium-glass-hud p-6 flex flex-col justify-between min-h-[260px] group cursor-default">
              <div className="space-y-4">
                <span className="text-[9px] font-mono text-neutral-500 tracking-wider uppercase block">Discovery</span>
                <h3 className="text-sm font-semibold text-white tracking-tight">Priority Question Radar</h3>
                <p className="text-xs text-neutral-400 leading-relaxed">
                  Real-time circular radar sweep tags unanswered VIP queries.
                </p>
                
                {/* Radar visualization */}
                <div className="flex items-center gap-4 pt-4">
                  <div className="relative w-12 h-12 rounded-full border border-white/[0.05] flex items-center justify-center overflow-hidden bg-white/[0.01]">
                    <div className="absolute inset-0 border border-[#4EBD3D]/25 rounded-full animate-pulse-radar" />
                    <Eye className="w-4 h-4 text-[#4EBD3D]" />
                  </div>
                  <div>
                    <span className="text-[9px] font-mono text-neutral-500 uppercase block">Active Scan</span>
                    <span className="text-xs font-bold text-white font-mono">{radarPingCount} questions tagged</span>
                  </div>
                </div>
              </div>
            </div>

            {/* CARD 4: Highlight Clips */}
            <div className="premium-glass-hud p-6 flex flex-col justify-between min-h-[260px] group cursor-default">
              <div className="space-y-4">
                <span className="text-[9px] font-mono text-neutral-500 tracking-wider uppercase block">Automation</span>
                <h3 className="text-sm font-semibold text-white tracking-tight">Clip Event Triggers</h3>
                <p className="text-xs text-neutral-400 leading-relaxed">
                  Detects excitement surges and flags timestamp ranges dynamically for highlight exports.
                </p>
                <div className="border border-white/[0.04] bg-white/[0.01] rounded-xl p-3.5 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Film className="w-3.5 h-3.5 text-[#4EBD3D]" />
                    <span className="text-[10px] font-mono text-neutral-300">Highlight #42</span>
                  </div>
                  <span className="text-[9px] font-mono text-neutral-500 bg-white/[0.03] px-2 py-0.5 rounded">00:45:12</span>
                </div>
              </div>
            </div>

            {/* CARD 5: Sound / Audio Alert Trigger */}
            <div className="premium-glass-hud p-6 flex flex-col justify-between min-h-[260px] group cursor-default">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-[9px] font-mono text-neutral-500 tracking-wider uppercase">Alert Channel</span>
                  <button 
                    onClick={() => setSoundEnabled(!soundEnabled)}
                    className="p-1.5 rounded-lg bg-white/[0.02] border border-white/[0.05] hover:border-[#4EBD3D]/30 transition-colors text-neutral-400 hover:text-white cursor-pointer"
                  >
                    {soundEnabled ? <Volume2 className="w-3.5 h-3.5" /> : <VolumeX className="w-3.5 h-3.5" />}
                  </button>
                </div>
                <h3 className="text-sm font-semibold text-white tracking-tight">Audio Co-Pilot Prompts</h3>
                <p className="text-xs text-neutral-400 leading-relaxed">
                  System sends subtle acoustic prompts on critical threat spikes so you do not need to look away.
                </p>
                <span className="text-[9px] font-mono text-neutral-500 block">
                  Status: {soundEnabled ? 'Acoustic Feed Live' : 'Muted'}
                </span>
              </div>
            </div>

            {/* CARD 6: Recap Studio */}
            <div className="premium-glass-hud p-6 flex flex-col justify-between min-h-[260px] group cursor-default">
              <div className="space-y-4">
                <span className="text-[9px] font-mono text-neutral-500 tracking-wider uppercase block">Analytics</span>
                <h3 className="text-sm font-semibold text-white tracking-tight">Stream Recap Studio</h3>
                <p className="text-xs text-neutral-400 leading-relaxed">
                  Post-broadcast details analyze community mood, engagement averages, and key metrics.
                </p>
                <div className="grid grid-cols-2 gap-2 pt-2">
                  <div className="bg-white/[0.02] border border-white/[0.04] rounded-xl p-2.5 text-center">
                    <span className="text-[8px] text-neutral-500 block font-mono">Mood Index</span>
                    <span className="text-xs font-bold text-[#4EBD3D] font-mono">Good (86%)</span>
                  </div>
                  <div className="bg-white/[0.02] border border-white/[0.04] rounded-xl p-2.5 text-center">
                    <span className="text-[8px] text-neutral-500 block font-mono">Clips Saved</span>
                    <span className="text-xs font-bold text-white font-mono">14</span>
                  </div>
                </div>
              </div>
            </div>

          </div>
        </div>
      </section>

      {/* ──────────────────────────────────────────────────────────── */}
      {/* WORKFLOW PIPELINE                                            */}
      {/* ──────────────────────────────────────────────────────────── */}
      <section id="integration" className="py-24 border-t border-white/[0.04] bg-[#030305]">
        <div className="max-w-[1200px] mx-auto px-6">
          <div className="mb-16 space-y-3">
            <span className="text-[10px] font-mono text-[#4EBD3D] uppercase tracking-widest block">Workflow</span>
            <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-white font-display uppercase">Integration Pipeline</h2>
          </div>

          <div className="grid md:grid-cols-3 gap-6">
            {[
              { step: '1', title: 'Authenticate link', desc: 'Confirm accounts via official OAuth authentication parameters.' },
              { step: '2', title: 'Broadcast sync', desc: 'Initialize standard encoders. System processes incoming events.' },
              { step: '3', title: 'AI Co-Pilot active', desc: 'Receive real-time dashboard suggestions, alerts, and filters.' }
            ].map((step, idx) => (
              <div key={idx} className="premium-glass-hud p-6 space-y-4">
                <div className="w-8 h-8 rounded-full bg-[#4EBD3D]/5 border border-[#4EBD3D]/10 flex items-center justify-center text-xs font-bold text-[#4EBD3D] font-mono">
                  {step.step}
                </div>
                <h3 className="text-sm font-semibold text-white pt-2">{step.title}</h3>
                <p className="text-xs text-neutral-400 leading-relaxed">{step.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ──────────────────────────────────────────────────────────── */}
      {/* FAQ SECTION                                                  */}
      {/* ──────────────────────────────────────────────────────────── */}
      <section id="support" className="py-24 border-t border-white/[0.04] bg-[#030305]">
        <div className="max-w-[800px] mx-auto px-6">
          <div className="mb-16 text-center space-y-3">
            <span className="text-[10px] font-mono text-[#4EBD3D] uppercase tracking-widest block">FAQ</span>
            <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-white font-display uppercase">Common questions</h2>
          </div>

          <div className="divide-y divide-white/[0.04]">
            {faqs.map((faq, idx) => {
              const isOpen = activeFaq === idx;
              return (
                <div key={idx} className="py-4">
                  <button 
                    onClick={() => setActiveFaq(isOpen ? null : idx)}
                    className="w-full py-2 flex items-center justify-between text-left font-medium text-xs md:text-sm text-white hover:text-[#4EBD3D] transition-colors cursor-pointer"
                  >
                    <span>{faq.q}</span>
                    {isOpen ? <ChevronUp className="w-4 h-4 text-neutral-500" /> : <ChevronDown className="w-4 h-4 text-neutral-500" />}
                  </button>
                  <div className={`overflow-hidden transition-all duration-300 ${isOpen ? 'max-h-24 opacity-100 mt-2' : 'max-h-0 opacity-0'}`}>
                    <p className="text-xs text-neutral-400 leading-relaxed pl-1">{faq.a}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ──────────────────────────────────────────────────────────── */}
      {/* FOOTER SECTION                                              */}
      {/* ──────────────────────────────────────────────────────────── */}
      <footer className="border-t border-white/[0.04] py-16 bg-[#030305]">
        <div className="max-w-[1200px] mx-auto px-6 flex flex-col md:flex-row items-center justify-between gap-8 text-[11px] text-neutral-500 font-mono uppercase tracking-wider">
          <div className="flex items-center gap-2">
            <span className="w-3.5 h-3.5 bg-[#4EBD3D]/20 border border-[#4EBD3D]/40 rounded-sm shrink-0" />
            <span className="text-white font-bold font-display uppercase tracking-widest">StreamMind AI</span>
          </div>
          <div>
            <span>System Console // 2026</span>
          </div>
          <div className="flex items-center gap-6">
            <a href="https://github.com/SKYGOD07/StreamMind-AI" target="_blank" rel="noopener" className="hover:text-white transition-colors">Repository</a>
            <a href="https://kick.com" target="_blank" rel="noopener" className="hover:text-white transition-colors">KICK Platform</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
