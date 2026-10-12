import { Response, NextFunction } from 'express';
import { AuthRequest } from '../middleware';
import { ShoppingListService } from '../../services/shopping-list';

export class ShoppingListController {
  private shoppingListService = new ShoppingListService();

  async create(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const shoppingList = await this.shoppingListService.create(req.userId!, req.body);
      res.status(201).json(shoppingList);
    } catch (error) {
      next(error);
    }
  }

  async createFromMealPlan(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { mealPlanId } = req.body;
      const shoppingList = await this.shoppingListService.createFromMealPlan(
        req.userId!,
        mealPlanId
      );
      res.status(201).json(shoppingList);
    } catch (error) {
      next(error);
    }
  }

  async findAll(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const shoppingLists = await this.shoppingListService.findAll();
      res.json(shoppingLists);
    } catch (error) {
      next(error);
    }
  }

  async findById(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const shoppingList = await this.shoppingListService.findById(req.params.id);
      res.json(shoppingList);
    } catch (error) {
      next(error);
    }
  }

  async update(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const shoppingList = await this.shoppingListService.update(
        req.params.id,
        req.body
      );
      res.json(shoppingList);
    } catch (error) {
      next(error);
    }
  }

  async delete(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      await this.shoppingListService.delete(req.params.id);
      res.status(204).send();
    } catch (error) {
      next(error);
    }
  }

  async toggleItem(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const shoppingList = await this.shoppingListService.toggleItem(
        req.params.id,
        req.params.itemId
      );
      res.json(shoppingList);
    } catch (error) {
      next(error);
    }
  }
}
