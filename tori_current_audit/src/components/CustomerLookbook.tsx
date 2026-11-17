import React, { useState, useEffect } from 'react';
import { Camera, CheckCircle, ArrowRight } from 'lucide-react';
import { Product } from '../types';
import { loadFrontPageCmsData } from '../admin/data/frontPageCmsData';
import { ShimmerImage, LookbookGridSkeleton } from './StorefrontSkeletons';

interface CustomerLookbookProps {
  products: Product[];
  isLoading?: boolean;
  onOpenProductDetail: (product: Product) => void;
}

const FALLBACK_LOOKS = [
  {
    id: 'look-1',
    name: 'Devansh K.',
    city: 'Bengaluru',
    image: 'https://images.unsplash.com/photo-1509198397868-475647b2a1e5?w=700&auto=format&fit=crop&q=80',
    productName: 'Void Walker Graphic Tee',
    productMatch: 'Void Walker',
    sizeWorn: 'Wearing Size XL (5’11”)',
    rating: 5,
    review: 'The 240 GSM weight is unreal. The shadow print has this velvety matte finish that looks ten times more expensive than standard anime merch.',
    tag: 'MEN // DARK SHONEN',
  },
  {
    id: 'look-2',
    name: 'Rohan & Kabir (Dad & Son)',
    city: 'Mumbai',
    image: 'https://images.unsplash.com/photo-1516627145497-ae6968895b74?w=700&auto=format&fit=crop&q=80',
    productName: 'Kami & Zero Hero Tee',
    productMatch: 'Kami & Zero',
    sizeWorn: 'Wearing Size 6–7Y & Men L',
    rating: 5,
    review: 'Got the matching theme tees. My 6-year-old loves Kami the sneaker cloud! Super soft cotton and hasn’t shrunk after 5 washes.',
    tag: 'KIDS // CUTE ADVENTURE',
  },
  {
    id: 'look-3',
    name: 'Meera S.',
    city: 'Delhi NCR',
    image: 'https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?w=700&auto=format&fit=crop&q=80',
    productName: 'Neon Ronin Heavyweight Tee',
    productMatch: 'Neon Ronin',
    sizeWorn: 'Wearing Size M (Oversized fit, 5’6”)',
    rating: 5,
    review: 'I love that it’s not an obvious anime rip-off. It feels like high-end cyberpunk techwear with genuine original art. People constantly ask me where I got it.',
    tag: 'MEN // CYBERPUNK',
  },
  {
    id: 'look-4',
    name: 'Arjun V.',
    city: 'Pune',
    image: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=700&auto=format&fit=crop&q=80',
    productName: 'Broken Blade Samurai Tee',
    productMatch: 'Broken Blade',
    sizeWorn: 'Wearing Size XXL (6’2”)',
    rating: 5,
    review: 'The ribbed collar doesn’t bacon or sag. Premium drop shoulder cut that actually hangs properly without looking boxy or stiff.',
    tag: 'MEN // SAMURAI',
  },
];

export const CustomerLookbook: React.FC<CustomerLookbookProps> = ({
  products,
  isLoading = false,
  onOpenProductDetail,
}) => {
  const [cmsLooks, setCmsLooks] = useState(() => loadFrontPageCmsData().lookbook);
  const [filterTabs, setFilterTabs] = useState(() =>
    (loadFrontPageCmsData().tabs || [])
      .filter((t) => t.category === 'LOOKBOOK_FILTER' && t.enabled !== false)
      .sort((a, b) => (a.order || 0) - (b.order || 0))
  );
  const [activeFilter, setActiveFilter] = useState<string>('ALL');

  useEffect(() => {
    const sync = () => {
      const cms = loadFrontPageCmsData();
      setCmsLooks(cms.lookbook);
      setFilterTabs(
        (cms.tabs || [])
          .filter((t) => t.category === 'LOOKBOOK_FILTER' && t.enabled !== false)
          .sort((a, b) => (a.order || 0) - (b.order || 0))
      );
    };
    window.addEventListener('tori-cms-updated', sync);
    window.addEventListener('storage', sync);
    return () => {
      window.removeEventListener('tori-cms-updated', sync);
      window.removeEventListener('storage', sync);
    };
  }, []);

  const looks = (cmsLooks && cmsLooks.length > 0)
    ? cmsLooks
        .filter((l) => l.enabled !== false)
        .sort((a, b) => (a.order || 0) - (b.order || 0))
        .map((l) => ({
          id: l.id,
          name: l.customerHandle || '@toriwear_fan',
          city: l.location || 'India',
          image: l.imageUrl || 'https://images.unsplash.com/photo-1509198397868-475647b2a1e5?w=700&auto=format&fit=crop&q=80',
          productName: l.taggedDrop || 'TORIWEAR Heavyweight Tee',
          productMatch: (l.taggedDrop || '').split(' ').slice(0, 2).join(' ') || 'Void',
          sizeWorn: l.sizeWorn || 'Size L',
          rating: Number(l.rating) || 5,
          review: l.caption || '',
          category: l.category || 'MEN',
          tag: `${l.category || 'MEN'} // STREET FIT`,
        }))
    : FALLBACK_LOOKS.map((l) => ({ ...l, category: l.tag.startsWith('KIDS') ? 'KIDS' : 'MEN' }));

  const filteredLooks = activeFilter === 'ALL'
    ? looks
    : looks.filter((l) => l.category === activeFilter);

  return (
    <section id="customer-lookbook-section" className="py-20 bg-[#090a0f] border-b border-neutral-800/80 relative select-none">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-8">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-neutral-900 border border-neutral-800 text-[11px] font-mono uppercase tracking-widest text-[#FF2028] mb-3">
              <Camera className="w-3.5 h-3.5" />
              <span>COMMUNITY STREET STYLE</span>
            </div>
            <h2 className="font-heading text-4xl sm:text-5xl font-black text-white uppercase tracking-tight">
              SEEN IN THE <span className="text-[#FF2028]">REAL WORLD</span>
            </h2>
            <p className="mt-1 font-mono text-sm text-neutral-400">
              Real people. Real fits. Real Toriwear. Tag @toriwear.apparel to be featured.
            </p>
          </div>

          <div className="flex items-center gap-2 text-xs font-mono text-neutral-400">
            <span className="flex items-center text-amber-400">★★★★★</span>
            <span>4.9 / 5.0 Average Community Fit Rating</span>
          </div>
        </div>

        {/* Lookbook Filter Tabs (Synced with CMS LOOKBOOK_FILTER) */}
        {filterTabs.length > 0 && (
          <div className="flex items-center gap-2 overflow-x-auto pb-4 mb-6 no-scrollbar">
            {filterTabs.map((tab) => {
              const targetCat = (tab.targetLink || 'ALL').toUpperCase();
              const isSelected = activeFilter === targetCat;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveFilter(targetCat)}
                  className={`px-4 py-2 rounded-xl text-xs font-mono font-bold uppercase tracking-wider transition border whitespace-nowrap cursor-pointer ${
                    isSelected
                      ? 'bg-[#FF2028] text-white border-[#FF2028] shadow-lg shadow-[#FF2028]/20'
                      : 'bg-[#12121a] text-neutral-400 border-neutral-800 hover:text-white hover:border-neutral-700'
                  }`}
                >
                  {tab.label}
                </button>
              );
            })}
          </div>
        )}

        {/* Lookbook Cards or Skeleton */}
        {isLoading ? (
          <LookbookGridSkeleton />
        ) : (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-6 skeleton-reveal">
          {filteredLooks.map((look) => (
            <div
              key={look.id}
              className="rounded-xl sm:rounded-2xl bg-[#111219] border border-neutral-800 hover:border-neutral-600 transition-all duration-300 overflow-hidden flex flex-col justify-between group shadow-lg"
            >
              <div className="relative aspect-[3/4] overflow-hidden bg-neutral-900">
                <ShimmerImage
                  src={look.image}
                  alt={look.name}
                  theme="dark"
                  wrapperClassName="w-full h-full"
                  referrerPolicy="no-referrer"
                  className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/15 to-transparent" />

                <div className="absolute top-2 left-2 sm:top-3 sm:left-3">
                  <span className="text-[8px] sm:text-[9px] font-mono font-bold tracking-wider bg-black/80 backdrop-blur-md text-white px-1.5 sm:px-2 py-0.5 rounded uppercase border border-neutral-700">
                    {look.tag}
                  </span>
                </div>

                <div className="absolute bottom-2 left-2 right-2 sm:bottom-3 sm:left-3 sm:right-3">
                  <div className="text-[11px] sm:text-xs font-mono font-bold text-white flex items-center gap-1">
                    <span className="truncate">{look.name}</span>
                    <span className="text-neutral-400 font-normal hidden sm:inline">({look.city})</span>
                    <CheckCircle className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-emerald-400 ml-auto shrink-0" />
                  </div>
                  <div className="text-[9px] sm:text-[10px] font-mono text-[#FF2028] truncate">
                    {look.sizeWorn}
                  </div>
                </div>
              </div>

              <div className="p-2.5 sm:p-4 flex flex-col justify-between flex-grow">
                <div>
                  <div className="flex items-center text-amber-400 text-[10px] sm:text-xs mb-1 sm:mb-2">
                    {'★'.repeat(look.rating)}
                  </div>
                  <p className="text-[11px] sm:text-xs text-neutral-300 font-sans italic leading-relaxed line-clamp-3">
                    “{look.review}”
                  </p>
                </div>

                <div className="mt-2.5 sm:mt-4 pt-2 sm:pt-3 border-t border-neutral-800 flex items-center justify-between gap-1.5">
                  <span className="text-[10px] sm:text-[11px] font-mono font-bold text-neutral-200 line-clamp-1">
                    {look.productName}
                  </span>
                  {(() => {
                    const match = products.find((p) => p.name.toLowerCase().includes(look.productMatch.toLowerCase()));
                    if (!match) return null;
                    return (
                      <button
                        onClick={() => onOpenProductDetail(match)}
                        className="p-1.5 rounded-lg bg-neutral-800 hover:bg-[#FF2028] text-white transition flex-shrink-0 cursor-pointer"
                        title="Shop this look"
                      >
                        <ArrowRight className="w-3.5 h-3.5" />
                      </button>
                    );
                  })()}
                </div>
              </div>
            </div>
          ))}
        </div>
        )}
      </div>
    </section>
  );
};
