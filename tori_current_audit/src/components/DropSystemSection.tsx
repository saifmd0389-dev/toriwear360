import React from 'react';
import { DROPS } from '../data/constants';
import { Sparkles, ArrowRight } from 'lucide-react';

interface DropSystemSectionProps {
  onSelectDrop: (dropId: string) => void;
}

export const DropSystemSection: React.FC<DropSystemSectionProps> = ({ onSelectDrop }) => {
  return (
    <section id="drop-system-section" className="py-16 sm:py-24 bg-[#0a0a0d] border-b border-neutral-800/80 relative overflow-hidden">
      {/* Background Accent Lines */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        <div className="flex flex-col md:flex-row md:items-end justify-between mb-12 gap-4">
          <div>
            <div className="flex items-center gap-2 text-xs font-mono uppercase tracking-widest text-[#FF2028] font-bold">
              <Sparkles className="w-4 h-4 text-[#FF2028]" />
              <span>THE TORIWEAR DROP PROTOCOL</span>
            </div>
            <h2 className="font-heading text-4xl sm:text-5xl font-black text-white uppercase tracking-tight mt-1">
              LIMITED COLLECTION DROPS
            </h2>
            <p className="text-sm text-neutral-400 mt-1 max-w-xl">
              Instead of random merch, every Toriwear release is an engineered batch collection crafted with heavyweight cotton and custom artwork.
            </p>
          </div>

          <div className="text-xs font-mono text-neutral-500">
            CURRENT PHASE: 2026 ROADMAP
          </div>
        </div>

        {/* Drops Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4">
          {DROPS.map((drop) => (
            <div
              key={drop.id}
              onClick={() => onSelectDrop(drop.id)}
              className="group cursor-pointer rounded-2xl p-5 bg-[#121218] border border-neutral-800 hover:border-[#FF2028]/60 transition-all duration-300 flex flex-col justify-between hover:shadow-xl hover:shadow-[#FF2028]/10"
            >
              <div>
                <div className="flex items-center justify-between text-[10px] font-mono text-neutral-400 mb-3">
                  <span className="text-[#FF2028] font-bold">{drop.id}</span>
                  <span className="bg-black/60 border border-neutral-800 px-2 py-0.5 rounded text-neutral-300 font-semibold">
                    {drop.badge}
                  </span>
                </div>

                <h3 className="font-heading text-2xl font-bold text-white group-hover:text-[#FF2028] transition-colors">
                  {drop.title}
                </h3>

                <p className="text-xs text-neutral-400 mt-2 line-clamp-3 leading-relaxed">
                  {drop.subtitle}
                </p>
              </div>

              <div className="pt-6 mt-4 border-t border-neutral-800/80 flex items-center justify-between text-xs font-mono">
                <span className="text-neutral-500">{drop.count}</span>
                <span className="text-white group-hover:text-[#FF2028] font-bold flex items-center gap-1">
                  VIEW <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};
