/**
 * Pure mathematical utilities for smooth, cursor-focal image zoom and pan.
 *
 * Coordinate convention:
 * - Image element always uses `transform-origin: 50% 50%`.
 * - CSS transform is always `translate3d(x px, y px, 0) scale(scale)`.
 * - Focal coordinates `(focalX, focalY)` are measured in pixels relative to the
 *   container center `(rect.left + rect.width / 2, rect.top + rect.height / 2)`.
 */

export interface ZoomTransformState {
  scale: number;
  x: number;
  y: number;
}

export interface ContainerSize {
  width: number;
  height: number;
}

export function clampZoomScale(scale: number, minScale: number, maxScale: number): number {
  if (!Number.isFinite(scale)) return minScale;
  return Math.max(minScale, Math.min(maxScale, scale));
}

export function clampZoomPan(
  x: number,
  y: number,
  scale: number,
  size: ContainerSize
): { x: number; y: number } {
  if (!Number.isFinite(scale) || scale <= 1 || size.width <= 0 || size.height <= 0) {
    return { x: 0, y: 0 };
  }
  const maxX = Math.max(0, (size.width * (scale - 1)) / 2);
  const maxY = Math.max(0, (size.height * (scale - 1)) / 2);
  return {
    x: Math.max(-maxX, Math.min(maxX, Number.isFinite(x) ? x : 0)),
    y: Math.max(-maxY, Math.min(maxY, Number.isFinite(y) ? y : 0)),
  };
}

/**
 * Computes the next `{ scale, x, y }` state when zooming to `nextScale` around a focal point
 * `(focalX, focalY)` relative to the container center, preserving the exact image pixel
 * under the pointer/pinch midpoint.
 */
export function computeZoomTowardFocalPoint(
  current: ZoomTransformState,
  desiredScale: number,
  focalX: number,
  focalY: number,
  size: ContainerSize,
  minScale: number,
  maxScale: number
): ZoomTransformState {
  const safeCurrentScale = Math.max(minScale, current.scale || 1);
  const nextScale = clampZoomScale(desiredScale, minScale, maxScale);

  if (nextScale <= 1.0001) {
    return { scale: 1, x: 0, y: 0 };
  }

  const ratio = nextScale / safeCurrentScale;
  const rawX = focalX - (focalX - current.x) * ratio;
  const rawY = focalY - (focalY - current.y) * ratio;
  const clamped = clampZoomPan(rawX, rawY, nextScale, size);

  return {
    scale: nextScale,
    x: clamped.x,
    y: clamped.y,
  };
}

/**
 * Computes the `{ scale, x, y }` state for a two-finger touch pinch that simultaneously
 * scales around the initial midpoint `(startMidX, startMidY)` and pans to `(currentMidX, currentMidY)`.
 */
export function computePinchTransform(
  startState: ZoomTransformState,
  startDistance: number,
  currentDistance: number,
  startMidX: number,
  startMidY: number,
  currentMidX: number,
  currentMidY: number,
  size: ContainerSize,
  minScale: number,
  maxScale: number
): ZoomTransformState {
  if (!Number.isFinite(startDistance) || startDistance <= 1 || !Number.isFinite(currentDistance)) {
    return startState;
  }

  const distanceRatio = currentDistance / startDistance;
  const nextScale = clampZoomScale(startState.scale * distanceRatio, minScale, maxScale);

  if (nextScale <= 1.0001) {
    return { scale: 1, x: 0, y: 0 };
  }

  const scaleRatio = nextScale / Math.max(1, startState.scale);
  const rawX = currentMidX - (startMidX - startState.x) * scaleRatio;
  const rawY = currentMidY - (startMidY - startState.y) * scaleRatio;
  const clamped = clampZoomPan(rawX, rawY, nextScale, size);

  return {
    scale: nextScale,
    x: clamped.x,
    y: clamped.y,
  };
}

/**
 * Computes cursor-follow pan offsets when desktop hover magnification is active,
 * using the same unified `transform-origin: 50% 50%` coordinate system so transitioning
 * from hover magnification into wheel/click zoom never jumps or flips transformOrigin.
 */
export function computeHoverMagnifyTransform(
  normX: number,
  normY: number,
  hoverScale: number,
  size: ContainerSize,
  minScale: number,
  maxScale: number
): ZoomTransformState {
  const safeScale = clampZoomScale(hoverScale, minScale, maxScale);
  if (safeScale <= 1) {
    return { scale: 1, x: 0, y: 0 };
  }
  const clampedNormX = Math.max(0, Math.min(1, normX));
  const clampedNormY = Math.max(0, Math.min(1, normY));
  const maxX = (size.width * (safeScale - 1)) / 2;
  const maxY = (size.height * (safeScale - 1)) / 2;

  return {
    scale: safeScale,
    x: (0.5 - clampedNormX) * 2 * maxX,
    y: (0.5 - clampedNormY) * 2 * maxY,
  };
}

/**
 * Normalizes mouse-wheel and trackpad wheel events across browsers and OSes into a smooth,
 * multiplicative zoom factor (`> 1` to zoom in, `< 1` to zoom out).
 *
 * Returns `null` when the wheel event should be ignored (zero vertical movement or
 * horizontal-dominant trackpad swipe without `ctrlKey`).
 */
export function normalizeWheelZoomFactor(
  deltaY: number,
  deltaX: number,
  deltaMode: number,
  ctrlKey: boolean
): number | null {
  if (!Number.isFinite(deltaY) || Math.abs(deltaY) < 0.01) {
    return null;
  }

  // Ignore horizontal-dominant trackpad scrolls when not in a pinch gesture
  if (!ctrlKey && Number.isFinite(deltaX) && Math.abs(deltaX) > Math.abs(deltaY) * 1.25) {
    return null;
  }

  // Convert DOM_DELTA_LINE (1) and DOM_DELTA_PAGE (2) to approximate pixel equivalents
  let dy = deltaY;
  if (deltaMode === 1) {
    dy *= 16;
  } else if (deltaMode === 2) {
    dy *= 400;
  }

  // Clamp single-event spikes so aggressive free-spin wheels cannot jump violently
  const maxStepPx = ctrlKey ? 60 : 120;
  const clampedDy = Math.max(-maxStepPx, Math.min(maxStepPx, dy));

  // Calibrated exponential sensitivity:
  // - Trackpad pinch (ctrlKey): small deltas -> responsive 1:1 pinch scaling
  // - Mouse wheel / continuous trackpad scroll: smooth gradual progression
  const sensitivity = ctrlKey ? 0.0085 : 0.0018;
  return Math.exp(-clampedDy * sensitivity);
}

/**
 * Frame-rate-independent exponential damping step for `requestAnimationFrame`.
 */
export function dampTransformStep(
  current: ZoomTransformState,
  target: ZoomTransformState,
  dtSeconds: number,
  lambda: number
): { next: ZoomTransformState; settled: boolean } {
  const safeDt = Math.max(0, Math.min(0.05, dtSeconds));
  const alpha = 1 - Math.exp(-lambda * safeDt);

  const nextScale = current.scale + (target.scale - current.scale) * alpha;
  const nextX = current.x + (target.x - current.x) * alpha;
  const nextY = current.y + (target.y - current.y) * alpha;

  const settled =
    Math.abs(target.scale - nextScale) < 0.0008 &&
    Math.abs(target.x - nextX) < 0.15 &&
    Math.abs(target.y - nextY) < 0.15;

  if (settled) {
    return {
      next: { scale: target.scale, x: target.x, y: target.y },
      settled: true,
    };
  }

  return {
    next: { scale: nextScale, x: nextX, y: nextY },
    settled: false,
  };
}
