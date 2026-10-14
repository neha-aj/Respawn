/* The renderers (SVG panel + in-room monitor) read their lines from here, which
   re-exports the verified diagram, so the picture can never drift from the answer. */
import { OVERLAP_DIAGRAM } from './geometry';

export const DIAGRAM_RENDER_SEGMENTS = OVERLAP_DIAGRAM.segments;
export const DIAGRAM_SIZE = OVERLAP_DIAGRAM.size;
