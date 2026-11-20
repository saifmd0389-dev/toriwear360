import React from 'react';
import { Home, Sparkles, ShoppingBag, Flame } from 'lucide-react';
import { Department } from '../types';
import { WishlistHeartIcon } from './WishlistHeartIcon';

interface MobileBottomNavProps {
  cartCount: number;
  wishlistCount: number;
  activeDepartment?: Department | 'ALL';
  onNavigateHome: () => void;
  onSelectDepartment?: (dept: Department) => void;
  onOpenWishlist: () => void;
  onOpenCart: () => void;
}

export const MobileBottomNav: React.FC<MobileBottomNavProps> = ({
  cartCount,
  wishlistCount,
  activeDepartment = 'ALL',
  onNavigateHome,
  onSelectDepartment,
  onOpenWishlist,
  onOpenCart,
}) => {
  return (
    <nav 
      id="mobile-bottom-nav"
      className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-[#050505]/95 backdrop-blur-md border-t border-[#171717] py-1.5 px-2 flex items-center justify-around select-none shadow-[0_-4px_25px_rgba(0,0,0,0.8)]"
      style={{ paddingBottom: 'calc(0.375rem + env(safe-area-inset-bottom, 0px))' }}
      aria-label="Mobile Navigation"
    >
      {/* 1. Home */}
      <button
        onClick={onNavigateHome}
        className={`flex flex-col items-center justify-center py-1 px-2.5 transition active:scale-95 cursor-pointer ${
          activeDepartment === 'ALL' ? 'text-white' : 'text-neutral-400 hover:text-white'
        }`}
        aria-label="Home"
      >
        <Home className={`w-5 h-5 ${activeDepartment === 'ALL' ? 'text-white' : 'text-neutral-400'}`} />
        <span className={`text-[10px] font-heading tracking-[0.06em] mt-0.5 ${
          activeDepartment === 'ALL' ? 'text-white font-semibold' : 'text-neutral-400 font-medium'
        }`}>
          HOME
        </span>
      </button>

      {/* 2. Men's Wear */}
      <button
        onClick={() => onSelectDepartment?.('MEN')}
        className={`flex flex-col items-center justify-center py-1 px-2.5 transition active:scale-95 cursor-pointer ${
          activeDepartment === 'MEN' ? 'text-[#FF2028]' : 'text-neutral-400 hover:text-white'
        }`}
        aria-label="Shop Men"
      >
        <Flame className={`w-5 h-5 ${activeDepartment === 'MEN' ? 'text-[#FF2028]' : 'text-neutral-400'}`} />
        <span className={`text-[10px] font-heading tracking-[0.06em] mt-0.5 ${
          activeDepartment === 'MEN' ? 'text-[#FF2028] font-semibold' : 'text-neutral-400 font-medium'
        }`}>
          MEN
        </span>
      </button>

      {/* 3. Kids' Wear */}
      <button
        onClick={() => onSelectDepartment?.('KIDS')}
        className={`flex flex-col items-center justify-center py-1 px-2.5 transition active:scale-95 cursor-pointer ${
          activeDepartment === 'KIDS' ? 'text-sky-400' : 'text-neutral-400 hover:text-white'
        }`}
        aria-label="Shop Kids"
      >
        <Sparkles className={`w-5 h-5 ${activeDepartment === 'KIDS' ? 'text-sky-400' : 'text-neutral-400'}`} />
        <span className={`text-[10px] font-heading tracking-[0.06em] mt-0.5 ${
          activeDepartment === 'KIDS' ? 'text-sky-400 font-semibold' : 'text-neutral-400 font-medium'
        }`}>
          KIDS
        </span>
      </button>

      {/* 4. Wishlist */}
      <button
        onClick={onOpenWishlist}
        className="flex flex-col items-center justify-center py-1 px-2.5 text-neutral-400 hover:text-white transition active:scale-95 relative cursor-pointer"
        aria-label="Wishlist"
      >
        <div className="relative">
          <WishlistHeartIcon
            pulseOnIncrement={wishlistCount}
            className="w-5 h-5 text-neutral-400 hover:text-white"
          />
          {wishlistCount > 0 && (
            <span className="absolute -top-1.5 -right-2 bg-[#FF2028] text-white text-[9px] font-semibold font-sans tabular-nums w-4 h-4 rounded-full flex items-center justify-center border border-[#050505]">
              {wishlistCount > 9 ? '9+' : wishlistCount}
            </span>
          )}
        </div>
        <span className="text-[10px] font-heading font-medium tracking-[0.06em] mt-0.5 text-neutral-400">
          WISHLIST
        </span>
      </button>

      {/* 5. Bag */}
      <button
        onClick={onOpenCart}
        className="flex flex-col items-center justify-center py-1 px-2.5 text-neutral-400 hover:text-white transition active:scale-95 relative cursor-pointer"
        aria-label="Shopping Bag"
      >
        <div className="relative">
          <ShoppingBag className="w-5 h-5 text-white" />
          {cartCount > 0 && (
            <span className="absolute -top-1.5 -right-2 bg-[#FF2028] text-white text-[9px] font-semibold font-sans tabular-nums w-4 h-4 rounded-full flex items-center justify-center border border-[#050505]">
              {cartCount > 9 ? '9+' : cartCount}
            </span>
          )}
        </div>
        <span className="text-[10px] font-heading tracking-[0.06em] mt-0.5 text-white font-semibold">
          BAG
        </span>
      </button>
    </nav>
  );
};

