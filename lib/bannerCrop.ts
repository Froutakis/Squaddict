// Where a banner photo sits inside its frame. The photo always fills the frame
// (like "cover"); `focusY` picks which part of a tall photo stays in view:
// 0 = its top edge, 1 = its bottom edge, 0.5 = the middle.

export const DEFAULT_FOCUS = 0.5;

type Size = { width: number; height: number };

export type Placement = {
  width: number;
  height: number;
  left: number;
  top: number;
  // How far the photo hangs past the frame vertically; 0 means it cannot move.
  overflowY: number;
};

export function clampFocus(value: number): number {
  if (!Number.isFinite(value)) return DEFAULT_FOCUS;
  return Math.min(1, Math.max(0, value));
}

export function coverPlacement(frame: Size, photo: Size, focusY: number): Placement {
  const scale = Math.max(frame.width / photo.width, frame.height / photo.height);
  const width = photo.width * scale;
  const height = photo.height * scale;
  const overflowY = Math.max(0, height - frame.height);
  const shift = overflowY * clampFocus(focusY);

  return {
    width,
    height,
    left: (frame.width - width) / 2,
    top: shift === 0 ? 0 : -shift,
    overflowY,
  };
}

// Dragging the photo down by `dy` pixels reveals more of its top.
export function focusAfterDrag(startFocus: number, dy: number, overflowY: number): number {
  if (overflowY <= 0) return clampFocus(startFocus);
  return clampFocus(startFocus - dy / overflowY);
}
