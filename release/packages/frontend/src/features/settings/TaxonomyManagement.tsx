import { useState, useEffect } from 'react';
import { taxonomyApi } from '@/services/api';
import type { Taxonomy, TaxonomyType } from '@nommable/shared';

export default function TaxonomyManagement() {
  const [taxonomies, setTaxonomies] = useState<Taxonomy[]>([]);
  const [activeTab, setActiveTab] = useState<TaxonomyType>('category');
  const [newName, setNewName] = useState('');
  const [newColor, setNewColor] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    loadTaxonomies();
  }, []);

  const loadTaxonomies = async () => {
    try {
      const response = await taxonomyApi.getAll();
      setTaxonomies(response.data);
    } catch {
      setError('Failed to load taxonomies');
    } finally {
      setLoading(false);
    }
  };

  const filtered = taxonomies.filter((t) => t.type === activeTab);

  const handleAdd = async () => {
    if (!newName.trim()) return;
    setError('');
    try {
      await taxonomyApi.create({ name: newName.trim(), type: activeTab, color: newColor || undefined });
      setNewName('');
      setNewColor('');
      loadTaxonomies();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to create');
    }
  };

  const handleRename = async (id: string) => {
    if (!editingName.trim()) return;
    setError('');
    try {
      await taxonomyApi.update(id, { name: editingName.trim() });
      setEditingId(null);
      loadTaxonomies();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to rename');
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Delete "${name}"? This will remove it from all recipes.`)) return;
    setError('');
    try {
      await taxonomyApi.delete(id);
      loadTaxonomies();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to delete');
    }
  };

  const handleMoveUp = async (index: number) => {
    if (index === 0) return;
    const ids = filtered.map((t) => t.id);
    [ids[index - 1], ids[index]] = [ids[index], ids[index - 1]];
    try {
      await taxonomyApi.reorder(ids);
      loadTaxonomies();
    } catch {
      setError('Failed to reorder');
    }
  };

  const handleMoveDown = async (index: number) => {
    if (index === filtered.length - 1) return;
    const ids = filtered.map((t) => t.id);
    [ids[index], ids[index + 1]] = [ids[index + 1], ids[index]];
    try {
      await taxonomyApi.reorder(ids);
      loadTaxonomies();
    } catch {
      setError('Failed to reorder');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-muted-foreground">Loading...</div>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-foreground">Categories & Tags</h1>
        <p className="text-muted-foreground mt-1">
          Manage the categories and tags available for recipes.
        </p>
      </div>

      {error && (
        <div className="mb-4 rounded-lg bg-destructive/10 border border-destructive/20 p-3 text-destructive text-sm">
          {error}
        </div>
      )}

      {/* Tabs */}
      <div className="mb-6 border-b border-border">
        <div className="flex gap-2">
          {(['category', 'tag'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                activeTab === tab
                  ? 'border-primary text-primary'
                  : 'border-transparent text-muted-foreground hover:text-foreground hover:border-border'
              }`}
            >
              {tab === 'category' ? 'Categories' : 'Tags'}
              <span className="ml-2 text-xs text-muted-foreground">
                ({taxonomies.filter((t) => t.type === tab).length})
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Add New */}
      <div className="mb-6 bg-card rounded-lg border border-border p-4 shadow-sm">
        <h3 className="text-sm font-medium text-foreground mb-3">
          Add New {activeTab === 'category' ? 'Category' : 'Tag'}
        </h3>
        <div className="flex gap-3">
          <input
            type="text"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
            placeholder="Name"
            className="flex-1 rounded-md border border-input bg-background px-3 py-2 text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
          />
          <input
            type="text"
            value={newColor}
            onChange={(e) => setNewColor(e.target.value)}
            placeholder="Color (optional)"
            className="w-32 rounded-md border border-input bg-background px-3 py-2 text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
          />
          <button
            onClick={handleAdd}
            className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
          >
            Add
          </button>
        </div>
      </div>

      {/* List */}
      <div className="bg-card rounded-lg border border-border shadow-sm divide-y divide-border">
        {filtered.length === 0 ? (
          <div className="p-8 text-center text-muted-foreground">
            No {activeTab === 'category' ? 'categories' : 'tags'} yet.
          </div>
        ) : (
          filtered.map((item, index) => (
            <div key={item.id} className="flex items-center gap-3 px-4 py-3">
              {/* Reorder buttons */}
              <div className="flex flex-col gap-0.5">
                <button
                  onClick={() => handleMoveUp(index)}
                  disabled={index === 0}
                  className="text-muted-foreground hover:text-foreground disabled:opacity-30 text-xs"
                  aria-label="Move up"
                >
                  ▲
                </button>
                <button
                  onClick={() => handleMoveDown(index)}
                  disabled={index === filtered.length - 1}
                  className="text-muted-foreground hover:text-foreground disabled:opacity-30 text-xs"
                  aria-label="Move down"
                >
                  ▼
                </button>
              </div>

              {/* Name (inline edit) */}
              <div className="flex-1">
                {editingId === item.id ? (
                  <input
                    type="text"
                    value={editingName}
                    onChange={(e) => setEditingName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleRename(item.id);
                      if (e.key === 'Escape') setEditingId(null);
                    }}
                    onBlur={() => handleRename(item.id)}
                    autoFocus
                    className="w-full rounded-md border border-input bg-background px-2 py-1 text-foreground focus:outline-none focus:ring-2 focus:ring-primary text-sm"
                  />
                ) : (
                  <button
                    onClick={() => {
                      setEditingId(item.id);
                      setEditingName(item.name);
                    }}
                    className="text-sm text-foreground hover:text-primary transition-colors text-left"
                    title="Click to rename"
                  >
                    {item.name}
                  </button>
                )}
              </div>

              {/* Color indicator */}
              {item.color && (
                <span
                  className="w-4 h-4 rounded-full border border-border"
                  style={{ backgroundColor: item.color }}
                />
              )}

              {/* Delete */}
              <button
                onClick={() => handleDelete(item.id, item.name)}
                className="text-destructive hover:text-destructive/80 text-sm transition-colors"
                aria-label={`Delete ${item.name}`}
              >
                Delete
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
