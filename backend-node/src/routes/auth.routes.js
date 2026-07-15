import { Router } from 'express';
import * as auth from '../controllers/auth.controller.js';
import { requireAuth } from '../middleware/auth.js';
import {
  forgotPasswordRules,
  loginRules,
  resetPasswordRules,
} from '../validators/auth.validators.js';

const router = Router();

router.post('/login', loginRules, auth.login);
router.post('/forgot-password', forgotPasswordRules, auth.forgotPassword);
router.post('/reset-password', resetPasswordRules, auth.resetPassword);

router.get('/me', requireAuth, auth.me);

export default router;
