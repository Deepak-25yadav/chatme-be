import express, { Request, Response } from 'express';
import { sendActivityEmail } from '../services/emailService';

const router = express.Router();

// ── POST /api/activity/track ───────────────────────────────────────────────
// Frontend calls this on any trackable user action.
// Body: { action, data, user? }
//   action  : string  — e.g. 'home_visit', 'play', 'add', 'edit', 'delete'
//   data    : object  — action-specific payload (song info, page info, etc.)
//   user    : object  — optional { name, email, role } of the logged-in user

router.post('/track', async (req: Request, res: Response) => {
  const { action, data, user } = req.body;

  if (!action) {
    res.status(400).json({ error: 'action is required' });
    return;
  }

  // Respond immediately — don't make user wait for email
  res.json({ ok: true });

  // Fire-and-forget to admin
  sendActivityEmail(action, data || {}, user || null);
});

export default router;
