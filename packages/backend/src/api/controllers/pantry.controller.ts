import { Response } from 'express';
import { PantryService } from '../../services/pantry/pantry.service';
import { AuthRequest } from '../middleware/auth';

const pantryService = new PantryService();

export const pantryController = {
  async getAll(req: AuthRequest, res: Response) {
    try {
      const items = await pantryService.getAllItems(req.userId!);
      res.json(items);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  },

  async getById(req: AuthRequest, res: Response) {
    try {
      const item = await pantryService.getItemById(req.params.id, req.userId!);
      if (!item) {
        return res.status(404).json({ error: 'Pantry item not found' });
      }
      res.json(item);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  },

  async create(req: AuthRequest, res: Response) {
    try {
      const item = await pantryService.createItem(req.userId!, req.body);
      res.status(201).json(item);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  },

  async update(req: AuthRequest, res: Response) {
    try {
      const item = await pantryService.updateItem(req.params.id, req.userId!, req.body);
      res.json(item);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  },

  async delete(req: AuthRequest, res: Response) {
    try {
      await pantryService.deleteItem(req.params.id, req.userId!);
      res.status(204).send();
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  },

  async getExpiring(req: AuthRequest, res: Response) {
    try {
      const daysAhead = parseInt(req.query.days as string) || 7;
      const items = await pantryService.getExpiringItems(req.userId!, daysAhead);
      res.json(items);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  },

  async getLowStock(req: AuthRequest, res: Response) {
    try {
      const items = await pantryService.getLowStockItems(req.userId!);
      res.json(items);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  },

  async updateQuantity(req: AuthRequest, res: Response) {
    try {
      const { quantityChange } = req.body;
      const item = await pantryService.updateQuantity(req.params.id, req.userId!, quantityChange);
      res.json(item);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  },

  async toggleLowStock(req: AuthRequest, res: Response) {
    try {
      const item = await pantryService.toggleLowStock(req.params.id, req.userId!);
      res.json(item);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  },
};
