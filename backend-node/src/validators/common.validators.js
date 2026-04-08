import { param, query } from 'express-validator';

/** Example: reuse for routes with :id Mongo ObjectId */
export const mongoIdParam = (paramName = 'id') =>
  param(paramName).isMongoId().withMessage(`${paramName} must be a valid id`);

export const paginationQuery = [
  query('page').optional().isInt({ min: 1 }).toInt(),
  query('limit').optional().isInt({ min: 1, max: 100 }).toInt(),
];
