import { Router } from 'express';
import { requireRoles } from '../middleware/auth.js';
import * as student from '../controllers/studentProposal.controller.js';
import { uploadProjectZip } from '../middleware/projectZipUpload.js';

const router = Router();

router.use(requireRoles('student'));

router.get('/dashboard', student.dashboard);
router.get('/assignments', student.listAssignments);
router.get('/assignments/:assignmentId', student.getAssignment);
router.post('/assignments/:assignmentId/proposals', student.submitProposal);
router.get('/assignments/:assignmentId/project-access', student.projectAccess);
router.post(
  '/assignments/:assignmentId/project-code',
  (req, res, next) => {
    uploadProjectZip.single('codeArchive')(req, res, (err) => {
      if (err) {
        err.status = err.code === 'LIMIT_FILE_SIZE' ? 413 : 400;
        return next(err);
      }
      next();
    });
  },
  student.submitProjectCode
);
router.get('/proposals/:proposalId', student.getProposal);

export default router;
