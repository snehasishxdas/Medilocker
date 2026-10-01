import { Request, Response, NextFunction } from 'express';
import { InventoryService } from './inventory.service';
import { z } from 'zod';
import { ScanMethod } from '@prisma/client';

const refillDeclareSchema = z.object({
  medicationId: z.string().uuid(),
  purchasedQuantity: z.coerce.number().min(1),
  dailyConsumptionRate: z.coerce.number().min(1).default(2),
});

const homeSupplySchema = z.object({
  medicineName: z.string().min(2),
  quantity: z.coerce.number().min(1),
  expiryDate: z.string().optional(),
  barcodeGtin: z.string().optional(),
  batchNumber: z.string().optional(),
  scanMethod: z.nativeEnum(ScanMethod).optional(),
  activeSalt: z.string().optional(),
  aiCategory: z.string().optional(),
});

export class InventoryController {
  static async declareRefill(req: Request, res: Response, next: NextFunction) {
    try {
      const { medicationId, purchasedQuantity, dailyConsumptionRate } = refillDeclareSchema.parse(req.body);
      const result = await InventoryService.declarePurchasedStock(
        req.user!.userId,
        medicationId,
        purchasedQuantity,
        dailyConsumptionRate
      );
      res.status(201).json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  static async getAlerts(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await InventoryService.getLowStockAlerts(req.user!.userId);
      res.status(200).json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  static async listHomeSupplies(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await InventoryService.listHomeSupplies(req.user!.userId);
      res.status(200).json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  static async addHomeSupply(req: Request, res: Response, next: NextFunction) {
    try {
      const validated = homeSupplySchema.parse(req.body);
      const result = await InventoryService.addHomeSupply(req.user!.userId, validated);
      res.status(201).json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  static async lookupBarcode(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await InventoryService.lookupBarcode(req.params.barcode);
      res.status(200).json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }
}
