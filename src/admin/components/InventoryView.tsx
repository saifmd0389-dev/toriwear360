import React, { useState, useEffect } from 'react';
import { useAdmin } from '../AdminDataContext';
import { InventoryItem } from '../types';
import {
  Package,
  Search,
  AlertTriangle,
  History,
  Plus,
  Minus,
  Edit2,
  Trash2,
  AlertCircle,
  X,
  Flame,
  CheckSquare,
  Square,
  Loader2,
  Layers,
  RefreshCw,
} from 'lucide-react';

export const InventoryView: React.FC = () => {
  const { 
    inventory, 
    inventoryMovements, 
    updateStock, 
    deleteInventoryItem, 
    bulkDeleteInventoryItems,
    clearAllProductsAndInventory,
    syncInventoryFromCatalog,
    deleteProduct, 
    products, 
    customers,
    showToast
  } = useAdmin();

  const [activeTab, setActiveTab] = useState<'STOCK' | 'MOVEMENTS'>('STOCK');
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'IN_STOCK' | 'LOW_STOCK' | 'CRITICAL_STOCK' | 'OUT_OF_STOCK'>('ALL');
  
  // Stock Adjustment Modal state
  const [adjustingItem, setAdjustingItem] = useState<InventoryItem | null>(null);
  const [newStockValue, setNewStockValue] = useState<number>(0);
  const [adjustmentReason, setAdjustmentReason] = useState('Manual warehouse physical count adjustment');

  // Product Delete Confirmation Dialog state
  const [deletingProductTarget, setDeletingProductTarget] = useState<{ item: InventoryItem; product?: any } | null>(null);
  const [deleteMode, setDeleteMode] = useState<'PRODUCT' | 'VARIANT'>('PRODUCT');
  const [deleteReason, setDeleteReason] = useState('Discontinued product / Permanent catalog removal');
  const [isDeleting, setIsDeleting] = useState(false);

  // Bulk Selection & Delete state
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [isBulkDeleteModalOpen, setIsBulkDeleteModalOpen] = useState(false);
  const [isClearAllModalOpen, setIsClearAllModalOpen] = useState(false);
  const [bulkDeleteReason, setBulkDeleteReason] = useState('Bulk product removal / Seasonal catalog write-off');
  const [isBulkDeleting, setIsBulkDeleting] = useState(false);
  const [isSyncingCatalog, setIsSyncingCatalog] = useState(false);

  // Prune any selected IDs that are no longer present in inventory
  useEffect(() => {
    const validIds = new Set(inventory.map((i) => i.id));
    setSelectedIds((prev) => {
      const next = prev.filter((id) => validIds.has(id));
      return next.length === prev.length ? prev : next;
    });
  }, [inventory]);

  const filtered = inventory.filter((item) => {
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      const match = item.productName.toLowerCase().includes(q) ||
                    item.sku.toLowerCase().includes(q) ||
                    item.size.toLowerCase().includes(q);
      if (!match) return false;
    }
    if (statusFilter !== 'ALL' && item.status !== statusFilter) return false;
    return true;
  });

  const lowStockCount = inventory.filter(i => i.status === 'LOW_STOCK' || i.status === 'CRITICAL_STOCK').length;
  const outOfStockCount = inventory.filter(i => i.status === 'OUT_OF_STOCK').length;

  const handleOpenAdjustModal = (item: InventoryItem) => {
    setAdjustingItem(item);
    setNewStockValue(item.availableStock);
    setAdjustmentReason('Restocked from Surat manufacturing hub');
  };

  const handleSaveStock = (e: React.FormEvent) => {
    e.preventDefault();
    if (!adjustingItem) return;
    updateStock(adjustingItem.variantId, Number(newStockValue), adjustmentReason);
    setAdjustingItem(null);
  };

  // Open product delete dialog
  const handleOpenDeleteDialog = (item: InventoryItem) => {
    const parentProduct = products.find(
      (p) => p.id === item.productId || p.variants?.some((v) => v.id === item.variantId || v.sku === item.sku)
    );
    setDeletingProductTarget({ item, product: parentProduct });
    setDeleteMode('PRODUCT');
    setDeleteReason(
      item.availableStock > 0 
        ? 'Manual write-off and permanent catalog removal' 
        : 'Discontinued product line'
    );
  };

  // Execute confirmed deletion
  const handleConfirmDelete = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!deletingProductTarget) return;

    setIsDeleting(true);
    try {
      const prodId = deletingProductTarget.product?.id || deletingProductTarget.item.productId;
      if (deleteMode === 'PRODUCT' && prodId) {
        // Permanently delete the product record from the system (removes all variants & refreshes product catalog)
        await deleteProduct(prodId);
        setSelectedIds((prev) => prev.filter((id) => {
          const invItem = inventory.find((i) => i.id === id);
          return invItem && invItem.productId !== prodId;
        }));
      } else {
        // Delete only this specific variant SKU
        deleteInventoryItem(
          deletingProductTarget.item.variantId || deletingProductTarget.item.sku, 
          deleteReason
        );
        setSelectedIds((prev) => prev.filter((id) => id !== deletingProductTarget.item.id));
      }
      setDeletingProductTarget(null);
    } catch (err) {
      console.error('[Inventory] Error executing delete:', err);
    } finally {
      setIsDeleting(false);
    }
  };

  // Bulk selection toggles
  const handleToggleSelect = (id: string) => {
    setSelectedIds((prev) => 
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    );
  };

  const handleToggleSelectAll = () => {
    const visibleIds = filtered.map((i) => i.id);
    const allSelected = visibleIds.length > 0 && visibleIds.every((id) => selectedIds.includes(id));
    if (allSelected) {
      setSelectedIds((prev) => prev.filter((id) => !visibleIds.includes(id)));
    } else {
      setSelectedIds((prev) => Array.from(new Set([...prev, ...visibleIds])));
    }
  };

  // Execute bulk delete atomically for selected items only
  const handleConfirmBulkDelete = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (selectedIds.length === 0) return;

    setIsBulkDeleting(true);
    try {
      const matchingItems = inventory.filter(
        (i) => selectedIds.includes(i.id) || selectedIds.includes(i.variantId) || selectedIds.includes(i.sku)
      );
      const targetPayload = Array.from(
        new Set(
          [
            ...selectedIds,
            ...matchingItems.flatMap((i) => [
              i.id,
              i.variantId,
              i.sku,
              i.productId && i.productId !== 'unlinked' ? i.productId : '',
            ]),
          ].filter((id): id is string => Boolean(id) && id !== 'unlinked')
        )
      );

      const result = await bulkDeleteInventoryItems(targetPayload, bulkDeleteReason);
      if (!result.success) {
        showToast(result.message || 'Failed to delete selected inventory products.');
        return;
      }
      setSelectedIds([]);
      setIsBulkDeleteModalOpen(false);
    } catch (err: any) {
      console.error('[Inventory] Bulk delete error:', err);
      showToast(err.message || 'Error occurred during bulk product deletion.');
    } finally {
      setIsBulkDeleting(false);
    }
  };

  // Open in-app bulk delete confirmation modal (never use window.confirm inside iframe)
  const handleDirectDeleteSelected = () => {
    if (selectedIds.length === 0) return;
    setIsBulkDeleteModalOpen(true);
  };

  // Execute full warehouse & product catalog wipe
  const handleConfirmClearAll = async () => {
    setIsBulkDeleting(true);
    try {
      const res = await clearAllProductsAndInventory();
      if (res && res.success === false) {
        showToast(res.message || 'Failed to clear all products and inventory.');
        return;
      }
      setSelectedIds([]);
      setIsClearAllModalOpen(false);
    } catch (err: any) {
      console.error('[Inventory] Clear all error:', err);
      showToast(err.message || 'Error clearing all products and inventory.');
    } finally {
      setIsBulkDeleting(false);
    }
  };

  const handleSyncFromCatalog = async () => {
    setIsSyncingCatalog(true);
    try {
      await syncInventoryFromCatalog();
    } finally {
      setIsSyncingCatalog(false);
    }
  };

  const selectedItems = inventory.filter((i) => selectedIds.includes(i.id));
  const totalSelectedStock = selectedItems.reduce((sum, i) => sum + i.availableStock, 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-white tracking-tight flex items-center gap-2">
            <Package className="w-5 h-5 text-amber-500" />
            <span>Warehouse Stock & Inventory Management</span>
          </h1>
          <p className="text-xs text-neutral-400 mt-0.5">
            Real-time multi-variant inventory counts across all sizes (S, M, L, XL, XXL) with full product record controls.
          </p>
        </div>

        {/* Status badges */}
        <div className="flex items-center gap-2 font-mono text-xs">
          <span className="px-2.5 py-1 rounded-lg bg-neutral-900 border border-neutral-800 text-neutral-300">
            Total Variants: <strong className="text-white">{inventory.length}</strong>
          </span>
          <span className="px-2.5 py-1 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-400">
            Low Stock: <strong>{lowStockCount}</strong>
          </span>
          <span className="px-2.5 py-1 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400">
            Out of Stock: <strong>{outOfStockCount}</strong>
          </span>
        </div>
      </div>

      {/* View Switcher */}
      <div className="flex items-center gap-2 border-b border-neutral-800 pb-2 text-xs">
        <button
          onClick={() => setActiveTab('STOCK')}
          className={`px-3 py-1.5 rounded-lg font-medium transition-colors cursor-pointer flex items-center gap-2 ${
            activeTab === 'STOCK' 
              ? 'bg-red-600 text-white shadow-sm' 
              : 'text-neutral-400 hover:text-white bg-neutral-900'
          }`}
        >
          <Package className="w-3.5 h-3.5" />
          <span>Active SKU Inventory</span>
        </button>

        <button
          onClick={() => setActiveTab('MOVEMENTS')}
          className={`px-3 py-1.5 rounded-lg font-medium transition-colors cursor-pointer flex items-center gap-2 ${
            activeTab === 'MOVEMENTS' 
              ? 'bg-red-600 text-white shadow-sm' 
              : 'text-neutral-400 hover:text-white bg-neutral-900'
          }`}
        >
          <History className="w-3.5 h-3.5" />
          <span>Movement History Log ({inventoryMovements.length})</span>
        </button>
      </div>

      {activeTab === 'STOCK' ? (
        <div className="space-y-4">
          {/* Toolbar */}
          <div className="flex flex-col sm:flex-row gap-3 bg-[#14141c] p-3.5 rounded-2xl border border-neutral-800">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-neutral-500 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search by SKU, product title, or size..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-2 bg-neutral-900 border border-neutral-700 rounded-lg text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-red-500"
              />
            </div>

            <div className="flex items-center gap-2">
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as any)}
                className="px-3 py-2 bg-neutral-900 border border-neutral-700 rounded-lg text-xs text-neutral-300 focus:outline-none focus:border-red-500 cursor-pointer"
              >
                <option value="ALL">All Stock Statuses</option>
                <option value="IN_STOCK">In Stock (Healthy)</option>
                <option value="LOW_STOCK">Low Stock (≤ 5 units)</option>
                <option value="CRITICAL_STOCK">Critical Stock (≤ 2 units)</option>
                <option value="OUT_OF_STOCK">Out of Stock (0 units)</option>
              </select>

              {products.length > 0 && (
                <button
                  type="button"
                  disabled={isSyncingCatalog}
                  onClick={handleSyncFromCatalog}
                  className="px-3 py-2 bg-neutral-900 hover:bg-neutral-800 border border-neutral-700 text-neutral-200 hover:text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer shrink-0 disabled:opacity-50"
                  title="Sync missing product variants from catalog into warehouse inventory"
                >
                  <RefreshCw className={`w-3.5 h-3.5 text-amber-400 ${isSyncingCatalog ? 'animate-spin' : ''}`} />
                  <span className="hidden sm:inline">{isSyncingCatalog ? 'Syncing...' : 'Sync Catalog SKUs'}</span>
                </button>
              )}

              {(inventory.length > 0 || products.length > 0) && (
                <button
                  type="button"
                  onClick={() => setIsClearAllModalOpen(true)}
                  className="px-3 py-2 bg-red-950/40 hover:bg-red-950/80 border border-red-500/30 hover:border-red-500 text-red-300 hover:text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer shrink-0"
                  title="Permanently remove all products and warehouse inventory records"
                >
                  <Trash2 className="w-3.5 h-3.5 text-red-400" />
                  <span className="hidden sm:inline">Delete All Products</span>
                </button>
              )}
            </div>
          </div>

          {/* Bulk Action Banner when variants are selected */}
          {selectedIds.length > 0 && (
            <div className="bg-red-950/40 border border-red-500/40 rounded-xl px-4 py-2.5 flex items-center justify-between text-xs animate-in fade-in">
              <div className="flex items-center gap-2 text-white">
                <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                <span className="font-semibold">{selectedIds.length} item{selectedIds.length > 1 ? 's' : ''} selected</span>
                <span className="text-neutral-400">({totalSelectedStock} active units)</span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setSelectedIds([])}
                  className="px-2.5 py-1 text-neutral-400 hover:text-white rounded hover:bg-neutral-800 transition-colors cursor-pointer"
                >
                  Clear Selection
                </button>
                <button
                  type="button"
                  onClick={() => setIsClearAllModalOpen(true)}
                  className="px-2.5 py-1 text-red-400 hover:text-white rounded hover:bg-red-950/60 border border-red-500/30 transition-colors cursor-pointer"
                >
                  Delete All ({inventory.length})
                </button>
                <button
                  type="button"
                  onClick={handleDirectDeleteSelected}
                  className="px-3 py-1.5 rounded-lg bg-red-600 hover:bg-red-500 text-white font-medium flex items-center gap-1.5 shadow-sm shadow-red-600/30 transition-colors cursor-pointer"
                  title="Permanently remove selected products"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Delete Selected Products ({selectedIds.length})</span>
                </button>
              </div>
            </div>
          )}

          {/* Stock Table */}
          <div className="bg-[#14141c] border border-neutral-800 rounded-2xl overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-neutral-300">
                <thead className="bg-[#181824] text-[11px] uppercase tracking-wider text-neutral-400 border-b border-neutral-800">
                  <tr>
                    <th className="p-3.5 pl-4 w-10">
                      <button
                        type="button"
                        onClick={handleToggleSelectAll}
                        className="text-neutral-400 hover:text-white transition-colors cursor-pointer"
                        title={filtered.length > 0 && filtered.every((i) => selectedIds.includes(i.id)) ? 'Deselect all' : 'Select all'}
                      >
                        {filtered.length > 0 && filtered.every((i) => selectedIds.includes(i.id)) ? (
                          <CheckSquare className="w-4 h-4 text-red-500" />
                        ) : (
                          <Square className="w-4 h-4 text-neutral-500" />
                        )}
                      </button>
                    </th>
                    <th className="p-3.5">Product Title & Image</th>
                    <th className="p-3.5">Variant SKU</th>
                    <th className="p-3.5">Size</th>
                    <th className="p-3.5">Color</th>
                    <th className="p-3.5">Available Units</th>
                    <th className="p-3.5">Reserved</th>
                    <th className="p-3.5">Units Sold</th>
                    <th className="p-3.5">Status</th>
                    <th className="p-3.5 text-right pr-4">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-800/60 font-sans">
                  {filtered.map((item) => {
                    const isLow = item.status === 'LOW_STOCK' || item.status === 'CRITICAL_STOCK';
                    const isOut = item.status === 'OUT_OF_STOCK';
                    const isSelected = selectedIds.includes(item.id);
                    const parentProduct = products.find(
                      (p) => p.id === item.productId || p.variants?.some((v) => v.id === item.variantId || v.sku === item.sku)
                    );
                    const thumbnail = parentProduct?.images?.[0];
                    const waitingCount = customers.filter((c) => 
                      (c.wishlistItems || []).some((w) => 
                        w.inStock === false && (
                          w.productName.toLowerCase().includes(item.productName.toLowerCase()) || 
                          item.productName.toLowerCase().includes(w.productName.toLowerCase()) ||
                          w.productId === item.productId
                        )
                      )
                    ).length;

                    return (
                      <tr 
                        key={item.id} 
                        className={`transition-colors ${isSelected ? 'bg-red-950/20' : 'hover:bg-neutral-800/40'}`}
                      >
                        <td className="p-3.5 pl-4">
                          <button
                            type="button"
                            onClick={() => handleToggleSelect(item.id)}
                            className="text-neutral-400 hover:text-white transition-colors cursor-pointer"
                          >
                            {isSelected ? (
                              <CheckSquare className="w-4 h-4 text-red-500" />
                            ) : (
                              <Square className="w-4 h-4 text-neutral-600 hover:text-neutral-400" />
                            )}
                          </button>
                        </td>
                        <td className="p-3.5 font-semibold text-white">
                          <div className="flex items-center gap-3">
                            {thumbnail ? (
                              <img 
                                src={thumbnail} 
                                alt="" 
                                className="w-10 h-10 rounded-lg object-cover bg-neutral-800 shrink-0 border border-neutral-700/50" 
                              />
                            ) : (
                              <div className="w-10 h-10 rounded-lg bg-neutral-800 flex items-center justify-center text-neutral-500 shrink-0 border border-neutral-700/50">
                                <Package className="w-5 h-5 text-neutral-600" />
                              </div>
                            )}
                            <div className="min-w-0">
                              <div className="flex items-center gap-2">
                                <span className="truncate max-w-[200px] sm:max-w-xs">{item.productName}</span>
                                {isOut && waitingCount > 0 && (
                                  <span className="px-1.5 py-0.5 rounded text-[9px] font-mono font-bold bg-red-950/80 border border-red-500/40 text-red-400 flex items-center gap-1 shadow-sm shrink-0">
                                    <Flame className="w-3 h-3 fill-red-400" />
                                    <span>{waitingCount} waiting</span>
                                  </span>
                                )}
                              </div>
                              <div className="text-[10px] font-mono text-neutral-500">
                                {parentProduct?.catalogNumber ? `CAT #${parentProduct.catalogNumber} • ` : ''}{item.productId}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="p-3.5 font-mono text-neutral-400">
                          {item.sku}
                        </td>
                        <td className="p-3.5 font-mono font-bold text-white">
                          {item.size}
                        </td>
                        <td className="p-3.5">
                          {item.colorName}
                        </td>
                        <td className="p-3.5 font-mono">
                          <span className={`font-bold ${isOut ? 'text-red-500' : isLow ? 'text-amber-400' : 'text-emerald-400'}`}>
                            {item.availableStock} pcs
                          </span>
                        </td>
                        <td className="p-3.5 font-mono text-neutral-500">
                          {item.reservedStock}
                        </td>
                        <td className="p-3.5 font-mono text-neutral-400">
                          {item.sold}
                        </td>
                        <td className="p-3.5">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-mono uppercase font-semibold ${
                            item.status === 'IN_STOCK'
                              ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                              : item.status === 'LOW_STOCK'
                              ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                              : item.status === 'CRITICAL_STOCK'
                              ? 'bg-orange-500/10 text-orange-400 border border-orange-500/20'
                              : 'bg-red-500/10 text-red-400 border border-red-500/20'
                          }`}>
                            {item.status.replace('_', ' ')}
                          </span>
                        </td>
                        <td className="p-3.5 text-right pr-4">
                          <div className="inline-flex items-center gap-1.5">
                            <button
                              onClick={() => handleOpenAdjustModal(item)}
                              title="Reconcile stock count"
                              className="px-2.5 py-1 rounded bg-neutral-800 hover:bg-neutral-700 text-white text-[11px] font-medium border border-neutral-700 transition-colors inline-flex items-center gap-1 cursor-pointer"
                            >
                              <Edit2 className="w-3 h-3 text-neutral-400" />
                              <span>Adjust</span>
                            </button>
                            <button
                              onClick={() => handleOpenDeleteDialog(item)}
                              title="Permanently remove product record from system"
                              className="px-2 py-1 rounded bg-neutral-800/80 hover:bg-red-950/70 text-neutral-400 hover:text-red-400 border border-neutral-700/60 hover:border-red-500/50 transition-colors inline-flex items-center gap-1 cursor-pointer"
                            >
                              <Trash2 className="w-3 h-3" />
                              <span className="text-[11px] font-medium">Delete</span>
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                  {filtered.length === 0 && (
                    <tr>
                      <td colSpan={10} className="p-8 text-center text-neutral-500">
                        No inventory product entries found matching your query.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ) : (
        /* MOVEMENTS LOG TAB */
        <div className="bg-[#14141c] border border-neutral-800 rounded-2xl overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-neutral-300">
              <thead className="bg-[#181824] text-[11px] uppercase tracking-wider text-neutral-400 border-b border-neutral-800">
                <tr>
                  <th className="p-3.5 pl-4">Timestamp</th>
                  <th className="p-3.5">Product & SKU</th>
                  <th className="p-3.5">Action</th>
                  <th className="p-3.5">Amount</th>
                  <th className="p-3.5">Prev Stock</th>
                  <th className="p-3.5">New Stock</th>
                  <th className="p-3.5">Audit Reason</th>
                  <th className="p-3.5 text-right pr-4">Operator</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-800/60 font-sans">
                {inventoryMovements.map((mov) => (
                  <tr key={mov.id} className="hover:bg-neutral-800/40 transition-colors">
                    <td className="p-3.5 pl-4 font-mono text-neutral-400">
                      {mov.timestamp}
                    </td>
                    <td className="p-3.5">
                      <div className="font-semibold text-white">{mov.productName}</div>
                      <div className="text-[10px] font-mono text-neutral-500">{mov.sku}</div>
                    </td>
                    <td className="p-3.5 font-mono">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                        mov.type === 'INCREASE' || mov.type === 'RESTOCK'
                          ? 'bg-emerald-500/10 text-emerald-400' 
                          : 'bg-red-500/10 text-red-400'
                      }`}>
                        {mov.type}
                      </span>
                    </td>
                    <td className="p-3.5 font-mono font-bold">
                      <span className={mov.amount >= 0 ? 'text-emerald-400' : 'text-red-400'}>
                        {mov.amount >= 0 ? `+${mov.amount}` : mov.amount}
                      </span>
                    </td>
                    <td className="p-3.5 font-mono text-neutral-400">{mov.previousStock}</td>
                    <td className="p-3.5 font-mono font-bold text-white">{mov.newStock}</td>
                    <td className="p-3.5 text-neutral-300 max-w-xs">{mov.reason}</td>
                    <td className="p-3.5 text-right pr-4 text-neutral-400 font-medium">
                      {mov.adminName}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Stock Adjustment Modal */}
      {adjustingItem && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-[#14141c] border border-neutral-700 rounded-2xl shadow-2xl p-6 space-y-4 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-neutral-800 pb-3">
              <div>
                <h3 className="text-sm font-bold text-white">Reconcile Physical Inventory</h3>
                <p className="text-xs text-neutral-400">{adjustingItem.productName} ({adjustingItem.size})</p>
              </div>
              <button onClick={() => setAdjustingItem(null)} className="text-neutral-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveStock} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-neutral-300 uppercase tracking-wider mb-1">
                  SKU Identifier
                </label>
                <input
                  type="text"
                  disabled
                  value={adjustingItem.sku}
                  className="w-full px-3 py-2 bg-neutral-900 border border-neutral-800 rounded-lg text-xs text-neutral-400 font-mono"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-semibold text-neutral-300 uppercase tracking-wider">
                    New Physical Count
                  </label>
                  <span className="text-xs text-neutral-400 font-mono">
                    Current: <strong className="text-white">{adjustingItem.availableStock}</strong>
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setNewStockValue(Math.max(0, newStockValue - 5))}
                    className="p-2 rounded bg-neutral-800 hover:bg-neutral-700 text-white font-mono text-xs cursor-pointer"
                  >
                    -5
                  </button>
                  <button
                    type="button"
                    onClick={() => setNewStockValue(Math.max(0, newStockValue - 1))}
                    className="p-2 rounded bg-neutral-800 hover:bg-neutral-700 text-white cursor-pointer"
                  >
                    <Minus className="w-3.5 h-3.5" />
                  </button>
                  <input
                    type="number"
                    required
                    value={newStockValue}
                    onChange={(e) => setNewStockValue(Math.max(0, Number(e.target.value)))}
                    className="flex-1 text-center py-2 bg-neutral-900 border border-neutral-700 rounded-lg text-sm text-white font-mono font-bold focus:outline-none focus:border-red-500"
                  />
                  <button
                    type="button"
                    onClick={() => setNewStockValue(newStockValue + 1)}
                    className="p-2 rounded bg-neutral-800 hover:bg-neutral-700 text-white cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setNewStockValue(newStockValue + 10)}
                    className="p-2 rounded bg-neutral-800 hover:bg-neutral-700 text-white font-mono text-xs cursor-pointer"
                  >
                    +10
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-neutral-300 uppercase tracking-wider mb-1">
                  Audit Reason (Compulsory for audit log)
                </label>
                <input
                  type="text"
                  required
                  value={adjustmentReason}
                  onChange={(e) => setAdjustmentReason(e.target.value)}
                  placeholder="e.g. Received batch, Damaged in transit, QC rejection"
                  className="w-full px-3 py-2 bg-neutral-900 border border-neutral-700 rounded-lg text-xs text-white focus:outline-none focus:border-red-500"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setAdjustingItem(null)}
                  className="px-3 py-1.5 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-300 text-xs cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 rounded-lg bg-red-600 hover:bg-red-500 text-white text-xs font-semibold shadow-md shadow-red-600/20 cursor-pointer"
                >
                  Save Stock & Record
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Permanently Delete Product Record Confirmation Dialog */}
      {deletingProductTarget && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-lg bg-[#14141c] border border-red-500/50 rounded-2xl shadow-2xl p-6 space-y-5 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-neutral-800 pb-3">
              <div className="flex items-center gap-2.5 text-red-500">
                <div className="p-2 rounded-xl bg-red-500/10 border border-red-500/30">
                  <Trash2 className="w-5 h-5 text-red-500" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white tracking-tight">Permanently Delete Product Record</h3>
                  <p className="text-xs text-neutral-400">Confirm irreversible removal from catalog, database, and inventory</p>
                </div>
              </div>
              <button 
                onClick={() => setDeletingProductTarget(null)} 
                disabled={isDeleting}
                className="text-neutral-400 hover:text-white p-1 rounded-lg hover:bg-neutral-800 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Target Product Preview Card */}
            <div className="p-4 bg-neutral-900/90 rounded-xl border border-neutral-800 flex items-center gap-3.5">
              {deletingProductTarget.product?.images?.[0] ? (
                <img 
                  src={deletingProductTarget.product.images[0]} 
                  alt="" 
                  className="w-14 h-14 rounded-lg object-cover bg-neutral-800 shrink-0 border border-neutral-700/60" 
                />
              ) : (
                <div className="w-14 h-14 rounded-lg bg-neutral-800 flex items-center justify-center text-neutral-500 shrink-0 border border-neutral-700/60">
                  <Package className="w-7 h-7 text-neutral-600" />
                </div>
              )}
              <div className="min-w-0 flex-1">
                <h4 className="text-sm font-bold text-white truncate">
                  {deletingProductTarget.product?.name || deletingProductTarget.item.productName}
                </h4>
                <div className="text-xs text-neutral-400 font-mono mt-0.5 flex flex-wrap items-center gap-2">
                  <span>ID: {deletingProductTarget.product?.id || deletingProductTarget.item.productId}</span>
                  {deletingProductTarget.product?.catalogNumber && (
                    <span>• CAT #{deletingProductTarget.product.catalogNumber}</span>
                  )}
                  {deletingProductTarget.product?.price && (
                    <span>• ₹{deletingProductTarget.product.price}</span>
                  )}
                </div>
                <div className="text-[11px] text-neutral-400 font-mono mt-1">
                  SKU: <strong className="text-neutral-200">{deletingProductTarget.item.sku}</strong> ({deletingProductTarget.item.size}) • Available: <strong className="text-amber-400">{deletingProductTarget.item.availableStock} pcs</strong>
                </div>
              </div>
            </div>

            {/* Deletion Scope Selector */}
            <div className="space-y-2">
              <label className="block text-xs font-semibold text-neutral-300 uppercase tracking-wider">
                Select Deletion Scope
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <button
                  type="button"
                  onClick={() => setDeleteMode('PRODUCT')}
                  className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                    deleteMode === 'PRODUCT'
                      ? 'bg-red-950/40 border-red-500/60 text-white shadow-sm'
                      : 'bg-neutral-900 border-neutral-800 text-neutral-400 hover:text-white hover:border-neutral-700'
                  }`}
                >
                  <div className="flex items-center gap-2 font-bold text-xs text-white">
                    <Package className="w-4 h-4 text-red-500 shrink-0" />
                    <span>Entire Product Record</span>
                  </div>
                  <p className="text-[11px] text-neutral-400 mt-1 leading-snug">
                    Permanently deletes product, all size variants, and refreshes the product catalog.
                  </p>
                </button>

                <button
                  type="button"
                  onClick={() => setDeleteMode('VARIANT')}
                  className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                    deleteMode === 'VARIANT'
                      ? 'bg-amber-950/40 border-amber-500/60 text-white shadow-sm'
                      : 'bg-neutral-900 border-neutral-800 text-neutral-400 hover:text-white hover:border-neutral-700'
                  }`}
                >
                  <div className="flex items-center gap-2 font-bold text-xs text-white">
                    <Layers className="w-4 h-4 text-amber-500 shrink-0" />
                    <span>Only SKU {deletingProductTarget.item.size}</span>
                  </div>
                  <p className="text-[11px] text-neutral-400 mt-1 leading-snug">
                    Removes only variant {deletingProductTarget.item.sku}. Retains the parent product.
                  </p>
                </button>
              </div>
            </div>

            {/* Warning Message */}
            <div className="p-3 bg-red-950/30 border border-red-500/40 rounded-xl flex items-start gap-2.5 text-xs text-red-200">
              <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
              <span>
                {deleteMode === 'PRODUCT'
                  ? 'Warning: This action will permanently delete this product and all its inventory variants from the PostgreSQL database, storefront, and cache. The product list will be refreshed immediately.'
                  : `Warning: This will permanently remove variant ${deletingProductTarget.item.sku} (${deletingProductTarget.item.size}) from the inventory records and warehouse ledger.`}
              </span>
            </div>

            <form onSubmit={handleConfirmDelete} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-neutral-300 uppercase tracking-wider mb-1">
                  Audit Deletion Reason (Logged to ledger)
                </label>
                <input
                  type="text"
                  required
                  disabled={isDeleting}
                  value={deleteReason}
                  onChange={(e) => setDeleteReason(e.target.value)}
                  placeholder="e.g. Discontinued product line, Damaged stock write-off, Factory QC recall"
                  className="w-full px-3 py-2 bg-neutral-900 border border-neutral-700 rounded-lg text-xs text-white focus:outline-none focus:border-red-500"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-2 border-t border-neutral-800">
                <button
                  type="button"
                  disabled={isDeleting}
                  onClick={() => setDeletingProductTarget(null)}
                  className="px-4 py-2 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-300 text-xs font-semibold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isDeleting}
                  className="px-4 py-2 rounded-lg bg-red-600 hover:bg-red-500 text-white text-xs font-semibold flex items-center gap-2 shadow-lg shadow-red-600/30 cursor-pointer disabled:opacity-50"
                >
                  {isDeleting ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Deleting Product...</span>
                    </>
                  ) : (
                    <>
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>
                        {deleteMode === 'PRODUCT' ? 'Permanently Delete Product' : 'Delete Variant SKU'}
                      </span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Bulk Delete Confirmation Modal */}
      {isBulkDeleteModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-[#14141c] border border-red-500/50 rounded-2xl shadow-2xl p-6 space-y-4 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-neutral-800 pb-3">
              <div className="flex items-center gap-2 text-red-500">
                <AlertTriangle className="w-5 h-5 text-red-500" />
                <h3 className="text-sm font-bold text-white">Bulk Delete Product Entries</h3>
              </div>
              <button 
                onClick={() => setIsBulkDeleteModalOpen(false)} 
                disabled={isBulkDeleting}
                className="text-neutral-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="bg-neutral-900/80 p-3.5 rounded-xl border border-neutral-800 space-y-1.5 text-xs">
              <div className="flex justify-between">
                <span className="text-neutral-400">Selected Product Entries:</span>
                <span className="text-white font-bold">{selectedIds.length} items</span>
              </div>
              <div className="flex justify-between">
                <span className="text-neutral-400">Total Active Stock Units:</span>
                <span className="font-mono font-bold text-red-400">{totalSelectedStock} pcs</span>
              </div>
            </div>

            <div className="p-3 bg-red-950/40 border border-red-500/30 rounded-xl flex items-start gap-2.5 text-xs text-red-300">
              <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
              <span>
                Are you sure you want to permanently delete these <strong>{selectedIds.length}</strong> product entries? This will remove all associated product records and warehouse stock from PostgreSQL database and storefront, and refresh the product list immediately.
              </span>
            </div>

            <form onSubmit={handleConfirmBulkDelete} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-neutral-300 uppercase tracking-wider mb-1">
                  Audit Deletion Reason (Optional)
                </label>
                <input
                  type="text"
                  disabled={isBulkDeleting}
                  value={bulkDeleteReason}
                  onChange={(e) => setBulkDeleteReason(e.target.value)}
                  placeholder="e.g. End of seasonal line, Warehouse clearance"
                  className="w-full px-3 py-2 bg-neutral-900 border border-neutral-700 rounded-lg text-xs text-white focus:outline-none focus:border-red-500"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-neutral-800">
                <button
                  type="button"
                  disabled={isBulkDeleting}
                  onClick={() => setIsBulkDeleteModalOpen(false)}
                  className="px-3 py-1.5 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-300 text-xs cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isBulkDeleting}
                  className="px-4 py-2 rounded-lg bg-red-600 hover:bg-red-500 text-white text-xs font-semibold flex items-center gap-1.5 shadow-md shadow-red-600/30 cursor-pointer disabled:opacity-50"
                >
                  {isBulkDeleting ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Deleting Products...</span>
                    </>
                  ) : (
                    <>
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Permanently Delete {selectedIds.length} Product Entries</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Clear All Products Confirmation Modal */}
      {isClearAllModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-[#14141c] border border-red-500/60 rounded-2xl shadow-2xl p-6 space-y-4 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-neutral-800 pb-3">
              <div className="flex items-center gap-2 text-red-500">
                <AlertTriangle className="w-5 h-5 text-red-500" />
                <h3 className="text-sm font-bold text-white">Permanently Delete All Products</h3>
              </div>
              <button 
                onClick={() => setIsClearAllModalOpen(false)} 
                disabled={isBulkDeleting}
                className="text-neutral-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="bg-red-950/30 p-3.5 rounded-xl border border-red-500/40 space-y-1.5 text-xs text-red-200">
              <div className="flex justify-between">
                <span className="text-neutral-400">Total Products in Catalog:</span>
                <span className="text-white font-bold">{products.length} products</span>
              </div>
              <div className="flex justify-between">
                <span className="text-neutral-400">Total Warehouse SKU Variants:</span>
                <span className="font-mono font-bold text-red-400">{inventory.length} variants</span>
              </div>
            </div>

            <div className="p-3 bg-red-950/50 border border-red-500/40 rounded-xl flex items-start gap-2.5 text-xs text-red-200">
              <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
              <span>
                <strong>Warning:</strong> This action will permanently remove all product catalog entries and inventory stock records across the database and storefront. This action cannot be undone.
              </span>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-neutral-800">
              <button
                type="button"
                disabled={isBulkDeleting}
                onClick={() => setIsClearAllModalOpen(false)}
                className="px-3 py-1.5 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-300 text-xs cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isBulkDeleting}
                onClick={handleConfirmClearAll}
                className="px-4 py-2 rounded-lg bg-red-600 hover:bg-red-500 text-white text-xs font-semibold flex items-center gap-1.5 shadow-md shadow-red-600/30 cursor-pointer disabled:opacity-50"
              >
                {isBulkDeleting ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Clearing All Products...</span>
                  </>
                ) : (
                  <>
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Confirm & Delete All Products Now</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
