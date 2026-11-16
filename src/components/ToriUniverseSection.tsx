import React, { useState, useEffect } from 'react';
import { Compass, ArrowRight } from 'lucide-react';
import { loadFrontPageCmsData } from '../admin/data/frontPageCmsData';

interface ToriUniverseSectionProps {
  onEnterUniverse: () => void;
}

export const ToriUniverseSection: React.FC<ToriUniverseSectionProps> = ({
  onEnterUniverse,
}) => {
  const [universe, setUniverse] = useState(() => loadFrontPageCmsData().universe);

  useEffect(() => {
    const sync = () => setUniverse(loadFrontPageCmsData().universe);
    window.addEventListener('tori-cms-updated', sync);
    window.addEventListener('storage', sync);
    return () => {
      window.removeEventListener('tori-cms-updated', sync);
      window.removeEventListener('storage', sync);
    };
  }, []);

  const displayCards = (universe?.chapters && universe.chapters.length > 0)
    ? universe.chapters.filter((ch) => ch.enabled !== false).map((ch, idx) => ({
        id: ch.id || `chap-${idx + 1}`,
        number: `${ch.chapterNumber || `0${idx + 1}`} // ${ch.era || 'TORI UNIVERSE'}`,
        title: ch.title,
        description: ch.excerpt,
      }))
    : (universe?.pillars && universe.pillars.length > 0)
      ? universe.pillars.map((p, idx) => ({
          id: p.id || `pil-${idx + 1}`,
          number: `${p.num} // PILLAR`,
          title: p.title,
          description: p.description,
        }))
      : [
          {
            id: 'chap-1',
            number: '01 // ORIGINAL CHARACTERS',
            title: 'LORE DRIVEN',
            description: 'From the silent observation of Tori to the shadowy discipline of Ren and the cyberpunk speed of Yuki, our characters evolve with every seasonal chapter.',
          },
          {
            id: 'chap-2',
            number: '02 // 10 DIVERSE REALMS',
            title: 'DUAL WORLDS',
            description: '5 mature streetwear universes for Men and 5 joyful, imaginative story worlds for Kids. Each realm carries its own color scheme, iconography, and graphic grammar.',
          },
          {
            id: 'chap-3',
            number: '03 // ARCHIVAL FABRIC',
            title: 'HEAVYWEIGHT SPECS',
            description: 'Heavyweight 240–260 GSM combed cotton for Men, 180 GSM bio-washed skin-safe cotton for Kids. Screen printed with high-density archival inks that outlast trends.',
          },
        ];

  const accentColors = ['text-[#FF2028]', 'text-cyan-400', 'text-amber-400'];

  return (
    <section 
      id="tori-universe-section" 
      className="py-24 bg-[#0A0A0A] border-b border-neutral-800/80 relative overflow-hidden select-none text-white"
    >
      {/* Background ambient lighting */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[400px] bg-[#FF2028]/5 blur-[160px] pointer-events-none rounded-full" />

      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 text-center relative z-10">
        <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-neutral-900 border border-neutral-800 text-[11px] font-mono uppercase tracking-widest text-[#FF2028] mb-4">
          <Compass className="w-3.5 h-3.5" />
          <span>{universe?.subheadline || 'TORI UNIVERSE'}</span>
        </div>

        <h2 className="font-heading text-4xl sm:text-6xl lg:text-7xl font-black text-white tracking-tight uppercase">
          {universe?.headline || 'EVERY DESIGN HAS A STORY.'}
        </h2>

        <p className="mt-5 text-lg sm:text-xl text-neutral-300 font-medium max-w-2xl mx-auto leading-relaxed">
          {universe?.narrativeText || "TORIWEAR isn't just what you wear. It's a universe of characters, worlds, rivalries, memories and stories."}
        </p>

        <p className="mt-3 text-sm text-neutral-400 max-w-xl mx-auto font-sans leading-relaxed">
          {universe?.quote || 'Original anime-inspired intellectual property built from the ground up. Every drop is a canonical chapter with bespoke typography, fictional coordinates, and enduring streetwear craft.'}
        </p>

        {/* CTA Button */}
        <div className="mt-8">
          <button
            id="enter-universe-cta-btn"
            onClick={onEnterUniverse}
            className="px-8 py-4 bg-white hover:bg-neutral-200 text-neutral-950 font-heading text-sm font-black uppercase tracking-wider rounded-xl transition active:scale-95 inline-flex items-center gap-2.5 cursor-pointer shadow-xl shadow-white/5"
          >
            <span>ENTER TORI UNIVERSE</span>
            <ArrowRight className="w-4 h-4 text-[#FF2028]" />
          </button>
        </div>

        {/* Universe Pillars / Chapters */}
        <div className="mt-16 grid grid-cols-1 sm:grid-cols-3 gap-6 text-left">
          {displayCards.map((ch, idx) => (
            <div key={ch.id || idx} className="p-7 rounded-2xl bg-[#121215] border border-neutral-800/90 shadow-xl">
              <span className={`${accentColors[idx % accentColors.length]} font-mono text-xs font-bold block mb-2`}>
                {ch.number}
              </span>
              <h3 className="font-heading text-xl font-bold text-white uppercase">{ch.title}</h3>
              <p className="mt-2 text-xs text-neutral-400 font-sans leading-relaxed">
                {ch.description}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};
