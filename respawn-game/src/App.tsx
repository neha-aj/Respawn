import { useCallback, useEffect, useRef, useState, type CSSProperties } from 'react';
import { CHAPTERS, startChapter } from './sequence';
import { sfx } from './sfx';
import { Bloom, ContinueHint, SpectrumCard, VideoPlayer } from './Transitions';

/*
 * RESPAWN: every level, back to back.
 *
 * Each level runs in its own iframe (its own styles, fonts, keys and audio; removing the
 * iframe shuts the level down) and posts { type: 'respawn:complete' } to this window when
 * it is won. Between levels the shell plays one continuous transition:
 *
 *   victory hold ─► iris closes (pauses on a pinhole) ─► spectrum card: the next colour
 *   ignites on the V-I-B-G-Y-O-R strip with its note ─► colour video (hold SPACE to skip;
 *   the next level loads behind it) ─► colour bloom + iris opens on the new level
 */

/**
 * A level that loaded hidden (behind a video) could not take focus, so its React
 * `autoFocus` (e.g. the START button) silently did nothing. Once the level is revealed,
 * focus that element so ENTER works as it does when the level runs on its own.
 */
function restoreAutofocus(doc: Document | null | undefined) {
  if (!doc || (doc.activeElement && doc.activeElement !== doc.body)) return;
  for (const el of Array.from(doc.querySelectorAll<HTMLElement>('button, input, [tabindex]'))) {
    const key = Object.keys(el).find((k) => k.startsWith('__reactProps'));
    const props = key ? (el as unknown as Record<string, { autoFocus?: boolean }>)[key] : null;
    if (props?.autoFocus) { el.focus(); return; }
  }
}

type Signal = 'complete' | 'continue' | 'videoEnd';
const CANCEL = Symbol('cancel');

interface Iris { d: string; ms: number; color: string; ring: boolean }
const IRIS_OPEN = '165vmax', IRIS_PEEK = '20vmin', IRIS_SHUT = '0px';

export default function App() {
  const [level, setLevel] = useState<{ idx: number; visible: boolean } | null>(null);
  const [iris, setIris] = useState<Iris | null>({ d: IRIS_SHUT, ms: 0, color: '#fff', ring: false });
  const [won, setWon] = useState<{ hold: number; color: string } | null>(null);
  const [card, setCard] = useState<{ band: number; leaving: boolean; finale?: boolean } | null>(null);
  const [video, setVideo] = useState<{ src: string; color: string; key: number; fading: boolean } | null>(null);
  const [bloom, setBloom] = useState<{ color: string; key: number } | null>(null);

  const frameRef = useRef<HTMLIFrameElement>(null);
  const shieldRef = useRef<HTMLDivElement>(null);

  /* ---------- signals: latched, so one that fires early is not lost ---------- */
  const latched = useRef(new Set<Signal>());
  const waiter = useRef<{ kind: Signal; resolve: () => void } | null>(null);
  const signal = useCallback((kind: Signal) => {
    if (waiter.current?.kind === kind) { const w = waiter.current; waiter.current = null; w.resolve(); }
    else latched.current.add(kind);
  }, []);
  const continueFrom = useRef(0);   // input on the victory hold only counts after this time

  // a level reports a win
  useEffect(() => {
    const onMessage = (e: MessageEvent) => {
      if (e.data?.type === 'respawn:complete' && e.source && e.source === frameRef.current?.contentWindow) signal('complete');
    };
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, [signal]);

  // ENTER / SPACE / click moves on from a victory hold
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!won || (e.key !== 'Enter' && e.key !== ' ')) return;
      e.preventDefault();
      if (performance.now() >= continueFrom.current) signal('continue');
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [won, signal]);

  /* ---------- the director ---------- */
  useEffect(() => {
    let alive = true;
    const sleep = (ms: number) => new Promise<void>((res, rej) => setTimeout(() => (alive ? res() : rej(CANCEL)), ms));
    const nextFrame = () => new Promise<void>((res) => requestAnimationFrame(() => requestAnimationFrame(() => res())));
    const waitFor = (kind: Signal, timeoutMs?: number) => new Promise<void>((res, rej) => {
      const done = () => (alive ? res() : rej(CANCEL));
      if (latched.current.delete(kind)) return done();
      waiter.current = { kind, resolve: done };
      if (timeoutMs) setTimeout(() => { if (waiter.current?.kind === kind) { waiter.current = null; done(); } }, timeoutMs);
    });

    const focusLevel = () => {
      const f = frameRef.current; f?.focus(); f?.contentWindow?.focus();
      try { restoreAutofocus(f?.contentDocument); } catch { /* not ready: the player can still click */ }
    };

    async function openOnto(color: string, ms: number) {
      setIris({ d: IRIS_SHUT, ms: 0, color, ring: true });
      await nextFrame();
      sfx.irisOpen();
      setIris({ d: IRIS_OPEN, ms, color, ring: true });
      await sleep(ms + 60);
      setIris(null);
    }

    async function closeOn(color: string) {
      setIris({ d: IRIS_OPEN, ms: 0, color, ring: true });
      await nextFrame();
      sfx.irisClose();
      setIris({ d: IRIS_PEEK, ms: 720, color, ring: true });   // close to a pinhole…
      await sleep(720 + 380);                                    // …hold a beat…
      setIris({ d: IRIS_SHUT, ms: 260, color, ring: true });     // …and shut
      await sleep(300);
      setIris({ d: IRIS_SHUT, ms: 0, color, ring: false });
    }

    async function playChapter(i: number, first: boolean) {
      const ch = CHAPTERS[i];
      latched.current.delete('complete');

      if (ch.video && ch.band !== null) {
        // spectrum card: the new colour ignites
        setCard({ band: ch.band, leaving: false });
        await sleep(500); sfx.ignite(ch.band);
        await sleep(1950);
        // video, with the level loading (hidden) behind it
        latched.current.delete('videoEnd');
        setLevel({ idx: i, visible: false });
        setVideo({ src: ch.video, color: ch.color, key: i, fading: false });
        setCard({ band: ch.band, leaving: true });
        await sleep(650); setCard(null);
        await waitFor('videoEnd');
        setVideo((v) => v && { ...v, fading: true });
        await sleep(480);
        setVideo(null);
        setLevel({ idx: i, visible: true });
        setBloom({ color: ch.color, key: i });
        await openOnto(ch.color, 1150);
      } else {
        setLevel({ idx: i, visible: false });
        await sleep(first ? 700 : 350);   // give the page a moment to paint before the reveal
        setLevel({ idx: i, visible: true });
        await openOnto(ch.color, first ? 1400 : 1150);
      }
      focusLevel();

      await waitFor('complete');
      // hold on the level's own victory screen; the shield stops clicks reaching its buttons
      continueFrom.current = performance.now() + 1200;
      latched.current.delete('continue');
      setWon({ hold: ch.hold, color: ch.color });
      await nextFrame();
      shieldRef.current?.focus();
      await waitFor('continue', ch.hold);
      setWon(null);
      await closeOn(ch.color);
      setLevel(null);
      await sleep(260);
    }

    (async () => {
      const start = startChapter();
      // (1. INTRO and 2. OPENING video will play here, before the first chapter)
      for (let i = start; i < CHAPTERS.length; i++) await playChapter(i, i === start);
      // Every colour is back: the full strip lights up and rings out.
      // (18. ENDING will play from here)
      setCard({ band: 6, leaving: false, finale: true });
      await sleep(400); sfx.spectrumComplete();
    })().catch((e) => { if (e !== CANCEL) console.error(e); });

    return () => { alive = false; waiter.current = null; };
  }, []);

  const ch = level ? CHAPTERS[level.idx] : null;
  const irisStyle = iris && ({ '--d': iris.d, '--ms': `${iris.ms}ms`, '--c': iris.color } as CSSProperties);

  return (
    <div className="stage">
      {ch && (
        <iframe key={ch.id} ref={frameRef} src={ch.src} title={ch.name} className="level" allow="autoplay; fullscreen"
          style={{ visibility: level!.visible ? 'visible' : 'hidden' }} />
      )}

      {won && (
        <div ref={shieldRef} tabIndex={-1} className="shield" onClick={() => { if (performance.now() >= continueFrom.current) signal('continue'); }}>
          <ContinueHint hold={won.hold} color={won.color} />
        </div>
      )}

      {iris && <div className={`iris${iris.ring ? ' ring' : ''}`} style={irisStyle!} />}

      {video && (
        <VideoPlayer key={video.key} src={video.src} color={video.color} fading={video.fading} onEnd={() => signal('videoEnd')} />
      )}

      {card && <SpectrumCard band={card.band} leaving={card.leaving} finale={card.finale} />}

      {bloom && <Bloom key={bloom.key} color={bloom.color} onDone={() => setBloom(null)} />}
    </div>
  );
}
