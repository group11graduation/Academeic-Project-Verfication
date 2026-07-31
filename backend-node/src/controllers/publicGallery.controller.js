import { asyncHandler } from '../utils/asyncHandler.js';
import { success, fail } from '../utils/apiResponse.js';
import * as verifiedGallery from '../services/verifiedGallery.service.js';
import * as galleryReaction from '../services/galleryReaction.service.js';

function guestKeyFromReq(req) {
  return (
    String(req.body?.guestKey || '').trim() ||
    String(req.query?.guestKey || '').trim() ||
    String(req.headers['x-gallery-guest'] || '').trim()
  );
}

export const listVerifiedProjects = asyncHandler(async (req, res) => {
  const { category, sort, limit } = req.query;
  let projects = await verifiedGallery.listVerifiedProjects({ category, sort, limit });
  projects = await galleryReaction.attachReactionStats(projects, {
    viewerUserId: req.userId || null,
    guestKey: guestKeyFromReq(req),
  });
  if (String(sort || 'best') === 'best' || String(sort || '') === 'loved') {
    projects = [...projects].sort(
      (a, b) =>
        (b.likeCount || 0) - (a.likeCount || 0) ||
        (b.featuredRank || 0) - (a.featuredRank || 0) ||
        (b.teacherScore ?? 0) - (a.teacherScore ?? 0)
    );
  }
  const categories = verifiedGallery.listGalleryCategories();
  return success(res, { projects, categories });
});

export const getVerifiedProject = asyncHandler(async (req, res) => {
  const project = await verifiedGallery.getVerifiedProjectById(req.params.id);
  if (!project) return fail(res, 'Verified project not found', 404);
  const [withStats] = await galleryReaction.attachReactionStats([project], {
    viewerUserId: req.userId || null,
    guestKey: guestKeyFromReq(req),
  });
  const reactionDetails = await galleryReaction.listProjectReactors(req.params.id, { limit: 40 });
  return success(res, {
    ...withStats,
    reactors: reactionDetails.reactors,
  });
});

export const listProjectReactions = asyncHandler(async (req, res) => {
  const project = await verifiedGallery.getVerifiedProjectById(req.params.id);
  if (!project) return fail(res, 'Verified project not found', 404);
  const data = await galleryReaction.listProjectReactors(req.params.id, {
    limit: Number(req.query.limit) || 40,
  });
  return success(res, data);
});

export const toggleProjectReaction = asyncHandler(async (req, res) => {
  const data = await galleryReaction.toggleProjectReaction({
    userId: req.userId || null,
    guestKey: guestKeyFromReq(req),
    projectKey: req.params.id,
  });
  return success(res, data);
});
