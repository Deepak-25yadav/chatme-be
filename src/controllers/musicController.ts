import { Request, Response } from 'express';
import MusicList, { MusicCategory, MusicType } from '../models/musicList.model';

// ─── Constants ─────────────────────────────────────────────────────────────────

const PAGE_SIZE = 10; // default items per page

// ─── Helpers ───────────────────────────────────────────────────────────────────

/** Send a consistent success response */
const ok = (res: Response, data: object, statusCode = 200): Response =>
  res.status(statusCode).json({ success: true, ...data });

/** Send a consistent error response */
const fail = (res: Response, message: string, statusCode = 400): Response =>
  res.status(statusCode).json({ success: false, error: message });

// ═══════════════════════════════════════════════════════════════════════════════
//  GET /api/music
//  List all active music items with search, filter, sort, pagination
// ═══════════════════════════════════════════════════════════════════════════════
export const getAllMusic = async (req: Request, res: Response): Promise<void> => {
  try {
    // ---------- Pagination ----------
    const page  = Math.max(1, parseInt(req.query.page  as string) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit as string) || PAGE_SIZE));
    const skip  = (page - 1) * limit;

    // ---------- Base filter (always only active records) ----------
    const filter: Record<string, any> = { isActive: true };

    // ---------- Full-text Search ----------
    // Searches across: title, description, artist, tags (via MongoDB $text index)
    const search = (req.query.search as string)?.trim();
    if (search) {
      filter.$text = { $search: search };
    }

    // ---------- Category filter ----------
    const category = req.query.category as string;
    if (category) {
      if (!Object.values(MusicCategory).includes(category as MusicCategory)) {
        res.status(400).json({
          success: false,
          error: `Invalid category. Must be one of: ${Object.values(MusicCategory).join(', ')}`,
        });
        return;
      }
      filter.category = category;
    }

    // ---------- Type filter ----------
    const type = req.query.type as string;
    if (type) {
      if (!Object.values(MusicType).includes(type as MusicType)) {
        res.status(400).json({
          success: false,
          error: `Invalid type. Must be one of: ${Object.values(MusicType).join(', ')}`,
        });
        return;
      }
      filter.type = type;
    }

    // ---------- Pinned-only filter ----------
    if (req.query.pinned === 'true') {
      filter.pinned = true;
    }

    // ---------- Sorting ----------
    // Pinned items always float to top → sorted by pinnedAt DESC within that group
    // Non-pinned items are sorted by updatedAt (latest or oldest)
    const sortOrder = req.query.sort === 'oldest' ? 1 : -1; // default: latest first

    const sort: Record<string, any> = {
      pinned:    -1,        // pinned items always first
      pinnedAt:  -1,        // most-recently-pinned sits at the very top of pinned group
      updatedAt: sortOrder, // within each group, sort by last update time
    };

    // Include text relevance score in projection when searching
    const projection = search ? { score: { $meta: 'textScore' } } : {};

    // ---------- Execute queries in parallel ----------
    const [items, total] = await Promise.all([
      MusicList.find(filter, projection)
        .sort(search ? { score: { $meta: 'textScore' }, ...sort } : sort)
        .skip(skip)
        .limit(limit)
        .lean(),
      MusicList.countDocuments(filter),
    ]);

    const totalPages = Math.ceil(total / limit);

    ok(res, {
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
    console.error('getAllMusic error:', error);
    fail(res, 'Failed to fetch music list', 500);
  }
};

// ═══════════════════════════════════════════════════════════════════════════════
//  GET /api/music/:id
//  Fetch a single music item by its MongoDB _id
// ═══════════════════════════════════════════════════════════════════════════════
export const getMusicById = async (req: Request, res: Response): Promise<void> => {
  try {
    const item = await MusicList.findById(req.params.id).lean();
    if (!item) {
      fail(res, 'Music item not found', 404);
      return;
    }
    ok(res, { data: item });
  } catch (error: any) {
    console.error('getMusicById error:', error);
    if (error.name === 'CastError') {
      fail(res, 'Invalid ID format', 400);
      return;
    }
    fail(res, 'Failed to fetch music item', 500);
  }
};

// ═══════════════════════════════════════════════════════════════════════════════
//  POST /api/music
//  Create a new music item (used by Create Modal on frontend)
// ═══════════════════════════════════════════════════════════════════════════════
export const createMusic = async (req: Request, res: Response): Promise<void> => {
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
    if (!title?.trim()) {
      fail(res, 'Title is required');
      return;
    }
    if (!url?.trim()) {
      fail(res, 'URL is required');
      return;
    }
    if (!category) {
      fail(res, 'Category is required (mp3 | mp4 | reels)');
      return;
    }
    if (!type) {
      fail(res, 'Type is required (audio | video)');
      return;
    }

    if (!Object.values(MusicCategory).includes(category)) {
      fail(res, `Invalid category. Must be one of: ${Object.values(MusicCategory).join(', ')}`);
      return;
    }
    if (!Object.values(MusicType).includes(type)) {
      fail(res, `Invalid type. Must be one of: ${Object.values(MusicType).join(', ')}`);
      return;
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
    ok(res, { data: saved, message: 'Music item created successfully' }, 201);
  } catch (error: any) {
    console.error('createMusic error:', error);
    if (error.name === 'ValidationError') {
      const messages = Object.values(error.errors).map((e: any) => e.message);
      fail(res, messages.join(', '));
      return;
    }
    fail(res, 'Failed to create music item', 500);
  }
};

// ═══════════════════════════════════════════════════════════════════════════════
//  PATCH /api/music/:id
//  Partial update of a music item (used by Edit Modal on frontend)
//  Only the fields provided in the request body are updated
// ═══════════════════════════════════════════════════════════════════════════════
export const updateMusic = async (req: Request, res: Response): Promise<void> => {
  try {
    const existing = await MusicList.findById(req.params.id);
    if (!existing) {
      fail(res, 'Music item not found', 404);
      return;
    }

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

    // ---------- Validate enums only if provided ----------
    if (category && !Object.values(MusicCategory).includes(category)) {
      fail(res, `Invalid category. Must be one of: ${Object.values(MusicCategory).join(', ')}`);
      return;
    }
    if (type && !Object.values(MusicType).includes(type)) {
      fail(res, `Invalid type. Must be one of: ${Object.values(MusicType).join(', ')}`);
      return;
    }

    // ---------- Apply updates (only fields that were sent) ----------
    if (title            !== undefined) existing.title            = title.trim();
    if (description      !== undefined) existing.description      = description?.trim();
    if (url              !== undefined) existing.url              = url.trim();
    if (category         !== undefined) existing.category         = category;
    if (type             !== undefined) existing.type             = type;
    if (thumbnail        !== undefined) existing.thumbnail        = thumbnail?.trim();
    if (duration         !== undefined) existing.duration         = duration?.trim();
    if (artist           !== undefined) existing.artist           = artist?.trim();
    if (pickVideoUrlFrom !== undefined) existing.pickVideoUrlFrom = pickVideoUrlFrom?.trim();
    if (isActive         !== undefined) existing.isActive         = Boolean(isActive);

    if (tags !== undefined) {
      existing.tags = Array.isArray(tags)
        ? tags.map((t: string) => t.trim()).filter(Boolean)
        : [];
    }

    // ---------- Handle pinning toggle ----------
    if (pinned !== undefined) {
      const newPinned = pinned === true || pinned === 'true';
      if (newPinned && !existing.pinned) {
        // Pinning: stamp the exact moment so it lands at top of pinned group
        existing.pinned   = true;
        existing.pinnedAt = new Date();
      } else if (!newPinned) {
        // Unpinning: clear pinnedAt so it no longer participates in pin sort
        existing.pinned   = false;
        existing.pinnedAt = null;
      }
    }

    const updated = await existing.save();
    ok(res, { data: updated, message: 'Music item updated successfully' });
  } catch (error: any) {
    console.error('updateMusic error:', error);
    if (error.name === 'CastError') {
      fail(res, 'Invalid ID format', 400);
      return;
    }
    if (error.name === 'ValidationError') {
      const messages = Object.values(error.errors).map((e: any) => e.message);
      fail(res, messages.join(', '));
      return;
    }
    fail(res, 'Failed to update music item', 500);
  }
};

// ═══════════════════════════════════════════════════════════════════════════════
//  PATCH /api/music/:id/pin
//  Quick-toggle pin state — no body needed (auto-flips pinned true ↔ false)
// ═══════════════════════════════════════════════════════════════════════════════
export const togglePin = async (req: Request, res: Response): Promise<void> => {
  try {
    const item = await MusicList.findById(req.params.id);
    if (!item) {
      fail(res, 'Music item not found', 404);
      return;
    }

    item.pinned   = !item.pinned;
    item.pinnedAt = item.pinned ? new Date() : null;

    const updated = await item.save();
    ok(res, {
      data:    updated,
      message: `Music item ${updated.pinned ? 'pinned' : 'unpinned'} successfully`,
    });
  } catch (error: any) {
    console.error('togglePin error:', error);
    if (error.name === 'CastError') {
      fail(res, 'Invalid ID format', 400);
      return;
    }
    fail(res, 'Failed to toggle pin', 500);
  }
};

// ═══════════════════════════════════════════════════════════════════════════════
//  PATCH /api/music/:id/view
//  Increment view count by 1 — call whenever a user plays / opens an item
// ═══════════════════════════════════════════════════════════════════════════════
export const incrementView = async (req: Request, res: Response): Promise<void> => {
  try {
    const updated = await MusicList.findByIdAndUpdate(
      req.params.id,
      { $inc: { views: 1 } },
      { new: true }
    ).lean();

    if (!updated) {
      fail(res, 'Music item not found', 404);
      return;
    }
    ok(res, { data: { views: updated.views }, message: 'View count updated' });
  } catch (error: any) {
    console.error('incrementView error:', error);
    if (error.name === 'CastError') {
      fail(res, 'Invalid ID format', 400);
      return;
    }
    fail(res, 'Failed to update view count', 500);
  }
};

// ═══════════════════════════════════════════════════════════════════════════════
//  PATCH /api/music/:id/like
//  Increment like count by 1
// ═══════════════════════════════════════════════════════════════════════════════
export const incrementLike = async (req: Request, res: Response): Promise<void> => {
  try {
    const updated = await MusicList.findByIdAndUpdate(
      req.params.id,
      { $inc: { likes: 1 } },
      { new: true }
    ).lean();

    if (!updated) {
      fail(res, 'Music item not found', 404);
      return;
    }
    ok(res, { data: { likes: updated.likes }, message: 'Liked successfully' });
  } catch (error: any) {
    console.error('incrementLike error:', error);
    if (error.name === 'CastError') {
      fail(res, 'Invalid ID format', 400);
      return;
    }
    fail(res, 'Failed to like music item', 500);
  }
};

// ═══════════════════════════════════════════════════════════════════════════════
//  DELETE /api/music/:id
//  Hard delete — permanently removes the document from the database
// ═══════════════════════════════════════════════════════════════════════════════
export const deleteMusic = async (req: Request, res: Response): Promise<void> => {
  try {
    const deleted = await MusicList.findByIdAndDelete(req.params.id).lean();
    if (!deleted) {
      fail(res, 'Music item not found', 404);
      return;
    }
    ok(res, { message: 'Music item deleted permanently' });
  } catch (error: any) {
    console.error('deleteMusic error:', error);
    if (error.name === 'CastError') {
      fail(res, 'Invalid ID format', 400);
      return;
    }
    fail(res, 'Failed to delete music item', 500);
  }
};

// ═══════════════════════════════════════════════════════════════════════════════
//  PATCH /api/music/:id/soft-delete
//  Soft delete — sets isActive=false so item is hidden from listings
//  Data is preserved in the database and can be restored anytime
// ═══════════════════════════════════════════════════════════════════════════════
export const softDeleteMusic = async (req: Request, res: Response): Promise<void> => {
  try {
    const updated = await MusicList.findByIdAndUpdate(
      req.params.id,
      { isActive: false },
      { new: true }
    ).lean();

    if (!updated) {
      fail(res, 'Music item not found', 404);
      return;
    }
    ok(res, { message: 'Music item hidden (soft deleted)' });
  } catch (error: any) {
    console.error('softDeleteMusic error:', error);
    if (error.name === 'CastError') {
      fail(res, 'Invalid ID format', 400);
      return;
    }
    fail(res, 'Failed to soft-delete music item', 500);
  }
};

// ═══════════════════════════════════════════════════════════════════════════════
//  PATCH /api/music/:id/restore
//  Restore a soft-deleted item — sets isActive=true so it reappears in listings
// ═══════════════════════════════════════════════════════════════════════════════
export const restoreMusic = async (req: Request, res: Response): Promise<void> => {
  try {
    const updated = await MusicList.findByIdAndUpdate(
      req.params.id,
      { isActive: true },
      { new: true }
    ).lean();

    if (!updated) {
      fail(res, 'Music item not found', 404);
      return;
    }
    ok(res, { data: updated, message: 'Music item restored successfully' });
  } catch (error: any) {
    console.error('restoreMusic error:', error);
    if (error.name === 'CastError') {
      fail(res, 'Invalid ID format', 400);
      return;
    }
    fail(res, 'Failed to restore music item', 500);
  }
};
