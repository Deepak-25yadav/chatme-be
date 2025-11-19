import express, { Request, Response } from 'express';
import path from 'path';
import fs from 'fs';
import { uploadSingle, uploadMultiple } from '../middleware/upload.middleware';
import { authenticateToken, AuthRequest } from '../middleware/auth.middleware';

const router = express.Router();

// Upload single file
router.post('/upload', authenticateToken, (req: Request, res: Response) => {
  uploadSingle(req, res, (err) => {
    if (err) {
      console.error('Upload error:', err);
      return res.status(400).json({ error: err.message || 'File upload failed' });
    }

    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    // Return file info
    const fileUrl = `/api/files/${req.file.filename}`;
    res.json({
      success: true,
      file: {
        filename: req.file.filename,
        originalName: req.file.originalname,
        mimetype: req.file.mimetype,
        size: req.file.size,
        url: fileUrl
      }
    });
  });
});

// Upload multiple files
router.post('/upload-multiple', authenticateToken, (req: Request, res: Response) => {
  uploadMultiple(req, res, (err) => {
    if (err) {
      console.error('Upload error:', err);
      return res.status(400).json({ error: err.message || 'File upload failed' });
    }

    if (!req.files || !Array.isArray(req.files) || req.files.length === 0) {
      return res.status(400).json({ error: 'No files uploaded' });
    }

    // Return files info
    const filesInfo = req.files.map(file => ({
      filename: file.filename,
      originalName: file.originalname,
      mimetype: file.mimetype,
      size: file.size,
      url: `/api/files/${file.filename}`
    }));

    res.json({
      success: true,
      files: filesInfo
    });
  });
});

// Serve uploaded files
router.get('/files/:filename', (req: Request, res: Response) => {
  try {
    const filename = req.params.filename;
    const filepath = path.join(__dirname, '../../uploads', filename);

    // Check if file exists
    if (!fs.existsSync(filepath)) {
      return res.status(404).json({ error: 'File not found' });
    }

    // Send file
    res.sendFile(filepath);
  } catch (error) {
    console.error('File serve error:', error);
    res.status(500).json({ error: 'Failed to serve file' });
  }
});

// Delete file (optional - for cleanup)
router.delete('/files/:filename', authenticateToken, (req: Request, res: Response) => {
  try {
    const filename = req.params.filename;
    const filepath = path.join(__dirname, '../../uploads', filename);

    // Check if file exists
    if (!fs.existsSync(filepath)) {
      return res.status(404).json({ error: 'File not found' });
    }

    // Delete file
    fs.unlinkSync(filepath);
    res.json({ success: true, message: 'File deleted successfully' });
  } catch (error) {
    console.error('File delete error:', error);
    res.status(500).json({ error: 'Failed to delete file' });
  }
});

export default router;
