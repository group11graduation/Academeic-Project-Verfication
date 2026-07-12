import { Proposal } from '../models/Proposal.js';
import { ProjectSubmission } from '../models/ProjectSubmission.js';
import { LegacyProject } from '../models/LegacyProject.js';
import { Assignment } from '../models/Assignment.js';

const WEB_DEVELOPMENT_CATEGORY = 'WEB DEVELOPMENT';
const HTML_CSS_CATEGORY = 'HTML & CSS';
const HTML_CSS_JS_CATEGORY = 'HTML & CSS WITH JAVASCRIPT';
const REACT_CATEGORY = 'REACT';
const PHP_CATEGORY = 'PHP';

const WEB_DEVELOPMENT_KEYS = [
  'vue',
  'angular',
  'html',
  'css',
  'javascript',
  'node',
  'express',
  'next',
  'django',
  'flask',
  'web',
  'bootstrap',
  'tailwind',
  'sass',
  'scss',
  'typescript',
  'vite',
  'webpack',
  'jquery',
  'frontend',
  'fullstack',
  'full-stack',
];

const CATEGORY_RULES = [
  { id: WEB_DEVELOPMENT_CATEGORY, keys: WEB_DEVELOPMENT_KEYS },
  { id: 'ARTIFICIAL INTELLIGENCE', keys: ['ai', 'ml', 'tensorflow', 'pytorch', 'neural', 'deep learning', 'opencv', 'nlp', 'machine learning'] },
  { id: 'DATA SCIENCE', keys: ['data', 'analytics', 'pandas', 'numpy', 'r ', 'statistics', 'visualization', 'd3'] },
  { id: 'MOBILE APPS', keys: ['flutter', 'android', 'ios', 'react native', 'kotlin', 'swift', 'mobile'] },
  { id: 'CYBERSECURITY', keys: ['security', 'crypto', 'encryption', 'vault', 'firewall', 'penetration'] },
  { id: 'BLOCKCHAIN', keys: ['blockchain', 'ethereum', 'solidity', 'web3', 'smart contract'] },
  { id: 'IOT', keys: ['iot', 'sensor', 'arduino', 'esp32', 'mqtt', 'embedded', 'raspberry'] },
];

export const GALLERY_FILTER_CATEGORIES = [
  'ALL CATEGORIES',
  WEB_DEVELOPMENT_CATEGORY,
  REACT_CATEGORY,
  PHP_CATEGORY,
  HTML_CSS_CATEGORY,
  HTML_CSS_JS_CATEGORY,
];

function inferStackCategory(text) {
  const t = String(text || '').toLowerCase();
  const hasReact =
    /\breact\b|reactjs|react\.js|react native|next\.js|nextjs|\bjsx\b|\bredux\b/.test(t) ||
    (/\bvite\b/.test(t) && /\breact\b/.test(t));
  const hasPhp = /\bphp\b|laravel|codeigniter|symfony|cakephp|wordpress/.test(t);

  if (hasReact) return REACT_CATEGORY;
  if (hasPhp) return PHP_CATEGORY;
  return null;
}

function inferWebSubcategory(text) {
  const t = String(text || '').toLowerCase();
  const hasHtml = /\bhtml\b|html5|html\s*&\s*css/.test(t);
  const hasCss = /\bcss\b|css3|html\s*&\s*css/.test(t);
  const hasJs =
    /\bjavascript\b/.test(t) ||
    /\bjs\b/.test(t) ||
    /vanilla\s+(js|javascript)/.test(t) ||
    /\becmascript\b/.test(t) ||
    /html\s*&\s*css\s+with\s+javascript/.test(t);

  if (hasHtml && hasCss && hasJs) return HTML_CSS_JS_CATEGORY;
  if (hasHtml && hasCss) return HTML_CSS_CATEGORY;
  return null;
}

function categoryMatchesFilter(projectCategory, filterCategory) {
  if (!filterCategory || filterCategory === 'ALL CATEGORIES' || filterCategory === 'ALL') return true;
  if (filterCategory === WEB_DEVELOPMENT_CATEGORY) {
    return [
      WEB_DEVELOPMENT_CATEGORY,
      REACT_CATEGORY,
      PHP_CATEGORY,
      HTML_CSS_CATEGORY,
      HTML_CSS_JS_CATEGORY,
    ].includes(projectCategory);
  }
  return projectCategory === filterCategory;
}

function inferCategory(assignment, proposal) {
  const parts = [
    assignment?.title,
    assignment?.description,
    assignment?.requirementText,
    proposal?.title,
    proposal?.description,
    ...(proposal?.features || []),
    ...(assignment?.allowedTechnologies || []),
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();

  const stackCategory = inferStackCategory(parts);
  if (stackCategory) return stackCategory;

  const webSubcategory = inferWebSubcategory(parts);
  if (webSubcategory) return webSubcategory;

  for (const rule of CATEGORY_RULES) {
    if (rule.keys.some((k) => parts.includes(k))) return rule.id;
  }
  return 'GENERAL';
}

function buildTags(assignment, proposal) {
  const fromTech = (assignment?.allowedTechnologies || []).slice(0, 4);
  const fromFeatures = (proposal?.features || []).slice(0, 3);
  const merged = [...fromTech, ...fromFeatures].map((t) => String(t).trim()).filter(Boolean);
  return [...new Set(merged)].slice(0, 5).map((t) => t.toUpperCase());
}

export function toPublicUrl(relativePath) {
  if (!relativePath) return null;
  const normalized = String(relativePath).replace(/\\/g, '/');
  if (normalized.startsWith('http://') || normalized.startsWith('https://') || normalized.startsWith('/uploads/')) {
    return normalized;
  }
  return `/uploads/${normalized}`;
}

function screenshotUrlsFromPaths(paths) {
  return (Array.isArray(paths) ? paths : [])
    .map((p) => toPublicUrl(p))
    .filter(Boolean);
}

async function latestSubmissionsByProposal(proposalIds) {
  if (!proposalIds.length) return new Map();
  const rows = await ProjectSubmission.find({ proposal: { $in: proposalIds } })
    .sort({ createdAt: -1 })
    .select('proposal screenshotRelativePath originalFilename version createdAt')
    .lean();
  const map = new Map();
  for (const row of rows) {
    const key = String(row.proposal);
    if (!map.has(key)) map.set(key, row);
  }
  return map;
}

function mapGalleryRow(proposal, submission) {
  const assignment = proposal.assignment || {};
  const subject = assignment.subject || {};
  const author = proposal.submittedBy || {};
  const teacherScore = proposal.teacherProposalScore ?? null;

  return {
    id: String(proposal._id),
    title: proposal.title,
    description: proposal.description || assignment.description || '',
    author: author.name || 'Student',
    category: inferCategory(assignment, proposal),
    tags: buildTags(assignment, proposal),
    subject: subject.name || '',
    subjectCode: subject.code || '',
    teacherScore,
    hasProjectSubmission: Boolean(submission),
    screenshotUrl: submission?.screenshotRelativePath ? toPublicUrl(submission.screenshotRelativePath) : null,
    screenshotUrls: submission?.screenshotRelativePath
      ? [toPublicUrl(submission.screenshotRelativePath)]
      : [],
    approvedAt: proposal.updatedAt || proposal.submittedAt,
    featuredRank: (teacherScore ?? 0) + (submission?.screenshotRelativePath ? 10 : 0) + (submission ? 5 : 0),
  };
}

function mapLegacyGalleryRow(legacy) {
  const screenshotUrls = screenshotUrlsFromPaths(legacy.screenshots);
  return {
    id: `legacy-${legacy._id}`,
    kind: 'legacy',
    title: legacy.title,
    description: legacy.proposalDescription || '',
    author: legacy.ownerLabel || 'Previous cohort',
    category: 'GENERAL',
    tags: (legacy.features || []).slice(0, 5).map((t) => String(t).trim().toUpperCase()).filter(Boolean),
    subject: '',
    subjectCode: '',
    teacherScore: null,
    hasProjectSubmission: screenshotUrls.length > 0,
    screenshotUrl: screenshotUrls[0] || null,
    screenshotUrls,
    features: legacy.features || [],
    approvedAt: legacy.approvedAt || legacy.createdAt,
    featuredRank: screenshotUrls.length ? 5 : 0,
    inVerifiedGallery: true,
  };
}

/**
 * Best teacher-approved capstone/final projects for the public verified gallery.
 */
export async function listVerifiedProjects({ category, sort = 'best', limit = 48 } = {}) {
  const proposals = await Proposal.find({ status: 'teacher_approved' })
    .populate('submittedBy', 'name')
    .populate({
      path: 'assignment',
      select: 'title description allowedTechnologies assignmentType subject',
      populate: { path: 'subject', select: 'name code' },
    })
    .sort({ teacherProposalScore: -1, updatedAt: -1 })
    .limit(Math.min(Number(limit) * 3, 150))
    .lean();

  const finalOrSubmitted = proposals.filter((p) => {
    const type = String(p.assignment?.assignmentType || '').toLowerCase();
    const isFinal = type === 'final';
    const score = p.teacherProposalScore;
    return isFinal || (score != null && score >= 60);
  });

  const subMap = await latestSubmissionsByProposal(finalOrSubmitted.map((p) => p._id));

  let rows = finalOrSubmitted
    .map((p) => mapGalleryRow(p, subMap.get(String(p._id))))
    .filter((r) => r.description || r.hasProjectSubmission);

  if (category && category !== 'ALL CATEGORIES' && category !== 'ALL') {
    rows = rows.filter((r) => categoryMatchesFilter(r.category, category));
  }

  if (sort === 'recent') {
    rows.sort((a, b) => new Date(b.approvedAt) - new Date(a.approvedAt));
  } else {
    rows.sort((a, b) => b.featuredRank - a.featuredRank || (b.teacherScore ?? 0) - (a.teacherScore ?? 0));
  }

  return rows.slice(0, Math.min(Number(limit) || 48, 100));
}

export async function getVerifiedProjectById(proposalId) {
  const idStr = String(proposalId || '').trim();
  if (idStr.startsWith('legacy-')) {
    const legacy = await LegacyProject.findById(idStr.slice(7)).lean();
    if (!legacy) return null;
    return mapLegacyGalleryRow(legacy);
  }

  const proposal = await Proposal.findOne({ _id: proposalId, status: 'teacher_approved' })
    .populate('submittedBy', 'name email')
    .populate({
      path: 'assignment',
      select: 'title description allowedTechnologies requirementText assignmentType subject class',
      populate: [{ path: 'subject', select: 'name code' }, { path: 'class', select: 'name code' }],
    })
    .lean();

  if (!proposal) return null;

  const submission = await ProjectSubmission.findOne({ proposal: proposal._id })
    .sort({ createdAt: -1 })
    .lean();

  const base = mapGalleryRow(proposal, submission);

  return {
    ...base,
    kind: 'verified',
    inVerifiedGallery: true,
    features: proposal.features || [],
    requirementText: proposal.assignment?.requirementText || '',
    assignmentTitle: proposal.assignment?.title || '',
    className: proposal.assignment?.class?.name || proposal.assignment?.class?.code || '',
    submission: submission
      ? {
          version: submission.version,
          originalFilename: submission.originalFilename,
          uploadedAt: submission.createdAt,
        }
      : null,
  };
}

/**
 * Linked verified / legacy project shown when AI flags previous-semester similarity.
 */
function titleOverlapScore(a = '', b = '') {
  const wordsA = new Set(
    String(a)
      .toLowerCase()
      .split(/[^a-z0-9]+/)
      .filter((w) => w.length > 2)
  );
  const wordsB = new Set(
    String(b)
      .toLowerCase()
      .split(/[^a-z0-9]+/)
      .filter((w) => w.length > 2)
  );
  if (!wordsA.size || !wordsB.size) return 0;
  let shared = 0;
  for (const w of wordsA) {
    if (wordsB.has(w)) shared += 1;
  }
  return shared / Math.max(wordsA.size, wordsB.size);
}

async function resolveFromMatchedKey(matchedKey, similarityPercent) {
  const key = String(matchedKey || '').trim();
  if (!key) return null;

  if (key.startsWith('legacy:')) {
    const legacyId = key.slice(7);
    const legacy = await LegacyProject.findById(legacyId).lean();
    if (!legacy) return null;
    const gallery = mapLegacyGalleryRow(legacy);
    return { ...gallery, similarityPercent, galleryPath: `/gallery/${gallery.id}` };
  }

  if (key.startsWith('proposal:')) {
    const proposalId = key.slice(9);
    const gallery = await getVerifiedProjectById(proposalId);
    if (gallery) {
      return { ...gallery, similarityPercent, galleryPath: `/gallery/${gallery.id}` };
    }
    const prev = await Proposal.findById(proposalId).populate('submittedBy', 'name').lean();
    if (!prev) return null;
    const submission = await ProjectSubmission.findOne({ proposal: prev._id })
      .sort({ createdAt: -1 })
      .select('screenshotRelativePath')
      .lean();
    const screenshotUrls = submission?.screenshotRelativePath
      ? [toPublicUrl(submission.screenshotRelativePath)]
      : [];
    return {
      id: String(prev._id),
      kind: 'proposal',
      inVerifiedGallery: prev.status === 'teacher_approved',
      title: prev.title,
      description: prev.description || '',
      features: prev.features || [],
      author: prev.submittedBy?.name || 'Student',
      category: 'GENERAL',
      tags: [],
      screenshotUrl: screenshotUrls[0] || null,
      screenshotUrls,
      similarityPercent,
      galleryPath: prev.status === 'teacher_approved' ? `/gallery/${prev._id}` : null,
    };
  }

  return null;
}

async function findFallbackSimilarProject(proposal, similarityPercent) {
  const assignment = await Assignment.findById(proposal.assignment)
    .select('subject semester academicYear')
    .lean();
  if (!assignment?.subject) return null;

  const otherAssignmentIds = await Assignment.find({
    subject: assignment.subject,
    $or: [
      { semester: { $ne: assignment.semester } },
      { academicYear: { $ne: assignment.academicYear } },
    ],
  }).distinct('_id');

  if (otherAssignmentIds.length) {
    const approved = await Proposal.find({
      assignment: { $in: otherAssignmentIds },
      status: 'teacher_approved',
      _id: { $ne: proposal._id },
    })
      .select('_id title')
      .limit(40)
      .lean();

    let best = null;
    let bestScore = 0;
    for (const row of approved) {
      const score = titleOverlapScore(proposal.title, row.title);
      if (score > bestScore) {
        bestScore = score;
        best = row;
      }
    }
    if (best && bestScore >= 0.25) {
      const fromKey = await resolveFromMatchedKey(`proposal:${best._id}`, similarityPercent);
      if (fromKey) return fromKey;
    }
  }

  const legacyRows = await LegacyProject.find({ subject: assignment.subject }).select('_id title').limit(20).lean();
  let bestLegacy = null;
  let bestLegacyScore = 0;
  for (const row of legacyRows) {
    const score = titleOverlapScore(proposal.title, row.title);
    if (score > bestLegacyScore) {
      bestLegacyScore = score;
      bestLegacy = row;
    }
  }
  if (bestLegacy && bestLegacyScore >= 0.2) {
    return resolveFromMatchedKey(`legacy:${bestLegacy._id}`, similarityPercent);
  }

  return null;
}

export async function resolveSimilarMatchedProject(proposal) {
  if (!proposal || proposal.status !== 'ai_flagged_previous_semester') return null;

  const similarityPercent = Math.round(Number(proposal.aiPreviousSemesterMaxScore || 0) * 100);

  if (proposal.aiMatchedProposalId) {
    const gallery = await getVerifiedProjectById(String(proposal.aiMatchedProposalId));
    if (gallery) {
      return {
        ...gallery,
        similarityPercent,
        galleryPath: `/gallery/${gallery.id}`,
      };
    }

    const prev = await Proposal.findById(proposal.aiMatchedProposalId)
      .populate('submittedBy', 'name')
      .lean();
    if (prev) {
      const submission = await ProjectSubmission.findOne({ proposal: prev._id })
        .sort({ createdAt: -1 })
        .select('screenshotRelativePath')
        .lean();
      const screenshotUrls = submission?.screenshotRelativePath
        ? [toPublicUrl(submission.screenshotRelativePath)]
        : [];

      return {
        id: String(prev._id),
        kind: 'proposal',
        inVerifiedGallery: prev.status === 'teacher_approved',
        title: prev.title,
        description: prev.description || '',
        features: prev.features || [],
        author: prev.submittedBy?.name || 'Student',
        category: 'GENERAL',
        tags: [],
        screenshotUrl: screenshotUrls[0] || null,
        screenshotUrls,
        similarityPercent,
        galleryPath: prev.status === 'teacher_approved' ? `/gallery/${prev._id}` : null,
      };
    }
  }

  if (proposal.aiMatchedLegacyId) {
    const legacy = await LegacyProject.findById(proposal.aiMatchedLegacyId).lean();
    if (legacy) {
      const gallery = mapLegacyGalleryRow(legacy);
      return {
        ...gallery,
        similarityPercent,
        galleryPath: `/gallery/${gallery.id}`,
      };
    }
  }

  if (proposal.aiMatchedLegacyKey) {
    const fromKey = await resolveFromMatchedKey(proposal.aiMatchedLegacyKey, similarityPercent);
    if (fromKey) return fromKey;
  }

  return findFallbackSimilarProject(proposal, similarityPercent);
}

export function listGalleryCategories() {
  return [...GALLERY_FILTER_CATEGORIES];
}
