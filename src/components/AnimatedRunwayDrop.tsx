import React, { useState, useEffect } from 'react';
import { Product } from '../types';
import { ShoppingBag, Eye, ArrowRight, Play, Pause, Check } from 'lucide-react';

interface RunwayItem {
  id: string;
  title: string;
  universe: string;
  subtitle: string;
  gsm: number;
  fit: string;
  price: number;
  originalPrice: number;
  image: string;
  detailImage: string;
  auraColor: string;
  accentHex: string;
  description: string;
  productId: string;
}

const RUNWAY_DROPS: RunwayItem[] = [
  {
    id: 'runway-1',
    title: 'SHADOW MONARCH TEE',
    universe: 'ANIMEVERSE // SOLO LEVELING',
    subtitle: 'Arise in heavyweight darkness.',
    gsm: 240,
    fit: 'Drop-Shoulder Boxy Fit',
    price: 1199,
    originalPrice: 1699,
    image: 'https://images.unsplash.com/photo-1521572267360-ee0c2909d518?w=900&auto=format&fit=crop&q=80',
    detailImage: 'https://images.unsplash.com/photo-1503342217505-b0a15ec3261c?w=900&auto=format&fit=crop&q=80',
    auraColor: 'rgba(255, 46, 77, 0.4)',
    accentHex: '#FF2028',
    description: 'High-density screen print with shadowy spectral blue energy. 240 GSM 100% combed cotton that holds its boxy streetwear frame through endless wash cycles.',
    productId: 'tori-001',
  },
  {
    id: 'runway-2',
    title: 'SUPER SAIYAN AURA TEE',
    universe: 'ANIMEVERSE // DRAGON BALL',
    subtitle: 'Ascended golden energy.',
    gsm: 260,
    fit: 'Heavyweight Boxy Cut',
    price: 1299,
    originalPrice: 1799,
    image: 'https://images.unsplash.com/photo-1576566588028-4147f3842f27?w=900&auto=format&fit=crop&q=80',
    detailImage: 'https://images.unsplash.com/photo-1503342217505-b0a15ec3261c?w=900&auto=format&fit=crop&q=80',
    auraColor: 'rgba(245, 158, 11, 0.4)',
    accentHex: '#f59e0b',
    description: 'Ultra-heavy 260 GSM Japanese combed cotton with vivid golden electric discharge art. Built wide at the chest with dropped armholes for authentic Harajuku aesthetics.',
    productId: 'tori-007',
  },
  {
    id: 'runway-3',
    title: 'SYMBIOTE REIGN OVERSIZED TEE',
    universe: 'HEROVERSE // MARVEL PARTNER',
    subtitle: 'We are Venom. Pure symbiote power.',
    gsm: 240,
    fit: 'Super Oversized Fit',
    price: 1299,
    originalPrice: 1899,
    image: 'https://images.unsplash.com/photo-1583743814966-8936f5b7be1a?w=900&auto=format&fit=crop&q=80',
    detailImage: 'https://images.unsplash.com/photo-1618354691373-d851c5c3a990?w=900&auto=format&fit=crop&q=80',
    auraColor: 'rgba(225, 29, 72, 0.4)',
    accentHex: '#e11d48',
    description: 'Officially licensed Marvel capsule. Features tendril gloss-varnish print over charcoal acid-washed cotton that gives each garment a one-of-a-kind vintage texture.',
    productId: 'tori-marvel-01',
  },
  {
    id: 'runway-4',
    title: 'THE DARK KNIGHT GOTHAM SHADOW',
    universe: 'DC UNIVERSE // GOTHAM NIGHTS',
    subtitle: 'Vengeance in the shadows.',
    gsm: 240,
    fit: 'Drop-Shoulder Boxy Fit',
    price: 1299,
    originalPrice: 1799,
    image: 'https://images.unsplash.com/photo-1554568218-0f1715e72254?w=900&auto=format&fit=crop&q=80',
    detailImage: 'https://images.unsplash.com/photo-1503342217505-b0a15ec3261c?w=900&auto=format&fit=crop&q=80',
    auraColor: 'rgba(56, 189, 248, 0.35)',
    accentHex: '#38bdf8',
    description: 'Licensed DC capsule piece. Distressed chest bat insignia with Tokyo typography across the spine. Ribbed 1.2-inch collar that never sags.',
    productId: 'tori-dc-01',
  },
  {
    id: 'runway-5',
    title: 'CYBER RONIN: REN & KAI',
    universe: 'TORI ORIGINALS // PROPRIETARY IP',
    subtitle: 'Born in the Tori Universe Chapter 01.',
    gsm: 260,
    fit: 'Signature Oversized Cut',
    price: 1399,
    originalPrice: 1999,
    image: 'https://images.unsplash.com/photo-1503342217505-b0a15ec3261c?w=900&auto=format&fit=crop&q=80',
    detailImage: 'https://images.unsplash.com/photo-1521572267360-ee0c2909d518?w=900&auto=format&fit=crop&q=80',
    auraColor: 'rgba(168, 85, 247, 0.4)',
    accentHex: '#a855f7',
    description: 'Flagship original character release. High-density metallic foil and soft-feel silkscreen of Ren wielding his dual plasma blades in Neo-Shibuya.',
    productId: 'tori-orig-01',
  },
];

interface AnimatedRunwayDropProps {
  products: Product[];
  onSelectProduct: (product: Product) => void;
  onQuickAddToCart: (product: Product, size: 'S' | 'M' | 'L' | 'XL' | 'XXL' | 'XXXL') => void;
}

export const AnimatedRunwayDrop: React.FC<AnimatedRunwayDropProps> = ({
  products,
  onSelectProduct,
  onQuickAddToCart,
}) => {
  const [activeIndex, setActiveIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(true);
  const [zoomMode, setZoomMode] = useState(false);
  const [added, setAdded] = useState(false);

  const current = RUNWAY_DROPS[activeIndex] ?? RUNWAY_DROPS[0];

  // 5-second automatic loop rotation
  useEffect(() => {
    if (!isPlaying) return;
    const timer = setInterval(() => {
      setActiveIndex((prev) => (prev + 1) % RUNWAY_DROPS.length);
      setZoomMode(false);
    }, 5500);

    return () => clearInterval(timer);
  }, [isPlaying]);

  if (!current) return null;

  const handleQuickAdd = () => {
    const matchedProduct = products.find((p) => p.id === current.productId) || products[0];
    if (!matchedProduct) return;
    onQuickAddToCart(matchedProduct, 'L');
    setAdded(true);
    setTimeout(() => setAdded(false), 2000);
  };

  const handleOpenDetails = () => {
    const matchedProduct = products.find((p) => p.id === current.productId) || products[0];
    if (!matchedProduct) return;
    onSelectProduct(matchedProduct);
  };

  return (
    <section 
      id="runway-drop-section" 
      className="py-16 sm:py-24 px-4 sm:px-6 lg:px-8 bg-[#0b0b10] border-b border-neutral-800/80 relative overflow-hidden"
    >
      {/* Dynamic Background Aura */}
      <div 
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[600px] blur-[180px] pointer-events-none rounded-full transition-all duration-1000"
        style={{ backgroundColor: current.auraColor }}
      />

      <div className="max-w-7xl mx-auto relative z-10">
        {/* Section Header */}
        <div className="flex flex-col md:flex-row md:items-end justify-between mb-8 sm:mb-12 gap-4">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#FF2028]/10 border border-[#FF2028]/30 text-[#FF2028] text-xs font-mono uppercase tracking-widest mb-3">
              <span className="w-2 h-2 rounded-full bg-[#FF2028] animate-ping" />
              <span>THE DROP // 4-6S RUNWAY SHOWCASE</span>
            </div>

            <h2 className="font-heading text-4xl sm:text-6xl font-black uppercase text-white tracking-tight leading-none">
              ANIMATED PRODUCT <br />
              <span 
                className="transition-colors duration-700"
                style={{ color: current.accentHex }}
              >
                RUNWAY.
              </span>
            </h2>
          </div>

          {/* Runway Controls */}
          <div className="flex items-center gap-3">
            <button
              onClick={() => setIsPlaying(!isPlaying)}
              className="p-2.5 rounded-xl bg-[#14141d] border border-neutral-800 hover:border-neutral-700 text-neutral-300 hover:text-white transition flex items-center gap-2 text-xs font-mono"
            >
              {isPlaying ? <Pause className="w-4 h-4 text-emerald-400" /> : <Play className="w-4 h-4 text-amber-400" />}
              <span>{isPlaying ? 'PAUSE LOOP' : 'PLAY LOOP'}</span>
            </button>

            <button
              onClick={() => setZoomMode(!zoomMode)}
              className="p-2.5 rounded-xl bg-[#14141d] border border-neutral-800 hover:border-neutral-700 text-neutral-300 hover:text-white transition flex items-center gap-2 text-xs font-mono"
            >
              <Eye className="w-4 h-4 text-[#FF2028]" />
              <span>{zoomMode ? 'FULL FIT' : 'ZOOM GRAPHIC'}</span>
            </button>
          </div>
        </div>

        {/* Drop Navigation Tabs */}
        <div className="flex items-center gap-2 overflow-x-auto pb-4 mb-8 scrollbar-none">
          {RUNWAY_DROPS.map((drop, idx) => (
            <button
              key={drop.id}
              onClick={() => {
                setActiveIndex(idx);
                setZoomMode(false);
              }}
              className={`px-4 py-2 rounded-xl text-xs font-mono font-bold uppercase whitespace-nowrap transition-all duration-300 flex items-center gap-2 shrink-0 ${
                activeIndex === idx
                  ? 'bg-[#181824] text-white border-b-2 shadow-lg'
                  : 'bg-[#101017] text-neutral-400 hover:text-neutral-200 border border-neutral-800/80'
              }`}
              style={{
                borderColor: activeIndex === idx ? drop.accentHex : undefined,
              }}
            >
              <span 
                className="w-2 h-2 rounded-full" 
                style={{ backgroundColor: drop.accentHex }} 
              />
              <span>{drop.title}</span>
            </button>
          ))}
        </div>

        {/* Cinematic Runway Stage Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center bg-[#101017]/80 rounded-3xl border border-neutral-800/80 p-4 sm:p-8 backdrop-blur-xl shadow-2xl">
          {/* Left Visual Model Loop */}
          <div className="lg:col-span-7 relative aspect-[4/5] sm:aspect-[16/11] rounded-2xl overflow-hidden bg-neutral-950 border border-neutral-800 group">
            <img
              src={zoomMode ? current.detailImage : current.image}
              alt={current.title}
              className={`w-full h-full object-cover object-center transition-all duration-700 ${
                zoomMode ? 'scale-125 contrast-125 saturate-110' : 'scale-100 group-hover:scale-105'
              }`}
            />

            {/* Ambient Lighting Overlay */}
            <div className="absolute inset-0 bg-gradient-to-t from-black via-black/30 to-transparent" />

            {/* Glowing Aura Rings */}
            <div 
              className="absolute inset-0 pointer-events-none opacity-40 mix-blend-screen transition-all duration-1000 animate-pulse"
              style={{
                background: `radial-gradient(circle at 50% 60%, ${current.auraColor} 0%, transparent 70%)`
              }}
            />

            {/* Top Left Floating Pill */}
            <div className="absolute top-4 left-4 flex flex-col gap-1.5 z-10">
              <span 
                className="text-[10px] font-mono font-bold px-2.5 py-1 rounded uppercase tracking-wider text-black font-extrabold shadow-lg"
                style={{ backgroundColor: current.accentHex }}
              >
                LIVE RUNWAY DROP
              </span>
              <span className="bg-black/80 backdrop-blur-md text-neutral-300 border border-neutral-700 text-[10px] font-mono px-2 py-0.5 rounded">
                {current.universe}
              </span>
            </div>

            {/* Bottom Floating Runway Spec Overlay */}
            <div className="absolute bottom-4 left-4 right-4 p-3 sm:p-4 rounded-xl bg-black/80 backdrop-blur-md border border-neutral-800/90 flex items-center justify-between z-10">
              <div className="flex items-center gap-4 text-xs font-mono text-neutral-300">
                <span className="font-bold text-white">{current.gsm} GSM</span>
                <span>•</span>
                <span>{current.fit}</span>
                <span className="hidden sm:inline">•</span>
                <span className="hidden sm:inline">100% Combed Cotton</span>
              </div>

              <div className="text-right">
                <span className="text-xs text-neutral-500 line-through mr-2">₹{current.originalPrice}</span>
                <span className="font-heading text-lg sm:text-xl font-bold text-white">₹{current.price}</span>
              </div>
            </div>
          </div>

          {/* Right Product Specs & Immediate Buy Action */}
          <div className="lg:col-span-5 flex flex-col justify-between space-y-6">
            <div>
              <div 
                className="text-xs font-mono font-bold uppercase tracking-widest mb-1.5"
                style={{ color: current.accentHex }}
              >
                {current.universe}
              </div>

              <h3 className="font-heading text-3xl sm:text-4xl lg:text-5xl font-extrabold text-white tracking-tight uppercase leading-none">
                {current.title}
              </h3>

              <p className="mt-2 text-sm sm:text-base text-neutral-200 font-medium">
                "{current.subtitle}"
              </p>

              <p className="mt-4 text-xs sm:text-sm text-neutral-400 leading-relaxed">
                {current.description}
              </p>

              {/* Spec Badges */}
              <div className="grid grid-cols-2 gap-3 mt-6">
                <div className="p-3 rounded-xl bg-[#14141e] border border-neutral-800">
                  <div className="text-[10px] font-mono text-neutral-400 uppercase">Fabric Density</div>
                  <div className="text-sm font-bold text-white font-mono mt-0.5">{current.gsm} GSM Heavy Cotton</div>
                </div>
                <div className="p-3 rounded-xl bg-[#14141e] border border-neutral-800">
                  <div className="text-[10px] font-mono text-neutral-400 uppercase">Silhoutte</div>
                  <div className="text-sm font-bold text-white font-mono mt-0.5">{current.fit}</div>
                </div>
              </div>
            </div>

            {/* Price & Action Row */}
            <div className="pt-6 border-t border-neutral-800 flex flex-col gap-3">
              <div className="flex items-baseline justify-between">
                <div className="flex items-baseline gap-2">
                  <span className="font-heading text-3xl font-black text-white">₹{current.price}</span>
                  <span className="text-sm text-neutral-500 line-through">₹{current.originalPrice}</span>
                </div>
                <span className="text-xs font-mono text-emerald-400 font-bold bg-emerald-950/40 border border-emerald-900/60 px-2 py-0.5 rounded">
                  {Math.round(((current.originalPrice - current.price) / current.originalPrice) * 100)}% OFF
                </span>
              </div>

              <div className="flex items-center gap-3 pt-2">
                <button
                  id={`runway-quick-add-${current.id}`}
                  onClick={handleQuickAdd}
                  className="flex-1 py-3.5 px-6 rounded-xl font-heading text-base font-bold uppercase tracking-wider text-white transition flex items-center justify-center gap-2 cursor-pointer shadow-xl active:scale-95"
                  style={{
                    backgroundColor: current.accentHex,
                    boxShadow: `0 10px 25px -8px ${current.auraColor}`,
                  }}
                >
                  {added ? (
                    <>
                      <Check className="w-5 h-5" />
                      <span>ADDED TO BAG</span>
                    </>
                  ) : (
                    <>
                      <ShoppingBag className="w-5 h-5" />
                      <span>QUICK ADD SIZE L</span>
                    </>
                  )}
                </button>

                <button
                  onClick={handleOpenDetails}
                  className="py-3.5 px-5 rounded-xl bg-[#181824] hover:bg-[#202030] text-neutral-200 hover:text-white border border-neutral-700/80 font-heading text-sm font-bold uppercase tracking-wider transition flex items-center gap-1.5 cursor-pointer"
                >
                  <span>VIEW</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
