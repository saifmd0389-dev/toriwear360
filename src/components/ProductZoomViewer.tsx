import React, { useState, useRef, useEffect, useCallback } from 'react';
import { ZoomIn, ZoomOut, RotateCcw, Maximize2 } from 'lucide-react';

interface ProductZoomViewerProps {
  src: string;
  alt: string;
  className?: string;
  imageClassName?: string;
  maxScale?: number;
  initialScale?: number;
  hoverZoomScale?: number;
  enableHoverMagnify?: boolean;
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

export const ProductZoomViewer: React.FC<ProductZoomViewerProps> = ({
  src,
  alt,
  className = '',
  imageClassName = 'w-full h-full object-contain',
  maxScale = 3.5,
  initialScale = 1,
  hoverZoomScale = 2.0,
  enableHoverMagnify = false,
  showToolbar = true,
  onExpandClick,
  onSwipeNext,
  onSwipePrev,
  children,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState<number>(initialScale);
  const [pan, setPan] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [originPct, setOriginPct] = useState<{ x: number; y: number }>({ x: 50, y: 50 });
  const [isHovering, setIsHovering] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

  const dragOriginRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const touchPanStartRef = useRef<{ x: number; y: number } | null>(null);
  const pinchStartDistRef = useRef<number | null>(null);
  const pinchStartScaleRef = useRef<number>(1);
  const swipeStartRef = useRef<{ x: number; y: number } | null>(null);
  const lastTapTimeRef = useRef<number>(0);

  useEffect(() => {
    setScale(initialScale);
    setPan({ x: 0, y: 0 });
    setOriginPct({ x: 50, y: 50 });
  }, [src, initialScale]);

  const clampScale = useCallback(
    (next: number) => Math.max(1, Math.min(maxScale, Number(next.toFixed(2)))),
    [maxScale]
  );

  const clampPan = useCallback(
    (nextX: number, nextY: number, activeScale: number) => {
      const rect = containerRef.current?.getBoundingClientRect();
      const maxX = rect ? (rect.width * (activeScale - 1)) / 2 : 260;
      const maxY = rect ? (rect.height * (activeScale - 1)) / 2 : 260;
      return {
        x: Math.max(-maxX, Math.min(maxX, nextX)),
        y: Math.max(-maxY, Math.min(maxY, nextY)),
      };
    },
    []
  );

  const resetZoom = useCallback(() => {
    setScale(1);
    setPan({ x: 0, y: 0 });
    setOriginPct({ x: 50, y: 50 });
    setIsDragging(false);
  }, []);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && scale > 1) {
        resetZoom();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [scale, resetZoom]);

  // Effective transform scale (supports desktop cursor-follow hover magnification when scale === 1)
  const isHoverActive = enableHoverMagnify && isHovering && scale === 1;
  const activeScale = isHoverActive ? hoverZoomScale : scale;
  const highResSrc = activeScale > 1 ? getHighResProductImageUrl(src) : src;

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const pctX = Math.max(0, Math.min(100, ((e.clientX - rect.left) / rect.width) * 100));
    const pctY = Math.max(0, Math.min(100, ((e.clientY - rect.top) / rect.height) * 100));

    if (isDragging && scale > 1) {
      const clamped = clampPan(e.clientX - dragOriginRef.current.x, e.clientY - dragOriginRef.current.y, scale);
      setPan(clamped);
      return;
    }

    setOriginPct({ x: pctX, y: pctY });
  };

  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    if (scale <= 1) return;
    e.preventDefault();
    setIsDragging(true);
    dragOriginRef.current = { x: e.clientX - pan.x, y: e.clientY - pan.y };
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const handleMouseLeave = () => {
    setIsHovering(false);
    setIsDragging(false);
    if (enableHoverMagnify && scale === 1) {
      setOriginPct({ x: 50, y: 50 });
    }
  };

  const handleWheel = (e: React.WheelEvent<HTMLDivElement>) => {
    // Allow wheel zoom on desktop only when user hovers with Ctrl/Alt or already zoomed/enableHoverMagnify
    if (!enableHoverMagnify && scale === 1 && !e.ctrlKey) return;
    e.preventDefault();
    const delta = e.deltaY < 0 ? 0.35 : -0.35;
    setScale((prev) => {
      const base = prev === 1 && isHoverActive ? hoverZoomScale : prev;
      const next = clampScale(base + delta);
      if (next <= 1) {
        setPan({ x: 0, y: 0 });
      }
      return next;
    });
  };

  const handleDoubleAction = (e?: React.SyntheticEvent) => {
    e?.stopPropagation();
    if (scale > 1.05) {
      resetZoom();
    } else {
      setScale(2.2);
      setPan({ x: 0, y: 0 });
    }
  };

  const handleTouchStart = (e: React.TouchEvent<HTMLDivElement>) => {
    const t0 = e.touches[0];
    const t1 = e.touches[1];

    if (e.touches.length === 2 && t0 && t1) {
      const dist = Math.hypot(t0.clientX - t1.clientX, t0.clientY - t1.clientY);
      pinchStartDistRef.current = dist;
      pinchStartScaleRef.current = scale;
      swipeStartRef.current = null;
      return;
    }

    if (e.touches.length === 1 && t0) {
      const now = Date.now();
      if (now - lastTapTimeRef.current < 280) {
        lastTapTimeRef.current = 0;
        handleDoubleAction(e);
        return;
      }
      lastTapTimeRef.current = now;

      if (scale > 1) {
        touchPanStartRef.current = { x: t0.clientX - pan.x, y: t0.clientY - pan.y };
        swipeStartRef.current = null;
      } else {
        swipeStartRef.current = { x: t0.clientX, y: t0.clientY };
      }
    }
  };

  const handleTouchMove = (e: React.TouchEvent<HTMLDivElement>) => {
    const t0 = e.touches[0];
    const t1 = e.touches[1];

    if (e.touches.length === 2 && t0 && t1 && pinchStartDistRef.current) {
      e.preventDefault();
      const dist = Math.hypot(t0.clientX - t1.clientX, t0.clientY - t1.clientY);
      const ratio = dist / pinchStartDistRef.current;
      const next = clampScale(pinchStartScaleRef.current * ratio);
      setScale(next);
      if (next <= 1) setPan({ x: 0, y: 0 });
      return;
    }

    if (e.touches.length === 1 && t0 && scale > 1 && touchPanStartRef.current) {
      e.preventDefault();
      const clamped = clampPan(
        t0.clientX - touchPanStartRef.current.x,
        t0.clientY - touchPanStartRef.current.y,
        scale
      );
      setPan(clamped);
    }
  };

  const handleTouchEnd = (e: React.TouchEvent<HTMLDivElement>) => {
    pinchStartDistRef.current = null;
    touchPanStartRef.current = null;

    if (scale === 1 && swipeStartRef.current && e.changedTouches[0]) {
      const dx = e.changedTouches[0].clientX - swipeStartRef.current.x;
      const dy = e.changedTouches[0].clientY - swipeStartRef.current.y;
      swipeStartRef.current = null;
      if (Math.abs(dx) > 40 && Math.abs(dx) > Math.abs(dy) * 1.2) {
        if (dx < 0) onSwipeNext?.();
        else onSwipePrev?.();
      }
    }
  };

  return (
    <div
      ref={containerRef}
      onMouseEnter={() => setIsHovering(true)}
      onMouseMove={handleMouseMove}
      onMouseDown={handleMouseDown}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseLeave}
      onWheel={handleWheel}
      onDoubleClick={handleDoubleAction}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      style={{
        touchAction: scale > 1 ? 'none' : 'pan-y',
      }}
      className={`relative overflow-hidden select-none ${
        scale > 1
          ? isDragging
            ? 'cursor-grabbing'
            : 'cursor-grab'
          : enableHoverMagnify
          ? 'cursor-crosshair'
          : 'cursor-zoom-in'
      } ${className}`}
    >
      <img
        src={highResSrc}
        alt={alt}
        referrerPolicy="no-referrer"
        style={{
          transformOrigin: scale > 1 ? '50% 50%' : `${originPct.x}% ${originPct.y}%`,
          transform:
            scale > 1
              ? `translate3d(${pan.x}px, ${pan.y}px, 0) scale(${activeScale})`
              : `scale(${activeScale})`,
          transition: isDragging || isHoverActive ? 'transform 0.08s linear' : 'transform 0.25s ease-out',
        }}
        className={`${imageClassName} pointer-events-none select-none will-change-transform`}
      />

      {children}

      {showToolbar && (
        <div
          onClick={(e) => e.stopPropagation()}
          className="absolute bottom-3 right-3 z-20 flex items-center gap-1 rounded-full bg-black/80 backdrop-blur-md border border-white/15 px-2 py-1 text-white text-[10px] font-mono shadow-lg"
        >
          <button
            type="button"
            onClick={() => {
              const next = clampScale(scale - 0.5);
              setScale(next);
              if (next <= 1) setPan({ x: 0, y: 0 });
            }}
            className="p-1 hover:text-red-400 transition cursor-pointer"
            title="Zoom Out"
            aria-label="Zoom Out"
          >
            <ZoomOut className="w-3.5 h-3.5" />
          </button>
          <span className="min-w-[36px] text-center font-bold">
            {Math.round(activeScale * 100)}%
          </span>
          <button
            type="button"
            onClick={() => setScale(clampScale(scale + 0.5))}
            className="p-1 hover:text-red-400 transition cursor-pointer"
            title="Zoom In"
            aria-label="Zoom In"
          >
            <ZoomIn className="w-3.5 h-3.5" />
          </button>
          {scale > 1 && (
            <button
              type="button"
              onClick={resetZoom}
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
