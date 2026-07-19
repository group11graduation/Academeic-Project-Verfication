import { asyncHandler } from '../utils/asyncHandler.js';
import { success, fail } from '../utils/apiResponse.js';
import * as assignmentTeacher from '../services/assignmentTeacher.service.js';
import * as proposalWorkflow from '../services/proposalWorkflow.service.js';
import * as normalAssignmentSubmission from '../services/normalAssignmentSubmission.service.js';
import * as teacherClassGroups from '../services/teacherClassGroups.service.js';

export const getCatalog = asyncHandler(async (req, res) => {
  const data = await assignmentTeacher.getTeacherCatalog(req.userId);
  return success(res, data);
});

export const listMyClasses = asyncHandler(async (req, res) => {
  const data = await assignmentTeacher.listClassesForTeacher(req.userId);
  return success(res, data);
});

export const getMyClassDetails = asyncHandler(async (req, res) => {
  const data = await assignmentTeacher.getClassDetailsForTeacher(req.userId, req.params.id);
  if (!data) return fail(res, 'Class not found', 404);
  return success(res, data);
});

export const listAssignments = asyncHandler(async (req, res) => {
  const data = await assignmentTeacher.listAssignmentsForTeacher(req.userId, {
    semesterId: req.query?.semesterId,
  });
  return success(res, data);
});

export const dashboardStats = asyncHandler(async (req, res) => {
  const data = await assignmentTeacher.getTeacherDashboardStats(req.userId);
  return success(res, data);
});

export const getMyProfile = asyncHandler(async (req, res) => {
  const data = await assignmentTeacher.getMyTeacherProfile(req.userId);
  return success(res, data);
});

export const getAssignment = asyncHandler(async (req, res) => {
  const row = await assignmentTeacher.getAssignmentForTeacher(req.userId, req.params.id);
  if (!row) return fail(res, 'Not found', 404);
  return success(res, row);
});

export const createAssignment = asyncHandler(async (req, res) => {
  const payload = { ...req.body };
  if (req.file?.filename) {
    payload._requirementsFilePath = `/uploads/assignment-requirements/${req.file.filename}`;
    payload._requirementsOriginalName = req.file.originalname || req.file.filename;
  }
  const row = await assignmentTeacher.createAssignment(req.userId, payload, req.file || null);
  return success(res, row, 201);
});

export const uploadRequirementsFile = asyncHandler(async (req, res) => {
  const row = await assignmentTeacher.attachRequirementsFile(req.userId, req.params.id, req.file || null);
  return success(res, row);
});

export const updateAssignment = asyncHandler(async (req, res) => {
  const row = await assignmentTeacher.updateAssignment(req.userId, req.params.id, req.body);
  return success(res, row);
});

export const deleteAssignment = asyncHandler(async (req, res) => {
  const row = await assignmentTeacher.softDeleteAssignmentForTeacher(req.userId, req.params.id);
  return success(res, row);
});

export const listProposals = asyncHandler(async (req, res) => {
  const data = await proposalWorkflow.listProposalsForTeacher(req.userId, req.params.assignmentId || null);
  return success(res, data);
});

export const listNormalSubmissions = asyncHandler(async (req, res) => {
  try {
    const data = await normalAssignmentSubmission.listNormalSubmissionsForTeacher(
      req.userId,
      req.params.assignmentId
    );
    return success(res, data);
  } catch (e) {
    const status = e.status || 500;
    return fail(res, e.message || 'Failed to load submissions', status);
  }
});

export const getNormalSubmissionStudentDetail = asyncHandler(async (req, res) => {
  try {
    const data = await normalAssignmentSubmission.getNormalSubmissionStudentDetailForTeacher(
      req.userId,
      req.params.assignmentId,
      req.params.studentUserId
    );
    return success(res, data);
  } catch (e) {
    const status = e.status || 500;
    return fail(res, e.message || 'Failed to load submission detail', status);
  }
});

export const reviewProposal = asyncHandler(async (req, res) => {
  const p = await proposalWorkflow.teacherReviewProposal(req.userId, req.params.proposalId, req.body);
  return success(res, p);
});

export const listGroups = asyncHandler(async (req, res) => {
  const data = await assignmentTeacher.listGroupsForAssignment(req.userId, req.params.assignmentId);
  return success(res, data);
});

export const createGroup = asyncHandler(async (req, res) => {
  const data = await assignmentTeacher.createGroupForAssignment(req.userId, req.params.assignmentId, req.body);
  return success(res, data, 201);
});

export const listAllGroups = asyncHandler(async (req, res) => {
  const data = await assignmentTeacher.listAllGroupsForTeacher(req.userId);
  return success(res, data);
});

export const getGroupDetails = asyncHandler(async (req, res) => {
  const data = await assignmentTeacher.getGroupDetailsForTeacher(req.userId, req.params.id);
  if (!data) return fail(res, 'Group not found', 404);
  return success(res, data);
});

export const deleteGroup = asyncHandler(async (req, res) => {
  try {
    const data = await teacherClassGroups.deleteGroupForTeacher(req.userId, req.params.id);
    return success(res, data);
  } catch (e) {
    return fail(res, e.message || 'Failed to delete group', e.status || 500);
  }
});

export const listClassStudents = asyncHandler(async (req, res) => {
  try {
    const data = await teacherClassGroups.listClassStudentsForTeacher(req.userId, req.params.classRef);
    return success(res, data);
  } catch (e) {
    return fail(res, e.message || 'Failed to load students', e.status || 500);
  }
});

export const getClassStudentDetail = asyncHandler(async (req, res) => {
  try {
    const data = await teacherClassGroups.getClassStudentDetailForTeacher(
      req.userId,
      req.params.classRef,
      req.params.studentUserId,
    );
    return success(res, data);
  } catch (e) {
    return fail(res, e.message || 'Failed to load student', e.status || 500);
  }
});

export const listClassGroupsDisplay = asyncHandler(async (req, res) => {
  try {
    const data = await teacherClassGroups.listGroupsDisplayForClass(req.userId, req.params.classRef);
    return success(res, data);
  } catch (e) {
    return fail(res, e.message || 'Failed to load groups', e.status || 500);
  }
});

export const getClassTemplateGroupsEditor = asyncHandler(async (req, res) => {
  try {
    const data = await teacherClassGroups.getClassTemplateGroupsEditor(
      req.userId,
      req.params.classRef,
    );
    return success(res, data);
  } catch (e) {
    return fail(res, e.message || 'Failed to load editable class teams', e.status || 500);
  }
});

export const listClassGroupAssignments = asyncHandler(async (req, res) => {
  try {
    const data = await teacherClassGroups.listGroupAssignmentsForClass(req.userId, req.params.classRef);
    return success(res, data);
  } catch (e) {
    return fail(res, e.message || 'Failed to load assignments', e.status || 500);
  }
});

export const generateClassGroups = asyncHandler(async (req, res) => {
  try {
    const data = await teacherClassGroups.generateGroupsForClassRoute(req.userId, req.params.classRef, req.body);
    return success(res, data);
  } catch (e) {
    return fail(res, e.message || 'Failed to generate groups', e.status || 500);
  }
});

export const generateClassTemplateGroups = asyncHandler(async (req, res) => {
  try {
    const data = await teacherClassGroups.autoGenerateClassTemplateGroups(req.userId, req.params.classRef, req.body);
    return success(res, data);
  } catch (e) {
    return fail(res, e.message || 'Failed to generate class teams', e.status || 500);
  }
});

export const exportClassTemplateGroupsCsv = asyncHandler(async (req, res) => {
  try {
    const fmt = String(req.query.format || 'csv').toLowerCase();
    if (fmt === 'xlsx') {
      const { filename, xlsxBase64 } = await teacherClassGroups.exportClassTemplatesXlsx(
        req.userId,
        req.params.classRef
      );
      return success(res, { filename, xlsxBase64 });
    }
    const { filename, csv } = await teacherClassGroups.exportClassTemplatesCsv(req.userId, req.params.classRef);
    return success(res, { filename, csv });
  } catch (e) {
    return fail(res, e.message || 'Export failed', e.status || 500);
  }
});

export const importClassTemplateGroupsCsv = asyncHandler(async (req, res) => {
  try {
    const body = req.body || {};
    let data;
    if (body.xlsxBase64) {
      const buf = Buffer.from(String(body.xlsxBase64), 'base64');
      data = await teacherClassGroups.importClassTemplatesFromXlsxBuffer(req.userId, req.params.classRef, buf);
    } else {
      data = await teacherClassGroups.importClassTemplatesFromCsv(req.userId, req.params.classRef, body.csv);
    }
    return success(res, data);
  } catch (e) {
    return fail(res, e.message || 'Import failed', e.status || 500);
  }
});

export const previewClassTemplateGroups = asyncHandler(async (req, res) => {
  try {
    const body = req.body || {};
    let data;
    if (body.xlsxBase64) {
      const buf = Buffer.from(String(body.xlsxBase64), 'base64');
      data = await teacherClassGroups.previewClassTemplatesFromXlsxBuffer(req.userId, req.params.classRef, buf);
    } else {
      data = await teacherClassGroups.previewClassTemplatesFromCsv(req.userId, req.params.classRef, body.csv);
    }
    return success(res, data);
  } catch (e) {
    return fail(res, e.message || 'Preview failed', e.status || 500);
  }
});

export const commitClassTemplateGroups = asyncHandler(async (req, res) => {
  try {
    const { proposedGroups } = req.body || {};
    if (!Array.isArray(proposedGroups)) {
      return fail(res, 'Body must include proposedGroups (array)', 400);
    }
    const data = await teacherClassGroups.commitClassTemplateProposals(
      req.userId,
      req.params.classRef,
      proposedGroups,
    );
    return success(res, data);
  } catch (e) {
    return fail(res, e.message || 'Commit failed', e.status || 500);
  }
});

export const exportAssignmentGroupsCsv = asyncHandler(async (req, res) => {
  try {
    const fmt = String(req.query.format || 'csv').toLowerCase();
    if (fmt === 'xlsx') {
      const { filename, xlsxBase64 } = await teacherClassGroups.exportGroupsXlsxForAssignment(
        req.userId,
        req.params.assignmentId
      );
      return success(res, { filename, xlsxBase64 });
    }
    const { filename, csv } = await teacherClassGroups.exportGroupsCsvForAssignment(
      req.userId,
      req.params.assignmentId
    );
    return success(res, { filename, csv });
  } catch (e) {
    return fail(res, e.message || 'Export failed', e.status || 500);
  }
});

export const importAssignmentGroupsCsv = asyncHandler(async (req, res) => {
  try {
    const body = req.body || {};
    let data;
    if (body.xlsxBase64) {
      const buf = Buffer.from(String(body.xlsxBase64), 'base64');
      data = await teacherClassGroups.importGroupsFromXlsxBufferForAssignment(
        req.userId,
        req.params.assignmentId,
        buf
      );
    } else {
      data = await teacherClassGroups.importGroupsFromCsvForAssignment(
        req.userId,
        req.params.assignmentId,
        body.csv
      );
    }
    return success(res, data);
  } catch (e) {
    return fail(res, e.message || 'Import failed', e.status || 500);
  }
});

