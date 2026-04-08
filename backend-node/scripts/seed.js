/**
 * Seed initial admin user and sample academic structure for local development.
 * Run: npm run seed
 */

import 'dotenv/config';
import mongoose from 'mongoose';
import { User } from '../src/models/User.js';
import { AcademicYear } from '../src/models/AcademicYear.js';
import { Semester } from '../src/models/Semester.js';
import { Subject } from '../src/models/Subject.js';
import { Class } from '../src/models/Class.js';
import { SystemSettings } from '../src/models/SystemSettings.js';
import { TeacherProfile } from '../src/models/TeacherProfile.js';
import { StudentProfile } from '../src/models/StudentProfile.js';
import { Enrollment } from '../src/models/Enrollment.js';
import { Assignment } from '../src/models/Assignment.js';
import { LegacyProject } from '../src/models/LegacyProject.js';

const uri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/academic_verification';

async function run() {
  await mongoose.connect(uri);
  console.log('Connected:', uri);

  const adminEmail = process.env.SEED_ADMIN_EMAIL || 'admin@university.edum';
  const adminPass = process.env.SEED_ADMIN_PASSWORD || 'Admin@123';

  let admin = await User.findOne({ email: adminEmail });
  if (!admin) {
    admin = new User({
      email: adminEmail,
      username: 'admin',
      passwordHash: await User.hashPassword(adminPass),
      role: 'admin',
      roles: ['admin'],
      name: 'System Administrator',
      isActive: true,
    });
    await admin.save();
    console.log('Created admin:', adminEmail, '/', adminPass);
  } else {
    console.log('Admin already exists:', adminEmail);
  }

  let year = await AcademicYear.findOne({ label: '2025-2026' });
  if (!year) {
    year = await AcademicYear.create({
      label: '2025-2026',
      isCurrent: true,
      startDate: new Date('2025-09-01'),
      endDate: new Date('2026-08-31'),
    });
    console.log('Created academic year', year.label);
  }

  let sem = await Semester.findOne({ academicYear: year._id, name: 'Fall 2026' });
  if (!sem) {
    sem = await Semester.create({
      academicYear: year._id,
      name: 'Fall 2026',
      order: 1,
    });
    console.log('Created semester', sem.name);
  }

  const subjects = [
    { code: 'CS401', name: 'Software Engineering Project' },
    { code: 'CS440', name: 'Machine Learning Applications' },
  ];
  for (const s of subjects) {
    const exists = await Subject.findOne({ code: s.code });
    if (!exists) await Subject.create({ ...s, description: 'Sample subject' });
  }
  console.log('Subjects ensured');

  const cls = await Class.findOne({ code: 'CS-SEC-A' });
  if (!cls) {
    await Class.create({
      code: 'CS-SEC-A',
      name: 'Computer Science — Section A',
      faculty: 'Faculty of Computing',
      category: 'ACADEMIC',
      academicYear: year._id,
      semester: sem._id,
    });
    console.log('Created sample class CS-SEC-A');
  }

  await SystemSettings.findOneAndUpdate(
    { key: 'allow_student_self_registration' },
    { value: false, description: 'Only admins may create accounts' },
    { upsert: true }
  );

  // --- Demo teacher / student / proposal workflow ---
  const teacherEmail = process.env.SEED_TEACHER_EMAIL || 'teacher@university.edu';
  const teacherPass = process.env.SEED_TEACHER_PASSWORD || 'Teacher@123';
  let teacherUser = await User.findOne({ email: teacherEmail });
  if (!teacherUser) {
    teacherUser = await User.create({
      email: teacherEmail,
      username: 'teacher1',
      passwordHash: await User.hashPassword(teacherPass),
      role: 'teacher',
      roles: ['teacher'],
      name: 'Demo Teacher',
      isActive: true,
    });
    await TeacherProfile.create({
      user: teacherUser._id,
      employeeId: 'T-1001',
      department: 'Computer Science',
    });
    console.log('Created teacher:', teacherEmail, '/', teacherPass);
  }

  const studentEmail = process.env.SEED_STUDENT_EMAIL || 'student@university.edu';
  const studentPass = process.env.SEED_STUDENT_PASSWORD || 'Student@123';
  let studentUser = await User.findOne({ email: studentEmail });
  if (!studentUser) {
    studentUser = await User.create({
      email: studentEmail,
      username: 'student1',
      passwordHash: await User.hashPassword(studentPass),
      role: 'student',
      roles: ['student'],
      name: 'Demo Student',
      isActive: true,
    });
    await StudentProfile.create({
      user: studentUser._id,
      studentId: 'ST-2026-001',
      program: 'BSc CS',
    });
    console.log('Created student:', studentEmail, '/', studentPass);
  }

  const classDoc = await Class.findOne({ code: 'CS-SEC-A' });
  const sub401 = await Subject.findOne({ code: 'CS401' });
  if (classDoc && sub401 && teacherUser) {
    const hasTa = classDoc.teacherAssignments?.some(
      (x) => String(x.teacher) === String(teacherUser._id)
    );
    if (!hasTa) {
      classDoc.teacherAssignments = classDoc.teacherAssignments || [];
      classDoc.teacherAssignments.push({
        teacher: teacherUser._id,
        subjects: [sub401._id],
      });
      await classDoc.save();
      console.log('Linked teacher to class CS-SEC-A / CS401');
    }

    await Enrollment.findOneAndUpdate(
      { student: studentUser._id, class: classDoc._id },
      {
        $set: {
          academicYear: year._id,
          semester: sem._id,
          subjects: [sub401._id],
          status: 'active',
        },
      },
      { upsert: true }
    );
    console.log('Enrollment ensured for demo student');

    let oldYear = await AcademicYear.findOne({ label: '2024-2025' });
    if (!oldYear) {
      oldYear = await AcademicYear.create({
        label: '2024-2025',
        isCurrent: false,
      });
    }
    let oldSem = await Semester.findOne({ academicYear: oldYear._id, name: 'Fall 2024' });
    if (!oldSem) {
      oldSem = await Semester.create({
        academicYear: oldYear._id,
        name: 'Fall 2024',
        order: 1,
      });
    }

    const legacyExists = await LegacyProject.findOne({ title: 'Legacy Library System' });
    if (!legacyExists) {
      await LegacyProject.create({
        title: 'Legacy Library System',
        proposalDescription: 'A web library with book lending and search.',
        features: ['catalog', 'user auth', 'search'],
        subject: sub401._id,
        class: classDoc._id,
        semester: oldSem._id,
        academicYear: oldYear._id,
        ownerLabel: 'Previous cohort',
        approvedAt: new Date(),
      });
      console.log('Created legacy project for similarity testing');
    }

    const hasAssignment = await Assignment.findOne({ title: 'Capstone Project — Phase 1' });
    if (!hasAssignment && teacherUser) {
      await Assignment.create({
        teacher: teacherUser._id,
        class: classDoc._id,
        subject: sub401._id,
        semester: sem._id,
        academicYear: year._id,
        title: 'Capstone Project — Phase 1',
        description: 'Build a full-stack academic project with verification workflow.',
        submissionMode: 'single',
        proposalPhaseOpen: true,
        projectPhaseOpen: false,
        proposalDeadline: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      });
      console.log('Created demo assignment');
    }
  }

  console.log('Seed complete.');
  await mongoose.disconnect();
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
