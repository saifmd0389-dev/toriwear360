import React, { useState } from 'react';
import { useAdmin } from '../AdminDataContext';
import {
  Megaphone,
  Ticket,
  Flame,
  Plus,
  Trash2,
  X,
  Pencil,
  ShieldCheck,
} from 'lucide-react';
import { Coupon } from '../types';

export const MarketingView: React.FC = () => {
  const { 
    coupons, 
    addCoupon, 
    updateCoupon,
    toggleCoupon, 
    deleteCoupon, 
    ads, 
    addAdvertisement, 
    updateAdvertisement, 
    deleteAdvertisement,
    flashSales 
  } = useAdmin();

  const [activeTab, setActiveTab] = useState<'ADS' | 'COUPONS' | 'FLASH' | 'CAMPAIGNS'>('COUPONS');
  
  // Create / Edit Coupon Modal
  const [showCouponModal, setShowCouponModal] = useState(false);
  const [editingCouponId, setEditingCouponId] = useState<string | null>(null);
  const [couponCode, setCouponCode] = useState('');
  const [discountType, setDiscountType] = useState<'PERCENTAGE' | 'FIXED' | 'FREE_SHIPPING'>('PERCENTAGE');
  const [couponValue, setCouponValue] = useState(20);
  const [minOrder, setMinOrder] = useState(1499);
  const [maxDiscount, setMaxDiscount] = useState<number>(500);
  const [maxUsage, setMaxUsage] = useState(500);
  const [perCustomerLimit, setPerCustomerLimit] = useState(1);
  const [endDate, setEndDate] = useState('2026-12-31');
  const [eligibleCategoriesText, setEligibleCategoriesText] = useState('');
  const [eligibleProductIdsText, setEligibleProductIdsText] = useState('');
  const [excludeShipping, setExcludeShipping] = useState(true);
  const [excludeTax, setExcludeTax] = useState(true);
  const [couponActive, setCouponActive] = useState(true);
  const [couponDescription, setCouponDescription] = useState('');

  // Create Ad Modal
  const [showAdModal, setShowAdModal] = useState(false);
  const [adName, setAdName] = useState('');
  const [adPlacement, setAdPlacement] = useState<'Homepage Hero' | 'Homepage Banner' | 'New Drop' | 'Collection Page' | 'Product Page' | 'Popup' | 'Mobile Banner' | 'Checkout'>('Homepage Hero');
  const [adHeadline, setAdHeadline] = useState('');
  const [adCtaText] = useState('EXPLORE DROP');
  const [adCtaLink] = useState('/#catalogue');
  const [adImageUrl, setAdImageUrl] = useState('https://images.unsplash.com/photo-1578632767115-351597cf2477?w=1200&auto=format&fit=crop&q=80');

  const openCreateCouponModal = () => {
    setEditingCouponId(null);
    setCouponCode('');
    setDiscountType('PERCENTAGE');
    setCouponValue(20);
    setMinOrder(1499);
    setMaxDiscount(500);
    setMaxUsage(500);
    setPerCustomerLimit(1);
    setEndDate('2026-12-31');
    setEligibleCategoriesText('');
    setEligibleProductIdsText('');
    setExcludeShipping(true);
    setExcludeTax(true);
    setCouponActive(true);
    setCouponDescription('');
    setShowCouponModal(true);
  };

  const openEditCouponModal = (coupon: Coupon) => {
    setEditingCouponId(coupon.id);
    setCouponCode(coupon.code);
    setDiscountType(coupon.discountType);
    setCouponValue(coupon.value);
    setMinOrder(coupon.minCartValue ?? coupon.minOrderValue ?? 0);
    setMaxDiscount(coupon.maxDiscount ?? 0);
    setMaxUsage(coupon.usageLimit ?? 100);
    setPerCustomerLimit(coupon.perCustomerLimit ?? 1);
    setEndDate(coupon.endDate || coupon.expiryDate || '2026-12-31');
    setEligibleCategoriesText((coupon.eligibleCategories || []).join(', '));
    setEligibleProductIdsText((coupon.eligibleProductIds || []).join(', '));
    setExcludeShipping(coupon.excludeShipping !== false);
    setExcludeTax(coupon.excludeTax !== false);
    setCouponActive(coupon.isActive !== false);
    setCouponDescription(coupon.description || '');
    setShowCouponModal(true);
  };

  const handleSaveCoupon = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!couponCode) return;

    const parseCsv = (str: string) =>
      str
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);

    const payload = {
      code: couponCode.toUpperCase().trim(),
      discountType,
      value: Number(couponValue),
      minCartValue: Number(minOrder),
      maxDiscount: maxDiscount > 0 ? Number(maxDiscount) : undefined,
      usageLimit: Number(maxUsage),
      perCustomerLimit: Math.max(1, Number(perCustomerLimit || 1)),
      applicableFranchises: ['ALL'],
      eligibleCategories: parseCsv(eligibleCategoriesText),
      eligibleProductIds: parseCsv(eligibleProductIdsText),
      excludeShipping,
      excludeTax,
      startDate: '2026-01-01',
      endDate: endDate || '2026-12-31',
      isActive: couponActive,
      description: couponDescription.trim(),
    };

    if (editingCouponId) {
      const ok = await updateCoupon(editingCouponId, payload);
      if (ok) {
        setShowCouponModal(false);
        setEditingCouponId(null);
      }
      return;
    }

    await addCoupon(payload);
    setShowCouponModal(false);
    setCouponCode('');
  };

  const handleCreateAd = (e: React.FormEvent) => {
    e.preventDefault();
    if (!adName || !adHeadline) return;
    addAdvertisement({
      name: adName,
      campaign: 'Season Drop Promo',
      placement: adPlacement,
      headline: adHeadline,
      subheadline: 'Exclusive street drop by Toriwear.',
      ctaText: adCtaText,
      ctaLink: adCtaLink,
      desktopImage: adImageUrl,
      mobileImage: adImageUrl,
      startDate: '2026-09-20',
      endDate: '2026-10-20',
      priority: 1,
      status: 'ACTIVE',
    });
    setShowAdModal(false);
    setAdName('');
    setAdHeadline('');
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-white tracking-tight flex items-center gap-2">
            <Megaphone className="w-5 h-5 text-purple-500" />
            <span>Marketing, Ad Placement & Promotions Engine</span>
          </h1>
          <p className="text-xs text-neutral-400 mt-0.5">
            Configure coupons, banner ads, flash sale drops, and customer acquisition channels.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {activeTab === 'COUPONS' && (
            <button
              onClick={openCreateCouponModal}
              className="px-3.5 py-2 rounded-lg bg-red-600 hover:bg-red-500 text-white font-semibold text-xs transition-colors flex items-center gap-1.5 shadow-md shadow-red-600/20 cursor-pointer whitespace-nowrap shrink-0"
            >
              <Plus className="w-4 h-4" />
              <span>Create Coupon</span>
            </button>
          )}

          {activeTab === 'ADS' && (
            <button
              onClick={() => setShowAdModal(true)}
              className="px-3.5 py-2 rounded-lg bg-red-600 hover:bg-red-500 text-white font-semibold text-xs transition-colors flex items-center gap-1.5 shadow-md shadow-red-600/20 cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Create New Ad</span>
            </button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 border-b border-neutral-800 pb-2 text-xs">
        <button
          onClick={() => setActiveTab('COUPONS')}
          className={`px-3 py-1.5 rounded-lg font-medium transition-colors cursor-pointer flex items-center gap-1.5 ${
            activeTab === 'COUPONS' 
              ? 'bg-red-600 text-white shadow-sm' 
              : 'text-neutral-400 hover:text-white bg-neutral-900'
          }`}
        >
          <Ticket className="w-3.5 h-3.5" />
          <span>Discount Coupons ({coupons.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('ADS')}
          className={`px-3 py-1.5 rounded-lg font-medium transition-colors cursor-pointer flex items-center gap-1.5 ${
            activeTab === 'ADS' 
              ? 'bg-red-600 text-white shadow-sm' 
              : 'text-neutral-400 hover:text-white bg-neutral-900'
          }`}
        >
          <Megaphone className="w-3.5 h-3.5" />
          <span>Homepage Advertisements ({ads.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('FLASH')}
          className={`px-3 py-1.5 rounded-lg font-medium transition-colors cursor-pointer flex items-center gap-1.5 ${
            activeTab === 'FLASH' 
              ? 'bg-red-600 text-white shadow-sm' 
              : 'text-neutral-400 hover:text-white bg-neutral-900'
          }`}
        >
          <Flame className="w-3.5 h-3.5" />
          <span>Flash Sales & Drops ({flashSales.length})</span>
        </button>
      </div>

      {/* TAB 1: COUPONS */}
      {activeTab === 'COUPONS' && (
        <div className="space-y-4">
          <div className="bg-[#14141c] border border-neutral-800 rounded-2xl overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-neutral-300">
                <thead className="bg-[#181824] text-[11px] uppercase tracking-wider text-neutral-400 border-b border-neutral-800 font-mono">
                  <tr>
                    <th className="p-3.5 pl-4">Coupon Code</th>
                    <th className="p-3.5">Discount Benefit</th>
                    <th className="p-3.5">Min Cart Order</th>
                    <th className="p-3.5">Usage / Limit</th>
                    <th className="p-3.5">Status</th>
                    <th className="p-3.5">Validity</th>
                    <th className="p-3.5 text-right pr-4">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-800/60 font-sans">
                  {coupons.map((c) => (
                    <tr key={c.id} className="hover:bg-neutral-800/40 transition-colors">
                      <td className="p-3.5 pl-4">
                        <div className="flex flex-col gap-1">
                          <span className="font-mono font-bold text-yellow-400 bg-yellow-400/10 px-2.5 py-1 rounded border border-yellow-400/20 text-xs w-max">
                            {c.code}
                          </span>
                          <div className="flex flex-wrap gap-1 text-[10px] font-mono text-neutral-400">
                            <span>Limit {c.perCustomerLimit || 1}/customer</span>
                            {c.excludeShipping !== false && <span>• Excl. shipping & tax</span>}
                            {(c.eligibleCategories?.length || 0) > 0 && (
                              <span className="text-sky-400">• {c.eligibleCategories?.length} categories</span>
                            )}
                            {(c.eligibleProductIds?.length || 0) > 0 && (
                              <span className="text-purple-400">• {c.eligibleProductIds?.length} SKUs</span>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="p-3.5 font-mono font-bold text-white">
                        {c.discountType === 'PERCENTAGE' 
                          ? `${c.value}% OFF${c.maxDiscount ? ` (Cap ₹${c.maxDiscount})` : ''}` 
                          : c.discountType === 'FIXED' 
                          ? `₹${c.value} FLAT OFF` 
                          : 'FREE SHIPPING'}
                      </td>
                      <td className="p-3.5 font-mono text-neutral-300">
                        ₹{c.minCartValue ?? c.minOrderValue ?? 0}
                      </td>
                      <td className="p-3.5 font-mono">
                        <span className="text-white font-bold">{c.usageCount}</span>
                        <span className="text-neutral-500"> / {c.usageLimit ?? '∞'}</span>
                      </td>
                      <td className="p-3.5">
                        <button
                          onClick={() => toggleCoupon(c.id)}
                          className={`px-2.5 py-0.5 rounded text-[10px] font-mono uppercase font-semibold cursor-pointer ${
                            c.isActive 
                              ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' 
                              : 'bg-neutral-800 text-neutral-400 border border-neutral-700'
                          }`}
                        >
                          {c.isActive ? 'ACTIVE' : 'PAUSED'}
                        </button>
                      </td>
                      <td className="p-3.5 text-neutral-400 font-mono text-[11px]">
                        Until {c.endDate}
                      </td>
                      <td className="p-3.5 text-right pr-4">
                        <div className="inline-flex items-center gap-1">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              openEditCouponModal(c);
                            }}
                            title="Edit coupon limits & rules"
                            className="p-1.5 text-neutral-400 hover:text-white cursor-pointer"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              deleteCoupon(c.id);
                            }}
                            title="Delete coupon"
                            className="p-1.5 text-neutral-500 hover:text-red-400 cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: ADVERTISEMENTS */}
      {activeTab === 'ADS' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {ads.map((ad) => (
              <div key={ad.id} className="bg-[#14141c] border border-neutral-800 rounded-2xl overflow-hidden flex flex-col justify-between">
                <div className="relative h-44 overflow-hidden bg-neutral-900">
                  <img src={ad.desktopImage} alt={ad.name} className="w-full h-full object-cover" />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent p-4 flex flex-col justify-end">
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-red-600 text-white w-max mb-1 uppercase">
                      {ad.placement}
                    </span>
                    <h3 className="text-base font-bold text-white tracking-tight">{ad.headline}</h3>
                    <p className="text-xs text-neutral-300">{ad.subheadline}</p>
                  </div>
                </div>

                <div className="p-4 space-y-3">
                  <div className="grid grid-cols-3 gap-2 text-center text-xs">
                    <div className="p-2 rounded-lg bg-neutral-900 border border-neutral-800">
                      <div className="text-[10px] text-neutral-500 uppercase">Impressions</div>
                      <div className="font-bold text-white font-mono">{ad.impressions.toLocaleString()}</div>
                    </div>
                    <div className="p-2 rounded-lg bg-neutral-900 border border-neutral-800">
                      <div className="text-[10px] text-neutral-500 uppercase">Clicks</div>
                      <div className="font-bold text-white font-mono">{ad.clicks.toLocaleString()}</div>
                    </div>
                    <div className="p-2 rounded-lg bg-neutral-900 border border-neutral-800">
                      <div className="text-[10px] text-neutral-500 uppercase">CTR</div>
                      <div className="font-bold text-emerald-400 font-mono">
                        {ad.impressions > 0 ? ((ad.clicks / ad.impressions) * 100).toFixed(1) : 0}%
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between text-xs pt-2 border-t border-neutral-800">
                    <span className="font-mono text-neutral-400 text-[11px]">CTA: "{ad.ctaText}" → {ad.ctaLink}</span>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => updateAdvertisement(ad.id, { status: ad.status === 'ACTIVE' ? 'DRAFT' : 'ACTIVE' })}
                        className={`text-[10px] font-mono px-2 py-0.5 rounded cursor-pointer ${
                          ad.status === 'ACTIVE' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-neutral-800 text-neutral-400'
                        }`}
                      >
                        {ad.status === 'ACTIVE' ? 'Active' : 'Disabled'}
                      </button>
                      <button
                        onClick={() => deleteAdvertisement(ad.id)}
                        className="p-1.5 text-neutral-500 hover:text-red-400 cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 3: FLASH SALES */}
      {activeTab === 'FLASH' && (
        <div className="space-y-4">
          {flashSales.map((fs) => (
            <div key={fs.id} className="p-5 rounded-2xl bg-[#14141c] border border-neutral-800 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
              <div>
                <div className="flex items-center gap-2">
                  <span className="px-2 py-0.5 rounded bg-red-600/20 text-red-400 border border-red-500/30 font-mono text-[10px] uppercase font-bold">
                    ACTIVE FLASH DROP
                  </span>
                  <span className="text-xs text-neutral-400">Ends {fs.endDate}</span>
                </div>
                <h3 className="text-base font-bold text-white mt-1">{fs.name}</h3>
                <p className="text-xs text-neutral-400">{fs.tagline} • {fs.productIds.length} apparel items included</p>
              </div>

              <div className="flex items-center gap-3">
                <div className="text-right font-mono">
                  <div className="text-lg font-black text-amber-400">{fs.discountPercent}% OFF</div>
                  <div className="text-[10px] text-neutral-500">Global cart reduction</div>
                </div>

                <button
                  className="px-3 py-1.5 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-200 text-xs font-medium cursor-pointer"
                >
                  Edit Drop Timing
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal: Create / Edit Coupon */}
      {showCouponModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="w-full max-w-lg bg-[#14141c] border border-neutral-700 rounded-2xl p-6 shadow-2xl space-y-4 my-6">
            <div className="flex items-center justify-between border-b border-neutral-800 pb-3">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-emerald-400" />
                <h3 className="text-sm font-bold text-white">
                  {editingCouponId ? `Edit Coupon: ${couponCode}` : 'Create Promotional Discount Coupon'}
                </h3>
              </div>
              <button onClick={() => setShowCouponModal(false)} className="text-neutral-400 hover:text-white cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveCoupon} className="space-y-3.5">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-neutral-300 uppercase tracking-wider mb-1">
                    Coupon Promo Code *
                  </label>
                  <input
                    type="text"
                    required
                    disabled={Boolean(editingCouponId)}
                    placeholder="e.g. SHINOBI20"
                    value={couponCode}
                    onChange={(e) => setCouponCode(e.target.value.toUpperCase())}
                    className="w-full px-3 py-2 bg-neutral-900 border border-neutral-700 rounded-lg text-xs text-white font-mono uppercase focus:outline-none focus:border-red-500 disabled:opacity-60"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-neutral-300 uppercase tracking-wider mb-1">
                    Expiry Date *
                  </label>
                  <input
                    type="date"
                    required
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="w-full px-3 py-2 bg-neutral-900 border border-neutral-700 rounded-lg text-xs text-white font-mono focus:outline-none focus:border-red-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-neutral-300 uppercase tracking-wider mb-1">
                    Discount Type
                  </label>
                  <select
                    value={discountType}
                    onChange={(e) => setDiscountType(e.target.value as any)}
                    className="w-full px-3 py-2 bg-neutral-900 border border-neutral-700 rounded-lg text-xs text-white focus:outline-none focus:border-red-500 cursor-pointer"
                  >
                    <option value="PERCENTAGE">Percentage (%)</option>
                    <option value="FIXED">Fixed Amount (₹)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-neutral-300 uppercase tracking-wider mb-1">
                    Value ({discountType === 'PERCENTAGE' ? '%' : '₹'})
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={discountType === 'PERCENTAGE' ? 100 : 100000}
                    required
                    value={couponValue}
                    onChange={(e) => setCouponValue(Number(e.target.value))}
                    className="w-full px-3 py-2 bg-neutral-900 border border-neutral-700 rounded-lg text-xs text-white font-mono focus:outline-none focus:border-red-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-neutral-300 uppercase tracking-wider mb-1">
                    Max Discount Cap (₹)
                  </label>
                  <input
                    type="number"
                    min={0}
                    placeholder="2500"
                    value={maxDiscount}
                    onChange={(e) => setMaxDiscount(Number(e.target.value))}
                    className="w-full px-3 py-2 bg-neutral-900 border border-neutral-700 rounded-lg text-xs text-white font-mono focus:outline-none focus:border-red-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-neutral-300 uppercase tracking-wider mb-1">
                    Min Order (₹)
                  </label>
                  <input
                    type="number"
                    min={0}
                    value={minOrder}
                    onChange={(e) => setMinOrder(Number(e.target.value))}
                    className="w-full px-3 py-2 bg-neutral-900 border border-neutral-700 rounded-lg text-xs text-white font-mono focus:outline-none focus:border-red-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-neutral-300 uppercase tracking-wider mb-1">
                    Global Usage Cap
                  </label>
                  <input
                    type="number"
                    min={1}
                    value={maxUsage}
                    onChange={(e) => setMaxUsage(Number(e.target.value))}
                    className="w-full px-3 py-2 bg-neutral-900 border border-neutral-700 rounded-lg text-xs text-white font-mono focus:outline-none focus:border-red-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-neutral-300 uppercase tracking-wider mb-1">
                    Per-Customer Limit
                  </label>
                  <input
                    type="number"
                    min={1}
                    value={perCustomerLimit}
                    onChange={(e) => setPerCustomerLimit(Number(e.target.value))}
                    className="w-full px-3 py-2 bg-neutral-900 border border-neutral-700 rounded-lg text-xs text-white font-mono focus:outline-none focus:border-red-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-neutral-300 uppercase tracking-wider mb-1">
                    Eligible Categories (CSV, optional)
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Oversized Tees, MEN"
                    value={eligibleCategoriesText}
                    onChange={(e) => setEligibleCategoriesText(e.target.value)}
                    className="w-full px-3 py-2 bg-neutral-900 border border-neutral-700 rounded-lg text-xs text-white font-mono focus:outline-none focus:border-red-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-neutral-300 uppercase tracking-wider mb-1">
                    Eligible Product IDs (CSV, optional)
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. tori-01, tori-03"
                    value={eligibleProductIdsText}
                    onChange={(e) => setEligibleProductIdsText(e.target.value)}
                    className="w-full px-3 py-2 bg-neutral-900 border border-neutral-700 rounded-lg text-xs text-white font-mono focus:outline-none focus:border-red-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-neutral-300 uppercase tracking-wider mb-1">
                  Description / Terms
                </label>
                <input
                  type="text"
                  placeholder="Customer-facing eligibility description"
                  value={couponDescription}
                  onChange={(e) => setCouponDescription(e.target.value)}
                  className="w-full px-3 py-2 bg-neutral-900 border border-neutral-700 rounded-lg text-xs text-white focus:outline-none focus:border-red-500"
                />
              </div>

              <div className="flex flex-wrap items-center gap-4 pt-1 text-xs text-neutral-300">
                <label className="inline-flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={excludeShipping}
                    onChange={(e) => setExcludeShipping(e.target.checked)}
                    className="rounded border-neutral-600 accent-red-600"
                  />
                  <span>Exclude shipping from discount</span>
                </label>
                <label className="inline-flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={excludeTax}
                    onChange={(e) => setExcludeTax(e.target.checked)}
                    className="rounded border-neutral-600 accent-red-600"
                  />
                  <span>Exclude tax from discount</span>
                </label>
                <label className="inline-flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={couponActive}
                    onChange={(e) => setCouponActive(e.target.checked)}
                    className="rounded border-neutral-600 accent-emerald-500"
                  />
                  <span className={couponActive ? 'text-emerald-400 font-semibold' : 'text-neutral-400'}>
                    Active (Live at Checkout)
                  </span>
                </label>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-neutral-800">
                <button
                  type="button"
                  onClick={() => setShowCouponModal(false)}
                  className="px-3 py-1.5 rounded-lg bg-neutral-800 text-neutral-300 text-xs cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 rounded-lg bg-red-600 hover:bg-red-500 text-white text-xs font-semibold shadow-md shadow-red-600/20 cursor-pointer"
                >
                  {editingCouponId ? 'Save Changes' : 'Publish Coupon'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Create Ad */}
      {showAdModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-[#14141c] border border-neutral-700 rounded-2xl p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-neutral-800 pb-3">
              <h3 className="text-sm font-bold text-white">Create Visual Placement Advertisement</h3>
              <button onClick={() => setShowAdModal(false)} className="text-neutral-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateAd} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-neutral-300 uppercase tracking-wider mb-1">
                  Campaign Internal Name *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Shinobi Drop Runway Banner"
                  value={adName}
                  onChange={(e) => setAdName(e.target.value)}
                  className="w-full px-3 py-2 bg-neutral-900 border border-neutral-700 rounded-lg text-xs text-white focus:outline-none focus:border-red-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-neutral-300 uppercase tracking-wider mb-1">
                  Placement Slot
                </label>
                <select
                  value={adPlacement}
                  onChange={(e) => setAdPlacement(e.target.value as any)}
                  className="w-full px-3 py-2 bg-neutral-900 border border-neutral-700 rounded-lg text-xs text-white focus:outline-none focus:border-red-500 cursor-pointer"
                >
                  <option value="Homepage Hero">Homepage Hero Parallax</option>
                  <option value="Homepage Banner">Homepage Mid-Grid Banner</option>
                  <option value="New Drop">New Runway Drop Header</option>
                  <option value="Collection Page">Collection Showcase Header</option>
                  <option value="Popup">First-Visit Welcome Modal</option>
                  <option value="Checkout">Checkout Incentive Banner</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-neutral-300 uppercase tracking-wider mb-1">
                  Headline Text *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. DROP 002: SHINOBI MULTIVERSE"
                  value={adHeadline}
                  onChange={(e) => setAdHeadline(e.target.value)}
                  className="w-full px-3 py-2 bg-neutral-900 border border-neutral-700 rounded-lg text-xs text-white focus:outline-none focus:border-red-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-neutral-300 uppercase tracking-wider mb-1">
                  Banner Image URL *
                </label>
                <input
                  type="url"
                  required
                  value={adImageUrl}
                  onChange={(e) => setAdImageUrl(e.target.value)}
                  className="w-full px-3 py-2 bg-neutral-900 border border-neutral-700 rounded-lg text-xs text-white focus:outline-none focus:border-red-500"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAdModal(false)}
                  className="px-3 py-1.5 rounded-lg bg-neutral-800 text-neutral-300 text-xs cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 rounded-lg bg-red-600 hover:bg-red-500 text-white text-xs font-semibold shadow-md shadow-red-600/20 cursor-pointer"
                >
                  Activate Advertisement
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
