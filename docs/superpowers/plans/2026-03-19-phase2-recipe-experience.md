# Phase 2: Recipe Experience Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace serving scaling +/- buttons with a dropdown, add image upload capability on the recipe detail page, and enhance print output with scaled quantities, source URL, and dark mode safety.

**Architecture:** Minimal changes — the serving multiplier state, formatQuantity utility, ImageUpload component, and print CSS all already exist. This phase wires them together and swaps the scaling UI control.

**Tech Stack:** React, Tailwind CSS, existing ImageUpload component, CSS @media print

**Spec:** `docs/superpowers/specs/2026-03-19-phased-improvements-design.md` (Phase 2 section)

---

## File Structure

### Modified files
- `packages/frontend/src/features/recipes/RecipeDetailPage.tsx` — Replace +/- scaling buttons with dropdown, add image upload overlay on hero image
- `packages/frontend/src/index.css` — Print enhancements (source URL footer, dark mode safety)

### No new files needed
The existing `ImageUpload` component, `formatQuantity` utility, and `recipeApi.uploadImage` method handle everything.

---

## Task 1: Replace Scaling Buttons with Dropdown

**Files:**
- Modify: `packages/frontend/src/features/recipes/RecipeDetailPage.tsx:515-536`

- [ ] **Step 1: Read RecipeDetailPage.tsx lines 510-545**

Read the current +/- button implementation to understand the exact code being replaced.

- [ ] **Step 2: Replace +/- buttons with a select dropdown**

Replace the serving controls section (approximately lines 515-536) with a `<select>` dropdown:

```tsx
<div className="flex items-center gap-2">
  <span className="text-sm text-muted-foreground">Servings:</span>
  <select
    value={servingMultiplier}
    onChange={(e) => setServingMultiplier(parseFloat(e.target.value))}
    className="px-2 py-1 rounded border bg-background text-sm"
  >
    <option value={0.5}>0.5x ({Math.round((recipe.servings || 1) * 0.5)})</option>
    <option value={1}>1x ({recipe.servings || 1})</option>
    <option value={1.5}>1.5x ({Math.round((recipe.servings || 1) * 1.5)})</option>
    <option value={2}>2x ({(recipe.servings || 1) * 2})</option>
    <option value={3}>3x ({(recipe.servings || 1) * 3})</option>
  </select>
</div>
```

Keep the existing `servingMultiplier` state (line 47) and all downstream usage (adjustedServings calculation, ingredient scaling, formatQuantity calls) unchanged — they already work correctly.

- [ ] **Step 3: Verify print view reflects selected multiplier**

The print view already uses `adjustedServings` and `servingMultiplier` for ingredient quantities. Confirm this by checking that the print-visible sections reference these variables, not `recipe.servings` directly.

- [ ] **Step 4: Commit**

```bash
git add packages/frontend/src/features/recipes/RecipeDetailPage.tsx
git commit -m "feat: replace serving +/- buttons with dropdown multiplier select"
```

---

## Task 2: Add Image Upload on Recipe Detail Page

**Files:**
- Modify: `packages/frontend/src/features/recipes/RecipeDetailPage.tsx:399-425`

The `ImageUpload` component and `recipeApi.uploadImage` already exist. The recipe form already supports image upload. This task adds the ability to change the image from the detail view.

- [ ] **Step 1: Read the hero image section (lines 399-425) and ImageUpload component**

Read `packages/frontend/src/features/recipes/RecipeDetailPage.tsx` lines 399-425 and `packages/frontend/src/components/ImageUpload.tsx` to understand both.

- [ ] **Step 2: Add image upload state and handler**

Add state for upload UI:
```tsx
const [showImageUpload, setShowImageUpload] = useState(false);
const [uploadingImage, setUploadingImage] = useState(false);
```

Add upload handler:
```tsx
const handleImageUpload = async (file: File) => {
  setUploadingImage(true);
  try {
    const response = await recipeApi.uploadImage(file, recipe.id);
    setRecipe(prev => prev ? { ...prev, imageUrl: response.data.imageUrl } : prev);
    setShowImageUpload(false);
  } catch (error) {
    console.error('Failed to upload image:', error);
    // Use existing toast/error pattern from the component
  } finally {
    setUploadingImage(false);
  }
};
```

- [ ] **Step 3: Add edit overlay on hero image**

Add a camera/edit icon button overlaying the hero image that toggles the upload UI:

```tsx
{/* Add inside the recipe-hero container, after the image */}
<button
  onClick={() => setShowImageUpload(!showImageUpload)}
  className="absolute top-3 right-3 p-2 bg-black/50 hover:bg-black/70 rounded-full text-white transition-opacity opacity-0 group-hover:opacity-100 md:opacity-0 md:group-hover:opacity-100"
  title="Change image"
>
  <Camera className="w-5 h-5" />
</button>
```

Add `group` class to the hero container div. On mobile, make the button always visible (remove opacity-0).

- [ ] **Step 4: Add upload modal/panel**

When `showImageUpload` is true, show a simple file input panel below the hero image:

```tsx
{showImageUpload && (
  <div className="mt-2 p-4 border rounded-lg bg-card">
    <div className="flex items-center justify-between mb-2">
      <span className="text-sm font-medium">Change Recipe Image</span>
      <button onClick={() => setShowImageUpload(false)} className="text-muted-foreground hover:text-foreground">
        <X className="w-4 h-4" />
      </button>
    </div>
    <input
      type="file"
      accept="image/jpeg,image/png,image/gif,image/webp"
      onChange={(e) => {
        const file = e.target.files?.[0];
        if (file) handleImageUpload(file);
      }}
      disabled={uploadingImage}
    />
    {uploadingImage && <p className="text-sm text-muted-foreground mt-2">Uploading...</p>}
  </div>
)}
```

Import Camera and X icons from lucide-react if not already imported.

- [ ] **Step 5: Commit**

```bash
git add packages/frontend/src/features/recipes/RecipeDetailPage.tsx
git commit -m "feat: add image upload capability on recipe detail page"
```

---

## Task 3: Print/PDF Enhancements

**Files:**
- Modify: `packages/frontend/src/features/recipes/RecipeDetailPage.tsx` — Add source URL and print date to print footer
- Modify: `packages/frontend/src/index.css` — Dark mode print safety

- [ ] **Step 1: Add print footer with source URL and date**

In RecipeDetailPage.tsx, add a print-only footer section (visible only in @media print):

```tsx
{/* Print footer - only visible when printing */}
<div className="hidden print:block mt-8 pt-4 border-t text-xs text-gray-500">
  {recipe.sourceUrl && <p>Source: {recipe.sourceUrl}</p>}
  <p>Printed from Nommable on {new Date().toLocaleDateString()}</p>
</div>
```

Place this after the recipe content, before the closing container div.

- [ ] **Step 2: Add dark mode print safety to CSS**

In `packages/frontend/src/index.css`, add to the existing `@media print` block:

```css
/* Force light mode for print regardless of theme */
.dark {
  --background: 40 25% 97%;
  --foreground: 20 14% 20%;
  --card: 0 0% 100%;
  --card-foreground: 20 14% 20%;
  --primary: 14 78% 55%;
  --primary-foreground: 0 0% 100%;
  --muted: 40 15% 92%;
  --muted-foreground: 20 10% 45%;
  --border: 20 15% 85%;
}
```

This overrides dark mode CSS variables with light mode values when printing.

- [ ] **Step 3: Ensure scaled quantities appear in print**

Verify that the print view uses `adjustedServings` and `servingMultiplier`. The current implementation already does this — the print sections reference the same variables as the screen view. No changes needed, just verify.

- [ ] **Step 4: Commit**

```bash
git add packages/frontend/src/features/recipes/RecipeDetailPage.tsx packages/frontend/src/index.css
git commit -m "feat: enhance print output with source URL, date footer, and dark mode safety"
```

---

## Task 4: Build Verification

- [ ] **Step 1: Run frontend build**

Run: `npm run build`
Expected: Clean build

- [ ] **Step 2: Run lint**

Run: `npm run lint`
Fix any new lint errors.

- [ ] **Step 3: Run all tests**

Run: `npm run test`
Expected: All tests pass

- [ ] **Step 4: Commit any fixes**

```bash
git add -A
git commit -m "fix: address lint and build issues from Phase 2"
```
