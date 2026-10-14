import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { SPECTRUM } from './sequence';
import { sfx } from './sfx';

const vars = (v: Record<string, string | number>) => v as CSSProperties;

/**
 * The spectrum card between chapters: the V-I-B-G-Y-O-R strip, colours already won lit,
 * the new one flaring up, and its name settling in above.
 * `finale` lights the whole strip one band after another, with no words: the ending
 * sequence (still to come) takes over from there.
 */
export function SpectrumCard({ band, leaving, finale }: { band: number; leaving: boolean; finale?: boolean }) {
  const name = SPECTRUM[band].name;
  return (
    <div className={`card${leaving ? ' leaving' : ''}`} style={vars({ '--c': SPECTRUM[band].color })} aria-live="polite">
      {!finale && (
        <div className="card-name" aria-label={name}>
          {[...name].map((ch, i) => <span key={i} style={vars({ '--i': i })} aria-hidden>{ch}</span>)}
        </div>
      )}
      <div className="strip">
        {SPECTRUM.map((b, i) => {
          const state = finale ? 'ignite' : i < band ? 'lit' : i === band ? 'ignite' : 'off';
          return (
            <div key={b.letter} className={`seg ${state}`} style={vars({ '--c': b.color, '--i': finale ? i : 0 })}>
              <span className="bar" />
              <span className="letter">{b.letter}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/**
 * A colour video, letterboxed on black. Fades in once it is actually playing.
 * Hold SPACE (or hold the mouse button) to skip; the prompt only shows once the player
 * touches a key or the mouse, so it never sits on top of the video uninvited.
 * A missing or broken video simply counts as finished, so the run never gets stuck.
 */
export function VideoPlayer({ src, color, fading, onEnd }: { src: string; color: string; fading: boolean; onEnd: () => void }) {
  const ref = useRef<HTMLVideoElement>(null);
  const [playing, setPlaying] = useState(false);
  const [blocked, setBlocked] = useState(false);
  const [prompt, setPrompt] = useState(false);
  const [held, setHeld] = useState(0);
  const ended = useRef(false);
  const end = useRef(onEnd); end.current = onEnd;
  const finish = () => { if (!ended.current) { ended.current = true; end.current(); } };

  // start playback; if the browser refuses sound without a click, ask for one
  useEffect(() => {
    const v = ref.current!;
    const t = setTimeout(() => {
      v.play().catch(() => setBlocked(true));
    }, 120);
    return () => clearTimeout(t);
  }, []);

  // hold-to-skip
  useEffect(() => {
    let holding = false, start = 0, raf = 0, hide = 0;
    const HOLD = 900;
    const show = () => { setPrompt(true); clearTimeout(hide); hide = window.setTimeout(() => { if (!holding) setPrompt(false); }, 2200); };
    const tick = () => {
      if (!holding) return;
      const p = Math.min(1, (performance.now() - start) / HOLD);
      setHeld(p);
      if (p >= 1) { holding = false; sfx.blip(); finish(); return; }
      raf = requestAnimationFrame(tick);
    };
    const down = () => { show(); if (holding || ended.current) return; holding = true; start = performance.now(); raf = requestAnimationFrame(tick); };
    const up = () => { holding = false; cancelAnimationFrame(raf); setHeld(0); show(); };
    const onKeyDown = (e: KeyboardEvent) => { if (e.key === ' ') { e.preventDefault(); if (!e.repeat) down(); } else show(); };
    const onKeyUp = (e: KeyboardEvent) => { if (e.key === ' ') up(); };
    window.addEventListener('keydown', onKeyDown); window.addEventListener('keyup', onKeyUp);
    window.addEventListener('mousedown', down); window.addEventListener('mouseup', up); window.addEventListener('mousemove', show);
    return () => {
      cancelAnimationFrame(raf); clearTimeout(hide);
      window.removeEventListener('keydown', onKeyDown); window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('mousedown', down); window.removeEventListener('mouseup', up); window.removeEventListener('mousemove', show);
    };
  }, []);

  const onTime = () => {
    const v = ref.current!;
    if (v.duration && v.duration - v.currentTime < 0.35) finish();   // start the hand-off just before the last frame
  };

  return (
    <div className={`video-layer${fading ? ' fading' : ''}`} style={vars({ '--c': color })}>
      <video ref={ref} src={src} className={playing ? 'on' : ''} playsInline preload="auto"
        onPlaying={() => setPlaying(true)} onTimeUpdate={onTime} onEnded={finish} onError={finish} />
      {blocked && (
        <button type="button" className="tap-to-play" autoFocus
          onClick={(e) => { e.stopPropagation(); setBlocked(false); void ref.current?.play().catch(() => finish()); }}>
          ▶ PLAY
        </button>
      )}
      <div className={`skip${prompt || held > 0 ? ' show' : ''}`} aria-hidden={!prompt}>
        <svg viewBox="0 0 36 36" className="skip-ring">
          <circle cx="18" cy="18" r="15" className="track" />
          <circle cx="18" cy="18" r="15" className="fill" style={{ strokeDashoffset: 94.25 * (1 - held) }} />
        </svg>
        <span>HOLD <kbd>SPACE</kbd> TO SKIP</span>
      </div>
    </div>
  );
}

/** Shown over a level's own victory screen: a quiet prompt and a bar that runs out the hold. */
export function ContinueHint({ hold, color }: { hold: number; color: string }) {
  return (
    <div className="continue" style={vars({ '--c': color, '--hold': `${hold}ms` })}>
      <span className="continue-label">CONTINUE <kbd>ENTER</kbd></span>
      <span className="continue-bar"><span /></span>
    </div>
  );
}

/** A soft wash of the new colour blooming out from the centre as the iris opens. */
export function Bloom({ color, onDone }: { color: string; onDone: () => void }) {
  return <div className="bloom" style={vars({ '--c': color })} onAnimationEnd={onDone} />;
}
