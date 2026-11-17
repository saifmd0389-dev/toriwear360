import React, { useState, useEffect } from 'react';
import { ChevronDown, HelpCircle } from 'lucide-react';
import { FAQS } from '../data/constants';
import { loadFrontPageCmsData } from '../admin/data/frontPageCmsData';

export const FaqSection: React.FC = () => {
  const [openIndex, setOpenIndex] = useState<number | null>(0);
  const [cmsFaqs, setCmsFaqs] = useState(() => loadFrontPageCmsData().faqs);

  useEffect(() => {
    const sync = () => setCmsFaqs(loadFrontPageCmsData().faqs);
    window.addEventListener('tori-cms-updated', sync);
    window.addEventListener('storage', sync);
    return () => {
      window.removeEventListener('tori-cms-updated', sync);
      window.removeEventListener('storage', sync);
    };
  }, []);

  const displayFaqs = (cmsFaqs && cmsFaqs.length > 0)
    ? cmsFaqs.filter((f) => f.enabled !== false).sort((a, b) => (a.order || 0) - (b.order || 0))
    : FAQS;

  const toggle = (idx: number) => {
    setOpenIndex(openIndex === idx ? null : idx);
  };

  return (
    <section id="faq-section" className="py-16 sm:py-24 bg-[#0a0a0d] border-b border-neutral-800/80">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-12 space-y-2">
          <div className="text-xs font-mono uppercase tracking-widest text-[#FF2028] font-bold flex items-center justify-center gap-1.5">
            <HelpCircle className="w-4 h-4 text-[#FF2028]" />
            <span>FREQUENTLY ASKED QUESTIONS</span>
          </div>
          <h2 className="font-heading text-4xl sm:text-5xl font-black text-white uppercase tracking-tight">
            EVERYTHING YOU NEED TO KNOW
          </h2>
          <p className="text-sm text-neutral-400">
            Answers regarding sizing, Pan-India shipping, exchanges, licensing, and garment care.
          </p>
        </div>

        <div className="space-y-3">
          {displayFaqs.map((faq, idx) => {
            const isOpen = openIndex === idx;
            return (
              <div
                key={idx}
                className="rounded-2xl bg-[#121218] border border-neutral-800/80 overflow-hidden transition"
              >
                <button
                  onClick={() => toggle(idx)}
                  className="w-full p-5 text-left flex items-center justify-between gap-4 hover:bg-[#161622] transition"
                >
                  <span className="font-heading text-lg sm:text-xl font-bold text-white tracking-wide">
                    {faq.question}
                  </span>
                  <div className={`w-8 h-8 rounded-full bg-neutral-900 border border-neutral-800 flex items-center justify-center text-neutral-400 transition-transform ${isOpen ? 'rotate-180 text-[#FF2028]' : ''}`}>
                    <ChevronDown className="w-4 h-4" />
                  </div>
                </button>

                {isOpen && (
                  <div className="px-5 pb-5 text-sm text-neutral-300 leading-relaxed font-normal border-t border-neutral-800/60 pt-3 animate-in fade-in">
                    {faq.answer}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
};
