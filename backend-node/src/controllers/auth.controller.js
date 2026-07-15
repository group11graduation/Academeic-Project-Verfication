import { validationResult } from 'express-validator';
import { asyncHandler } from '../utils/asyncHandler.js';
import { fail, success } from '../utils/apiResponse.js';
import * as authService from '../services/authService.js';

export const login = asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return fail(res, errors.array()[0].msg, 400);
  }
  const { identifier, passcode } = req.body;
  const { token, user } = await authService.loginWithIdentifier(identifier, passcode);
  return res.json({ success: true, token, user });
});

export const me = asyncHandler(async (req, res) => {
  const data = await authService.getMe(req.userId);
  return success(res, data);
});

export const forgotPassword = asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return fail(res, errors.array()[0].msg, 400);
  }
  const result = await authService.requestPasswordReset(req.body.identifier);
  return success(res, result);
});

export const resetPassword = asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return fail(res, errors.array()[0].msg, 400);
  }
  const result = await authService.resetPasswordWithToken(req.body.token, req.body.password);
  return success(res, result);
});
