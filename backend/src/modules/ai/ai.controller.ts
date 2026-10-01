import { Request, Response, NextFunction } from 'express';
import { AIService } from './ai.service';
import { prisma } from '../../database/prisma';
import { AppError } from '../../middlewares/errorHandler';

export class AIController {
  static async chat(req: Request, res: Response, next: NextFunction) {
    try {
      const message = req.body.message || req.body.query;
      if (!message || typeof message !== 'string') {
        throw new AppError('Message string is required.', 400);
      }

      const patient = await prisma.patientProfile.findUnique({
        where: { userId: req.user!.userId },
      }).catch(() => null);

      const homeSupplies = await prisma.medicineInventoryHome.findMany({
        where: { patientId: req.user!.userId },
      }).catch(() => []);

      const prescribedMeds = await prisma.prescribedMedication.findMany({
        where: { patientId: req.user!.userId },
      }).catch(() => []);

      const dailyTodos = await prisma.dailyTodoItem.findMany({
        where: { patientId: req.user!.userId },
      }).catch(() => []);

      const userAllergies = patient?.baselineAllergies
        ? patient.baselineAllergies.split(',').map((s: string) => s.trim()).filter(Boolean)
        : [];
      const userConditions = patient?.chronicConditions?.length
        ? patient.chronicConditions
        : patient?.medicalHistory
        ? patient.medicalHistory.split(',').map((s: string) => s.trim()).filter(Boolean)
        : [];

      const activePrescribedList: Array<{ medicineName: string; activeSalt?: string; dosage?: string; frequency?: string }> = [];

      prescribedMeds.forEach((m) => {
        activePrescribedList.push({
          medicineName: m.medicineName,
          activeSalt: m.activeSalt || undefined,
          dosage: m.dosage,
          frequency: m.frequency,
        });
      });

      dailyTodos.forEach((td) => {
        if (!activePrescribedList.some((x) => td.taskLabel.toLowerCase().includes(x.medicineName.toLowerCase()))) {
          activePrescribedList.push({
            medicineName: td.taskLabel,
            frequency: td.timeSlot,
          });
        }
      });

      if (patient?.baselineMedications) {
        patient.baselineMedications.split(',').forEach((medStr) => {
          const trimmed = medStr.trim();
          if (trimmed && !activePrescribedList.some((x) => x.medicineName.toLowerCase() === trimmed.toLowerCase())) {
            activePrescribedList.push({
              medicineName: trimmed,
            });
          }
        });
      }

      const clinicalContext = {
        fullName: patient?.fullName || 'Patient',
        isPregnant: patient?.pregnancyStatus || false,
        recentAlcohol: patient?.alcoholUse || false,
        knownAllergies: userAllergies,
        chronicConditions: userConditions,
        homeSupplies: homeSupplies.map((h) => ({
          name: h.medicineName,
          activeSalt: h.activeSalt || undefined,
          quantity: h.quantityAvailable,
        })),
        alreadyPrescribedMedications: activePrescribedList,
      };

      const result = await AIService.chatWithCompanion(message, clinicalContext);
      res.status(200).json({ success: true, data: result, response: result.response });
    } catch (error) {
      next(error);
    }
  }

  static async scanFoil(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.file) {
        throw new AppError('Foil image file is required.', 400);
      }
      const result = await AIService.analyzeFoil(req.file.buffer, req.file.mimetype);
      res.status(200).json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  static async voiceIntake(req: Request, res: Response, next: NextFunction) {
    try {
      const input = req.body.input || req.body.transcript;
      const { history, dialect, language, currentSocrates } = req.body;
      if (!input || typeof input !== 'string') {
        throw new AppError('Patient voice/text input is required (use "input" or "transcript").', 400);
      }
      const result = await AIService.conductVoiceIntake({
        input,
        history,
        dialect,
        language,
        currentSocrates,
      });
      res.status(200).json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  static async diseasePrediction(req: Request, res: Response, next: NextFunction) {
    try {
      const socrates = req.body.socrates || req.body.socratesData || req.body;
      const { patientContext, language } = req.body;
      if (!socrates || typeof socrates !== 'object') {
        throw new AppError('SOCRATES clinical matrix is required (use "socrates" or "socratesData").', 400);
      }
      const result = await AIService.predictDiseasesAndTests({
        socrates,
        patientContext,
        language,
      });
      res.status(200).json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  static async doubleCode(req: Request, res: Response, next: NextFunction) {
    try {
      const complaintOrDiagnosis = req.body.complaintOrDiagnosis || req.body.clinicalText || req.body.text;
      const { language } = req.body;
      if (!complaintOrDiagnosis || typeof complaintOrDiagnosis !== 'string') {
        throw new AppError('Clinical complaint or diagnosis string is required.', 400);
      }
      const result = await AIService.doubleCodeDiagnosis({
        complaintOrDiagnosis,
        language,
      });
      res.status(200).json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  static async clinicalTriage(req: Request, res: Response, next: NextFunction) {
    try {
      const targetPatientId = req.params.patientId || req.user!.userId;
      const result = await AIService.generateClinicalTriageSummary(targetPatientId);
      res.status(200).json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  static async saveIntake(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = req.user!.userId;
      const { socrates, predictedConditions, recommendedTests, patientExplanation } = req.body;
      const result = await AIService.saveIntakeToVault(userId, {
        socrates,
        predictedConditions,
        recommendedTests,
        patientExplanation,
      });
      res.status(201).json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }
}

