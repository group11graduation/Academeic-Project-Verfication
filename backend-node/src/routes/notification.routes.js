import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import * as notification from '../controllers/notification.controller.js';

/**
 * Dual notification HTTP surface (JWT required).
 * Base path: /api/notifications  (mounted in src/index.js)
 *
 * GET   /api/notifications           → list logged-in user's notifications (newest first)
 * GET   /api/notifications/unread-count
 * PATCH /api/notifications/:id/read  → mark one as read
 * PATCH /api/notifications/read-all  → mark all as read
 */
const router = Router();

router.use(requireAuth);

router.get('/', notification.listMine);
router.get('/unread-count', notification.unreadCount);
router.patch('/read-all', notification.markAllRead);
router.patch('/:id/read', notification.markRead);

export default router;
