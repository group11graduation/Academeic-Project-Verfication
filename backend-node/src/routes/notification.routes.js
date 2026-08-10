import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import * as notification from '../controllers/notification.controller.js';

/**
 * Dual notification HTTP surface (JWT required).
 * Base path: /api/notifications
 */
const router = Router();

router.use(requireAuth);

router.get('/', notification.listMine);
router.get('/unread-count', notification.unreadCount);
router.get('/email-status', notification.emailStatus);
router.post('/test-email', notification.testEmail);
router.patch('/read-all', notification.markAllRead);
router.patch('/:id/read', notification.markRead);

export default router;
