import React, { useState } from 'react';
import { Compass, BookOpen, UserCheck, Eye, Terminal } from 'lucide-react';
import { ORIGINAL_CHARACTERS } from '../data/constants';
import { Product } from '../types';

interface ToriUniverseProps {
  products: Product[];
  onOpenProductDetail: (product: Product) => void;
}

export const ToriUniverseAndCharacters: React.FC<ToriUniverseProps> = ({
  products,
  onOpenProductDetail,
}) => {
  const [selectedCharacterId, setSelectedCharacterId] = useState<string>('tori-01');
  const [activeStoryDesign, setActiveStoryDesign] = useState<number>(0);

  const activeCharacter = ORIGINAL_CHARACTERS.find((c) => c.id === selectedCharacterId) || ORIGINAL_CHARACTERS[0];

  // Design stories from Section 10
  const designStories = [
    {
      title: 'VOID WALKER',
      japanese: '虚空の歩行者',
      catalog: 'TW-DS-01',
      world: 'DARK SHONEN',
      quote: 'THE SHADOW DOES NOT CONCEAL WEAKNESS. IT CREATES DISCIPLINE.',
      lore: 'The feeling of walking through a crowded city and feeling completely alone. The shadow energy represents thoughts kept inside, transformed into an obsidian aura. Features high-density matte puff print with cracked calligraphy detailing.',
      coords: '35.6595° N, 139.7004° E',
      productName: 'Void Walker Graphic Tee',
    },
    {
      title: 'NEON RONIN',
      japanese: 'ネオン浪人',
      catalog: 'TW-CP-01',
      world: 'CYBERPUNK / NEO TOKYO',
      quote: 'A BLADE OF CARBON FIBER. A CODE OF ANCIENT HONOR.',
      lore: 'A samurai who woke up in Neo Tokyo 2087. The holographic hexadecimal code streaming down his left sleeve is a classical Edo poem about honor and rain, compiled into a modern executable.',
      coords: 'SHIBUYA SECTOR 4',
      productName: 'Neon Ronin Heavyweight Tee',
    },
    {
      title: '02:17 AM',
      japanese: '午前二時十七分',
      catalog: 'TW-CP-02',
      world: 'CYBERPUNK / NEO TOKYO',
      quote: 'THE CITY NEVER SLEEPS. IT ONLY WAITS.',
      lore: 'The exact minute when the metropolitan grid is quietest and ideas become dangerous. The coordinates on the chest coordinate with Shibuya crossing when rain washes out the streetlights.',
      coords: '02:17:42 UTC+9',
      productName: '02:17 AM Neo Tokyo Tee',
    },
    {
      title: 'BROKEN BLADE',
      japanese: '折れた刃',
      catalog: 'TW-SM-02',
      world: 'SAMURAI / MYTHIC JAPAN',
      quote: 'NOT ALL DAMAGE IS A DEFEAT. SOME EDGES CUT DEEPER ONCE REBORN.',
      lore: 'Some things break so you have to learn how to fight differently. Inspired by Kintsugi—the Japanese philosophy of repairing broken pottery with liquid gold. The fractured katana print contains subtle gold metallic foil ink.',
      coords: 'KYOTO SANCTUARY',
      productName: 'Broken Blade Samurai Tee',
    },
    {
      title: 'TORI 001',
      japanese: '創世記 零零一',
      catalog: 'TW-SA-01',
      world: 'STREET ANIME',
      quote: 'FOR THE DAY ONES. CHAPTER ZERO OF AN EXPANDING UNIVERSE.',
      lore: 'The genesis silhouette of Toriwear. A completely minimalist front chest stamp with a massive architectural universe schematic across the back panel. Crafted exclusively on heavy 260 GSM drop-shoulder blank.',
      coords: 'ORIGINAL IP // V.1',
      productName: 'Tori 001 Genesis Boxy Tee',
    },
    {
      title: 'PLAYER 01',
      japanese: '第一プレイヤー',
      catalog: 'TWK-RG-01',
      world: 'RETRO GAME',
      quote: 'BLOW DUST OUT OF THE CARTRIDGE. BELIEVE YOU CAN BEAT THE FINAL BOSS.',
      lore: 'Dedicated to the golden generation that grew up with CRT televisions, 8-bit chip tunes, and infinite lives. Features authentic pixel rendering scaled for modern luxury streetwear.',
      coords: 'STAGE 8-4 // ARCADE',
      productName: 'Player 01 Pixel Hero Tee',
    },
  ];

  const currentStory = designStories[activeStoryDesign] ?? designStories[0];
  if (!activeCharacter || !currentStory) return null;

  return (
    <div id="tori-universe-section" className="bg-[#07070a] border-b border-neutral-800/80 select-none">
      {/* SECTION 8: THE TORI UNIVERSE INTRODUCTION */}
      <section className="py-20 border-b border-neutral-800/80 relative overflow-hidden">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[400px] bg-[#FF2028]/10 blur-[150px] pointer-events-none rounded-full" />

        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 text-center relative z-10">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#FF2028]/15 border border-[#FF2028]/30 text-[11px] font-mono uppercase tracking-widest text-[#FF2028] mb-4">
            <Compass className="w-3.5 h-3.5" />
            <span>ORIGINAL NARRATIVE ENGINE</span>
          </div>

          <h2 className="font-heading text-4xl sm:text-6xl font-black text-white tracking-tight uppercase">
            THE TORI <span className="text-[#FF2028]">UNIVERSE</span>
          </h2>

          <p className="mt-4 text-lg sm:text-xl md:text-2xl text-neutral-200 font-medium max-w-3xl mx-auto leading-relaxed">
            “Every character has a story. Every world has a beginning. This is Chapter One.”
          </p>

          <p className="mt-4 text-sm sm:text-base text-neutral-400 max-w-2xl mx-auto font-sans leading-relaxed">
            Toriwear is built on original lore, distinct character mythologies, and authentic Japanese graphic sensibilities. We don't reprint someone else's franchise—we built our own universe from scratch.
          </p>

          {/* Universe Pillars */}
          <div className="mt-12 grid grid-cols-1 sm:grid-cols-3 gap-6 text-left">
            <div className="p-6 rounded-2xl bg-neutral-900/60 border border-neutral-800 backdrop-blur-sm">
              <span className="text-[#FF2028] font-mono text-xs font-bold block mb-2">01 // ORIGINAL CHARACTERS</span>
              <h3 className="font-heading text-xl font-bold text-white uppercase">LORE DRIVEN</h3>
              <p className="mt-2 text-xs text-neutral-400 font-sans leading-relaxed">
                From the silent observation of Tori to the shadowy discipline of Ren and the cyberpunk speed of Yuki, our characters evolve with every seasonal drop.
              </p>
            </div>

            <div className="p-6 rounded-2xl bg-neutral-900/60 border border-neutral-800 backdrop-blur-sm">
              <span className="text-cyan-400 font-mono text-xs font-bold block mb-2">02 // 10 DIVERSE REALMS</span>
              <h3 className="font-heading text-xl font-bold text-white uppercase">DUAL WORLDS</h3>
              <p className="mt-2 text-xs text-neutral-400 font-sans leading-relaxed">
                5 mature streetwear universes for Men and 5 joyful, imaginative story worlds for Kids. Each realm has its own color palette, symbols, and graphic grammar.
              </p>
            </div>

            <div className="p-6 rounded-2xl bg-neutral-900/60 border border-neutral-800 backdrop-blur-sm">
              <span className="text-amber-400 font-mono text-xs font-bold block mb-2">03 // ARTISANAL FABRIC</span>
              <h3 className="font-heading text-xl font-bold text-white uppercase">HEAVYWEIGHT SPECS</h3>
              <p className="mt-2 text-xs text-neutral-400 font-sans leading-relaxed">
                Heavyweight 240–260 GSM combed cotton for Men, 180 GSM bio-washed skin-safe cotton for Kids. Screen printed with high-density archival inks.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* SECTION 9: ORIGINAL CHARACTERS ROSTER */}
      <section className="py-20 border-b border-neutral-800/80 relative">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto mb-12">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-neutral-900 border border-neutral-800 text-[11px] font-mono uppercase tracking-widest text-neutral-300 mb-3">
              <UserCheck className="w-3.5 h-3.5 text-[#FF2028]" />
              <span>MEET THE ROSTER</span>
            </div>
            <h2 className="font-heading text-4xl sm:text-5xl font-black text-white uppercase tracking-tight">
              ORIGINAL <span className="text-[#FF2028]">CHARACTERS</span>
            </h2>
            <p className="mt-2 text-neutral-400 text-sm font-mono">
              Click any character to inspect their lore, philosophy, and signature capsule designs.
            </p>
          </div>

          {/* Character Selector Pills */}
          <div className="flex items-center justify-center gap-2 overflow-x-auto pb-4 mb-10 no-scrollbar">
            {ORIGINAL_CHARACTERS.map((char) => {
              const isSelected = selectedCharacterId === char.id;
              return (
                <button
                  key={char.id}
                  onClick={() => setSelectedCharacterId(char.id)}
                  className={`px-4 py-2 rounded-xl text-xs font-mono font-bold uppercase transition flex items-center gap-2 border cursor-pointer ${
                    isSelected
                      ? 'bg-[#FF2028] text-white border-[#FF2028] shadow-lg shadow-[#FF2028]/25'
                      : 'bg-neutral-900 text-neutral-400 border-neutral-800 hover:text-white hover:border-neutral-700'
                  }`}
                >
                  <span>{char.name}</span>
                  <span className="text-[10px] opacity-70">({char.japanese})</span>
                </button>
              );
            })}
          </div>

          {/* Active Character Profile Showcase */}
          <div className="rounded-3xl bg-[#0f1017] border border-neutral-800 p-6 sm:p-10 grid grid-cols-1 lg:grid-cols-12 gap-8 items-center shadow-2xl">
            {/* Visual Avatar */}
            <div className="lg:col-span-5 relative aspect-[3/4] rounded-2xl overflow-hidden border border-neutral-800 bg-neutral-950">
              <img
                src={activeCharacter.avatarImage}
                alt={activeCharacter.name}
                className="w-full h-full object-cover grayscale contrast-125"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black via-black/30 to-transparent" />
              <div className="absolute bottom-4 left-4 right-4">
                <span className="text-[10px] font-mono uppercase tracking-widest text-[#FF2028] font-bold block">
                  {activeCharacter.japanese} // ROSTER
                </span>
                <span className="font-heading text-3xl font-black text-white uppercase">
                  {activeCharacter.name}
                </span>
                <span className="text-xs text-neutral-300 block font-mono mt-0.5">
                  {activeCharacter.role}
                </span>
              </div>
            </div>

            {/* Character Lore & Details */}
            <div className="lg:col-span-7 flex flex-col justify-between space-y-6">
              <div>
                <div className="flex items-center gap-3">
                  <span className="text-xs font-mono font-bold uppercase px-3 py-1 rounded-full bg-[#FF2028]/15 text-[#FF2028] border border-[#FF2028]/30">
                    {activeCharacter.world}
                  </span>
                  <span className="text-xs font-mono text-neutral-400">
                    SIGNATURE STYLE: <strong className="text-neutral-200">{activeCharacter.signatureStyle}</strong>
                  </span>
                </div>

                <h3 className="font-heading text-3xl sm:text-4xl font-black text-white uppercase mt-4">
                  {activeCharacter.name} — <span className="text-neutral-400 text-2xl">{activeCharacter.role}</span>
                </h3>

                <p className="mt-3 text-neutral-300 text-sm sm:text-base leading-relaxed font-sans">
                  {activeCharacter.biography}
                </p>

                {/* Signature Quote Callout */}
                <div className="mt-6 p-4 rounded-xl bg-neutral-900 border-l-4 border-[#FF2028] text-neutral-200 text-sm font-mono italic">
                  “{activeCharacter.quote}”
                </div>
              </div>

              {/* Personality Tags */}
              <div>
                <span className="text-[10px] font-mono uppercase text-neutral-500 block mb-2 font-bold">
                  CORE TRAITS & ESSENCE
                </span>
                <div className="flex flex-wrap gap-2">
                  {(activeCharacter.personalityTags || activeCharacter.personality || []).map((trait, i) => (
                    <span
                      key={i}
                      className="px-3 py-1 rounded-lg bg-neutral-900 border border-neutral-800 text-xs font-mono text-neutral-300"
                    >
                      {trait}
                    </span>
                  ))}
                </div>
              </div>

              {/* Signature Graphic Capsule */}
              <div className="pt-4 border-t border-neutral-800 flex items-center justify-between">
                <div>
                  <span className="text-[10px] font-mono uppercase text-neutral-400 block">KEY CAPSULE DROP</span>
                  <span className="text-sm font-bold text-white font-mono">{activeCharacter.featuredDesign || activeCharacter.signatureStyle}</span>
                </div>
                {(() => {
                  const searchKey = (activeCharacter.featuredDesign || activeCharacter.name || '').toLowerCase().split(' ')[0] || '';
                  const match = searchKey ? products.find((p) => p.name.toLowerCase().includes(searchKey)) : undefined;
                  if (!match) {
                    return (
                      <span className="px-3 py-1.5 bg-neutral-900 border border-neutral-800 text-neutral-500 rounded text-[11px] font-mono">
                        Drop Upcoming
                      </span>
                    );
                  }
                  return (
                    <button
                      onClick={() => onOpenProductDetail(match)}
                      className="px-4 py-2 bg-neutral-800 hover:bg-[#FF2028] text-white rounded text-xs font-bold font-mono transition flex items-center gap-1.5 cursor-pointer active:scale-95"
                    >
                      <Eye className="w-3.5 h-3.5" />
                      <span>VIEW GEAR</span>
                    </button>
                  );
                })()}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* SECTION 10: THE STORY BEHIND THE DESIGNS */}
      <section className="py-20 relative">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto mb-12">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-neutral-900 border border-neutral-800 text-[11px] font-mono uppercase tracking-widest text-[#FF2028] mb-3">
              <BookOpen className="w-3.5 h-3.5" />
              <span>ARCHIVAL ARCHITECTURE</span>
            </div>
            <h2 className="font-heading text-4xl sm:text-5xl font-black text-white uppercase tracking-tight">
              THE STORY BEHIND <span className="text-[#FF2028]">THE DESIGNS</span>
            </h2>
            <p className="mt-2 text-neutral-400 text-sm font-mono">
              Not random clip art. Every piece has a conceptual thesis, hidden coordinates, and narrative weight.
            </p>
          </div>

          {/* Design Story Tabs */}
          <div className="flex items-center justify-center gap-2 overflow-x-auto pb-4 mb-10 no-scrollbar">
            {designStories.map((ds, index) => {
              const isSelected = activeStoryDesign === index;
              return (
                <button
                  key={ds.title}
                  onClick={() => setActiveStoryDesign(index)}
                  className={`px-4 py-2 rounded-full text-xs font-mono font-bold uppercase transition border whitespace-nowrap cursor-pointer ${
                    isSelected
                      ? 'bg-neutral-100 text-neutral-950 border-white shadow-md'
                      : 'bg-neutral-900 text-neutral-400 border-neutral-800 hover:text-white hover:border-neutral-700'
                  }`}
                >
                  <span>{ds.title}</span>
                </button>
              );
            })}
          </div>

          {/* Story Detail Card */}
          <div className="rounded-2xl bg-[#0c0d14] border border-neutral-800 p-8 sm:p-12 relative overflow-hidden shadow-2xl">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
              <div className="lg:col-span-8">
                <div className="flex flex-wrap items-center gap-3 mb-4">
                  <span className="text-[10px] font-mono font-bold bg-[#FF2028]/20 text-[#FF2028] border border-[#FF2028]/40 px-2.5 py-0.5 rounded uppercase">
                    {currentStory.world}
                  </span>
                  <span className="text-[11px] font-mono text-neutral-400">
                    CATALOG // {currentStory.catalog}
                  </span>
                  <span className="text-[11px] font-mono text-neutral-500">
                    {currentStory.japanese}
                  </span>
                </div>

                <h3 className="font-heading text-3xl sm:text-5xl font-black text-white uppercase tracking-tight">
                  {currentStory.title}
                </h3>

                <div className="mt-4 p-4 rounded-lg bg-neutral-950 border border-neutral-800/80 font-mono text-xs text-neutral-300">
                  <span className="text-[#FF2028] font-bold block mb-1">DESIGN PHILOSOPHY</span>
                  "{currentStory.quote}"
                </div>

                <p className="mt-6 text-neutral-300 text-sm sm:text-base leading-relaxed font-sans">
                  {currentStory.lore}
                </p>

                <div className="mt-8 flex flex-wrap items-center gap-6 text-xs font-mono text-neutral-400">
                  <div>
                    <span className="text-[10px] text-neutral-500 uppercase block">EMBEDDED METADATA</span>
                    <span className="text-neutral-200">{currentStory.coords}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-neutral-500 uppercase block">CORRESPONDING APPAREL</span>
                    <span className="text-white font-bold">{currentStory.productName}</span>
                  </div>
                </div>
              </div>

              <div className="lg:col-span-4 flex flex-col items-center justify-center p-6 bg-neutral-950/70 border border-neutral-800/80 rounded-xl text-center">
                <Terminal className="w-10 h-10 text-[#FF2028] mb-4" />
                <span className="text-xs font-mono font-bold text-neutral-300 uppercase">OFFICIAL PIECE</span>
                <span className="text-sm font-heading font-black text-white uppercase mt-1">
                  {currentStory.productName}
                </span>
                <p className="mt-2 text-xs text-neutral-400">
                  Ready to experience the lore firsthand?
                </p>
                {(() => {
                  const match = products.find((p) => p.name.toLowerCase().includes(currentStory.title.toLowerCase()));
                  if (!match) {
                    return (
                      <span className="mt-6 w-full py-2.5 bg-neutral-900 border border-neutral-800 text-neutral-400 font-mono text-xs font-bold uppercase tracking-wider rounded inline-block">
                        NEXT DROP COMING SOON
                      </span>
                    );
                  }
                  return (
                    <button
                      onClick={() => onOpenProductDetail(match)}
                      className="mt-6 w-full py-3 bg-[#FF2028] hover:bg-[#e02641] text-white font-mono text-xs font-bold uppercase tracking-wider rounded transition shadow-lg shadow-[#FF2028]/20 active:scale-95 cursor-pointer"
                    >
                      INSPECT PRODUCT
                    </button>
                  );
                })()}
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};
