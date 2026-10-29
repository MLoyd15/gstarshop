import 'dotenv/config';
import mongoose from 'mongoose';
import User from '../models/user.js';
import { hashPassword } from '../services/auth.js';

const [emailArg, password, ...nameParts] = process.argv.slice(2);
if (!process.env.MONGODB_URI) throw new Error('Set MONGODB_URI in .env first.');
if (!emailArg || !password) throw new Error('Usage: npm run reset-password -- email password [name]');
await mongoose.connect(process.env.MONGODB_URI);
const email = emailArg.trim().toLowerCase();
const name = nameParts.join(' ').trim() || 'G4 Sticker Admin';
const passwordHash = await hashPassword(password);
await User.findOneAndUpdate({ email }, { $set: { email, name, passwordHash, role: 'admin' } }, { upsert: true, new: true, runValidators: true });
console.log(`Admin account ready for ${email}`);
await mongoose.disconnect();
