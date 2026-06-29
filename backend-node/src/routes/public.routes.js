import { Router } from 'express';
import * as publicGallery from '../controllers/publicGallery.controller.js';

const router = Router();

router.get('/verified-projects', publicGallery.listVerifiedProjects);
router.get('/verified-projects/:id', publicGallery.getVerifiedProject);

export default router;
