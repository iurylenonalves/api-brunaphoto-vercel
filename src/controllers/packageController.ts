import { Request, Response } from 'express';
import { PackageService } from '../services/PackageService';

export class PackageController {
  
  // List all packages
  static async index(req: Request, res: Response) {
    const packages = await PackageService.listAll();
    return res.json(packages);
  }

  // Get a package by ID
  static async show(req: Request, res: Response) {
    const { id } = req.params;
    const pkg = await PackageService.findById(id);

    if (!pkg) {
      return res.status(404).json({ error: 'Package not found' });
    }

    return res.json(pkg);
  }

  // Create new package
  static async create(req: Request, res: Response) {
    const { name, description, totalPrice, depositPrice, stripeProductId } = req.body;

    // Basic validation
    if (!name || totalPrice === undefined || depositPrice === undefined) {
      return res.status(400).json({ error: 'Name, totalPrice and depositPrice are required' });
    }

    try {
      const pkg = await PackageService.create({ 
        name, description, totalPrice, depositPrice, stripeProductId 
      });
      return res.status(201).json(pkg);
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  }

  // Update package
  static async update(req: Request, res: Response) {
    const { id } = req.params;
    const data = req.body;

    try {
      const pkg = await PackageService.update(id, data);
      return res.json(pkg);
    } catch (err: any) {
      if (err.message === 'Package not found') {
        return res.status(404).json({ error: err.message });
      }
      return res.status(500).json({ error: err.message });
    }
  }

  // Delete package (Soft delete)
  static async delete(req: Request, res: Response) {
    const { id } = req.params;

    try {
      await PackageService.delete(id);
      return res.status(204).send();
    } catch (err: any) {
      if (err.message === 'Package not found') {
        return res.status(404).json({ error: err.message });
      }
      return res.status(500).json({ error: err.message });
    }
  }
}
