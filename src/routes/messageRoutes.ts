import express, { Request, Response } from 'express';
import Message from '../models/Message';
import ChatRoom from '../models/ChatRoom';
import User from '../models/User';
import { generateChatRoomId } from '../utils/chatRoomUtils';

const router = express.Router();

// Get chat history
router.get('/history/:userId1/:userId2', async (req: Request, res: Response) => {
  try {
    const { userId1, userId2 } = req.params;
    const chatRoomId = generateChatRoomId(userId1, userId2);

    const messages = await Message.find({
      chatRoomId,
      deleteType: { $ne: 'for_both' },
      $or: [
        { deletedFor: { $ne: userId1 } },
        { deletedFor: { $size: 0 } }
      ]
    })
      .populate('replyTo')
      .sort({ timestamp: 1 });

    res.json(messages);
  } catch (error) {
    console.error('Error fetching chat history:', error);
    res.status(500).json({ error: 'Failed to fetch chat history' });
  }
});

// Get user info
router.get('/user/:userId', async (req: Request, res: Response) => {
  try {
    const user = await User.findOne({ userId: req.params.userId });
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    res.json(user);
  } catch (error) {
    console.error('Error fetching user:', error);
    res.status(500).json({ error: 'Failed to fetch user' });
  }
});

// Create or get user
router.post('/user', async (req: Request, res: Response) => {
  try {
    const { userId, name, email, avatar } = req.body;
    const user = await User.findOneAndUpdate(
      { userId },
      { userId, name, email, avatar },
      { upsert: true, new: true }
    );
    res.json(user);
  } catch (error) {
    console.error('Error creating/updating user:', error);
    res.status(500).json({ error: 'Failed to create/update user' });
  }
});

// Get all users
router.get('/users', async (req: Request, res: Response) => {
  try {
    const users = await User.find().sort({ name: 1 });
    res.json(users);
  } catch (error) {
    console.error('Error fetching users:', error);
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

export default router;

