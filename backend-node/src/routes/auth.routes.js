import { Router } from 'express';
import * as auth from '../controllers/auth.controller.js';
import { requireAuth } from '../middleware/auth.js';
import { loginRules } from '../validators/auth.validators.js';

const router = Router();

router.post('/login', loginRules, auth.login);

router.get('/me', requireAuth, auth.me);

export default router;
