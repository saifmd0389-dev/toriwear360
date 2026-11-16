import React, { useState, useEffect } from 'react';
import { BookOpen, Eye, ArrowRight, MapPin } from 'lucide-react';
import { Product } from '../types';
import { loadFrontPageCmsData } from '../admin/data/frontPageCmsData';
import { ShimmerImage, StoryBehindDesignsSkeleton } from './StorefrontSkeletons';

interface StoryBehindDesignsSectionProps {
  products: Product[];
  isLoading?: boolean;
  onOpenProductDetail: (product: Product) => void;
  onExploreMoreStories?: () => void;
}

const FALLBACK_STORIES = [
  {
    title: 'VOID WALKER',
    japanese: '虚空の歩行者',
    catalog: 'TW-DS-01',
    world: 'DARK SHONEN',
    character: 'REN',
    quote: 'THE SHADOW DOES NOT CONCEAL WEAKNESS. IT CREATES DISCIPLINE.',
    story: 'The feeling of walking through a crowded metropolis and feeling completely alone. The shadow energy represents thoughts kept inside, transformed into an obsidian aura. High-density matte puff print with cracked calligraphy detailing.',
    coords: '35.6595° N, 139.7004° E',
    productName: 'VOID WALKER',
  },
  {
    title: 'NEON RONIN',
    japanese: 'ネオン浪人',
    catalog: 'TW-CP-01',
    world: 'CYBERPUNK',
    character: 'YUKI',
    quote: 'A BLADE OF CARBON FIBER. A CODE OF ANCIENT HONOR.',
    story: 'A samurai who awoke in Neo Tokyo 2087. The holographic hexadecimal code streaming down the sleeve is a classical Edo poem about honor and rain, compiled into a modern executable.',
    coords: 'SHIBUYA SECTOR 4',
    productName: 'NEON RONIN',
  },
  {
    title: '02:17 AM',
    japanese: '午前二時十七分',
    catalog: 'TW-CP-02',
    world: 'CYBERPUNK',
    character: 'YUKI',
    quote: 'THE CITY NEVER SLEEPS. IT ONLY WAITS.',
    story: 'The exact minute when the metropolitan grid is quietest and ideas become dangerous. The coordinates on the chest coordinate with Shibuya crossing when rain washes out the streetlights.',
    coords: '02:17:42 UTC+9',
    productName: '02:17 AM',
  },
  {
    title: 'BROKEN BLADE',
    japanese: '折れた刃',
    catalog: 'TW-SM-02',
    world: 'SAMURAI',
    character: 'AKI',
    quote: 'NOT ALL DAMAGE IS A DEFEAT. SOME EDGES CUT DEEPER ONCE REBORN.',
    story: 'Some things break so you have to learn how to fight differently. Inspired by Kintsugi—the Japanese philosophy of repairing broken pottery with liquid gold.',
    coords: 'KYOTO SANCTUARY',
    productName: 'BROKEN BLADE',
  },
  {
    title: 'TORI 001',
    japanese: '創世記 零零一',
    catalog: 'TW-SA-01',
    world: 'STREET ANIME',
    character: 'TORI',
    quote: 'FOR THE DAY ONES. CHAPTER ZERO OF AN EXPANDING UNIVERSE.',
    story: 'The genesis silhouette of Toriwear. A completely minimalist front chest stamp with a massive architectural universe schematic across the back panel.',
    coords: 'ORIGINAL IP // V.1',
    productName: 'TORI 001',
  },
];

export const StoryBehindDesignsSection: React.FC<StoryBehindDesignsSectionProps> = ({
  products,
  isLoading = false,
  onOpenProductDetail,
  onExploreMoreStories,
}) => {
  const [cmsStories, setCmsStories] = useState(() => loadFrontPageCmsData().designStories);

  useEffect(() => {
    const sync = () => setCmsStories(loadFrontPageCmsData().designStories);
    window.addEventListener('tori-cms-updated', sync);
    window.addEventListener('storage', sync);
    return () => {
      window.removeEventListener('tori-cms-updated', sync);
      window.removeEventListener('storage', sync);
    };
  }, []);

  const normalizedFallbacks = FALLBACK_STORIES.map((f, idx) => ({ ...f, id: `fb-${idx}`, heroImage: '' }));
  const designStories = (cmsStories && cmsStories.length > 0)
    ? cmsStories.filter((s) => s.enabled !== false).map((s, idx) => {
        const cleanTitle = (s.title.split('//')[0] || s.title).trim();
        const fb = normalizedFallbacks.find((f) => cleanTitle.toUpperCase().includes(f.title.toUpperCase())) || normalizedFallbacks[idx % normalizedFallbacks.length]!;
        return {
          id: s.id || `story-${idx}`,
          title: cleanTitle || s.title,
          japanese: fb.japanese,
          catalog: s.capsuleCode || fb.catalog,
          world: fb.world,
          character: fb.character,
          quote: s.printTechnology || fb.quote,
          story: s.concept ? `${s.concept}${s.fabricSpec ? ` — ${s.fabricSpec}` : ''}` : fb.story,
          coords: fb.coords,
          productName: cleanTitle || s.title,
          heroImage: s.heroImage || '',
        };
      })
    : normalizedFallbacks;

  const [activeStoryIdx, setActiveStoryIdx] = useState(0);
  const currentStory = designStories[activeStoryIdx] ?? designStories[0] ?? normalizedFallbacks[0]!;

  const matchedProduct = products.find((p) =>
    p.name.toUpperCase().includes((currentStory.productName || '').toUpperCase()) ||
    (p.character && p.character.toUpperCase() === (currentStory.character || '').toUpperCase())
  );

  return (
    <section 
      id="story-behind-designs-section" 
      className="py-24 bg-[#0A0A0A] border-b border-neutral-800/80 relative select-none text-white"
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-12">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-neutral-900 border border-neutral-800 text-[11px] font-mono uppercase tracking-widest text-[#FF2028] mb-3">
              <BookOpen className="w-3.5 h-3.5" />
              <span>NARRATIVE FASHION EDITORIAL</span>
            </div>
            <h2 className="font-heading text-4xl sm:text-6xl font-black text-white uppercase tracking-tight">
              STORY BEHIND <span className="text-[#FF2028]">THE DESIGNS</span>
            </h2>
            <p className="mt-2 text-neutral-400 text-sm font-mono max-w-xl">
              Not random graphics. Every garment is rooted in character lore, coordinates, and philosophy.
            </p>
          </div>

          <button
            onClick={() => {
              if (onExploreMoreStories) {
                onExploreMoreStories();
              } else {
                const el = document.getElementById('new-drop-section');
                el?.scrollIntoView({ behavior: 'smooth' });
              }
            }}
            className="px-5 py-2.5 bg-white hover:bg-neutral-200 text-neutral-950 font-heading text-xs font-bold uppercase tracking-wider rounded-lg transition active:scale-95 cursor-pointer flex items-center gap-2"
          >
            <span>EXPLORE DESIGN STORIES</span>
            <ArrowRight className="w-3.5 h-3.5 text-[#FF2028]" />
          </button>
        </div>

        {isLoading ? (
          <StoryBehindDesignsSkeleton />
        ) : (
        <div className="skeleton-reveal">
        {/* Story Selector Bar */}
        <div className="flex items-center gap-2 overflow-x-auto pb-4 mb-10 no-scrollbar">
          {designStories.map((ds, index) => {
            const isSelected = activeStoryIdx === index;
            return (
              <button
                key={ds.id || index}
                onClick={() => setActiveStoryIdx(index)}
                className={`px-5 py-2.5 rounded-xl text-xs font-mono font-bold uppercase transition border whitespace-nowrap cursor-pointer ${
                  isSelected
                    ? 'bg-neutral-100 text-neutral-950 border-white shadow-md'
                    : 'bg-[#151515] text-neutral-400 border-neutral-800 hover:text-white hover:border-neutral-700'
                }`}
              >
                <span>{ds.title}</span>
                <span className="text-[10px] ml-1.5 opacity-60">[{ds.world}]</span>
              </button>
            );
          })}
        </div>

        {/* Editorial Layout: Large Artwork / Graphic + Magazine Story */}
        <div className="rounded-3xl bg-[#121215] border border-neutral-800/90 overflow-hidden shadow-2xl grid grid-cols-1 lg:grid-cols-12">
          {/* Left Column: Visual Editorial Plate */}
          <div className="lg:col-span-5 p-8 sm:p-12 bg-gradient-to-br from-[#181820] to-[#0d0d10] border-b lg:border-b-0 lg:border-r border-neutral-800 flex flex-col justify-between relative overflow-hidden">
            {currentStory.heroImage && (
              <>
                <ShimmerImage
                  src={currentStory.heroImage}
                  alt={currentStory.title}
                  theme="dark"
                  wrapperClassName="absolute inset-0 pointer-events-none"
                  referrerPolicy="no-referrer"
                  className="w-full h-full object-cover opacity-20 pointer-events-none"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-[#0d0d10] via-[#0d0d10]/80 to-[#181820]/85 pointer-events-none" />
              </>
            )}
            <div className="relative z-10 flex items-center justify-between">
              <span className="text-xs font-mono text-[#FF2028] font-bold tracking-widest uppercase">
                {currentStory.catalog}
              </span>
              <span className="text-xs font-mono text-neutral-400 flex items-center gap-1">
                <MapPin className="w-3 h-3 text-neutral-500" />
                <span>{currentStory.coords}</span>
              </span>
            </div>

            <div className="relative z-10 my-10 text-center">
              <span className="text-sm font-mono text-neutral-500 block mb-2">
                {currentStory.japanese}
              </span>
              <h3 className="font-heading text-4xl sm:text-5xl font-black text-white uppercase tracking-tight">
                {currentStory.title}
              </h3>
              <span className="inline-block mt-3 px-3 py-1 rounded-full bg-neutral-900 border border-neutral-800 text-[11px] font-mono uppercase text-neutral-300">
                WORLD: {currentStory.world} · PROTAGONIST: {currentStory.character}
              </span>
            </div>

            <div className="relative z-10 p-4 rounded-xl bg-neutral-950/80 border border-neutral-800/80 text-xs font-mono text-neutral-300 italic">
              “{currentStory.quote}”
            </div>
          </div>

          {/* Right Column: Narrative Story Breakdown & Connected Product */}
          <div className="lg:col-span-7 p-8 sm:p-12 flex flex-col justify-between space-y-6">
            <div className="space-y-6">
              <div>
                <span className="text-[10px] font-mono uppercase tracking-widest text-[#FF2028] font-bold block mb-1">
                  THE STORY
                </span>
                <p className="text-sm sm:text-base text-neutral-300 leading-relaxed font-sans">
                  {currentStory.story}
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-4 border-t border-neutral-800">
                <div className="p-4 rounded-xl bg-neutral-900/60 border border-neutral-800/80">
                  <span className="text-[10px] font-mono uppercase text-neutral-500 font-bold block mb-1">
                    THE CHARACTER
                  </span>
                  <span className="text-sm font-bold text-white font-mono block">
                    {currentStory.character}
                  </span>
                  <span className="text-xs text-neutral-400 block mt-0.5">
                    Original TORI universe faction member
                  </span>
                </div>

                <div className="p-4 rounded-xl bg-neutral-900/60 border border-neutral-800/80">
                  <span className="text-[10px] font-mono uppercase text-neutral-500 font-bold block mb-1">
                    THE WORLD
                  </span>
                  <span className="text-sm font-bold text-white font-mono block">
                    {currentStory.world}
                  </span>
                  <span className="text-xs text-neutral-400 block mt-0.5">
                    Proprietary narrative realm
                  </span>
                </div>
              </div>
            </div>

            {/* Product Connection CTA */}
            {matchedProduct && (
              <div className="pt-6 border-t border-neutral-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <span className="text-[10px] font-mono uppercase text-neutral-400 block">
                    CONNECTED APPAREL
                  </span>
                  <span className="text-base font-heading font-black text-white uppercase tracking-tight">
                    {matchedProduct.name}
                  </span>
                  <span className="text-xs font-mono text-[#FF2028] font-bold block mt-0.5">
                    ₹{matchedProduct.price} · 240 GSM
                  </span>
                </div>

                <button
                  onClick={() => onOpenProductDetail(matchedProduct)}
                  className="px-6 py-3 bg-white hover:bg-neutral-200 text-neutral-950 font-heading text-xs font-black uppercase tracking-wider rounded-xl transition flex items-center justify-center gap-2 cursor-pointer shadow-lg active:scale-95"
                >
                  <Eye className="w-3.5 h-3.5" />
                  <span>VIEW PRODUCT</span>
                </button>
              </div>
            )}
          </div>
        </div>
        </div>
        )}
      </div>
    </section>
  );
};
