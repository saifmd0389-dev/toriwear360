import React from 'react';

/**
 * 100% Original, Copyright-Free Chibi & Cartoon Wallpaper Pattern for Toriwear Kids.
 * Featuring original Tori Lore characters:
 * - Kami: Fluffy cloud hero with wings & sneakers
 * - Chibi Taro: Little ninja fox with headband
 * - Sparky: Kawaii ramen-loving electric cat
 * - Boba Kuma: Baby bear hugging bubble tea
 * - Piko: Cute baby mech bird with goggles
 * - Playful doodles: stars, lightning bolts, mini sneakers, hearts, and clouds.
 */
export const KidsCartoonWallpaper: React.FC = () => {
  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden select-none z-0">
      {/* Soft playful pastel gradient base */}
      <div className="absolute inset-0 bg-gradient-to-b from-sky-50/70 via-white to-amber-50/50" />

      {/* Floating Original Cartoon Characters & Doodles */}
      <div className="absolute inset-0 opacity-[0.22] transition-opacity">
        {/* Character 1: Kami - The Sneaker Cloud (Top-Left) */}
        <div className="absolute top-12 left-4 sm:left-12 w-28 sm:w-36 h-28 sm:h-36 animate-float-slow">
          <svg viewBox="0 0 160 160" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-full drop-shadow-sm">
            {/* Fluffy Cloud Body */}
            <path
              d="M45 105C32 105 20 94 20 80C20 68 28 58 40 56C44 38 60 25 80 25C102 25 120 40 123 60C134 62 142 71 142 82C142 95 131 105 118 105H45Z"
              fill="#E0F2FE"
              stroke="#0284C7"
              strokeWidth="4"
              strokeLinejoin="round"
            />
            {/* Cute Anime Eyes & Blush */}
            <circle cx="65" cy="72" r="5" fill="#0F172A" />
            <circle cx="95" cy="72" r="5" fill="#0F172A" />
            <ellipse cx="52" cy="78" rx="6" ry="3.5" fill="#F43F5E" opacity="0.6" />
            <ellipse cx="108" cy="78" rx="6" ry="3.5" fill="#F43F5E" opacity="0.6" />
            {/* Happy Smile */}
            <path d="M74 78C76 83 84 83 86 78" stroke="#0F172A" strokeWidth="3" strokeLinecap="round" />
            {/* Cute Angel Wing */}
            <path d="M125 55C138 48 148 55 145 68C142 78 128 75 125 70" fill="#BAE6FD" stroke="#0284C7" strokeWidth="3" />
            {/* Tiny Sneakers */}
            <rect x="52" y="105" width="22" height="12" rx="6" fill="#F43F5E" stroke="#0F172A" strokeWidth="2.5" />
            <rect x="86" y="105" width="22" height="12" rx="6" fill="#0284C7" stroke="#0F172A" strokeWidth="2.5" />
          </svg>
          <span className="block text-center font-mono text-[9px] font-bold text-sky-800 tracking-wider">KAMI CLOUD</span>
        </div>

        {/* Character 2: Chibi Taro - Ninja Fox (Top-Right) */}
        <div className="absolute top-20 right-6 sm:right-16 w-28 sm:w-36 h-28 sm:h-36">
          <svg viewBox="0 0 160 160" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-full drop-shadow-sm">
            {/* Fox Head & Ears */}
            <path d="M40 50L60 95L80 115L100 95L120 50L95 65L80 68L65 65L40 50Z" fill="#FB923C" stroke="#C2410C" strokeWidth="4" />
            {/* Inner Ears */}
            <polygon points="50,55 60,80 68,66" fill="#FEF3C7" />
            <polygon points="110,55 100,80 92,66" fill="#FEF3C7" />
            {/* Tori Headband */}
            <rect x="50" y="70" width="60" height="12" rx="3" fill="#0F172A" />
            <circle cx="80" cy="76" r="3" fill="#F43F5E" />
            {/* Muzzle & Nose */}
            <ellipse cx="80" cy="100" rx="16" ry="12" fill="#FFFFFF" />
            <polygon points="76,96 84,96 80,101" fill="#0F172A" />
            {/* Ninja Eyes */}
            <path d="M62 88C67 85 73 88 73 88" stroke="#0F172A" strokeWidth="3" strokeLinecap="round" />
            <path d="M98 88C93 85 87 88 87 88" stroke="#0F172A" strokeWidth="3" strokeLinecap="round" />
          </svg>
          <span className="block text-center font-mono text-[9px] font-bold text-orange-800 tracking-wider">CHIBI TARO</span>
        </div>

        {/* Character 3: Sparky - Ramen Cat (Middle-Left) */}
        <div className="absolute top-[42%] left-6 sm:left-14 w-28 sm:w-36 h-28 sm:h-36">
          <svg viewBox="0 0 160 160" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-full drop-shadow-sm">
            {/* Cat Head */}
            <circle cx="80" cy="75" r="40" fill="#FEF08A" stroke="#CA8A04" strokeWidth="4" />
            {/* Pointy Ears */}
            <polygon points="45,55 40,25 70,42" fill="#FEF08A" stroke="#CA8A04" strokeWidth="4" />
            <polygon points="115,55 120,25 90,42" fill="#FEF08A" stroke="#CA8A04" strokeWidth="4" />
            {/* Star Anime Eyes */}
            <path d="M65 68L67 74L73 75L68 79L70 85L65 81L60 85L62 79L57 75L63 74Z" fill="#0F172A" />
            <path d="M95 68L97 74L103 75L98 79L100 85L95 81L90 85L92 79L87 75L93 74Z" fill="#0F172A" />
            {/* Whiskers */}
            <line x1="42" y1="80" x2="28" y2="78" stroke="#0F172A" strokeWidth="2.5" strokeLinecap="round" />
            <line x1="42" y1="86" x2="30" y2="90" stroke="#0F172A" strokeWidth="2.5" strokeLinecap="round" />
            <line x1="118" y1="80" x2="132" y2="78" stroke="#0F172A" strokeWidth="2.5" strokeLinecap="round" />
            <line x1="118" y1="86" x2="130" y2="90" stroke="#0F172A" strokeWidth="2.5" strokeLinecap="round" />
            {/* Ramen Bowl */}
            <path d="M55 100C55 120 105 120 105 100H55Z" fill="#EF4444" stroke="#0F172A" strokeWidth="3" />
            <path d="M68 95Q75 90 82 95Q90 90 95 95" stroke="#FBBF24" strokeWidth="3" fill="none" />
          </svg>
          <span className="block text-center font-mono text-[9px] font-bold text-amber-800 tracking-wider">SPARKY NEKO</span>
        </div>

        {/* Character 4: Boba Kuma - Baby Bear (Middle-Right) */}
        <div className="absolute top-[48%] right-4 sm:right-12 w-28 sm:w-36 h-28 sm:h-36">
          <svg viewBox="0 0 160 160" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-full drop-shadow-sm">
            {/* Round Ears */}
            <circle cx="48" cy="48" r="16" fill="#D97706" stroke="#78350F" strokeWidth="3.5" />
            <circle cx="48" cy="48" r="8" fill="#FDE68A" />
            <circle cx="112" cy="48" r="16" fill="#D97706" stroke="#78350F" strokeWidth="3.5" />
            <circle cx="112" cy="48" r="8" fill="#FDE68A" />
            {/* Bear Face */}
            <circle cx="80" cy="78" r="42" fill="#D97706" stroke="#78350F" strokeWidth="4" />
            <ellipse cx="80" cy="88" rx="18" ry="14" fill="#FDE68A" />
            <circle cx="80" cy="84" r="5" fill="#0F172A" />
            <circle cx="64" cy="70" r="4.5" fill="#0F172A" />
            <circle cx="96" cy="70" r="4.5" fill="#0F172A" />
            {/* Boba Cup */}
            <path d="M66 102L70 135H90L94 102H66Z" fill="#C084FC" stroke="#0F172A" strokeWidth="3" />
            <line x1="80" y1="92" x2="80" y2="120" stroke="#EC4899" strokeWidth="4" strokeLinecap="round" />
            <circle cx="75" cy="128" r="2.5" fill="#0F172A" />
            <circle cx="85" cy="128" r="2.5" fill="#0F172A" />
            <circle cx="80" cy="122" r="2.5" fill="#0F172A" />
          </svg>
          <span className="block text-center font-mono text-[9px] font-bold text-amber-900 tracking-wider">BOBA KUMA</span>
        </div>

        {/* Character 5: Piko - Mech Bird (Bottom-Left) */}
        <div className="absolute bottom-20 left-8 sm:left-16 w-24 sm:w-32 h-24 sm:h-32">
          <svg viewBox="0 0 160 160" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-full drop-shadow-sm">
            {/* Round Baby Bird Body */}
            <circle cx="80" cy="80" r="38" fill="#67E8F9" stroke="#0891B2" strokeWidth="4" />
            {/* Cute Mech Visor */}
            <rect x="52" y="65" width="56" height="18" rx="9" fill="#0F172A" />
            <rect x="56" y="69" width="22" height="10" rx="5" fill="#22D3EE" />
            <rect x="82" y="69" width="22" height="10" rx="5" fill="#22D3EE" />
            {/* Beak */}
            <polygon points="73,88 87,88 80,98" fill="#F59E0B" stroke="#0F172A" strokeWidth="2.5" />
            {/* Antenna with Heart Light */}
            <line x1="80" y1="42" x2="80" y2="28" stroke="#0891B2" strokeWidth="3" strokeLinecap="round" />
            <circle cx="80" cy="24" r="5" fill="#F43F5E" />
          </svg>
          <span className="block text-center font-mono text-[9px] font-bold text-cyan-800 tracking-wider">PIKO MECH</span>
        </div>

        {/* Character 6: Star Surfer Mochi (Bottom-Right) */}
        <div className="absolute bottom-16 right-8 sm:right-20 w-24 sm:w-32 h-24 sm:h-32">
          <svg viewBox="0 0 160 160" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-full drop-shadow-sm">
            {/* Giant Star */}
            <path
              d="M80 20L95 60L138 65L105 95L115 138L80 115L45 138L55 95L22 65L65 60Z"
              fill="#FDE047"
              stroke="#CA8A04"
              strokeWidth="4"
              strokeLinejoin="round"
            />
            {/* Happy Eyes */}
            <circle cx="70" cy="78" r="4" fill="#0F172A" />
            <circle cx="90" cy="78" r="4" fill="#0F172A" />
            <path d="M76 85Q80 89 84 85" stroke="#0F172A" strokeWidth="2.5" strokeLinecap="round" />
            <ellipse cx="62" cy="83" rx="4" ry="2.5" fill="#F43F5E" opacity="0.7" />
            <ellipse cx="98" cy="83" rx="4" ry="2.5" fill="#F43F5E" opacity="0.7" />
          </svg>
          <span className="block text-center font-mono text-[9px] font-bold text-yellow-800 tracking-wider">STAR MOCHI</span>
        </div>

        {/* Dotted / Cross Hatch Comic Accents */}
        <div className="absolute top-1/3 left-1/2 -translate-x-1/2 w-full max-w-5xl flex justify-around opacity-40">
          <span className="text-xl">✨</span>
          <span className="text-xl">⚡</span>
          <span className="text-xl">⭐</span>
          <span className="text-xl">👟</span>
          <span className="text-xl">🍙</span>
          <span className="text-xl">☁️</span>
        </div>
      </div>
    </div>
  );
};
