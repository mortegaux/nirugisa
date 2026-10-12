export function buildEnhancePrompts(
  recipe: any,
  enhancementType: string
): { systemPrompt: string; userPrompt: string } {
  const systemPrompt =
    'You are a professional chef helping to improve recipes. Always respond with valid JSON only, no markdown or extra text.';

  let userPrompt = '';
  if (enhancementType === 'improve_instructions') {
    userPrompt = `Improve the following recipe instructions to be clearer and more detailed.

Title: ${recipe.title}
Instructions: ${(recipe.instructions || []).join('\n')}

Respond with JSON: {"improvedInstructions": ["step 1", "step 2", ...]}`;
  } else if (enhancementType === 'add_tips') {
    userPrompt = `Provide 3-5 helpful cooking tips for this recipe.

Title: ${recipe.title}
Ingredients: ${(recipe.ingredients || []).map((i: any) => i.name).join(', ')}

Respond with JSON: {"tips": ["tip 1", "tip 2", ...]}`;
  } else if (enhancementType === 'optimize_ingredients') {
    userPrompt = `Suggest optimizations or substitutions for these ingredients.

${(recipe.ingredients || []).map((i: any) => `${i.quantity || ''} ${i.unit || ''} ${i.name}`).join('\n')}

Respond with JSON: {"optimizations": [{"original": "ingredient name", "suggestion": "suggested replacement", "reason": "why this is better"}, ...]}`;
  }

  return { systemPrompt, userPrompt };
}
