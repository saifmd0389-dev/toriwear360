import React, { useState, useEffect } from 'react';
import { ArrowRight, Compass } from 'lucide-react';
import { MenWorldCategory } from '../types';
import { MEN_WORLDS } from '../data/constants';
import { loadFrontPageCmsData, FrontPageRealmCard } from '../admin/data/frontPageCmsData';
import { ShimmerImage, ChooseYourWorldSkeleton } from './StorefrontSkeletons';

interface ChooseYourWorldProps {
  isLoading?: boolean;
  onSelectWorldCategory?: (world: MenWorldCategory | string) => void;
  onSelectMen: () => void;
  onSelectKids: () => void;
}

export const ChooseYourWorld: React.FC<ChooseYourWorldProps> = ({
  isLoading = false,
  onSelectWorldCategory,
  onSelectMen,
}) => {
  const [cmsData, setCmsData] = useState(() => loadFrontPageCmsData());

  useEffect(() => {
    const handleCmsUpdate = () => {
      setCmsData(loadFrontPageCmsData());
    };
    window.addEventListener('tori-cms-updated', handleCmsUpdate);
    window.addEventListener('storage', handleCmsUpdate);
    return () => {
      window.removeEventListener('tori-cms-updated', handleCmsUpdate);
      window.removeEventListener('storage', handleCmsUpdate);
    };
  }, []);

  const sectionConfig = cmsData.sections?.find((s) => s.key === 'choose_your_world');
  if (sectionConfig && !sectionConfig.isEnabled) {
    return null;
  }

  const realms: FrontPageRealmCard[] = (cmsData.realms && cmsData.realms.length > 0)
    ? cmsData.realms.filter((r) => r.enabled !== false)
    : [];

  const handleShopWorld = (worldId: string) => {
    if (onSelectWorldCategory) {
      onSelectWorldCategory(worldId);
    } else {
      onSelectMen();
    }
    const el = document.getElementById('shop-men-section');
    el?.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <section id="choose-your-world-section" className="py-14 sm:py-24 bg-[#0A0A0A] border-b border-neutral-800/80 relative overflow-hidden select-none text-white">
      {/* Background ambient lighting */}
      <div className="absolute top-1/2 left-1/4 -translate-y-1/2 w-96 h-96 bg-[#FF2028]/5 blur-[140px] pointer-events-none rounded-full" />
      <div className="absolute top-1/2 right-1/4 -translate-y-1/2 w-96 h-96 bg-cyan-500/5 blur-[140px] pointer-events-none rounded-full" />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        {/* Section Header */}
        <div className="text-center max-w-3xl mx-auto mb-10 sm:mb-16">
          <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-neutral-900 border border-neutral-800 text-[11px] font-mono uppercase tracking-widest text-[#FF2028] mb-3">
            <Compass className="w-3.5 h-3.5" />
            <span>ORIGINAL FICTIONAL REALMS</span>
          </div>
          <h2 className="font-heading text-3xl sm:text-6xl font-black text-white tracking-tight uppercase">
            CHOOSE YOUR <span className="text-[#FF2028]">WORLD.</span>
          </h2>
          <p className="mt-3 text-neutral-400 text-xs sm:text-base leading-relaxed max-w-xl mx-auto font-sans">
            Five proprietary anime streetwear universes. Select a world to step into its distinct graphic atmosphere and narrative chapters.
          </p>
        </div>

        {/* Five Worlds Grid */}
        {isLoading ? (
          <ChooseYourWorldSkeleton />
        ) : (
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 sm:gap-4 lg:gap-5 skeleton-reveal">
          {realms.map((w, index) => {
            const accent = w.accentColor || '#FF2028';
            const imgUrl = w.bannerImage || MEN_WORLDS.find((mw) => mw.id === w.worldId || mw.id === w.title)?.heroImage || 'https://images.unsplash.com/photo-1578632767115-351597cf2477?w=900&auto=format&fit=crop&q=80';
            const numBadge = w.numberBadge || (index + 1 < 10 ? `0${index + 1}` : `${index + 1}`);
            const tagBadge = w.badge || w.tag || `CHAPTER 0${index + 1}`;
            const kanji = w.japanese || '';
            const bgGrad = w.bgGradient || 'from-purple-950/70 via-neutral-950 to-[#0A0A0A]';
            const targetWorld = w.worldId || w.title;
            const spanLastOnMobile = index === realms.length - 1 && realms.length % 2 === 1 ? 'col-span-2 lg:col-span-1' : '';

            return (
              <div
                key={w.id}
                onClick={() => handleShopWorld(targetWorld)}
                className={`group relative rounded-2xl overflow-hidden border border-neutral-800 bg-[#121215] p-3.5 sm:p-6 flex flex-col justify-between hover:border-neutral-500 transition-all duration-500 hover:-translate-y-1.5 shadow-2xl cursor-pointer min-h-[250px] sm:min-h-[380px] lg:min-h-[420px] ${spanLastOnMobile}`}
              >
                {/* World Hero Artwork Background with Zoom on Hover */}
                <div className="absolute inset-0 overflow-hidden pointer-events-none">
                  <ShimmerImage
                    src={imgUrl}
                    alt={w.title}
                    theme="dark"
                    wrapperClassName="w-full h-full"
                    referrerPolicy="no-referrer"
                    className="w-full h-full object-cover object-center opacity-35 group-hover:opacity-45 scale-105 group-hover:scale-115 transition-all duration-700 ease-out"
                  />
                  {/* Gradient scrim to guarantee legible typography */}
                  <div className="absolute inset-0 bg-gradient-to-t from-[#0A0A0A] via-[#0A0A0A]/80 to-[#0A0A0A]/55" />
                  <div 
                    className={`absolute inset-0 bg-gradient-to-b ${bgGrad} opacity-30 group-hover:opacity-60 transition-opacity duration-500`}
                  />
                </div>

                {/* Top Meta */}
                <div className="relative z-10">
                  <div className="flex items-center justify-between gap-2 mb-3 sm:mb-4">
                    <span className="text-[10px] font-mono font-bold tracking-wider text-neutral-300 bg-black/80 px-2 py-0.5 rounded uppercase border border-neutral-700">
                      {numBadge}
                    </span>
                    <span 
                      className="text-[10px] font-mono font-bold tracking-wider px-2 py-0.5 rounded uppercase bg-black/60 border border-neutral-800"
                      style={{ color: accent }}
                    >
                      {tagBadge}
                    </span>
                  </div>

                  {kanji && (
                    <div className="text-xs font-mono text-neutral-400 mb-1">
                      {kanji}
                    </div>
                  )}

                  <h3 className="font-heading text-2xl lg:text-xl xl:text-2xl font-black text-white uppercase tracking-tight group-hover:text-white transition-colors">
                    {w.title}
                  </h3>

                  <p className="mt-3 text-sm font-semibold text-neutral-100 leading-snug">
                    {w.description}
                  </p>

                  {w.detailedLore && (
                    <p className="mt-2 text-xs text-neutral-300 leading-relaxed font-sans line-clamp-3">
                      {w.detailedLore}
                    </p>
                  )}
                </div>

                {/* Bottom Action */}
                <div className="relative z-10 pt-5 mt-5 border-t border-neutral-800/80 flex items-center justify-between">
                  <span className="text-xs font-heading font-black text-neutral-200 group-hover:text-white tracking-wider uppercase flex items-center gap-1.5 transition-colors">
                    <span>{w.ctaText || 'SHOP WORLD'}</span>
                    <ArrowRight className="w-3.5 h-3.5 transition-transform group-hover:translate-x-1" style={{ color: accent }} />
                  </span>
                  <span 
                    className="w-2.5 h-2.5 rounded-full transition-all group-hover:scale-125"
                    style={{ backgroundColor: accent, boxShadow: `0 0 10px ${accent}80` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
        )}
      </div>
    </section>
  );
};
