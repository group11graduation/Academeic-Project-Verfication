import { body } from 'express-validator';

export const loginRules = [
  body('identifier').trim().notEmpty().withMessage('identifier is required'),
  body('passcode').notEmpty().withMessage('passcode is required'),
];

export const forgotPasswordRules = [
  body('identifier').trim().notEmpty().withMessage('Email or ID is required'),
];

export const resetPasswordRules = [
  body('token').trim().notEmpty().withMessage('Reset token is required'),
  body('password')
    .isString()
    .isLength({ min: 6 })
    .withMessage('Password must be at least 6 characters'),
];
