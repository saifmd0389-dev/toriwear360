/**
 * Hysteresis scroll-state helper for the sticky/fixed TORI-WEAR header.
 *
 * Uses a wide deadband between `enterThreshold` and `exitThreshold` so that
 * stopping near the threshold, trackpad micro-bounce, fractional DPR scroll
 * positions, or mobile overscroll rubber-banding never cause rapid state toggling.
 */

export const HEADER_SCROLL_ENTER_PX = 60;
export const HEADER_SCROLL_EXIT_PX = 20;

export function computeNextHeaderScrolledState(
  currentlyScrolled: boolean,
  rawScrollY: number,
  enterThreshold: number = HEADER_SCROLL_ENTER_PX,
  exitThreshold: number = HEADER_SCROLL_EXIT_PX
): boolean {
  const safeY = Number.isFinite(rawScrollY) ? Math.max(0, rawScrollY) : 0;

  if (!currentlyScrolled) {
    return safeY >= enterThreshold;
  }

  return safeY > exitThreshold;
}
