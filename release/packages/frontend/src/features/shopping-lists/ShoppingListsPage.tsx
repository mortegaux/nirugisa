import { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { shoppingListApi } from '@/services/api';
import { CelebrationIcon } from '@/components/icons/MaterialIcon';
import type { ShoppingList, ShoppingListItem } from '@nommable/shared';

const AISLE_CATEGORIES = [
  { name: 'Produce', color: 'bg-green-50 border-green-200 text-green-900' },
  { name: 'Dairy', color: 'bg-blue-50 border-blue-200 text-blue-900' },
  { name: 'Meat', color: 'bg-red-50 border-red-200 text-red-900' },
  { name: 'Seafood', color: 'bg-cyan-50 border-cyan-200 text-cyan-900' },
  { name: 'Bakery', color: 'bg-amber-50 border-amber-200 text-amber-900' },
  { name: 'Pantry', color: 'bg-orange-50 border-orange-200 text-orange-900' },
  { name: 'Frozen', color: 'bg-indigo-50 border-indigo-200 text-indigo-900' },
  { name: 'Beverages', color: 'bg-purple-50 border-purple-200 text-purple-900' },
  { name: 'Snacks', color: 'bg-yellow-50 border-yellow-200 text-yellow-900' },
  { name: 'Other', color: 'bg-gray-50 border-gray-200 text-gray-900' },
];

export default function ShoppingListsPageEnhanced() {
  const location = useLocation();
  const [shoppingLists, setShoppingLists] = useState<ShoppingList[]>([]);
  const [selectedList, setSelectedList] = useState<ShoppingList | null>(null);
  const [loading, setLoading] = useState(true);
  const [showNewItemForm, setShowNewItemForm] = useState(false);
  const [newItemName, setNewItemName] = useState('');
  const [newItemQuantity, setNewItemQuantity] = useState('');
  const [newItemUnit, setNewItemUnit] = useState('');
  const [newItemCategory, setNewItemCategory] = useState('Other');
  const [showCreateListModal, setShowCreateListModal] = useState(false);
  const [newListName, setNewListName] = useState('');
  const [editingListName, setEditingListName] = useState(false);
  const [editedListName, setEditedListName] = useState('');

  useEffect(() => {
    loadShoppingLists();
  }, []);

  useEffect(() => {
    if (shoppingLists.length > 0 && !selectedList) {
      // Check if we have a specific list ID to select from navigation state
      const selectedListId = (location.state as any)?.selectedListId;
      if (selectedListId) {
        const listToSelect = shoppingLists.find(list => list.id === selectedListId);
        setSelectedList(listToSelect || shoppingLists[0]);
      } else {
        setSelectedList(shoppingLists[0]);
      }
    }
  }, [shoppingLists, selectedList, location.state]);

  const loadShoppingLists = async () => {
    try {
      const response = await shoppingListApi.getAll();
      setShoppingLists(response.data);
    } catch (error) {
      console.error('Failed to load shopping lists:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleToggleItem = async (listId: string, itemId: string) => {
    try {
      await shoppingListApi.toggleItem(listId, itemId);

      // Optimistically update UI
      setShoppingLists(lists =>
        lists.map(list =>
          list.id === listId
            ? {
                ...list,
                items: list.items.map(item =>
                  item.id === itemId ? { ...item, checked: !item.checked } : item
                ),
              }
            : list
        )
      );

      if (selectedList?.id === listId) {
        setSelectedList(prev => prev ? {
          ...prev,
          items: prev.items.map(item =>
            item.id === itemId ? { ...item, checked: !item.checked } : item
          ),
        } : null);
      }
    } catch (error) {
      console.error('Failed to toggle item:', error);
      // Reload on error
      loadShoppingLists();
    }
  };

  const handleAddItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedList || !newItemName.trim()) return;

    try {
      const items = [
        ...selectedList.items,
        {
          name: newItemName,
          quantity: newItemQuantity ? parseFloat(newItemQuantity) : undefined,
          unit: newItemUnit || undefined,
          category: newItemCategory,
          checked: false,
          order: selectedList.items.length,
        },
      ];

      await shoppingListApi.update(selectedList.id, { items });
      await loadShoppingLists();

      // Reset form
      setNewItemName('');
      setNewItemQuantity('');
      setNewItemUnit('');
      setNewItemCategory('Other');
      setShowNewItemForm(false);
    } catch (error) {
      console.error('Failed to add item:', error);
    }
  };

  const handleCreateList = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newListName.trim()) return;

    try {
      const response = await shoppingListApi.create({
        name: newListName,
        items: [],
      });
      await loadShoppingLists();
      setSelectedList(response.data);
      setNewListName('');
      setShowCreateListModal(false);
    } catch (error) {
      console.error('Failed to create shopping list:', error);
    }
  };

  const handleDeleteList = async (listId: string) => {
    if (!confirm('Are you sure you want to delete this shopping list?')) return;

    try {
      await shoppingListApi.delete(listId);
      if (selectedList?.id === listId) {
        setSelectedList(null);
      }
      await loadShoppingLists();
    } catch (error) {
      console.error('Failed to delete shopping list:', error);
    }
  };

  const handleRenameList = async () => {
    if (!selectedList || !editedListName.trim()) return;

    try {
      await shoppingListApi.update(selectedList.id, { name: editedListName });
      await loadShoppingLists();
      setEditingListName(false);
      setEditedListName('');
    } catch (error) {
      console.error('Failed to rename shopping list:', error);
    }
  };

  const handleDeleteItem = async (itemId: string) => {
    if (!selectedList) return;

    try {
      const items = selectedList.items.filter(item => item.id !== itemId);
      await shoppingListApi.update(selectedList.id, { items });
      await loadShoppingLists();
    } catch (error) {
      console.error('Failed to delete item:', error);
    }
  };

  const groupItemsByCategory = (items: ShoppingListItem[]) => {
    const grouped: { [key: string]: ShoppingListItem[] } = {};

    items.forEach(item => {
      const category = item.category || 'Other';
      if (!grouped[category]) {
        grouped[category] = [];
      }
      grouped[category].push(item);
    });

    return grouped;
  };

  const getProgress = (items: ShoppingListItem[]) => {
    if (items.length === 0) return 0;
    const checked = items.filter(item => item.checked).length;
    return Math.round((checked / items.length) * 100);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-muted-foreground">Loading shopping lists...</div>
      </div>
    );
  }

  if (shoppingLists.length === 0) {
    return (
      <>
        <div>
          <div className="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <h1 className="text-3xl font-bold text-foreground">Shopping Lists</h1>
            <button
              onClick={() => setShowCreateListModal(true)}
              className="rounded-lg bg-primary px-4 py-2 font-medium text-primary-foreground shadow-sm transition-all hover:bg-primary/90 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2"
              aria-label="Create new shopping list"
            >
              + Create List
            </button>
          </div>
          <div className="rounded-lg border-2 border-dashed border-border bg-card p-12 text-center">
            <p className="text-muted-foreground">No shopping lists yet. Create your first list!</p>
          </div>
        </div>

        {/* Create List Modal */}
        {showCreateListModal && (
          <div
            className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
            onClick={() => setShowCreateListModal(false)}
          >
            <div
              className="bg-card rounded-xl max-w-md w-full p-6 shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <h2 className="text-2xl font-bold text-foreground mb-4">Create Shopping List</h2>
              <form onSubmit={handleCreateList} className="space-y-4">
                <div>
                  <label htmlFor="listName" className="block text-sm font-medium text-foreground mb-2">
                    List Name
                  </label>
                  <input
                    id="listName"
                    type="text"
                    value={newListName}
                    onChange={(e) => setNewListName(e.target.value)}
                    placeholder="e.g., Weekly Groceries"
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                    autoFocus
                    required
                  />
                </div>
                <div className="flex gap-2 justify-end">
                  <button
                    type="button"
                    onClick={() => {
                      setShowCreateListModal(false);
                      setNewListName('');
                    }}
                    className="px-4 py-2 rounded-md border border-border bg-background text-foreground hover:bg-accent transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={!newListName.trim()}
                    className="px-4 py-2 rounded-md bg-primary text-primary-foreground font-medium hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    Create List
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </>
    );
  }

  const groupedItems = selectedList ? groupItemsByCategory(selectedList.items) : {};
  const progress = selectedList ? getProgress(selectedList.items) : 0;

  return (
    <div className="max-w-6xl mx-auto">
      {/* Header */}
      <div className="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <h1 className="text-3xl font-bold text-foreground">Shopping Lists</h1>
        <button
          onClick={() => setShowCreateListModal(true)}
          className="rounded-lg bg-primary px-4 py-2 font-medium text-primary-foreground shadow-sm transition-all hover:bg-primary/90 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2"
          aria-label="Create new shopping list"
        >
          + Create List
        </button>
      </div>

      <div className="grid gap-6 md:grid-cols-[250px_1fr]">
        {/* Shopping List Selector */}
        <div className="space-y-2">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">
            Your Lists
          </h2>
          {shoppingLists.map(list => {
            const listProgress = getProgress(list.items);
            return (
              <div
                key={list.id}
                className={`relative group w-full text-left p-4 rounded-lg border transition-all ${
                  selectedList?.id === list.id
                    ? 'border-primary bg-primary/5 shadow-sm'
                    : 'border-border bg-card hover:border-primary/30 hover:bg-accent/5'
                }`}
              >
                <button
                  onClick={() => setSelectedList(list)}
                  className="w-full text-left"
                  aria-label={`Select ${list.name}`}
                  aria-current={selectedList?.id === list.id}
                >
                  <div className="font-medium text-foreground mb-1 pr-6">{list.name}</div>
                  <div className="text-xs text-muted-foreground mb-2">
                    {list.items.length} items
                  </div>
                  <div className="w-full bg-background rounded-full h-1.5">
                    <div
                      className="bg-secondary h-1.5 rounded-full transition-all"
                      style={{ width: `${listProgress}%` }}
                      role="progressbar"
                      aria-valuenow={listProgress}
                      aria-valuemin={0}
                      aria-valuemax={100}
                      aria-label={`${listProgress}% complete`}
                    />
                  </div>
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDeleteList(list.id);
                  }}
                  className="absolute top-2 right-2 p-1 opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive transition-all"
                  title="Delete list"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            );
          })}
        </div>

        {/* Selected List Detail */}
        {selectedList && (
          <div className="bg-card rounded-lg border border-border shadow-sm">
            {/* List Header with Progress */}
            <div className="p-6 border-b border-border">
              <div className="flex items-center justify-between mb-4">
                {editingListName ? (
                  <div className="flex items-center gap-2 flex-1">
                    <input
                      type="text"
                      value={editedListName}
                      onChange={(e) => setEditedListName(e.target.value)}
                      className="flex-1 text-2xl font-bold px-2 py-1 border border-primary rounded focus:outline-none focus:ring-2 focus:ring-primary"
                      autoFocus
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleRenameList();
                        if (e.key === 'Escape') {
                          setEditingListName(false);
                          setEditedListName('');
                        }
                      }}
                    />
                    <button
                      onClick={handleRenameList}
                      className="px-3 py-1 bg-primary text-primary-foreground rounded hover:bg-primary/90"
                    >
                      Save
                    </button>
                    <button
                      onClick={() => {
                        setEditingListName(false);
                        setEditedListName('');
                      }}
                      className="px-3 py-1 bg-background border border-border rounded hover:bg-accent"
                    >
                      Cancel
                    </button>
                  </div>
                ) : (
                  <>
                    <h2 className="text-2xl font-bold text-foreground">{selectedList.name}</h2>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-muted-foreground mr-2">
                        {selectedList.items.filter(i => i.checked).length} / {selectedList.items.length}
                      </span>
                      <button
                        onClick={() => {
                          setEditingListName(true);
                          setEditedListName(selectedList.name);
                        }}
                        className="p-2 text-muted-foreground hover:text-foreground transition-colors"
                        title="Rename list"
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                        </svg>
                      </button>
                      <button
                        onClick={() => handleDeleteList(selectedList.id)}
                        className="p-2 text-muted-foreground hover:text-destructive transition-colors"
                        title="Delete list"
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </div>
                  </>
                )}
              </div>

              {/* Progress Bar */}
              <div className="w-full bg-background rounded-full h-2.5 mb-2">
                <div
                  className="bg-secondary h-2.5 rounded-full transition-all"
                  style={{ width: `${progress}%` }}
                  role="progressbar"
                  aria-valuenow={progress}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-label={`Shopping list ${progress}% complete`}
                />
              </div>
              <p className="text-sm text-muted-foreground flex items-center gap-1">
                {progress === 100 ? (
                  <>
                    <CelebrationIcon size={16} />
                    All done!
                  </>
                ) : (
                  `${progress}% complete`
                )}
              </p>
            </div>

            {/* Items by Category */}
            <div className="p-6 space-y-6">
              {Object.keys(groupedItems).length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  No items in this list. Add your first item below!
                </div>
              ) : (
                Object.entries(groupedItems).map(([category, items]) => {
                  const categoryConfig = AISLE_CATEGORIES.find(c => c.name === category) || AISLE_CATEGORIES[9];

                  return (
                    <div key={category} className="space-y-2">
                      {/* Category Header */}
                      <div className="flex items-center gap-2 mb-3">
                        <h3 className="text-lg font-semibold text-foreground">{category}</h3>
                        <span className="text-xs text-muted-foreground">
                          ({items.length})
                        </span>
                      </div>

                      {/* Category Items */}
                      <div className="space-y-2 pl-2">
                        {items.map(item => (
                          <div
                            key={item.id}
                            className={`flex items-center gap-3 p-3 rounded-lg border-2 transition-all group ${
                              item.checked
                                ? 'border-border bg-background opacity-60'
                                : `${categoryConfig.color} hover:shadow-sm`
                            }`}
                          >
                            <input
                              type="checkbox"
                              checked={item.checked}
                              onChange={() => handleToggleItem(selectedList.id, item.id)}
                              className="w-6 h-6 rounded border-2 border-current cursor-pointer focus:ring-2 focus:ring-primary focus:ring-offset-2"
                              aria-label={`Mark ${item.name} as ${item.checked ? 'unchecked' : 'checked'}`}
                            />
                            <span
                              className={`flex-1 text-base cursor-pointer ${
                                item.checked ? 'line-through text-muted-foreground' : 'text-foreground font-medium'
                              }`}
                              onClick={() => handleToggleItem(selectedList.id, item.id)}
                            >
                              {item.quantity && `${item.quantity} `}
                              {item.unit && `${item.unit} `}
                              {item.name}
                            </span>
                            {item.notes && (
                              <span className="text-xs text-muted-foreground italic">
                                {item.notes}
                              </span>
                            )}
                            <button
                              onClick={() => handleDeleteItem(item.id)}
                              className="opacity-0 group-hover:opacity-100 p-1 text-muted-foreground hover:text-destructive transition-all"
                              title="Delete item"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                              </svg>
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })
              )}

              {/* Add Item Form */}
              {!showNewItemForm ? (
                <button
                  onClick={() => setShowNewItemForm(true)}
                  className="w-full py-3 rounded-lg border-2 border-dashed border-border bg-background hover:border-primary/50 hover:bg-accent/5 text-muted-foreground hover:text-foreground transition-all focus:outline-none focus:ring-2 focus:ring-primary"
                  aria-label="Add new item"
                >
                  + Add Item
                </button>
              ) : (
                <form onSubmit={handleAddItem} className="p-4 rounded-lg border border-border bg-accent/5 space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="col-span-2">
                      <label htmlFor="itemName" className="block text-sm font-medium text-foreground mb-1">
                        Item Name *
                      </label>
                      <input
                        id="itemName"
                        type="text"
                        value={newItemName}
                        onChange={(e) => setNewItemName(e.target.value)}
                        placeholder="e.g., Milk"
                        className="w-full rounded-md border border-input bg-background px-3 py-2 text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                        autoFocus
                        required
                      />
                    </div>
                    <div>
                      <label htmlFor="itemQuantity" className="block text-sm font-medium text-foreground mb-1">
                        Quantity
                      </label>
                      <input
                        id="itemQuantity"
                        type="number"
                        step="0.01"
                        value={newItemQuantity}
                        onChange={(e) => setNewItemQuantity(e.target.value)}
                        placeholder="2"
                        className="w-full rounded-md border border-input bg-background px-3 py-2 text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                      />
                    </div>
                    <div>
                      <label htmlFor="itemUnit" className="block text-sm font-medium text-foreground mb-1">
                        Unit
                      </label>
                      <input
                        id="itemUnit"
                        type="text"
                        value={newItemUnit}
                        onChange={(e) => setNewItemUnit(e.target.value)}
                        placeholder="lbs"
                        className="w-full rounded-md border border-input bg-background px-3 py-2 text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                      />
                    </div>
                    <div className="col-span-2">
                      <label htmlFor="itemCategory" className="block text-sm font-medium text-foreground mb-1">
                        Category
                      </label>
                      <select
                        id="itemCategory"
                        value={newItemCategory}
                        onChange={(e) => setNewItemCategory(e.target.value)}
                        className="w-full rounded-md border border-input bg-background px-3 py-2 text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                      >
                        {AISLE_CATEGORIES.map(cat => (
                          <option key={cat.name} value={cat.name}>
                            {cat.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <div className="flex gap-2 justify-end">
                    <button
                      type="button"
                      onClick={() => {
                        setShowNewItemForm(false);
                        setNewItemName('');
                        setNewItemQuantity('');
                        setNewItemUnit('');
                        setNewItemCategory('Other');
                      }}
                      className="px-4 py-2 rounded-md border border-border bg-background text-foreground hover:bg-accent transition-colors focus:outline-none focus:ring-2 focus:ring-primary"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={!newItemName.trim()}
                      className="px-4 py-2 rounded-md bg-primary text-primary-foreground font-medium hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2"
                    >
                      Add Item
                    </button>
                  </div>
                </form>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Create List Modal */}
      {showCreateListModal && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
          onClick={() => setShowCreateListModal(false)}
        >
          <div
            className="bg-card rounded-xl max-w-md w-full p-6 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-2xl font-bold text-foreground mb-4">Create Shopping List</h2>
            <form onSubmit={handleCreateList} className="space-y-4">
              <div>
                <label htmlFor="listName" className="block text-sm font-medium text-foreground mb-2">
                  List Name
                </label>
                <input
                  id="listName"
                  type="text"
                  value={newListName}
                  onChange={(e) => setNewListName(e.target.value)}
                  placeholder="e.g., Weekly Groceries"
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                  autoFocus
                  required
                />
              </div>
              <div className="flex gap-2 justify-end">
                <button
                  type="button"
                  onClick={() => {
                    setShowCreateListModal(false);
                    setNewListName('');
                  }}
                  className="px-4 py-2 rounded-md border border-border bg-background text-foreground hover:bg-accent transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!newListName.trim()}
                  className="px-4 py-2 rounded-md bg-primary text-primary-foreground font-medium hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  Create List
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
