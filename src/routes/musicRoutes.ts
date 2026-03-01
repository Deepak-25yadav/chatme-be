import express from 'express';
import {
  getAllMusic,
  getMusicById,
  createMusic,
  updateMusic,
  togglePin,
  incrementView,
  incrementLike,
  deleteMusic,
  softDeleteMusic,
  restoreMusic,
} from '../controllers/musicController';

const router = express.Router();

// ─── Music Routes ──────────────────────────────────────────────────────────────
// Base URL: /api/music

// List all  |  Create new
router.get('/',    getAllMusic);
router.post('/',   createMusic);

// Get one  |  Edit (partial update)  |  Hard delete
router.get('/:id',    getMusicById);
router.patch('/:id',  updateMusic);
router.delete('/:id', deleteMusic);

// Convenience action routes
router.patch('/:id/pin',         togglePin);
router.patch('/:id/view',        incrementView);
router.patch('/:id/like',        incrementLike);
router.patch('/:id/soft-delete', softDeleteMusic);
router.patch('/:id/restore',     restoreMusic);

export default router;
