import BlueLevel from './components/BlueLevel';
import { DEV_PREVIOUS_LEVEL } from './game/config';
import type { Shape } from './game/puzzle';

/** When running inside the full game, tell the host this level is done. */
function notifyComplete(level: string) {
  if (window.parent !== window) window.parent.postMessage({ type: 'respawn:complete', level }, '*');
}

/**
 * Host for the larger escape game. Level 1's result is read from
 * localStorage ('zerohour.level1.order') when the full game provides it;
 * otherwise the standalone development value is used.
 */
function readPreviousOrder(): readonly Shape[] {
  try {
    const raw = localStorage.getItem('zerohour.level1.order');
    const parsed = raw ? (JSON.parse(raw) as Shape[]) : null;
    if (Array.isArray(parsed) && parsed.length === 3) return parsed;
  } catch { /* storage unavailable or malformed */ }
  return DEV_PREVIOUS_LEVEL.geometricOrder;
}

export default function ZeroHourApp() {
  return <BlueLevel previousOrder={readPreviousOrder()} onComplete={() => notifyComplete('blue')} />;
}
