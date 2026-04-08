import { body } from 'express-validator';

export const loginRules = [
  body('identifier').trim().notEmpty().withMessage('identifier is required'),
  body('passcode').notEmpty().withMessage('passcode is required'),
];
