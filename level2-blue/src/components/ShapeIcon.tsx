import type { Shape } from '../game/puzzle';

const POINTS: Record<Shape, string> = {
  TRIANGLE: '8,1 15,15 1,15',
  SQUARE: '2,2 14,2 14,14 2,14',
  PENTAGON: '8,1 15,6 12,15 4,15 1,6',
};

/** Crisp SVG version of the in-world shape icons (blue only). */
export function ShapeIcon({ shape, size = 16, bright = false }: { shape: Shape; size?: number; bright?: boolean }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" aria-label={shape.toLowerCase()} role="img" shapeRendering="crispEdges">
      <polygon points={POINTS[shape]} fill={bright ? '#52C7FF' : '#1769C2'} stroke="#E4F5FF" strokeWidth="1.5" strokeLinejoin="miter" />
    </svg>
  );
}
