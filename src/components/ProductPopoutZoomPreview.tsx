import React, { useState, useRef, useEffect } from 'react';
import {
  X,
  ZoomIn,
  RotateCcw,
  ShoppingBag,
  ArrowRight,
  Move,
  Sparkles,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { Product } from '../types';
import { WishlistHeartIcon } from './WishlistHeartIcon';

interface ProductPopoutZoomPreviewProps {
  product: Product | null;
  isOpen: boolean;
  onClose: () => void;
  isWishlisted: boolean;
  onToggleWishlist: (product: Product) => void;
  onOpenProductDetail: (product: Product) => void;
  onAddToCart: (product: Product, size: string, color: string) => void;
}

/**
 * 70% Screen Pop-Out Zoom & Inspection Overlay
 * Pops the product image out of its circle/box container to occupy at least 70% of the screen
 * with 100% native pixel zoom, touch/mouse pan dragging, angle toggles, and quick add.
 */
export const ProductPopoutZoomPreview: React.FC<ProductPopoutZoomPreviewProps> = ({
  product,
  isOpen,
  onClose,
  isWishlisted,
  onToggleWishlist,
  onOpenProductDetail,
  onAddToCart,
}) => {
  const [selectedImgIndex, setSelectedImgIndex] = useState(0);
  const [zoomScale, setZoomScale] = useState<number>(1);
  const [panOffset, setPanOffset] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [selectedSize, setSelectedSize] = useState<string>(
    product?.sizes?.[0] || (product?.department === 'KIDS' ? '6–7Y' : 'L')
  );
  const [addedToast, setAddedToast] = useState(false);

  // Touch handling
  const touchStartRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const touchDistRef = useRef<number | null>(null);

  // Reset image index & zoom when switching products
  useEffect(() => {
    setSelectedImgIndex(0);
    setZoomScale(1);
    setPanOffset({ x: 0, y: 0 });
  }, [product?.id, isOpen]);

  // Keyboard shortcut (Escape) to close preview
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Prevent background page scrolling when popout zoom preview is open
  useEffect(() => {
    if (!isOpen) return;
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = originalOverflow;
    };
  }, [isOpen]);

  if (!isOpen || !product) return null;

  const imagesCount = product.images?.length || 1;
  const currentImage = product.images?.[selectedImgIndex] || product.images?.[0] || '';

  // Get high-res URL if using Unsplash
  const highResUrl = currentImage.includes('images.unsplash.com')
    ? currentImage.replace(/w=\d+/, 'w=2400').replace(/q=\d+/, 'q=95')
    : currentImage;

  const handleResetZoom = () => {
    setZoomScale(1);
    setPanOffset({ x: 0, y: 0 });
    setIsDragging(false);
  };

  const handleToggleZoom = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    if (zoomScale === 1) {
      setZoomScale(2); // 100% native zoom
      setPanOffset({ x: 0, y: 0 });
    } else if (zoomScale === 2) {
      setZoomScale(3); // 200% extreme zoom
      setPanOffset({ x: 0, y: 0 });
    } else {
      handleResetZoom();
    }
  };

  // Mouse pan (Desktop)
  const handleMouseDown = (e: React.MouseEvent) => {
    if (zoomScale <= 1) return;
    e.preventDefault();
    setIsDragging(true);
    setDragStart({ x: e.clientX - panOffset.x, y: e.clientY - panOffset.y });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging || zoomScale <= 1) return;
    const maxPan = (zoomScale - 1) * 260;
    const newX = Math.max(-maxPan, Math.min(maxPan, e.clientX - dragStart.x));
    const newY = Math.max(-maxPan, Math.min(maxPan, e.clientY - dragStart.y));
    setPanOffset({ x: newX, y: newY });
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  // Touch pan & pinch (Phone)
  const handleTouchStart = (e: React.TouchEvent) => {
    const t0 = e.touches[0];
    const t1 = e.touches[1];
    if (e.touches.length === 1 && zoomScale > 1 && t0) {
      touchStartRef.current = {
        x: t0.clientX - panOffset.x,
        y: t0.clientY - panOffset.y,
      };
    } else if (e.touches.length === 2 && t0 && t1) {
      const dx = t0.clientX - t1.clientX;
      const dy = t0.clientY - t1.clientY;
      touchDistRef.current = Math.hypot(dx, dy);
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    const t0 = e.touches[0];
    const t1 = e.touches[1];
    if (e.touches.length === 1 && zoomScale > 1 && t0) {
      const maxPan = (zoomScale - 1) * 220;
      const newX = Math.max(-maxPan, Math.min(maxPan, t0.clientX - touchStartRef.current.x));
      const newY = Math.max(-maxPan, Math.min(maxPan, t0.clientY - touchStartRef.current.y));
      setPanOffset({ x: newX, y: newY });
    } else if (e.touches.length === 2 && touchDistRef.current !== null && t0 && t1) {
      const dx = t0.clientX - t1.clientX;
      const dy = t0.clientY - t1.clientY;
      const dist = Math.hypot(dx, dy);
      const diff = dist - touchDistRef.current;
      if (Math.abs(diff) > 10) {
        if (diff > 0 && zoomScale < 3) setZoomScale((prev) => Math.min(3, prev + 0.5));
        else if (diff < 0 && zoomScale > 1) setZoomScale((prev) => Math.max(1, prev - 0.5));
        touchDistRef.current = dist;
      }
    }
  };

  const handleQuickAdd = () => {
    onAddToCart(product, selectedSize, product.colors?.[0]?.name || 'Standard');
    setAddedToast(true);
    setTimeout(() => setAddedToast(false), 2000);
  };

  return (
    <div 
      style={{ zIndex: 9999 }}
      className="fixed inset-0 z-[9999] flex items-center justify-center p-3 sm:p-6 bg-black/85 backdrop-blur-md animate-in fade-in select-none"
      onClick={onClose}
    >
      {/* 70% SCREEN POPOUT CONTAINER */}
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative w-[92vw] sm:w-[82vw] lg:w-[74vw] h-[85vh] sm:h-[78vh] lg:h-[74vh] bg-[#0c0d12] border-2 border-[#FF2028]/40 rounded-3xl overflow-hidden shadow-[0_0_50px_rgba(255,46,77,0.3)] flex flex-col lg:flex-row text-white animate-in zoom-in-95"
      >
        {/* ======================================================= */}
        {/* LEFT / MAIN STAGE: 70%+ Image Canvas with 100% Zoom Pan */}
        {/* ======================================================= */}
        <div 
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onDoubleClick={handleToggleZoom}
          className={`relative flex-1 h-full bg-[#111218] flex items-center justify-center overflow-hidden ${
            zoomScale > 1 ? (isDragging ? 'cursor-grabbing' : 'cursor-grab') : 'cursor-zoom-in'
          }`}
        >
          {/* Large High-Resolution Image */}
          <img
            src={highResUrl}
            alt={product.name}
            referrerPolicy="no-referrer"
            style={{
              transform: `translate(${panOffset.x}px, ${panOffset.y}px) scale(${zoomScale})`,
              transition: isDragging ? 'none' : 'transform 0.2s ease-out',
              imageRendering: 'auto',
            }}
            className="w-full h-full object-contain p-2 sm:p-4 select-none will-change-transform pointer-events-none"
          />

          {/* Top Floating Inspection HUD */}
          <div className="absolute top-4 left-4 z-20 flex items-center gap-2 pointer-events-auto">
            <span className="bg-[#FF2028] text-white text-[10px] font-mono font-bold px-2.5 py-1 rounded-full uppercase tracking-wider shadow-lg flex items-center gap-1.5">
              <Sparkles className="w-3 h-3 text-white" />
              <span>70% SCREEN VIEW</span>
            </span>

            {product.gsm && (
              <span className="bg-black/80 backdrop-blur-md text-neutral-300 text-[10px] font-mono px-2.5 py-1 rounded-full border border-neutral-700">
                {product.gsm} GSM
              </span>
            )}
          </div>

          {/* Floating Zoom Action Toolbar */}
          <div className="absolute top-4 right-4 z-20 flex items-center gap-2 pointer-events-auto">
            {/* 100% Zoom Button */}
            <button
              onClick={handleToggleZoom}
              className={`px-3 py-1.5 rounded-full text-xs font-mono font-bold tracking-wider transition-all flex items-center gap-1.5 shadow-xl cursor-pointer ${
                zoomScale > 1
                  ? 'bg-[#FF2028] text-white ring-2 ring-[#FF2028]/50'
                  : 'bg-black/80 hover:bg-black text-neutral-200 hover:text-white border border-neutral-700'
              }`}
              title="Toggle 100% Zoom"
            >
              <ZoomIn className="w-4 h-4 text-[#FF2028]" />
              <span>{zoomScale === 1 ? '100% ZOOM' : zoomScale === 2 ? '200% HD' : 'RESET'}</span>
            </button>

            {/* Reset Button */}
            {zoomScale > 1 && (
              <button
                onClick={handleResetZoom}
                className="p-1.5 rounded-full bg-black/80 hover:bg-black text-neutral-300 hover:text-white border border-neutral-700 transition"
                title="Reset Zoom"
              >
                <RotateCcw className="w-4 h-4" />
              </button>
            )}

            {/* Wishlist Button */}
            <button
              onClick={() => onToggleWishlist(product)}
              className={`p-2 rounded-full backdrop-blur-md transition cursor-pointer shadow-lg ${
                isWishlisted
                  ? 'bg-[#FF2028] text-white'
                  : 'bg-black/80 text-neutral-300 hover:text-white border border-neutral-700'
              }`}
              aria-label="Wishlist"
            >
              <WishlistHeartIcon
                active={isWishlisted}
                resetKey={product.id}
                className={`w-4 h-4 ${isWishlisted ? 'fill-current' : ''}`}
              />
            </button>

            {/* Mobile Close Button */}
            <button
              onClick={onClose}
              className="lg:hidden min-w-[40px] min-h-[40px] flex items-center justify-center p-2 rounded-full bg-black/80 text-neutral-400 hover:text-white border border-neutral-700 transition cursor-pointer"
              aria-label="Close Preview"
              title="Close Preview (Esc)"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Left/Right Angle Buttons */}
          {imagesCount > 1 && zoomScale === 1 && (
            <>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setSelectedImgIndex((prev) => (prev === 0 ? imagesCount - 1 : prev - 1));
                  handleResetZoom();
                }}
                className="absolute left-3 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-black/75 hover:bg-black text-white flex items-center justify-center border border-neutral-700 transition cursor-pointer z-20"
                aria-label="Previous Image"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setSelectedImgIndex((prev) => (prev === imagesCount - 1 ? 0 : prev + 1));
                  handleResetZoom();
                }}
                className="absolute right-3 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-black/75 hover:bg-black text-white flex items-center justify-center border border-neutral-700 transition cursor-pointer z-20"
                aria-label="Next Image"
              >
                <ChevronRight className="w-5 h-5" />
              </button>
            </>
          )}

          {/* Hint Overlay at bottom of canvas */}
          <div className="absolute bottom-3 inset-x-0 mx-auto w-fit px-3 py-1 rounded-full bg-black/85 backdrop-blur-md border border-neutral-800 text-[10px] font-mono text-neutral-400 pointer-events-none flex items-center gap-1.5 shadow-xl">
            {zoomScale > 1 ? (
              <>
                <Move className="w-3 h-3 text-[#FF2028] animate-pulse" />
                <span className="text-[#FF2028] font-bold">DRAG TO INSPECT FABRIC · DOUBLE CLICK TO FIT</span>
              </>
            ) : (
              <span>DOUBLE-CLICK OR CLICK "100% ZOOM" TO ENLARGE FABRIC WEAVE</span>
            )}
          </div>
        </div>

        {/* ======================================================= */}
        {/* RIGHT SIDEBAR: Product Lore, Sizing, Quick Add, Close   */}
        {/* ======================================================= */}
        <div className="w-full lg:w-80 bg-[#14151e] border-t lg:border-t-0 lg:border-l border-neutral-800 p-4 sm:p-6 flex flex-col justify-between overflow-y-auto">
          {/* Header & Title */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] font-mono font-bold text-[#FF2028] uppercase tracking-widest">
                {product.world}
              </span>
              <button
                onClick={onClose}
                className="hidden lg:flex min-w-[40px] min-h-[40px] items-center justify-center p-2 text-neutral-400 hover:text-white rounded-lg hover:bg-neutral-800 transition cursor-pointer"
                aria-label="Close Preview"
                title="Close Preview (Esc)"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <h3 className="font-heading text-lg sm:text-xl font-black text-white uppercase tracking-tight">
              {product.name}
            </h3>

            {/* Price */}
            <div className="mt-2 flex items-baseline gap-2">
              <span className="font-mono text-xl sm:text-2xl font-black text-white">
                ₹{product.price}
              </span>
              {product.originalPrice > product.price && (
                <span className="font-mono text-xs text-neutral-500 line-through">
                  ₹{product.originalPrice}
                </span>
              )}
            </div>

            <p className="mt-2 text-xs text-neutral-400 font-sans line-clamp-3 leading-relaxed">
              {product.description}
            </p>

            {/* Thumbnail Row */}
            {product.images && product.images.length > 1 && (
              <div className="mt-4 flex items-center gap-2">
                {product.images.map((img, idx) => (
                  <button
                    key={idx}
                    onClick={() => {
                      setSelectedImgIndex(idx);
                      handleResetZoom();
                    }}
                    className={`relative w-12 h-14 rounded-lg overflow-hidden border-2 transition cursor-pointer ${
                      selectedImgIndex === idx
                        ? 'border-[#FF2028] shadow-md shadow-[#FF2028]/30'
                        : 'border-neutral-800 opacity-60 hover:opacity-100'
                    }`}
                  >
                    <img src={img} alt="" referrerPolicy="no-referrer" className="w-full h-full object-cover" />
                  </button>
                ))}
              </div>
            )}

            {/* Size Selector */}
            <div className="mt-4">
              <span className="block text-[11px] font-mono text-neutral-400 uppercase tracking-wider mb-1.5">
                SIZE: <strong className="text-white">{selectedSize}</strong>
              </span>
              <div className="flex items-center gap-1.5 flex-wrap">
                {(product.sizes || ['S', 'M', 'L', 'XL']).map((sz) => (
                  <button
                    key={sz}
                    onClick={() => setSelectedSize(sz)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-mono font-bold transition cursor-pointer border ${
                      selectedSize === sz
                        ? 'bg-white text-black border-white shadow'
                        : 'bg-neutral-900 text-neutral-300 border-neutral-800 hover:border-neutral-600'
                    }`}
                  >
                    {sz}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Action CTAs */}
          <div className="mt-6 pt-4 border-t border-neutral-800 space-y-2.5">
            {/* Quick Add */}
            <button
              onClick={handleQuickAdd}
              className="w-full py-3 px-4 rounded-xl bg-white hover:bg-neutral-200 text-black font-heading font-black text-xs uppercase tracking-wider transition active:scale-95 flex items-center justify-center gap-2 cursor-pointer shadow-lg shadow-white/5"
            >
              <ShoppingBag className="w-4 h-4" />
              <span>{addedToast ? 'ADDED TO BAG!' : 'QUICK ADD TO BAG'}</span>
            </button>

            {/* View Full Product Gallery */}
            <button
              onClick={() => {
                onClose();
                onOpenProductDetail(product);
              }}
              className="w-full py-3 px-4 rounded-xl bg-neutral-900 hover:bg-neutral-800 text-neutral-200 hover:text-white border border-neutral-700 hover:border-[#FF2028] font-heading font-bold text-xs uppercase tracking-wider transition flex items-center justify-center gap-2 cursor-pointer"
            >
              <span>FULL DETAILS & ARCHIVE</span>
              <ArrowRight className="w-3.5 h-3.5 text-[#FF2028]" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
