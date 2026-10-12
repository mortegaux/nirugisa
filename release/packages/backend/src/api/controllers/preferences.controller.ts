import { Response, NextFunction } from 'express';
import { AuthRequest } from '../middleware';
import { PreferencesService } from '../../services/preferences/preferences.service';

const preferencesService = new PreferencesService();

export const getPreferences = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const preferences = await preferencesService.getOrCreatePreferences(req.userId!);

    res.json(preferences);
  } catch (error) {
    next(error);
  }
};

export const updatePreferences = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const dto = req.body;

    const preferences = await preferencesService.updatePreferences(dto);

    res.json(preferences);
  } catch (error) {
    next(error);
  }
};

export const deletePreferences = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    await preferencesService.deletePreferences();

    res.status(204).send();
  } catch (error) {
    next(error);
  }
};

export const checkRecipeCompatibility = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const { recipeTags, recipeIngredients } = req.body;

    const result = await preferencesService.checkRecipeCompatibility(
      recipeTags || [],
      recipeIngredients || []
    );

    res.json(result);
  } catch (error) {
    next(error);
  }
};
