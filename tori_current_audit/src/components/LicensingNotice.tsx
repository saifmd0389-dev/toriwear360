import React from 'react';
import { ShieldCheck, Sparkles, Scale } from 'lucide-react';

export const LicensingNotice: React.FC = () => {
  return (
    <div className="bg-[#0b0b10] border-t border-b border-neutral-800/80 py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-start md:items-center justify-between gap-6 p-6 rounded-2xl bg-[#111118] border border-neutral-800/90 text-xs font-mono">
        <div className="flex items-start gap-3.5 max-w-3xl">
          <div className="w-9 h-9 rounded-xl bg-blue-950/60 border border-blue-800/60 flex items-center justify-center text-blue-400 shrink-0 mt-0.5">
            <Scale className="w-5 h-5" />
          </div>
          <div className="space-y-1">
            <div className="font-bold text-white uppercase flex items-center gap-2">
              <span>INTELLECTUAL PROPERTY & LICENSING TRANSPARENCY</span>
              <span className="bg-blue-900/40 text-blue-300 border border-blue-800/60 text-[9px] px-2 py-0.2 rounded font-mono">
                OFFICIAL POLICY
              </span>
            </div>
            <p className="text-neutral-400 leading-relaxed font-sans text-xs">
              <strong className="text-neutral-200">Licensed Partner Collections:</strong> Hero capsules (Marvel, DC, Avengers, Disney) are presented as authorized partner collaborations and licensed commercial concepts.
              <br />
              <strong className="text-purple-300">Toriwear Originals:</strong> Characters including Tori, Kai, Ren, Yuki, and Aki are 100% proprietary, in-house designed intellectual property developed by TORIWEAR STORE India.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          <div className="flex items-center gap-1.5 text-neutral-300 bg-neutral-900 border border-neutral-800 px-3 py-1.5 rounded-xl">
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            <span>Verified Drops</span>
          </div>
          <div className="flex items-center gap-1.5 text-purple-300 bg-purple-950/40 border border-purple-900/60 px-3 py-1.5 rounded-xl">
            <Sparkles className="w-4 h-4 text-purple-400" />
            <span>Original Tokyo IP</span>
          </div>
        </div>
      </div>
    </div>
  );
};
