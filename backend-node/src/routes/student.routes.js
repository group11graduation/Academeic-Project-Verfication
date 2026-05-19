import { Router } from 'express';
import { requireRoles } from '../middleware/auth.js';
import * as student from '../controllers/studentProposal.controller.js';
import { uploadProjectZip } from '../middleware/projectZipUpload.js';
import { uploadProposalFile } from '../middleware/proposalUpload.js';
import { uploadNormalAssignmentFile } from '../middleware/normalAssignmentUpload.js';

const router = Router();

router.use(requireRoles('student'));

router.get('/dashboard', student.dashboard);
router.get('/assignments', student.listAssignments);
router.get('/assignments/:assignmentId', student.getAssignment);
router.post(
  '/assignments/:assignmentId/proposals/parse-file',
  (req, res, next) => {
    uploadProposalFile.single('proposalFile')(req, res, (err) => {
      if (err) {
        err.status = err.code === 'LIMIT_FILE_SIZE' ? 413 : 400;
        return next(err);
      }
      next();
    });
  },
  student.parseProposalFile
);
router.post(
  '/assignments/:assignmentId/proposals',
  (req, res, next) => {
    uploadProposalFile.single('proposalFile')(req, res, (err) => {
      if (err) {
        err.status = err.code === 'LIMIT_FILE_SIZE' ? 413 : 400;
        return next(err);
      }
      next();
    });
  },
  student.submitProposal
);
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
router.post(
  '/assignments/:assignmentId/normal-submission',
  (req, res, next) => {
    uploadNormalAssignmentFile.single('assignmentFile')(req, res, (err) => {
      if (err) {
        err.status = err.code === 'LIMIT_FILE_SIZE' ? 413 : 400;
        return next(err);
      }
      next();
    });
  },
  student.submitNormalAssignment
);
router.get('/proposals/:proposalId', student.getProposal);

export default router;
