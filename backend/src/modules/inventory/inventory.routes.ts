import { Router } from 'express';
import { InventoryController } from './inventory.controller';
import { AIController } from '../ai/ai.controller';
import { authenticate } from '../../middlewares/auth';
import { uploadMiddleware } from '../../middlewares/upload';

const router = Router();

router.post('/refill-declare', authenticate, InventoryController.declareRefill);
router.get('/alerts', authenticate, InventoryController.getAlerts);
router.get('/home-supplies', authenticate, InventoryController.listHomeSupplies);
router.post('/home-supplies', authenticate, InventoryController.addHomeSupply);
router.get('/home-supplies/barcode/:barcode', authenticate, InventoryController.lookupBarcode);
router.post('/scan-foil', authenticate, uploadMiddleware.single('file'), AIController.scanFoil);

export const inventoryRoutes = router;
