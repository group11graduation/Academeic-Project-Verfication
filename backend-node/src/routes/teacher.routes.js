import { Router } from 'express';
import { requireRoles } from '../middleware/auth.js';
import * as teacher from '../controllers/teacherProposal.controller.js';
import * as teacherPreview from '../controllers/teacherPreview.controller.js';
import * as teacherCollaborative from '../controllers/teacherCollaborative.controller.js';
import * as teacherMessage from '../controllers/teacherMessage.controller.js';
import { uploadAssignmentRequirement } from '../middleware/assignmentRequirementUpload.js';

const router = Router();

router.use(requireRoles('teacher'));

router.get('/dashboard/stats', teacher.dashboardStats);
router.get('/classes', teacher.listMyClasses);
router.get('/classes/:classRef/students/:studentUserId', teacher.getClassStudentDetail);
router.get('/classes/:classRef/students', teacher.listClassStudents);
router.get('/classes/:classRef/groups', teacher.listClassGroupsDisplay);
router.get('/classes/:classRef/group-assignments', teacher.listClassGroupAssignments);
router.post('/classes/:classRef/class-groups/generate', teacher.generateClassTemplateGroups);
router.get('/classes/:classRef/class-groups/export', teacher.exportClassTemplateGroupsCsv);
router.post('/classes/:classRef/class-groups/import-preview', teacher.previewClassTemplateGroups);
router.post('/classes/:classRef/class-groups/import-commit', teacher.commitClassTemplateGroups);
router.post('/classes/:classRef/class-groups/import', teacher.importClassTemplateGroupsCsv);
router.post('/classes/:classRef/groups/generate', teacher.generateClassGroups);
router.get('/classes/:id', teacher.getMyClassDetails);
router.get('/catalog', teacher.getCatalog);
router.get('/collaborations/teachers', teacherCollaborative.listCollaborationCandidates);
router.get('/collaborations/pending-count', teacherCollaborative.collaborationPendingCount);
router.get('/collaborations/accepted', teacherCollaborative.listAcceptedCollaborators);
router.get('/collaborations', teacherCollaborative.listCollaborations);
router.post('/collaborations/request', teacherCollaborative.sendCollaborationRequest);
router.patch('/collaborations/:id/respond', teacherCollaborative.respondCollaborationRequest);
router.get('/groups', teacher.listAllGroups);
router.get('/groups/:id', teacher.getGroupDetails);
router.get('/assignments', teacher.listAssignments);
router.get('/assignments/collaborative/drafts', teacherCollaborative.listCollaborativeDrafts);
router.post('/assignments/collaborative/drafts', teacherCollaborative.createCollaborativeDraftHandler);
router.get('/assignments/collaborative/drafts/:id', teacherCollaborative.getCollaborativeDraft);
router.patch('/assignments/collaborative/drafts/:id', teacherCollaborative.updateCollaborativeDraftHandler);
router.post(
  '/assignments/collaborative/drafts/:id/requirements-file',
  uploadAssignmentRequirement.single('requirementsFile'),
  teacherCollaborative.uploadCollaborativeDraftSectionFileHandler
);
router.post('/assignments/collaborative/drafts/:id/publish', teacherCollaborative.publishCollaborativeDraftHandler);
router.post('/assignments/collaborative', teacherCollaborative.createCollaborativeAssignment);
router.post('/assignments', uploadAssignmentRequirement.single('requirementsFile'), teacher.createAssignment);
router.get('/assignments/:id', teacher.getAssignment);
router.patch('/assignments/:id', teacher.updateAssignment);
router.delete('/assignments/:id', teacher.deleteAssignment);
router.post('/assignments/:id/requirements-file', uploadAssignmentRequirement.single('requirementsFile'), teacher.uploadRequirementsFile);
router.get('/assignments/:assignmentId/normal-submissions/student/:studentUserId', teacher.getNormalSubmissionStudentDetail);
router.get('/assignments/:assignmentId/normal-submissions', teacher.listNormalSubmissions);
router.get('/assignments/:assignmentId/proposals', teacher.listProposals);
router.get('/assignments/:assignmentId/groups/export', teacher.exportAssignmentGroupsCsv);
router.post('/assignments/:assignmentId/groups/import', teacher.importAssignmentGroupsCsv);
router.get('/assignments/:assignmentId/groups', teacher.listGroups);
router.post('/assignments/:assignmentId/groups', teacher.createGroup);
router.patch('/proposals/:proposalId/review', teacher.reviewProposal);

router.get('/messages/open-count', teacherMessage.openCount);
router.get('/messages', teacherMessage.listMessages);
router.get('/messages/:messageId', teacherMessage.getMessage);
router.patch('/messages/:messageId/reply', teacherMessage.replyMessage);

router.post('/proposals/:proposalId/preview/start', teacherPreview.startPreview);
router.get('/proposals/:proposalId/preview/session', teacherPreview.getActivePreviewForProposal);
router.post('/preview-sessions/:sessionId/stop', teacherPreview.stopPreview);
router.get('/preview-sessions/:sessionId', teacherPreview.getPreviewSession);

export default router;
