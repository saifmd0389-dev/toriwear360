import React, { useEffect, useRef, useState } from 'react';
import { ArrowRight, ChevronDown, Sparkles } from 'lucide-react';
import { ORIGINAL_CHARACTERS } from '../data/constants';
import { HeroSettings } from '../admin/types';
import { DEFAULT_FRONTPAGE_CMS_DATA, fetchFrontPageCmsDataFromServer } from '../admin/data/frontPageCmsData';
import { ShimmerImage } from './StorefrontSkeletons';

interface HeroProps {
  isLoading?: boolean;
  onShopMen: () => void;
  onShopKids: () => void;
  onExploreChapters?: () => void;
  onOpenSearch?: () => void;
  onOpenCombo?: () => void;
}

export const Hero: React.FC<HeroProps> = ({
  isLoading = false,
  onShopMen,
  onShopKids,
  onOpenCombo,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const mousePosRef = useRef({ x: 0, y: 0 });
  const mouseRafRef = useRef<number | null>(null);

  const renChar = ORIGINAL_CHARACTERS.find((c) => c.name === 'REN');
  const yukiChar = ORIGINAL_CHARACTERS.find((c) => c.name === 'YUKI');

  const [heroSettings, setHeroSettings] = useState<HeroSettings | null>(() => {
    try {
      const saved = localStorage.getItem('tori_admin_heroSettings');
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });

  useEffect(() => {
    let isMounted = true;
    fetchFrontPageCmsDataFromServer()
      .then((cms) => {
        if (isMounted && cms?.hero) {
          setHeroSettings(cms.hero);
        }
      })
      .catch(() => {});

    const handleStorage = (e?: any) => {
      try {
        if (e && 'key' in e && e.key && e.key !== 'tori_admin_heroSettings' && e.key !== 'tori_admin_frontpage_cms') return;
        const detailHero = e?.detail?.hero || (e?.detail?.headline ? e.detail : null);
        if (detailHero) {
          setHeroSettings(detailHero);
          return;
        }
        const saved = localStorage.getItem('tori_admin_heroSettings');
        if (saved) {
          const parsed = JSON.parse(saved);
          setHeroSettings(prev => {
            if (JSON.stringify(prev) === saved) return prev;
            return parsed;
          });
        }
      } catch (err) {
        console.error(err);
      }
    };
    window.addEventListener('storage', handleStorage);
    window.addEventListener('tori_hero_updated', handleStorage);
    window.addEventListener('tori-cms-updated', handleStorage);
    window.addEventListener('focus', handleStorage);
    return () => {
      isMounted = false;
      window.removeEventListener('storage', handleStorage);
      window.removeEventListener('tori_hero_updated', handleStorage);
      window.removeEventListener('tori-cms-updated', handleStorage);
      window.removeEventListener('focus', handleStorage);
    };
  }, []);

  // Handle smooth mouse parallax via direct CSS variables for 60fps smoothness
  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width - 0.5) * 2;
    const y = ((e.clientY - rect.top) / rect.height - 0.5) * 2;
    mousePosRef.current = { x, y };

    if (mouseRafRef.current === null) {
      mouseRafRef.current = requestAnimationFrame(() => {
        mouseRafRef.current = null;
        if (containerRef.current) {
          containerRef.current.style.setProperty('--mx', `${x}`);
          containerRef.current.style.setProperty('--my', `${y}`);
        }
      });
    }
  };

  // Subtle atmospheric particle canvas animation and global mouse tracking
  useEffect(() => {
    const handleGlobalMouseMove = (e: MouseEvent) => {
      if (!containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const x = ((e.clientX - rect.left) / rect.width - 0.5) * 2;
      const y = ((e.clientY - rect.top) / rect.height - 0.5) * 2;
      mousePosRef.current = { x, y };

      if (mouseRafRef.current === null) {
        mouseRafRef.current = requestAnimationFrame(() => {
          mouseRafRef.current = null;
          if (containerRef.current) {
            containerRef.current.style.setProperty('--mx', `${x}`);
            containerRef.current.style.setProperty('--my', `${y}`);
          }
        });
      }
    };
    window.addEventListener('mousemove', handleGlobalMouseMove, { passive: true });

    const canvas = canvasRef.current;
    if (!canvas) return () => window.removeEventListener('mousemove', handleGlobalMouseMove);
    const ctx = canvas.getContext('2d');
    if (!ctx) return () => window.removeEventListener('mousemove', handleGlobalMouseMove);

    let animationFrameId: number;
    let width = (canvas.width = canvas.offsetWidth);
    let height = (canvas.height = canvas.offsetHeight);

    const handleResize = () => {
      if (!canvas) return;
      width = canvas.width = canvas.offsetWidth;
      height = canvas.height = canvas.offsetHeight;
    };
    window.addEventListener('resize', handleResize);

    const particleCount = 18;
    const particles = Array.from({ length: particleCount }, () => ({
      x: Math.random() * width,
      y: Math.random() * height,
      vx: (Math.random() - 0.5) * 0.2,
      vy: -0.15 - Math.random() * 0.2,
      size: Math.random() * 1.5 + 0.5,
      opacity: Math.random() * 0.35 + 0.1,
    }));

    const render = () => {
      ctx.clearRect(0, 0, width, height);

      const mx = mousePosRef.current.x;
      particles.forEach((p) => {
        p.x += p.vx + mx * 0.04;
        p.y += p.vy;

        if (p.x < 0) p.x = width;
        if (p.x > width) p.x = 0;
        if (p.y < 0) p.y = height;
        if (p.y > height) p.y = 0;

        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(244, 242, 237, ${p.opacity * 0.4})`;
        ctx.fill();
      });

      animationFrameId = requestAnimationFrame(render);
    };

    render();

    return () => {
      window.removeEventListener('mousemove', handleGlobalMouseMove);
      window.removeEventListener('resize', handleResize);
      cancelAnimationFrame(animationFrameId);
      if (mouseRafRef.current) cancelAnimationFrame(mouseRafRef.current);
    };
  }, []);

  const leftCardImg = heroSettings?.leftCardImage || renChar?.avatarUrl || 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=800&auto=format&fit=crop&q=80';
  const leftCardTag = heroSettings?.leftCardTag || 'ORIGINAL LORE · 01';
  const leftCardTitle = heroSettings?.leftCardTitle || 'REN // DARK SHONEN';
  const leftCardDesc = heroSettings?.leftCardDesc || '“Some people run from the darkness. He learned to walk through it.”';

  const rightCardImg = heroSettings?.rightCardImage || yukiChar?.avatarUrl || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=800&auto=format&fit=crop&q=80';
  const rightCardTag = heroSettings?.rightCardTag || 'ORIGINAL LORE · 02';
  const rightCardTitle = heroSettings?.rightCardTitle || 'YUKI // CYBERPUNK';
  const rightCardDesc = heroSettings?.rightCardDesc || '“Midnight runs through rain-slicked neon alleys of Neo Tokyo.”';

  const defaultBg = DEFAULT_FRONTPAGE_CMS_DATA.hero.bgImage;
  const defaultMob = DEFAULT_FRONTPAGE_CMS_DATA.hero.mobileImage;
  const desktopBg = heroSettings?.bgImage || heroSettings?.mobileImage || 'https://images.unsplash.com/photo-1509198397868-475647b2a1e5?w=1600&auto=format&fit=crop&q=80';
  // If user customized bgImage without updating mobileImage, mirror bgImage to mobile automatically
  const hasCustomMobile = Boolean(heroSettings?.mobileImage && heroSettings.mobileImage !== defaultMob);
  const hasCustomDesktop = Boolean(heroSettings?.bgImage && heroSettings.bgImage !== defaultBg);
  const mobileBg = hasCustomMobile
    ? heroSettings!.mobileImage!
    : hasCustomDesktop
      ? heroSettings!.bgImage!
      : (heroSettings?.mobileImage || desktopBg);

  return (
    <section
      id="hero-section"
      ref={containerRef}
      onMouseMove={handleMouseMove}
      className="relative min-h-[82vh] sm:min-h-[88vh] lg:min-h-[calc(94vh+5cm)] w-full max-w-full box-border flex flex-col justify-between overflow-hidden bg-[#050505] border-b border-[#171717] select-none text-white pt-28 sm:pt-36 lg:pt-[calc(8rem+5cm)]"
    >
      {/* Editorial Streetwear Atmosphere Backdrop */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden max-w-full">
        {!isLoading && (
          <>
            <ShimmerImage
              src={mobileBg}
              alt="TORI-WEAR Anime Streetwear Editorial Mobile"
              theme="dark"
              wrapperClassName="w-full h-full sm:hidden"
              referrerPolicy="no-referrer"
              className="w-full h-full object-cover object-center opacity-30 filter grayscale contrast-125 scale-105"
            />
            <ShimmerImage
              src={desktopBg}
              alt="TORI-WEAR Anime Streetwear Editorial"
              theme="dark"
              wrapperClassName="hidden sm:block w-full h-full"
              referrerPolicy="no-referrer"
              className="w-full h-full object-cover object-center opacity-25 filter grayscale contrast-125 scale-105"
            />
          </>
        )}
        {/* Cinematic Scrim & Vignette Gradient (driven by CMS overlayOpacity) */}
        <div
          className="absolute inset-0 bg-gradient-to-t from-[#050505] via-[#050505]/85 to-[#050505]/75"
          style={{
            opacity: Math.min(1, Math.max(0.15, (heroSettings?.overlayOpacity ?? 75) / 100)),
          }}
        />
        <div className="absolute inset-0 bg-radial-at-center from-transparent via-[#050505]/60 to-[#050505]" />
      </div>

      {/* Interactive Particle Canvas */}
      <canvas
        ref={canvasRef}
        className="absolute inset-0 w-full h-full pointer-events-none z-10"
      />

      {/* Subtle brand typography watermark in background */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none select-none opacity-[0.04] overflow-hidden max-w-full px-4">
        <span className="font-display text-[17vw] sm:text-[18vw] lg:text-[19vw] font-normal tracking-[0.06em] text-[#FFFFFF] uppercase whitespace-nowrap leading-none">
          TORIWEAR
        </span>
      </div>

      {/* Editorial Left Character Anchor (Ren - Dark Shonen) - Desktop floating parallax */}
      <div
        className="absolute top-[calc(6rem+5cm)] left-6 xl:left-14 w-44 xl:w-52 aspect-[3/4] rounded-2xl overflow-hidden border border-neutral-800/90 bg-[#151515] pointer-events-none opacity-40 lg:opacity-85 transition-transform duration-300 ease-out z-10 hidden lg:block shadow-2xl"
        style={{
          transform: 'translate3d(calc(var(--mx, 0) * -14px), calc(var(--my, 0) * -10px), 0)',
        }}
      >
        {isLoading ? (
          <div className="w-full h-full skeleton-dark" />
        ) : (
          <div className="relative w-full h-full p-4 flex flex-col justify-end">
            <ShimmerImage
              src={leftCardImg}
              alt={leftCardTitle}
              theme="dark"
              wrapperClassName="absolute inset-0"
              referrerPolicy="no-referrer"
              className="w-full h-full object-cover opacity-60"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black via-black/40 to-transparent" />
            <div className="relative z-10">
              <span className="text-[10px] font-mono text-[#FF2028] font-bold block tracking-wider uppercase mb-0.5">
                {leftCardTag}
              </span>
              <span className="text-sm font-heading font-black text-white uppercase tracking-tight block">
                {leftCardTitle}
              </span>
              <span className="text-[11px] text-neutral-300 font-sans block mt-1 line-clamp-2">
                {leftCardDesc}
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Editorial Right Character Anchor (Yuki - Cyberpunk) - Desktop floating parallax */}
      <div
        className="absolute top-[calc(6rem+5cm)] right-6 xl:right-14 w-44 xl:w-52 aspect-[3/4] rounded-2xl overflow-hidden border border-neutral-800/90 bg-[#151515] pointer-events-none opacity-40 lg:opacity-85 transition-transform duration-300 ease-out z-10 hidden lg:block shadow-2xl"
        style={{
          transform: 'translate3d(calc(var(--mx, 0) * 14px), calc(var(--my, 0) * 10px), 0)',
        }}
      >
        {isLoading ? (
          <div className="w-full h-full skeleton-dark" />
        ) : (
          <div className="relative w-full h-full p-4 flex flex-col justify-end">
            <ShimmerImage
              src={rightCardImg}
              alt={rightCardTitle}
              theme="dark"
              wrapperClassName="absolute inset-0"
              referrerPolicy="no-referrer"
              className="w-full h-full object-cover opacity-60"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black via-black/40 to-transparent" />
            <div className="relative z-10">
              <span className="text-[10px] font-mono text-cyan-400 font-bold block tracking-wider uppercase mb-0.5">
                {rightCardTag}
              </span>
              <span className="text-sm font-heading font-black text-white uppercase tracking-tight block">
                {rightCardTitle}
              </span>
              <span className="text-[11px] text-neutral-300 font-sans block mt-1 line-clamp-2">
                {rightCardDesc}
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Center Stage Container */}
      {isLoading ? (
        <div
          aria-busy="true"
          aria-label="Loading storefront hero"
          className="w-full max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 pt-10 sm:pt-16 pb-8 sm:pb-12 relative z-20 text-center flex flex-col items-center justify-center flex-grow box-border"
        >
          <div className="h-7 w-72 sm:w-80 rounded-full skeleton-dark border border-neutral-800 mb-6" />
          <div className="h-14 sm:h-20 w-72 sm:w-[460px] rounded-2xl skeleton-dark mb-3" />
          <div className="h-14 sm:h-20 w-56 sm:w-[340px] rounded-2xl skeleton-dark mb-6" />
          <div className="h-4 w-72 sm:w-96 rounded skeleton-dark mb-2" />
          <div className="h-4 w-56 sm:w-72 rounded skeleton-dark mb-8" />
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 sm:gap-4 w-full max-w-[300px] sm:max-w-none mx-auto">
            <div className="w-full sm:w-40 h-14 rounded-xl skeleton-dark" />
            <div className="w-full sm:w-40 h-14 rounded-xl skeleton-dark" />
            <div className="w-full sm:w-52 h-14 rounded-xl skeleton-dark" />
          </div>
          <div className="mt-8 w-full max-w-md mx-auto grid grid-cols-2 gap-3 lg:hidden">
            <div className="aspect-[3/4] rounded-2xl skeleton-dark border border-neutral-800/90" />
            <div className="aspect-[3/4] rounded-2xl skeleton-dark border border-neutral-800/90" />
          </div>
          <div className="mt-8 flex items-center justify-center gap-4">
            <div className="h-3.5 w-28 rounded skeleton-dark" />
            <div className="h-3.5 w-32 rounded skeleton-dark" />
            <div className="h-3.5 w-28 rounded skeleton-dark hidden sm:block" />
          </div>
        </div>
      ) : (
        <div className="w-full max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 pt-10 sm:pt-16 pb-8 sm:pb-12 relative z-20 text-center flex flex-col items-center justify-center flex-grow box-border skeleton-reveal">
          {/* Pre-header Tag */}
          <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-neutral-900/90 border border-neutral-800 text-[10px] sm:text-[11px] font-mono font-medium tracking-[0.2em] sm:tracking-[0.25em] text-neutral-300 uppercase mb-4 backdrop-blur-md max-w-full">
            <span>{heroSettings?.preheaderTag || 'ORIGINAL TOKYO-INSPIRED STREETWEAR'}</span>
            <span className="text-neutral-600">·</span>
            <span className="text-red-500 font-bold">{heroSettings?.preheaderHighlight || '240 GSM'}</span>
          </div>

          {/* Main Headline */}
          <h1 className="text-5xl sm:text-7xl md:text-8xl lg:text-[6.25rem] font-display font-normal tracking-[0.04em] text-white uppercase leading-[0.92] max-w-3xl mx-auto my-3 sm:my-5">
            {(() => {
              const rawHeadline = (heroSettings?.headline || 'WEAR YOUR WORLD.').trim();
              const words = rawHeadline.split(/\s+/);
              if (words.length <= 1) {
                return (
                  <span className="text-transparent bg-clip-text bg-gradient-to-r from-red-500 via-rose-500 to-amber-500">
                    {rawHeadline}
                  </span>
                );
              }
              const lastWord = words[words.length - 1];
              const prefix = words.slice(0, -1).join(' ');
              return (
                <>
                  <span>{prefix} </span>
                  <span className="text-transparent bg-clip-text bg-gradient-to-r from-red-500 via-rose-500 to-amber-500">
                    {lastWord}
                  </span>
                </>
              );
            })()}
          </h1>

          {/* Supporting Description */}
          <p className="mt-4 sm:mt-6 text-sm sm:text-base text-neutral-300 font-normal w-full max-w-lg mx-auto px-2 sm:px-0 leading-relaxed tracking-wide font-sans">
            {heroSettings?.subheadline || 'Original anime-inspired streetwear created for people who live between imagination and reality.'}
          </p>

          {/* Primary Action Buttons: SHOP MEN, SHOP KIDS, TRY COMBO */}
          <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3 sm:gap-4 w-full max-w-[300px] sm:max-w-none mx-auto">
            {/* Primary CTA: SHOP MEN (respects CMS ctaLink) */}
            <button
              id="hero-shop-men-btn"
              onClick={() => {
                const link = (heroSettings?.ctaLink || '/men').trim();
                if (link === '/kids') {
                  onShopKids();
                } else if (link.startsWith('#')) {
                  const el = document.getElementById(link.slice(1));
                  el?.scrollIntoView({ behavior: 'smooth' });
                } else if (/^https?:\/\//i.test(link)) {
                  window.location.href = link;
                } else {
                  onShopMen();
                }
              }}
              className="w-full sm:w-auto px-8 py-4 bg-white hover:bg-neutral-200 text-black font-sans font-bold text-sm uppercase tracking-[0.06em] rounded-xl transition active:scale-95 flex items-center justify-center gap-2 cursor-pointer shadow-xl"
            >
              <span>{heroSettings?.ctaText || 'SHOP MEN'}</span>
              <ArrowRight className="w-4 h-4 text-black" />
            </button>

            {/* Secondary CTA: SHOP KIDS */}
            <button
              id="hero-shop-kids-btn"
              onClick={onShopKids}
              className="w-full sm:w-auto px-8 py-4 bg-[#151515] hover:bg-[#222222] text-white border border-neutral-700 hover:border-neutral-500 font-sans font-semibold text-sm uppercase tracking-[0.06em] rounded-xl transition active:scale-95 flex items-center justify-center gap-2 cursor-pointer"
            >
              <span>{heroSettings?.secondaryCtaText || 'SHOP KIDS'}</span>
              <Sparkles className="w-4 h-4 text-sky-400" />
            </button>

            {/* Tertiary CTA: TRY COMBO TWINNING */}
            {onOpenCombo && (
              <button
                id="hero-try-combo-btn"
                onClick={onOpenCombo}
                className="w-full sm:w-auto px-6 py-3.5 bg-gradient-to-r from-amber-500/20 via-amber-500/10 to-transparent hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 rounded-xl text-xs font-sans font-semibold uppercase tracking-[0.06em] transition flex items-center justify-center gap-2 cursor-pointer"
              >
                <span>{heroSettings?.tertiaryCtaText || 'TRY TWIN COMBO 👯'}</span>
                <span className="text-[10px] bg-emerald-500/20 text-emerald-400 px-1.5 py-0.5 rounded font-semibold">{heroSettings?.tertiaryCtaBadge || 'SAVE 10%'}</span>
              </button>
            )}
          </div>

          {/* Mobile & Tablet Character Showcase Cards (Visible < lg so Hero character art stays visible on phones) */}
          <div className="mt-8 w-full max-w-md mx-auto grid grid-cols-2 gap-3 lg:hidden text-left">
            <div className="relative aspect-[3/4] rounded-2xl overflow-hidden border border-neutral-800/90 bg-[#151515] shadow-xl">
              <ShimmerImage
                src={leftCardImg}
                alt={leftCardTitle}
                theme="dark"
                wrapperClassName="absolute inset-0"
                referrerPolicy="no-referrer"
                className="w-full h-full object-cover opacity-75"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black via-black/45 to-transparent" />
              <div className="relative z-10 h-full p-3 flex flex-col justify-end">
                <span className="text-[9px] font-mono text-[#FF2028] font-bold block tracking-wider uppercase mb-0.5">
                  {leftCardTag}
                </span>
                <span className="text-xs sm:text-sm font-heading font-black text-white uppercase tracking-tight block leading-tight">
                  {leftCardTitle}
                </span>
                <span className="text-[10px] text-neutral-300 font-sans block mt-1 line-clamp-2 leading-snug">
                  {leftCardDesc}
                </span>
              </div>
            </div>

            <div className="relative aspect-[3/4] rounded-2xl overflow-hidden border border-neutral-800/90 bg-[#151515] shadow-xl">
              <ShimmerImage
                src={rightCardImg}
                alt={rightCardTitle}
                theme="dark"
                wrapperClassName="absolute inset-0"
                referrerPolicy="no-referrer"
                className="w-full h-full object-cover opacity-75"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black via-black/45 to-transparent" />
              <div className="relative z-10 h-full p-3 flex flex-col justify-end">
                <span className="text-[9px] font-mono text-cyan-400 font-bold block tracking-wider uppercase mb-0.5">
                  {rightCardTag}
                </span>
                <span className="text-xs sm:text-sm font-heading font-black text-white uppercase tracking-tight block leading-tight">
                  {rightCardTitle}
                </span>
                <span className="text-[10px] text-neutral-300 font-sans block mt-1 line-clamp-2 leading-snug">
                  {rightCardDesc}
                </span>
              </div>
            </div>
          </div>

          {/* Quality Commitments Strip */}
          <div className="mt-6 sm:mt-10 flex flex-wrap items-center justify-center gap-2 sm:gap-6 text-neutral-400 text-[10px] sm:text-[11px] font-mono tracking-wide px-2 text-center">
            <span>{heroSettings?.trustBadge1 || '240 GSM Combed Cotton'}</span>
            <span className="text-neutral-700 hidden sm:inline">·</span>
            <span>{heroSettings?.trustBadge2 || '100% Original Japanese Anime IP'}</span>
            <span className="text-neutral-700 hidden sm:inline">·</span>
            <span>{heroSettings?.trustBadge3 || 'Free Pan-India Delivery Over ₹999'}</span>
          </div>
        </div>
      )}

      {/* Bottom Scroll Indicator */}
      <div className="relative z-20 pb-4 sm:pb-5 text-center">
        <button
          onClick={() => {
            const el = document.getElementById('choose-your-world-section');
            el?.scrollIntoView({ behavior: 'smooth' });
          }}
          className="inline-flex flex-col items-center gap-1 text-[10px] font-mono tracking-[0.2em] text-neutral-500 hover:text-white transition uppercase cursor-pointer"
        >
          <span>CHOOSE YOUR WORLD</span>
          <ChevronDown className="w-3.5 h-3.5 animate-bounce text-neutral-400" />
        </button>
      </div>
    </section>
  );
};
