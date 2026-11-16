import React from 'react';
import { Department, MenWorldCategory, KidsWorldCategory } from '../types';

interface MobileCategoryCirclesProps {
  activeDepartment: Department | 'ALL';
  onSelectDepartment: (dept: Department | 'ALL') => void;
  onSelectWorld: (world: MenWorldCategory | KidsWorldCategory | string) => void;
  onScrollToSection: (sectionId: string) => void;
}

export const MobileCategoryCircles: React.FC<MobileCategoryCirclesProps> = ({
  activeDepartment,
  onSelectDepartment,
  onSelectWorld,
  onScrollToSection,
}) => {
  const circles = [
    {
      id: 'all',
      name: 'ALL',
      image: 'https://images.unsplash.com/photo-1509198397868-475647b2a1e5?w=200&auto=format&fit=crop&q=80',
      action: () => {
        onSelectDepartment('ALL');
        window.scrollTo({ top: 0, behavior: 'smooth' });
      },
    },
    {
      id: 'men',
      name: 'MEN',
      badge: '240 GSM',
      image: 'https://images.unsplash.com/photo-1578632767115-351597cf2477?w=200&auto=format&fit=crop&q=80',
      action: () => {
        onSelectDepartment('MEN');
        onScrollToSection('shop-men-section');
      },
    },
    {
      id: 'kids',
      name: 'KIDS',
      badge: '2–13Y',
      image: 'https://images.unsplash.com/photo-1516627145497-ae6968895b74?w=200&auto=format&fit=crop&q=80',
      action: () => {
        onSelectDepartment('KIDS');
        onScrollToSection('shop-kids-section');
      },
    },
    {
      id: 'shonen',
      name: 'SHONEN',
      badge: 'NOIR',
      image: 'https://images.unsplash.com/photo-1578632767115-351597cf2477?w=200&auto=format&fit=crop&q=80',
      action: () => {
        onSelectDepartment('MEN');
        onSelectWorld('DARK SHONEN');
        onScrollToSection('shop-men-section');
      },
    },
    {
      id: 'cyberpunk',
      name: 'CYBER',
      badge: '2087',
      image: 'https://images.unsplash.com/photo-1509198397868-475647b2a1e5?w=200&auto=format&fit=crop&q=80',
      action: () => {
        onSelectDepartment('MEN');
        onSelectWorld('CYBERPUNK / NEO TOKYO');
        onScrollToSection('shop-men-section');
      },
    },
    {
      id: 'retro',
      name: 'Y2K',
      badge: '1999',
      image: 'https://images.unsplash.com/photo-1550684848-fac1c5b4e853?w=200&auto=format&fit=crop&q=80',
      action: () => {
        onSelectDepartment('MEN');
        onSelectWorld('RETRO Y2K');
        onScrollToSection('shop-men-section');
      },
    },
    {
      id: 'samurai',
      name: 'SAMURAI',
      badge: 'RONIN',
      image: 'https://images.unsplash.com/photo-1563089145-599997674d42?w=200&auto=format&fit=crop&q=80',
      action: () => {
        onSelectDepartment('MEN');
        onSelectWorld('SAMURAI / MYTHIC JAPAN');
        onScrollToSection('shop-men-section');
      },
    },
    {
      id: 'new-drop',
      name: 'NEW DROP',
      badge: 'HOT',
      image: 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=200&auto=format&fit=crop&q=80',
      action: () => {
        onScrollToSection(activeDepartment === 'KIDS' ? 'shop-kids-section' : 'shop-men-section');
      },
    },
  ];

  return (
    <div 
      id="myntra-mobile-story-circles"
      className="lg:hidden w-full bg-[#0E0E12] border-b border-neutral-800/80 py-3 px-3 select-none overflow-x-auto no-scrollbar"
    >
      <div className="flex items-center gap-3.5 min-w-max px-1">
        {circles.map((item) => (
          <button
            key={item.id}
            onClick={item.action}
            className="flex flex-col items-center group cursor-pointer active:scale-95 transition"
          >
            <div className="relative w-14 h-14 rounded-full p-0.5 bg-gradient-to-tr from-[#FF2028] via-amber-400 to-sky-400 group-hover:scale-105 transition-transform duration-300">
              <div className="w-full h-full rounded-full overflow-hidden bg-black p-0.5">
                <img
                  src={item.image}
                  alt={item.name}
                  referrerPolicy="no-referrer"
                  className="w-full h-full rounded-full object-cover"
                />
              </div>
              {item.badge && (
                <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 bg-[#FF2028] text-white text-[8px] font-mono font-bold px-1.5 py-0.2 rounded-full uppercase shadow">
                  {item.badge}
                </span>
              )}
            </div>
            <span className="text-[10px] font-mono font-bold tracking-tight text-neutral-300 group-hover:text-white mt-1.5 uppercase">
              {item.name}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
};
