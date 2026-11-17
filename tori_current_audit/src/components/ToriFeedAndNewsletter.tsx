import React, { useState, useEffect } from 'react';
import { Send, Check, ArrowRight, Terminal, Copy } from 'lucide-react';
import { InstagramIcon, WhatsAppIcon, FacebookIcon, YouTubeIcon, XTwitterIcon } from './SocialIcons';
import { loadFrontPageCmsData } from '../admin/data/frontPageCmsData';
import {
  getAuthoritativeInstagramUrl,
  getInstagramHandleFromUrl,
  normalizeSocialUrl,
} from '../utils/socialLinks';
import { ShimmerImage, ToriFeedGridSkeleton } from './StorefrontSkeletons';
import { apiClient } from '../services/apiClient';

const FALLBACK_FEED_POSTS = [
  {
    id: 'post-1',
    tag: 'ORIGINAL IP // SKETCHPAD',
    title: 'Ren’s Mask Anatomy v.04',
    date: 'SEPTEMBER 2026',
    image: 'https://images.unsplash.com/photo-1578632767115-351597cf2477?w=600&auto=format&fit=crop&q=80',
    caption: 'Initial charcoal studies for Ren’s fractured Kitsune-Oni hybrid battle mask. We wanted sharp geometric vents rather than soft curves.',
    likes: '2,491',
  },
  {
    id: 'post-2',
    tag: 'STREET SNAP // SHIBUYA',
    title: '02:17 AM in the Rain',
    date: 'SEPTEMBER 2026',
    image: 'https://images.unsplash.com/photo-1509198397868-475647b2a1e5?w=600&auto=format&fit=crop&q=80',
    caption: 'Late night drop test in Tokyo. The waterproof 3M reflective ink on the back panel catching headlights.',
    likes: '3,812',
  },
  {
    id: 'post-3',
    tag: 'KIDS LAB // CHARACTER DESIGN',
    title: 'Kami & Zero Concept Sheet',
    date: 'SEPTEMBER 2026',
    image: 'https://images.unsplash.com/photo-1516627145497-ae6968895b74?w=600&auto=format&fit=crop&q=80',
    caption: 'Meet Kami: a tiny cloud spirit obsessed with retro sneakers. And Zero: a discarded arcade assistant robot who found a new friend.',
    likes: '1,940',
  },
  {
    id: 'post-4',
    tag: 'ATELIER // PRINT LAB',
    title: 'Screen Printing 240 GSM Obsidian',
    date: 'SEPTEMBER 2026',
    image: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=600&auto=format&fit=crop&q=80',
    caption: 'Hand-pulled high-density plastisol layers on 240 GSM combed cotton. Built to endure 100+ wash cycles without cracking.',
    likes: '4,105',
  },
];

export const ToriFeed: React.FC<{ isLoading?: boolean }> = ({ isLoading = false }) => {
  const [socialFeed, setSocialFeed] = useState(() => loadFrontPageCmsData().socialFeed);
  const [instagramUrl, setInstagramUrl] = useState(() => getAuthoritativeInstagramUrl());

  useEffect(() => {
    const sync = () => {
      setSocialFeed(loadFrontPageCmsData().socialFeed);
      setInstagramUrl(getAuthoritativeInstagramUrl());
    };
    window.addEventListener('tori-cms-updated', sync);
    window.addEventListener('storage', sync);
    return () => {
      window.removeEventListener('tori-cms-updated', sync);
      window.removeEventListener('storage', sync);
    };
  }, []);

  const instagramHandle = getInstagramHandleFromUrl(instagramUrl);

  const feedPosts = (socialFeed?.posts && socialFeed.posts.length > 0)
    ? socialFeed.posts.filter((p) => p.enabled !== false).map((p, idx) => ({
        id: p.id,
        tag: `${(p.platform || 'INSTAGRAM').toUpperCase()} // ATELIER`,
        title: p.handle || instagramHandle,
        date: socialFeed.marqueePhrases?.[idx] || 'CHAPTER 01',
        image: p.imageUrl || FALLBACK_FEED_POSTS[idx % FALLBACK_FEED_POSTS.length]?.image || FALLBACK_FEED_POSTS[0]?.image || '',
        caption: p.caption || '',
        likes: String(p.likes ?? '1,240'),
        linkUrl: normalizeSocialUrl(p.linkUrl, instagramUrl),
      }))
    : FALLBACK_FEED_POSTS.map((post) => ({ ...post, linkUrl: instagramUrl }));

  return (
    <section id="tori-feed-section" className="py-20 bg-[#08080c] border-b border-neutral-800/80 relative select-none">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-12">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-neutral-900 border border-neutral-800 text-[11px] font-mono uppercase tracking-widest text-[#FF2028] mb-3">
              <InstagramIcon className="w-3.5 h-3.5" />
              <span>THE DESIGN ATELIER</span>
            </div>
            <h2 className="font-heading text-4xl sm:text-5xl font-black text-white uppercase tracking-tight">
              ENTER THE <span className="text-[#FF2028]">TORI FEED</span>
            </h2>
            <p className="mt-1 font-mono text-sm text-neutral-400">
              Behind the scenes. Process sketches, character development notes, and community style.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 sm:gap-3">
            <div className="flex items-center gap-1.5 bg-neutral-900 border border-neutral-800 p-1 rounded-xl">
              <a
                href={instagramUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="p-2 rounded-lg text-neutral-400 hover:text-white hover:bg-neutral-800 transition"
                aria-label="Instagram"
                title={`Instagram ${instagramHandle}`}
              >
                <InstagramIcon className="w-4 h-4" />
              </a>
              <a
                href="https://wa.me/919876543210?text=Hi%20TORIWEAR!"
                target="_blank"
                rel="noopener noreferrer"
                className="p-2 rounded-lg text-neutral-400 hover:text-[#25D366] hover:bg-neutral-800 transition"
                aria-label="WhatsApp"
                title="WhatsApp Channel"
              >
                <WhatsAppIcon className="w-4 h-4" />
              </a>
              <a
                href="https://facebook.com/toriwear"
                target="_blank"
                rel="noopener noreferrer"
                className="p-2 rounded-lg text-neutral-400 hover:text-sky-400 hover:bg-neutral-800 transition"
                aria-label="Facebook"
                title="Facebook"
              >
                <FacebookIcon className="w-4 h-4" />
              </a>
              <a
                href="https://x.com/toriwear"
                target="_blank"
                rel="noopener noreferrer"
                className="p-2 rounded-lg text-neutral-400 hover:text-white hover:bg-neutral-800 transition"
                aria-label="X"
                title="X"
              >
                <XTwitterIcon className="w-4 h-4" />
              </a>
              <a
                href="https://youtube.com/@toriwear"
                target="_blank"
                rel="noopener noreferrer"
                className="p-2 rounded-lg text-neutral-400 hover:text-[#FF2028] hover:bg-neutral-800 transition"
                aria-label="YouTube"
                title="YouTube"
              >
                <YouTubeIcon className="w-4 h-4" />
              </a>
            </div>

            <a
              href={instagramUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-neutral-900 border border-neutral-800 text-neutral-300 hover:text-white hover:border-[#FF2028] transition text-xs font-mono font-bold uppercase"
            >
              <span>FOLLOW {instagramHandle.toUpperCase()}</span>
              <ArrowRight className="w-4 h-4" />
            </a>
          </div>
        </div>

        {isLoading ? (
          <ToriFeedGridSkeleton />
        ) : (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-6 skeleton-reveal">
          {feedPosts.map((post) => (
            <a
              key={post.id}
              href={post.linkUrl || instagramUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-xl sm:rounded-2xl bg-[#0f1017] border border-neutral-800 hover:border-neutral-600 transition-all duration-300 overflow-hidden flex flex-col justify-between group shadow-lg"
            >
              <div className="relative aspect-square overflow-hidden bg-neutral-900">
                <ShimmerImage
                  src={post.image}
                  alt={post.title}
                  theme="dark"
                  wrapperClassName="w-full h-full"
                  referrerPolicy="no-referrer"
                  className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-transparent opacity-80" />

                <div className="absolute top-2 left-2 sm:top-3 sm:left-3">
                  <span className="text-[8px] sm:text-[9px] font-mono font-bold tracking-wider bg-black/80 backdrop-blur-md text-[#FF2028] px-1.5 sm:px-2 py-0.5 rounded uppercase border border-neutral-800">
                    {post.tag}
                  </span>
                </div>

                <div className="absolute bottom-2 left-2 right-2 sm:bottom-3 sm:left-3 sm:right-3 text-white">
                  <div className="text-[11px] sm:text-xs font-mono font-bold uppercase truncate">{post.title}</div>
                  <div className="text-[9px] sm:text-[10px] text-neutral-400 font-mono mt-0.5 flex items-center justify-between gap-1">
                    <span className="truncate">{post.date}</span>
                    <span className="text-rose-400 shrink-0">♥ {post.likes}</span>
                  </div>
                </div>
              </div>

              <div className="p-2.5 sm:p-4 flex-grow flex flex-col justify-between">
                <p className="text-[11px] sm:text-xs text-neutral-300 font-sans leading-relaxed line-clamp-3">
                  {post.caption}
                </p>
                <div className="mt-2 sm:mt-3 pt-2 border-t border-neutral-800/80 flex items-center justify-between text-[9px] sm:text-[10px] font-mono text-neutral-500">
                  <span className="truncate">ATELIER DESK</span>
                  <span className="shrink-0">#TORIWEAR</span>
                </div>
              </div>
            </a>
          ))}
        </div>
        )}
      </div>
    </section>
  );
};

export const NewsletterSection: React.FC = () => {
  const [email, setEmail] = useState('');
  const [emailConsent, setEmailConsent] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [confirmedData, setConfirmedData] = useState<{
    message: string;
    couponCode?: string | null;
  } | null>(null);
  const [copied, setCopied] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    if (!email.trim()) {
      setErrorMsg('Please enter your email address.');
      return;
    }
    if (!emailConsent) {
      setErrorMsg('Please check the email notification consent box before joining.');
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await apiClient.subscribeNewsletter({
        email: email.trim(),
        emailConsent,
        registrationSource: 'NEWSLETTER_SIGNUP',
      });
      if (!res.success) {
        setErrorMsg(res.error || 'Could not complete newsletter registration right now.');
        return;
      }
      setConfirmedData({
        message: res.message || 'You are now registered on the TORIWEAR Access List.',
        couponCode: res.coupon?.active && res.coupon?.eligible ? res.coupon.code : null,
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCopyCode = () => {
    if (!confirmedData?.couponCode) return;
    navigator.clipboard?.writeText(confirmedData.couponCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <section id="newsletter-section" className="py-20 bg-[#06070a] border-b border-neutral-800/80 relative overflow-hidden select-none">
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[350px] bg-[#FF2028]/10 blur-[150px] pointer-events-none rounded-full" />

      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center relative z-10">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#FF2028]/15 border border-[#FF2028]/30 text-[11px] font-mono uppercase tracking-widest text-[#FF2028] mb-4">
          <Terminal className="w-3.5 h-3.5" />
          <span>JOIN THE COMMUNITY</span>
        </div>

        <h2 className="font-heading text-4xl sm:text-6xl font-black text-white uppercase tracking-tight">
          ENTER THE <span className="text-[#FF2028]">UNIVERSE</span>
        </h2>

        <p className="mt-3 text-lg sm:text-xl font-mono text-neutral-200 uppercase font-semibold">
          NEW DROPS. NEW CHARACTERS. NEW CHAPTERS.
        </p>

        <p className="mt-2 text-sm text-neutral-400 max-w-xl mx-auto font-sans leading-relaxed">
          Sign up to receive private drop alerts, lore chapters, limited collector cards, and eligible early-access member benefits.
        </p>

        {confirmedData ? (
          <div className="mt-8 p-6 rounded-2xl bg-neutral-900/90 border border-emerald-500/40 max-w-lg mx-auto animate-in fade-in">
            <div className="flex items-center justify-center gap-2 text-emerald-400 font-mono font-bold text-sm mb-2">
              <Check className="w-5 h-5" />
              <span>YOU ARE NOW ON THE ACCESS LIST</span>
            </div>
            <p className="text-xs text-neutral-300 font-sans">
              {confirmedData.message}
            </p>
            {confirmedData.couponCode && (
              <div className="mt-3 flex items-center justify-center gap-3">
                <span className="font-mono text-xl font-black bg-black/60 px-4 py-1.5 rounded-lg border border-neutral-700 text-[#FF2028] tracking-widest">
                  {confirmedData.couponCode}
                </span>
                <button
                  type="button"
                  onClick={handleCopyCode}
                  className="p-2 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-white transition text-xs font-mono flex items-center gap-1 cursor-pointer"
                >
                  {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                  <span>{copied ? 'COPIED' : 'COPY'}</span>
                </button>
              </div>
            )}
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="mt-8 max-w-lg mx-auto space-y-3">
            <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
              <input
                type="email"
                required
                placeholder="Enter your email address..."
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={isSubmitting}
                className="w-full sm:flex-grow px-4 py-3.5 rounded-xl bg-neutral-900 border border-neutral-800 text-white placeholder-neutral-500 text-sm focus:outline-none focus:border-[#FF2028] transition disabled:opacity-60"
              />
              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full sm:w-auto px-6 py-3.5 bg-[#FF2028] hover:bg-[#e02641] text-white font-mono text-xs font-bold uppercase tracking-wider rounded-xl transition shadow-lg shadow-[#FF2028]/25 active:scale-95 flex items-center justify-center gap-2 whitespace-nowrap cursor-pointer disabled:opacity-60"
              >
                <span>{isSubmitting ? 'SUBSCRIBING...' : 'JOIN ACCESS LIST'}</span>
                <Send className="w-4 h-4" />
              </button>
            </div>
            <label className="flex items-center justify-center gap-2 text-xs font-mono text-neutral-400 cursor-pointer">
              <input
                type="checkbox"
                checked={emailConsent}
                onChange={(e) => setEmailConsent(e.target.checked)}
                disabled={isSubmitting}
                className="accent-[#FF2028] cursor-pointer"
              />
              <span>I consent to receive TORIWEAR drop alerts and launch emails.</span>
            </label>
            {errorMsg && (
              <div className="text-xs font-mono text-red-400 bg-red-950/40 border border-red-500/30 rounded-xl px-3 py-2">
                {errorMsg}
              </div>
            )}
          </form>
        )}

        <div className="mt-6 flex flex-wrap items-center justify-center gap-4 text-xs font-mono text-neutral-400">
          <span>✓ NO SPAM GUARANTEE</span>
          <span>•</span>
          <span>✓ EARLY DROP ACCESS</span>
          <span>•</span>
          <span>✓ UNSUBSCRIBE ANYTIME</span>
        </div>
      </div>
    </section>
  );
};
