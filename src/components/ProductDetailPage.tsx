import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import {
  ChevronDown,
  ChevronUp,
  ChevronLeft,
  ChevronRight,
  ZoomIn,
  ZoomOut,
  RotateCw,
  X,
  AlertCircle,
  Images,
  Plus,
  Minus,
  Maximize2,
  Scale,
} from 'lucide-react';
import { Product } from '../types';
import { useCustomerAuth } from '../context/CustomerAuthContext';
import { RecentlyViewedSection } from './RecentlyViewedSection';
import { WishlistHeartIcon } from './WishlistHeartIcon';
import { getAuthoritativeInstagramUrl } from '../utils/socialLinks';
import { ShimmerImage, ProductDetailSkeleton } from './StorefrontSkeletons';

interface ProductDetailPageProps {
  product: Product;
  allProducts: Product[];
  isLoading?: boolean;
  isRelatedLoading?: boolean;
  isWishlisted: boolean;
  onToggleWishlist: (productId: string) => void;
  onAddToCart: (product: Product, size: string, color: string) => void;
  onBuyNow: (product: Product, size: string, color: string) => void;
  onBackToCatalog: () => void;
  onNavigateHome?: () => void;
  onSelectDepartment?: (dept: 'MEN' | 'KIDS') => void;
  onSelectWorld?: (world: string) => void;
  onSelectProduct: (product: Product) => void;
  onOpenSizeGuide: () => void;
  onOpenCombo?: (product: Product) => void;
  onOpenCompare?: (product: Product) => void;
  recentlyViewedIds?: string[];
  wishlistIds?: string[];
  onRemoveFromRecent?: (productId: string) => void;
  onClearAllRecent?: () => void;
}

interface GalleryImageItem {
  url: string;
  tagTopLeft?: string;
  tagBottomLeft?: string;
}

export const ProductDetailPage: React.FC<ProductDetailPageProps> = ({
  product,
  allProducts,
  isLoading = false,
  isRelatedLoading = false,
  isWishlisted,
  onToggleWishlist,
  onAddToCart,
  onBackToCatalog,
  onNavigateHome,
  onSelectDepartment,
  onSelectWorld,
  onSelectProduct,
  onOpenSizeGuide,
  onOpenCompare,
  recentlyViewedIds = [],
  wishlistIds = [],
  onRemoveFromRecent,
  onClearAllRecent,
}) => {
  if (isLoading) {
    return <ProductDetailSkeleton />;
  }
  // Available sizes matching The Souled Store standard
  const menSizes = ['XXS', 'XS', 'S', 'M', 'L', 'XL', 'XXL', 'XXXL'];
  const kidsSizes = ['2-3Y', '3-4Y', '4-5Y', '5-6Y', '7-8Y', '9-10Y', '11-12Y'];
  const availableSizes = product.department === 'KIDS' ? kidsSizes : menSizes;

  // Derive available color swatches from product.colors, fallback to variant colors, fallback to default black
  const availableColors = React.useMemo<{ name: string; hex: string }[]>(() => {
    if (Array.isArray(product.colors) && product.colors.length > 0) {
      const cleaned = product.colors.filter(
        (c): c is { name: string; hex: string } =>
          Boolean(c && typeof c.name === 'string' && c.name.trim() && typeof c.hex === 'string' && c.hex.trim())
      );
      if (cleaned.length > 0) return cleaned;
    }

    if (Array.isArray(product.variants) && product.variants.length > 0) {
      const seen = new Set<string>();
      const fromVariants: { name: string; hex: string }[] = [];
      product.variants.forEach((v: Record<string, unknown>) => {
        const name = typeof v?.colorName === 'string' ? v.colorName.trim() : typeof v?.color === 'string' ? v.color.trim() : '';
        const hex = typeof v?.colorHex === 'string' ? v.colorHex.trim() : typeof v?.hex === 'string' ? v.hex.trim() : '#111115';
        if (name && !seen.has(name.toLowerCase())) {
          seen.add(name.toLowerCase());
          fromVariants.push({ name, hex });
        }
      });
      if (fromVariants.length > 0) return fromVariants;
    }

    return [{ name: 'Obsidian Black', hex: '#111115' }];
  }, [product.colors, product.variants]);

  const [selectedSize, setSelectedSize] = useState<string>('L');
  const [selectedColor, setSelectedColor] = useState<string>(availableColors[0]?.name || 'Obsidian Black');
  const [quantity, setQuantity] = useState<number>(1);
  const [addedNotice, setAddedNotice] = useState(false);
  const [pincode, setPincode] = useState('');
  const [pincodeStatus, setPincodeStatus] = useState<string | null>(null);
  const [shareToast, setShareToast] = useState<string | null>(null);

  // Accordion states
  const [isDetailsOpen, setIsDetailsOpen] = useState(true);
  const [isDescOpen, setIsDescOpen] = useState(false);

  // Gallery Carousel, Inline Load More & Fullscreen Overlay State
  const [activeCarouselIndex, setActiveCarouselIndex] = useState(0);
  const [visibleGridCount, setVisibleGridCount] = useState(6);
  const [isAllImagesOpen, setIsAllImagesOpen] = useState(false);
  const [isZoomOpen, setIsZoomOpen] = useState(false);
  const [zoomImgIndex, setZoomImgIndex] = useState(0);
  const [zoomScale, setZoomScale] = useState(1);
  const [panPosition, setPanPosition] = useState({ x: 50, y: 50 });
  const [isHoverZooming, setIsHoverZooming] = useState(false);
  const zoomContainerRef = useRef<HTMLDivElement>(null);
  const thumbStripRef = useRef<HTMLDivElement>(null);
  const carouselTouchXRef = useRef<number | null>(null);
  const carouselTouchYRef = useRef<number | null>(null);
  const carouselSwipedRef = useRef(false);

  // Customer tracking
  const { recordProductView } = useCustomerAuth();

  // Construct exact gallery images from admin product data (no fake stock filler, no 6-image truncation)
  const galleryImages: GalleryImageItem[] = React.useMemo(() => {
    const validProductImages = Array.isArray(product.images)
      ? product.images.filter((url): url is string => typeof url === 'string' && url.trim().length > 0)
      : [];

    const sourceImages =
      validProductImages.length > 0
        ? validProductImages
        : ['https://images.unsplash.com/photo-1521572267360-ee0c2909d518?w=1000&auto=format&fit=crop&q=85'];

    return sourceImages.map((url, idx) =>
      idx === 0
        ? {
            url,
            tagTopLeft: 'OVERSIZED FIT',
            tagBottomLeft: 'PREMIUM HEAVY GAUGE FABRIC',
          }
        : { url }
    );
  }, [product.images]);

  // Compute overall product stock & Schema.org Product JSON-LD markup
  const isProductOverallInStock = React.useMemo(() => {
    if (product.inStock === false) return false;
    if (typeof product.stock === 'number' && product.stock <= 0) return false;
    if (Array.isArray(product.variants) && product.variants.length > 0) {
      const hasAnyAvailableVariant = product.variants.some((v: Record<string, unknown>) => {
        if (typeof v?.stock === 'number') return v.stock > 0;
        return true;
      });
      if (!hasAnyAvailableVariant) return false;
    }
    return true;
  }, [product.inStock, product.stock, product.variants]);

  const productJsonLd = React.useMemo(() => {
    const origin = typeof window !== 'undefined' ? window.location.origin : '';
    const pathname = typeof window !== 'undefined' ? window.location.pathname : '';
    const canonicalUrl = origin ? `${origin}${pathname}` : `/product/${product.id}`;

    const resolvedImages = galleryImages
      .map((item) => {
        const raw = item.url.trim();
        if (!raw) return '';
        if (raw.startsWith('http://') || raw.startsWith('https://')) return raw;
        if (raw.startsWith('/') && origin) return `${origin}${raw}`;
        return raw;
      })
      .filter((u) => u.length > 0);

    const webImages = resolvedImages.filter((u) => !u.startsWith('data:'));
    const schemaImages = webImages.length > 0 ? webImages : resolvedImages;

    const productSku = product.sku || `TW-${product.id.toUpperCase()}`;
    const productCategory =
      product.department === 'KIDS'
        ? 'Apparel & Accessories > Clothing > Shirts & Tops > Kids Boxy Fit T-Shirts'
        : 'Apparel & Accessories > Clothing > Shirts & Tops > Men Boxy Fit T-Shirts';
    const richDescription = (
      product.description ||
      `${product.name} — Heavyweight ${product.gsm || 240} GSM ${product.fabric || '100% Combed Ring-Spun Cotton'} ${product.fit || 'Oversized'} streetwear t-shirt from TORIWEAR.`
    ).trim();

    const schemaPayload: Record<string, unknown> = {
      '@context': 'https://schema.org',
      '@type': 'Product',
      '@id': `${canonicalUrl}#product`,
      name: product.name,
      url: canonicalUrl,
      sku: productSku,
      mpn: product.catalogNumber ? `TW-${product.catalogNumber}` : productSku,
      image: schemaImages,
      description: richDescription,
      category: productCategory,
      material: `${product.gsm || 240} GSM ${product.fabric || '100% Combed Ring-Spun Cotton'}`,
      color: availableColors.length === 1 ? (availableColors[0]?.name || 'Default') : availableColors.map((c) => c.name),
      size: availableSizes,
      brand: {
        '@type': 'Brand',
        name: 'TORIWEAR',
      },
      audience: {
        '@type': 'PeopleAudience',
        suggestedGender: product.department === 'KIDS' ? 'Unisex' : 'Male',
        suggestedMinAge: product.department === 'KIDS' ? 2 : 13,
      },
      offers: {
        '@type': 'Offer',
        url: canonicalUrl,
        priceCurrency: 'INR',
        price: Number(product.price || 0).toFixed(2),
        priceValidUntil: `${new Date().getFullYear() + 1}-12-31`,
        availability: isProductOverallInStock
          ? 'https://schema.org/InStock'
          : 'https://schema.org/OutOfStock',
        itemCondition: 'https://schema.org/NewCondition',
        seller: {
          '@type': 'Organization',
          name: 'TORIWEAR Originals Pvt. Ltd.',
        },
        shippingDetails: {
          '@type': 'OfferShippingDetails',
          shippingRate: {
            '@type': 'MonetaryAmount',
            value: '0.00',
            currency: 'INR',
          },
          shippingDestination: {
            '@type': 'DefinedRegion',
            addressCountry: 'IN',
          },
          deliveryTime: {
            '@type': 'ShippingDeliveryTime',
            handlingTime: {
              '@type': 'QuantitativeValue',
              minValue: 0,
              maxValue: 1,
              unitCode: 'DAY',
            },
            transitTime: {
              '@type': 'QuantitativeValue',
              minValue: 2,
              maxValue: 4,
              unitCode: 'DAY',
            },
          },
        },
        hasMerchantReturnPolicy: {
          '@type': 'MerchantReturnPolicy',
          applicableCountry: 'IN',
          returnPolicyCategory: 'https://schema.org/MerchantReturnFiniteReturnWindow',
          merchantReturnDays: 30,
          returnMethod: 'https://schema.org/ReturnByMail',
          returnFees: 'https://schema.org/FreeReturn',
        },
      },
    };

    if (Number(product.reviewsCount) > 0 && Number(product.rating) > 0) {
      schemaPayload.aggregateRating = {
        '@type': 'AggregateRating',
        ratingValue: Number(product.rating).toFixed(1),
        bestRating: '5',
        worstRating: '1',
        reviewCount: String(Math.round(Number(product.reviewsCount))),
      };
    }

    return schemaPayload;
  }, [product, galleryImages, availableColors, availableSizes, isProductOverallInStock]);

  // Inject Schema.org Product JSON-LD script and sync document head SEO tags for search crawlers & rich snippets
  useEffect(() => {
    if (typeof document === 'undefined') return undefined;

    const scriptId = 'toriwear-product-jsonld';
    let jsonLdScript = document.getElementById(scriptId) as HTMLScriptElement | null;
    if (!jsonLdScript) {
      jsonLdScript = document.createElement('script');
      jsonLdScript.id = scriptId;
      jsonLdScript.type = 'application/ld+json';
      document.head.appendChild(jsonLdScript);
    }
    jsonLdScript.textContent = JSON.stringify(productJsonLd).replace(/</g, '\\u003c');

    const prevTitle = document.title;
    const deptLabel = product.department === 'KIDS' ? 'Kids' : 'Men';
    const nextTitle = `${product.name} | TORIWEAR ${deptLabel} Anime Streetwear`;
    document.title = nextTitle;

    const seoDescription = (
      product.description ||
      `Shop ${product.name} at ₹${Number(product.price || 0).toLocaleString('en-IN')}. ${product.gsm || 240} GSM ${product.fabric || 'Combed Cotton'} ${product.fit || 'Oversized'} streetwear on TORIWEAR.`
    ).slice(0, 160);

    const managedMetaSnapshots: Array<{ el: HTMLMetaElement; prevContent: string | null; created: boolean }> = [];
    const upsertMeta = (attr: 'name' | 'property', key: string, content: string) => {
      let metaEl = document.head.querySelector(`meta[${attr}="${key}"]`) as HTMLMetaElement | null;
      const created = !metaEl;
      const prevContent = metaEl ? metaEl.getAttribute('content') : null;
      if (!metaEl) {
        metaEl = document.createElement('meta');
        metaEl.setAttribute(attr, key);
        document.head.appendChild(metaEl);
      }
      metaEl.setAttribute('content', content);
      managedMetaSnapshots.push({ el: metaEl, prevContent, created });
    };

    const canonicalUrl = typeof window !== 'undefined' ? `${window.location.origin}${window.location.pathname}` : '';
    const primaryImg = Array.isArray(productJsonLd.image) && typeof productJsonLd.image[0] === 'string'
      ? productJsonLd.image[0]
      : '';

    upsertMeta('name', 'description', seoDescription);
    upsertMeta('property', 'og:type', 'product');
    upsertMeta('property', 'og:title', nextTitle);
    upsertMeta('property', 'og:description', seoDescription);
    if (canonicalUrl) upsertMeta('property', 'og:url', canonicalUrl);
    if (primaryImg && !primaryImg.startsWith('data:')) upsertMeta('property', 'og:image', primaryImg);

    let canonicalLink = document.head.querySelector('link[rel="canonical"]') as HTMLLinkElement | null;
    const canonicalCreated = !canonicalLink;
    const prevCanonicalHref = canonicalLink ? canonicalLink.getAttribute('href') : null;
    if (canonicalUrl) {
      if (!canonicalLink) {
        canonicalLink = document.createElement('link');
        canonicalLink.rel = 'canonical';
        document.head.appendChild(canonicalLink);
      }
      canonicalLink.href = canonicalUrl;
    }

    return () => {
      document.title = prevTitle;
      const activeScript = document.getElementById(scriptId);
      if (activeScript) activeScript.remove();

      managedMetaSnapshots.forEach(({ el, prevContent, created }) => {
        if (created) {
          el.remove();
        } else if (prevContent !== null) {
          el.setAttribute('content', prevContent);
        } else {
          el.removeAttribute('content');
        }
      });

      if (canonicalLink) {
        if (canonicalCreated) {
          canonicalLink.remove();
        } else if (prevCanonicalHref !== null) {
          canonicalLink.setAttribute('href', prevCanonicalHref);
        }
      }
    };
  }, [productJsonLd, product.name, product.department, product.description, product.price, product.gsm, product.fabric, product.fit]);

  // Scroll to top & reset gallery state on product change
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
    setSelectedSize(product.department === 'KIDS' ? '5-6Y' : 'L');
    setSelectedColor(availableColors[0]?.name || 'Obsidian Black');
    setQuantity(1);
    setPincodeStatus(null);
    setActiveCarouselIndex(0);
    setVisibleGridCount(6);
    setZoomScale(1);
    setZoomImgIndex(0);
    setIsZoomOpen(false);
    setIsAllImagesOpen(false);
    recordProductView(product);
  }, [product.id]);

  // Preload adjacent carousel slides cleanly for zero-buffer instant slide switching
  useEffect(() => {
    if (galleryImages.length <= 1) return;
    const total = galleryImages.length;
    const targets = [
      galleryImages[(activeCarouselIndex + 1) % total]?.url,
      galleryImages[(activeCarouselIndex - 1 + total) % total]?.url,
      galleryImages[(activeCarouselIndex + 2) % total]?.url,
    ];
    targets.forEach((src) => {
      if (!src) return;
      const pre = new Image();
      pre.decoding = 'async';
      pre.src = src;
    });

    // Keep active thumbnail visible in horizontal strip
    const activeThumbEl = thumbStripRef.current?.children?.[activeCarouselIndex] as HTMLElement | undefined;
    if (activeThumbEl) {
      activeThumbEl.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
    }
  }, [activeCarouselIndex, galleryImages]);

  // Keyboard navigation for zoom modal, full-screen all-images gallery, and page back
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (isZoomOpen) {
          setIsZoomOpen(false);
        } else if (isAllImagesOpen) {
          setIsAllImagesOpen(false);
        } else {
          onBackToCatalog();
        }
      } else if (isZoomOpen && e.key === 'ArrowLeft') {
        setZoomImgIndex((prev) => (prev > 0 ? prev - 1 : galleryImages.length - 1));
        setZoomScale(1);
      } else if (isZoomOpen && e.key === 'ArrowRight') {
        setZoomImgIndex((prev) => (prev < galleryImages.length - 1 ? prev + 1 : 0));
        setZoomScale(1);
      } else if (!isZoomOpen && !isAllImagesOpen && galleryImages.length > 1 && e.key === 'ArrowLeft') {
        setActiveCarouselIndex((prev) => (prev > 0 ? prev - 1 : galleryImages.length - 1));
      } else if (!isZoomOpen && !isAllImagesOpen && galleryImages.length > 1 && e.key === 'ArrowRight') {
        setActiveCarouselIndex((prev) => (prev < galleryImages.length - 1 ? prev + 1 : 0));
      } else if (isZoomOpen && (e.key === '+' || e.key === '=')) {
        setZoomScale((s) => Math.min(3.5, s + 0.5));
      } else if (isZoomOpen && e.key === '-') {
        setZoomScale((s) => Math.max(1, s - 0.5));
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isZoomOpen, isAllImagesOpen, galleryImages.length, onBackToCatalog]);

  // Lock body scroll when zoom lightbox or full-screen gallery is open
  useEffect(() => {
    if (!isZoomOpen && !isAllImagesOpen) return;
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = originalOverflow;
    };
  }, [isZoomOpen, isAllImagesOpen]);

  // Variant looks (current look + alternate sibling styles e.g. green variant or other color)
  const variantLooks = React.useMemo(() => {
    const siblings = allProducts
      .filter((p) => p.id !== product.id && (p.world === product.world || p.department === product.department))
      .slice(0, 1);

    const looks = [
      {
        id: product.id,
        name: product.name,
        image: galleryImages[0]?.url,
        isActive: true,
        product: product,
      },
    ];

    if (siblings[0]) {
      looks.push({
        id: siblings[0].id,
        name: siblings[0].name,
        image: siblings[0].images?.[0] || 'https://images.unsplash.com/photo-1503342217505-b0a15ec3261c?w=400&auto=format&fit=crop&q=80',
        isActive: false,
        product: siblings[0],
      });
    }

    return looks;
  }, [allProducts, product, galleryImages]);

  // "Others Also Bought" recommendation carousel (Screenshots 3 & 4)
  const othersAlsoBought = React.useMemo(() => {
    return allProducts
      .filter((p) => p.id !== product.id)
      .slice(0, 8);
  }, [allProducts, product.id]);

  const [carouselIndex, setCarouselIndex] = useState(0);
  const visibleCarouselItems = othersAlsoBought.slice(carouselIndex, carouselIndex + 4);

  const handleNextCarousel = () => {
    if (carouselIndex + 4 < othersAlsoBought.length) {
      setCarouselIndex((i) => i + 1);
    } else {
      setCarouselIndex(0);
    }
  };

  const handlePrevCarousel = () => {
    if (carouselIndex > 0) {
      setCarouselIndex((i) => i - 1);
    } else {
      setCarouselIndex(Math.max(0, othersAlsoBought.length - 4));
    }
  };

  const handleAdd = () => {
    for (let i = 0; i < quantity; i++) {
      onAddToCart(product, selectedSize, selectedColor);
    }
    setAddedNotice(true);
    setTimeout(() => setAddedNotice(false), 2400);
  };

  const handleCheckPincode = (e: React.FormEvent) => {
    e.preventDefault();
    if (pincode.trim().length === 6 && /^\d+$/.test(pincode.trim())) {
      setPincodeStatus(`✓ Delivery available for PIN ${pincode.trim()} within 2-4 business days. Free shipping applies.`);
    } else {
      setPincodeStatus('Please enter a valid 6-digit PIN code.');
    }
  };

  const handleCopyShareLink = (message = 'Link copied to clipboard! Share on Instagram') => {
    try {
      const url = typeof window !== 'undefined' ? window.location.href : '';
      if (url && navigator?.clipboard) {
        navigator.clipboard.writeText(url).catch(() => {});
      }
      setShareToast(message);
      setTimeout(() => setShareToast(null), 2500);
    } catch {
      // Safe fallback
    }
  };

  // Open zoom modal on click of any image in the gallery
  const handleOpenZoom = (index: number) => {
    const safeIdx = Math.max(0, Math.min(index, galleryImages.length - 1));
    setZoomImgIndex(safeIdx);
    setZoomScale(1.8); // Default to a sharp 1.8x zoom on click for instant clear view of design!
    setIsZoomOpen(true);
  };

  const totalGalleryCount = galleryImages.length;
  const visibleGridImages = galleryImages.slice(0, Math.min(visibleGridCount, totalGalleryCount));
  const remainingGridCount = Math.max(0, totalGalleryCount - visibleGridImages.length);
  const nextLoadBatch = Math.min(6, remainingGridCount);
  const isGridExpanded = visibleGridImages.length > 6;
  const progressPercent = totalGalleryCount > 0 ? Math.round((visibleGridImages.length / totalGalleryCount) * 100) : 100;

  const handleCarouselPrev = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    setActiveCarouselIndex((prev) => (prev > 0 ? prev - 1 : totalGalleryCount - 1));
  };

  const handleCarouselNext = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    setActiveCarouselIndex((prev) => (prev < totalGalleryCount - 1 ? prev + 1 : 0));
  };

  const handleCarouselTouchStart = (e: React.TouchEvent) => {
    const touch = e.touches[0];
    if (!touch) return;
    carouselTouchXRef.current = touch.clientX;
    carouselTouchYRef.current = touch.clientY;
    carouselSwipedRef.current = false;
  };

  const handleCarouselTouchEnd = (e: React.TouchEvent) => {
    if (totalGalleryCount <= 1 || carouselTouchXRef.current === null || carouselTouchYRef.current === null) return;
    const touch = e.changedTouches[0];
    if (!touch) return;
    const dx = touch.clientX - carouselTouchXRef.current;
    const dy = touch.clientY - carouselTouchYRef.current;
    carouselTouchXRef.current = null;
    carouselTouchYRef.current = null;

    if (Math.abs(dx) > 36 && Math.abs(dx) > Math.abs(dy) * 1.15) {
      carouselSwipedRef.current = true;
      if (dx < 0) {
        setActiveCarouselIndex((prev) => (prev < totalGalleryCount - 1 ? prev + 1 : 0));
      } else {
        setActiveCarouselIndex((prev) => (prev > 0 ? prev - 1 : totalGalleryCount - 1));
      }
    }
  };

  // Handle mouse move inside the zoom container for super-sharp design inspection
  const handleZoomMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!zoomContainerRef.current) return;
    const rect = zoomContainerRef.current.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    setPanPosition({ x: Math.max(0, Math.min(100, x)), y: Math.max(0, Math.min(100, y)) });
  };

  // Toggle zoom level when clicking directly on the zoomed image
  const handleToggleZoomScale = (e: React.MouseEvent) => {
    e.stopPropagation();
    setZoomScale((prev) => {
      if (prev <= 1.2) return 2.2;
      if (prev <= 2.2) return 3.2;
      return 1;
    });
  };

  return (
    <div className="min-h-screen bg-white text-neutral-900 font-sans selection:bg-neutral-900 selection:text-white pb-0 skeleton-reveal">
      
      {/* 1. Breadcrumbs Strip (Clean The Souled Store aesthetic) */}
      <div className="border-b border-neutral-200/80 bg-white">
        <div className="max-w-[1360px] mx-auto px-4 sm:px-6 lg:px-8 py-2.5 flex items-center justify-between">
          <nav aria-label="Breadcrumb" className="flex items-center gap-1.5 text-[11px] sm:text-xs text-neutral-500 overflow-x-auto no-scrollbar whitespace-nowrap">
            <button
              onClick={onBackToCatalog}
              className="inline-flex items-center gap-1 text-neutral-700 hover:text-black font-bold transition cursor-pointer pr-1"
              title="Return to Catalog"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
              <span>Back</span>
            </button>
            <span className="text-neutral-300">|</span>
            <button
              onClick={() => onNavigateHome ? onNavigateHome() : onBackToCatalog()}
              className="text-neutral-500 hover:text-black hover:underline transition cursor-pointer"
            >
              Home
            </button>
            <span className="text-neutral-400">/</span>
            <button
              onClick={() => onSelectDepartment ? onSelectDepartment(product.department) : onBackToCatalog()}
              className="text-neutral-500 hover:text-black hover:underline transition cursor-pointer"
            >
              {product.department === 'KIDS' ? 'Kids Boxy Fit T-shirts' : 'Men Boxy Fit T-shirts'}
            </button>
            <span className="text-neutral-400">/</span>
            <button
              onClick={() => onSelectWorld ? onSelectWorld(product.world) : onBackToCatalog()}
              className="text-neutral-500 hover:text-black hover:underline transition cursor-pointer"
            >
              {product.world || 'Anime Streetwear'}
            </button>
            <span className="text-neutral-400">/</span>
            <span className="text-neutral-600 font-medium truncate max-w-[200px] sm:max-w-md">
              {product.name}
            </span>
          </nav>
        </div>
      </div>

      {/* 2. Main 2-Column Product Presentation Stage */}
      <div className="max-w-[1360px] mx-auto px-4 sm:px-6 lg:px-8 pt-4 pb-12">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-10 items-start">

          {/* ===================================================================== */}
          {/* LEFT: Interactive Image Carousel + Detail Grid + Designed Load More   */}
          {/* ===================================================================== */}
          <div className="lg:col-span-7 space-y-5">

            {/* A. PRIMARY INTERACTIVE IMAGE CAROUSEL (BOTH MOBILE & DESKTOP) */}
            <div className="space-y-3">
              <div
                onTouchStart={handleCarouselTouchStart}
                onTouchEnd={handleCarouselTouchEnd}
                onClick={() => {
                  if (carouselSwipedRef.current) {
                    carouselSwipedRef.current = false;
                    return;
                  }
                  handleOpenZoom(activeCarouselIndex);
                }}
                className="relative group bg-[#F5F5F3] overflow-hidden aspect-[4/5] sm:aspect-[3/4] max-h-[76vh] w-full cursor-zoom-in select-none border border-neutral-200/70"
                title="Click image for 100% HD Zoom or swipe/use arrows to browse angles"
              >
                {/* GPU-Accelerated Horizontal Slide Track */}
                <div
                  className="flex w-full h-full will-change-transform transition-transform duration-300 ease-out"
                  style={{ transform: `translate3d(-${activeCarouselIndex * 100}%, 0, 0)` }}
                >
                  {galleryImages.map((img, idx) => (
                    <div key={idx} className="w-full h-full shrink-0 relative">
                      <ShimmerImage
                        src={img.url}
                        alt={`${product.name} carousel slide ${idx + 1}`}
                        theme="neutral"
                        wrapperClassName="w-full h-full"
                        loading={idx <= 1 ? 'eager' : 'lazy'}
                        decoding="async"
                        className="w-full h-full object-cover object-center"
                      />
                    </div>
                  ))}
                </div>

                {/* Top-Left Primary Fit Badge */}
                {galleryImages[activeCarouselIndex]?.tagTopLeft && (
                  <div className="absolute top-3 left-3 z-10 pointer-events-none">
                    <span className="bg-black/65 backdrop-blur-xs text-white text-[10px] font-bold tracking-wider uppercase px-2.5 py-1 shadow-xs">
                      {galleryImages[activeCarouselIndex].tagTopLeft}
                    </span>
                  </div>
                )}

                {/* Bottom-Left Fabric Badge */}
                {galleryImages[activeCarouselIndex]?.tagBottomLeft && (
                  <div className="absolute bottom-11 left-3 z-10 pointer-events-none">
                    <span className="bg-black/80 text-white text-[10px] font-bold tracking-wider uppercase px-2.5 py-1 shadow-xs">
                      {galleryImages[activeCarouselIndex].tagBottomLeft}
                    </span>
                  </div>
                )}

                {/* Top-Right Counter & Fullscreen/Zoom Trigger */}
                <div className="absolute top-3 right-3 z-20 flex items-center gap-2">
                  {totalGalleryCount > 1 && (
                    <span className="bg-black/70 backdrop-blur-xs text-white text-[11px] font-mono font-bold px-2.5 py-1">
                      {activeCarouselIndex + 1} / {totalGalleryCount}
                    </span>
                  )}
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleOpenZoom(activeCarouselIndex);
                    }}
                    className="bg-white/90 hover:bg-white text-neutral-900 p-2 rounded-full shadow-md transition cursor-pointer"
                    aria-label="Zoom active image"
                    title="Zoom 100% HD"
                  >
                    <ZoomIn className="w-4 h-4" />
                  </button>
                </div>

                {/* Carousel Left / Right Navigation Arrows */}
                {totalGalleryCount > 1 && (
                  <>
                    <button
                      type="button"
                      id="pdp-carousel-prev-btn"
                      onClick={handleCarouselPrev}
                      aria-label="Previous product photo"
                      className="absolute left-3 top-1/2 -translate-y-1/2 z-20 w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-white/90 hover:bg-white text-neutral-900 shadow-lg flex items-center justify-center transition active:scale-95 cursor-pointer"
                    >
                      <ChevronLeft className="w-5 h-5" />
                    </button>

                    <button
                      type="button"
                      id="pdp-carousel-next-btn"
                      onClick={handleCarouselNext}
                      aria-label="Next product photo"
                      className="absolute right-3 top-1/2 -translate-y-1/2 z-20 w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-white/90 hover:bg-white text-neutral-900 shadow-lg flex items-center justify-center transition active:scale-95 cursor-pointer"
                    >
                      <ChevronRight className="w-5 h-5" />
                    </button>

                    {/* Carousel Bottom Pagination Dots */}
                    <div
                      onClick={(e) => e.stopPropagation()}
                      className="absolute bottom-3 left-1/2 -translate-x-1/2 z-20 flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-black/50 backdrop-blur-xs"
                    >
                      {(() => {
                        const maxDots = 9;
                        let start = 0;
                        let end = totalGalleryCount;
                        if (totalGalleryCount > maxDots) {
                          start = Math.max(0, Math.min(activeCarouselIndex - 4, totalGalleryCount - maxDots));
                          end = start + maxDots;
                        }
                        return Array.from({ length: end - start }, (_, i) => start + i).map((dotIdx) => (
                          <button
                            key={dotIdx}
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setActiveCarouselIndex(dotIdx);
                            }}
                            aria-label={`Go to slide ${dotIdx + 1}`}
                            className={`transition-all duration-200 rounded-full cursor-pointer ${
                              dotIdx === activeCarouselIndex
                                ? 'w-5 h-1.5 bg-white'
                                : 'w-1.5 h-1.5 bg-white/50 hover:bg-white/85'
                            }`}
                          />
                        ));
                      })()}
                    </div>
                  </>
                )}
              </div>

              {/* Synced Horizontal Thumbnail Strip (Desktop & Mobile) */}
              {totalGalleryCount > 1 && (
                <div
                  ref={thumbStripRef}
                  className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-1"
                >
                  {galleryImages.map((img, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => setActiveCarouselIndex(idx)}
                      className={`relative w-14 h-18 sm:w-16 sm:h-20 shrink-0 overflow-hidden bg-[#F5F5F3] transition cursor-pointer ${
                        activeCarouselIndex === idx
                          ? 'ring-2 ring-neutral-950 border border-neutral-950 opacity-100'
                          : 'border border-neutral-200 opacity-65 hover:opacity-100'
                      }`}
                      title={`View photo ${idx + 1} of ${totalGalleryCount}`}
                    >
                      <ShimmerImage
                        src={img.url}
                        alt={`Thumbnail ${idx + 1}`}
                        theme="neutral"
                        wrapperClassName="w-full h-full"
                        loading="lazy"
                        decoding="async"
                        className="w-full h-full object-cover object-center"
                      />
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* B. MULTI-ANGLE EDITORIAL GRID + DESIGNED INLINE LOAD MORE BUTTON */}
            {totalGalleryCount > 1 && (
              <div className="pt-4 border-t border-neutral-200/80 space-y-3.5">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <h2 className="text-xs font-bold uppercase tracking-widest text-neutral-900">
                      All Product Angles ({totalGalleryCount})
                    </h2>
                    <p className="text-[11px] text-neutral-500 mt-0.5">
                      Showing {visibleGridImages.length} of {totalGalleryCount} photos · Click any tile to zoom HD
                    </p>
                  </div>

                  {totalGalleryCount > 6 && (
                    <button
                      type="button"
                      onClick={() => setIsAllImagesOpen(true)}
                      className="px-3 py-1.5 border border-neutral-300 hover:border-black bg-white text-neutral-900 text-[11px] font-bold uppercase tracking-wider flex items-center gap-1.5 cursor-pointer transition shrink-0"
                    >
                      <Maximize2 className="w-3.5 h-3.5" />
                      <span>Full Screen</span>
                    </button>
                  )}
                </div>

                <div className="flex flex-wrap gap-2 sm:grid sm:grid-cols-2 sm:gap-2.5">
                  {visibleGridImages.map((img, idx) => (
                    <div
                      key={idx}
                      onClick={() => handleOpenZoom(idx)}
                      className="flex-1 basis-[calc(50%-4px)] min-w-[136px] sm:flex-initial sm:min-w-0 relative group bg-[#F5F5F3] overflow-hidden aspect-[3/4] select-none cursor-zoom-in border border-neutral-200/60 hover:border-neutral-900 transition"
                      title={`Click to zoom image ${idx + 1} of ${totalGalleryCount}`}
                    >
                      <ShimmerImage
                        src={img.url}
                        alt={`${product.name} angle ${idx + 1}`}
                        theme="neutral"
                        wrapperClassName="w-full h-full"
                        className="w-full h-full object-cover object-center transition-transform duration-300 group-hover:scale-[1.02]"
                        loading={idx < 4 ? 'eager' : 'lazy'}
                        decoding="async"
                      />

                      <div className="absolute top-2.5 left-2.5 z-10">
                        <span className="bg-black/70 text-white text-[9px] font-mono font-bold px-1.5 py-0.5">
                          #{idx + 1}
                        </span>
                      </div>

                      <div className="absolute top-2.5 right-2.5 opacity-0 group-hover:opacity-100 transition-opacity bg-black/65 text-white p-1.5 rounded-full backdrop-blur-xs">
                        <ZoomIn className="w-3.5 h-3.5" />
                      </div>
                    </div>
                  ))}
                </div>

                {/* Designed Load More Block (when product has > 6 images) */}
                {totalGalleryCount > 6 && (
                  <div className="pt-2 space-y-3">
                    {/* Visual Photo Progress Bar */}
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between text-[11px] font-mono text-neutral-600">
                        <span>Gallery Progress</span>
                        <span className="font-bold text-neutral-900">
                          {visibleGridImages.length} / {totalGalleryCount} Photos ({progressPercent}%)
                        </span>
                      </div>
                      <div className="w-full h-1.5 bg-neutral-200 overflow-hidden">
                        <div
                          className="h-full bg-[#e11b23] transition-all duration-300 ease-out"
                          style={{ width: `${progressPercent}%` }}
                        />
                      </div>
                    </div>

                    {/* Designed Action Buttons */}
                    <div className="flex flex-col sm:flex-row items-stretch gap-2.5">
                      {remainingGridCount > 0 ? (
                        <button
                          type="button"
                          id="pdp-load-more-images-btn"
                          onClick={() => setVisibleGridCount((prev) => Math.min(totalGalleryCount, prev + 6))}
                          className="flex-1 group relative overflow-hidden py-3.5 px-5 bg-[#111115] hover:bg-[#e11b23] text-white text-xs font-bold uppercase tracking-widest transition-colors duration-200 flex items-center justify-center gap-2.5 cursor-pointer shadow-sm active:scale-[0.99]"
                        >
                          <Plus className="w-4 h-4 transition-transform duration-200 group-hover:rotate-90" />
                          <span>Load More Photos (+{nextLoadBatch} More)</span>
                          <span className="ml-1 px-2 py-0.5 bg-white/15 text-[10px] font-mono">
                            {remainingGridCount} left
                          </span>
                        </button>
                      ) : isGridExpanded ? (
                        <button
                          type="button"
                          id="pdp-show-less-images-btn"
                          onClick={() => setVisibleGridCount(6)}
                          className="flex-1 py-3.5 px-5 bg-neutral-100 hover:bg-neutral-200 border border-neutral-300 text-neutral-900 text-xs font-bold uppercase tracking-widest transition flex items-center justify-center gap-2 cursor-pointer"
                        >
                          <Minus className="w-4 h-4" />
                          <span>Show Less (Collapse to 6)</span>
                        </button>
                      ) : null}

                      <button
                        type="button"
                        id="pdp-more-images-btn"
                        onClick={() => setIsAllImagesOpen(true)}
                        className="py-3.5 px-5 border border-neutral-900 bg-white hover:bg-neutral-900 text-neutral-900 hover:text-white text-xs font-bold uppercase tracking-widest transition flex items-center justify-center gap-2 cursor-pointer shrink-0"
                      >
                        <Images className="w-4 h-4" />
                        <span>View All {totalGalleryCount} Full Screen</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* ========================================================== */}
          {/* RIGHT: Commerce Info, Variant, Size, Add to Cart (Sticky)  */}
          {/* ========================================================== */}
          <div className="lg:col-span-5 lg:sticky lg:top-16 space-y-5">
            
            {/* 1. Title, Subtitle, Price */}
            <div>
              <h1 className="text-xl sm:text-2xl font-bold text-neutral-900 tracking-tight leading-snug">
                {product.name}
              </h1>

              <p className="text-xs sm:text-sm text-neutral-500 mt-0.5">
                {product.department === 'KIDS' ? 'Kids Boxy Fit T-Shirts' : 'Men Boxy Fit T-Shirts'}
              </p>

              <div className="mt-3">
                <span className="text-xl sm:text-2xl font-bold text-neutral-900">
                  ₹ {product.price.toLocaleString('en-IN')}
                </span>
                <p className="text-[11px] sm:text-xs text-neutral-400 mt-0.5">
                  Price incl. of all taxes
                </p>
              </div>
            </div>

            {/* 2. Shop by Variant/Look (Screenshot 1 & 2) */}
            {variantLooks.length > 0 && (
              <div>
                <h3 className="text-xs font-bold text-neutral-900 mb-2">
                  Shop by Variant/Look
                </h3>
                <div className="flex items-center gap-3">
                  {variantLooks.map((look) => (
                    <button
                      key={look.id}
                      onClick={() => onSelectProduct(look.product)}
                      className={`relative w-14 h-18 sm:w-16 sm:h-20 overflow-hidden rounded-xs border transition cursor-pointer ${
                        look.isActive 
                          ? 'border-2 border-black ring-1 ring-black' 
                          : 'border-neutral-300 hover:border-neutral-600 opacity-80 hover:opacity-100'
                      }`}
                      title={look.name}
                    >
                      <ShimmerImage
                        src={look.image}
                        alt={look.name}
                        theme="neutral"
                        wrapperClassName="w-full h-full"
                        className="w-full h-full object-cover object-center"
                      />
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* 2.5 Color Selection Swatches with Accessible Hover & Focus Tooltips */}
            {availableColors.length > 0 && (
              <div>
                <div className="flex items-center justify-between text-xs mb-2.5">
                  <span className="font-semibold text-neutral-900">
                    Color:{' '}
                    <span className="font-bold text-black">{selectedColor}</span>
                  </span>
                  <span className="text-[11px] text-neutral-400">
                    {availableColors.length} {availableColors.length === 1 ? 'shade' : 'shades'} available
                  </span>
                </div>

                <div className="flex flex-wrap items-center gap-3" role="radiogroup" aria-label="Available colors">
                  {availableColors.map((color) => {
                    const isColorSelected = selectedColor.toLowerCase() === color.name.toLowerCase();
                    return (
                      <div key={color.name} className="relative group/swatch inline-flex items-center justify-center">
                        <button
                          type="button"
                          role="radio"
                          aria-checked={isColorSelected}
                          aria-label={`Select color ${color.name}`}
                          onClick={() => setSelectedColor(color.name)}
                          className={`relative w-8 h-8 rounded-full flex items-center justify-center transition-all duration-150 cursor-pointer focus:outline-none ${
                            isColorSelected
                              ? 'ring-2 ring-neutral-900 ring-offset-2 scale-105'
                              : 'ring-1 ring-neutral-300 hover:ring-neutral-700 hover:scale-105 focus-visible:ring-2 focus-visible:ring-neutral-900 focus-visible:ring-offset-2'
                          }`}
                        >
                          <span
                            className="w-full h-full rounded-full border border-black/15 shadow-inner"
                            style={{ backgroundColor: color.hex }}
                          />
                        </button>

                        {/* Floating Tooltip displaying Color Name on Hover & Keyboard Focus */}
                        <div
                          role="tooltip"
                          className="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-2.5 z-30 opacity-0 translate-y-1 group-hover/swatch:opacity-100 group-hover/swatch:translate-y-0 group-focus-within/swatch:opacity-100 group-focus-within/swatch:translate-y-0 transition-all duration-150 flex flex-col items-center"
                        >
                          <div className="bg-[#111115] text-white text-[11px] font-semibold tracking-wide px-2.5 py-1 whitespace-nowrap shadow-md flex items-center gap-1.5">
                            <span
                              className="w-2.5 h-2.5 rounded-full border border-white/30 shrink-0"
                              style={{ backgroundColor: color.hex }}
                            />
                            <span>{color.name}</span>
                          </div>
                          <span className="w-2 h-2 bg-[#111115] rotate-45 -mt-1" aria-hidden="true" />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* 3. Please select a size. & SIZE CHART */}
            <div>
              <div className="flex items-center justify-between text-xs mb-2">
                <span className="font-semibold text-neutral-900">
                  Please select a size.
                </span>
                <button
                  onClick={onOpenSizeGuide}
                  className="text-[#0066cc] font-semibold hover:underline cursor-pointer tracking-tight"
                >
                  SIZE CHART
                </button>
              </div>

              {/* Size boxes: XXS, XS, S, M, L, XL, XXL, XXXL */}
              <div className="flex flex-wrap gap-2">
                {availableSizes.map((size) => {
                  const isSelected = selectedSize === size;
                  const varForSize = (product.variants || []).find((v: any) => v.size === size);
                  const isSizeOutOfStock = varForSize && varForSize.stock === 0;

                  return (
                    <button
                      key={size}
                      onClick={() => setSelectedSize(size)}
                      className={`min-w-[42px] px-3 py-2 text-xs text-center border transition cursor-pointer font-medium relative ${
                        isSelected
                          ? 'border-2 border-black bg-neutral-50 font-bold text-black shadow-xs'
                          : isSizeOutOfStock
                          ? 'border-neutral-200 text-neutral-300 bg-neutral-50 line-through'
                          : 'border-neutral-300 text-neutral-700 hover:border-black bg-white'
                      }`}
                    >
                      {size}
                    </button>
                  );
                })}
              </div>

              {/* Stock status indicator */}
              {(() => {
                const selectedVariant = (product.variants || []).find((v: any) => v.size === selectedSize);
                const currentStock = selectedVariant ? selectedVariant.stock : (product.stock !== undefined ? product.stock : 20);
                const isItemOutOfStock = product.inStock === false || (product.stock !== undefined && product.stock === 0) || currentStock === 0;
                const isItemLowStock = !isItemOutOfStock && currentStock <= 5;

                if (isItemOutOfStock) {
                  return (
                    <div className="mt-2.5 px-3 py-2 bg-red-50 border border-red-200 text-red-700 rounded text-xs font-mono font-medium flex items-center gap-2">
                      <AlertCircle className="w-4 h-4 shrink-0 text-red-500" />
                      <span>Currently Out of Stock in size {selectedSize}. Please choose another size.</span>
                    </div>
                  );
                }

                if (isItemLowStock) {
                  return (
                    <div className="mt-2.5 px-3 py-1.5 bg-amber-50 border border-amber-200 text-amber-800 rounded text-xs font-mono font-medium flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
                      <span>Hurry! Only {currentStock} {currentStock === 1 ? 'item' : 'items'} left in stock.</span>
                    </div>
                  );
                }

                return null;
              })()}
            </div>

            {/* 4. Quantity Dropdown (Screenshot 1 & 2) */}
            <div className="flex items-center gap-3">
              <label htmlFor="pdp-qty-select" className="text-xs text-neutral-700 font-medium">
                Quantity
              </label>
              <div className="relative inline-block">
                <select
                  id="pdp-qty-select"
                  value={quantity}
                  onChange={(e) => setQuantity(Number(e.target.value))}
                  className="appearance-none border border-neutral-300 bg-white text-xs font-medium py-1.5 pl-3 pr-8 rounded-none hover:border-black cursor-pointer focus:outline-none focus:border-black"
                >
                  {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
                    <option key={n} value={n}>
                      {String(n).padStart(2, '0')}
                    </option>
                  ))}
                </select>
                <ChevronDown className="w-3.5 h-3.5 text-neutral-600 absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none" />
              </div>
            </div>

            {/* 5. ADD TO CART and WISHLIST buttons (The Souled Store signature layout) */}
            <div className="flex items-center gap-3 pt-1">
              {(() => {
                const selectedVariant = (product.variants || []).find((v: any) => v.size === selectedSize);
                const currentStock = selectedVariant ? selectedVariant.stock : (product.stock !== undefined ? product.stock : 20);
                const isItemOutOfStock = product.inStock === false || (product.stock !== undefined && product.stock === 0) || currentStock === 0;

                return (
                  <button
                    id="pdp-add-to-cart-red-btn"
                    disabled={isItemOutOfStock}
                    onClick={handleAdd}
                    className={`flex-1 py-3.5 px-6 font-bold text-xs uppercase tracking-wider transition shadow-xs rounded-none flex items-center justify-center gap-2 ${
                      isItemOutOfStock
                        ? 'bg-neutral-200 text-neutral-400 cursor-not-allowed'
                        : 'bg-[#e11b23] hover:bg-[#c6171e] text-white cursor-pointer active:scale-[0.99]'
                    }`}
                  >
                    <span>{isItemOutOfStock ? 'OUT OF STOCK' : (addedNotice ? 'ADDED TO CART! ✓' : 'ADD TO CART')}</span>
                  </button>
                );
              })()}

              <button
                id="pdp-wishlist-outline-btn"
                onClick={() => onToggleWishlist(product.id)}
                className={`flex-1 py-3.5 px-6 border transition cursor-pointer text-xs font-semibold uppercase tracking-wider flex items-center justify-center gap-2 rounded-none ${
                  isWishlisted
                    ? 'border-[#e11b23] text-[#e11b23] bg-red-50/50'
                    : 'border-neutral-900 text-neutral-900 bg-white hover:bg-neutral-50'
                }`}
              >
                <WishlistHeartIcon
                  active={isWishlisted}
                  resetKey={product.id}
                  className={`w-4 h-4 ${isWishlisted ? 'fill-[#e11b23] text-[#e11b23]' : 'text-neutral-900'}`}
                />
                <span>{isWishlisted ? 'WISHLISTED' : 'WISHLIST'}</span>
              </button>
            </div>

            {onOpenCompare && (
              <button
                id="pdp-compare-product-btn"
                type="button"
                onClick={() => onOpenCompare(product)}
                className="w-full py-2.5 px-4 border border-neutral-300 hover:border-neutral-900 bg-[#faf9f6] hover:bg-neutral-100 text-neutral-900 text-xs font-semibold uppercase tracking-wider flex items-center justify-center gap-2 transition cursor-pointer"
              >
                <Scale className="w-3.5 h-3.5" />
                <span>Compare Specifications Side-by-Side</span>
              </button>
            )}

            {/* 6. Share Row */}
            {(() => {
              const currentShareUrl = typeof window !== 'undefined' ? window.location.href : '';
              const shareTitle = `${product.name} - Boxy Fit Streetwear T-Shirt`;
              const instagramUrl = getAuthoritativeInstagramUrl();

              return (
                <div className="flex items-center gap-3 text-xs text-neutral-600 pt-1">
                  <span className="font-medium text-neutral-700">Share</span>
                  <div className="flex items-center gap-2.5">
                    {/* WhatsApp */}
                    <a
                      href={`https://api.whatsapp.com/send?text=${encodeURIComponent(`${shareTitle} ${currentShareUrl}`)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="w-7 h-7 rounded-full bg-emerald-500 text-white flex items-center justify-center hover:opacity-90 transition cursor-pointer"
                      title="Share on WhatsApp"
                      aria-label="Share on WhatsApp"
                    >
                      <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24">
                        <path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946.003-6.556 5.338-11.891 11.893-11.891 3.181.001 6.167 1.24 8.413 3.488 2.245 2.248 3.481 5.236 3.48 8.414-.003 6.557-5.338 11.892-11.893 11.892-1.99-.001-3.951-.5-5.688-1.448l-6.305 1.654zm6.597-3.807c1.676.995 3.276 1.591 5.392 1.592 5.448 0 9.886-4.434 9.889-9.885.002-5.462-4.415-9.89-9.881-9.892-5.452 0-9.887 4.434-9.889 9.884-.001 2.225.651 3.891 1.746 5.634l-.999 3.648 3.742-.981zm11.387-5.464c-.074-.124-.272-.198-.57-.347-.297-.149-1.758-.868-2.031-.967-.272-.099-.47-.149-.669.149-.198.297-.768.967-.941 1.165-.173.198-.347.223-.644.074-.297-.149-1.255-.462-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.297-.347.446-.521.151-.172.2-.296.3-.495.099-.198.05-.372-.025-.521-.075-.148-.669-1.611-.916-2.206-.242-.579-.487-.501-.669-.51l-.57-.01c-.198 0-.52.074-.792.372s-1.04 1.016-1.04 2.479 1.065 2.876 1.213 3.074c.149.198 2.095 3.2 5.076 4.487.709.306 1.263.489 1.694.626.712.226 1.36.194 1.872.118.571-.085 1.758-.719 2.006-1.413.248-.695.248-1.29.173-1.414z"/>
                      </svg>
                    </a>

                    {/* Facebook */}
                    <a
                      href={`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(currentShareUrl)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="w-7 h-7 rounded-full bg-[#1877F2] text-white flex items-center justify-center hover:opacity-90 transition cursor-pointer"
                      title="Share on Facebook"
                      aria-label="Share on Facebook"
                    >
                      <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24">
                        <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
                      </svg>
                    </a>

                    {/* X / Twitter */}
                    <a
                      href={`https://twitter.com/intent/tweet?text=${encodeURIComponent(shareTitle)}&url=${encodeURIComponent(currentShareUrl)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="w-7 h-7 rounded-full bg-black text-white flex items-center justify-center hover:opacity-90 transition cursor-pointer"
                      title="Share on X"
                      aria-label="Share on X"
                    >
                      <svg className="w-3.5 h-3.5 fill-current" viewBox="0 0 24 24">
                        <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
                      </svg>
                    </a>

                    {/* Instagram: copies product link and routes straight to Instagram app / website */}
                    <a
                      id="pdp-instagram-share-link"
                      href={instagramUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={() => handleCopyShareLink('Link copied! Opening Instagram...')}
                      className="w-7 h-7 rounded-full bg-gradient-to-tr from-[#f9ce34] via-[#ee2a7b] to-[#6228d7] text-white flex items-center justify-center hover:opacity-90 transition cursor-pointer"
                      title="Open Instagram & copy product link"
                      aria-label="Instagram"
                    >
                      <svg className="w-3.5 h-3.5 fill-current" viewBox="0 0 24 24">
                        <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/>
                      </svg>
                    </a>
                  </div>

                  {shareToast && (
                    <span className="text-[11px] text-emerald-600 font-medium ml-2">
                      {shareToast}
                    </span>
                  )}
                </div>
              );
            })()}

            {/* 7. Delivery Details & Pincode Checker (Screenshot 1 & 2) */}
            <div className="pt-2">
              <h3 className="text-xs font-bold text-neutral-900 mb-2">
                Delivery Details
              </h3>
              
              <form onSubmit={handleCheckPincode} className="relative flex items-center">
                <input
                  type="text"
                  maxLength={6}
                  value={pincode}
                  onChange={(e) => setPincode(e.target.value)}
                  placeholder="Enter Pincode"
                  className="w-full border border-neutral-300 py-2 px-3 text-xs focus:outline-none focus:border-black rounded-none placeholder:text-neutral-400 bg-white"
                />
                <button
                  type="submit"
                  className="absolute right-3 text-xs font-bold text-[#0066cc] hover:underline cursor-pointer"
                >
                  CHECK
                </button>
              </form>

              {pincodeStatus && (
                <p className={`text-[11px] mt-1.5 leading-relaxed ${
                  pincodeStatus.startsWith('✓') ? 'text-emerald-700 font-medium' : 'text-red-600'
                }`}>
                  {pincodeStatus}
                </p>
              )}

              {/* Return Policy Notice Box with circle icon */}
              <div className="mt-3 p-3 bg-neutral-50 border border-neutral-200/80 flex items-start gap-2.5">
                <div className="w-5 h-5 rounded-full border border-neutral-400 text-neutral-600 flex items-center justify-center shrink-0 mt-0.5">
                  <RotateCw className="w-3 h-3" />
                </div>
                <p className="text-[11px] text-neutral-600 leading-snug">
                  This product is eligible for return or exchange under our 30-day return or exchange policy. No questions asked.
                </p>
              </div>
            </div>

            {/* 8. Collapsible Accordions (Product Details & Product Description) */}
            <div className="border-t border-neutral-200 divide-y divide-neutral-200 pt-1">
              
              {/* Accordion 1: Product Details */}
              <div className="py-3">
                <button
                  onClick={() => setIsDetailsOpen(!isDetailsOpen)}
                  className="w-full flex items-center justify-between text-xs font-bold text-neutral-900 cursor-pointer"
                >
                  <span>Product Details</span>
                  {isDetailsOpen ? (
                    <ChevronUp className="w-4 h-4 text-neutral-500" />
                  ) : (
                    <ChevronDown className="w-4 h-4 text-neutral-500" />
                  )}
                </button>

                {isDetailsOpen && (
                  <div className="mt-3 space-y-3 text-xs text-neutral-700 leading-relaxed animate-in fade-in duration-200">
                    <div>
                      <strong className="block text-neutral-900 font-semibold mb-0.5">Material & Care:</strong>
                      <p>100% Cotton</p>
                      <p>Machine Wash</p>
                    </div>

                    <div>
                      <strong className="block text-neutral-900 font-semibold mb-0.5">Country of Origin:</strong>
                      <p>India (and proud)</p>
                    </div>

                    <div>
                      <strong className="block text-neutral-900 font-semibold mb-0.5">Manufactured & Sold By:</strong>
                      <p>TORIWEAR Originals Pvt. Ltd.</p>
                      <p>Studio Shibuya &amp; Anime Apparel Axis</p>
                      <p>Mumbai &amp; Tokyo</p>
                      <p className="text-neutral-900 font-medium">support@toriwear.com</p>
                      <p>Official Brand Care: +91 98201 45112</p>
                    </div>
                  </div>
                )}
              </div>

              {/* Accordion 2: Product Description */}
              <div className="py-3">
                <button
                  onClick={() => setIsDescOpen(!isDescOpen)}
                  className="w-full flex items-center justify-between text-xs font-bold text-neutral-900 cursor-pointer"
                >
                  <span>Product Description</span>
                  {isDescOpen ? (
                    <ChevronUp className="w-4 h-4 text-neutral-500" />
                  ) : (
                    <ChevronDown className="w-4 h-4 text-neutral-500" />
                  )}
                </button>

                {isDescOpen && (
                  <div className="mt-3 space-y-2 text-xs text-neutral-600 leading-relaxed animate-in fade-in duration-200">
                    <p>{product.description}</p>
                    {product.storyQuote && (
                      <p className="italic text-neutral-500">"{product.storyQuote}"</p>
                    )}
                    <ul className="list-disc pl-4 space-y-1 text-neutral-600 pt-1">
                      <li>Fit: {product.fit}</li>
                      <li>Fabric: {product.fabric || '100% Combed Heavy Cotton'}</li>
                      <li>Weight: {product.gsm || 240} GSM Heavyweight drape</li>
                      <li>Print: {product.print || 'High Density Puff & Screen Ink'}</li>
                    </ul>
                  </div>
                )}
              </div>

            </div>

          </div>
        </div>

        {/* ========================================================== */}
        {/* 3. "Others Also Bought" Carousel Section (Screenshot 3 & 4) */}
        {/* ========================================================== */}
        <div className="mt-16 pt-10 border-t border-neutral-200">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm sm:text-base font-bold text-neutral-900">
              Others Also Bought
            </h2>
            <div className="flex items-center gap-1">
              <button
                onClick={handlePrevCarousel}
                className="w-7 h-7 rounded-full border border-neutral-300 flex items-center justify-center text-neutral-600 hover:text-black hover:border-black transition cursor-pointer"
                aria-label="Previous items"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                onClick={handleNextCarousel}
                className="w-7 h-7 rounded-full border border-neutral-300 flex items-center justify-center text-neutral-600 hover:text-black hover:border-black transition cursor-pointer"
                aria-label="Next items"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>

          {isRelatedLoading && allProducts.length === 0 ? (
            <div className="flex flex-wrap gap-3 sm:grid sm:grid-cols-4 sm:gap-4" aria-busy="true">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="flex-1 basis-[calc(50%-6px)] min-w-[136px] sm:flex-initial sm:min-w-0 space-y-2">
                  <div className="aspect-[3/4] skeleton-neutral" />
                  <div className="h-3.5 w-3/4 rounded skeleton-neutral" />
                  <div className="h-3 w-1/2 rounded skeleton-neutral" />
                </div>
              ))}
            </div>
          ) : (
            <div className="flex flex-wrap gap-3 sm:grid sm:grid-cols-4 sm:gap-4 skeleton-reveal">
              {visibleCarouselItems.map((item) => (
                <div
                  key={item.id}
                  onClick={() => onSelectProduct(item)}
                  className="flex-1 basis-[calc(50%-6px)] min-w-[136px] sm:flex-initial sm:min-w-0 group cursor-pointer select-none"
                >
                  <div className="relative aspect-[3/4] bg-[#F5F5F3] overflow-hidden mb-2">
                    <ShimmerImage
                      src={item.images?.[0] || 'https://images.unsplash.com/photo-1521572267360-ee0c2909d518?w=600&auto=format&fit=crop&q=80'}
                      alt={item.name}
                      theme="neutral"
                      wrapperClassName="w-full h-full"
                      className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                      loading="lazy"
                    />
                    {/* Badges on card */}
                    <div className="absolute top-2 left-2 z-10 pointer-events-none">
                      <span className="bg-black/60 text-white text-[8px] font-bold px-1.5 py-0.5 tracking-wider uppercase">
                        OVERSIZED FIT
                      </span>
                    </div>
                    <div className="absolute bottom-2 left-2 z-10 pointer-events-none">
                      <span className="bg-black/80 text-white text-[8px] font-bold px-1.5 py-0.5 tracking-wider uppercase">
                        PREMIUM HEAVY GAUGE FABRIC
                      </span>
                    </div>
                  </div>

                  <h3 className="text-xs font-bold text-neutral-900 truncate group-hover:text-[#e11b23] transition">
                    {item.name}
                  </h3>
                  <p className="text-[11px] text-neutral-500 truncate">
                    {item.department === 'KIDS' ? "Kids T-Shirts_Others" : "Men T-Shirts_Others"}
                  </p>
                  <div className="text-xs font-bold text-neutral-900 mt-0.5">
                    ₹ {item.price.toLocaleString('en-IN')}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Recently Viewed Shelf (Filtered to exclude currently displayed product) */}
        {recentlyViewedIds.filter((id) => id !== product.id).length > 0 && (
          <div className="mt-14 pt-8 border-t border-neutral-800">
            <RecentlyViewedSection
              recentlyViewedIds={recentlyViewedIds.filter((id) => id !== product.id)}
              allProducts={allProducts}
              isLoading={isRelatedLoading}
              wishlist={wishlistIds}
              onSelectProduct={onSelectProduct}
              onToggleWishlist={(prod) => onToggleWishlist(prod.id)}
              onAddToCart={onAddToCart}
              onRemoveFromRecent={onRemoveFromRecent}
              onClearAllRecent={onClearAllRecent}
              title="RECENTLY VIEWED PIECES"
              subtitle="Quickly return to other anime streetwear designs you were checking out"
              className="py-6 bg-transparent border-0"
            />
          </div>
        )}

      </div>

      {/* ========================================================================= */}
      {/* 4A. FULLSCREEN ALL-IMAGES GALLERY VIEWER (WHEN > 6 IMAGES ADDED)          */}
      {/* ========================================================================= */}
      {isAllImagesOpen && typeof document !== 'undefined' && createPortal(
        <div 
          style={{ zIndex: 9998 }}
          className="fixed inset-0 z-[9998] bg-white flex flex-col animate-in fade-in duration-200"
        >
          {/* Sticky Top Bar */}
          <div className="w-full border-b border-neutral-200 bg-white px-4 sm:px-8 py-3.5 flex items-center justify-between gap-4 shrink-0">
            <div className="min-w-0">
              <div className="flex items-center gap-2.5">
                <h2 className="text-sm sm:text-base font-bold text-neutral-900 truncate">
                  {product.name}
                </h2>
                <span className="px-2 py-0.5 bg-neutral-900 text-white text-[10px] font-mono font-bold uppercase tracking-wider shrink-0">
                  {galleryImages.length} Photos
                </span>
              </div>
              <p className="text-[11px] sm:text-xs text-neutral-500 mt-0.5">
                Showing all {galleryImages.length} product images · Click any image for 100% HD zoom inspection
              </p>
            </div>

            <button
              type="button"
              onClick={() => setIsAllImagesOpen(false)}
              className="px-3.5 py-2 border border-neutral-300 hover:border-black bg-white hover:bg-neutral-50 text-neutral-900 text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 cursor-pointer transition shrink-0"
              aria-label="Close all images gallery"
            >
              <X className="w-4 h-4" />
              <span>Close</span>
            </button>
          </div>

          {/* Full-Viewport Multi-Column Scrollable Grid of All Images */}
          <div className="flex-1 overflow-y-auto p-3 sm:p-6 lg:p-8 bg-neutral-50">
            <div className="max-w-[1680px] mx-auto flex flex-wrap gap-3 sm:grid sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 sm:gap-4">
              {galleryImages.map((img, idx) => (
                <div
                  key={idx}
                  onClick={() => handleOpenZoom(idx)}
                  className="flex-1 basis-[calc(50%-6px)] min-w-[136px] sm:flex-initial sm:min-w-0 relative group bg-[#F5F5F3] overflow-hidden cursor-zoom-in aspect-[3/4] border border-neutral-200 hover:border-neutral-900 transition select-none"
                  title={`Click to zoom photo #${idx + 1}`}
                >
                  <ShimmerImage
                    src={img.url}
                    alt={`${product.name} photo ${idx + 1}`}
                    theme="neutral"
                    wrapperClassName="w-full h-full"
                    className="w-full h-full object-cover object-center transition-transform duration-300 group-hover:scale-[1.03]"
                    loading={idx < 8 ? 'eager' : 'lazy'}
                  />
                  <div className="absolute top-2.5 left-2.5 bg-black/75 text-white text-[10px] font-mono font-bold px-2 py-0.5">
                    {idx === 0 ? `#1 PRIMARY` : `#${idx + 1} / ${galleryImages.length}`}
                  </div>
                  <div className="absolute top-2.5 right-2.5 opacity-0 group-hover:opacity-100 transition-opacity bg-black/70 text-white p-1.5 rounded-full">
                    <ZoomIn className="w-3.5 h-3.5" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* ========================================================================= */}
      {/* 4B. FULLSCREEN ZOOM LIGHTBOX MODAL WITH ULTRA CLEAR DESIGN ZOOM (Snip 5)  */}
      {/* ========================================================================= */}
      {isZoomOpen && typeof document !== 'undefined' && createPortal(
        <div 
          style={{ zIndex: 9999 }}
          className="fixed inset-0 z-[9999] bg-black/92 backdrop-blur-sm flex flex-col items-center justify-between select-none animate-in fade-in duration-200"
          onClick={() => setIsZoomOpen(false)}
        >
          {/* Top Bar with Zoom Controls & Close Button (Screenshot 5) */}
          <div 
            className="w-full max-w-6xl px-4 py-3 flex items-center justify-between text-white z-20"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Zoom Tool Controls */}
            <div className="flex items-center gap-2 bg-neutral-900/80 backdrop-blur-md px-3 py-1.5 rounded-full border border-neutral-700 text-xs">
              <button
                onClick={() => setZoomScale((s) => Math.max(1, s - 0.4))}
                className="p-1 hover:text-red-400 transition cursor-pointer"
                title="Zoom Out (-)"
              >
                <ZoomOut className="w-4 h-4" />
              </button>

              <span className="font-mono font-semibold text-neutral-200 min-w-[45px] text-center">
                {Math.round(zoomScale * 100)}%
              </span>

              <button
                onClick={() => setZoomScale((s) => Math.min(3.5, s + 0.4))}
                className="p-1 hover:text-red-400 transition cursor-pointer"
                title="Zoom In (+)"
              >
                <ZoomIn className="w-4 h-4" />
              </button>

              <div className="w-[1px] h-3.5 bg-neutral-700 mx-1" />

              <button
                onClick={() => setZoomScale(1)}
                className="text-[10px] text-neutral-400 hover:text-white transition cursor-pointer px-1"
                title="Reset Zoom"
              >
                Reset
              </button>
            </div>

            <div className="text-[11px] text-neutral-400 hidden sm:block">
              Click image to toggle zoom • Move mouse to inspect print details &amp; fabric
            </div>

            {/* Close Button with Circle Border (Exact Screenshot 5) */}
            <button
              onClick={() => setIsZoomOpen(false)}
              className="min-w-[40px] min-h-[40px] rounded-full border border-white/60 bg-black/50 hover:bg-white hover:text-black transition flex items-center justify-center cursor-pointer"
              aria-label="Close zoom preview"
              title="Close (Esc)"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Central Main Zoom Stage */}
          <div 
            className="relative flex-1 min-h-0 w-full max-w-5xl flex items-center justify-center px-4 py-2 overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Left Circular Navigation Arrow (Screenshot 5) */}
            <button
              onClick={(e) => {
                e.stopPropagation();
                setZoomImgIndex((prev) => (prev > 0 ? prev - 1 : galleryImages.length - 1));
                setZoomScale(1.8);
              }}
              className="absolute left-4 sm:left-8 top-1/2 -translate-y-1/2 z-20 w-10 h-10 sm:w-11 sm:h-11 rounded-full bg-white/90 hover:bg-white text-black shadow-xl flex items-center justify-center transition active:scale-95 cursor-pointer"
              aria-label="Previous picture"
            >
              <ChevronLeft className="w-6 h-6" />
            </button>

            {/* Right Circular Navigation Arrow (Screenshot 5) */}
            <button
              onClick={(e) => {
                e.stopPropagation();
                setZoomImgIndex((prev) => (prev < galleryImages.length - 1 ? prev + 1 : 0));
                setZoomScale(1.8);
              }}
              className="absolute right-4 sm:right-8 top-1/2 -translate-y-1/2 z-20 w-10 h-10 sm:w-11 sm:h-11 rounded-full bg-white/90 hover:bg-white text-black shadow-xl flex items-center justify-center transition active:scale-95 cursor-pointer"
              aria-label="Next picture"
            >
              <ChevronRight className="w-6 h-6" />
            </button>

            {/* Zoomable Image Container with Smooth Pan Follow on Cursor */}
            <div 
              ref={zoomContainerRef}
              onMouseMove={handleZoomMouseMove}
              onMouseEnter={() => setIsHoverZooming(true)}
              onMouseLeave={() => setIsHoverZooming(false)}
              onClick={handleToggleZoomScale}
              className={`relative h-full max-h-[74vh] max-w-full aspect-[3/4] overflow-hidden bg-neutral-950 flex items-center justify-center rounded-xs shadow-2xl ${
                zoomScale > 1 ? 'cursor-move' : 'cursor-zoom-in'
              }`}
            >
              <img
                src={galleryImages[zoomImgIndex]?.url}
                alt={`${product.name} zoom view`}
                style={{
                  transformOrigin: `${panPosition.x}% ${panPosition.y}%`,
                  transform: `scale(${zoomScale})`,
                  transition: isHoverZooming && zoomScale > 1 ? 'none' : 'transform 0.25s ease-out',
                }}
                className="w-full h-full object-contain pointer-events-none select-none"
              />
            </div>
          </div>

          {/* Bottom Thumbnail Strip (Screenshot 5) */}
          <div 
            className="w-full bg-white py-3 px-4 flex items-center justify-center gap-2.5 sm:gap-3 overflow-x-auto no-scrollbar z-20"
            onClick={(e) => e.stopPropagation()}
          >
            {galleryImages.map((thumb, idx) => (
              <button
                key={idx}
                onClick={() => {
                  setZoomImgIndex(idx);
                  setZoomScale(1.8);
                }}
                className={`relative w-12 h-16 sm:w-14 sm:h-18 rounded-xs overflow-hidden transition cursor-pointer bg-neutral-100 shrink-0 ${
                  zoomImgIndex === idx
                    ? 'border-2 border-black scale-105 shadow-md'
                    : 'border border-neutral-300 opacity-60 hover:opacity-100'
                }`}
              >
                <img
                  src={thumb.url}
                  alt={`Thumbnail ${idx + 1}`}
                  className="w-full h-full object-cover object-center"
                />
              </button>
            ))}
          </div>

        </div>,
        document.body
      )}

    </div>
  );
};

export default ProductDetailPage;
