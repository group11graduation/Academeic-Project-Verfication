import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import * as notification from '../controllers/notification.controller.js';

const router = Router();

router.use(requireAuth);

router.get('/', notification.listMine);
router.get('/unread-count', notification.unreadCount);
router.patch('/read-all', notification.markAllRead);
router.patch('/:id/read', notification.markRead);

export default router;
