import crypto from 'crypto';
import fs from 'fs/promises';
import path from 'path';
import mongoose from 'mongoose';
import mammoth from 'mammoth';
import { Assignment } from '../models/Assignment.js';
import { NormalAssignmentSubmission } from '../models/NormalAssignmentSubmission.js';
import { StudentProfile } from '../models/StudentProfile.js';
import { User } from '../models/User.js';
import { analyzeCodePayload } from './aiClient.service.js';
import * as assignmentStudent from './assignmentStudent.service.js';
import * as assignmentTeacher from './assignmentTeacher.service.js';

const TEXT_EXTENSIONS = new Set([
  '.txt', '.md', '.json', '.csv', '.ipynb', '.js', '.jsx', '.ts', '.tsx', '.java', '.py', '.c', '.cpp', '.cs', '.go', '.php', '.rb',
]);
const CODE_EXTENSIONS = new Set(['.js', '.jsx', '.ts', '.tsx', '.java', '.py', '.c', '.cpp', '.cs', '.go', '.php', '.rb']);

function extensionToLanguage(ext) {
  if (ext === '.py') return 'python';
  if (ext === '.java') return 'java';
  if (ext === '.js' || ext === '.jsx' || ext === '.ts' || ext === '.tsx') return 'javascript';
  if (ext === '.c' || ext === '.cpp' || ext === '.cs') return 'c';
  if (ext === '.go') return 'go';
  if (ext === '.php') return 'php';
  if (ext === '.rb') return 'ruby';
  return 'python';
}

function jaccardSimilarity(a, b) {
  const ta = new Set(String(a || '').toLowerCase().split(/[^a-z0-9_]+/).filter((x) => x.length > 2));
  const tb = new Set(String(b || '').toLowerCase().split(/[^a-z0-9_]+/).filter((x) => x.length > 2));
  if (!ta.size || !tb.size) return 0;
  let inter = 0;
  for (const t of ta) if (tb.has(t)) inter += 1;
  const union = ta.size + tb.size - inter;
  return union > 0 ? inter / union : 0;
}

async function extractTextFromFile(filePath, ext) {
  if (ext === '.docx') {
    const result = await mammoth.extractRawText({ path: filePath });
    return String(result.value || '').trim();
  }
  if (TEXT_EXTENSIONS.has(ext)) {
    const content = await fs.readFile(filePath, 'utf8');
    return String(content || '').trim();
  }
  return '';
}

export async function submitNormalAssignmentFile(userId, assignmentId, file) {
  if (!file?.path) {
    const err = new Error('No file uploaded');
    err.status = 400;
    throw err;
  }

  // Reuse enrollment/access checks.
  await assignmentStudent.getAssignmentDetailForStudent(userId, assignmentId);

  const assignment = await Assignment.findById(assignmentId).lean();
  if (!assignment) {
    const err = new Error('Assignment not found');
    err.status = 404;
    throw err;
  }
  if (String(assignment.assignmentType || 'normal') !== 'normal') {
    const err = new Error('This upload endpoint is only for normal assignments.');
    err.status = 400;
    throw err;
  }

  const ext = path.extname(file.originalname || file.filename || '').toLowerCase();
  const relDir = path.join('normal-assignment', String(assignmentId), String(userId));
  const uploadsRoot = path.join(process.cwd(), 'uploads');
  const destDir = path.join(uploadsRoot, relDir);
  await fs.mkdir(destDir, { recursive: true });
  const finalName = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}${ext || ''}`;
  const destPath = path.join(destDir, finalName);

  try {
    await fs.rename(file.path, destPath);
  } catch {
    await fs.copyFile(file.path, destPath);
    await fs.unlink(file.path).catch(() => {});
  }

  const [buffer, stat] = await Promise.all([fs.readFile(destPath), fs.stat(destPath)]);
  const contentHash = crypto.createHash('sha256').update(buffer).digest('hex');
  const rawExtracted = (await extractTextFromFile(destPath, ext)).trim();
  const extractCap = ext === '.ipynb' ? 350000 : 20000;
  const extractedText = rawExtracted.slice(0, extractCap);

  const otherSubmissions = await NormalAssignmentSubmission.find({
    assignment: assignmentId,
    submittedBy: { $ne: userId },
  })
    .sort({ createdAt: -1 })
    .limit(40)
    .select('_id contentHash extractedText originalFilename')
    .lean();

  let maxScore = 0;
  let method = 'none';
  let matchedSubmissionId = null;

  const exact = otherSubmissions.find((s) => s.contentHash && s.contentHash === contentHash);
  if (exact) {
    maxScore = 1;
    method = 'exact_hash';
    matchedSubmissionId = exact._id;
  } else if (extractedText.length > 40 && otherSubmissions.length > 0) {
    if (CODE_EXTENSIONS.has(ext)) {
      try {
        const references = otherSubmissions
          .filter((s) => String(s.extractedText || '').trim().length > 40)
          .slice(0, 25)
          .map((s) => ({
            id: String(s._id),
            text: s.extractedText,
            language: extensionToLanguage(ext),
          }));
        if (references.length > 0) {
          const ai = await analyzeCodePayload({
            source: extractedText,
            language: extensionToLanguage(ext),
            references,
          });
          maxScore = Number(ai?.max_similarity || 0);
          method = ai?.method || 'code_ai';
          matchedSubmissionId = ai?.matched_id || null;
        }
      } catch {
        // Fallback to local text similarity below.
      }
    }

    if (maxScore <= 0) {
      for (const s of otherSubmissions) {
        const score = jaccardSimilarity(extractedText, s.extractedText || '');
        if (score > maxScore) {
          maxScore = score;
          method = 'text_jaccard';
          matchedSubmissionId = s._id;
        }
      }
    }
  }

  const plagiarismFlag = maxScore >= 0.85;
  const storedRelativePath = path.join(relDir, finalName).replace(/\\/g, '/');
  const rec = await NormalAssignmentSubmission.create({
    assignment: assignmentId,
    submittedBy: userId,
    storedRelativePath,
    originalFilename: file.originalname || finalName,
    mimeType: file.mimetype || 'application/octet-stream',
    sizeBytes: stat.size,
    contentHash,
    extractedText,
    plagiarismScore: maxScore,
    plagiarismFlag,
    plagiarismMethod: method,
    matchedSubmissionId: matchedSubmissionId || null,
  });

  return rec;
}

/**
 * Teacher roster + latest normal submission per student (same assignment).
 * Plagiarism scores compare each student only to peers who also uploaded on this assignment.
 */
export async function listNormalSubmissionsForTeacher(teacherId, assignmentId) {
  const assignmentRow = await assignmentTeacher.getAssignmentForTeacher(teacherId, assignmentId);
  if (!assignmentRow) {
    const err = new Error('Assignment not found');
    err.status = 404;
    throw err;
  }
  if (String(assignmentRow.assignmentType || 'normal') !== 'normal') {
    const err = new Error('This assignment is not a normal (file upload) assignment.');
    err.status = 400;
    throw err;
  }

  const a = await Assignment.findById(assignmentId).populate('classes', 'code name').populate('class', 'code name').lean();
  const codes = new Set();
  for (const c of a.classes || []) {
    if (c?.code) codes.add(String(c.code).trim().toUpperCase());
  }
  if (a.class?.code) codes.add(String(a.class.code).trim().toUpperCase());
  const classCodes = [...codes];

  const submissions = await NormalAssignmentSubmission.find({ assignment: assignmentId })
    .sort({ createdAt: -1 })
    .lean();

  const latestByUser = new Map();
  for (const s of submissions) {
    const uid = String(s.submittedBy);
    if (!latestByUser.has(uid)) latestByUser.set(uid, s);
  }

  const userIdsFromSubs = [...latestByUser.keys()]
    .filter(Boolean)
    .map((id) => new mongoose.Types.ObjectId(id));

  const profileOr = [];
  if (classCodes.length) profileOr.push({ classCode: { $in: classCodes } });
  if (userIdsFromSubs.length) profileOr.push({ user: { $in: userIdsFromSubs } });

  let profiles = [];
  if (profileOr.length) {
    profiles = await StudentProfile.find({ $or: profileOr }).populate('user', 'name email').lean();
  }

  const byUser = new Map();
  for (const p of profiles) {
    const uid = String(p.user?._id || p.user);
    if (!uid) continue;
    if (!byUser.has(uid)) byUser.set(uid, p);
  }

  for (const uid of latestByUser.keys()) {
    if (byUser.has(uid)) continue;
    const u = await User.findById(uid).select('name email').lean();
    if (u) byUser.set(uid, { user: u, studentId: '', classCode: '' });
  }

  const matchedIds = [...latestByUser.values()]
    .map((s) => s.matchedSubmissionId)
    .filter(Boolean);
  const matchedSubs =
    matchedIds.length > 0
      ? await NormalAssignmentSubmission.find({ _id: { $in: matchedIds } })
          .populate('submittedBy', 'name email')
          .select('submittedBy')
          .lean()
      : [];
  const matchedPeerLabel = new Map(
    matchedSubs.map((m) => [
      String(m._id),
      m.submittedBy?.name || m.submittedBy?.email || 'Another student',
    ])
  );

  const students = [...byUser.entries()].map(([studentUserId, profile]) => {
    const sub = latestByUser.get(studentUserId);
    const u = profile.user;
    const rel = sub?.storedRelativePath ? String(sub.storedRelativePath).replace(/^\/+/, '') : '';
    return {
      studentUserId,
      studentId: profile.studentId || '',
      name: u?.name || '',
      email: u?.email || '',
      classCode: profile.classCode || '',
      submitted: Boolean(sub),
      submission: sub
        ? {
            _id: sub._id,
            originalFilename: sub.originalFilename,
            sizeBytes: sub.sizeBytes,
            createdAt: sub.createdAt,
            plagiarismScore: sub.plagiarismScore,
            plagiarismFlag: sub.plagiarismFlag,
            plagiarismMethod: sub.plagiarismMethod,
            matchedSubmissionId: sub.matchedSubmissionId,
            matchedPeerLabel:
              sub.matchedSubmissionId != null
                ? matchedPeerLabel.get(String(sub.matchedSubmissionId)) || null
                : null,
            downloadPath: rel ? `/uploads/${rel}` : null,
          }
        : null,
    };
  });

  students.sort((x, y) => String(x.name || x.email).localeCompare(String(y.name || y.email)));

  return {
    assignmentId: String(assignmentId),
    plagiarismExplained:
      'Each file is checked only against other students’ uploads for this same assignment (not other courses). Identical files, overlapping extracted text, or similar code (via the AI service when running) can raise the score. Scores ≥ 85% are flagged as high similarity—use your judgment; legitimate starter templates can sometimes overlap.',
    students,
    submittedCount: students.filter((s) => s.submitted).length,
    flaggedCount: students.filter((s) => s.submission?.plagiarismFlag).length,
  };
}

const EXTRACT_PREVIEW_MAX = 200000;

/**
 * One student’s normal submission detail for teacher review (extracted text + optional matched peer).
 */
export async function getNormalSubmissionStudentDetailForTeacher(teacherId, assignmentId, studentUserId) {
  const assignmentRow = await assignmentTeacher.getAssignmentForTeacher(teacherId, assignmentId);
  if (!assignmentRow) {
    const err = new Error('Assignment not found');
    err.status = 404;
    throw err;
  }
  if (String(assignmentRow.assignmentType || 'normal') !== 'normal') {
    const err = new Error('This assignment is not a normal (file upload) assignment.');
    err.status = 400;
    throw err;
  }

  const uid = mongoose.Types.ObjectId.isValid(String(studentUserId))
    ? new mongoose.Types.ObjectId(String(studentUserId))
    : null;
  if (!uid) {
    const err = new Error('Invalid student id');
    err.status = 400;
    throw err;
  }

  const aScope = await Assignment.findById(assignmentId).populate('classes', 'code name').populate('class', 'code name').lean();
  const rosterCodes = new Set();
  for (const c of aScope?.classes || []) {
    if (c?.code) rosterCodes.add(String(c.code).trim().toUpperCase());
  }
  if (aScope?.class?.code) rosterCodes.add(String(aScope.class.code).trim().toUpperCase());
  const classCodes = [...rosterCodes];

  const sub = await NormalAssignmentSubmission.findOne({ assignment: assignmentId, submittedBy: uid })
    .sort({ createdAt: -1 })
    .lean();

  const profile = await StudentProfile.findOne({ user: uid }).populate('user', 'name email').lean();
  const populatedUser = profile?.user;
  const userDoc =
    populatedUser && typeof populatedUser === 'object' && 'name' in populatedUser
      ? populatedUser
      : await User.findById(uid).select('name email').lean();

  if (!userDoc) {
    const err = new Error('Student not found');
    err.status = 404;
    throw err;
  }

  const codeUpper = String(profile?.classCode || '').trim().toUpperCase();
  const onAssignmentRoster = Boolean(codeUpper && classCodes.includes(codeUpper));
  if (!sub && !onAssignmentRoster) {
    const err = new Error('This student is not on this assignment’s class roster.');
    err.status = 403;
    throw err;
  }

  let matchedPeer = null;
  if (sub?.matchedSubmissionId) {
    const peerSub = await NormalAssignmentSubmission.findById(sub.matchedSubmissionId).lean();
    if (peerSub) {
      const peerProfile = await StudentProfile.findOne({ user: peerSub.submittedBy }).populate('user', 'name email').lean();
      const pu = peerProfile?.user;
      matchedPeer = {
        studentUserId: String(peerSub.submittedBy),
        name: pu?.name || '',
        email: pu?.email || '',
        studentId: peerProfile?.studentId || '',
        originalFilename: peerSub.originalFilename || '',
        extractedText: String(peerSub.extractedText || '').slice(0, EXTRACT_PREVIEW_MAX),
      };
    }
  }

  const rel = sub?.storedRelativePath ? String(sub.storedRelativePath).replace(/^\/+/, '') : '';
  return {
    assignment: {
      _id: String(assignmentId),
      title: assignmentRow.title || '',
      subject: assignmentRow.subject || null,
    },
    student: {
      studentUserId: String(uid),
      studentId: profile?.studentId || '',
      name: userDoc.name || '',
      email: userDoc.email || '',
      classCode: profile?.classCode || '',
    },
    submission: sub
      ? {
          _id: String(sub._id),
          originalFilename: sub.originalFilename,
          sizeBytes: sub.sizeBytes,
          createdAt: sub.createdAt,
          plagiarismScore: sub.plagiarismScore,
          plagiarismFlag: sub.plagiarismFlag,
          plagiarismMethod: sub.plagiarismMethod,
          downloadPath: rel ? `/uploads/${rel}` : null,
          extractedText: String(sub.extractedText || '').slice(0, EXTRACT_PREVIEW_MAX),
          matchedPeerLabel: matchedPeer?.name || matchedPeer?.email || null,
        }
      : null,
    matchedPeer,
  };
}
