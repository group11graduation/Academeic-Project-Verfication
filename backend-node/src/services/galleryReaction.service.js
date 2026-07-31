import mongoose from 'mongoose';
import { GalleryReaction } from '../models/GalleryReaction.js';
import { User } from '../models/User.js';
import * as verifiedGallery from './verifiedGallery.service.js';

function normalizeProjectKey(raw) {
  return String(raw || '').trim();
}

export async function attachReactionStats(projects, viewerUserId = null) {
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
  if (viewerUserId && mongoose.Types.ObjectId.isValid(viewerUserId)) {
    const mine = await GalleryReaction.find({
      projectKey: { $in: keys },
      user: viewerUserId,
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
  const reactors = rows
    .map((r) => ({
      userId: r.user?._id ? String(r.user._id) : String(r.user || ''),
      name: r.user?.name || 'User',
      role: r.user?.role || '',
      reactedAt: r.createdAt || null,
    }))
    .filter((r) => r.userId);

  return { likeCount, reactors };
}

export async function toggleProjectReaction(userId, projectKey) {
  const key = normalizeProjectKey(projectKey);
  if (!key) {
    const err = new Error('Project id is required');
    err.status = 400;
    throw err;
  }
  if (!userId) {
    const err = new Error('Sign in to react to a project');
    err.status = 401;
    throw err;
  }

  const project = await verifiedGallery.getVerifiedProjectById(key);
  if (!project) {
    const err = new Error('Verified project not found');
    err.status = 404;
    throw err;
  }

  const existing = await GalleryReaction.findOne({ projectKey: key, user: userId });
  let likedByMe = false;
  if (existing) {
    await GalleryReaction.deleteOne({ _id: existing._id });
    likedByMe = false;
  } else {
    await GalleryReaction.create({ projectKey: key, user: userId });
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

export async function getViewerDisplayName(userId) {
  if (!userId) return '';
  const u = await User.findById(userId).select('name').lean();
  return u?.name || '';
}
