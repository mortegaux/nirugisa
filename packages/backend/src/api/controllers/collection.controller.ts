import { Response, NextFunction } from 'express';
import { AuthRequest } from '../middleware';
import { CollectionService } from '../../services/collection/collection.service';

export class CollectionController {
  private collectionService = new CollectionService();

  async findAll(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const collections = await this.collectionService.findAll(req.userId!);
      res.json(collections);
    } catch (error) {
      next(error);
    }
  }

  async findById(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const collection = await this.collectionService.findById(req.userId!, req.params.id);
      res.json(collection);
    } catch (error) {
      next(error);
    }
  }

  async create(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const collection = await this.collectionService.create(req.userId!, req.body);
      res.status(201).json(collection);
    } catch (error) {
      next(error);
    }
  }

  async update(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const collection = await this.collectionService.update(req.userId!, req.params.id, req.body);
      res.json(collection);
    } catch (error) {
      next(error);
    }
  }

  async delete(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      await this.collectionService.delete(req.userId!, req.params.id);
      res.status(204).send();
    } catch (error) {
      next(error);
    }
  }

  async addRecipe(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { recipeId } = req.body;
      const item = await this.collectionService.addRecipe(req.userId!, req.params.id, recipeId);
      res.status(201).json(item);
    } catch (error) {
      next(error);
    }
  }

  async removeRecipe(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      await this.collectionService.removeRecipe(req.userId!, req.params.id, req.params.recipeId);
      res.status(204).send();
    } catch (error) {
      next(error);
    }
  }

  async toggleFavorite(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { recipeId } = req.body;
      const result = await this.collectionService.toggleFavorite(req.userId!, recipeId);
      res.json(result);
    } catch (error) {
      next(error);
    }
  }
}
