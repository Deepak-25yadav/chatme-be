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
    console.log('✅ User connected with socket ID:', socket.id);
    console.log('Total connected sockets:', io.sockets.sockets.size);

    // User joins with their userId
    socket.on('join', async (data: { userId: string; name: string }) => {
      try {
        console.log('🔵 User joining socket room:', data.userId, 'Socket ID:', socket.id);
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
          console.log('✅ User updated as online:', data.userId);
        } else {
          console.warn('⚠️ User joining without authentication:', data.userId);
        }

        // Join user's personal room
        socket.join(data.userId);
        console.log('✅ User joined room:', data.userId);
        
        // Verify room membership
        const room = io.sockets.adapter.rooms.get(data.userId);
        if (room) {
          console.log(`✅ Room ${data.userId} now has ${room.size} socket(s)`);
        } else {
          console.warn(`⚠️ Room ${data.userId} was not created properly`);
        }

        // Notify others that user is online
        socket.broadcast.emit('user-online', { userId: data.userId });
      } catch (error) {
        console.error('❌ Error in join:', error);
      }
    });

    // ===== SEND MESSAGE - CRITICAL FOR REAL-TIME MESSAGING =====
    socket.on('send-message', async (data: {
      senderId: string;
      receiverId: string;
      message: string;
      replyTo?: string;
    }) => {
      try {
        const { senderId, receiverId, message, replyTo } = data;
        const chatRoomId = generateChatRoomId(senderId, receiverId);

        console.log('📤📤📤 ===== SEND-MESSAGE EVENT RECEIVED =====');
        console.log('Sender:', senderId);
        console.log('Receiver:', receiverId);
        console.log('Message:', message);
        console.log('Chat Room ID:', chatRoomId);

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
        console.log('✅ Message saved to database. Message ID:', savedMessage._id);

        // Populate replyTo if it exists
        let messageData: any = savedMessage.toObject();
        if (savedMessage.replyTo) {
          const replyToMessage = await Message.findById(savedMessage.replyTo);
          if (replyToMessage) {
            messageData.replyTo = replyToMessage.toObject();
          }
        }

        // Update chat room with last message
        await ChatRoom.findOneAndUpdate(
          { chatRoomId },
          { lastMessage: savedMessage._id, lastMessageTime: savedMessage.timestamp }
        );

        // Prepare message payload with all required fields
        const messagePayload = {
          _id: savedMessage._id.toString(),
          chatRoomId: messageData.chatRoomId,
          senderId: messageData.senderId,
          receiverId: messageData.receiverId,
          message: messageData.message,
          status: messageData.status,
          timestamp: messageData.timestamp,
          replyTo: messageData.replyTo || null,
          isEdited: messageData.isEdited || false,
          deletedFor: messageData.deletedFor || [],
          deleteType: messageData.deleteType || 'none'
        };

        console.log('📦 Message payload prepared:', JSON.stringify(messagePayload, null, 2));

        // ===== EMIT TO RECEIVER (if receiver is different from sender) =====
        if (receiverId !== senderId) {
          const receiverRoom = io.sockets.adapter.rooms.get(receiverId);
          console.log(`📤 Emitting 'receive-message' to receiver room: ${receiverId}`);
          console.log(`   Receiver room exists: ${!!receiverRoom}`);
          
          if (receiverRoom) {
            console.log(`   Receiver room has ${receiverRoom.size} socket(s)`);
            console.log(`   Socket IDs in room:`, Array.from(receiverRoom));
          } else {
            console.warn(`   ⚠️ WARNING: Receiver room does not exist! Receiver may not be connected.`);
          }
          
          // Emit to receiver room
          io.to(receiverId).emit('receive-message', messagePayload);
          console.log(`✅✅✅ 'receive-message' emitted to receiver room: ${receiverId} ✅✅✅`);
        } else {
          console.log('ℹ️ Sender and receiver are the same, skipping receiver emission');
        }

        // ===== EMIT TO SENDER (CONFIRMATION) =====
        console.log(`📤 Emitting 'message-sent' confirmation to sender: ${senderId}`);
        // Emit directly to the socket that sent the message
        socket.emit('message-sent', messagePayload);
        // Also emit to sender's room (in case they have multiple tabs/devices)
        io.to(senderId).emit('message-sent', messagePayload);
        console.log(`✅✅✅ 'message-sent' confirmation emitted to sender: ${senderId} ✅✅✅`);

        // Check if receiver is online and update message status
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
        console.error('❌ Error in send-message:', error);
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

    // Load chat history via socket
    socket.on('load-chat-history', async (data: { userId1: string; userId2: string }) => {
      try {
        const { userId1, userId2 } = data;
        const chatRoomId = generateChatRoomId(userId1, userId2);

        console.log(`📥 Loading chat history for ${userId1} and ${userId2}`);

        const messages = await Message.find({
          chatRoomId,
          deleteType: { $ne: 'for_both' },
          $or: [
            { deletedFor: { $ne: userId1 } },
            { deletedFor: { $size: 0 } }
          ]
        })
          .populate('replyTo')
          .sort({ timestamp: 1 })
          .limit(100); // Limit to last 100 messages

        // Convert messages to plain objects with all required fields
        const messagesData = messages.map(msg => ({
          _id: msg._id.toString(),
          chatRoomId: msg.chatRoomId,
          senderId: msg.senderId,
          receiverId: msg.receiverId,
          message: msg.message,
          status: msg.status,
          timestamp: msg.timestamp,
          replyTo: msg.replyTo ? (msg.replyTo as any).toObject() : null,
          isEdited: msg.isEdited || false,
          deletedFor: msg.deletedFor || [],
          deleteType: msg.deleteType || 'none'
        }));

        socket.emit('chat-history-loaded', {
          userId1,
          userId2,
          messages: messagesData
        });

        console.log(`✅ Chat history loaded: ${messagesData.length} messages for ${userId1} and ${userId2}`);
      } catch (error) {
        console.error('❌ Error loading chat history via socket:', error);
        socket.emit('chat-history-error', { error: 'Failed to load chat history' });
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
        console.log('👋 User disconnected:', socket.id);
      } catch (error) {
        console.error('Error in disconnect:', error);
      }
    });
  });
};

export default socketHandler;
