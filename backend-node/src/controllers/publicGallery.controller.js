import { asyncHandler } from '../utils/asyncHandler.js';
import { success, fail } from '../utils/apiResponse.js';
import * as verifiedGallery from '../services/verifiedGallery.service.js';

export const listVerifiedProjects = asyncHandler(async (req, res) => {
  const { category, sort, limit } = req.query;
  const projects = await verifiedGallery.listVerifiedProjects({ category, sort, limit });
  const categories = verifiedGallery.listGalleryCategories();
  return success(res, { projects, categories });
});

export const getVerifiedProject = asyncHandler(async (req, res) => {
  const project = await verifiedGallery.getVerifiedProjectById(req.params.id);
  if (!project) return fail(res, 'Verified project not found', 404);
  return success(res, project);
});
