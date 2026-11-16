import React, { useState } from 'react';
import { useAdmin } from '../AdminDataContext';
import {
  Megaphone,
  Ticket,
  Flame,
  Plus,
  Trash2,
  X,
} from 'lucide-react';

export const MarketingView: React.FC = () => {
  const { 
    coupons, 
    addCoupon, 
    toggleCoupon, 
    deleteCoupon, 
    ads, 
    addAdvertisement, 
    updateAdvertisement, 
    deleteAdvertisement,
    flashSales 
  } = useAdmin();

  const [activeTab, setActiveTab] = useState<'ADS' | 'COUPONS' | 'FLASH' | 'CAMPAIGNS'>('COUPONS');
  
  // Create Coupon Modal
  const [showCouponModal, setShowCouponModal] = useState(false);
  const [couponCode, setCouponCode] = useState('');
  const [discountType, setDiscountType] = useState<'PERCENTAGE' | 'FIXED' | 'FREE_SHIPPING'>('PERCENTAGE');
  const [couponValue, setCouponValue] = useState(20);
  const [minOrder, setMinOrder] = useState(1499);
  const [maxDiscount] = useState(500);
  const [maxUsage, setMaxUsage] = useState(500);

  // Create Ad Modal
  const [showAdModal, setShowAdModal] = useState(false);
  const [adName, setAdName] = useState('');
  const [adPlacement, setAdPlacement] = useState<'Homepage Hero' | 'Homepage Banner' | 'New Drop' | 'Collection Page' | 'Product Page' | 'Popup' | 'Mobile Banner' | 'Checkout'>('Homepage Hero');
  const [adHeadline, setAdHeadline] = useState('');
  const [adCtaText] = useState('EXPLORE DROP');
  const [adCtaLink] = useState('/#catalogue');
  const [adImageUrl, setAdImageUrl] = useState('https://images.unsplash.com/photo-1578632767115-351597cf2477?w=1200&auto=format&fit=crop&q=80');

  const handleCreateCoupon = (e: React.FormEvent) => {
    e.preventDefault();
    if (!couponCode) return;
    addCoupon({
      code: couponCode.toUpperCase().trim(),
      discountType,
      value: Number(couponValue),
      minCartValue: Number(minOrder),
      maxDiscount: maxDiscount ? Number(maxDiscount) : undefined,
      usageLimit: Number(maxUsage),
      perCustomerLimit: 1,
      applicableFranchises: ['ALL'],
      startDate: '2026-09-01',
      endDate: '2026-12-31',
      isActive: true,
    });
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
              onClick={() => setShowCouponModal(true)}
              className="px-3.5 py-2 rounded-lg bg-red-600 hover:bg-red-500 text-white font-semibold text-xs transition-colors flex items-center gap-1.5 shadow-md shadow-red-600/20 cursor-pointer"
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
                        <span className="font-mono font-bold text-yellow-400 bg-yellow-400/10 px-2.5 py-1 rounded border border-yellow-400/20 text-xs">
                          {c.code}
                        </span>
                      </td>
                      <td className="p-3.5 font-mono font-bold text-white">
                        {c.discountType === 'PERCENTAGE' 
                          ? `${c.value}% OFF (Up to ₹${c.maxDiscount || 500})` 
                          : c.discountType === 'FIXED' 
                          ? `₹${c.value} FLAT OFF` 
                          : 'FREE SHIPPING'}
                      </td>
                      <td className="p-3.5 font-mono text-neutral-300">
                        ₹{c.minCartValue}
                      </td>
                      <td className="p-3.5 font-mono">
                        <span className="text-white font-bold">{c.usageCount}</span>
                        <span className="text-neutral-500"> / {c.usageLimit}</span>
                      </td>
                      <td className="p-3.5">
                        <button
                          onClick={() => toggleCoupon(c.id)}
                          className={`px-2.5 py-0.5 rounded text-[10px] font-mono uppercase font-semibold cursor-pointer ${
                            c.isActive 
                              ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' 
                              : 'bg-neutral-800 text-neutral-400'
                          }`}
                        >
                          {c.isActive ? 'ACTIVE' : 'PAUSED'}
                        </button>
                      </td>
                      <td className="p-3.5 text-neutral-400 font-mono text-[11px]">
                        Until {c.endDate}
                      </td>
                      <td className="p-3.5 text-right pr-4">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            deleteCoupon(c.id);
                          }}
                          className="p-1.5 text-neutral-500 hover:text-red-400 cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
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

      {/* Modal: Create Coupon */}
      {showCouponModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-[#14141c] border border-neutral-700 rounded-2xl p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-neutral-800 pb-3">
              <h3 className="text-sm font-bold text-white">Create Promotional Discount Coupon</h3>
              <button onClick={() => setShowCouponModal(false)} className="text-neutral-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateCoupon} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-neutral-300 uppercase tracking-wider mb-1">
                  Coupon Promo Code *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. SHINOBI20"
                  value={couponCode}
                  onChange={(e) => setCouponCode(e.target.value.toUpperCase())}
                  className="w-full px-3 py-2 bg-neutral-900 border border-neutral-700 rounded-lg text-xs text-white font-mono uppercase focus:outline-none focus:border-red-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
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
                    <option value="FREE_SHIPPING">Free Shipping</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-neutral-300 uppercase tracking-wider mb-1">
                    Discount Value ({discountType === 'PERCENTAGE' ? '%' : '₹'})
                  </label>
                  <input
                    type="number"
                    required
                    value={couponValue}
                    onChange={(e) => setCouponValue(Number(e.target.value))}
                    className="w-full px-3 py-2 bg-neutral-900 border border-neutral-700 rounded-lg text-xs text-white font-mono focus:outline-none focus:border-red-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-neutral-300 uppercase tracking-wider mb-1">
                    Min Order Value (₹)
                  </label>
                  <input
                    type="number"
                    value={minOrder}
                    onChange={(e) => setMinOrder(Number(e.target.value))}
                    className="w-full px-3 py-2 bg-neutral-900 border border-neutral-700 rounded-lg text-xs text-white font-mono focus:outline-none focus:border-red-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-neutral-300 uppercase tracking-wider mb-1">
                    Usage Cap Limit
                  </label>
                  <input
                    type="number"
                    value={maxUsage}
                    onChange={(e) => setMaxUsage(Number(e.target.value))}
                    className="w-full px-3 py-2 bg-neutral-900 border border-neutral-700 rounded-lg text-xs text-white font-mono focus:outline-none focus:border-red-500"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
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
                  Publish Coupon
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
