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
    const userId = req.userId!;
    const plans = await batchCookingService.getAll(userId);

    res.json(plans);
  } catch (error) {
    next(error);
  }
};

export const getById = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.userId!;
    const { id } = req.params;

    const plan = await batchCookingService.getById(id, userId);

    res.json(plan);
  } catch (error) {
    next(error);
  }
};

export const update = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.userId!;
    const { id } = req.params;
    const dto = req.body;

    const plan = await batchCookingService.update(id, userId, dto);

    res.json(plan);
  } catch (error) {
    next(error);
  }
};

export const updateStatus = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.userId!;
    const { id } = req.params;
    const { status } = req.body;

    const plan = await batchCookingService.updateStatus(id, userId, status);

    res.json(plan);
  } catch (error) {
    next(error);
  }
};

export const updateChecklist = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.userId!;
    const { id } = req.params;
    const { checklist } = req.body;

    const plan = await batchCookingService.updateChecklist(id, userId, checklist);

    res.json(plan);
  } catch (error) {
    next(error);
  }
};

export const deletePlan = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.userId!;
    const { id } = req.params;

    await batchCookingService.delete(id, userId);

    res.status(204).send();
  } catch (error) {
    next(error);
  }
};

export const getSuggestions = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.userId!;
    const suggestions = await batchCookingService.getBatchCookingSuggestions(userId);

    res.json(suggestions);
  } catch (error) {
    next(error);
  }
};

export const createShoppingList = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.userId!;
    const { id } = req.params;

    const shoppingListData = await batchCookingService.createShoppingListFromPlan(id, userId);

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
    const userId = req.userId!;
    const { BatchCookingAnalyticsService } = await import(
      '../../services/batch-cooking/batch-cooking-analytics.service'
    );
    const analyticsService = new BatchCookingAnalyticsService();
    const stats = await analyticsService.getStats(userId);

    res.json(stats);
  } catch (error) {
    next(error);
  }
};
