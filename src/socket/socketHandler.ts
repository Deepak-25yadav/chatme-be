import { Server, Socket } from 'socket.io';
import User from '../models/User';
import Message, { MessageStatus, DeleteType } from '../models/Message';
import ChatRoom from '../models/ChatRoom';
import { generateChatRoomId } from '../utils/chatRoomUtils';

interface UserSocket extends Socket {
  userId?: string;
}

const socketHandler = (io: Server) => {
  io.on('connection', (socket: UserSocket) => {
    console.log('User connected:', socket.id);

    // User joins with their userId
    socket.on('join', async (data: { userId: string; name: string }) => {
      try {
        socket.userId = data.userId;
        
        // Check if user exists (authenticated user)
        const existingUser = await User.findOne({ userId: data.userId });
        
        if (existingUser) {
          // Update existing user (don't touch email field)
          await User.findOneAndUpdate(
            { userId: data.userId },
            {
              isOnline: true,
              socketId: socket.id,
              lastSeen: new Date()
            }
          );
        } else {
          // For backward compatibility with old users (no auth)
          // This shouldn't happen in the new system, but keeping for safety
          console.warn('User joining without authentication:', data.userId);
        }

        // Join user's personal room
        socket.join(data.userId);

        // Notify others that user is online
        socket.broadcast.emit('user-online', { userId: data.userId });
      } catch (error) {
        console.error('Error in join:', error);
      }
    });

    // Send message
    socket.on('send-message', async (data: {
      senderId: string;
      receiverId: string;
      message: string;
      replyTo?: string;
    }) => {
      try {
        const { senderId, receiverId, message, replyTo } = data;
        const chatRoomId = generateChatRoomId(senderId, receiverId);

        // Create or update chat room
        await ChatRoom.findOneAndUpdate(
          { chatRoomId },
          {
            chatRoomId,
            participants: [senderId, receiverId],
            lastMessageTime: new Date()
          },
          { upsert: true, new: true }
        );

        // Create message
        const newMessage = new Message({
          chatRoomId,
          senderId,
          receiverId,
          message,
          status: MessageStatus.SENT,
          replyTo: replyTo ? replyTo : undefined,
          timestamp: new Date()
        });

        const savedMessage = await newMessage.save();

        // Update chat room with last message
        await ChatRoom.findOneAndUpdate(
          { chatRoomId },
          { lastMessage: savedMessage._id, lastMessageTime: savedMessage.timestamp }
        );

        // Emit to receiver
        io.to(receiverId).emit('receive-message', {
          ...savedMessage.toObject(),
          _id: savedMessage._id.toString()
        });

        // Emit to sender (confirmation)
        socket.emit('message-sent', {
          ...savedMessage.toObject(),
          _id: savedMessage._id.toString()
        });

        // Check if receiver is online
        const receiver = await User.findOne({ userId: receiverId });
        if (receiver && receiver.isOnline) {
          // Update message status to delivered
          await Message.findByIdAndUpdate(savedMessage._id, {
            status: MessageStatus.DELIVERED
          });

          // Notify sender that message is delivered
          io.to(senderId).emit('message-status-update', {
            messageId: savedMessage._id.toString(),
            status: MessageStatus.DELIVERED
          });
        }
      } catch (error) {
        console.error('Error in send-message:', error);
        socket.emit('error', { message: 'Failed to send message' });
      }
    });

    // Message seen
    socket.on('message-seen', async (data: { messageIds: string[]; userId: string }) => {
      try {
        const { messageIds, userId } = data;

        // Update all messages to seen status
        await Message.updateMany(
          { _id: { $in: messageIds }, receiverId: userId },
          { status: MessageStatus.SEEN }
        );

        // Get sender IDs of these messages
        const messages = await Message.find({ _id: { $in: messageIds } });
        const senderIds = [...new Set(messages.map(m => m.senderId))];

        // Notify senders that messages are seen
        senderIds.forEach(senderId => {
          io.to(senderId).emit('messages-seen', {
            messageIds,
            seenBy: userId
          });
        });
      } catch (error) {
        console.error('Error in message-seen:', error);
      }
    });

    // Typing indicator
    socket.on('typing', (data: { senderId: string; receiverId: string; isTyping: boolean }) => {
      const { senderId, receiverId, isTyping } = data;
      io.to(receiverId).emit('typing', {
        userId: senderId,
        isTyping
      });
    });

    // Edit message
    socket.on('edit-message', async (data: {
      messageId: string;
      newMessage: string;
      userId: string;
    }) => {
      try {
        const { messageId, newMessage, userId } = data;

        const message = await Message.findById(messageId);
        if (!message || message.senderId !== userId) {
          socket.emit('error', { message: 'Unauthorized' });
          return;
        }

        const updatedMessage = await Message.findByIdAndUpdate(
          messageId,
          { message: newMessage, isEdited: true },
          { new: true }
        );

        // Notify receiver
        io.to(message.receiverId).emit('message-edited', {
          messageId: messageId,
          newMessage: newMessage,
          isEdited: true
        });

        // Notify sender
        socket.emit('message-edited', {
          messageId: messageId,
          newMessage: newMessage,
          isEdited: true
        });
      } catch (error) {
        console.error('Error in edit-message:', error);
        socket.emit('error', { message: 'Failed to edit message' });
      }
    });

    // Delete message
    socket.on('delete-message', async (data: {
      messageId: string;
      userId: string;
      deleteFor: 'me' | 'both';
    }) => {
      try {
        const { messageId, userId, deleteFor } = data;

        const message = await Message.findById(messageId);
        if (!message) {
          socket.emit('error', { message: 'Message not found' });
          return;
        }

        if (deleteFor === 'me') {
          // Delete for me only
          if (!message.deletedFor.includes(userId)) {
            message.deletedFor.push(userId);
            message.deleteType = DeleteType.FOR_ME;
            await message.save();
          }
        } else if (deleteFor === 'both') {
          // Delete for both
          message.deleteType = DeleteType.FOR_BOTH;
          message.deletedFor = [message.senderId, message.receiverId];
          await message.save();

          // Notify receiver
          io.to(message.receiverId).emit('message-deleted', {
            messageId: messageId
          });
        }

        // Notify sender
        socket.emit('message-deleted', {
          messageId: messageId
        });
      } catch (error) {
        console.error('Error in delete-message:', error);
        socket.emit('error', { message: 'Failed to delete message' });
      }
    });

    // Get online status
    socket.on('get-online-status', async (data: { userId: string }) => {
      try {
        const user = await User.findOne({ userId: data.userId });
        if (user) {
          socket.emit('online-status', {
            userId: data.userId,
            isOnline: user.isOnline,
            lastSeen: user.lastSeen
          });
        }
      } catch (error) {
        console.error('Error in get-online-status:', error);
      }
    });

    // Disconnect
    socket.on('disconnect', async () => {
      try {
        if (socket.userId) {
          // Update user as offline
          await User.findOneAndUpdate(
            { userId: socket.userId },
            {
              isOnline: false,
              lastSeen: new Date()
            }
          );

          // Notify others
          socket.broadcast.emit('user-offline', { userId: socket.userId });
        }
        console.log('User disconnected:', socket.id);
      } catch (error) {
        console.error('Error in disconnect:', error);
      }
    });
  });
};

export default socketHandler;

