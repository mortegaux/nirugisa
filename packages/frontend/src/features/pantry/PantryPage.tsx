import { useState, useEffect } from 'react';
import { pantryApi } from '@/services/api';
import { BarChartIcon, AutoAwesomeIcon } from '@/components/icons/MaterialIcon';
import { PantryScanModal } from './PantryScanModal';
import { useAIStatus, aiNotConfiguredClass, AISetupBadge } from '@/hooks/useAIStatus';
import type { PantryItem } from '@nommable/shared';
import { useConfirmStore } from '@/store/confirm.store';
import { useToastStore } from '@/store/toast.store';

const CATEGORIES = [
  { name: 'Spices & Seasonings' },
  { name: 'Grains & Pasta' },
  { name: 'Canned Goods' },
  { name: 'Baking' },
  { name: 'Oils & Vinegars' },
  { name: 'Condiments' },
  { name: 'Snacks' },
  { name: 'Beverages' },
  { name: 'Dairy' },
  { name: 'Meat & Seafood' },
  { name: 'Produce' },
  { name: 'Frozen' },
  { name: 'Other' },
];

const LOCATIONS = ['Pantry', 'Refrigerator', 'Freezer', 'Spice Rack', 'Cabinet', 'Other'];

export default function PantryPage() {
  const [items, setItems] = useState<PantryItem[]>([]);
  const confirm = useConfirmStore((s) => s.confirm);
  const toast = useToastStore();
  const [expiringItems, setExpiringItems] = useState<PantryItem[]>([]);
  const [lowStockItems, setLowStockItems] = useState<PantryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [showScanModal, setShowScanModal] = useState(false);
  const { isReady: aiReady, isLoading: aiLoading } = useAIStatus();
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  // Form state
  const [formData, setFormData] = useState({
    name: '',
    quantity: '',
    unit: '',
    category: 'Other',
    location: 'Pantry',
    expirationDate: '',
    notes: '',
    isLowStock: false,
  });

  useEffect(() => {
    loadPantryData();
  }, []);

  const loadPantryData = async () => {
    try {
      const [allItems, expiring, lowStock] = await Promise.all([
        pantryApi.getAll(),
        pantryApi.getExpiring(7),
        pantryApi.getLowStock(),
      ]);
      setItems(allItems.data);
      setExpiringItems(expiring.data);
      setLowStockItems(lowStock.data);
    } catch (error) {
      console.error('Failed to load pantry data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      await pantryApi.create({
        ...formData,
        quantity: parseFloat(formData.quantity),
        expirationDate: formData.expirationDate || undefined,
      });

      // Reset form
      setFormData({
        name: '',
        quantity: '',
        unit: '',
        category: 'Other',
        location: 'Pantry',
        expirationDate: '',
        notes: '',
        isLowStock: false,
      });
      setShowAddForm(false);
      loadPantryData();
    } catch (error) {
      console.error('Failed to add item:', error);
    }
  };

  const handleDelete = async (id: string) => {
    const item = items.find((i) => i.id === id);
    const ok = await confirm({
      title: 'Delete pantry item?',
      message: `Permanently delete "${item?.name ?? 'this item'}" from your pantry? This cannot be undone.`,
      confirmLabel: 'Delete',
    });
    if (!ok) return;

    try {
      await pantryApi.delete(id);
      loadPantryData();
      toast.success('Pantry item deleted.');
    } catch (error) {
      console.error('Failed to delete item:', error);
      toast.error('Failed to delete item. Please try again.');
    }
  };

  const handleToggleLowStock = async (id: string) => {
    try {
      await pantryApi.toggleLowStock(id);
      loadPantryData();
    } catch (error) {
      console.error('Failed to toggle low stock:', error);
    }
  };

  const handleQuantityChange = async (id: string, change: number) => {
    try {
      await pantryApi.updateQuantity(id, change);
      loadPantryData();
    } catch (error) {
      console.error('Failed to update quantity:', error);
    }
  };

  const groupItemsByCategory = () => {
    const filtered = items.filter(item => {
      const matchesSearch = !searchQuery ||
        item.name.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesCategory = !selectedCategory || item.category === selectedCategory;
      return matchesSearch && matchesCategory;
    });

    const grouped: { [key: string]: PantryItem[] } = {};
    filtered.forEach(item => {
      if (!grouped[item.category]) {
        grouped[item.category] = [];
      }
      grouped[item.category].push(item);
    });

    return grouped;
  };

  const getDaysUntilExpiration = (date: Date | undefined) => {
    if (!date) return null;
    const today = new Date();
    const expDate = new Date(date);
    const diffTime = expDate.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-muted-foreground">Loading pantry...</div>
      </div>
    );
  }

  const groupedItems = groupItemsByCategory();

  return (
    <div className="max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Pantry Management</h1>
          <p className="text-muted-foreground mt-1">{items.length}{' '}items in your pantry</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setShowScanModal(true)}
            className={`rounded-lg border border-border bg-background px-4 py-2 font-medium text-foreground hover:bg-accent shadow-sm transition-all focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 inline-flex items-center gap-2 ${!aiReady && !aiLoading ? aiNotConfiguredClass : ''}`}
            aria-label="Scan pantry with AI"
            title={!aiReady && !aiLoading ? 'Set up AI to unlock this feature' : undefined}
          >
            <AutoAwesomeIcon size={18} />
            Scan with AI
            {!aiReady && !aiLoading && <AISetupBadge />}
          </button>
          <button
            onClick={() => setShowAddForm(!showAddForm)}
            className="rounded-lg bg-primary px-4 py-2 font-medium text-primary-foreground shadow-sm transition-all hover:bg-primary/90 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2"
          >
            {showAddForm ? 'Cancel' : 'Add Item'}
          </button>
        </div>
      </div>

      {showScanModal && (
        <PantryScanModal
          onClose={() => setShowScanModal(false)}
          existingItems={items}
          onAdded={loadPantryData}
        />
      )}

      {/* Alert Cards */}
      {(expiringItems.length > 0 || lowStockItems.length > 0) && (
        <div className="grid gap-4 md:grid-cols-2 mb-6">
          {/* Expiring Items Alert */}
          {expiringItems.length > 0 && (
            <div className="bg-amber-50 dark:bg-amber-900/20 border-2 border-amber-200 dark:border-amber-800 rounded-lg p-4">
              <div className="flex items-start gap-3">
                <span className="text-2xl">⏰</span>
                <div className="flex-1">
                  <h3 className="font-semibold text-amber-900 mb-1">
                    {expiringItems.length} items expiring soon
                  </h3>
                  <ul className="text-sm text-amber-800 dark:text-amber-200 space-y-1">
                    {expiringItems.slice(0, 3).map(item => {
                      const days = getDaysUntilExpiration(item.expirationDate);
                      return (
                        <li key={item.id}>
                          {item.name} - {days === 0 ? 'Today' : days === 1 ? 'Tomorrow' : `${days} days`}
                        </li>
                      );
                    })}
                    {expiringItems.length > 3 && (
                      <li className="font-medium">...and {expiringItems.length - 3} more</li>
                    )}
                  </ul>
                </div>
              </div>
            </div>
          )}

          {/* Low Stock Alert */}
          {lowStockItems.length > 0 && (
            <div className="bg-red-50 dark:bg-red-900/20 border-2 border-red-200 dark:border-red-800 rounded-lg p-4">
              <div className="flex items-start gap-3">
                <BarChartIcon size={24} className="text-red-600 dark:text-red-400" />
                <div className="flex-1">
                  <h3 className="font-semibold text-red-900 mb-1">
                    {lowStockItems.length} items running low
                  </h3>
                  <ul className="text-sm text-red-800 dark:text-red-200 space-y-1">
                    {lowStockItems.slice(0, 3).map(item => (
                      <li key={item.id}>
                        {item.name} - {item.quantity} {item.unit}
                      </li>
                    ))}
                    {lowStockItems.length > 3 && (
                      <li className="font-medium">...and {lowStockItems.length - 3} more</li>
                    )}
                  </ul>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Add Item Form */}
      {showAddForm && (
        <div className="bg-card rounded-lg border border-border p-6 shadow-sm mb-6">
          <h2 className="text-lg font-semibold text-foreground mb-4">Add New Item</h2>
          <form onSubmit={handleSubmit} className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">
                Item Name *
              </label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">
                Quantity *
              </label>
              <input
                type="number"
                step="0.01"
                value={formData.quantity}
                onChange={(e) => setFormData({ ...formData, quantity: e.target.value })}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">
                Unit *
              </label>
              <input
                type="text"
                value={formData.unit}
                onChange={(e) => setFormData({ ...formData, unit: e.target.value })}
                placeholder="e.g., kg, lbs, pcs"
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">
                Category
              </label>
              <select
                value={formData.category}
                onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
              >
                {CATEGORIES.map(cat => (
                  <option key={cat.name} value={cat.name}>
                    {cat.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">
                Location
              </label>
              <select
                value={formData.location}
                onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
              >
                {LOCATIONS.map(loc => (
                  <option key={loc} value={loc}>{loc}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">
                Expiration Date
              </label>
              <input
                type="date"
                value={formData.expirationDate}
                onChange={(e) => setFormData({ ...formData, expirationDate: e.target.value })}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
            <div className="md:col-span-2 lg:col-span-3">
              <label className="block text-sm font-medium text-foreground mb-1">
                Notes
              </label>
              <input
                type="text"
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                placeholder="Optional notes"
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
            <div className="md:col-span-2 lg:col-span-3 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowAddForm(false)}
                className="px-4 py-2 rounded-lg border border-border bg-background text-foreground hover:bg-accent transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-2 rounded-lg bg-primary text-primary-foreground font-medium hover:bg-primary/90 transition-colors"
              >
                Add Item
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Search and Filter */}
      <div className="mb-6 bg-card rounded-lg border border-border p-4 shadow-sm">
        <div className="mb-4">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search pantry items..."
            className="w-full rounded-md border border-input bg-background px-4 py-2 text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
          />
        </div>
        <div>
          <h3 className="text-sm font-medium text-foreground mb-2">Filter by Category</h3>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setSelectedCategory(null)}
              className={`px-3 py-1.5 rounded-full text-sm font-medium transition-all ${
                selectedCategory === null
                  ? 'bg-primary text-primary-foreground shadow-sm'
                  : 'bg-background border border-border text-muted-foreground hover:border-primary/50'
              }`}
            >
              All
            </button>
            {CATEGORIES.map(cat => (
              <button
                key={cat.name}
                onClick={() => setSelectedCategory(cat.name)}
                className={`px-3 py-1.5 rounded-full text-sm font-medium transition-all ${
                  selectedCategory === cat.name
                    ? 'bg-primary text-primary-foreground shadow-sm'
                    : 'bg-background border border-border text-muted-foreground hover:border-primary/50'
                }`}
              >
                {cat.name}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Pantry Items by Category */}
      {Object.keys(groupedItems).length === 0 ? (
        <div className="rounded-lg border-2 border-dashed border-border bg-card p-12 text-center">
          <p className="text-muted-foreground">
            {searchQuery || selectedCategory
              ? 'No items match your filters.'
              : 'Your pantry is empty. Add your first item!'}
          </p>
          {!searchQuery && !selectedCategory && (
            <button
              type="button"
              onClick={() => setShowAddForm(true)}
              className="mt-4 rounded-lg bg-primary px-4 py-2 font-medium text-primary-foreground shadow-sm transition-all hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2"
            >
              Add Item
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-6">
          {Object.entries(groupedItems).map(([category, categoryItems]) => (
              <div key={category} className="bg-card rounded-lg border border-border p-4 shadow-sm">
                <h2 className="text-lg font-semibold text-foreground mb-3 flex items-center gap-2">
                  {category}
                  <span className="text-sm text-muted-foreground font-normal">
                    ({categoryItems.length})
                  </span>
                </h2>

                <ul className="divide-y divide-border rounded-lg border border-border overflow-hidden">
                  {categoryItems.map(item => {
                    const daysUntilExp = getDaysUntilExpiration(item.expirationDate);
                    const isExpiringSoon = daysUntilExp !== null && daysUntilExp <= 7;
                    const isExpired = daysUntilExp !== null && daysUntilExp < 0;
                    const expiryLabel = item.expirationDate
                      ? isExpired
                        ? 'Expired'
                        : daysUntilExp === 0
                        ? 'Expires today'
                        : daysUntilExp === 1
                        ? 'Expires tomorrow'
                        : `Expires in ${daysUntilExp} days`
                      : null;

                    return (
                      <li
                        key={item.id}
                        className={`flex items-center gap-1.5 sm:gap-2 px-2 sm:px-3 py-1.5 transition-colors ${
                          isExpired
                            ? 'bg-destructive/5'
                            : isExpiringSoon
                            ? 'bg-amber-50 dark:bg-amber-900/20'
                            : item.isLowStock
                            ? 'bg-red-50 dark:bg-red-900/20'
                            : 'bg-background'
                        }`}
                      >
                        {/* Low stock toggle */}
                        <button
                          onClick={() => handleToggleLowStock(item.id)}
                          aria-label={item.isLowStock ? `Remove low stock flag from ${item.name}` : `Mark ${item.name} as low stock`}
                          aria-pressed={item.isLowStock}
                          title={item.isLowStock ? 'Low stock — tap to clear' : 'Mark as low stock'}
                          className={`w-10 h-10 flex-shrink-0 inline-flex items-center justify-center rounded-md border transition-colors ${
                            item.isLowStock
                              ? 'bg-red-600 border-red-600 text-white hover:bg-red-700'
                              : 'border-border text-muted-foreground hover:bg-accent hover:text-foreground'
                          }`}
                        >
                          <BarChartIcon size={18} />
                        </button>

                        {/* Name + quantity + meta */}
                        <div className="flex-1 min-w-0" title={item.notes || undefined}>
                          <div className="flex items-baseline gap-2 min-w-0">
                            <span className="font-medium text-foreground truncate">{item.name}</span>
                            <span className="flex-shrink-0 text-sm text-muted-foreground whitespace-nowrap">
                              {item.quantity} {item.unit}
                            </span>
                          </div>
                          <div className="flex items-center gap-1.5 text-xs text-muted-foreground min-w-0">
                            <span className="truncate">{item.location || 'Pantry'}</span>
                            {expiryLabel && (
                              <>
                                <span aria-hidden="true">·</span>
                                <span className={`whitespace-nowrap ${isExpired ? 'text-destructive font-medium' : isExpiringSoon ? 'text-amber-700 dark:text-amber-300 font-medium' : ''}`}>
                                  {expiryLabel}
                                </span>
                              </>
                            )}
                            {item.isLowStock && (
                              <>
                                <span aria-hidden="true">·</span>
                                <span className="whitespace-nowrap text-red-600 dark:text-red-400 font-medium">Low stock</span>
                              </>
                            )}
                            {item.notes && (
                              <>
                                <span aria-hidden="true">·</span>
                                <span className="italic truncate min-w-0">{item.notes}</span>
                              </>
                            )}
                          </div>
                        </div>

                        {/* Quantity stepper */}
                        <div className="flex items-center gap-1 flex-shrink-0">
                          <button
                            onClick={() => handleQuantityChange(item.id, -0.5)}
                            className="w-10 h-10 rounded-md border border-border bg-card hover:bg-accent transition-colors inline-flex items-center justify-center text-lg font-medium"
                            aria-label={`Decrease quantity of ${item.name}`}
                          >
                            −
                          </button>
                          <button
                            onClick={() => handleQuantityChange(item.id, 0.5)}
                            className="w-10 h-10 rounded-md border border-border bg-card hover:bg-accent transition-colors inline-flex items-center justify-center text-lg font-medium"
                            aria-label={`Increase quantity of ${item.name}`}
                          >
                            +
                          </button>
                        </div>

                        {/* Delete */}
                        <button
                          onClick={() => handleDelete(item.id)}
                          className="w-10 h-10 flex-shrink-0 inline-flex items-center justify-center rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                          aria-label={`Delete ${item.name}`}
                        >
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </div>
          ))}
        </div>
      )}
    </div>
  );
}
