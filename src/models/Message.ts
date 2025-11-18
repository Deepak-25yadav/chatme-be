import mongoose, { Document, Schema } from 'mongoose';

export enum MessageStatus {
  SENT = 'sent',
  DELIVERED = 'delivered',
  SEEN = 'seen'
}

export enum DeleteType {
  NONE = 'none',
  FOR_ME = 'for_me',
  FOR_BOTH = 'for_both'
}

export interface IMessage extends Document {
  chatRoomId: string;
  senderId: string;
  receiverId: string;
  message: string;
  status: MessageStatus;
  timestamp: Date;
  replyTo?: mongoose.Types.ObjectId;
  isEdited: boolean;
  deletedFor: string[]; // Array of user IDs who deleted this message
  deleteType: DeleteType;
}

const MessageSchema: Schema = new Schema({
  chatRoomId: { type: String, required: true, index: true },
  senderId: { type: String, required: true, index: true },
  receiverId: { type: String, required: true, index: true },
  message: { type: String, required: true },
  status: { type: String, enum: Object.values(MessageStatus), default: MessageStatus.SENT },
  timestamp: { type: Date, default: Date.now, index: true },
  replyTo: { type: Schema.Types.ObjectId, ref: 'Message' },
  isEdited: { type: Boolean, default: false },
  deletedFor: [{ type: String }],
  deleteType: { type: String, enum: Object.values(DeleteType), default: DeleteType.NONE }
}, {
  timestamps: true
});

MessageSchema.index({ chatRoomId: 1, timestamp: -1 });

export default mongoose.model<IMessage>('Message', MessageSchema);

