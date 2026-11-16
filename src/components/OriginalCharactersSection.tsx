import React, { useState, useEffect } from 'react';
import { UserCheck, ArrowRight } from 'lucide-react';
import { ORIGINAL_CHARACTERS } from '../data/constants';
import { loadFrontPageCmsData } from '../admin/data/frontPageCmsData';
import { Product } from '../types';
import { ShimmerImage, OriginalCharactersSkeleton } from './StorefrontSkeletons';

interface OriginalCharactersSectionProps {
  products: Product[];
  isLoading?: boolean;
  onOpenProductDetail: (product: Product) => void;
  onOpenCharacterModal?: () => void;
}

export const OriginalCharactersSection: React.FC<OriginalCharactersSectionProps> = ({
  isLoading = false,
  onOpenCharacterModal,
}) => {
  const [cmsChars, setCmsChars] = useState(() => loadFrontPageCmsData().characters);

  useEffect(() => {
    const sync = () => setCmsChars(loadFrontPageCmsData().characters);
    window.addEventListener('tori-cms-updated', sync);
    window.addEventListener('storage', sync);
    return () => {
      window.removeEventListener('tori-cms-updated', sync);
      window.removeEventListener('storage', sync);
    };
  }, []);

  // Merge CMS character entries into display format, falling back to ORIGINAL_CHARACTERS if empty
  const mainCharacters = (cmsChars && cmsChars.length > 0)
    ? cmsChars
        .filter((c) => c.enabled !== false)
        .sort((a, b) => (a.order || 0) - (b.order || 0))
        .map((c) => {
          const cleanName = (c.name.split('//')[0] || c.name).trim();
          const fallback = ORIGINAL_CHARACTERS.find((oc) =>
            oc.name.toUpperCase() === cleanName.toUpperCase() ||
            oc.id === c.id
          );
          const statTags = [c.stats?.fabricGsm, c.stats?.loreLevel, c.stats?.agilityVibe].filter(Boolean) as string[];
          return {
            id: c.id,
            name: cleanName || c.name,
            japanese: c.japaneseTitle || fallback?.japanese || 'オリジナル',
            japaneseName: c.japaneseTitle || fallback?.japaneseName || 'オリジナル',
            chapter: fallback?.chapter || 'CHAPTER 01',
            role: c.title || fallback?.role || 'TORIWEAR Protagonist',
            alias: c.title || fallback?.alias || 'PROTAGONIST',
            world: fallback?.world || 'DARK SHONEN',
            symbol: fallback?.symbol || 'TORI INSIGNIA',
            description: c.backstory || fallback?.description || '',
            storyQuote: c.quote || fallback?.storyQuote || '',
            personality: statTags.length > 0
              ? statTags
              : (fallback?.personality && fallback.personality.length > 0 ? fallback.personality : ['Original IP']),
            signatureStyle: c.weaponAesthetic || fallback?.signatureStyle || '240 GSM Oversized Boxy Fit',
            avatarUrl: c.avatarImage || fallback?.avatarUrl || '',
          };
        })
    : ORIGINAL_CHARACTERS.filter((c) =>
        ['char-tori', 'char-ren', 'char-kai', 'char-yuki', 'char-aki'].includes(c.id)
      );

  const [selectedCharId, setSelectedCharId] = useState<string>(mainCharacters[0]?.id || 'char-tori');
  const activeChar = mainCharacters.find((c) => c.id === selectedCharId) || mainCharacters[0];

  return (
    <section 
      id="original-characters-section" 
      className="py-20 sm:py-24 bg-[#0A0A0A] border-b border-neutral-800/80 relative select-none text-white"
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-12">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-neutral-900 border border-neutral-800 text-[11px] font-mono uppercase tracking-widest text-[#FF2028] mb-3">
              <UserCheck className="w-3.5 h-3.5" />
              <span>ORIGINAL TORIWEAR IP</span>
            </div>
            <h2 className="font-heading text-4xl sm:text-6xl font-black text-white uppercase tracking-tight">
              ORIGINAL <span className="text-[#FF2028]">CHARACTERS</span>
            </h2>
            <p className="mt-2 text-neutral-400 text-sm font-mono max-w-xl">
              Meet the heroes, netrunners, and ronin shaping the stories behind our graphics.
            </p>
          </div>

          <button
            onClick={() => {
              if (onOpenCharacterModal) {
                onOpenCharacterModal();
              } else {
                const el = document.getElementById('shop-men-section');
                el?.scrollIntoView({ behavior: 'smooth' });
              }
            }}
            className="px-5 py-2.5 bg-neutral-900 hover:bg-neutral-800 text-neutral-200 border border-neutral-700 rounded-lg text-xs font-mono font-bold uppercase tracking-wider transition whitespace-nowrap active:scale-95 cursor-pointer flex items-center gap-2 self-start md:self-end"
          >
            <span>MEET THE CHARACTERS</span>
            <ArrowRight className="w-3.5 h-3.5 text-[#FF2028]" />
          </button>
        </div>

        {/* Character Selector & Active Profile Showcase (or Skeleton) */}
        {isLoading ? (
          <OriginalCharactersSkeleton />
        ) : (
        <div className="skeleton-reveal">
        {/* Character Selector Pills with Mini Avatars */}
        <div className="flex items-center gap-2.5 overflow-x-auto pb-4 mb-10 no-scrollbar">
          {mainCharacters.map((char) => {
            const isSelected = activeChar?.id === char.id;
            return (
              <button
                key={char.id}
                onClick={() => setSelectedCharId(char.id)}
                className={`px-4 py-2 rounded-xl text-xs font-mono font-bold uppercase transition flex items-center gap-2.5 border cursor-pointer whitespace-nowrap ${
                  isSelected
                    ? 'bg-white text-neutral-950 border-white shadow-lg'
                    : 'bg-[#151515] text-neutral-400 border-neutral-800 hover:text-white hover:border-neutral-700'
                }`}
              >
                {char.avatarUrl && (
                  <img
                    src={char.avatarUrl}
                    alt={char.name}
                    referrerPolicy="no-referrer"
                    className="w-5 h-5 rounded-full object-cover border border-neutral-700"
                  />
                )}
                <span>{char.name}</span>
                <span className="text-[10px] opacity-60">({char.japaneseName || char.japanese})</span>
              </button>
            );
          })}
        </div>

        {/* Active Character Profile Showcase */}
        {activeChar && (
          <div className="rounded-3xl bg-[#121215] border border-neutral-800/90 p-5 sm:p-8 lg:p-10 grid grid-cols-1 lg:grid-cols-12 gap-8 items-center shadow-2xl">
            {/* Visual Portrait / Artwork */}
            <div className="lg:col-span-5 relative aspect-[3/4] rounded-2xl overflow-hidden border border-neutral-800 bg-[#18181f] flex flex-col justify-end p-6 group">
              {activeChar.avatarUrl ? (
                <ShimmerImage
                  src={activeChar.avatarUrl}
                  alt={activeChar.name}
                  theme="dark"
                  wrapperClassName="absolute inset-0"
                  referrerPolicy="no-referrer"
                  className="w-full h-full object-cover object-center transition-transform duration-700 group-hover:scale-105"
                />
              ) : null}

              {/* Scrim Overlay */}
              <div className="absolute inset-0 bg-gradient-to-t from-[#0A0A0A] via-[#0A0A0A]/40 to-transparent pointer-events-none" />

              <div className="relative z-10">
                <span className="text-[10px] font-mono uppercase tracking-widest text-[#FF2028] font-bold block mb-1">
                  {activeChar.japaneseName || activeChar.japanese} · {activeChar.chapter}
                </span>
                <span className="font-heading text-4xl sm:text-5xl font-black text-white uppercase block leading-none">
                  {activeChar.name}
                </span>
                <span className="text-xs text-neutral-300 block font-mono mt-1">
                  {activeChar.role}
                </span>
              </div>
            </div>

            {/* Character Lore & Details */}
            <div className="lg:col-span-7 flex flex-col justify-between space-y-6">
              <div>
                <div className="flex flex-wrap items-center gap-3">
                  <span className="text-xs font-mono font-bold uppercase px-3 py-1 rounded-full bg-[#FF2028]/15 text-[#FF2028] border border-[#FF2028]/30">
                    {activeChar.world}
                  </span>
                  <span className="text-xs font-mono text-neutral-400">
                    SYMBOL: <strong className="text-neutral-200">{activeChar.symbol}</strong>
                  </span>
                </div>

                <h3 className="font-heading text-3xl sm:text-4xl font-black text-white uppercase mt-4">
                  {activeChar.name} — <span className="text-neutral-400 text-xl sm:text-2xl font-medium">{activeChar.alias}</span>
                </h3>

                <p className="mt-3 text-neutral-300 text-sm sm:text-base leading-relaxed font-sans">
                  {activeChar.description}
                </p>

                {/* Signature Quote Callout */}
                <div className="mt-6 p-4 rounded-xl bg-neutral-900/90 border-l-4 border-[#FF2028] text-neutral-200 text-sm font-mono italic">
                  “{activeChar.storyQuote}”
                </div>
              </div>

              {/* Personality Traits & Signature Style */}
              <div className="space-y-4">
                <div>
                  <span className="text-[10px] font-mono uppercase text-neutral-500 block mb-2 font-bold tracking-wider">
                    PERSONALITY & ESSENCE
                  </span>
                  <div className="flex flex-wrap gap-2">
                    {(activeChar.personality || []).map((trait, i) => (
                      <span
                        key={i}
                        className="px-3 py-1 rounded-lg bg-neutral-900 border border-neutral-800 text-xs font-mono text-neutral-300"
                      >
                        {trait}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="pt-2 border-t border-neutral-800/80">
                  <span className="text-[10px] font-mono uppercase text-neutral-500 block mb-1 font-bold tracking-wider">
                    SIGNATURE APPAREL CUT
                  </span>
                  <p className="text-xs font-mono text-neutral-300">
                    {activeChar.signatureStyle}
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}
        </div>
        )}
      </div>
    </section>
  );
};
