import { Router } from 'express';
import * as publicGallery from '../controllers/publicGallery.controller.js';
import { optionalAuth, requireAuth } from '../middleware/auth.js';

const router = Router();

router.get('/verified-projects', optionalAuth, publicGallery.listVerifiedProjects);
router.get('/verified-projects/:id', optionalAuth, publicGallery.getVerifiedProject);
router.get('/verified-projects/:id/reactions', publicGallery.listProjectReactions);
router.post('/verified-projects/:id/react', requireAuth, publicGallery.toggleProjectReaction);

export default router;
