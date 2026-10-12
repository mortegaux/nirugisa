import { Response } from 'express';
import { TaxonomyService } from '../../services/taxonomy/taxonomy.service';
import { AuthRequest } from '../middleware/auth';
import type { TaxonomyType } from '@nommable/shared';

const taxonomyService = new TaxonomyService();

export const taxonomyController = {
  async getAll(req: AuthRequest, res: Response) {
    try {
      const type = req.query.type as TaxonomyType | undefined;
      const items = await taxonomyService.getAll(req.userId!, type);
      res.json(items);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  },

  async create(req: AuthRequest, res: Response) {
    try {
      const item = await taxonomyService.create(req.userId!, req.body);
      res.status(201).json(item);
    } catch (error: any) {
      if (error.message?.includes('duplicate') || error.code === '23505') {
        return res.status(409).json({ error: 'A taxonomy with that name and type already exists' });
      }
      res.status(400).json({ error: error.message });
    }
  },

  async update(req: AuthRequest, res: Response) {
    try {
      const item = await taxonomyService.update(req.userId!, req.params.id, req.body);
      res.json(item);
    } catch (error: any) {
      if (error.message === 'Taxonomy not found') {
        return res.status(404).json({ error: error.message });
      }
      res.status(400).json({ error: error.message });
    }
  },

  async delete(req: AuthRequest, res: Response) {
    try {
      await taxonomyService.delete(req.userId!, req.params.id);
      res.status(204).send();
    } catch (error: any) {
      if (error.message === 'Taxonomy not found') {
        return res.status(404).json({ error: error.message });
      }
      res.status(500).json({ error: error.message });
    }
  },

  async reorder(req: AuthRequest, res: Response) {
    try {
      await taxonomyService.reorder(req.userId!, req.body.ids);
      res.json({ success: true });
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  },
};
