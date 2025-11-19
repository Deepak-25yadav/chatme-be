import express, { Request, Response } from 'express';
import User, { UserRole } from '../models/User';
import { generateToken, generateRefreshToken, authenticateToken, AuthRequest } from '../middleware/auth.middleware';
import { v4 as uuidv4 } from 'uuid';

const router = express.Router();

// Signup
router.post('/signup', async (req: Request, res: Response) => {
  try {
    const { name, email, password, role } = req.body;

    // Validate required fields
    if (!name || !email || !password) {
      res.status(400).json({ error: 'Name, email, and password are required' });
      return;
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      res.status(400).json({ error: 'Invalid email format' });
      return;
    }

    // Validate password length
    if (password.length < 6) {
      res.status(400).json({ error: 'Password must be at least 6 characters long' });
      return;
    }

    // Check if email already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      res.status(400).json({ error: 'Email already registered' });
      return;
    }

    // If trying to register as admin, check if admin already exists
    if (role === UserRole.ADMIN) {
      const adminExists = await User.findOne({ role: UserRole.ADMIN });
      if (adminExists) {
        res.status(400).json({ 
          error: 'Admin account already exists. Only one admin is allowed.' 
        });
        return;
      }
    }

    // Generate unique userId
    const userId = uuidv4();

    // Create new user
    const user = new User({
      userId,
      name,
      email,
      password, // Will be hashed by pre-save hook
      role: role === UserRole.ADMIN ? UserRole.ADMIN : UserRole.USER,
      avatar: `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=random`
    });

    await user.save();

    // Generate tokens
    const token = generateToken(user.userId, user.email, user.role);
    const refreshToken = generateRefreshToken(user.userId);

    // Save refresh token
    user.refreshToken = refreshToken;
    await user.save();

    // Return user data (without password)
    res.status(201).json({
      message: 'User registered successfully',
      user: {
        userId: user.userId,
        name: user.name,
        email: user.email,
        role: user.role,
        avatar: user.avatar
      },
      token,
      refreshToken
    });
  } catch (error) {
    console.error('Signup error:', error);
    res.status(500).json({ error: 'Failed to register user' });
  }
});

// Login
router.post('/login', async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;

    // Validate required fields
    if (!email || !password) {
      res.status(400).json({ error: 'Email and password are required' });
      return;
    }

    // Find user by email (include password field)
    const user = await User.findOne({ email }).select('+password');
    if (!user) {
      res.status(401).json({ error: 'Invalid email or password' });
      return;
    }

    // Check password
    const isPasswordValid = await user.comparePassword(password);
    if (!isPasswordValid) {
      res.status(401).json({ error: 'Invalid email or password' });
      return;
    }

    // Generate tokens
    const token = generateToken(user.userId, user.email, user.role);
    const refreshToken = generateRefreshToken(user.userId);

    // Save refresh token
    user.refreshToken = refreshToken;
    await user.save();

    // Return user data (without password)
    res.json({
      message: 'Login successful',
      user: {
        userId: user.userId,
        name: user.name,
        email: user.email,
        role: user.role,
        avatar: user.avatar,
        isOnline: user.isOnline,
        lastSeen: user.lastSeen
      },
      token,
      refreshToken
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Failed to login' });
  }
});

// Logout
router.post('/logout', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }

    // Clear refresh token
    await User.findOneAndUpdate(
      { userId: req.user.userId },
      { refreshToken: null }
    );

    res.json({ message: 'Logout successful' });
  } catch (error) {
    console.error('Logout error:', error);
    res.status(500).json({ error: 'Failed to logout' });
  }
});

// Get current user
router.get('/me', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }

    const user = await User.findOne({ userId: req.user.userId });
    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    res.json({
      userId: user.userId,
      name: user.name,
      email: user.email,
      role: user.role,
      avatar: user.avatar,
      isOnline: user.isOnline,
      lastSeen: user.lastSeen
    });
  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({ error: 'Failed to get user info' });
  }
});

// Refresh token
router.post('/refresh', async (req: Request, res: Response) => {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      res.status(400).json({ error: 'Refresh token required' });
      return;
    }

    // Find user with this refresh token
    const user = await User.findOne({ refreshToken }).select('+refreshToken');
    if (!user) {
      res.status(403).json({ error: 'Invalid refresh token' });
      return;
    }

    // Generate new tokens
    const token = generateToken(user.userId, user.email, user.role);
    const newRefreshToken = generateRefreshToken(user.userId);

    // Update refresh token
    user.refreshToken = newRefreshToken;
    await user.save();

    res.json({
      token,
      refreshToken: newRefreshToken
    });
  } catch (error) {
    console.error('Refresh token error:', error);
    res.status(500).json({ error: 'Failed to refresh token' });
  }
});

export default router;
