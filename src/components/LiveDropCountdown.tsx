import React, { useState, useEffect } from 'react';
import { ArrowRight } from 'lucide-react';

interface LiveDropCountdownProps {
  onShopDrop: () => void;
}

export const LiveDropCountdown: React.FC<LiveDropCountdownProps> = ({
  onShopDrop,
}) => {
  // Live ticking countdown to simulate limited drop window (e.g. 18 hours 42 mins 15s)
  const [timeLeft, setTimeLeft] = useState({
    hours: 18,
    minutes: 42,
    seconds: 15,
  });

  useEffect(() => {
    const timer = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev.seconds > 0) {
          return { ...prev, seconds: prev.seconds - 1 };
        } else if (prev.minutes > 0) {
          return { ...prev, minutes: 59, seconds: 59 };
        } else if (prev.hours > 0) {
          return { hours: prev.hours - 1, minutes: 59, seconds: 59 };
        } else {
          return { hours: 24, minutes: 0, seconds: 0 };
        }
      });
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  return (
    <section 
      id="live-drop-countdown-section" 
      className="py-12 sm:py-16 px-4 sm:px-6 lg:px-8 bg-gradient-to-b from-[#0c0c12] via-[#140f17] to-[#0c0c12] border-b border-neutral-800/80 relative overflow-hidden"
    >
      {/* Red ambient pulse */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[250px] bg-[#FF2028]/10 blur-[130px] pointer-events-none rounded-full" />

      <div className="max-w-7xl mx-auto relative z-10">
        <div className="p-6 sm:p-10 rounded-3xl bg-[#111118]/90 border border-neutral-800 shadow-2xl backdrop-blur-xl flex flex-col lg:flex-row items-center justify-between gap-8">
          {/* Left Column: Drop Title & Lore */}
          <div className="space-y-3 text-center lg:text-left max-w-xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#FF2028]/10 border border-[#FF2028]/30 text-[#FF2028] text-xs font-mono uppercase tracking-widest">
              <span className="w-2 h-2 rounded-full bg-[#FF2028] animate-ping" />
              <span>LIVE CAMPAIGN // LIMITED PRODUCTION RUN</span>
            </div>

            <h3 className="font-display text-4xl sm:text-6xl font-normal uppercase text-white tracking-[0.04em] leading-[0.95]">
              DROP 001 — <span className="text-[#FF2028]">SHADOW ERA</span>
            </h3>

            <p className="text-sm text-neutral-300">
              Only 250 units per design minted for this drop. Heavyweight 240 GSM combed cotton with high-density archival pigment prints.
            </p>

            <div className="flex flex-wrap items-center justify-center lg:justify-start gap-4 text-xs font-mono text-neutral-400 pt-1">
              <span className="text-white font-bold">5 NEW DESIGNS</span>
              <span>•</span>
              <span className="text-emerald-400">AVAILABLE NOW</span>
              <span>•</span>
              <span>INDIA-WIDE EXPRESS DISPATCH</span>
            </div>
          </div>

          {/* Center / Right: Countdown Timer Blocks & Action */}
          <div className="flex flex-col sm:flex-row items-center gap-6">
            <div className="flex items-center gap-3">
              {/* Hours */}
              <div className="flex flex-col items-center bg-[#171722] border border-neutral-800 rounded-2xl p-3 sm:p-4 min-w-[72px] shadow-lg">
                <span className="font-display text-3xl sm:text-5xl font-normal tracking-[0.04em] text-white tabular-nums leading-none">
                  {String(timeLeft.hours).padStart(2, '0')}
                </span>
                <span className="text-[10px] font-sans font-semibold tracking-[0.08em] text-neutral-400 uppercase mt-1.5">HOURS</span>
              </div>

              <span className="font-display text-3xl text-[#FF2028] font-normal">:</span>

              {/* Minutes */}
              <div className="flex flex-col items-center bg-[#171722] border border-neutral-800 rounded-2xl p-3 sm:p-4 min-w-[72px] shadow-lg">
                <span className="font-display text-3xl sm:text-5xl font-normal tracking-[0.04em] text-white tabular-nums leading-none">
                  {String(timeLeft.minutes).padStart(2, '0')}
                </span>
                <span className="text-[10px] font-sans font-semibold tracking-[0.08em] text-neutral-400 uppercase mt-1.5">MINS</span>
              </div>

              <span className="font-display text-3xl text-[#FF2028] font-normal">:</span>

              {/* Seconds */}
              <div className="flex flex-col items-center bg-[#171722] border border-neutral-800 rounded-2xl p-3 sm:p-4 min-w-[72px] shadow-lg">
                <span className="font-display text-3xl sm:text-5xl font-normal tracking-[0.04em] text-[#FF2028] tabular-nums leading-none">
                  {String(timeLeft.seconds).padStart(2, '0')}
                </span>
                <span className="text-[10px] font-sans font-semibold tracking-[0.08em] text-neutral-400 uppercase mt-1.5">SECS</span>
              </div>
            </div>

            <button
              id="shop-the-drop-btn"
              onClick={onShopDrop}
              className="w-full sm:w-auto px-8 py-4 bg-[#FF2028] hover:bg-[#e02441] text-white font-sans text-sm font-bold uppercase tracking-[0.06em] rounded-xl transition shadow-xl shadow-[#FF2028]/30 active:scale-95 flex items-center justify-center gap-2 cursor-pointer border border-rose-500/50 shrink-0"
            >
              <span>SHOP THE DROP</span>
              <ArrowRight className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>
    </section>
  );
};
