import { useState, useEffect } from 'react';
import { pantryApi } from '@/services/api';
import { BarChartIcon } from '@/components/icons/MaterialIcon';
import type { PantryItem } from '@nommable/shared';

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
  const [expiringItems, setExpiringItems] = useState<PantryItem[]>([]);
  const [lowStockItems, setLowStockItems] = useState<PantryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
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
    if (!confirm('Are you sure you want to delete this item?')) return;

    try {
      await pantryApi.delete(id);
      loadPantryData();
    } catch (error) {
      console.error('Failed to delete item:', error);
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
          <p className="text-muted-foreground mt-1">{items.length} items in your pantry</p>
        </div>
        <button
          onClick={() => setShowAddForm(!showAddForm)}
          className="rounded-lg bg-primary px-4 py-2 font-medium text-primary-foreground shadow-sm transition-all hover:bg-primary/90 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2"
        >
          {showAddForm ? 'Cancel' : 'Add Item'}
        </button>
      </div>

      {/* Alert Cards */}
      {(expiringItems.length > 0 || lowStockItems.length > 0) && (
        <div className="grid gap-4 md:grid-cols-2 mb-6">
          {/* Expiring Items Alert */}
          {expiringItems.length > 0 && (
            <div className="bg-amber-50 border-2 border-amber-200 rounded-lg p-4">
              <div className="flex items-start gap-3">
                <span className="text-2xl">⏰</span>
                <div className="flex-1">
                  <h3 className="font-semibold text-amber-900 mb-1">
                    {expiringItems.length} items expiring soon
                  </h3>
                  <ul className="text-sm text-amber-800 space-y-1">
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
            <div className="bg-red-50 border-2 border-red-200 rounded-lg p-4">
              <div className="flex items-start gap-3">
                <BarChartIcon size={24} className="text-red-600" />
                <div className="flex-1">
                  <h3 className="font-semibold text-red-900 mb-1">
                    {lowStockItems.length} items running low
                  </h3>
                  <ul className="text-sm text-red-800 space-y-1">
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
        </div>
      ) : (
        <div className="space-y-6">
          {Object.entries(groupedItems).map(([category, categoryItems]) => (
              <div key={category} className="bg-card rounded-lg border border-border p-6 shadow-sm">
                <h2 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
                  {category}
                  <span className="text-sm text-muted-foreground font-normal">
                    ({categoryItems.length})
                  </span>
                </h2>

                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {categoryItems.map(item => {
                    const daysUntilExp = getDaysUntilExpiration(item.expirationDate);
                    const isExpiringSoon = daysUntilExp !== null && daysUntilExp <= 7;
                    const isExpired = daysUntilExp !== null && daysUntilExp < 0;

                    return (
                      <div
                        key={item.id}
                        className={`rounded-lg border-2 p-4 transition-all ${
                          isExpired
                            ? 'border-destructive bg-destructive/5'
                            : isExpiringSoon
                            ? 'border-amber-300 bg-amber-50'
                            : item.isLowStock
                            ? 'border-red-300 bg-red-50'
                            : 'border-border bg-background'
                        }`}
                      >
                        <div className="flex items-start justify-between mb-2">
                          <div className="flex-1">
                            <h3 className="font-semibold text-foreground">{item.name}</h3>
                            <p className="text-sm text-muted-foreground">
                              {item.location || 'Pantry'}
                            </p>
                          </div>
                          <button
                            onClick={() => handleDelete(item.id)}
                            className="text-muted-foreground hover:text-destructive transition-colors p-1"
                            aria-label="Delete item"
                          >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          </button>
                        </div>

                        {/* Quantity Controls */}
                        <div className="flex items-center gap-2 mb-3">
                          <button
                            onClick={() => handleQuantityChange(item.id, -0.5)}
                            className="w-8 h-8 rounded-md border border-border bg-background hover:bg-accent transition-colors flex items-center justify-center"
                            aria-label="Decrease quantity"
                          >
                            −
                          </button>
                          <span className="flex-1 text-center font-medium">
                            {item.quantity} {item.unit}
                          </span>
                          <button
                            onClick={() => handleQuantityChange(item.id, 0.5)}
                            className="w-8 h-8 rounded-md border border-border bg-background hover:bg-accent transition-colors flex items-center justify-center"
                            aria-label="Increase quantity"
                          >
                            +
                          </button>
                        </div>

                        {/* Expiration Info */}
                        {item.expirationDate && (
                          <div className={`text-xs mb-2 flex items-center gap-1 ${
                            isExpired ? 'text-destructive font-medium' :
                            isExpiringSoon ? 'text-amber-700 font-medium' :
                            'text-muted-foreground'
                          }`}>
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                            </svg>
                            {isExpired ? 'Expired' :
                             daysUntilExp === 0 ? 'Expires today' :
                             daysUntilExp === 1 ? 'Expires tomorrow' :
                             `Expires in ${daysUntilExp} days`}
                          </div>
                        )}

                        {/* Low Stock Toggle */}
                        <button
                          onClick={() => handleToggleLowStock(item.id)}
                          className={`w-full py-1.5 rounded-md text-xs font-medium transition-colors ${
                            item.isLowStock
                              ? 'bg-red-600 text-white hover:bg-red-700'
                              : 'bg-background border border-border text-muted-foreground hover:bg-accent'
                          }`}
                        >
                          {item.isLowStock ? (
                            <>
                              <BarChartIcon size={14} className="inline" /> Low Stock
                            </>
                          ) : (
                            'Mark as Low Stock'
                          )}
                        </button>

                        {/* Notes */}
                        {item.notes && (
                          <p className="text-xs text-muted-foreground italic mt-2">
                            {item.notes}
                          </p>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
          ))}
        </div>
      )}
    </div>
  );
}
