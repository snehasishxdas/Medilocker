import { Request, Response, NextFunction } from 'express';
import { AuthService } from './auth.service';
import { signupSchema, setupMpinSchema, loginSchema, changeMpinSchema } from './auth.validation';

export class AuthController {
  static async signup(req: Request, res: Response, next: NextFunction) {
    try {
      const validated = signupSchema.parse(req.body);
      const result = await AuthService.signup(validated);
      res.status(201).json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  static async setupMpin(req: Request, res: Response, next: NextFunction) {
    try {
      const { medilockerId, mpin } = setupMpinSchema.parse(req.body);
      const result = await AuthService.setupMpin(medilockerId, mpin);
      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  }

  static async login(req: Request, res: Response, next: NextFunction) {
    try {
      const { email, medilockerId, identifier, role, mpin, password } = loginSchema.parse(req.body);
      const result = await AuthService.login({ email, medilockerId, identifier, role, mpin, password });
      res.status(200).json({ success: true, ...result });
    } catch (error) {
      next(error);
    }
  }

  static async changeMpin(req: Request, res: Response, next: NextFunction) {
    try {
      const { oldMpin, newMpin } = changeMpinSchema.parse(req.body);
      const result = await AuthService.changeMpin(req.user!.userId, oldMpin, newMpin);
      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  }

  static async getWebAuthnRegisterOptions(req: Request, res: Response, next: NextFunction) {
    try {
      const options = await AuthService.getWebAuthnRegisterOptions(req.user!.userId);
      res.status(200).json(options);
    } catch (error) {
      next(error);
    }
  }

  static async verifyWebAuthnRegister(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await AuthService.verifyWebAuthnRegister(req.user!.userId, req.body);
      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  }

  static async getWebAuthnAuthOptions(req: Request, res: Response, next: NextFunction) {
    try {
      const { medilockerId } = req.body;
      const result = await AuthService.getWebAuthnAuthOptions(medilockerId);
      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  }

  static async verifyWebAuthnAuth(req: Request, res: Response, next: NextFunction) {
    try {
      const { userId, response } = req.body;
      const result = await AuthService.verifyWebAuthnAuth(userId, response);
      res.status(200).json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  static async me(req: Request, res: Response, next: NextFunction) {
    try {
      const user = await AuthService.getMe(req.user!.userId);
      res.status(200).json({ success: true, data: user, user });
    } catch (error) {
      next(error);
    }
  }

  static async updateProfile(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await AuthService.updateProfile(req.user!.userId, req.body);
      res.status(200).json({ success: true, data: result, user: result });
    } catch (error) {
      next(error);
    }
  }
}
