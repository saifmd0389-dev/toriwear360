import React, { useState } from 'react';
import { Product } from '../types';
import { ShoppingBag, Zap, Check } from 'lucide-react';

interface TransformationCharacter {
  id: string;
  name: string;
  universe: string;
  power: string;
  themeColor: string;
  glowColor: string;
  characterImg: string;
  productImg: string;
  productName: string;
  gsm: number;
  price: number;
  productId: string;
}

const TRANSFORMATION_HEROES: TransformationCharacter[] = [
  {
    id: 'hero-shadow',
    name: 'SUNG JIN-WOO',
    universe: 'SOLO LEVELING',
    power: 'SHADOW MONARCH EXTRACTION',
    themeColor: '#6366f1',
    glowColor: 'rgba(99, 102, 241, 0.5)',
    characterImg: 'https://images.unsplash.com/photo-1578632767115-351597cf2477?w=800&auto=format&fit=crop&q=80',
    productImg: 'https://images.unsplash.com/photo-1521572267360-ee0c2909d518?w=800&auto=format&fit=crop&q=80',
    productName: 'SHADOW MONARCH OVERSIZED TEE',
    gsm: 240,
    price: 1199,
    productId: 'tori-001',
  },
  {
    id: 'hero-saiyan',
    name: 'GOKU // SAIYAN',
    universe: 'DRAGON BALL Z',
    power: 'SUPER SAIYAN GOD AURA',
    themeColor: '#f59e0b',
    glowColor: 'rgba(245, 158, 11, 0.5)',
    characterImg: 'https://images.unsplash.com/photo-1563089145-599997674d42?w=800&auto=format&fit=crop&q=80',
    productImg: 'https://images.unsplash.com/photo-1576566588028-4147f3842f27?w=800&auto=format&fit=crop&q=80',
    productName: 'SUPER SAIYAN AURA HEAVYWEIGHT TEE',
    gsm: 260,
    price: 1299,
    productId: 'tori-007',
  },
  {
    id: 'hero-uchiha',
    name: 'ITACHI UCHIHA',
    universe: 'NARUTO SHIPPUDEN',
    power: 'MANGEKYO TSUKUYOMI',
    themeColor: '#FF2028',
    glowColor: 'rgba(255, 46, 77, 0.5)',
    characterImg: 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=800&auto=format&fit=crop&q=80',
    productImg: 'https://images.unsplash.com/photo-1503342217505-b0a15ec3261c?w=800&auto=format&fit=crop&q=80',
    productName: 'ITACHI CROWS OVERSIZED TEE',
    gsm: 240,
    price: 1199,
    productId: 'tori-003',
  },
  {
    id: 'hero-spidey',
    name: 'MILES MORALES',
    universe: 'MARVEL HEROVERSE',
    power: 'BIO-ELECTRIC VENOM STRIKE',
    themeColor: '#ef4444',
    glowColor: 'rgba(239, 68, 68, 0.5)',
    characterImg: 'https://images.unsplash.com/photo-1607604276583-eef5d076aa5f?w=800&auto=format&fit=crop&q=80',
    productImg: 'https://images.unsplash.com/photo-1583743814966-8936f5b7be1a?w=800&auto=format&fit=crop&q=80',
    productName: 'SYMBIOTE REIGN OVERSIZED TEE',
    gsm: 240,
    price: 1299,
    productId: 'tori-marvel-01',
  },
  {
    id: 'hero-aki',
    name: 'AKI // CYBER RONIN',
    universe: 'TORI ORIGINALS',
    power: 'NEO-BUSHIDO PLASMA SLASH',
    themeColor: '#a855f7',
    glowColor: 'rgba(168, 85, 247, 0.5)',
    characterImg: 'https://images.unsplash.com/photo-1509967419530-da38b4704bc6?w=800&auto=format&fit=crop&q=80',
    productImg: 'https://images.unsplash.com/photo-1552374196-1ab2a1c593e8?w=800&auto=format&fit=crop&q=80',
    productName: 'CYBER SAMURAI AKI TEE',
    gsm: 260,
    price: 1399,
    productId: 'tori-40',
  },
];

interface CharacterTransformationProps {
  products: Product[];
  onSelectProduct: (product: Product) => void;
  onQuickAddToCart: (product: Product, size: 'S' | 'M' | 'L' | 'XL' | 'XXL' | 'XXXL') => void;
}

export const CharacterTransformation: React.FC<CharacterTransformationProps> = ({
  products,
  onSelectProduct,
  onQuickAddToCart,
}) => {
  const [selectedHeroIndex, setSelectedHeroIndex] = useState(0);
  const [isTransformed, setIsTransformed] = useState(false);
  const [isCharging, setIsCharging] = useState(false);
  const [added, setAdded] = useState(false);

  const hero = TRANSFORMATION_HEROES[selectedHeroIndex] ?? TRANSFORMATION_HEROES[0];
  if (!hero) return null;

  const handleTransform = () => {
    setIsCharging(true);
    setTimeout(() => {
      setIsTransformed(true);
      setIsCharging(false);
    }, 600);
  };

  const handleReset = () => {
    setIsTransformed(false);
  };

  const handleQuickAdd = () => {
    const matched = products.find((p) => p.id === hero.productId) || products[0];
    if (!matched) return;
    onQuickAddToCart(matched, 'L');
    setAdded(true);
    setTimeout(() => setAdded(false), 2000);
  };

  const handleView = () => {
    const matched = products.find((p) => p.id === hero.productId) || products[0];
    if (!matched) return;
    onSelectProduct(matched);
  };

  return (
    <section 
      id="character-transformation-section" 
      className="py-16 sm:py-24 px-4 sm:px-6 lg:px-8 bg-[#0a0a0f] border-b border-neutral-800/80 relative overflow-hidden"
    >
      {/* Dynamic Background Glow */}
      <div 
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[500px] blur-[170px] pointer-events-none rounded-full transition-all duration-700"
        style={{ backgroundColor: hero.glowColor }}
      />

      <div className="max-w-7xl mx-auto relative z-10">
        {/* Header */}
        <div className="text-center max-w-3xl mx-auto mb-12">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#FF2028]/10 border border-[#FF2028]/30 text-[#FF2028] text-xs font-mono uppercase tracking-widest mb-3">
            <Zap className="w-3.5 h-3.5" />
            <span>INTERACTIVE MORPH ENGINE</span>
          </div>

          <h2 className="font-heading text-4xl sm:text-6xl font-black uppercase text-white tracking-tight">
            CHARACTER → PRODUCT <br />
            <span 
              className="transition-colors duration-500"
              style={{ color: hero.themeColor }}
            >
              TRANSFORMATION.
            </span>
          </h2>

          <p className="mt-3 text-sm sm:text-base text-neutral-300">
            Choose your hero power. Watch the character silhouette charge with raw kinetic energy and forge into a heavyweight streetwear fit.
          </p>
        </div>

        {/* Character Power Selector Tabs */}
        <div className="flex items-center justify-center gap-2 overflow-x-auto pb-4 mb-10 scrollbar-none">
          {TRANSFORMATION_HEROES.map((item, idx) => (
            <button
              key={item.id}
              onClick={() => {
                setSelectedHeroIndex(idx);
                setIsTransformed(false);
              }}
              className={`px-4 py-2.5 rounded-xl text-xs font-mono font-bold uppercase transition-all duration-300 flex items-center gap-2 shrink-0 ${
                selectedHeroIndex === idx
                  ? 'bg-[#1a1a28] text-white border shadow-lg'
                  : 'bg-[#101016] text-neutral-400 hover:text-white border border-neutral-800'
              }`}
              style={{
                borderColor: selectedHeroIndex === idx ? item.themeColor : undefined,
              }}
            >
              <span className="w-2 h-2 rounded-full" style={{ backgroundColor: item.themeColor }} />
              <span>{item.name}</span>
            </button>
          ))}
        </div>

        {/* Morph Stage Display */}
        <div className="max-w-4xl mx-auto bg-[#12121c] border border-neutral-800 rounded-3xl p-6 sm:p-10 shadow-2xl relative overflow-hidden">
          <div className="grid grid-cols-1 md:grid-cols-12 gap-8 items-center">
            {/* Visual Stage (Character or Tee) */}
            <div className="md:col-span-6 relative aspect-[4/5] rounded-2xl overflow-hidden bg-neutral-950 border border-neutral-800/80 group">
              <img
                src={isTransformed ? hero.productImg : hero.characterImg}
                alt={isTransformed ? hero.productName : hero.name}
                className={`w-full h-full object-cover object-center transition-all duration-700 ${
                  isCharging ? 'scale-110 blur-sm brightness-150' : 'scale-100'
                }`}
              />

              {/* Energy Ring Pulsing Overlay */}
              <div 
                className={`absolute inset-0 pointer-events-none transition-opacity duration-500 ${
                  isCharging ? 'opacity-90 animate-ping' : 'opacity-30'
                }`}
                style={{
                  background: `radial-gradient(circle at 50% 50%, ${hero.glowColor} 0%, transparent 70%)`
                }}
              />

              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent pointer-events-none" />

              {/* State Pill */}
              <div className="absolute top-4 left-4 z-10">
                <span 
                  className="text-[10px] font-mono font-bold px-2.5 py-1 rounded uppercase tracking-wider text-black"
                  style={{ backgroundColor: hero.themeColor }}
                >
                  {isTransformed ? 'STREETWEAR TEE' : 'HERO PROFILE'}
                </span>
              </div>

              {/* Bottom tag */}
              <div className="absolute bottom-4 left-4 right-4 z-10">
                <div className="text-[11px] font-mono text-neutral-400 uppercase">{hero.universe}</div>
                <div className="font-heading text-lg font-bold text-white uppercase">
                  {isTransformed ? hero.productName : hero.name}
                </div>
              </div>
            </div>

            {/* Controls & Story Details */}
            <div className="md:col-span-6 flex flex-col justify-between space-y-6">
              <div>
                <div 
                  className="text-xs font-mono font-bold uppercase tracking-widest mb-1"
                  style={{ color: hero.themeColor }}
                >
                  {hero.universe}
                </div>

                <h3 className="font-heading text-2xl sm:text-3xl font-black text-white uppercase leading-tight">
                  {hero.power}
                </h3>

                <p className="mt-3 text-sm text-neutral-300 leading-relaxed">
                  {isTransformed
                    ? 'Forged into our heavyweight drop-shoulder silhouette. Features moisture-wicking bio-washed cotton and ultra-durable high-density screen graphics.'
                    : `Harness the aura of ${hero.name}. Press the trigger to transform this signature anime aesthetic into an everyday wearable oversized statement fit.`
                  }
                </p>

                <div className="mt-6 p-4 rounded-xl bg-[#171724] border border-neutral-800 space-y-2 text-xs font-mono">
                  <div className="flex justify-between text-neutral-400">
                    <span>Power Signature:</span>
                    <span className="text-white font-bold">{hero.power}</span>
                  </div>
                  <div className="flex justify-between text-neutral-400">
                    <span>Fabric GSM:</span>
                    <span className="text-white font-bold">{hero.gsm} GSM Combed Cotton</span>
                  </div>
                  <div className="flex justify-between text-neutral-400">
                    <span>Fit Profile:</span>
                    <span className="text-white font-bold">Drop-Shoulder Boxy Silhouette</span>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="pt-4 border-t border-neutral-800 space-y-3">
                {!isTransformed ? (
                  <button
                    onClick={handleTransform}
                    disabled={isCharging}
                    className="w-full py-4 px-6 rounded-xl font-heading text-base font-bold uppercase tracking-wider text-white transition flex items-center justify-center gap-2 cursor-pointer shadow-xl active:scale-95 border border-white/20"
                    style={{
                      backgroundColor: hero.themeColor,
                      boxShadow: `0 10px 25px -8px ${hero.glowColor}`,
                    }}
                  >
                    <Zap className="w-5 h-5 animate-pulse" />
                    <span>{isCharging ? 'CHARGING ENERGY...' : 'TRANSFORM INTO T-SHIRT'}</span>
                  </button>
                ) : (
                  <div className="space-y-2">
                    <div className="p-2.5 rounded-xl bg-emerald-950/40 border border-emerald-900/60 text-emerald-400 text-xs font-mono font-bold text-center">
                      ⚡ YOUR FIT HAS ARRIVED.
                    </div>

                    <div className="flex items-center gap-3">
                      <button
                        onClick={handleQuickAdd}
                        className="flex-1 py-3.5 px-4 rounded-xl font-heading text-sm font-bold uppercase tracking-wider text-white transition flex items-center justify-center gap-2 cursor-pointer shadow-xl active:scale-95"
                        style={{
                          backgroundColor: hero.themeColor,
                          boxShadow: `0 10px 25px -8px ${hero.glowColor}`,
                        }}
                      >
                        {added ? (
                          <>
                            <Check className="w-4 h-4" />
                            <span>ADDED TO CART</span>
                          </>
                        ) : (
                          <>
                            <ShoppingBag className="w-4 h-4" />
                            <span>QUICK BUY SIZE L (₹{hero.price})</span>
                          </>
                        )}
                      </button>

                      <button
                        onClick={handleView}
                        className="py-3.5 px-4 rounded-xl bg-[#181826] hover:bg-[#222234] border border-neutral-700 text-white font-heading text-xs font-bold uppercase transition"
                      >
                        DETAILS
                      </button>
                    </div>

                    <button
                      onClick={handleReset}
                      className="w-full py-2 text-neutral-400 hover:text-white text-xs font-mono uppercase tracking-wider transition text-center"
                    >
                      ← REVERSE TRANSFORMATION
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
