import mongoose from 'mongoose';
import { logger } from './logger.js';
import { getMongoUri } from './env.js';

export async function connectDb() {
  const uri = getMongoUri();
  mongoose.set('strictQuery', true);
  await mongoose.connect(uri);
  logger.info(`MongoDB connected: ${uri.replace(/\/\/.*@/, '//***@')}`);
}
