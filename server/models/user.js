import mongoose from 'mongoose';

const userSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true, maxlength: 100 },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  passwordHash: { type: String, select: false },
  googleId: { type: String, unique: true, sparse: true, select: false },
  sessionVersion: { type: Number, default: 0 },
  resetCodeHash: { type: String, select: false },
  resetCodeExpiresAt: { type: Date, select: false },
  resetCodeAttempts: { type: Number, default: 0, select: false },
  resetCodeSentAt: { type: Date, select: false },
  role: { type: String, enum: ['admin', 'member'], default: 'admin' },
  createdAt: { type: Date, default: Date.now }
});

export default mongoose.models.User || mongoose.model('User', userSchema);
