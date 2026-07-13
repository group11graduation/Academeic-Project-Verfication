import api, { PREVIEW_TIMEOUT_MS } from '../lib/api';

const base = '/teacher';

const enc = (id) => encodeURIComponent(id);

/** Encode binary file for JSON import body (Excel). */
function arrayBufferToBase64(buffer) {
    const bytes = new Uint8Array(buffer);
    let binary = '';
    const chunk = 0x8000;
    for (let i = 0; i < bytes.length; i += chunk) {
        binary += String.fromCharCode.apply(null, bytes.subarray(i, i + chunk));
    }
    return btoa(binary);
}

function downloadXlsxFromBase64(filename, xlsxBase64) {
    const bin = atob(xlsxBase64);
    const out = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i += 1) out[i] = bin.charCodeAt(i);
    const blob = new Blob([out], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename && filename.endsWith('.xlsx') ? filename : `${filename || 'groups'}.xlsx`;
    a.click();
    URL.revokeObjectURL(url);
}

const getDashboardStats = async () => {
    const response = await api.get(`${base}/dashboard/stats`);
    return response.data;
};

const getCatalog = async () => {
    const response = await api.get(`${base}/catalog`);
    return response.data;
};

const getMyClasses = async () => {
    const response = await api.get(`${base}/classes`);
    return response.data;
};

const getMySubjects = async () => {
    const response = await api.get(`${base}/subjects`);
    return response.data;
};

const getClassDetails = async (classId) => {
    const response = await api.get(`${base}/classes/${enc(classId)}`);
    return response.data;
};

const getClassStudents = async (classId) => {
    const response = await api.get(`${base}/classes/${enc(classId)}/students`);
    return response.data;
};

const getClassStudentDetail = async (classId, studentUserId) => {
    const response = await api.get(
        `${base}/classes/${enc(classId)}/students/${enc(studentUserId)}`,
    );
    return response.data;
};

const getGroups = async (classId) => {
    const response = await api.get(`${base}/classes/${enc(classId)}/groups`);
    return response.data;
};

const getGroupAssignmentsForClass = async (classId) => {
    const response = await api.get(`${base}/classes/${enc(classId)}/group-assignments`);
    return response.data;
};

const generateGroups = async (classId, config) => {
    const response = await api.post(`${base}/classes/${enc(classId)}/groups/generate`, config);
    return response.data;
};

/** Class-level teams before any assignment exists */
const generateClassTemplateGroups = async (classId, config) => {
    const response = await api.post(`${base}/classes/${enc(classId)}/class-groups/generate`, config);
    return response.data;
};

const exportClassTemplateGroups = async (classId, format = 'csv') => {
    const response = await api.get(`${base}/classes/${enc(classId)}/class-groups/export`, {
        params: format === 'xlsx' ? { format: 'xlsx' } : {},
    });
    return response.data;
};

const importClassTemplateGroups = async (classId, body) => {
    const response = await api.post(`${base}/classes/${enc(classId)}/class-groups/import`, body);
    return response.data;
};

const previewClassTemplateGroups = async (classId, body) => {
    const response = await api.post(`${base}/classes/${enc(classId)}/class-groups/import-preview`, body);
    return response.data;
};

const commitClassTemplateGroups = async (classId, proposedGroups) => {
    const response = await api.post(`${base}/classes/${enc(classId)}/class-groups/import-commit`, {
        proposedGroups,
    });
    return response.data;
};

const exportClassTemplateGroupsCsv = (classId) => exportClassTemplateGroups(classId, 'csv');

const importClassTemplateGroupsCsv = (classId, csv) => importClassTemplateGroups(classId, { csv });

const exportGroups = async (assignmentId, format = 'csv') => {
    const response = await api.get(`${base}/assignments/${enc(assignmentId)}/groups/export`, {
        params: format === 'xlsx' ? { format: 'xlsx' } : {},
    });
    return response.data;
};

const importGroups = async (assignmentId, body) => {
    const response = await api.post(`${base}/assignments/${enc(assignmentId)}/groups/import`, body);
    return response.data;
};

const exportGroupsCsv = (assignmentId) => exportGroups(assignmentId, 'csv');

const importGroupsCsv = (assignmentId, csv) => importGroups(assignmentId, { csv });

const getAllGroups = async () => {
    const response = await api.get(`${base}/groups`);
    return response.data;
};

const teacherService = {
    getDashboardStats,
    getCatalog,
    getMyClasses,
    getMySubjects,
    getClassDetails,
    getClassStudents,
    getClassStudentDetail,
    getGroups,
    getGroupAssignmentsForClass,
    generateGroups,
    generateClassTemplateGroups,
    exportClassTemplateGroups,
    importClassTemplateGroups,
    previewClassTemplateGroups,
    commitClassTemplateGroups,
    exportClassTemplateGroupsCsv,
    importClassTemplateGroupsCsv,
    exportGroups,
    importGroups,
    exportGroupsCsv,
    importGroupsCsv,
    arrayBufferToBase64,
    downloadXlsxFromBase64,
    getAllGroups,
    getGroupDetails: async (id) => {
        const response = await api.get(`${base}/groups/${id}`);
        return response.data;
    },

    createAssignment: async (formData) => {
        const response = await api.post(`${base}/assignments`, formData, {
            headers: { 'Content-Type': 'multipart/form-data' }
        });
        return response.data;
    },

    /** JSON body — preferred for orchestration API */
    createAssignmentJson: async (body) => {
        const response = await api.post(`${base}/assignments`, body);
        return response.data;
    },

    getAcceptedCollaborators: async () => {
        const response = await api.get(`${base}/collaborations/accepted`);
        return response.data;
    },

    getCollaborations: async () => {
        const response = await api.get(`${base}/collaborations`);
        return response.data;
    },

    getCollaborationCandidates: async (params = {}) => {
        const response = await api.get(`${base}/collaborations/teachers`, { params });
        return response.data;
    },

    getCollaborationPendingCount: async () => {
        const response = await api.get(`${base}/collaborations/pending-count`);
        return response.data;
    },

    requestCollaboration: async (body) => {
        const response = await api.post(`${base}/collaborations/request`, body);
        return response.data;
    },

    respondToCollaboration: async (collaborationId, action) => {
        const response = await api.patch(`${base}/collaborations/${encodeURIComponent(collaborationId)}/respond`, {
            action,
        });
        return response.data;
    },

    createCollaborativeAssignment: async (body) => {
        const response = await api.post(`${base}/assignments/collaborative`, body);
        return response.data;
    },

    listCollaborativeDrafts: async () => {
        const response = await api.get(`${base}/assignments/collaborative/drafts`);
        return response.data;
    },

    getCollaborativeDraft: async (draftId) => {
        const response = await api.get(`${base}/assignments/collaborative/drafts/${encodeURIComponent(draftId)}`);
        return response.data;
    },

    createCollaborativeDraft: async (body) => {
        const response = await api.post(`${base}/assignments/collaborative/drafts`, body);
        return response.data;
    },

    updateCollaborativeDraft: async (draftId, body) => {
        const response = await api.patch(`${base}/assignments/collaborative/drafts/${encodeURIComponent(draftId)}`, body);
        return response.data;
    },

    uploadCollaborativeDraftSectionFile: async (draftId, section, file) => {
        const fd = new FormData();
        fd.append('requirementsFile', file);
        fd.append('section', section);
        const response = await api.post(
            `${base}/assignments/collaborative/drafts/${encodeURIComponent(draftId)}/requirements-file`,
            fd,
            { headers: { 'Content-Type': 'multipart/form-data' } }
        );
        return response.data;
    },

    publishCollaborativeDraft: async (draftId) => {
        const response = await api.post(`${base}/assignments/collaborative/drafts/${encodeURIComponent(draftId)}/publish`);
        return response.data;
    },

    deleteCollaborativeDraft: async (draftId) => {
        const response = await api.delete(`${base}/assignments/collaborative/drafts/${encodeURIComponent(draftId)}`);
        return response.data;
    },

    getMyAssignments: async (semesterId) => {
        const response = await api.get(`${base}/assignments`, {
            params: semesterId ? { semesterId } : undefined
        });
        return response.data;
    },

    getAssignmentById: async (id) => {
        const response = await api.get(`${base}/assignments/${id}`);
        return response.data;
    },

    updateAssignment: async (id, body) => {
        const response = await api.patch(`${base}/assignments/${id}`, body);
        return response.data;
    },

    uploadAssignmentRequirements: async (assignmentId, file) => {
        const fd = new FormData();
        fd.append('requirementsFile', file);
        const response = await api.post(`${base}/assignments/${assignmentId}/requirements-file`, fd, {
            headers: { 'Content-Type': 'multipart/form-data' }
        });
        return response.data;
    },

    getProposalsForAssignment: async (assignmentId) => {
        const response = await api.get(`${base}/assignments/${assignmentId}/proposals`);
        return response.data;
    },

    /** Normal (file-upload) assignment: per-student latest file + plagiarism vs peers on same assignment */
    getNormalSubmissionsForAssignment: async (assignmentId) => {
        const response = await api.get(`${base}/assignments/${assignmentId}/normal-submissions`);
        return response.data;
    },

    getNormalSubmissionStudentDetail: async (assignmentId, studentUserId) => {
        const response = await api.get(
            `${base}/assignments/${assignmentId}/normal-submissions/student/${encodeURIComponent(studentUserId)}`
        );
        return response.data;
    },

    reviewProposal: async (proposalId, payload) => {
        const response = await api.patch(`${base}/proposals/${proposalId}/review`, payload);
        return response.data;
    },

    listGroupsForAssignment: async (assignmentId) => {
        const response = await api.get(`${base}/assignments/${assignmentId}/groups`);
        return response.data;
    },

    createGroup: async (assignmentId, body) => {
        const response = await api.post(`${base}/assignments/${assignmentId}/groups`, body);
        return response.data;
    },

    deleteAssignment: async (id) => {
        const response = await api.delete(`${base}/assignments/${id}`);
        return response.data;
    },

    submitAssignment: async (id, formData) => {
        const response = await api.post(`${base}/assignments/${id}/submit`, formData, {
            headers: { 'Content-Type': 'multipart/form-data' }
        });
        return response.data;
    },

    startProposalPreview: async (proposalId, options = {}) => {
        const opts = typeof options === 'string' ? {} : options || {};
        const body = {};
        if (opts.adminEmail) body.adminEmail = opts.adminEmail;
        if (opts.adminPassword) body.adminPassword = opts.adminPassword;
        const response = await api.post(`${base}/proposals/${proposalId}/preview/start`, body, {
            timeout: PREVIEW_TIMEOUT_MS,
        });
        return response.data;
    },

    stopPreviewSession: async (sessionId) => {
        const response = await api.post(`${base}/preview-sessions/${sessionId}/stop`);
        return response.data;
    },

    getPreviewSession: async (sessionId) => {
        const response = await api.get(`${base}/preview-sessions/${sessionId}`);
        return response.data;
    },

    getActiveProposalPreview: async (proposalId) => {
        const response = await api.get(`${base}/proposals/${proposalId}/preview/session`);
        return response.data;
    },

    listStudentMessages: async ({ status, assignmentId } = {}) => {
        const params = {};
        if (status) params.status = status;
        if (assignmentId) params.assignmentId = assignmentId;
        const response = await api.get(`${base}/messages`, { params });
        return response.data;
    },

    getStudentMessagesOpenCount: async () => {
        const response = await api.get(`${base}/messages/open-count`);
        return response.data;
    },

    replyStudentMessage: async (messageId, { reply, close }) => {
        const response = await api.patch(`${base}/messages/${messageId}/reply`, { reply, close });
        return response.data;
    },
};

export default teacherService;
