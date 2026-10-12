import type { RecipeCreateDto } from '@nommable/shared';

export function buildRecipeDto(overrides: Partial<RecipeCreateDto> = {}): RecipeCreateDto {
  return {
    title: 'Test Recipe',
    description: 'A test recipe',
    servings: 4,
    prepTime: 15,
    cookTime: 30,
    difficulty: 'easy',
    instructions: ['Step 1', 'Step 2'],
    ingredients: [
      { name: 'Salt', quantity: 1, unit: 'tsp', order: 0 },
      { name: 'Pepper', quantity: 0.5, unit: 'tsp', order: 1 },
    ],
    categories: ['Test'],
    tags: ['test'],
    ...overrides,
  };
}

export function buildRecipeDtos(count: number): RecipeCreateDto[] {
  return Array.from({ length: count }, (_, i) =>
    buildRecipeDto({
      title: `Test Recipe ${i + 1}`,
      categories: [i % 2 === 0 ? 'Italian' : 'Mexican'],
      difficulty: i % 3 === 0 ? 'easy' : i % 3 === 1 ? 'medium' : 'hard',
      prepTime: 10 + i * 5,
    })
  );
}
