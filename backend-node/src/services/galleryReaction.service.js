import mongoose from 'mongoose';
import { GalleryReaction } from '../models/GalleryReaction.js';
import { User } from '../models/User.js';
import * as verifiedGallery from './verifiedGallery.service.js';

function normalizeProjectKey(raw) {
  return String(raw || '').trim();
}

function normalizeGuestKey(raw) {
  const key = String(raw || '')
    .trim()
    .slice(0, 80);
  if (!key) return '';
  // Keep keys simple: uuid-like / alphanumeric
  if (!/^[a-zA-Z0-9_-]{8,80}$/.test(key)) return '';
  return key;
}

function guestLabel(guestKey) {
  const tail = String(guestKey || '').slice(-4).toUpperCase();
  return tail ? `Visitor ${tail}` : 'Visitor';
}

let reactionIndexesReady = false;
async function ensureReactionIndexes() {
  if (reactionIndexesReady) return;
  try {
    await GalleryReaction.syncIndexes();
  } catch {
    /* ignore - indexes may already match */
  }
  reactionIndexesReady = true;
}

export async function attachReactionStats(projects, { viewerUserId = null, guestKey = '' } = {}) {
  await ensureReactionIndexes();
  const list = Array.isArray(projects) ? projects : projects ? [projects] : [];
  if (!list.length) return list;

  const keys = [...new Set(list.map((p) => normalizeProjectKey(p?.id)).filter(Boolean))];
  if (!keys.length) return list;

  const counts = await GalleryReaction.aggregate([
    { $match: { projectKey: { $in: keys } } },
    { $group: { _id: '$projectKey', likeCount: { $sum: 1 } } },
  ]);
  const countByKey = new Map(counts.map((r) => [r._id, r.likeCount]));

  let likedKeys = new Set();
  const gk = normalizeGuestKey(guestKey);
  if (viewerUserId && mongoose.Types.ObjectId.isValid(viewerUserId)) {
    const mine = await GalleryReaction.find({
      projectKey: { $in: keys },
      user: viewerUserId,
    })
      .select('projectKey')
      .lean();
    likedKeys = new Set(mine.map((r) => r.projectKey));
  } else if (gk) {
    const mine = await GalleryReaction.find({
      projectKey: { $in: keys },
      guestKey: gk,
    })
      .select('projectKey')
      .lean();
    likedKeys = new Set(mine.map((r) => r.projectKey));
  }

  return list.map((p) => {
    const key = normalizeProjectKey(p.id);
    return {
      ...p,
      likeCount: countByKey.get(key) || 0,
      likedByMe: likedKeys.has(key),
    };
  });
}

export async function listProjectReactors(projectKey, { limit = 40 } = {}) {
  const key = normalizeProjectKey(projectKey);
  if (!key) return { likeCount: 0, reactors: [] };

  const rows = await GalleryReaction.find({ projectKey: key })
    .sort({ createdAt: -1 })
    .limit(Math.min(Number(limit) || 40, 100))
    .populate('user', 'name role')
    .lean();

  const likeCount = await GalleryReaction.countDocuments({ projectKey: key });
  const reactors = rows.map((r) => {
    if (r.user?._id || r.user) {
      return {
        userId: r.user?._id ? String(r.user._id) : String(r.user),
        name: r.user?.name || r.displayName || 'User',
        role: r.user?.role || 'member',
        isGuest: false,
        reactedAt: r.createdAt || null,
      };
    }
    const g = r.guestKey || '';
    return {
      userId: g ? `guest:${g}` : `anon:${r._id}`,
      name: r.displayName || guestLabel(g),
      role: 'visitor',
      isGuest: true,
      reactedAt: r.createdAt || null,
    };
  });

  return { likeCount, reactors };
}

export async function toggleProjectReaction({ userId = null, guestKey = '', projectKey }) {
  await ensureReactionIndexes();
  const key = normalizeProjectKey(projectKey);
  if (!key) {
    const err = new Error('Project id is required');
    err.status = 400;
    throw err;
  }

  const gk = normalizeGuestKey(guestKey);
  const hasUser = Boolean(userId && mongoose.Types.ObjectId.isValid(userId));
  if (!hasUser && !gk) {
    const err = new Error('Missing visitor id for anonymous reaction');
    err.status = 400;
    throw err;
  }

  const project = await verifiedGallery.getVerifiedProjectById(key);
  if (!project) {
    const err = new Error('Verified project not found');
    err.status = 404;
    throw err;
  }

  let existing = null;
  if (hasUser) {
    existing = await GalleryReaction.findOne({ projectKey: key, user: userId });
  } else {
    existing = await GalleryReaction.findOne({ projectKey: key, guestKey: gk });
  }

  let likedByMe = false;
  if (existing) {
    await GalleryReaction.deleteOne({ _id: existing._id });
    likedByMe = false;
  } else if (hasUser) {
    let displayName = '';
    try {
      const u = await User.findById(userId).select('name').lean();
      displayName = u?.name || '';
    } catch {
      /* ignore */
    }
    await GalleryReaction.create({
      projectKey: key,
      user: userId,
      guestKey: '',
      displayName,
    });
    likedByMe = true;
  } else {
    await GalleryReaction.create({
      projectKey: key,
      user: null,
      guestKey: gk,
      displayName: guestLabel(gk),
    });
    likedByMe = true;
  }

  const likeCount = await GalleryReaction.countDocuments({ projectKey: key });
  const { reactors } = await listProjectReactors(key, { limit: 12 });

  return {
    projectKey: key,
    likedByMe,
    likeCount,
    reactors,
  };
}
