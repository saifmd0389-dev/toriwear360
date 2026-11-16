import React, { useState, useRef } from 'react';
import { Product } from '../types';
import {
  X,
  Star,
  ShoppingBag,
  Zap,
  Ruler,
  MapPin,
  Truck,
  RotateCcw,
  ShieldCheck,
  ChevronLeft,
  ChevronRight,
  Share2,
  Link,
  ZoomIn,
  Maximize2,
  Minimize2,
  Move,
} from 'lucide-react';
import { WhatsAppIcon, InstagramIcon, FacebookIcon, XTwitterIcon } from './SocialIcons';
import { TwinningBadgeButton } from './TwinningBadgeButton';
import { WishlistHeartIcon } from './WishlistHeartIcon';
import { getAuthoritativeInstagramUrl } from '../utils/socialLinks';

interface ProductGalleryModalProps {
  product: Product | null;
  isOpen: boolean;
  onClose: () => void;
  isWishlisted: boolean;
  onToggleWishlist: (product: Product) => void;
  onAddToCart: (product: Product, size: string, color: string) => void;
  onBuyNow: (product: Product, size: string, color: string) => void;
  onOpenSizeGuide: () => void;
  onOpenCombo?: (product: Product) => void;
}

export const ProductGalleryModal: React.FC<ProductGalleryModalProps> = ({
  product,
  isOpen,
  onClose,
  isWishlisted,
  onToggleWishlist,
  onAddToCart,
  onBuyNow,
  onOpenSizeGuide,
  onOpenCombo,
}) => {
  const defaultSizes = product?.sizes || (product?.department === 'KIDS' ? ['4–5Y', '6–7Y', '8–9Y'] : ['S', 'M', 'L', 'XL', 'XXL']);
  const [selectedImgIndex, setSelectedImgIndex] = useState(0);
  const [selectedSize, setSelectedSize] = useState<string>(defaultSizes[0] || 'M');
  const [selectedColor, setSelectedColor] = useState(product?.colors?.[0]?.name || 'Obsidian Black');
  const [quantity, setQuantity] = useState(1);
  const [addedNotice, setAddedNotice] = useState(false);
  const [pincode, setPincode] = useState('');
  const [deliveryResult, setDeliveryResult] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'DETAILS' | 'STORY' | 'SHIPPING'>('DETAILS');
  const [copiedLink, setCopiedLink] = useState(false);

  // 100% Zoom and Pan state
  const [zoomScale, setZoomScale] = useState<number>(1);
  const [panOffset, setPanOffset] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isFullscreenZoom, setIsFullscreenZoom] = useState(false);

  // Touch handling for phone
  const touchStartRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const touchDistRef = useRef<number | null>(null);

  // Reset selected image index and zoom when switching products
  React.useEffect(() => {
    setSelectedImgIndex(0);
    setZoomScale(1);
    setPanOffset({ x: 0, y: 0 });
    setIsFullscreenZoom(false);
  }, [product?.id, isOpen]);

  // Keyboard shortcut (Escape) to close modal or exit fullscreen zoom
  React.useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (isFullscreenZoom) {
          setIsFullscreenZoom(false);
          handleResetZoom();
        } else {
          onClose();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, isFullscreenZoom, onClose]);

  // Prevent background page scrolling when modal is open
  React.useEffect(() => {
    if (!isOpen) return;
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = originalOverflow;
    };
  }, [isOpen]);

  if (!isOpen || !product) return null;

  const imagesCount = product.images?.length || 1;

  // Enhance image URL for high resolution when zooming
  const getHighResImageUrl = (url: string, isZoomed: boolean) => {
    if (!url) return '';
    // Unsplash high quality parameter boost
    if (isZoomed && url.includes('images.unsplash.com')) {
      return url.replace(/w=\d+/, 'w=2400').replace(/q=\d+/, 'q=95');
    }
    return url;
  };

  const handlePrevImage = (e: React.MouseEvent) => {
    e.stopPropagation();
    handleResetZoom();
    setSelectedImgIndex((prev) => (prev === 0 ? imagesCount - 1 : prev - 1));
  };

  const handleNextImage = (e: React.MouseEvent) => {
    e.stopPropagation();
    handleResetZoom();
    setSelectedImgIndex((prev) => (prev === imagesCount - 1 ? 0 : prev + 1));
  };

  const handleResetZoom = () => {
    setZoomScale(1);
    setPanOffset({ x: 0, y: 0 });
    setIsDragging(false);
  };

  const handleToggle100Zoom = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    if (zoomScale === 1) {
      setZoomScale(2); // 100% native pixel inspect
      setPanOffset({ x: 0, y: 0 });
    } else if (zoomScale === 2) {
      setZoomScale(3); // 200% extreme detail
      setPanOffset({ x: 0, y: 0 });
    } else {
      handleResetZoom();
    }
  };

  // Mouse pan handlers (Desktop)
  const handleMouseDown = (e: React.MouseEvent) => {
    if (zoomScale <= 1) return;
    e.preventDefault();
    setIsDragging(true);
    setDragStart({ x: e.clientX - panOffset.x, y: e.clientY - panOffset.y });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging || zoomScale <= 1) return;
    const maxPan = (zoomScale - 1) * 220;
    const newX = Math.max(-maxPan, Math.min(maxPan, e.clientX - dragStart.x));
    const newY = Math.max(-maxPan, Math.min(maxPan, e.clientY - dragStart.y));
    setPanOffset({ x: newX, y: newY });
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  // Touch pan & pinch handlers (Phone / Mobile)
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
      const maxPan = (zoomScale - 1) * 200;
      const newX = Math.max(-maxPan, Math.min(maxPan, t0.clientX - touchStartRef.current.x));
      const newY = Math.max(-maxPan, Math.min(maxPan, t0.clientY - touchStartRef.current.y));
      setPanOffset({ x: newX, y: newY });
    } else if (e.touches.length === 2 && touchDistRef.current !== null && t0 && t1) {
      const dx = t0.clientX - t1.clientX;
      const dy = t0.clientY - t1.clientY;
      const dist = Math.hypot(dx, dy);
      const diff = dist - touchDistRef.current;
      if (Math.abs(diff) > 12) {
        if (diff > 0 && zoomScale < 3) {
          setZoomScale((prev) => Math.min(3, prev + 0.5));
        } else if (diff < 0 && zoomScale > 1) {
          setZoomScale((prev) => Math.max(1, prev - 0.5));
        }
        touchDistRef.current = dist;
      }
    }
  };

  const currentUrl = typeof window !== 'undefined' ? window.location.href : 'https://toriwear.in';
  const shareText = encodeURIComponent(`Check out ${product.name} on TORIWEAR — Original Anime Streetwear!`);

  const handleCopyLink = () => {
    navigator.clipboard?.writeText(`${currentUrl}#product-${product.id}`);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  const discountPercent = Math.round(
    ((product.originalPrice - product.price) / product.originalPrice) * 100
  );

  const handleCheckPincode = (e: React.FormEvent) => {
    e.preventDefault();
    if (pincode.trim().length === 6 && /^\d+$/.test(pincode.trim())) {
      setDeliveryResult(`Pan-India Dispatch within 24h. Expected arrival in 2–4 business days for PIN ${pincode.trim()}. Free delivery eligible!`);
    } else {
      setDeliveryResult('Please enter a valid 6-digit Indian PIN code.');
    }
  };

  const handleAdd = () => {
    for (let i = 0; i < quantity; i++) {
      onAddToCart(product, selectedSize, selectedColor);
    }
    setAddedNotice(true);
    setTimeout(() => setAddedNotice(false), 2000);
  };

  const handleBuy = () => {
    onBuyNow(product, selectedSize, selectedColor);
  };

  const hasStory = Boolean(product.storyQuote || product.character);

  const activeImageUrl = product.images[selectedImgIndex] || product.images[0] || '/assets/branding/toriwear-official-logo.png';
  const highResImageUrl = getHighResImageUrl(activeImageUrl, zoomScale > 1 || isFullscreenZoom);

  return (
    <>
      {/* Fullscreen Dedicated HD Lightbox View (When customer clicks Fullscreen) */}
      {isFullscreenZoom && (
        <div 
          style={{ zIndex: 10001 }}
          className="fixed inset-0 z-[10001] bg-black/95 flex flex-col items-center justify-between p-4 backdrop-blur-lg select-none"
        >
          {/* Top Bar */}
          <div className="w-full flex items-center justify-between z-10 px-2 py-1">
            <div className="flex items-center gap-2">
              <span className="font-heading text-sm sm:text-base font-bold text-white uppercase tracking-wider">
                {product.name}
              </span>
              <span className="text-xs font-mono px-2 py-0.5 rounded bg-neutral-800 text-[#FF2028] font-bold">
                {zoomScale === 1 ? 'FIT' : zoomScale === 2 ? '100% ZOOM' : '200% SUPER HD'}
              </span>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={handleToggle100Zoom}
                className="px-3 py-1.5 rounded-lg bg-neutral-900 border border-neutral-700 text-xs font-mono font-bold text-white hover:border-[#FF2028] transition flex items-center gap-1.5 cursor-pointer"
              >
                <ZoomIn className="w-3.5 h-3.5 text-[#FF2028]" />
                <span>{zoomScale === 1 ? '100% ZOOM' : zoomScale === 2 ? '200% HD' : 'RESET'}</span>
              </button>
              <button
                onClick={() => {
                  setIsFullscreenZoom(false);
                  handleResetZoom();
                }}
                className="min-w-[40px] min-h-[40px] flex items-center justify-center p-2 rounded-lg bg-neutral-900 border border-neutral-700 text-white hover:bg-neutral-800 transition cursor-pointer"
                aria-label="Close Fullscreen"
              >
                <Minimize2 className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Fullscreen Canvas View with Touch & Mouse Pan */}
          <div
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onDoubleClick={handleToggle100Zoom}
            className={`w-full flex-grow flex items-center justify-center overflow-hidden relative ${
              zoomScale > 1 ? (isDragging ? 'cursor-grabbing' : 'cursor-grab') : 'cursor-zoom-in'
            }`}
          >
            <img
              src={highResImageUrl}
              alt={product.name}
              referrerPolicy="no-referrer"
              style={{
                transform: `translate(${panOffset.x}px, ${panOffset.y}px) scale(${zoomScale})`,
                transition: isDragging ? 'none' : 'transform 0.25s ease-out',
                imageRendering: 'auto',
              }}
              className="max-h-[85vh] max-w-[90vw] object-contain select-none will-change-transform"
            />
          </div>

          {/* Bottom Hint */}
          <div className="text-center pb-2 text-[11px] font-mono text-neutral-400">
            {zoomScale > 1
              ? 'DRAG WITH MOUSE OR TOUCH TO PAN · DOUBLE CLICK TO RESET'
              : 'CLICK "100% ZOOM" OR DOUBLE-CLICK TO INSPECT FABRIC WEAVE & PRINT'}
          </div>
        </div>
      )}

      {/* Main Product Gallery Modal */}
      <div 
        style={{ zIndex: 9999 }}
        className="fixed inset-0 z-[9999] flex items-center justify-center p-2 sm:p-4 md:p-6 bg-black/85 backdrop-blur-md overflow-y-auto animate-in fade-in select-none"
        onClick={(e) => {
          if (e.target === e.currentTarget) {
            onClose();
          }
        }}
      >
        <div 
          id="product-detail-modal"
          onClick={(e) => e.stopPropagation()}
          className="bg-[#0f0f15] border border-neutral-800 w-full max-w-5xl rounded-2xl overflow-hidden shadow-2xl my-auto animate-in zoom-in-95 max-h-[92vh] flex flex-col text-white relative z-10"
        >
          {/* Top Sticky Header */}
          <div className="px-5 py-3.5 border-b border-neutral-800/80 bg-[#14141d] flex items-center justify-between flex-shrink-0">
            <div className="flex items-center gap-2">
              <span className="text-xs font-mono font-bold text-[#FF2028] uppercase tracking-wider">
                {product.world}
              </span>
              <span className="text-neutral-600">•</span>
              <span className="text-xs font-mono text-neutral-400">
                CATALOG #{product.catalogNumber}
              </span>
              <span className="text-neutral-600">•</span>
              <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded ${
                product.department === 'KIDS' ? 'bg-sky-500/20 text-sky-400' : 'bg-neutral-800 text-neutral-300'
              }`}>
                {product.department}
              </span>
            </div>

            <button
              id="close-product-modal-btn"
              onClick={onClose}
              className="min-w-[40px] min-h-[40px] flex items-center justify-center p-2 text-neutral-400 hover:text-white rounded-lg hover:bg-neutral-800 transition cursor-pointer"
              aria-label="Close Product Modal"
              title="Close Product Modal (Esc)"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Modal Body: Two Column Gallery & Info */}
          <div className="overflow-y-auto p-5 sm:p-7 grid grid-cols-1 lg:grid-cols-12 gap-8">
            {/* Left Column: Multi-Angle Gallery with 100% Zoom capability */}
            <div className="lg:col-span-6 space-y-4">
              <div 
                onMouseDown={handleMouseDown}
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUp}
                onMouseLeave={handleMouseUp}
                onTouchStart={handleTouchStart}
                onTouchMove={handleTouchMove}
                onDoubleClick={handleToggle100Zoom}
                className={`relative aspect-[4/5] rounded-2xl overflow-hidden bg-neutral-900 border border-neutral-800 group select-none ${
                  zoomScale > 1 ? (isDragging ? 'cursor-grabbing' : 'cursor-grab') : 'cursor-pointer'
                }`}
              >
                {/* Primary High-Resolution Product Image */}
                <img
                  src={highResImageUrl}
                  alt={`${product.name} Preview`}
                  referrerPolicy="no-referrer"
                  style={{
                    transform: `translate(${panOffset.x}px, ${panOffset.y}px) scale(${zoomScale})`,
                    transition: isDragging ? 'none' : 'transform 0.25s ease-out',
                    imageRendering: 'auto',
                  }}
                  className="w-full h-full object-cover object-center will-change-transform pointer-events-none"
                />

                {/* Badges on Top-Left */}
                <div className="absolute top-3 left-3 flex flex-col gap-1.5 pointer-events-none z-10">
                  {product.gsm && (
                    <span className="bg-black/80 backdrop-blur-sm text-neutral-200 border border-neutral-700 text-[10px] font-mono px-2 py-0.5 rounded uppercase">
                      {product.gsm} GSM
                    </span>
                  )}
                  {product.fit && (
                    <span className="bg-[#FF2028] text-white text-[10px] font-mono font-bold px-2 py-0.5 rounded uppercase shadow">
                      {product.fit}
                    </span>
                  )}
                </div>

                {/* 100% Zoom Tool Bar Floating Controls */}
                <div className="absolute top-3 right-14 z-20 flex items-center gap-1.5">
                  {/* 100% / 200% Zoom Toggle Button */}
                  <button
                    onClick={handleToggle100Zoom}
                    className={`px-2.5 py-1 rounded-full text-[10px] font-mono font-bold tracking-wider transition-all flex items-center gap-1 shadow-lg cursor-pointer ${
                      zoomScale > 1
                        ? 'bg-[#FF2028] text-white ring-2 ring-[#FF2028]/50'
                        : 'bg-black/75 hover:bg-black text-neutral-200 hover:text-white border border-neutral-700'
                    }`}
                    title="Toggle 100% Zoom Inspection"
                  >
                    <ZoomIn className="w-3.5 h-3.5 text-white" />
                    <span>{zoomScale === 1 ? '100% ZOOM' : zoomScale === 2 ? '200% HD' : 'RESET'}</span>
                  </button>

                  {/* Reset Button (only shown when zoomed) */}
                  {zoomScale > 1 && (
                    <button
                      onClick={handleResetZoom}
                      className="p-1 rounded-full bg-black/75 hover:bg-black text-neutral-300 hover:text-white border border-neutral-700 transition"
                      title="Reset Zoom"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                    </button>
                  )}

                  {/* Fullscreen Expand Button */}
                  <button
                    onClick={() => setIsFullscreenZoom(true)}
                    className="p-1.5 rounded-full bg-black/75 hover:bg-black text-neutral-200 hover:text-white border border-neutral-700 transition cursor-pointer shadow-md"
                    title="Fullscreen Zoom Inspection"
                  >
                    <Maximize2 className="w-3.5 h-3.5" />
                  </button>
                </div>

                {/* Left and Right sliding arrows (hidden when zoomed to avoid touch conflict) */}
                {imagesCount > 1 && zoomScale === 1 && (
                  <>
                    <button
                      onClick={handlePrevImage}
                      className="absolute left-2.5 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-black/70 hover:bg-black/90 text-white flex items-center justify-center backdrop-blur-md border border-neutral-700/60 transition cursor-pointer z-10 opacity-80 hover:opacity-100"
                      aria-label="Previous Image"
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </button>
                    <button
                      onClick={handleNextImage}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-black/70 hover:bg-black/90 text-white flex items-center justify-center backdrop-blur-md border border-neutral-700/60 transition cursor-pointer z-10 opacity-80 hover:opacity-100"
                      aria-label="Next Image"
                    >
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </>
                )}

                {/* Wishlist Button */}
                <button
                  onClick={() => onToggleWishlist(product)}
                  className={`absolute top-3 right-3 p-2.5 rounded-full backdrop-blur-md transition cursor-pointer z-20 ${
                    isWishlisted
                      ? 'bg-[#FF2028] text-white shadow-lg shadow-[#FF2028]/30'
                      : 'bg-black/60 text-neutral-300 hover:text-white hover:bg-black/80'
                  }`}
                  aria-label="Toggle Wishlist"
                >
                  <WishlistHeartIcon
                    active={isWishlisted}
                    resetKey={product.id}
                    className={`w-5 h-5 ${isWishlisted ? 'fill-current' : ''}`}
                  />
                </button>

                {/* Active Zoom Drag Hint Bar */}
                {zoomScale > 1 && (
                  <div className="absolute bottom-2 inset-x-0 mx-auto w-fit px-3 py-1 rounded-full bg-black/85 border border-[#FF2028]/60 text-[#FF2028] text-[10px] font-mono font-bold tracking-wider pointer-events-none flex items-center gap-1.5 shadow-xl">
                    <Move className="w-3 h-3 animate-pulse" />
                    <span>DRAG TO INSPECT FABRIC & PRINT · DOUBLE-CLICK TO FIT</span>
                  </div>
                )}
              </div>

              {/* Thumbnail Row */}
              {product.images && product.images.length > 1 && (
                <div className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar">
                  {product.images.map((img, idx) => (
                    <button
                      key={idx}
                      onClick={() => {
                        handleResetZoom();
                        setSelectedImgIndex(idx);
                      }}
                      className={`relative w-16 h-20 rounded-lg overflow-hidden border-2 transition flex-shrink-0 cursor-pointer ${
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

              {/* Original Lore Quote Box */}
              {product.storyQuote && (
                <div className="p-4 rounded-xl bg-neutral-900/80 border border-neutral-800 text-xs font-mono italic text-neutral-300">
                  <span className="text-[#FF2028] font-bold block mb-0.5 tracking-wider uppercase">
                    THE ARCHIVE STATEMENT
                  </span>
                  “{product.storyQuote}”
                </div>
              )}
            </div>

            {/* Right Column: Product Specs, Purchasing & Tabs */}
            <div className="lg:col-span-6 flex flex-col justify-between space-y-6">
              <div className="space-y-4">
                <div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-mono font-bold tracking-widest text-[#FF2028] uppercase">
                      TORIWEAR ORIGINALS // {product.world}
                    </span>
                    <div className="flex items-center gap-1 text-xs text-amber-400 font-mono">
                      <Star className="w-4 h-4 fill-amber-400" />
                      <span className="font-bold">4.9</span>
                      <span className="text-neutral-500">(128 reviews)</span>
                    </div>
                  </div>

                  <h1 className="text-2xl sm:text-3xl font-heading font-black text-white mt-1 uppercase tracking-tight">
                    {product.name}
                  </h1>

                  {/* Price Tag with Discount */}
                  <div className="mt-3 flex items-baseline gap-3">
                    <span className="text-3xl font-black font-mono text-white">
                      ₹{product.price}
                    </span>
                    {product.originalPrice > product.price && (
                      <>
                        <span className="text-base font-mono text-neutral-500 line-through">
                          ₹{product.originalPrice}
                        </span>
                        <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-400 text-xs font-mono font-bold">
                          {discountPercent}% OFF
                        </span>
                      </>
                    )}
                  </div>
                  <p className="text-[11px] text-neutral-400 font-mono mt-0.5">
                    Inclusive of all taxes. Free shipping on prepaid orders across India.
                  </p>
                </div>

                {/* Color Selector */}
                {product.colors && product.colors.length > 0 && (
                  <div>
                    <label className="block text-xs font-mono text-neutral-400 uppercase tracking-wider mb-2">
                      COLORWAY: <span className="text-white font-bold">{selectedColor}</span>
                    </label>
                    <div className="flex items-center gap-2">
                      {product.colors.map((c) => (
                        <button
                          key={c.name}
                          onClick={() => setSelectedColor(c.name)}
                          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-mono transition cursor-pointer ${
                            selectedColor === c.name
                              ? 'border-[#FF2028] bg-neutral-900 text-white'
                              : 'border-neutral-800 text-neutral-400 hover:border-neutral-600'
                          }`}
                        >
                          <span className="w-3 h-3 rounded-full border border-neutral-700" style={{ backgroundColor: c.hex }} />
                          <span>{c.name}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Size Selector with Size Guide Button */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-xs font-mono text-neutral-400 uppercase tracking-wider">
                      SELECT SIZE: <span className="text-white font-bold">{selectedSize}</span>
                    </label>
                    <button
                      onClick={onOpenSizeGuide}
                      className="text-xs font-mono text-neutral-400 hover:text-white flex items-center gap-1 underline transition cursor-pointer"
                    >
                      <Ruler className="w-3.5 h-3.5 text-[#FF2028]" />
                      <span>SIZE GUIDE</span>
                    </button>
                  </div>

                  <div className="flex items-center gap-2 flex-wrap">
                    {defaultSizes.map((size) => (
                      <button
                        key={size}
                        onClick={() => setSelectedSize(size)}
                        className={`w-12 h-10 rounded-lg font-mono font-bold text-xs flex items-center justify-center transition cursor-pointer border ${
                          selectedSize === size
                            ? 'bg-white text-black border-white shadow-lg'
                            : 'bg-neutral-900 text-neutral-300 border-neutral-800 hover:border-neutral-600'
                        }`}
                      >
                        {size}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Soft Highlight Option: Try Combo Men & Kid Pair (Same Design) */}
                {onOpenCombo && (
                  <div>
                    <TwinningBadgeButton
                      product={product}
                      onClick={() => onOpenCombo(product)}
                      variant="banner"
                      theme="dark"
                    />
                  </div>
                )}

                {/* Quantity Selector */}
                <div>
                  <label className="block text-xs font-mono text-neutral-400 uppercase tracking-wider mb-2">
                    QUANTITY
                  </label>
                  <div className="flex items-center gap-3">
                    <div className="flex items-center border border-neutral-800 rounded-lg overflow-hidden bg-neutral-900">
                      <button
                        onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                        className="px-3 py-1.5 text-neutral-400 hover:text-white transition cursor-pointer font-mono"
                      >
                        -
                      </button>
                      <span className="px-4 py-1.5 font-mono text-sm text-white font-bold">
                        {quantity}
                      </span>
                      <button
                        onClick={() => setQuantity((q) => Math.min(10, q + 1))}
                        className="px-3 py-1.5 text-neutral-400 hover:text-white transition cursor-pointer font-mono"
                      >
                        +
                      </button>
                    </div>
                  </div>
                </div>

                {/* Primary Action Buttons: ADD TO BAG & BUY NOW */}
                <div className="pt-2 flex flex-col sm:flex-row gap-3">
                  <button
                    id="modal-add-to-cart-btn"
                    onClick={handleAdd}
                    className="flex-1 py-3.5 px-6 rounded-xl bg-white hover:bg-neutral-200 text-black font-heading font-black text-sm uppercase tracking-wider transition active:scale-95 flex items-center justify-center gap-2 cursor-pointer shadow-xl shadow-white/5"
                  >
                    <ShoppingBag className="w-4 h-4" />
                    <span>{addedNotice ? 'ADDED TO BAG!' : 'ADD TO BAG'}</span>
                  </button>

                  <button
                    id="modal-buy-now-btn"
                    onClick={handleBuy}
                    className="flex-1 py-3.5 px-6 rounded-xl bg-[#FF2028] hover:bg-[#e02642] text-white font-heading font-black text-sm uppercase tracking-wider transition active:scale-95 flex items-center justify-center gap-2 cursor-pointer shadow-xl shadow-[#FF2028]/20"
                  >
                    <Zap className="w-4 h-4" />
                    <span>BUY IT NOW</span>
                  </button>
                </div>

                {/* PIN Code Delivery Checker */}
                <div className="pt-3 border-t border-neutral-800/80">
                  <label className="block text-xs font-mono text-neutral-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                    <MapPin className="w-3.5 h-3.5 text-[#FF2028]" />
                    <span>CHECK PAN-INDIA ESTIMATED DELIVERY</span>
                  </label>
                  <form onSubmit={handleCheckPincode} className="flex gap-2">
                    <input
                      type="text"
                      maxLength={6}
                      value={pincode}
                      onChange={(e) => setPincode(e.target.value.replace(/\D/g, ''))}
                      placeholder="Enter 6-digit PIN (e.g. 560001)"
                      className="flex-1 bg-neutral-900 border border-neutral-800 rounded-lg px-3 py-2 text-xs font-mono text-white focus:outline-none focus:border-[#FF2028]"
                    />
                    <button
                      type="submit"
                      className="px-4 py-2 bg-neutral-800 hover:bg-neutral-700 text-white rounded-lg text-xs font-mono font-bold transition cursor-pointer"
                    >
                      CHECK
                    </button>
                  </form>
                  {deliveryResult && (
                    <p className={`mt-2 text-xs font-mono ${deliveryResult.includes('eligible') ? 'text-emerald-400' : 'text-neutral-400'}`}>
                      {deliveryResult}
                    </p>
                  )}
                </div>

                {/* Tabs: DETAILS | STORY | SHIPPING */}
                <div className="pt-4 border-t border-neutral-800/80">
                  <div className="flex border-b border-neutral-800 gap-4 text-xs font-mono mb-3">
                    <button
                      onClick={() => setActiveTab('DETAILS')}
                      className={`pb-2 transition font-bold cursor-pointer ${
                        activeTab === 'DETAILS' ? 'text-[#FF2028] border-b-2 border-[#FF2028]' : 'text-neutral-500 hover:text-white'
                      }`}
                    >
                      SPECS & FABRIC
                    </button>
                    {hasStory && (
                      <button
                        onClick={() => setActiveTab('STORY')}
                        className={`pb-2 transition font-bold cursor-pointer ${
                          activeTab === 'STORY' ? 'text-[#FF2028] border-b-2 border-[#FF2028]' : 'text-neutral-500 hover:text-white'
                        }`}
                      >
                        ORIGINAL LORE
                      </button>
                    )}
                    <button
                      onClick={() => setActiveTab('SHIPPING')}
                      className={`pb-2 transition font-bold cursor-pointer ${
                        activeTab === 'SHIPPING' ? 'text-[#FF2028] border-b-2 border-[#FF2028]' : 'text-neutral-500 hover:text-white'
                      }`}
                    >
                      SHIPPING & RETURNS
                    </button>
                  </div>

                  {activeTab === 'DETAILS' && (
                    <div className="space-y-2 text-xs text-neutral-300 font-mono">
                      <div className="flex justify-between py-1 border-b border-neutral-900">
                        <span className="text-neutral-500">GSM Weight:</span>
                        <span className="font-bold text-white">{product.gsm} GSM French Terry / Combed Cotton</span>
                      </div>
                      <div className="flex justify-between py-1 border-b border-neutral-900">
                        <span className="text-neutral-500">Silhouette:</span>
                        <span className="font-bold text-white">{product.fit} Cut with Reinforced Ribbed Collar</span>
                      </div>
                      <div className="flex justify-between py-1 border-b border-neutral-900">
                        <span className="text-neutral-500">Printing Technique:</span>
                        <span className="font-bold text-white">High-Density Screen Print + Velvet Puff Accents</span>
                      </div>
                      <div className="flex justify-between py-1 border-b border-neutral-900">
                        <span className="text-neutral-500">Care Instructions:</span>
                        <span className="font-bold text-white">Cold machine wash inside out. Do not iron directly on print.</span>
                      </div>
                    </div>
                  )}

                  {activeTab === 'STORY' && (
                    <div className="text-xs text-neutral-300 space-y-2 leading-relaxed font-sans">
                      <p className="font-medium text-white">
                        Designed as part of the official {product.world} timeline.
                      </p>
                      {product.storyQuote && (
                        <blockquote className="border-l-2 border-[#FF2028] pl-3 italic text-neutral-300 my-2">
                          “{product.storyQuote}”
                        </blockquote>
                      )}
                      <p className="text-neutral-400 text-[11px] font-mono">
                        Every TORIWEAR garment is an authenticated artifact in our shared fiction universe.
                      </p>
                    </div>
                  )}

                  {activeTab === 'SHIPPING' && (
                    <div className="text-xs text-neutral-300 space-y-2.5 font-mono">
                      <div className="flex items-start gap-2">
                        <Truck className="w-4 h-4 text-emerald-400 flex-shrink-0 mt-0.5" />
                        <div>
                          <strong className="text-white">Free Pan-India Delivery:</strong> Dispatched in 24–48 hours from Bengaluru hub.
                        </div>
                      </div>
                      <div className="flex items-start gap-2">
                        <RotateCcw className="w-4 h-4 text-sky-400 flex-shrink-0 mt-0.5" />
                        <div>
                          <strong className="text-white">7-Day Hassle-Free Exchange:</strong> Easy doorstep reverse pickup for size changes.
                        </div>
                      </div>
                      <div className="flex items-start gap-2">
                        <ShieldCheck className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
                        <div>
                          <strong className="text-white">100% Quality Guaranteed:</strong> Zero fading, zero collar baconing.
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* Social Share Buttons */}
                <div className="pt-3 border-t border-neutral-800/80 flex items-center justify-between">
                  <span className="text-[11px] font-mono text-neutral-400 uppercase tracking-wider flex items-center gap-1.5">
                    <Share2 className="w-3.5 h-3.5 text-neutral-400" />
                    <span>SHARE THIS DROP:</span>
                  </span>

                  <div className="flex items-center gap-1.5">
                    {/* WhatsApp Direct Share */}
                    <a
                      href={`https://api.whatsapp.com/send?text=${shareText}%20${encodeURIComponent(currentUrl)}`}
                      target="_blank"
                      rel="noreferrer"
                      className="p-1.5 rounded-lg bg-neutral-900 border border-neutral-800 hover:border-[#25D366] hover:text-[#25D366] transition cursor-pointer"
                      title="Share to WhatsApp"
                      aria-label="Share to WhatsApp"
                    >
                      <WhatsAppIcon className="w-3.5 h-3.5" />
                    </a>

                    {/* Facebook Share */}
                    <a
                      href={`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(currentUrl)}`}
                      target="_blank"
                      rel="noreferrer"
                      className="p-1.5 rounded-lg bg-neutral-900 border border-neutral-800 hover:border-[#1877F2] hover:text-[#1877F2] transition cursor-pointer"
                      title="Share to Facebook"
                      aria-label="Share to Facebook"
                    >
                      <FacebookIcon className="w-3.5 h-3.5" />
                    </a>

                    {/* X / Twitter Share */}
                    <a
                      href={`https://twitter.com/intent/tweet?text=${shareText}&url=${encodeURIComponent(currentUrl)}`}
                      target="_blank"
                      rel="noreferrer"
                      className="p-1.5 rounded-lg bg-neutral-900 border border-neutral-800 hover:border-white hover:text-white transition cursor-pointer"
                      title="Share on X"
                      aria-label="Share on X"
                    >
                      <XTwitterIcon className="w-3.5 h-3.5" />
                    </a>

                    {/* Instagram Channel / Copy */}
                    <a
                      href={getAuthoritativeInstagramUrl()}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-1.5 rounded-lg bg-neutral-900 border border-neutral-800 hover:border-[#FF2028] hover:text-[#FF2028] transition cursor-pointer"
                      title="View on Instagram"
                      aria-label="Instagram"
                    >
                      <InstagramIcon className="w-3.5 h-3.5" />
                    </a>

                    {/* Copy Link Button */}
                    <button
                      onClick={handleCopyLink}
                      className="p-1.5 rounded-lg bg-neutral-900 border border-neutral-800 hover:border-amber-400 hover:text-amber-400 transition cursor-pointer flex items-center gap-1 text-[10px] font-mono"
                      title="Copy Link to Clipboard"
                      aria-label="Copy Link"
                    >
                      <Link className="w-3.5 h-3.5" />
                      <span>{copiedLink ? 'COPIED!' : 'LINK'}</span>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};
