import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { PROTOCOLS, CATEGORIES, BOLT_TIERS } from './data/protocols';
import {
  Home, BookOpen, User, ChevronRight, X, Play, Pause, RotateCcw,
  Check, AlertTriangle, Wind, Zap, Moon, Heart, Brain, Shield, Clock,
  Activity, Target, Flame, Leaf, Sparkles, Timer
} from 'lucide-react';

// ─── Hooks ───
function useLocalStorage(key, initial) {
  const [val, setVal] = useState(() => {
    try { const s = localStorage.getItem(key); return s ? JSON.parse(s) : initial; }
    catch { return initial; }
  });
  useEffect(() => { localStorage.setItem(key, JSON.stringify(val)); }, [key, val]);
  return [val, setVal];
}

function useWakeLock() {
  const lock = useRef(null);
  const request = useCallback(async () => {
    try { if ('wakeLock' in navigator) lock.current = await navigator.wakeLock.request('screen'); } catch {}
  }, []);
  const release = useCallback(() => { lock.current?.release(); lock.current = null; }, []);
  return { request, release };
}

// ─── Timer Engine ───
function BreathingTimer({ protocol, boltScore, onClose, onComplete }) {
  const [state, setState] = useState('ready'); // ready|breathing|paused|complete
  const [phaseIndex, setPhaseIndex] = useState(0);
  const [phaseTime, setPhaseTime] = useState(0);
  const [totalTime, setTotalTime] = useState(0);
  const [cycleCount, setCycleCount] = useState(0);
  const wakeLock = useWakeLock();
  const intervalRef = useRef(null);
  const targetDuration = protocol.isPanicButton ? 60 : protocol.sessionDuration;

  const scaledPhases = useMemo(() => {
    if (!protocol.boltScaling || !boltScore) return protocol.phases;
    const tier = boltScore < 20 ? 'low' : boltScore < 46 ? 'medium' : 'high';
    const scale = protocol.boltScaling[tier] / 4;
    return protocol.phases.map(p => ({ ...p, duration: Math.round(p.duration * scale * 10) / 10 }));
  }, [protocol, boltScore]);

  const currentPhase = scaledPhases[phaseIndex];
  const phaseDuration = currentPhase?.duration || 4;
  const progress = phaseTime / phaseDuration;
  const totalProgress = Math.min(totalTime / targetDuration, 1);

  useEffect(() => {
    if (state !== 'breathing') return;
    intervalRef.current = setInterval(() => {
      setPhaseTime(prev => {
        const next = prev + 0.05;
        if (next >= phaseDuration) {
          setPhaseIndex(pi => {
            const nextPi = (pi + 1) % scaledPhases.length;
            if (nextPi === 0) setCycleCount(c => c + 1);
            return nextPi;
          });
          return 0;
        }
        return next;
      });
      setTotalTime(prev => {
        const next = prev + 0.05;
        if (next >= targetDuration) {
          setState('complete');
          return targetDuration;
        }
        return next;
      });
    }, 50);
    return () => clearInterval(intervalRef.current);
  }, [state, phaseDuration, scaledPhases.length, targetDuration]);

  useEffect(() => {
    if (state === 'breathing') wakeLock.request();
    else wakeLock.release();
    return () => wakeLock.release();
  }, [state]);

  useEffect(() => {
    if (state === 'complete') onComplete?.(Math.round(totalTime));
  }, [state]);

  const start = () => { setState('breathing'); setPhaseTime(0); };
  const togglePause = () => setState(s => s === 'breathing' ? 'paused' : 'breathing');
  const reset = () => { setState('ready'); setPhaseIndex(0); setPhaseTime(0); setTotalTime(0); setCycleCount(0); };

  const formatTime = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

  const orbScale = currentPhase?.type === 'inhale' ? 1 + progress * 0.4 :
                   currentPhase?.type === 'exhale' ? 1.4 - progress * 0.4 : 1.2;
  const orbColor = currentPhase?.color || '#4ECDC4';

  const circumference = 2 * Math.PI * 120;

  if (state === 'complete') {
    return (
      <motion.div className="timer-screen" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
        <div style={{ textAlign: 'center' }}>
          <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring', delay: 0.2 }}
            style={{ width: 80, height: 80, borderRadius: '50%', background: 'rgba(78,205,196,0.12)',
              border: '2px solid #4ECDC4', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 24px' }}>
            <Check size={36} color="#4ECDC4" />
          </motion.div>
          <motion.h2 initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}
            style={{ fontSize: '1.5rem', fontWeight: 600, marginBottom: 8 }}>Session Complete</motion.h2>
          <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.6 }}
            style={{ fontFamily: 'var(--font-mono)', fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: 8 }}>
            {formatTime(totalTime)} · {cycleCount} cycles
          </motion.p>
          <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.7 }}
            style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: 32, maxWidth: 280, margin: '0 auto 32px' }}>
            {protocol.scienceBrief.split('.')[0]}.
          </motion.p>
          <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
            <button className="btn btn-secondary" onClick={reset}>Again</button>
            <button className="btn btn-primary" onClick={onClose}>Done</button>
          </div>
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div className="timer-screen" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
      <button className="timer-close" onClick={onClose}><X size={20} /></button>

      <div style={{ fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.15em', color: 'var(--text-muted)', marginBottom: 40 }}>
        {protocol.name}
      </div>

      {/* Breath visualisation */}
      <div style={{ width: '100%', maxWidth: 320, margin: '0 auto 28px' }}>
        {/* Session ring (subtle) */}
        <div style={{ position: 'relative', width: 180, height: 180, margin: '0 auto 18px' }}>
          <svg width="180" height="180" style={{ transform: 'rotate(-90deg)' }}>
            <circle cx="90" cy="90" r="80" fill="none" stroke="rgba(255,255,255,0.04)" strokeWidth="4" />
            <circle
              cx="90"
              cy="90"
              r="80"
              fill="none"
              stroke={orbColor}
              strokeWidth="4"
              strokeLinecap="round"
              strokeDasharray={2 * Math.PI * 80}
              strokeDashoffset={(2 * Math.PI * 80) * (1 - (state === 'ready' ? 0 : totalProgress))}
              style={{ transition: 'stroke-dashoffset 0.1s linear, stroke 0.5s ease' }}
            />
          </svg>
          {state !== 'ready' && (
            <motion.div
              animate={{ scale: orbScale, opacity: state === 'paused' ? 0.25 : 0.4 }}
              transition={{ duration: 0.35, ease: 'easeInOut' }}
              style={{
                position: 'absolute',
                inset: 40,
                borderRadius: '50%',
                background: `radial-gradient(circle, ${orbColor}33, transparent)`,
                border: `1px solid ${orbColor}33`
              }}
            />
          )}
          {state === 'ready' && (
            <div style={{
              position: 'absolute',
              inset: 0,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              textAlign: 'center'
            }}>
              <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: 4 }}>Ready to breathe</div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Press play and follow the bar below</div>
            </div>
          )}
        </div>

        {/* Clear phase text + countdown */}
        {state !== 'ready' && (
          <div style={{ textAlign: 'center', marginBottom: 14 }}>
            <motion.div
              key={phaseIndex}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              style={{ fontSize: '1.25rem', fontWeight: 600, color: orbColor, marginBottom: 4 }}
            >
              {currentPhase?.name}
            </motion.div>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: 6 }}>
              {currentPhase?.instruction}
            </div>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: '3rem', fontWeight: 700 }}>
              {Math.ceil(phaseDuration - phaseTime)}
            </div>
          </div>
        )}

        {/* Primary breath bar */}
        <div style={{ marginTop: state === 'ready' ? 8 : 0 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.7rem', marginBottom: 4, color: 'var(--text-muted)' }}>
            <span>{currentPhase?.type === 'inhale' ? 'Inhale' : currentPhase?.type === 'exhale' ? 'Exhale' : 'Hold'}</span>
            <span>{phaseDuration.toFixed(1)}s</span>
          </div>
          <div style={{
            position: 'relative',
            width: '100%',
            height: 20,
            borderRadius: 999,
            background: 'var(--bg-elevated)',
            overflow: 'hidden',
            border: '1px solid var(--border-subtle)'
          }}>
            <motion.div
              key={`${phaseIndex}-${state === 'paused'}`}
              initial={{ width: 0 }}
              animate={{ width: `${Math.min(progress, 1) * 100}%` }}
              transition={{ duration: 0.2, ease: 'linear' }}
              style={{
                height: '100%',
                borderRadius: 999,
                background:
                  currentPhase?.type === 'inhale'
                    ? `linear-gradient(90deg, ${orbColor} 0%, ${orbColor}AA 60%, ${orbColor}44 100%)`
                    : currentPhase?.type === 'exhale'
                    ? `linear-gradient(90deg, ${orbColor}99 0%, ${orbColor}66 40%, ${orbColor}22 100%)`
                    : `linear-gradient(90deg, ${orbColor}55, ${orbColor}33)`
              }}
            />
          </div>
          <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: 6, textAlign: 'center' }}>
            Breathe so your rhythm matches the moving bar
          </div>
        </div>
      </div>

      <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: 24 }}>
        {formatTime(totalTime)} / {formatTime(targetDuration)}
        {cycleCount > 0 && <span style={{ marginLeft: 12 }}>Cycle {cycleCount}</span>}
      </div>

      <div style={{ display: 'flex', gap: 20, alignItems: 'center' }}>
        <button onClick={reset}
          style={{ width: 48, height: 48, borderRadius: '50%', border: '1px solid var(--border-subtle)',
            background: 'var(--bg-card)', color: 'var(--text-primary)', cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <RotateCcw size={18} />
        </button>
        <button onClick={state === 'ready' ? start : togglePause}
          style={{ width: 72, height: 72, borderRadius: '50%', border: 'none',
            background: '#4ECDC4', color: '#0A0E17', cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.2rem' }}>
          {state === 'breathing' ? <Pause size={28} /> : <Play size={28} style={{ marginLeft: 3 }} />}
        </button>
        <div style={{ width: 48 }} />
      </div>
    </motion.div>
  );
}

// ─── Safety Check Modal ───
function SafetyCheck({ protocol, onConfirm, onCancel }) {
  const checks = protocol.safetyChecks || [];
  const [confirmed, setConfirmed] = useState(new Set());
  const allChecked = checks.length > 0 && confirmed.size === checks.length;

  const toggle = (i) => {
    setConfirmed(prev => {
      const next = new Set(prev);
      next.has(i) ? next.delete(i) : next.add(i);
      return next;
    });
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(8px)',
        zIndex: 300, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
        style={{ background: 'var(--bg-secondary)', border: '1px solid var(--accent-coral)',
          borderRadius: 'var(--radius-lg)', padding: '32px 24px', maxWidth: 400, width: '100%', textAlign: 'center' }}>
        <div style={{ fontSize: '2.5rem', marginBottom: 16 }}>⚠️</div>
        <h3 style={{ fontSize: '1.2rem', fontWeight: 600, marginBottom: 12, color: 'var(--accent-coral)' }}>
          Safety Check Required
        </h3>
        <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: 1.6, marginBottom: 24, fontWeight: 300 }}>
          <strong style={{ color: 'var(--text-primary)' }}>{protocol.name}</strong> involves intense breathing
          that can cause dizziness or loss of consciousness. Please confirm all safety conditions.
        </p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 24, textAlign: 'left' }}>
          {checks.map((check, i) => (
            <div key={i} onClick={() => toggle(i)}
              style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px',
                borderRadius: 'var(--radius-sm)', background: 'var(--bg-card)',
                border: `1px solid ${confirmed.has(i) ? 'var(--accent-green)' : 'var(--border-subtle)'}`,
                cursor: 'pointer', fontSize: '0.85rem', transition: 'all 0.2s' }}>
              <div style={{ width: 22, height: 22, borderRadius: 6,
                border: `2px solid ${confirmed.has(i) ? 'var(--accent-green)' : 'var(--text-muted)'}`,
                background: confirmed.has(i) ? 'var(--accent-green)' : 'transparent',
                display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                {confirmed.has(i) && <Check size={14} color="#fff" />}
              </div>
              <span>I confirm: {check}</span>
            </div>
          ))}
        </div>
        <div style={{ display: 'flex', gap: 12 }}>
          <button className="btn btn-secondary" style={{ flex: 1 }} onClick={onCancel}>Cancel</button>
          <button className="btn btn-primary" style={{ flex: 1, opacity: allChecked ? 1 : 0.4, pointerEvents: allChecked ? 'auto' : 'none' }}
            onClick={onConfirm}>Begin</button>
        </div>
      </motion.div>
    </motion.div>
  );
}

// ─── BOLT Assessment ───
function BOLTAssessment({ onComplete, onSkip }) {
  const [step, setStep] = useState(0); // 0=intro, 1=inhale, 2=exhale, 3=hold/timing, 4=result
  const [timer, setTimer] = useState(0);
  const [running, setRunning] = useState(false);
  const intervalRef = useRef(null);

  useEffect(() => {
    if (!running) return;
    intervalRef.current = setInterval(() => setTimer(t => t + 0.1), 100);
    return () => clearInterval(intervalRef.current);
  }, [running]);

  const startTiming = () => { setTimer(0); setRunning(true); setStep(3); };
  const stopTiming = () => { setRunning(false); setStep(4); };
  const score = Math.round(timer);
  const tier = score < 20 ? 'low' : score < 46 ? 'medium' : 'high';
  const tierData = BOLT_TIERS[tier];

  const steps = [
    {
      title: 'BOLT Score Assessment',
      text: 'The Body Oxygen Level Test measures your CO₂ tolerance — how comfortably your body handles carbon dioxide. This personalizes every breathing exercise to your physiology.',
      action: <button className="btn btn-primary btn-lg" onClick={() => setStep(1)}>Begin Assessment</button>,
      skip: <button className="btn btn-secondary" style={{ marginTop: 12 }} onClick={onSkip}>Skip for now</button>
    },
    {
      title: 'Step 1: Breathe Normally',
      text: 'Take a normal, gentle breath in through your nose. Don\'t take a deep breath — keep it light and natural.',
      action: <button className="btn btn-primary btn-lg" onClick={() => setStep(2)}>I\'ve inhaled →</button>
    },
    {
      title: 'Step 2: Exhale Gently',
      text: 'Now exhale normally through your nose. Don\'t force out all the air — just a regular, relaxed exhale. Then pinch your nose closed.',
      action: <button className="btn btn-primary btn-lg" onClick={startTiming}>I\'ve exhaled & pinched → Start timer</button>
    },
    {
      title: 'Hold Until First Urge',
      text: 'Keep holding. Stop at the FIRST definite urge to breathe — a swallow, a diaphragm contraction, or a tightening in the throat. Don\'t push through.',
      action: <button className="btn btn-danger btn-lg" onClick={stopTiming} style={{ minWidth: 200 }}>I need to breathe!</button>
    },
    {
      title: 'Your BOLT Score',
      text: '',
      action: null
    }
  ];

  const current = steps[step];

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      style={{ minHeight: '100dvh', display: 'flex', flexDirection: 'column', alignItems: 'center',
        justifyContent: 'center', padding: '40px 24px', textAlign: 'center' }}>
      <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.7rem', color: 'var(--text-muted)',
        textTransform: 'uppercase', letterSpacing: '0.15em', marginBottom: 24 }}>
        {step < 4 ? `Step ${step + 1} of 4` : 'Complete'}
      </div>

      <motion.h2 key={step} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
        style={{ fontSize: '1.6rem', fontWeight: 600, letterSpacing: '-0.02em', marginBottom: 12 }}>
        {current.title}
      </motion.h2>

      {step === 3 && (
        <motion.div initial={{ scale: 0.8 }} animate={{ scale: 1 }}
          style={{ fontFamily: 'var(--font-mono)', fontSize: '5rem', fontWeight: 700, color: '#4ECDC4',
            margin: '32px 0', letterSpacing: '-0.04em' }}>
          {timer.toFixed(1)}
          <span style={{ fontSize: '1rem', marginLeft: 4 }}>sec</span>
        </motion.div>
      )}

      {step === 4 && (
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
          style={{ padding: 24, borderRadius: 'var(--radius-md)', background: 'var(--bg-card)',
            border: '1px solid var(--border-subtle)', maxWidth: 360, width: '100%', marginTop: 24 }}>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: '3rem', fontWeight: 700, color: tierData.color, marginBottom: 4 }}>
            {score}s
          </div>
          <div style={{ fontSize: '0.85rem', fontWeight: 500, marginBottom: 8, color: tierData.color }}>
            {tierData.label}
          </div>
          <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', fontWeight: 300, lineHeight: 1.5 }}>
            {tierData.description}
          </div>
        </motion.div>
      )}

      <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', lineHeight: 1.6, maxWidth: 340,
        marginBottom: step === 3 ? 16 : 32, fontWeight: 300, marginTop: step === 4 ? 24 : 0 }}>
        {current.text}
      </p>

      {step === 4 ? (
        <button className="btn btn-primary btn-lg" onClick={() => onComplete(score)}>Save & Continue</button>
      ) : (
        <>
          {current.action}
          {current.skip}
        </>
      )}
    </motion.div>
  );
}

// ─── Pages ───
function HomePage({ onStartExercise, userData }) {
  const [filter, setFilter] = useState('all');
  const panicProtocol = PROTOCOLS.find(p => p.isPanicButton);
  const filtered = filter === 'all' ? PROTOCOLS.filter(p => !p.isPanicButton)
    : PROTOCOLS.filter(p => p.category === filter && !p.isPanicButton);

  const todayDone = userData.sessions?.some(s => {
    const d = new Date(s.date);
    const today = new Date();
    return d.toDateString() === today.toDateString();
  });

  return (
    <div className="page-shell" style={{ maxWidth: 480, margin: '0 auto', padding: '0 20px 100px' }}>
      {/* Header */}
      <div style={{ padding: '24px 0 8px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h1 style={{ fontSize: '1.5rem', fontWeight: 600, letterSpacing: '-0.02em' }}>Breathe</h1>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.82rem', marginTop: 2, fontWeight: 300 }}>
              {todayDone ? '✓ Today\'s practice complete' : 'Your daily 5-minute practice awaits'}
            </p>
          </div>
          {userData.streak > 0 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 14px',
              borderRadius: 'var(--radius-full)', background: 'rgba(255,230,109,0.1)',
              border: '1px solid rgba(255,230,109,0.2)' }}>
              <Flame size={16} color="#FFE66D" />
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.82rem', color: '#FFE66D', fontWeight: 700 }}>
                {userData.streak}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Streak dots */}
      <div style={{ display: 'flex', gap: 4, margin: '8px 0 16px' }}>
        {Array.from({ length: 7 }).map((_, i) => {
          const d = new Date();
          d.setDate(d.getDate() - (6 - i));
          const done = userData.sessions?.some(s => new Date(s.date).toDateString() === d.toDateString());
          const isToday = i === 6;
          return (
            <div key={i} style={{ flex: 1, height: 5, borderRadius: 3, transition: 'all 0.3s',
              background: done ? '#4ECDC4' : isToday ? 'rgba(255,230,109,0.4)' : 'var(--bg-elevated)' }} />
          );
        })}
      </div>

      {/* Panic Button */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '28px 0 20px', position: 'relative' }}>
        <div style={{ position: 'absolute', width: 180, height: 180, borderRadius: '50%',
          border: '1px solid rgba(78,205,196,0.12)', animation: 'pulseRing 3s ease-out infinite' }} />
        <div style={{ position: 'absolute', width: 180, height: 180, borderRadius: '50%',
          border: '1px solid rgba(78,205,196,0.10)', animation: 'pulseRing 3s ease-out 1s infinite' }} />
        <motion.button whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.97 }}
          onClick={() => onStartExercise(panicProtocol)}
          style={{ width: 170, height: 170, borderRadius: '50%', border: '2px solid #4ECDC4',
            background: 'radial-gradient(circle at 40% 35%, rgba(78,205,196,0.18), rgba(78,205,196,0.04))',
            cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center',
            justifyContent: 'center', gap: 6, position: 'relative', zIndex: 2,
            boxShadow: '0 0 60px rgba(78,205,196,0.12), inset 0 0 30px rgba(78,205,196,0.05)' }}>
          <span style={{ fontSize: '0.65rem', textTransform: 'uppercase', letterSpacing: '0.15em', color: '#4ECDC4', fontWeight: 500 }}>
            Instant Calm
          </span>
          <span style={{ fontSize: '2rem' }}>🫁</span>
          <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-primary)' }}>
            Breathe Now
          </span>
        </motion.button>
        <p style={{ marginTop: 14, fontSize: '0.72rem', color: 'var(--text-muted)', textAlign: 'center', fontWeight: 300 }}>
          60-sec Physiological Sigh · Works offline
        </p>
      </div>

      {/* Categories */}
      <div style={{ display: 'flex', gap: 8, overflowX: 'auto', padding: '8px 0 16px',
        scrollbarWidth: 'none', msOverflowStyle: 'none', WebkitOverflowScrolling: 'touch' }}>
        <button onClick={() => setFilter('all')}
          style={{ flexShrink: 0, padding: '8px 16px', borderRadius: 'var(--radius-full)',
            border: `1px solid ${filter === 'all' ? '#4ECDC4' : 'var(--border-subtle)'}`,
            background: filter === 'all' ? 'rgba(78,205,196,0.15)' : 'var(--bg-card)',
            color: filter === 'all' ? '#4ECDC4' : 'var(--text-secondary)',
            fontSize: '0.78rem', cursor: 'pointer', fontFamily: 'var(--font-body)', whiteSpace: 'nowrap' }}>
          All
        </button>
        {Object.entries(CATEGORIES).map(([key, cat]) => (
          <button key={key} onClick={() => setFilter(key)}
            style={{ flexShrink: 0, padding: '8px 16px', borderRadius: 'var(--radius-full)',
              border: `1px solid ${filter === key ? '#4ECDC4' : 'var(--border-subtle)'}`,
              background: filter === key ? 'rgba(78,205,196,0.15)' : 'var(--bg-card)',
              color: filter === key ? '#4ECDC4' : 'var(--text-secondary)',
              fontSize: '0.78rem', cursor: 'pointer', fontFamily: 'var(--font-body)', whiteSpace: 'nowrap' }}>
            {cat.icon} {cat.label}
          </button>
        ))}
      </div>

      {/* Protocol List */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {filtered.map((p, i) => (
          <motion.div key={p.id} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05 }} onClick={() => onStartExercise(p)}
            style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)',
              borderRadius: 'var(--radius-md)', padding: '16px 18px', cursor: 'pointer',
              display: 'flex', alignItems: 'center', gap: 14, transition: 'all 0.2s' }}
            whileHover={{ backgroundColor: '#1F2A42', borderColor: 'rgba(78,205,196,0.3)', y: -1 }}>
            <div style={{ width: 46, height: 46, borderRadius: 'var(--radius-sm)',
              background: `${CATEGORIES[p.category]?.color || '#4ECDC4'}15`,
              display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.3rem', flexShrink: 0 }}>
              {p.emoji}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: '0.92rem', fontWeight: 500, marginBottom: 2 }}>{p.name}</div>
              <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                {p.subtitle}
              </div>
              <div style={{ display: 'flex', gap: 6, marginTop: 5 }}>
                <span style={{ fontSize: '0.62rem', padding: '2px 7px', borderRadius: 'var(--radius-full)',
                  background: 'rgba(255,255,255,0.05)', color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)' }}>
                  {Math.round(p.sessionDuration / 60)}m
                </span>
                <span style={{ fontSize: '0.62rem', padding: '2px 7px', borderRadius: 'var(--radius-full)',
                  background: p.intensity === 'high' ? 'rgba(255,107,107,0.12)' : 'rgba(255,255,255,0.05)',
                  color: p.intensity === 'high' ? '#FF6B6B' : 'var(--text-secondary)', fontFamily: 'var(--font-mono)' }}>
                  {p.intensity}
                </span>
              </div>
            </div>
            <ChevronRight size={18} color="var(--text-muted)" style={{ flexShrink: 0 }} />
          </motion.div>
        ))}
      </div>

      <style>{`@keyframes pulseRing{0%{transform:scale(1);opacity:.6}100%{transform:scale(1.6);opacity:0}}`}</style>
    </div>
  );
}

function LearnPage() {
  const [expanded, setExpanded] = useState(null);
  const topics = [
    {
      id: 'rsa', icon: <Heart size={20} />, title: 'How You Hack Your Heart Rate',
      subtitle: 'Respiratory Sinus Arrhythmia',
      content: 'Inhaling moves your diaphragm down, expanding the heart and slowing blood flow — your brain speeds the heart up to compensate. Exhaling moves the diaphragm up, compacting the heart and accelerating blood flow — your vagus nerve signals the heart to slow down. This is why every calming technique emphasizes longer exhales. You\'re literally using mechanics to override your nervous system.'
    },
    {
      id: 'co2', icon: <Wind size={20} />, title: 'Why CO₂ Is Not Your Enemy',
      subtitle: 'The Bohr Effect',
      content: 'Carbon dioxide isn\'t just a waste gas — it\'s the key that unlocks oxygen delivery. Through the Bohr Effect, CO₂ changes the shape of hemoglobin, releasing oxygen into your brain and muscles. Over-breathing blows off too much CO₂ (hypocapnia), which constricts blood vessels and starves your tissues of oxygen despite your blood being fully saturated. This is why you feel lightheaded when hyperventilating.'
    },
    {
      id: 'brain', icon: <Brain size={20} />, title: 'Your Brain\'s Two Breathing Centers',
      subtitle: 'Pre-Bötzinger & Parafacial Nucleus',
      content: 'Automatic breathing runs on the pre-Bötzinger complex in the brainstem — you never think about it. But when you consciously change your breath (double inhales, holds, rhythm changes), you engage the parafacial nucleus. Breathing is the only bodily function with this dual control — it\'s your direct bridge between conscious thought and the autonomic nervous system.'
    },
    {
      id: 'nose', icon: <Sparkles size={20} />, title: 'The Magic of Nasal Breathing',
      subtitle: 'Nitric Oxide & 31 Functions',
      content: 'Your nose does at least 31 things that your mouth can\'t. It filters, warms, and humidifies air. Most critically, the nasal sinuses produce nitric oxide — a powerful vasodilator and antimicrobial gas. Nasal breathing adds resistance that allows deeper lung inflation. A Stanford study showed that blocking nasal breathing caused stage-two hypertension within hours, sleep apnea, and significant anxiety.'
    },
    {
      id: 'memory', icon: <Zap size={20} />, title: 'Inhale for Memory, Exhale for Power',
      subtitle: 'Cognitive & Motor Timing',
      content: 'Inhaling through the nose activates the piriform cortex and hippocampus, significantly improving reaction time, learning, and memory retrieval. That\'s why you naturally inhale before trying to remember something. Conversely, the ability to generate fast, forceful voluntary movements is maximized during an exhale — athletes instinctively exhale on a punch, throw, or lift.'
    },
    {
      id: 'evolution', icon: <Activity size={20} />, title: 'Why Modern Humans Breathe Badly',
      subtitle: 'The Dis-Evolution Problem',
      content: 'Examination of ancient skulls shows broad jaws, flat palates, and straight teeth with wide airways. Industrialization and soft diets reduced "chewing stress," shrinking our jaws and narrowing airways. About 90% of the population — including elite athletes — now exhibits suboptimal breathing patterns. Mouth breathing in children leads to the "adenoid face": narrow face, recessed jaw, and worsening respiratory issues.'
    },
  ];

  return (
    <div className="page-shell" style={{ maxWidth: 480, margin: '0 auto', padding: '0 20px 100px' }}>
      <div style={{ padding: '24px 0 16px' }}>
        <h1 style={{ fontSize: '1.5rem', fontWeight: 600, letterSpacing: '-0.02em' }}>Learn</h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.82rem', marginTop: 2, fontWeight: 300 }}>
          The science behind every breath
        </p>
      </div>
      {topics.map((t, i) => (
        <motion.div key={t.id} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
          transition={{ delay: i * 0.05 }}
          style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)',
            borderRadius: 'var(--radius-md)', padding: '18px 20px', marginBottom: 10, cursor: 'pointer',
            transition: 'all 0.2s' }}
          onClick={() => setExpanded(expanded === t.id ? null : t.id)}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <div style={{ color: '#4ECDC4', flexShrink: 0 }}>{t.icon}</div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: '0.92rem', fontWeight: 500 }}>{t.title}</div>
              <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginTop: 2 }}>
                {t.subtitle}
              </div>
            </div>
            <motion.div animate={{ rotate: expanded === t.id ? 90 : 0 }}>
              <ChevronRight size={18} color="var(--text-muted)" />
            </motion.div>
          </div>
          <AnimatePresence>
            {expanded === t.id && (
              <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.25 }}
                style={{ overflow: 'hidden' }}>
                <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', lineHeight: 1.65, marginTop: 14,
                  paddingTop: 14, borderTop: '1px solid var(--border-subtle)', fontWeight: 300 }}>
                  {t.content}
                </p>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      ))}
    </div>
  );
}

function ProfilePage({ userData, onRetakeBolt, onClearData }) {
  const totalSessions = userData.sessions?.length || 0;
  const totalMinutes = Math.round((userData.sessions?.reduce((a, s) => a + s.duration, 0) || 0) / 60);
  const boltTier = userData.boltScore ? (userData.boltScore < 20 ? 'low' : userData.boltScore < 46 ? 'medium' : 'high') : null;
  const tierData = boltTier ? BOLT_TIERS[boltTier] : null;

  return (
    <div className="page-shell" style={{ maxWidth: 480, margin: '0 auto', padding: '0 20px 100px' }}>
      <div style={{ padding: '24px 0 16px' }}>
        <h1 style={{ fontSize: '1.5rem', fontWeight: 600, letterSpacing: '-0.02em' }}>Profile</h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.82rem', marginTop: 2, fontWeight: 300 }}>
          Your breathing journey
        </p>
      </div>

      {/* Stats Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 20 }}>
        {[
          { value: totalSessions, label: 'Sessions', color: '#4ECDC4' },
          { value: `${totalMinutes}m`, label: 'Total Time', color: '#FFE66D' },
          { value: userData.streak || 0, label: 'Day Streak', color: '#E17055' },
          { value: userData.boltScore ? `${userData.boltScore}s` : '—', label: 'BOLT Score', color: tierData?.color || '#8892A8' },
        ].map((s, i) => (
          <motion.div key={i} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.08 }}
            style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)',
              borderRadius: 'var(--radius-md)', padding: '20px 16px' }}>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: '1.8rem', fontWeight: 700, color: s.color, marginBottom: 4 }}>
              {s.value}
            </div>
            <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
              {s.label}
            </div>
          </motion.div>
        ))}
      </div>

      {/* BOLT Section */}
      {tierData && (
        <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)',
          borderRadius: 'var(--radius-md)', padding: 20, marginBottom: 12 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <h3 style={{ fontSize: '0.92rem', fontWeight: 500 }}>CO₂ Tolerance Level</h3>
            <span style={{ fontSize: '0.72rem', padding: '4px 10px', borderRadius: 'var(--radius-full)',
              background: `${tierData.color}20`, color: tierData.color, fontWeight: 500 }}>
              {tierData.label}
            </span>
          </div>
          <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', fontWeight: 300, lineHeight: 1.5, marginBottom: 16 }}>
            {tierData.description}
          </p>
          <button className="btn btn-secondary" style={{ fontSize: '0.82rem' }} onClick={onRetakeBolt}>
            Retake BOLT Test
          </button>
        </div>
      )}

      {!userData.boltScore && (
        <div style={{ background: 'var(--bg-card)', border: '1px dashed var(--accent-teal)',
          borderRadius: 'var(--radius-md)', padding: 20, marginBottom: 12, textAlign: 'center' }}>
          <Target size={24} color="#4ECDC4" style={{ marginBottom: 8 }} />
          <h3 style={{ fontSize: '0.92rem', fontWeight: 500, marginBottom: 6 }}>Take Your BOLT Score</h3>
          <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', fontWeight: 300, lineHeight: 1.5, marginBottom: 16 }}>
            Personalize your breathing timers to match your CO₂ tolerance.
          </p>
          <button className="btn btn-primary" onClick={onRetakeBolt}>Begin Assessment</button>
        </div>
      )}

      {/* Recent Sessions */}
      {userData.sessions?.length > 0 && (
        <div style={{ marginTop: 8 }}>
          <h3 style={{ fontSize: '0.85rem', fontWeight: 500, marginBottom: 12, color: 'var(--text-secondary)' }}>Recent Sessions</h3>
          {userData.sessions.slice(-5).reverse().map((s, i) => {
            const p = PROTOCOLS.find(pr => pr.id === s.protocolId);
            return (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 0',
                borderBottom: '1px solid var(--border-subtle)' }}>
                <span style={{ fontSize: '1.2rem' }}>{p?.emoji || '🫁'}</span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: '0.85rem', fontWeight: 400 }}>{p?.name || 'Session'}</div>
                  <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                    {new Date(s.date).toLocaleDateString()} · {Math.round(s.duration / 60)}m
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <button className="btn btn-secondary btn-full" style={{ marginTop: 24, fontSize: '0.82rem' }} onClick={onClearData}>
        Reset All Data
      </button>
    </div>
  );
}

// ─── Protocol Detail Sheet ───
function ProtocolDetail({ protocol, onStart, onClose }) {
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(8px)',
        zIndex: 250, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}
      onClick={onClose}>
      <motion.div initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
        transition={{ type: 'spring', damping: 30, stiffness: 300 }}
        onClick={e => e.stopPropagation()}
        style={{ background: 'var(--bg-secondary)', borderRadius: '24px 24px 0 0',
          padding: '28px 24px max(24px, env(safe-area-inset-bottom))',
          maxWidth: 480, width: '100%', maxHeight: '80vh', overflowY: 'auto' }}>
        <div style={{ width: 40, height: 4, borderRadius: 2, background: 'var(--bg-elevated)',
          margin: '0 auto 20px' }} />

        <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 16 }}>
          <div style={{ fontSize: '2rem' }}>{protocol.emoji}</div>
          <div>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 600 }}>{protocol.name}</h2>
            <p style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
              {protocol.subtitle}
            </p>
          </div>
        </div>

        <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: 1.6, fontWeight: 300, marginBottom: 16 }}>
          {protocol.description}
        </p>

        {/* Phases preview */}
        <div style={{ display: 'flex', gap: 6, marginBottom: 16, flexWrap: 'wrap' }}>
          {protocol.phases.map((ph, i) => (
            <div key={i} style={{ padding: '6px 12px', borderRadius: 'var(--radius-full)',
              background: `${ph.color}18`, border: `1px solid ${ph.color}30`,
              fontSize: '0.72rem', color: ph.color, fontFamily: 'var(--font-mono)' }}>
              {ph.name} {ph.duration}s
            </div>
          ))}
        </div>

        {/* Science brief */}
        <div style={{ background: 'var(--bg-card)', borderRadius: 'var(--radius-sm)', padding: 16, marginBottom: 16 }}>
          <div style={{ fontSize: '0.68rem', textTransform: 'uppercase', letterSpacing: '0.1em',
            color: '#4ECDC4', marginBottom: 8, fontWeight: 500 }}>How It Works</div>
          <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', lineHeight: 1.6, fontWeight: 300 }}>
            {protocol.scienceBrief}
          </p>
        </div>

        {/* Clinical use */}
        <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: 8 }}>
          <strong style={{ color: 'var(--text-secondary)' }}>Clinical Use:</strong> {protocol.clinicalUse}
        </div>
        <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginBottom: 20, fontStyle: 'italic' }}>
          Source: {protocol.source}
        </div>

        {/* Contraindications */}
        {protocol.contraindications?.length > 0 && (
          <div style={{ background: 'rgba(255,107,107,0.06)', border: '1px solid rgba(255,107,107,0.15)',
            borderRadius: 'var(--radius-sm)', padding: 14, marginBottom: 20 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
              <AlertTriangle size={14} color="#FF6B6B" />
              <span style={{ fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.08em',
                color: '#FF6B6B', fontWeight: 500 }}>Contraindications</span>
            </div>
            <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', fontWeight: 300, lineHeight: 1.5 }}>
              {protocol.contraindications.join(' · ')}
            </p>
          </div>
        )}

        <button className="btn btn-primary btn-full btn-lg" onClick={onStart}>
          Start {Math.round(protocol.sessionDuration / 60)}-Minute Session
        </button>
      </motion.div>
    </motion.div>
  );
}

// ─── Main App ───
export default function App() {
  const [userData, setUserData] = useLocalStorage('breathwork-user', {
    onboarded: false,
    boltScore: null,
    streak: 0,
    sessions: [],
    lastSessionDate: null,
  });

  const [page, setPage] = useState('home'); // home|learn|profile
  const [showBolt, setShowBolt] = useState(false);
  const [activeProtocol, setActiveProtocol] = useState(null);
  const [showTimer, setShowTimer] = useState(false);
  const [showSafety, setShowSafety] = useState(false);
  const [showDetail, setShowDetail] = useState(null);

  // Show BOLT on first visit
  useEffect(() => {
    if (!userData.onboarded) setShowBolt(true);
  }, []);

  // Calculate streak
  useEffect(() => {
    if (!userData.sessions?.length) return;
    let streak = 0;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    for (let i = 0; i <= 365; i++) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      const hasSess = userData.sessions.some(s => new Date(s.date).toDateString() === d.toDateString());
      if (hasSess) streak++;
      else if (i > 0) break;
    }
    if (streak !== userData.streak) setUserData(prev => ({ ...prev, streak }));
  }, [userData.sessions]);

  const handleStartExercise = (protocol) => {
    if (protocol.isPanicButton) {
      setActiveProtocol(protocol);
      setShowTimer(true);
      return;
    }
    setShowDetail(protocol);
  };

  const handleLaunchTimer = () => {
    const protocol = showDetail || activeProtocol;
    setShowDetail(null);
    if (protocol.safetyLevel === 'dangerous' && protocol.safetyChecks?.length) {
      setActiveProtocol(protocol);
      setShowSafety(true);
    } else {
      setActiveProtocol(protocol);
      setShowTimer(true);
    }
  };

  const handleSafetyConfirm = () => {
    setShowSafety(false);
    setShowTimer(true);
  };

  const handleComplete = (duration) => {
    setUserData(prev => ({
      ...prev,
      sessions: [...(prev.sessions || []), {
        protocolId: activeProtocol.id,
        duration,
        date: new Date().toISOString(),
      }],
      lastSessionDate: new Date().toISOString(),
    }));
  };

  const handleBoltComplete = (score) => {
    setUserData(prev => ({ ...prev, boltScore: score, onboarded: true }));
    setShowBolt(false);
  };

  const handleBoltSkip = () => {
    setUserData(prev => ({ ...prev, onboarded: true }));
    setShowBolt(false);
  };

  // ─── Render ───
  if (showBolt) {
    return <BOLTAssessment onComplete={handleBoltComplete} onSkip={handleBoltSkip} />;
  }

  return (
    <div className="app-shell" style={{ minHeight: '100dvh', position: 'relative' }}>
      <AnimatePresence mode="wait">
        {showTimer && activeProtocol && (
          <BreathingTimer key="timer" protocol={activeProtocol} boltScore={userData.boltScore}
            onClose={() => { setShowTimer(false); setActiveProtocol(null); }}
            onComplete={handleComplete} />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showSafety && activeProtocol && (
          <SafetyCheck key="safety" protocol={activeProtocol}
            onConfirm={handleSafetyConfirm}
            onCancel={() => { setShowSafety(false); setActiveProtocol(null); }} />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showDetail && (
          <ProtocolDetail key="detail" protocol={showDetail}
            onStart={handleLaunchTimer}
            onClose={() => setShowDetail(null)} />
        )}
      </AnimatePresence>

      {!showTimer && (
        <>
          <AnimatePresence mode="wait">
            {page === 'home' && <HomePage key="home" onStartExercise={handleStartExercise} userData={userData} />}
            {page === 'learn' && <LearnPage key="learn" />}
            {page === 'profile' && (
              <ProfilePage key="profile" userData={userData}
                onRetakeBolt={() => setShowBolt(true)}
                onClearData={() => {
                  if (confirm('Reset all breathing data? This cannot be undone.')) {
                    setUserData({ onboarded: true, boltScore: null, streak: 0, sessions: [], lastSessionDate: null });
                  }
                }} />
            )}
          </AnimatePresence>

          {/* Navigation Bar */}
          <nav style={{ position: 'fixed', bottom: 0, left: '50%', transform: 'translateX(-50%)',
            width: '100%', maxWidth: 480, background: 'rgba(17,24,39,0.92)',
            backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)',
            borderTop: '1px solid var(--border-subtle)', display: 'flex', justifyContent: 'space-around',
            padding: '8px 0 max(8px, env(safe-area-inset-bottom))', zIndex: 100 }}>
            {[
              { id: 'home', icon: <Home size={22} />, label: 'Breathe' },
              { id: 'learn', icon: <BookOpen size={22} />, label: 'Learn' },
              { id: 'profile', icon: <User size={22} />, label: 'Profile' },
            ].map(item => (
              <button key={item.id} onClick={() => setPage(item.id)}
                style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
                  padding: '8px 16px', background: 'none', border: 'none',
                  color: page === item.id ? '#4ECDC4' : 'var(--text-muted)',
                  cursor: 'pointer', fontFamily: 'var(--font-body)', fontSize: '0.62rem',
                  letterSpacing: '0.05em', textTransform: 'uppercase', transition: 'color 0.2s' }}>
                {item.icon}
                {item.label}
              </button>
            ))}
          </nav>
        </>
      )}
    </div>
  );
}
