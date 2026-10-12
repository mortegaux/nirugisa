import { Response, NextFunction } from 'express';
import { AuthRequest } from '../middleware';
import { BatchCookingService } from '../../services/batch-cooking/batch-cooking.service';

const batchCookingService = new BatchCookingService();

export const create = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.userId!;
    const dto = req.body;

    const plan = await batchCookingService.create(userId, dto);

    res.status(201).json(plan);
  } catch (error) {
    next(error);
  }
};

export const getAll = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const plans = await batchCookingService.getAll();

    res.json(plans);
  } catch (error) {
    next(error);
  }
};

export const getById = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;

    const plan = await batchCookingService.getById(id);

    res.json(plan);
  } catch (error) {
    next(error);
  }
};

export const update = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const dto = req.body;

    const plan = await batchCookingService.update(id, dto);

    res.json(plan);
  } catch (error) {
    next(error);
  }
};

export const updateStatus = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    const plan = await batchCookingService.updateStatus(id, status);

    res.json(plan);
  } catch (error) {
    next(error);
  }
};

export const updateChecklist = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const { checklist } = req.body;

    const plan = await batchCookingService.updateChecklist(id, checklist);

    res.json(plan);
  } catch (error) {
    next(error);
  }
};

export const deletePlan = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;

    await batchCookingService.delete(id);

    res.status(204).send();
  } catch (error) {
    next(error);
  }
};

export const getSuggestions = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const suggestions = await batchCookingService.getBatchCookingSuggestions();

    res.json(suggestions);
  } catch (error) {
    next(error);
  }
};

export const createShoppingList = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.userId!;
    const { id } = req.params;

    const shoppingListData = await batchCookingService.createShoppingListFromPlan(id);

    // Import and use ShoppingListService
    const { ShoppingListService } = await import('../../services/shopping-list/shopping-list.service');
    const shoppingListService = new ShoppingListService();
    const shoppingList = await shoppingListService.create(userId, shoppingListData);

    res.status(201).json(shoppingList);
  } catch (error) {
    next(error);
  }
};

export const getAnalytics = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { BatchCookingAnalyticsService } = await import('../../services/batch-cooking/batch-cooking-analytics.service');
    const analyticsService = new BatchCookingAnalyticsService();
    const stats = await analyticsService.getStats();

    res.json(stats);
  } catch (error) {
    next(error);
  }
};
