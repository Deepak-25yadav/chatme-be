import express, { Request, Response } from 'express';
import MusicList, { MusicCategory, MusicType } from '../models/musicList.model';

const router = express.Router();

// ─── Constants ─────────────────────────────────────────────────────────────────
const PAGE_SIZE = 10; // items per page

// ─── Helpers ───────────────────────────────────────────────────────────────────

/** Build a consistent success envelope */
const ok = (res: Response, data: object, statusCode = 200) =>
  res.status(statusCode).json({ success: true, ...data });

/** Build a consistent error envelope */
const fail = (res: Response, message: string, statusCode = 400) =>
  res.status(statusCode).json({ success: false, error: message });

// ═══════════════════════════════════════════════════════════════════════════════
//  GET /api/music
//  List all active music items
//  Query params:
//    page       (number, default 1)
//    limit      (number, default 10, max 50)
//    search     (string)  – searches title, description, artist, tags
//    category   (mp3 | mp4 | reels)
//    type       (audio | video)
//    sort       (latest | oldest)  – default: latest
//    pinned     (true)  – return only pinned items
// ═══════════════════════════════════════════════════════════════════════════════
router.get('/', async (req: Request, res: Response) => {
  try {
    // ---------- Pagination ----------
    const page  = Math.max(1, parseInt(req.query.page  as string) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit as string) || PAGE_SIZE));
    const skip  = (page - 1) * limit;

    // ---------- Base filter (always only active) ----------
    const filter: Record<string, any> = { isActive: true };

    // ---------- Search ----------
    const search = (req.query.search as string)?.trim();
    if (search) {
      filter.$text = { $search: search };
    }

    // ---------- Category filter ----------
    const category = req.query.category as string;
    if (category) {
      if (!Object.values(MusicCategory).includes(category as MusicCategory)) {
        return fail(res, `Invalid category. Must be one of: ${Object.values(MusicCategory).join(', ')}`);
      }
      filter.category = category;
    }

    // ---------- Type filter ----------
    const type = req.query.type as string;
    if (type) {
      if (!Object.values(MusicType).includes(type as MusicType)) {
        return fail(res, `Invalid type. Must be one of: ${Object.values(MusicType).join(', ')}`);
      }
      filter.type = type;
    }

    // ---------- Pinned-only filter ----------
    if (req.query.pinned === 'true') {
      filter.pinned = true;
    }

    // ---------- Sorting ----------
    // Pinned items always float to the top (pinned:-1, pinnedAt:-1).
    // Within the same pinned group, items are sorted by updatedAt.
    const sortOrder = req.query.sort === 'oldest' ? 1 : -1; // default: latest first

    const sort: Record<string, any> = {
      pinned:    -1,       // pinned items first
      pinnedAt:  -1,       // most-recently-pinned at the very top of pinned group
      updatedAt: sortOrder, // within each group, sort by updatedAt
    };

    // If text search is active, also factor in the relevance score
    const projection = search ? { score: { $meta: 'textScore' } } : {};

    // ---------- Execute query ----------
    const [items, total] = await Promise.all([
      MusicList.find(filter, projection)
        .sort(search ? { score: { $meta: 'textScore' }, ...sort } : sort)
        .skip(skip)
        .limit(limit)
        .lean(),
      MusicList.countDocuments(filter),
    ]);

    const totalPages = Math.ceil(total / limit);

    return ok(res, {
      data: items,
      pagination: {
        total,
        page,
        limit,
        totalPages,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1,
      },
    });
  } catch (error: any) {
    console.error('GET /music error:', error);
    return fail(res, 'Failed to fetch music list', 500);
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
//  GET /api/music/:id
//  Get single music item by MongoDB _id
// ═══════════════════════════════════════════════════════════════════════════════
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const item = await MusicList.findById(req.params.id).lean();
    if (!item) return fail(res, 'Music item not found', 404);
    return ok(res, { data: item });
  } catch (error: any) {
    console.error('GET /music/:id error:', error);
    if (error.name === 'CastError') return fail(res, 'Invalid ID format', 400);
    return fail(res, 'Failed to fetch music item', 500);
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
//  POST /api/music
//  Create a new music item
//  Body: { title, url, category, type, description?, thumbnail?,
//          duration?, artist?, tags?, pickVideoUrlFrom?, pinned? }
// ═══════════════════════════════════════════════════════════════════════════════
router.post('/', async (req: Request, res: Response) => {
  try {
    const {
      title,
      description,
      url,
      category,
      type,
      pinned,
      thumbnail,
      duration,
      artist,
      tags,
      pickVideoUrlFrom,
    } = req.body;

    // ---------- Required field validation ----------
    if (!title?.trim())    return fail(res, 'Title is required');
    if (!url?.trim())      return fail(res, 'URL is required');
    if (!category)         return fail(res, 'Category is required (mp3 | mp4 | reels)');
    if (!type)             return fail(res, 'Type is required (audio | video)');

    if (!Object.values(MusicCategory).includes(category)) {
      return fail(res, `Invalid category. Must be one of: ${Object.values(MusicCategory).join(', ')}`);
    }
    if (!Object.values(MusicType).includes(type)) {
      return fail(res, `Invalid type. Must be one of: ${Object.values(MusicType).join(', ')}`);
    }

    // ---------- Build document ----------
    const isPinned = pinned === true || pinned === 'true';

    const newItem = new MusicList({
      title:            title.trim(),
      description:      description?.trim(),
      url:              url.trim(),
      category,
      type,
      pinned:           isPinned,
      pinnedAt:         isPinned ? new Date() : null,
      thumbnail:        thumbnail?.trim(),
      duration:         duration?.trim(),
      artist:           artist?.trim(),
      tags:             Array.isArray(tags) ? tags.map((t: string) => t.trim()).filter(Boolean) : [],
      pickVideoUrlFrom: pickVideoUrlFrom?.trim(),
    });

    const saved = await newItem.save();
    return ok(res, { data: saved, message: 'Music item created successfully' }, 201);
  } catch (error: any) {
    console.error('POST /music error:', error);
    if (error.name === 'ValidationError') {
      const messages = Object.values(error.errors).map((e: any) => e.message);
      return fail(res, messages.join(', '));
    }
    return fail(res, 'Failed to create music item', 500);
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
//  PATCH /api/music/:id
//  Update (partial edit) a music item — used by the Edit Modal
//  All body fields are optional; only provided fields are updated
// ═══════════════════════════════════════════════════════════════════════════════
router.patch('/:id', async (req: Request, res: Response) => {
  try {
    const existing = await MusicList.findById(req.params.id);
    if (!existing) return fail(res, 'Music item not found', 404);

    const {
      title,
      description,
      url,
      category,
      type,
      pinned,
      thumbnail,
      duration,
      artist,
      tags,
      pickVideoUrlFrom,
      isActive,
    } = req.body;

    // ---------- Validate enums only when provided ----------
    if (category && !Object.values(MusicCategory).includes(category)) {
      return fail(res, `Invalid category. Must be one of: ${Object.values(MusicCategory).join(', ')}`);
    }
    if (type && !Object.values(MusicType).includes(type)) {
      return fail(res, `Invalid type. Must be one of: ${Object.values(MusicType).join(', ')}`);
    }

    // ---------- Apply updates ----------
    if (title        !== undefined) existing.title            = title.trim();
    if (description  !== undefined) existing.description      = description?.trim();
    if (url          !== undefined) existing.url              = url.trim();
    if (category     !== undefined) existing.category         = category;
    if (type         !== undefined) existing.type             = type;
    if (thumbnail    !== undefined) existing.thumbnail        = thumbnail?.trim();
    if (duration     !== undefined) existing.duration         = duration?.trim();
    if (artist       !== undefined) existing.artist           = artist?.trim();
    if (pickVideoUrlFrom !== undefined) existing.pickVideoUrlFrom = pickVideoUrlFrom?.trim();
    if (isActive     !== undefined) existing.isActive         = Boolean(isActive);

    if (tags !== undefined) {
      existing.tags = Array.isArray(tags)
        ? tags.map((t: string) => t.trim()).filter(Boolean)
        : [];
    }

    // ---------- Handle pinning toggle ----------
    if (pinned !== undefined) {
      const newPinned = pinned === true || pinned === 'true';
      if (newPinned && !existing.pinned) {
        // Pinning now → record the exact time so it sits at top of pinned group
        existing.pinned   = true;
        existing.pinnedAt = new Date();
      } else if (!newPinned) {
        // Unpinning → clear pinnedAt
        existing.pinned   = false;
        existing.pinnedAt = null;
      }
    }

    const updated = await existing.save();
    return ok(res, { data: updated, message: 'Music item updated successfully' });
  } catch (error: any) {
    console.error('PATCH /music/:id error:', error);
    if (error.name === 'CastError')       return fail(res, 'Invalid ID format', 400);
    if (error.name === 'ValidationError') {
      const messages = Object.values(error.errors).map((e: any) => e.message);
      return fail(res, messages.join(', '));
    }
    return fail(res, 'Failed to update music item', 500);
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
//  PATCH /api/music/:id/pin
//  Quick-toggle pinned state (convenience endpoint for frontend pin button)
// ═══════════════════════════════════════════════════════════════════════════════
router.patch('/:id/pin', async (req: Request, res: Response) => {
  try {
    const item = await MusicList.findById(req.params.id);
    if (!item) return fail(res, 'Music item not found', 404);

    item.pinned   = !item.pinned;
    item.pinnedAt = item.pinned ? new Date() : null;

    const updated = await item.save();
    return ok(res, {
      data:    updated,
      message: `Music item ${updated.pinned ? 'pinned' : 'unpinned'} successfully`,
    });
  } catch (error: any) {
    console.error('PATCH /music/:id/pin error:', error);
    if (error.name === 'CastError') return fail(res, 'Invalid ID format', 400);
    return fail(res, 'Failed to toggle pin', 500);
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
//  PATCH /api/music/:id/view
//  Increment view count — call this each time a user plays/opens an item
// ═══════════════════════════════════════════════════════════════════════════════
router.patch('/:id/view', async (req: Request, res: Response) => {
  try {
    const updated = await MusicList.findByIdAndUpdate(
      req.params.id,
      { $inc: { views: 1 } },
      { new: true }
    ).lean();

    if (!updated) return fail(res, 'Music item not found', 404);
    return ok(res, { data: { views: updated.views }, message: 'View count updated' });
  } catch (error: any) {
    console.error('PATCH /music/:id/view error:', error);
    if (error.name === 'CastError') return fail(res, 'Invalid ID format', 400);
    return fail(res, 'Failed to update view count', 500);
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
//  PATCH /api/music/:id/like
//  Increment like count
// ═══════════════════════════════════════════════════════════════════════════════
router.patch('/:id/like', async (req: Request, res: Response) => {
  try {
    const updated = await MusicList.findByIdAndUpdate(
      req.params.id,
      { $inc: { likes: 1 } },
      { new: true }
    ).lean();

    if (!updated) return fail(res, 'Music item not found', 404);
    return ok(res, { data: { likes: updated.likes }, message: 'Liked successfully' });
  } catch (error: any) {
    console.error('PATCH /music/:id/like error:', error);
    if (error.name === 'CastError') return fail(res, 'Invalid ID format', 400);
    return fail(res, 'Failed to like music item', 500);
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
//  DELETE /api/music/:id
//  Hard delete a music item permanently from the database
// ═══════════════════════════════════════════════════════════════════════════════
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const deleted = await MusicList.findByIdAndDelete(req.params.id).lean();
    if (!deleted) return fail(res, 'Music item not found', 404);
    return ok(res, { message: 'Music item deleted permanently' });
  } catch (error: any) {
    console.error('DELETE /music/:id error:', error);
    if (error.name === 'CastError') return fail(res, 'Invalid ID format', 400);
    return fail(res, 'Failed to delete music item', 500);
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
//  PATCH /api/music/:id/soft-delete
//  Soft delete — sets isActive=false (item hidden but data preserved)
// ═══════════════════════════════════════════════════════════════════════════════
router.patch('/:id/soft-delete', async (req: Request, res: Response) => {
  try {
    const updated = await MusicList.findByIdAndUpdate(
      req.params.id,
      { isActive: false },
      { new: true }
    ).lean();

    if (!updated) return fail(res, 'Music item not found', 404);
    return ok(res, { message: 'Music item hidden (soft deleted)' });
  } catch (error: any) {
    console.error('PATCH /music/:id/soft-delete error:', error);
    if (error.name === 'CastError') return fail(res, 'Invalid ID format', 400);
    return fail(res, 'Failed to soft-delete music item', 500);
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
//  PATCH /api/music/:id/restore
//  Restore a soft-deleted item — sets isActive=true
// ═══════════════════════════════════════════════════════════════════════════════
router.patch('/:id/restore', async (req: Request, res: Response) => {
  try {
    const updated = await MusicList.findByIdAndUpdate(
      req.params.id,
      { isActive: true },
      { new: true }
    ).lean();

    if (!updated) return fail(res, 'Music item not found', 404);
    return ok(res, { data: updated, message: 'Music item restored successfully' });
  } catch (error: any) {
    console.error('PATCH /music/:id/restore error:', error);
    if (error.name === 'CastError') return fail(res, 'Invalid ID format', 400);
    return fail(res, 'Failed to restore music item', 500);
  }
});

export default router;
