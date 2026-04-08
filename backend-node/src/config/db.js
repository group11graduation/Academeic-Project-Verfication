import mongoose from 'mongoose';
import { logger } from './logger.js';

export async function connectDb() {
  const uri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/academic_verification';
  mongoose.set('strictQuery', true);
  await mongoose.connect(uri);
  logger.info(`MongoDB connected: ${uri.replace(/\/\/.*@/, '//***@')}`);
}
