import mongoose, { Document, Schema } from 'mongoose';

// ─── Enums ─────────────────────────────────────────────────────────────────────

/**
 * Category represents the file/content format of the media.
 * - mp3  → standard audio file link (e.g. direct .mp3 URL)
 * - mp4  → standard video file link (e.g. direct .mp4 URL)
 * - reels → short-form vertical video (YouTube Shorts, Instagram Reels style)
 */
export enum MusicCategory {
  MP3   = 'mp3',
  MP4   = 'mp4',
  REELS = 'reels',
}

/**
 * Type is the broader media type classification.
 * - audio → music tracks, podcasts, spoken word, etc.
 * - video → full-length videos, reels, music videos, etc.
 */
export enum MusicType {
  AUDIO = 'audio',
  VIDEO = 'video',
}

// ─── Interface ─────────────────────────────────────────────────────────────────

export interface IMusicList extends Document {
  title:            string;
  description?:     string;
  url:              string;
  category:         MusicCategory;
  type:             MusicType;

  // Pinning
  pinned:           boolean;
  pinnedAt?:        Date | null;      // Set when pinned, cleared when unpinned

  // Media meta
  thumbnail?:       string;
  duration?:        string;           // e.g. "3:45" — why: display in UI without fetching media
  artist?:          string;           // why: searchable/filterable by creator / artist name
  tags?:            string[];         // why: fine-grained search beyond title/description

  // Source platform
  pickVideoUrlFrom?: string;          // e.g. "YouTube", "Spotify", "JioSaavn" — informational

  // Engagement / Analytics
  views:            number;           // why: sort by popularity; track how many times clicked/played
  likes:            number;           // why: future "like" feature; sortable metric

  // Soft-delete / visibility
  isActive:         boolean;          // why: hide without permanently deleting from DB

  // Timestamps (via { timestamps: true })
  createdAt:        Date;
  updatedAt:        Date;
}

// ─── Schema ────────────────────────────────────────────────────────────────────

const MusicListSchema: Schema = new Schema(
  {
    // ── Core fields ──────────────────────────────────────────────────────────
    title: {
      type:     String,
      required: [true, 'Title is required'],
      trim:     true,
      maxlength: [200, 'Title cannot exceed 200 characters'],
    },

    description: {
      type:     String,
      trim:     true,
      maxlength: [1000, 'Description cannot exceed 1000 characters'],
    },

    url: {
      type:     String,
      required: [true, 'Media URL is required'],
      trim:     true,
    },

    category: {
      type:     String,
      enum:     {
        values:  Object.values(MusicCategory),
        message: 'Category must be one of: mp3, mp4, reels',
      },
      required: [true, 'Category is required'],
    },

    type: {
      type:     String,
      enum:     {
        values:  Object.values(MusicType),
        message: 'Type must be one of: audio, video',
      },
      required: [true, 'Type is required'],
    },

    // ── Pinning ──────────────────────────────────────────────────────────────
    pinned: {
      type:    Boolean,
      default: false,
    },

    /**
     * pinnedAt: stores the exact moment the item was pinned.
     * Why: when multiple items are pinned, we sort by pinnedAt DESC so the
     * most-recently-pinned item always floats to the top of the pinned group.
     */
    pinnedAt: {
      type:    Date,
      default: null,
    },

    // ── Media meta ───────────────────────────────────────────────────────────
    thumbnail: {
      type:  String,
      trim:  true,
    },

    /**
     * duration: human-readable length, e.g. "4:32".
     * Why: allows the frontend to display duration in the list without having
     * to fetch/load the actual media file ahead of time.
     */
    duration: {
      type:  String,
      trim:  true,
    },

    /**
     * artist: name of the artist, band, podcast host, or content creator.
     * Why: enables artist-based search and display in UI cards.
     */
    artist: {
      type:  String,
      trim:  true,
      maxlength: [100, 'Artist name cannot exceed 100 characters'],
    },

    /**
     * tags: flexible keyword array.
     * Why: users/admins can tag items (e.g. ["lofi", "chill", "study"]) to
     * enable richer search and future tag-based filtering.
     */
    tags: {
      type:    [String],
      default: [],
    },

    // ── Source platform ──────────────────────────────────────────────────────
    /**
     * pickVideoUrlFrom: informational platform name.
     * Why: shows the user where the content comes from (YouTube, Spotify, etc.)
     * so they know what kind of player/embed to expect. Not mandatory.
     */
    pickVideoUrlFrom: {
      type:  String,
      trim:  true,
    },

    // ── Engagement / Analytics ───────────────────────────────────────────────
    /**
     * views: incremented each time a user plays or opens the item.
     * Why: enables "sort by popularity" and analytics dashboards later.
     */
    views: {
      type:    Number,
      default: 0,
      min:     0,
    },

    /**
     * likes: count of likes/upvotes.
     * Why: future "like" feature; can be used for popularity sorting.
     */
    likes: {
      type:    Number,
      default: 0,
      min:     0,
    },

    // ── Visibility / Soft-delete ─────────────────────────────────────────────
    /**
     * isActive: soft-delete flag.
     * Why: instead of hard-deleting a record (which loses history), setting
     * isActive=false hides it from public listings while preserving the data.
     * Useful for moderation / undo scenarios.
     */
    isActive: {
      type:    Boolean,
      default: true,
    },
  },
  {
    timestamps: true, // auto-manages createdAt + updatedAt
  }
);

// ─── Indexes ───────────────────────────────────────────────────────────────────

// Full-text search index on title, description, artist, and tags
MusicListSchema.index({ title: 'text', description: 'text', artist: 'text', tags: 'text' });

// Efficient listing queries (active items sorted by latest update)
MusicListSchema.index({ isActive: 1, updatedAt: -1 });

// Pinned-first sorting support
MusicListSchema.index({ pinned: -1, pinnedAt: -1, updatedAt: -1 });

// Category filtering
MusicListSchema.index({ category: 1, isActive: 1 });

// Type filtering
MusicListSchema.index({ type: 1, isActive: 1 });

// ─── Export ────────────────────────────────────────────────────────────────────

export default mongoose.model<IMusicList>('MusicList', MusicListSchema);
