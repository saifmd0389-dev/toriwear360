import React from 'react';
import { ArrowRight, Sparkles, Flame } from 'lucide-react';
import { ShimmerImage } from './StorefrontSkeletons';

interface DepartmentPortalsProps {
  isLoading?: boolean;
  onShopMen: () => void;
  onShopKids: () => void;
  onOpenCombo?: () => void;
  menCount?: number;
  kidsCount?: number;
}

export const DepartmentPortals: React.FC<DepartmentPortalsProps> = ({
  isLoading = false,
  onShopMen,
  onShopKids,
  menCount,
  kidsCount,
}) => {
  return (
    <section className="py-14 sm:py-20 bg-[#0A0A0A] border-b border-neutral-800/80 relative overflow-hidden select-none text-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        {/* Section Header */}
        <div className="text-center max-w-2xl mx-auto mb-10 sm:mb-14">
          <span className="text-[11px] font-mono tracking-widest text-[#FF2028] uppercase font-bold block mb-2">
            CHOOSE YOUR DEPARTMENT
          </span>
          <h2 className="font-heading text-3xl sm:text-5xl font-black text-white uppercase tracking-tight">
            ENTER THE <span className="text-[#FF2028]">COLLECTIONS.</span>
          </h2>
          <p className="mt-3 text-sm sm:text-base text-neutral-400 font-sans">
            Select Men's heavyweight streetwear or Kids' soft anime storywear to open the full catalog.
          </p>
        </div>

        {/* 2 Massive Split Gateways */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 sm:gap-8">
          {/* Gateway 1: MEN'S STREETWEAR */}
          <div 
            onClick={onShopMen}
            className="group relative rounded-3xl overflow-hidden border border-neutral-800 bg-[#121217] hover:border-[#FF2028]/70 transition-all duration-500 cursor-pointer shadow-2xl flex flex-col justify-between min-h-[420px] sm:min-h-[480px] p-6 sm:p-10"
          >
            {/* Background Image & Scrim */}
            <div className="absolute inset-0 z-0 overflow-hidden">
              <ShimmerImage
                src="https://images.unsplash.com/photo-1578632767115-351597cf2477?w=1200&auto=format&fit=crop&q=80"
                alt="Men's Anime Streetwear Collection"
                theme="dark"
                wrapperClassName="w-full h-full"
                referrerPolicy="no-referrer"
                className="w-full h-full object-cover object-center filter grayscale contrast-125 group-hover:scale-105 group-hover:grayscale-0 transition-all duration-700 opacity-40 group-hover:opacity-60"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-[#0A0A0A] via-[#0A0A0A]/70 to-transparent" />
              <div className="absolute inset-0 bg-radial-at-bottom from-transparent to-[#0A0A0A]/80" />
            </div>

            {/* Top Badges */}
            <div className="relative z-10 flex items-center justify-between">
              <span className="bg-[#FF2028] text-white text-[11px] font-mono font-bold uppercase tracking-wider px-3 py-1 rounded-full shadow-lg">
                MEN'S COLLECTION
              </span>
              {isLoading ? (
                <span className="h-6 w-36 rounded-full skeleton-dark border border-neutral-800" />
              ) : (
                <span className="bg-black/80 backdrop-blur-md border border-neutral-700 text-neutral-300 text-[11px] font-mono px-3 py-1 rounded-full skeleton-reveal">
                  {menCount ?? 30} EXCLUSIVES · 240 GSM
                </span>
              )}
            </div>

            {/* Bottom Content */}
            <div className="relative z-10 space-y-3">
              <div className="text-xs font-mono text-[#FF2028] font-bold tracking-widest uppercase flex items-center gap-2">
                <Flame className="w-3.5 h-3.5" />
                <span>DROP-SHOULDER & OVERSIZED</span>
              </div>
              <h3 className="font-heading text-3xl sm:text-4xl font-black text-white uppercase tracking-tight">
                SHOP MEN'S WEAR
              </h3>
              <p className="text-xs sm:text-sm text-neutral-300 font-sans max-w-md line-clamp-2">
                Heavyweight 240 GSM combed cotton blanks with Dark Shonen, Neo Tokyo Cyberpunk, and Samurai Mythic Japanese prints.
              </p>

              <div className="pt-2 flex items-center gap-3">
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onShopMen();
                  }}
                  className="px-6 py-3 bg-[#FFFFFF] group-hover:bg-[#FF2028] text-[#0A0A0A] group-hover:text-white font-sans font-bold text-xs uppercase tracking-[0.06em] rounded-xl transition-all duration-300 flex items-center gap-2 shadow-xl"
                >
                  <span>OPEN MEN'S CATALOGUE</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>

          {/* Gateway 2: KIDS' STORYWEAR */}
          <div 
            onClick={onShopKids}
            className="group relative rounded-3xl overflow-hidden border border-neutral-800 bg-[#121217] hover:border-sky-400/70 transition-all duration-500 cursor-pointer shadow-2xl flex flex-col justify-between min-h-[420px] sm:min-h-[480px] p-6 sm:p-10"
          >
            {/* Background Image & Scrim */}
            <div className="absolute inset-0 z-0 overflow-hidden">
              <ShimmerImage
                src="https://images.unsplash.com/photo-1516627145497-ae6968895b74?w=1200&auto=format&fit=crop&q=80"
                alt="Kids' Anime Storywear Collection"
                theme="dark"
                wrapperClassName="w-full h-full"
                referrerPolicy="no-referrer"
                className="w-full h-full object-cover object-center filter grayscale contrast-125 group-hover:scale-105 group-hover:grayscale-0 transition-all duration-700 opacity-40 group-hover:opacity-60"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-[#0A0A0A] via-[#0A0A0A]/70 to-transparent" />
              <div className="absolute inset-0 bg-radial-at-bottom from-transparent to-[#0A0A0A]/80" />
            </div>

            {/* Top Badges */}
            <div className="relative z-10 flex items-center justify-between">
              <span className="bg-sky-500 text-neutral-950 text-[11px] font-mono font-black uppercase tracking-wider px-3 py-1 rounded-full shadow-lg">
                KIDS' COLLECTION
              </span>
              {isLoading ? (
                <span className="h-6 w-40 rounded-full skeleton-dark border border-neutral-800" />
              ) : (
                <span className="bg-black/80 backdrop-blur-md border border-neutral-700 text-neutral-300 text-[11px] font-mono px-3 py-1 rounded-full skeleton-reveal">
                  {kidsCount ?? 24} PLAYFUL DROPS · AGES 2–13Y
                </span>
              )}
            </div>

            {/* Bottom Content */}
            <div className="relative z-10 space-y-3">
              <div className="text-xs font-mono text-sky-400 font-bold tracking-widest uppercase flex items-center gap-2">
                <Sparkles className="w-3.5 h-3.5" />
                <span>BIO-WASHED SOFT COTTON</span>
              </div>
              <h3 className="font-heading text-3xl sm:text-4xl font-black text-white uppercase tracking-tight">
                SHOP KIDS' WEAR
              </h3>
              <p className="text-xs sm:text-sm text-neutral-300 font-sans max-w-md line-clamp-2">
                180 GSM super-soft combed cotton with non-toxic, skin-friendly water-based prints featuring Chibi Heroes and Future Mechas.
              </p>

              <div className="pt-2 flex items-center gap-3">
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onShopKids();
                  }}
                  className="px-6 py-3 bg-sky-400 hover:bg-sky-300 text-neutral-950 font-sans font-bold text-xs uppercase tracking-[0.06em] rounded-xl transition-all duration-300 flex items-center gap-2 shadow-xl"
                >
                  <span>OPEN KIDS' CATALOGUE</span>
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
