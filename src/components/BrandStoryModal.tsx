import React from 'react';
import { X, CheckCircle2 } from 'lucide-react';
import { OfficialToriwearLogo } from './OfficialToriwearLogo';

interface BrandStoryModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const BrandStoryModal: React.FC<BrandStoryModalProps> = ({ isOpen, onClose }) => {
  // Keyboard shortcut (Escape) to close modal
  React.useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Prevent background page scrolling when brand story modal is open
  React.useEffect(() => {
    if (!isOpen) return;
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = originalOverflow;
    };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div 
      style={{ zIndex: 9999 }}
      className="fixed inset-0 z-[9999] flex items-center justify-center p-3 sm:p-6 bg-black/85 backdrop-blur-md overflow-y-auto animate-in fade-in select-none"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
    >
      <div 
        id="brand-story-modal"
        className="bg-[#0f1017] border border-neutral-800 w-full max-w-2xl rounded-2xl overflow-hidden shadow-2xl my-auto animate-in zoom-in-95 max-h-[90vh] flex flex-col"
      >
        {/* Header */}
        <div className="p-5 border-b border-neutral-800 bg-[#141520] flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <OfficialToriwearLogo className="h-8 sm:h-9 w-auto max-w-[140px] object-contain" />
          </div>
          <button
            onClick={onClose}
            className="min-w-[40px] min-h-[40px] flex items-center justify-center p-2 text-neutral-400 hover:text-white rounded-lg hover:bg-neutral-800 transition cursor-pointer"
            aria-label="Close Story"
            title="Close Story (Esc)"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 sm:p-8 overflow-y-auto space-y-8 text-neutral-300 text-sm leading-relaxed">
          {/* Brand Manifesto */}
          <section className="space-y-4">
            <div className="text-xs font-mono uppercase tracking-widest text-[#FF2028] font-bold">
              THE BRAND DIRECTION
            </div>
            <h3 className="font-heading text-3xl font-black text-white uppercase">
              AN ORIGINAL ANIME-INSPIRED STREETWEAR BRAND
            </h3>
            <p>
              Anime was never just something we watched on a screen. It was late-night episodes, mythical battles, the philosophies we adopted, and the worlds that stayed with us long after the credits rolled.
            </p>
            <p>
              Most anime apparel is just cheap polyester with a screenshot slapped on the chest. We believed anime culture deserved better.
            </p>
            <p className="text-white font-medium">
              TORIWEAR creates its own universe: original characters, proprietary artwork, mythologies, stories, typography, and graphic systems.
            </p>
            <p>
              We capture the intensity of dark shonen, the pulse of Neo Tokyo cyberpunk, the nostalgic glow of retro Y2K, and the honor of mythic samurai—crafted on heavy 240–260 GSM combed cotton blanks that fit like luxury streetwear.
            </p>

            <div className="p-5 rounded-2xl bg-black/60 border border-neutral-800 font-heading text-lg sm:text-xl text-[#FF2028] tracking-wide space-y-1">
              <div className="text-neutral-400 text-xs font-mono uppercase tracking-widest font-normal">OUR CORE THESIS</div>
              <div>NOT A FAN TEE.</div>
              <div>YOUR UNIVERSE.</div>
              <div>WEAR THE STORY.</div>
              <div className="text-white pt-2 font-mono text-xs uppercase tracking-[0.25em]">
                TORIWEAR — WEAR YOUR WORLD.
              </div>
            </div>
          </section>

          {/* Dual Departments: Men & Kids */}
          <section className="border-t border-neutral-800 pt-6 space-y-4">
            <div className="text-xs font-mono uppercase tracking-widest text-sky-400 font-bold">
              DUAL WORLDS
            </div>
            <h3 className="font-heading text-2xl font-bold text-white uppercase">
              FOR EVERY GENERATION OF STORYTELLERS
            </h3>
            <p>
              We design two distinct store worlds under one roof:
            </p>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="p-4 rounded-xl bg-neutral-900 border border-neutral-800">
                <span className="text-[#FF2028] font-mono text-xs font-bold block mb-1">DEPARTMENT 01 // MEN</span>
                <div className="text-white font-bold mb-1">5 Dark Anime Streetwear Universes</div>
                <p className="text-xs text-neutral-400">
                  Heavyweight 240–260 GSM combed cotton. Oversized boxy drape. High-density plastisol and matte puff prints.
                </p>
              </div>

              <div className="p-4 rounded-xl bg-neutral-900 border border-neutral-800">
                <span className="text-sky-400 font-mono text-xs font-bold block mb-1">DEPARTMENT 02 // KIDS</span>
                <div className="text-white font-bold mb-1">5 Whimsical Story Worlds (2–13Y)</div>
                <p className="text-xs text-neutral-400">
                  Ultra-soft 180 GSM bio-washed cotton. Friendly companion characters like Kami & Zero. Skin-safe water-based inks.
                </p>
              </div>
            </div>
          </section>

          {/* Intellectual Property Notice */}
          <div className="border-t border-neutral-800 pt-4 text-xs font-mono text-neutral-400 flex items-start gap-2.5">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0 mt-0.5" />
            <span>
              100% In-House Original IP. All character names, visual lore, story cards, and garment designs are proprietary trademarks of Toriwear Apparel Pvt. Ltd. Not affiliated with Marvel, DC, Disney, or existing anime franchises.
            </span>
          </div>

          <button
            onClick={onClose}
            className="w-full py-3 bg-[#FF2028] hover:bg-[#e02641] text-white text-xs font-mono font-bold uppercase rounded-xl transition cursor-pointer"
          >
            RETURN TO THE UNIVERSE
          </button>
        </div>
      </div>
    </div>
  );
};
