import { ScanMethod } from '@prisma/client';
import { prisma } from '../../database/prisma';
import { AIService } from '../ai/ai.service';
import { AppError } from '../../middlewares/errorHandler';
import { logger } from '../../utils/logger';
import { cacheService } from '../../utils/cache';

const barcodePharmaCatalog: Record<string, { name: string; salt: string; dosage: string; category: string }> = {
  '8901234567890': { name: 'Dolo 650', salt: 'Paracetamol', dosage: '650mg', category: 'Antipyretic / Pain Relief' },
  '8902345678901': { name: 'Augmentin 625 Duo', salt: 'Amoxicillin + Clavulanic Acid', dosage: '625mg', category: 'Antibiotic' },
  '8903456789012': { name: 'Montair-LC', salt: 'Montelukast + Levocetirizine', dosage: '10mg/5mg', category: 'Antihistamine / Respiratory' },
  '8904567890123': { name: 'Pan 40', salt: 'Pantoprazole', dosage: '40mg', category: 'Antacid / PPI' },
  '8905678901234': { name: 'Electral Powder', salt: 'Oral Rehydration Salts (ORS)', dosage: '21.8g sachet', category: 'Electrolyte Replenishment' },
  '8906789012345': { name: 'Azithral 500', salt: 'Azithromycin', dosage: '500mg', category: 'Antibiotic' },
  '8907890123456': { name: 'Allegra 120', salt: 'Fexofenadine', dosage: '120mg', category: 'Antiallergic' },
};

export class InventoryService {
  /**
   * Declare purchased quantity for active prescription medication
   */
  static async declarePurchasedStock(
    userId: string,
    medicationId: string,
    purchasedQuantity: number,
    dailyConsumptionRate = 2
  ) {
    const med = await prisma.prescribedMedication.findFirst({
      where: { id: medicationId, patientId: userId },
    });

    if (!med) {
      throw new AppError('Prescribed medication not found.', 404);
    }

    const daysOfSupply = Math.floor(purchasedQuantity / Math.max(1, dailyConsumptionRate));
    const depletionDate = new Date();
    depletionDate.setDate(depletionDate.getDate() + daysOfSupply);

    // 2 days prior to depletion
    const alertDate = new Date(depletionDate);
    alertDate.setDate(alertDate.getDate() - 2);

    const encodedQuery = encodeURIComponent(med.medicineName);
    const epharmacyLink = `https://www.1mg.com/search/all?name=${encodedQuery}`;

    const reminder = await prisma.refillReminder.create({
      data: {
        patientId: userId,
        medicationId: med.id,
        purchasedQuantity,
        remainingQuantity: purchasedQuantity,
        dailyConsumptionRate,
        estimatedDepletionDate: depletionDate,
        alertDate,
        isAlertTriggered: false,
        epharmacyLink,
      },
    });

    await cacheService.invalidatePrefix(`inventory:${userId}`);
    logger.info(`Refill tracker established for user ${userId}, med: ${med.medicineName}, alertDate: ${alertDate.toISOString()}`);

    return reminder;
  }

  /**
   * Fetch active low-stock alerts (2 days prior to stock exhaustion)
   */
  static async getLowStockAlerts(userId: string) {
    const today = new Date();

    const reminders = await prisma.refillReminder.findMany({
      where: {
        patientId: userId,
        alertDate: { lte: today },
      },
      include: { medication: true },
      orderBy: { estimatedDepletionDate: 'asc' },
    });

    return reminders.map((r) => {
      const daysLeft = Math.max(
        0,
        Math.ceil((r.estimatedDepletionDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
      );
      return {
        id: r.id,
        medicineName: r.medication.medicineName,
        dosage: r.medication.dosage,
        remainingQuantity: r.remainingQuantity,
        daysLeft,
        depletionDate: r.estimatedDepletionDate.toISOString().split('T')[0],
        purchaseLink: r.epharmacyLink,
        message: `Supply running low. Estimated depletion in ${daysLeft} days. Order refill now to prevent course disruption.`,
      };
    });
  }

  /**
   * List Home Supplies Cabinet (Cached with SWR)
   */
  static async listHomeSupplies(userId: string) {
    const cacheKey = `inventory:${userId}`;
    const { data } = await cacheService.fetchOrCompute(
      cacheKey,
      () =>
        prisma.medicineInventoryHome.findMany({
          where: { patientId: userId },
          orderBy: { addedAt: 'desc' },
        }),
      { ttlSeconds: 180, swrGraceSeconds: 60 }
    );
    return data;
  }

  /**
   * Add item to Home Supplies with automated AI clinical classification
   */
  static async addHomeSupply(
    userId: string,
    data: {
      medicineName: string;
      quantity: number;
      expiryDate?: string;
      barcodeGtin?: string;
      batchNumber?: string;
      scanMethod?: ScanMethod;
      activeSalt?: string;
      aiCategory?: string;
    }
  ) {
    let activeSalt = data.activeSalt;
    let aiCategory = data.aiCategory;
    let aiUsesDescription: string | undefined;
    let aiPrecautions: string | undefined;

    if (!activeSalt || !aiCategory) {
      const aiClassification = await AIService.categorizeMedicine(data.medicineName);
      activeSalt = activeSalt || aiClassification.activeSalt;
      aiCategory = aiCategory || aiClassification.aiCategory;
      aiUsesDescription = aiClassification.aiUsesDescription;
      aiPrecautions = aiClassification.aiPrecautions;
    }

    const created = await prisma.medicineInventoryHome.create({
      data: {
        patientId: userId,
        medicineName: data.medicineName,
        activeSalt: activeSalt || null,
        quantityAvailable: data.quantity,
        expiryDate: data.expiryDate ? new Date(data.expiryDate) : null,
        barcodeGtin: data.barcodeGtin,
        batchNumber: data.batchNumber,
        scanMethod: data.scanMethod || ScanMethod.MANUAL,
        aiCategory: aiCategory || null,
        aiUsesDescription: aiUsesDescription,
        aiPrecautions: aiPrecautions,
      },
    });

    await cacheService.invalidatePrefix(`inventory:${userId}`);
    logger.info(`Home supply added for user ${userId}: ${created.medicineName} (${created.aiCategory})`);

    return created;
  }

  /**
   * Lookup 1D Barcode (EAN) or 2D DataMatrix (GTIN + Expiry)
   */
  static async lookupBarcode(code: string) {
    const cleanCode = code.trim();
    const catalogMatch = barcodePharmaCatalog[cleanCode];
    if (catalogMatch) {
      return {
        found: true,
        medicineName: catalogMatch.name,
        activeSalt: catalogMatch.salt,
        dosage: catalogMatch.dosage,
        aiCategory: catalogMatch.category,
        scanMethod: cleanCode.length > 14 ? 'DATAMATRIX_2D' : 'BARCODE_1D',
      };
    }

    // If 2D DataMatrix format (often contains AI 01 GTIN + AI 17 Expiry Date YYMMDD)
    if (cleanCode.length >= 16) {
      return {
        found: true,
        medicineName: `Pharmaceutical Item (${cleanCode.slice(0, 14)})`,
        activeSalt: 'Standard Pharmaceutical Salt',
        dosage: 'Standard',
        scanMethod: 'DATAMATRIX_2D',
      };
    }

    return {
      found: false,
      message: 'Barcode not found in catalog. You can proceed with manual entry or photo strip scan.',
      barcodeGtin: cleanCode,
    };
  }
}
