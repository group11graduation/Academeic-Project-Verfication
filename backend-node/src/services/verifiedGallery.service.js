import { Proposal } from '../models/Proposal.js';
import { ProjectSubmission } from '../models/ProjectSubmission.js';

const CATEGORY_RULES = [
  { id: 'WEB DEVELOPMENT', keys: ['react', 'vue', 'angular', 'html', 'css', 'javascript', 'node', 'express', 'laravel', 'php', 'next', 'django', 'flask', 'web'] },
  { id: 'ARTIFICIAL INTELLIGENCE', keys: ['ai', 'ml', 'tensorflow', 'pytorch', 'neural', 'deep learning', 'opencv', 'nlp', 'machine learning'] },
  { id: 'DATA SCIENCE', keys: ['data', 'analytics', 'pandas', 'numpy', 'r ', 'statistics', 'visualization', 'd3'] },
  { id: 'MOBILE APPS', keys: ['flutter', 'android', 'ios', 'react native', 'kotlin', 'swift', 'mobile'] },
  { id: 'CYBERSECURITY', keys: ['security', 'crypto', 'encryption', 'vault', 'firewall', 'penetration'] },
  { id: 'BLOCKCHAIN', keys: ['blockchain', 'ethereum', 'solidity', 'web3', 'smart contract'] },
  { id: 'IOT', keys: ['iot', 'sensor', 'arduino', 'esp32', 'mqtt', 'embedded', 'raspberry'] },
];

function inferCategory(assignment, proposal) {
  const parts = [
    assignment?.title,
    assignment?.description,
    proposal?.title,
    proposal?.description,
    ...(proposal?.features || []),
    ...(assignment?.allowedTechnologies || []),
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();

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

function toPublicUrl(relativePath) {
  if (!relativePath) return null;
  const normalized = String(relativePath).replace(/\\/g, '/');
  return `/uploads/${normalized}`;
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
    approvedAt: proposal.updatedAt || proposal.submittedAt,
    featuredRank: (teacherScore ?? 0) + (submission?.screenshotRelativePath ? 10 : 0) + (submission ? 5 : 0),
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
    rows = rows.filter((r) => r.category === category);
  }

  if (sort === 'recent') {
    rows.sort((a, b) => new Date(b.approvedAt) - new Date(a.approvedAt));
  } else {
    rows.sort((a, b) => b.featuredRank - a.featuredRank || (b.teacherScore ?? 0) - (a.teacherScore ?? 0));
  }

  return rows.slice(0, Math.min(Number(limit) || 48, 100));
}

export async function getVerifiedProjectById(proposalId) {
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

export function listGalleryCategories() {
  return ['ALL CATEGORIES', ...CATEGORY_RULES.map((r) => r.id), 'GENERAL'];
}
