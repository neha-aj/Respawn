/* Room geometry in internal pixels (480 × 270). Shared by engine, renderer and UI overlays. */
import type { Rect } from './physics';
import type { WeightId } from './puzzle';

export const FLOOR_Y = 226;
export const WALL_L = 14;
export const WALL_R = 466;

export const CONSOLE = { x: 30, y: 160, w: 48, h: 66, screen: { x: 34, y: 166, w: 40, h: 30 } };
export const BALANCE = { x: 120, w: 182, barY: 92, pivotY: 112, arm: 22, chain: 22, scales: { A: 150, B: 211, C: 272 } as Record<WeightId, number> };
/** High enough to walk under (body top = FLOOR_Y − 40), low enough to jump onto. */
export const LEDGE: Rect = { x: 352, y: 174, w: 52, h: 6 };
/** Pressure plates: A sits on the ledge (needs a jump), B and C on the floor. */
export const PLATES: Record<WeightId, { x: number; y: number; w: number }> = {
  B: { x: 312, y: FLOOR_Y, w: 20 },
  A: { x: 368, y: LEDGE.y, w: 20 },
  C: { x: 422, y: FLOOR_Y, w: 20 },
};
export const DOOR = { x: WALL_R, y: 160, w: 14, h: FLOOR_Y - 160 };

/* Level 3 — wall monitor showing the Overlap Trap diagram. */
export const MONITOR = { x: 150, y: 26, w: 180, h: 128, standW: 12 };
/* Level 4 — 4×4 lock panel and the final escape terminal beside the door. */
export const LOCK_PANEL = { x: 150, y: 22, w: 150, h: 160, tile: 30, gap: 4 };
export const TERMINAL = { x: 388, y: 160, w: 44, h: 66 };

export const SPAWN = { x: 92, y: FLOOR_Y - 40 };
export const BODY_W = 12, BODY_H = 40;

export const SOLIDS_BASE: Rect[] = [
  { x: 0, y: FLOOR_Y, w: 480, h: 44 },
  { x: 0, y: 0, w: WALL_L, h: 270 },
  { x: WALL_R, y: 0, w: 14, h: DOOR.y },
  LEDGE,
];
