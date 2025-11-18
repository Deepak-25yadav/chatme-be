import mongoose, { Document, Schema } from 'mongoose';

export interface IUser extends Document {
  userId: string;
  name: string;
  email?: string;
  avatar?: string;
  isOnline: boolean;
  lastSeen: Date;
  socketId?: string;
}

const UserSchema: Schema = new Schema({
  userId: { type: String, required: true, unique: true },
  name: { type: String, required: true },
  email: { type: String },
  avatar: { type: String },
  isOnline: { type: Boolean, default: false },
  lastSeen: { type: Date, default: Date.now },
  socketId: { type: String }
}, {
  timestamps: true
});

export default mongoose.model<IUser>('User', UserSchema);

