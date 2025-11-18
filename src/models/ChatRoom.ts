import mongoose, { Document, Schema } from 'mongoose';

export interface IChatRoom extends Document {
  chatRoomId: string;
  participants: string[]; // Array of user IDs
  lastMessage?: mongoose.Types.ObjectId;
  lastMessageTime?: Date;
}

const ChatRoomSchema: Schema = new Schema({
  chatRoomId: { type: String, required: true, unique: true, index: true },
  participants: [{ type: String, required: true }],
  lastMessage: { type: Schema.Types.ObjectId, ref: 'Message' },
  lastMessageTime: { type: Date }
}, {
  timestamps: true
});

export default mongoose.model<IChatRoom>('ChatRoom', ChatRoomSchema);

