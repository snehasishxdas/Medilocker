import { Router } from 'express';
import { AuthController } from './auth.controller';
import { authenticate } from '../../middlewares/auth';

const router = Router();

// Public routes
router.post('/signup', AuthController.signup);
router.post('/setup-mpin', AuthController.setupMpin);
router.post('/login', AuthController.login);
router.post('/webauthn/login/options', AuthController.getWebAuthnAuthOptions);
router.post('/webauthn/login/verify', AuthController.verifyWebAuthnAuth);

// Protected routes
router.get('/me', authenticate, AuthController.me);
router.put('/me', authenticate, AuthController.updateProfile);
router.post('/change-mpin', authenticate, AuthController.changeMpin);
router.get('/webauthn/register/options', authenticate, AuthController.getWebAuthnRegisterOptions);
router.post('/webauthn/register/verify', authenticate, AuthController.verifyWebAuthnRegister);

export const authRoutes = router;
