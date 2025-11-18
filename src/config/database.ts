import mongoose from 'mongoose';

export const connectDB = async (): Promise<void> => {
  try {
    const dbUrl = process.env.DB_URL || '';
    await mongoose.connect(dbUrl);
    console.log('MongoDB connected successfully');
  } catch (error) {
    console.error('MongoDB connection error:', error);
    process.exit(1);
  }
};

