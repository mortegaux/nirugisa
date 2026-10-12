/**
 * Service for automatically categorizing and tagging recipes
 */
export class RecipeCategorizerService {
  /**
   * Analyze recipe and suggest appropriate categories
   */
  static suggestCategories(recipe: {
    title?: string;
    description?: string;
    ingredients?: Array<{ name: string }>;
    tags?: string[];
    prepTime?: number;
    cookTime?: number;
  }): string[] {
    const categories: Set<string> = new Set();
    const text = `${recipe.title || ''} ${recipe.description || ''}`.toLowerCase();
    const ingredientNames = recipe.ingredients?.map((i) => i.name.toLowerCase()).join(' ') || '';
    const allText = `${text} ${ingredientNames}`;

    // Meal type categories
    if (
      allText.match(/breakfast|brunch|morning|pancake|waffle|oatmeal|cereal|toast|egg|bacon/) ||
      recipe.tags?.some((t) => t.toLowerCase().includes('breakfast'))
    ) {
      categories.add('Breakfast');
    }

    if (
      allText.match(/lunch|sandwich|wrap|salad|soup/) ||
      recipe.tags?.some((t) => t.toLowerCase().includes('lunch'))
    ) {
      categories.add('Lunch');
    }

    if (
      allText.match(/dinner|supper|main course/) ||
      recipe.tags?.some((t) => t.toLowerCase().includes('dinner'))
    ) {
      categories.add('Dinner');
    }

    if (
      allText.match(/snack|appetizer|starter|finger food|dip/) ||
      recipe.tags?.some((t) => t.toLowerCase().includes('snack|appetizer'))
    ) {
      categories.add('Snack');
    }

    if (
      allText.match(/dessert|cake|cookie|pie|brownie|sweet|pudding|ice cream/) ||
      recipe.tags?.some((t) => t.toLowerCase().includes('dessert'))
    ) {
      categories.add('Dessert');
    }

    // Dietary categories
    if (
      allText.match(/vegan/) ||
      recipe.tags?.some((t) => t.toLowerCase() === 'vegan')
    ) {
      categories.add('Vegan');
    }

    if (
      allText.match(/vegetarian/) ||
      recipe.tags?.some((t) => t.toLowerCase() === 'vegetarian')
    ) {
      categories.add('Vegetarian');
    }

    if (
      allText.match(/gluten.free|gluten-free/) ||
      recipe.tags?.some((t) => t.toLowerCase().includes('gluten'))
    ) {
      categories.add('Gluten-Free');
    }

    if (
      allText.match(/keto|ketogenic|low.carb|low-carb/) ||
      recipe.tags?.some((t) => t.toLowerCase().includes('keto') || t.toLowerCase().includes('low-carb'))
    ) {
      categories.add('Keto');
    }

    if (
      allText.match(/paleo/) ||
      recipe.tags?.some((t) => t.toLowerCase().includes('paleo'))
    ) {
      categories.add('Paleo');
    }

    if (
      allText.match(/dairy.free|dairy-free/) ||
      recipe.tags?.some((t) => t.toLowerCase().includes('dairy-free'))
    ) {
      categories.add('Dairy-Free');
    }

    // Cooking method categories
    if (allText.match(/bake|baked|baking|oven/)) {
      categories.add('Baking');
    }

    if (allText.match(/grill|grilled|grilling|bbq|barbecue/)) {
      categories.add('Grilling');
    }

    if (allText.match(/slow.cook|slow-cook|crockpot|crock.pot/)) {
      categories.add('Slow Cooker');
    }

    if (allText.match(/instant.pot|instant-pot|pressure.cook/)) {
      categories.add('Instant Pot');
    }

    if (allText.match(/air.fry|air-fry|air.fryer/)) {
      categories.add('Air Fryer');
    }

    if (allText.match(/stir.fry|stir-fry|wok/)) {
      categories.add('Stir Fry');
    }

    if (allText.match(/no.cook|no-cook|raw|uncooked/)) {
      categories.add('No Cook');
    }

    // Time-based categories
    const totalTime = (recipe.prepTime || 0) + (recipe.cookTime || 0);
    if (totalTime > 0 && totalTime <= 30) {
      categories.add('Quick & Easy');
    }

    if (totalTime > 60) {
      categories.add('Long Cook');
    }

    // Cuisine categories
    if (allText.match(/italian|pasta|pizza|risotto/)) {
      categories.add('Italian');
    }

    if (allText.match(/mexican|taco|burrito|enchilada|salsa|guacamole/)) {
      categories.add('Mexican');
    }

    if (allText.match(/chinese|asian|stir.fry|wok|soy.sauce/)) {
      categories.add('Chinese');
    }

    if (allText.match(/indian|curry|tikka|masala|naan/)) {
      categories.add('Indian');
    }

    if (allText.match(/japanese|sushi|ramen|teriyaki/)) {
      categories.add('Japanese');
    }

    if (allText.match(/thai|pad.thai|coconut.milk/)) {
      categories.add('Thai');
    }

    if (allText.match(/french|croissant|quiche/)) {
      categories.add('French');
    }

    if (allText.match(/mediterranean|greek|hummus|falafel/)) {
      categories.add('Mediterranean');
    }

    // Default: if no categories found, add "Main Course"
    if (categories.size === 0) {
      categories.add('Main Course');
    }

    return Array.from(categories);
  }

  /**
   * Analyze recipe and suggest appropriate tags
   */
  static suggestTags(recipe: {
    title?: string;
    description?: string;
    ingredients?: Array<{ name: string }>;
    difficulty?: string;
    prepTime?: number;
    cookTime?: number;
  }): string[] {
    const tags: Set<string> = new Set();
    const text = `${recipe.title || ''} ${recipe.description || ''}`.toLowerCase();
    const ingredientNames = recipe.ingredients?.map((i) => i.name.toLowerCase()).join(' ') || '';
    const allText = `${text} ${ingredientNames}`;

    // Dietary tags
    if (!allText.match(/meat|chicken|beef|pork|fish|seafood/)) {
      tags.add('Vegetarian');
    }

    if (!allText.match(/meat|chicken|beef|pork|fish|seafood|egg|dairy|milk|cheese|butter|cream/)) {
      tags.add('Vegan');
    }

    if (allText.match(/healthy|nutritious|wholesome|clean/)) {
      tags.add('Healthy');
    }

    if (allText.match(/comfort|cozy|hearty/)) {
      tags.add('Comfort Food');
    }

    // Time-based tags
    const totalTime = (recipe.prepTime || 0) + (recipe.cookTime || 0);
    if (totalTime <= 15) {
      tags.add('15 Minutes or Less');
    } else if (totalTime <= 30) {
      tags.add('30 Minutes or Less');
    }

    if ((recipe.prepTime || 0) <= 10) {
      tags.add('Easy Prep');
    }

    // Meal occasion tags
    if (allText.match(/family|kid|children/)) {
      tags.add('Family Friendly');
    }

    if (allText.match(/party|entertain|crowd|gathering/)) {
      tags.add('Party Food');
    }

    if (allText.match(/romantic|date/)) {
      tags.add('Date Night');
    }

    if (allText.match(/budget|cheap|affordable|economical/)) {
      tags.add('Budget Friendly');
    }

    // Meal prep tags
    if (allText.match(/meal.prep|make.ahead|freezer|leftover/)) {
      tags.add('Meal Prep');
    }

    if (allText.match(/one.pot|one-pot|one.pan|one-pan|sheet.pan/)) {
      tags.add('One Pot');
    }

    // Seasonal tags
    if (allText.match(/summer|bbq|grill|fresh|light/)) {
      tags.add('Summer');
    }

    if (allText.match(/winter|warm|cozy|hearty/)) {
      tags.add('Winter');
    }

    if (allText.match(/spring|fresh|light/)) {
      tags.add('Spring');
    }

    if (allText.match(/fall|autumn|pumpkin|apple/)) {
      tags.add('Fall');
    }

    // Add difficulty as a tag
    if (recipe.difficulty) {
      tags.add(recipe.difficulty.charAt(0).toUpperCase() + recipe.difficulty.slice(1));
    }

    return Array.from(tags);
  }

  /**
   * Auto-categorize and tag a recipe
   */
  static autoCategorizRecipe(recipe: {
    title?: string;
    description?: string;
    ingredients?: Array<{ name: string }>;
    tags?: string[];
    categories?: string[];
    difficulty?: string;
    prepTime?: number;
    cookTime?: number;
  }): { categories: string[]; tags: string[] } {
    const suggestedCategories = this.suggestCategories(recipe);
    const suggestedTags = this.suggestTags(recipe);

    // Merge with existing tags/categories
    const categories = Array.from(
      new Set([...(recipe.categories || []), ...suggestedCategories])
    );
    const tags = Array.from(new Set([...(recipe.tags || []), ...suggestedTags]));

    return { categories, tags };
  }
}
