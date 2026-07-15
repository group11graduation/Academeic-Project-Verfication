import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

const ROLES = ['admin', 'teacher', 'student'];

const userSchema = new mongoose.Schema(
  {
    email: { type: String, lowercase: true, trim: true, sparse: true },
    username: { type: String, trim: true, sparse: true },
    passwordHash: { type: String, required: true, select: false },
    /** Primary role for routing and RBAC */
    role: { type: String, enum: ROLES, required: true },
    /** Extra roles (e.g. teacher who is also admin) */
    roles: [{ type: String, enum: ROLES }],
    name: { type: String, trim: true, default: '' },
    photo: { type: String, default: '' },
    /** Last plain login passcode for admin handoff / recovery in admin APIs */
    handoffPasscode: { type: String, default: '', select: true },
    isActive: { type: Boolean, default: true },
    lastLoginAt: { type: Date },
    /** SHA-256 of one-time password reset token (select:false) */
    passwordResetToken: { type: String, default: '', select: false },
    passwordResetExpires: { type: Date, default: null, select: false },
  },
  { timestamps: true }
);

userSchema.index({ email: 1 }, { unique: true, sparse: true });
userSchema.index({ username: 1 }, { unique: true, sparse: true });

userSchema.methods.comparePassword = function comparePassword(plain) {
  return bcrypt.compare(plain, this.passwordHash);
};

userSchema.statics.hashPassword = async function hashPassword(plain) {
  return bcrypt.hash(plain, 12);
};

/** Normalize roles array: always includes primary role */
userSchema.methods.getRoleList = function getRoleList() {
  const set = new Set([this.role, ...(this.roles || [])]);
  return [...set];
};

export const User = mongoose.model('User', userSchema);
export { ROLES };
