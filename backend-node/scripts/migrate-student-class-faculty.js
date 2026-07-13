/**
 * Sync student faculty/department from their current class.
 *
 * Usage:
 *   cd backend-node && npm run migrate:student-class-faculty
 *   cd backend-node && npm run migrate:student-class-faculty -- --dry-run
 */

import 'dotenv/config';
import mongoose from 'mongoose';
import { getMongoUri } from '../src/config/env.js';
import { Class } from '../src/models/Class.js';
import { StudentProfile } from '../src/models/StudentProfile.js';

const dryRun = process.argv.includes('--dry-run');

async function run() {
  const uri = getMongoUri();
  await mongoose.connect(uri);
  console.log(`Connected: ${uri}`);
  console.log(dryRun ? 'DRY RUN — no documents will be modified' : 'LIVE RUN — writing changes');

  const classes = await Class.find().select('code faculty department').lean();
  const byCode = new Map(
    classes.map((c) => [
      String(c.code || '').trim().toUpperCase(),
      {
        faculty: String(c.faculty || '').trim(),
        department: String(c.department || '').trim(),
      },
    ])
  );

  const profiles = await StudentProfile.find({ classCode: { $nin: [null, ''] } }).select(
    'studentId classCode faculty department'
  );
  let updated = 0;
  let skipped = 0;

  for (const profile of profiles) {
    const code = String(profile.classCode || '').trim().toUpperCase();
    const meta = byCode.get(code);
    if (!meta?.faculty && !meta?.department) {
      skipped += 1;
      continue;
    }

    const nextFaculty = meta.faculty || profile.faculty || '';
    const nextDepartment = meta.department || profile.department || '';
    const facultyChanged = String(profile.faculty || '') !== String(nextFaculty);
    const departmentChanged = String(profile.department || '') !== String(nextDepartment);
    if (!facultyChanged && !departmentChanged) {
      skipped += 1;
      continue;
    }

    console.log(
      `[student ${profile.studentId || profile._id}] class=${code} faculty ${profile.faculty || '(empty)'} -> ${nextFaculty || '(empty)'}`
    );

    if (!dryRun) {
      await StudentProfile.updateOne(
        { _id: profile._id },
        {
          $set: {
            ...(meta.faculty ? { faculty: nextFaculty } : {}),
            ...(meta.department ? { department: nextDepartment } : {}),
          },
        }
      );
    }
    updated += 1;
  }

  console.log('\nSummary');
  console.log({ scanned: profiles.length, updated, skipped });
  await mongoose.disconnect();
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
