import React, { useState, useRef, useEffect, useCallback } from 'react';
import { ZoomIn, ZoomOut, RotateCcw, Maximize2 } from 'lucide-react';
import {
  type ZoomTransformState,
  clampZoomPan,
  clampZoomScale,
  computeHoverMagnifyTransform,
  computePinchTransform,
  computeZoomTowardFocalPoint,
  dampTransformStep,
  normalizeWheelZoomFactor,
} from '../utils/zoomMath';

interface ProductZoomViewerProps {
  src: string;
  alt: string;
  className?: string;
  imageClassName?: string;
  minScale?: number;
  maxScale?: number;
  initialScale?: number;
  hoverZoomScale?: number;
  enableHoverMagnify?: boolean;
  /**
   * 'smart' (default): Prevents page scrolling only when actively zooming (trackpad pinch,
   * Ctrl+wheel, or while already zoomed/hover-magnified) and lets normal page scrolling pass through.
   * 'always': For lightbox / popout modals where page scrolling is locked and wheel always zooms.
   */
  wheelZoomMode?: 'smart' | 'always';
  showToolbar?: boolean;
  onExpandClick?: () => void;
  onSwipeNext?: () => void;
  onSwipePrev?: () => void;
  children?: React.ReactNode;
}

export function getHighResProductImageUrl(url: string): string {
  if (!url) return '';
  if (url.includes('images.unsplash.com')) {
    return url.replace(/w=\d+/, 'w=2400').replace(/q=\d+/, 'q=95');
  }
  return url;
}

function isInteractiveTarget(target: EventTarget | null): boolean {
  if (!(target instanceof Element)) return false;
  return Boolean(target.closest('button, a, input, select, textarea, [data-zoom-control="true"]'));
}

function supportsFineHoverPointer(): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    return true;
  }
  return window.matchMedia('(hover: hover) and (pointer: fine)').matches;
}

const SMOOTH_LAMBDA = 18;
const DIRECT_LAMBDA = 40;
const ZOOM_EPSILON = 0.01;
const PAGE_SCROLL_GUARD_MS = 280;
const MIN_ZOOM_INERTIA_GUARD_MS = 220;

export const ProductZoomViewer: React.FC<ProductZoomViewerProps> = ({
  src,
  alt,
  className = '',
  imageClassName = 'w-full h-full object-contain',
  minScale = 1,
  maxScale = 3.5,
  initialScale = 1,
  hoverZoomScale = 2.0,
  enableHoverMagnify = false,
  wheelZoomMode = 'smart',
  showToolbar = true,
  onExpandClick,
  onSwipeNext,
  onSwipePrev,
  children,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);

  const safeInitialScale = clampZoomScale(initialScale, minScale, maxScale);

  // Minimal React UI state (updated only on meaningful discrete changes, never per-frame)
  const [displayPercent, setDisplayPercent] = useState<number>(() => Math.round(safeInitialScale * 100));
  const [isManualZoomed, setIsManualZoomed] = useState<boolean>(() => safeInitialScale > minScale + ZOOM_EPSILON);
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [hasLoadedHighRes, setHasLoadedHighRes] = useState<boolean>(() => safeInitialScale > minScale + ZOOM_EPSILON);

  // Authoritative rAF animation state (mutated without forcing React re-renders on every input event)
  const currentRef = useRef<ZoomTransformState>({ scale: safeInitialScale, x: 0, y: 0 });
  const targetRef = useRef<ZoomTransformState>({ scale: safeInitialScale, x: 0, y: 0 });
  const rafIdRef = useRef<number | null>(null);
  const lastFrameTimeRef = useRef<number>(0);
  const activeLambdaRef = useRef<number>(SMOOTH_LAMBDA);
  const lastReportedPercentRef = useRef<number>(Math.round(safeInitialScale * 100));

  // Interaction mode refs
  const manualZoomActiveRef = useRef<boolean>(safeInitialScale > minScale + ZOOM_EPSILON);
  const hoverActiveRef = useRef<boolean>(false);
  const hoverSuppressedRef = useRef<boolean>(false);
  const isDraggingRef = useRef<boolean>(false);
  const dragOriginRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const lastTouchAtRef = useRef<number>(0);
  const lastPageScrollAtRef = useRef<number>(0);
  const zoomOutHitMinAtRef = useRef<number>(0);

  // Touch gesture refs
  const pinchStateRef = useRef<{
    startDist: number;
    startMidX: number;
    startMidY: number;
    startTransform: ZoomTransformState;
  } | null>(null);
  const touchPanStartRef = useRef<{ x: number; y: number } | null>(null);
  const swipeStartRef = useRef<{ x: number; y: number } | null>(null);
  const hadPinchInGestureRef = useRef<boolean>(false);
  const lastTapTimeRef = useRef<number>(0);

  // Keep latest callbacks in refs so native DOM listeners stay cleanly bound without churn
  const onSwipeNextRef = useRef(onSwipeNext);
  const onSwipePrevRef = useRef(onSwipePrev);
  useEffect(() => {
    onSwipeNextRef.current = onSwipeNext;
    onSwipePrevRef.current = onSwipePrev;
  }, [onSwipeNext, onSwipePrev]);

  const applyTransformToDom = useCallback((state: ZoomTransformState) => {
    const imgEl = imgRef.current;
    if (imgEl) {
      imgEl.style.transform = `translate3d(${state.x.toFixed(3)}px, ${state.y.toFixed(3)}px, 0) scale(${state.scale.toFixed(4)})`;
    }
    const nextPct = Math.round(state.scale * 100);
    if (nextPct !== lastReportedPercentRef.current) {
      lastReportedPercentRef.current = nextPct;
      setDisplayPercent(nextPct);
    }
    if (state.scale > minScale + ZOOM_EPSILON) {
      setHasLoadedHighRes((prev) => (prev ? prev : true));
    }
  }, [minScale]);

  const stopAnimation = useCallback(() => {
    if (rafIdRef.current !== null) {
      cancelAnimationFrame(rafIdRef.current);
      rafIdRef.current = null;
    }
    lastFrameTimeRef.current = 0;
  }, []);

  const scheduleAnimation = useCallback(
    (lambda: number = SMOOTH_LAMBDA) => {
      activeLambdaRef.current = lambda;
      if (rafIdRef.current !== null) return;

      const tick = (now: number) => {
        const dt = lastFrameTimeRef.current > 0 ? (now - lastFrameTimeRef.current) / 1000 : 1 / 60;
        lastFrameTimeRef.current = now;

        const { next, settled } = dampTransformStep(
          currentRef.current,
          targetRef.current,
          dt,
          activeLambdaRef.current
        );
        currentRef.current = next;
        applyTransformToDom(next);

        if (settled) {
          rafIdRef.current = null;
          lastFrameTimeRef.current = 0;
        } else {
          rafIdRef.current = requestAnimationFrame(tick);
        }
      };

      rafIdRef.current = requestAnimationFrame(tick);
    },
    [applyTransformToDom]
  );

  const setTransformImmediate = useCallback(
    (next: ZoomTransformState) => {
      stopAnimation();
      currentRef.current = { ...next };
      targetRef.current = { ...next };
      applyTransformToDom(next);
    },
    [stopAnimation, applyTransformToDom]
  );

  const setTransformTarget = useCallback(
    (next: ZoomTransformState, lambda: number = SMOOTH_LAMBDA) => {
      targetRef.current = { ...next };
      scheduleAnimation(lambda);
    },
    [scheduleAnimation]
  );

  const updateManualZoomFlag = useCallback(
    (active: boolean) => {
      manualZoomActiveRef.current = active;
      setIsManualZoomed(active);
    },
    []
  );

  const getContainerRect = useCallback(() => {
    return containerRef.current?.getBoundingClientRect() || null;
  }, []);

  const resetZoom = useCallback(
    (suppressHoverUntilLeave = true) => {
      hoverActiveRef.current = false;
      if (suppressHoverUntilLeave) {
        hoverSuppressedRef.current = true;
      }
      isDraggingRef.current = false;
      setIsDragging(false);
      updateManualZoomFlag(false);
      setTransformTarget({ scale: minScale, x: 0, y: 0 }, SMOOTH_LAMBDA);
    },
    [minScale, setTransformTarget, updateManualZoomFlag]
  );

  // Reset cleanly whenever image src or initialScale changes (e.g. gallery slide change)
  useEffect(() => {
    const clampedInit = clampZoomScale(initialScale, minScale, maxScale);
    hoverActiveRef.current = false;
    hoverSuppressedRef.current = false;
    isDraggingRef.current = false;
    pinchStateRef.current = null;
    touchPanStartRef.current = null;
    swipeStartRef.current = null;
    hadPinchInGestureRef.current = false;
    setIsDragging(false);
    setHasLoadedHighRes(clampedInit > minScale + ZOOM_EPSILON);
    updateManualZoomFlag(clampedInit > minScale + ZOOM_EPSILON);
    setTransformImmediate({ scale: clampedInit, x: 0, y: 0 });
  }, [src, initialScale, minScale, maxScale, setTransformImmediate, updateManualZoomFlag]);

  // Cleanup animation frame on unmount
  useEffect(() => {
    return () => stopAnimation();
  }, [stopAnimation]);

  // Track normal page scrolling so hover magnification never hijacks an active page scroll
  useEffect(() => {
    if (wheelZoomMode === 'always') return;
    const onWindowScroll = () => {
      lastPageScrollAtRef.current = performance.now();
    };
    window.addEventListener('scroll', onWindowScroll, { passive: true });
    return () => window.removeEventListener('scroll', onWindowScroll);
  }, [wheelZoomMode]);

  // Keep pan offsets clamped on responsive container resizes (e.g., orientation / viewport change)
  useEffect(() => {
    const el = containerRef.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(() => {
      const rect = el.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) return;
      const clampedTarget = clampZoomPan(targetRef.current.x, targetRef.current.y, targetRef.current.scale, {
        width: rect.width,
        height: rect.height,
      });
      if (clampedTarget.x !== targetRef.current.x || clampedTarget.y !== targetRef.current.y) {
        targetRef.current = {
          scale: targetRef.current.scale,
          x: clampedTarget.x,
          y: clampedTarget.y,
        };
        scheduleAnimation(SMOOTH_LAMBDA);
      }
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, [scheduleAnimation]);

  // Escape key resets zoom when zoomed in
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && (manualZoomActiveRef.current || targetRef.current.scale > minScale + ZOOM_EPSILON)) {
        resetZoom(true);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [minScale, resetZoom]);

  // Zoom around a viewport point (clientX, clientY), or center if omitted
  const zoomToScaleAtPoint = useCallback(
    (desiredScale: number, clientX?: number, clientY?: number, lambda: number = SMOOTH_LAMBDA) => {
      const rect = getContainerRect();
      const size = rect ? { width: rect.width, height: rect.height } : { width: 400, height: 400 };
      const focalX = rect && typeof clientX === 'number' ? clientX - (rect.left + rect.width / 2) : 0;
      const focalY = rect && typeof clientY === 'number' ? clientY - (rect.top + rect.height / 2) : 0;

      const next = computeZoomTowardFocalPoint(
        targetRef.current,
        desiredScale,
        focalX,
        focalY,
        size,
        minScale,
        maxScale
      );

      hoverActiveRef.current = false;
      hoverSuppressedRef.current = true;

      if (next.scale <= minScale + ZOOM_EPSILON) {
        updateManualZoomFlag(false);
        setTransformTarget({ scale: minScale, x: 0, y: 0 }, lambda);
      } else {
        updateManualZoomFlag(true);
        setTransformTarget(next, lambda);
      }
    },
    [getContainerRect, maxScale, minScale, setTransformTarget, updateManualZoomFlag]
  );

  // Native non-passive wheel & touch listeners (required so preventDefault works cleanly only when zooming/panning)
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const handleNativeWheel = (e: WheelEvent) => {
      const now = performance.now();
      const factor = normalizeWheelZoomFactor(e.deltaY, e.deltaX, e.deltaMode, e.ctrlKey);
      if (factor === null) {
        return;
      }

      const isPinchWheel = e.ctrlKey;
      const isCurrentlyZoomed =
        manualZoomActiveRef.current ||
        hoverActiveRef.current ||
        targetRef.current.scale > minScale + ZOOM_EPSILON;

      if (wheelZoomMode === 'smart') {
        // If user is in the middle of scrolling the page and not manually zoomed, never hijack scroll
        const recentlyScrolledPage = now - lastPageScrollAtRef.current < PAGE_SCROLL_GUARD_MS;
        if (!isPinchWheel && !manualZoomActiveRef.current && recentlyScrolledPage) {
          return;
        }

        // Brief inertia guard immediately after wheel-zooming back to 1.0x so trackpad momentum
        // doesn't abruptly jolt the page down at the end of a zoom-out gesture
        if (!isPinchWheel && !isCurrentlyZoomed) {
          if (e.deltaY > 0 && now - zoomOutHitMinAtRef.current < MIN_ZOOM_INERTIA_GUARD_MS) {
            e.preventDefault();
            return;
          }
          // When page is already at the very top (cannot scroll further up) and user scrolls up over the image,
          // allow smooth zoom-in without conflicting with page scrolling.
          const canZoomInAtPageTop = e.deltaY < 0 && typeof window !== 'undefined' && window.scrollY <= 1;
          if (!canZoomInAtPageTop) {
            // Not actively zoomed and not pinching: let normal page scrolling proceed uninterrupted
            return;
          }
        }
      }

      // Actively zooming: prevent unwanted page scroll and browser pinch-zoom
      e.preventDefault();

      const prevScale = targetRef.current.scale;
      const desiredScale = clampZoomScale(prevScale * factor, minScale, maxScale);

      // If already clamped at minScale in smart mode while scrolling out, allow settling cleanly
      if (desiredScale <= minScale + ZOOM_EPSILON) {
        if (prevScale > minScale + ZOOM_EPSILON) {
          zoomOutHitMinAtRef.current = now;
        }
        hoverActiveRef.current = false;
        hoverSuppressedRef.current = true;
        updateManualZoomFlag(false);
        setTransformTarget({ scale: minScale, x: 0, y: 0 }, SMOOTH_LAMBDA);
        return;
      }

      zoomToScaleAtPoint(desiredScale, e.clientX, e.clientY, SMOOTH_LAMBDA);
    };

    const handleNativeTouchStart = (e: TouchEvent) => {
      lastTouchAtRef.current = performance.now();
      if (isInteractiveTarget(e.target)) return;

      // Cancel any hover magnification on touch interaction
      if (hoverActiveRef.current) {
        hoverActiveRef.current = false;
      }

      const t0 = e.touches[0];
      const t1 = e.touches[1];

      if (e.touches.length === 2 && t0 && t1) {
        const rect = el.getBoundingClientRect();
        const cx = rect.left + rect.width / 2;
        const cy = rect.top + rect.height / 2;
        const startDist = Math.hypot(t0.clientX - t1.clientX, t0.clientY - t1.clientY);
        const startMidX = (t0.clientX + t1.clientX) / 2 - cx;
        const startMidY = (t0.clientY + t1.clientY) / 2 - cy;

        // Snapshot exact current transform to start pinch seamlessly with zero jump
        const snapshot = { ...currentRef.current };
        targetRef.current = { ...snapshot };
        pinchStateRef.current = {
          startDist: Math.max(1, startDist),
          startMidX,
          startMidY,
          startTransform: snapshot,
        };
        hadPinchInGestureRef.current = true;
        touchPanStartRef.current = null;
        swipeStartRef.current = null;
        return;
      }

      if (e.touches.length === 1 && t0) {
        hadPinchInGestureRef.current = false;
        const now = Date.now();
        if (now - lastTapTimeRef.current < 280) {
          lastTapTimeRef.current = 0;
          if (manualZoomActiveRef.current && targetRef.current.scale > minScale + 0.05) {
            resetZoom(true);
          } else {
            zoomToScaleAtPoint(Math.min(maxScale, 2.2), t0.clientX, t0.clientY, SMOOTH_LAMBDA);
          }
          swipeStartRef.current = null;
          touchPanStartRef.current = null;
          return;
        }
        lastTapTimeRef.current = now;

        if (targetRef.current.scale > minScale + ZOOM_EPSILON) {
          touchPanStartRef.current = {
            x: t0.clientX - targetRef.current.x,
            y: t0.clientY - targetRef.current.y,
          };
          swipeStartRef.current = null;
        } else {
          touchPanStartRef.current = null;
          swipeStartRef.current = { x: t0.clientX, y: t0.clientY };
        }
      }
    };

    const handleNativeTouchMove = (e: TouchEvent) => {
      lastTouchAtRef.current = performance.now();
      const t0 = e.touches[0];
      const t1 = e.touches[1];

      // Two-finger smooth focal pinch-to-zoom + simultaneous two-finger pan
      if (e.touches.length === 2 && t0 && t1 && pinchStateRef.current) {
        e.preventDefault();
        const rect = el.getBoundingClientRect();
        const cx = rect.left + rect.width / 2;
        const cy = rect.top + rect.height / 2;
        const currentDist = Math.hypot(t0.clientX - t1.clientX, t0.clientY - t1.clientY);
        const currentMidX = (t0.clientX + t1.clientX) / 2 - cx;
        const currentMidY = (t0.clientY + t1.clientY) / 2 - cy;

        const next = computePinchTransform(
          pinchStateRef.current.startTransform,
          pinchStateRef.current.startDist,
          currentDist,
          pinchStateRef.current.startMidX,
          pinchStateRef.current.startMidY,
          currentMidX,
          currentMidY,
          { width: rect.width, height: rect.height },
          minScale,
          maxScale
        );

        hoverActiveRef.current = false;
        hoverSuppressedRef.current = true;
        updateManualZoomFlag(next.scale > minScale + ZOOM_EPSILON);
        setTransformTarget(next, DIRECT_LAMBDA);
        return;
      }

      // Single-finger pan when zoomed in
      if (e.touches.length === 1 && t0 && targetRef.current.scale > minScale + ZOOM_EPSILON && touchPanStartRef.current) {
        e.preventDefault();
        const rect = el.getBoundingClientRect();
        const clamped = clampZoomPan(
          t0.clientX - touchPanStartRef.current.x,
          t0.clientY - touchPanStartRef.current.y,
          targetRef.current.scale,
          { width: rect.width, height: rect.height }
        );
        setTransformTarget(
          { scale: targetRef.current.scale, x: clamped.x, y: clamped.y },
          DIRECT_LAMBDA
        );
      }
    };

    const handleNativeTouchEnd = (e: TouchEvent) => {
      lastTouchAtRef.current = performance.now();

      // Seamless transition from 2 fingers -> 1 finger while still zoomed: re-anchor pan without jumping
      if (e.touches.length === 1 && pinchStateRef.current) {
        const remaining = e.touches[0];
        pinchStateRef.current = null;
        if (remaining && targetRef.current.scale > minScale + ZOOM_EPSILON) {
          touchPanStartRef.current = {
            x: remaining.clientX - targetRef.current.x,
            y: remaining.clientY - targetRef.current.y,
          };
        } else {
          touchPanStartRef.current = null;
        }
        return;
      }

      if (e.touches.length === 0) {
        pinchStateRef.current = null;
        touchPanStartRef.current = null;

        // Settle cleanly to 1.0x if released right near the floor
        if (targetRef.current.scale <= minScale + 0.03) {
          updateManualZoomFlag(false);
          setTransformTarget({ scale: minScale, x: 0, y: 0 }, SMOOTH_LAMBDA);
        }

        // Gallery swipe only when at 1.0x and no pinch occurred during this touch gesture
        if (
          !hadPinchInGestureRef.current &&
          targetRef.current.scale <= minScale + ZOOM_EPSILON &&
          swipeStartRef.current &&
          e.changedTouches[0]
        ) {
          const dx = e.changedTouches[0].clientX - swipeStartRef.current.x;
          const dy = e.changedTouches[0].clientY - swipeStartRef.current.y;
          swipeStartRef.current = null;
          if (Math.abs(dx) > 42 && Math.abs(dx) > Math.abs(dy) * 1.35) {
            if (dx < 0) onSwipeNextRef.current?.();
            else onSwipePrevRef.current?.();
          }
        } else {
          swipeStartRef.current = null;
        }
        hadPinchInGestureRef.current = false;
      }
    };

    // Prevent Safari native gesture zoom while pinching over the image
    const preventSafariGesture = (e: Event) => {
      e.preventDefault();
    };

    el.addEventListener('wheel', handleNativeWheel, { passive: false });
    el.addEventListener('touchstart', handleNativeTouchStart, { passive: true });
    el.addEventListener('touchmove', handleNativeTouchMove, { passive: false });
    el.addEventListener('touchend', handleNativeTouchEnd, { passive: true });
    el.addEventListener('touchcancel', handleNativeTouchEnd, { passive: true });
    el.addEventListener('gesturestart', preventSafariGesture, { passive: false });
    el.addEventListener('gesturechange', preventSafariGesture, { passive: false });

    return () => {
      el.removeEventListener('wheel', handleNativeWheel);
      el.removeEventListener('touchstart', handleNativeTouchStart);
      el.removeEventListener('touchmove', handleNativeTouchMove);
      el.removeEventListener('touchend', handleNativeTouchEnd);
      el.removeEventListener('touchcancel', handleNativeTouchEnd);
      el.removeEventListener('gesturestart', preventSafariGesture);
      el.removeEventListener('gesturechange', preventSafariGesture);
    };
  }, [maxScale, minScale, resetZoom, setTransformTarget, updateManualZoomFlag, wheelZoomMode, zoomToScaleAtPoint]);

  // Window-bound mouse drag listeners so panning stays smooth even if pointer crosses container edge
  useEffect(() => {
    if (!isDragging) return;

    const handleWindowMouseMove = (e: MouseEvent) => {
      if (!isDraggingRef.current) return;
      const rect = getContainerRect();
      if (!rect) return;
      const clamped = clampZoomPan(
        e.clientX - dragOriginRef.current.x,
        e.clientY - dragOriginRef.current.y,
        targetRef.current.scale,
        { width: rect.width, height: rect.height }
      );
      setTransformTarget(
        { scale: targetRef.current.scale, x: clamped.x, y: clamped.y },
        DIRECT_LAMBDA
      );
    };

    const handleWindowMouseUp = () => {
      isDraggingRef.current = false;
      setIsDragging(false);
    };

    window.addEventListener('mousemove', handleWindowMouseMove);
    window.addEventListener('mouseup', handleWindowMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleWindowMouseMove);
      window.removeEventListener('mouseup', handleWindowMouseUp);
    };
  }, [getContainerRect, isDragging, setTransformTarget]);

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    // Ignore synthesized mouse events right after touch input
    if (performance.now() - lastTouchAtRef.current < 500) return;
    if (isDraggingRef.current) return;

    // Desktop hover-magnify (only when enabled, not manually zoomed, not suppressed, and not mid-page-scroll)
    if (
      enableHoverMagnify &&
      !manualZoomActiveRef.current &&
      !hoverSuppressedRef.current &&
      supportsFineHoverPointer()
    ) {
      if (wheelZoomMode === 'smart' && performance.now() - lastPageScrollAtRef.current < PAGE_SCROLL_GUARD_MS) {
        return;
      }
      const rect = getContainerRect();
      if (!rect || rect.width <= 0 || rect.height <= 0) return;
      const normX = (e.clientX - rect.left) / rect.width;
      const normY = (e.clientY - rect.top) / rect.height;
      hoverActiveRef.current = true;
      const next = computeHoverMagnifyTransform(
        normX,
        normY,
        hoverZoomScale,
        { width: rect.width, height: rect.height },
        minScale,
        maxScale
      );
      setTransformTarget(next, SMOOTH_LAMBDA);
    }
  };

  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.button !== 0 || isInteractiveTarget(e.target)) return;
    if (targetRef.current.scale <= minScale + ZOOM_EPSILON) return;

    e.preventDefault();
    // If dragging from hover-magnify, seamlessly promote to manual zoom at exact current coordinates
    if (!manualZoomActiveRef.current && hoverActiveRef.current) {
      hoverActiveRef.current = false;
      hoverSuppressedRef.current = true;
      updateManualZoomFlag(true);
    }
    isDraggingRef.current = true;
    setIsDragging(true);
    dragOriginRef.current = {
      x: e.clientX - targetRef.current.x,
      y: e.clientY - targetRef.current.y,
    };
  };

  const handleMouseLeave = () => {
    // Re-enable hover magnification on next hover entry once cursor leaves
    hoverSuppressedRef.current = false;
    if (hoverActiveRef.current && !manualZoomActiveRef.current) {
      hoverActiveRef.current = false;
      setTransformTarget({ scale: minScale, x: 0, y: 0 }, SMOOTH_LAMBDA);
    }
  };

  const handleDoubleClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (isInteractiveTarget(e.target)) return;
    e.stopPropagation();
    if (manualZoomActiveRef.current && targetRef.current.scale > minScale + 0.05) {
      resetZoom(true);
    } else {
      zoomToScaleAtPoint(Math.min(maxScale, 2.2), e.clientX, e.clientY, SMOOTH_LAMBDA);
    }
  };

  const highResSrc = hasLoadedHighRes ? getHighResProductImageUrl(src) : src;

  return (
    <div
      ref={containerRef}
      onMouseMove={handleMouseMove}
      onMouseDown={handleMouseDown}
      onMouseLeave={handleMouseLeave}
      onDoubleClick={handleDoubleClick}
      style={{
        touchAction: isManualZoomed ? 'none' : 'pan-y',
      }}
      className={`relative overflow-hidden select-none ${
        isManualZoomed
          ? isDragging
            ? 'cursor-grabbing'
            : 'cursor-grab'
          : enableHoverMagnify
          ? 'cursor-crosshair'
          : 'cursor-zoom-in'
      } ${className}`}
    >
      <img
        ref={imgRef}
        src={highResSrc}
        alt={alt}
        referrerPolicy="no-referrer"
        draggable={false}
        style={{
          transformOrigin: '50% 50%',
          transform: `translate3d(${currentRef.current.x.toFixed(3)}px, ${currentRef.current.y.toFixed(3)}px, 0) scale(${currentRef.current.scale.toFixed(4)})`,
          transition: 'none',
        }}
        className={`${imageClassName} pointer-events-none select-none will-change-transform`}
      />

      {children}

      {showToolbar && (
        <div
          data-zoom-control="true"
          onClick={(e) => e.stopPropagation()}
          onDoubleClick={(e) => e.stopPropagation()}
          className="absolute bottom-3 right-3 z-20 flex items-center gap-1 rounded-full bg-black/80 backdrop-blur-md border border-white/15 px-2 py-1 text-white text-[10px] font-mono shadow-lg"
        >
          <button
            type="button"
            onClick={() => {
              const nextScale = clampZoomScale(targetRef.current.scale - 0.5, minScale, maxScale);
              zoomToScaleAtPoint(nextScale, undefined, undefined, SMOOTH_LAMBDA);
            }}
            className="p-1 hover:text-red-400 transition cursor-pointer"
            title="Zoom Out"
            aria-label="Zoom Out"
          >
            <ZoomOut className="w-3.5 h-3.5" />
          </button>
          <span className="min-w-[36px] text-center font-bold tabular-nums">
            {displayPercent}%
          </span>
          <button
            type="button"
            onClick={() => {
              const nextScale = clampZoomScale(targetRef.current.scale + 0.5, minScale, maxScale);
              zoomToScaleAtPoint(nextScale, undefined, undefined, SMOOTH_LAMBDA);
            }}
            className="p-1 hover:text-red-400 transition cursor-pointer"
            title="Zoom In"
            aria-label="Zoom In"
          >
            <ZoomIn className="w-3.5 h-3.5" />
          </button>
          {isManualZoomed && (
            <button
              type="button"
              onClick={() => resetZoom(true)}
              className="p-1 hover:text-amber-400 transition cursor-pointer"
              title="Reset Zoom"
              aria-label="Reset Zoom"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>
          )}
          {onExpandClick && (
            <button
              type="button"
              onClick={onExpandClick}
              className="p-1 hover:text-sky-400 transition cursor-pointer border-l border-white/20 pl-1.5 ml-0.5"
              title="Expand Fullscreen View"
              aria-label="Expand Fullscreen View"
            >
              <Maximize2 className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      )}
    </div>
  );
};
