# 🎵 MusicList API – Postman Testing Guide

> **Base URL**: `http://localhost:3000`  
> **All endpoints are PUBLIC** — no Authorization header required.  
> **Content-Type**: `application/json` (for all POST / PATCH requests)

---

## 📋 Table of Contents

| # | Method | Endpoint | Description |
|---|--------|----------|-------------|
| 1 | GET | `/api/music` | List all music (search / filter / sort / paginate) |
| 2 | GET | `/api/music/:id` | Get single music item |
| 3 | POST | `/api/music` | ➕ Create new music item |
| 4 | PATCH | `/api/music/:id` | ✏️ Edit music item (Edit Modal) |
| 5 | PATCH | `/api/music/:id/pin` | 📌 Toggle pinned state |
| 6 | PATCH | `/api/music/:id/view` | 👁️ Increment view count |
| 7 | PATCH | `/api/music/:id/like` | ❤️ Increment like count |
| 8 | PATCH | `/api/music/:id/soft-delete` | 🙈 Soft delete (hide item) |
| 9 | PATCH | `/api/music/:id/restore` | 🔄 Restore soft-deleted item |
| 10 | DELETE | `/api/music/:id` | 🗑️ Hard delete (permanent) |

---

## 1️⃣ GET `/api/music` — List Music Items

### Basic Request (no filters)
```
GET http://localhost:3000/api/music
```

### ✅ Success Response
```json
{
  "success": true,
  "data": [
    {
      "_id": "65f1a2b3c4d5e6f7a8b9c0d1",
      "title": "Blinding Lights",
      "description": "The Weeknd - Blinding Lights",
      "url": "https://www.youtube.com/watch?v=4NRXx6U8ABQ",
      "category": "mp4",
      "type": "video",
      "pinned": true,
      "pinnedAt": "2026-03-01T10:00:00.000Z",
      "thumbnail": "https://img.youtube.com/vi/4NRXx6U8ABQ/hqdefault.jpg",
      "duration": "3:22",
      "artist": "The Weeknd",
      "tags": ["pop", "synth"],
      "pickVideoUrlFrom": "YouTube",
      "views": 42,
      "likes": 15,
      "isActive": true,
      "createdAt": "2026-03-01T09:00:00.000Z",
      "updatedAt": "2026-03-01T10:00:00.000Z"
    }
  ],
  "pagination": {
    "total": 25,
    "page": 1,
    "limit": 10,
    "totalPages": 3,
    "hasNextPage": true,
    "hasPrevPage": false
  }
}
```

---

### 🔍 With Search (title / description / artist / tags)
```
GET http://localhost:3000/api/music?search=weeknd
GET http://localhost:3000/api/music?search=lofi+chill
```

### 📂 With Category Filter
```
GET http://localhost:3000/api/music?category=mp3
GET http://localhost:3000/api/music?category=mp4
GET http://localhost:3000/api/music?category=reels
```

### 🎵 With Type Filter
```
GET http://localhost:3000/api/music?type=audio
GET http://localhost:3000/api/music?type=video
```

### ⏰ With Sort
```
GET http://localhost:3000/api/music?sort=latest     ← newest updatedAt first (default)
GET http://localhost:3000/api/music?sort=oldest     ← oldest updatedAt first
```

### 📌 Pinned Items Only
```
GET http://localhost:3000/api/music?pinned=true
```

### 📄 Pagination
```
GET http://localhost:3000/api/music?page=1&limit=10      ← page 1, 10 per page
GET http://localhost:3000/api/music?page=2&limit=10      ← page 2
GET http://localhost:3000/api/music?page=1&limit=5       ← page 1, 5 per page (min)
```

### 🔗 Combined Filters
```
GET http://localhost:3000/api/music?search=chill&category=mp3&sort=latest&page=1&limit=10
GET http://localhost:3000/api/music?type=video&sort=oldest&page=2
GET http://localhost:3000/api/music?category=reels&pinned=true
```

### ❌ Error: Invalid category
```json
{
  "success": false,
  "error": "Invalid category. Must be one of: mp3, mp4, reels"
}
```

---

## 2️⃣ GET `/api/music/:id` — Get Single Item

```
GET http://localhost:3000/api/music/65f1a2b3c4d5e6f7a8b9c0d1
```

### ✅ Success Response
```json
{
  "success": true,
  "data": {
    "_id": "65f1a2b3c4d5e6f7a8b9c0d1",
    "title": "Blinding Lights",
    ...
  }
}
```

### ❌ Error: Not Found
```json
{
  "success": false,
  "error": "Music item not found"
}
```

### ❌ Error: Invalid ID
```json
{
  "success": false,
  "error": "Invalid ID format"
}
```

---

## 3️⃣ POST `/api/music` — Create Music Item (Create Modal)

```
POST http://localhost:3000/api/music
Content-Type: application/json
```

### Minimum Required Body
```json
{
  "title": "Blinding Lights",
  "url": "https://www.youtube.com/watch?v=4NRXx6U8ABQ",
  "category": "mp4",
  "type": "video"
}
```

### Full Body (all fields)
```json
{
  "title": "Blinding Lights",
  "description": "The Weeknd - Blinding Lights (Official Video)",
  "url": "https://www.youtube.com/watch?v=4NRXx6U8ABQ",
  "category": "mp4",
  "type": "video",
  "pinned": true,
  "thumbnail": "https://img.youtube.com/vi/4NRXx6U8ABQ/hqdefault.jpg",
  "duration": "3:22",
  "artist": "The Weeknd",
  "tags": ["pop", "synth", "retro"],
  "pickVideoUrlFrom": "YouTube"
}
```

### Body for Audio (mp3)
```json
{
  "title": "Kesariya",
  "description": "Brahmastra | Arijit Singh",
  "url": "https://www.jiosaavn.com/song/kesariya/...",
  "category": "mp3",
  "type": "audio",
  "artist": "Arijit Singh",
  "thumbnail": "https://...",
  "duration": "4:28",
  "tags": ["bollywood", "romantic"],
  "pickVideoUrlFrom": "JioSaavn"
}
```

### Body for Reels
```json
{
  "title": "Chill Beats Reel",
  "url": "https://www.youtube.com/shorts/abc123",
  "category": "reels",
  "type": "video",
  "artist": "LoFi Music",
  "tags": ["shorts", "lofi"],
  "pickVideoUrlFrom": "YouTube Shorts"
}
```

### ✅ Success Response (201 Created)
```json
{
  "success": true,
  "data": {
    "_id": "65f1a2b3c4d5e6f7a8b9c0d1",
    "title": "Blinding Lights",
    "url": "https://www.youtube.com/watch?v=4NRXx6U8ABQ",
    "category": "mp4",
    "type": "video",
    "pinned": true,
    "pinnedAt": "2026-03-01T10:00:00.000Z",
    "views": 0,
    "likes": 0,
    "isActive": true,
    "createdAt": "2026-03-01T10:00:00.000Z",
    "updatedAt": "2026-03-01T10:00:00.000Z"
  },
  "message": "Music item created successfully"
}
```

### ❌ Error: Missing required fields
```json
{
  "success": false,
  "error": "Title is required"
}
```

### ❌ Error: Invalid category
```json
{
  "success": false,
  "error": "Invalid category. Must be one of: mp3, mp4, reels"
}
```

---

## 4️⃣ PATCH `/api/music/:id` — Edit Music Item (Edit Modal)

> Send **only the fields you want to update** — unspecified fields stay unchanged.

```
PATCH http://localhost:3000/api/music/65f1a2b3c4d5e6f7a8b9c0d1
Content-Type: application/json
```

### Edit title and description only
```json
{
  "title": "Blinding Lights (Edited)",
  "description": "Updated description here"
}
```

### Edit URL and platform
```json
{
  "url": "https://open.spotify.com/track/0VjIjW4GlUZAMYd2vXMi3b",
  "pickVideoUrlFrom": "Spotify"
}
```

### Edit category and type
```json
{
  "category": "mp3",
  "type": "audio"
}
```

### Edit tags
```json
{
  "tags": ["chill", "lofi", "study"]
}
```

### Pin an item via edit (also sets pinnedAt)
```json
{
  "pinned": true
}
```

### Unpin an item via edit (also clears pinnedAt)
```json
{
  "pinned": false
}
```

### ✅ Success Response
```json
{
  "success": true,
  "data": {
    "_id": "65f1a2b3c4d5e6f7a8b9c0d1",
    "title": "Blinding Lights (Edited)",
    ...
  },
  "message": "Music item updated successfully"
}
```

---

## 5️⃣ PATCH `/api/music/:id/pin` — Toggle Pin (Quick Pin Button)

> No body needed — it auto-toggles pinned true ↔ false.

```
PATCH http://localhost:3000/api/music/65f1a2b3c4d5e6f7a8b9c0d1/pin
```

### ✅ Success Response (when pinning)
```json
{
  "success": true,
  "data": { "pinned": true, "pinnedAt": "2026-03-01T10:30:00.000Z", ... },
  "message": "Music item pinned successfully"
}
```

### ✅ Success Response (when unpinning)
```json
{
  "success": true,
  "data": { "pinned": false, "pinnedAt": null, ... },
  "message": "Music item unpinned successfully"
}
```

---

## 6️⃣ PATCH `/api/music/:id/view` — Increment View Count

> Call this every time a user plays / opens a music item.

```
PATCH http://localhost:3000/api/music/65f1a2b3c4d5e6f7a8b9c0d1/view
```

### ✅ Success Response
```json
{
  "success": true,
  "data": { "views": 43 },
  "message": "View count updated"
}
```

---

## 7️⃣ PATCH `/api/music/:id/like` — Increment Like Count

```
PATCH http://localhost:3000/api/music/65f1a2b3c4d5e6f7a8b9c0d1/like
```

### ✅ Success Response
```json
{
  "success": true,
  "data": { "likes": 16 },
  "message": "Liked successfully"
}
```

---

## 8️⃣ PATCH `/api/music/:id/soft-delete` — Soft Delete (Hide Item)

> Sets `isActive = false`. Item is hidden from all GET listings but stays in DB.

```
PATCH http://localhost:3000/api/music/65f1a2b3c4d5e6f7a8b9c0d1/soft-delete
```

### ✅ Success Response
```json
{
  "success": true,
  "message": "Music item hidden (soft deleted)"
}
```

---

## 9️⃣ PATCH `/api/music/:id/restore` — Restore Soft-Deleted Item

> Sets `isActive = true`. Item appears in listings again.

```
PATCH http://localhost:3000/api/music/65f1a2b3c4d5e6f7a8b9c0d1/restore
```

### ✅ Success Response
```json
{
  "success": true,
  "data": { "isActive": true, ... },
  "message": "Music item restored successfully"
}
```

---

## 🔟 DELETE `/api/music/:id` — Hard Delete (Permanent)

> ⚠️ This permanently removes the document from the database. Cannot be undone.

```
DELETE http://localhost:3000/api/music/65f1a2b3c4d5e6f7a8b9c0d1
```

### ✅ Success Response
```json
{
  "success": true,
  "message": "Music item deleted permanently"
}
```

---

## 📦 Field Reference Table

| Field | Type | Required | Default | Notes |
|-------|------|----------|---------|-------|
| `title` | String | ✅ Yes | — | Max 200 chars |
| `description` | String | No | — | Max 1000 chars |
| `url` | String | ✅ Yes | — | YouTube, Spotify, JioSaavn etc. |
| `category` | Enum | ✅ Yes | — | `mp3` \| `mp4` \| `reels` |
| `type` | Enum | ✅ Yes | — | `audio` \| `video` |
| `pinned` | Boolean | No | `false` | Pinned items float to top |
| `pinnedAt` | Date | No | `null` | Auto-set when pinned |
| `thumbnail` | String | No | — | Image URL for card display |
| `duration` | String | No | — | e.g. `"3:45"` |
| `artist` | String | No | — | Max 100 chars |
| `tags` | String[] | No | `[]` | e.g. `["lofi", "chill"]` |
| `pickVideoUrlFrom` | String | No | — | e.g. `"YouTube"` |
| `views` | Number | No | `0` | Auto-incremented via `/view` |
| `likes` | Number | No | `0` | Auto-incremented via `/like` |
| `isActive` | Boolean | No | `true` | `false` = soft-deleted / hidden |
| `createdAt` | Date | Auto | — | Set on creation |
| `updatedAt` | Date | Auto | — | Updated on every save |

---

## 🗂️ Category vs Type Guide

| Scenario | `category` | `type` |
|----------|------------|--------|
| YouTube full video | `mp4` | `video` |
| YouTube Short / Reel | `reels` | `video` |
| JioSaavn / Spotify song | `mp3` | `audio` |
| Podcast episode | `mp3` | `audio` |
| Music video (downloadable .mp4 link) | `mp4` | `video` |

---

## 🚀 Quick Test Sequence in Postman

1. **Create** a music item → `POST /api/music`  
2. **Copy** the `_id` from the response  
3. **List all** → `GET /api/music`  
4. **Get by ID** → `GET /api/music/:id`  
5. **Edit** title/description → `PATCH /api/music/:id`  
6. **Pin** the item → `PATCH /api/music/:id/pin`  
7. **Verify pin** appears first → `GET /api/music`  
8. **Increment views** → `PATCH /api/music/:id/view`  
9. **Like** → `PATCH /api/music/:id/like`  
10. **Search** → `GET /api/music?search=yourTitle`  
11. **Filter** → `GET /api/music?category=mp4&type=video`  
12. **Soft delete** → `PATCH /api/music/:id/soft-delete`  
13. **Verify hidden** → `GET /api/music` (item should not appear)  
14. **Restore** → `PATCH /api/music/:id/restore`  
15. **Hard delete** → `DELETE /api/music/:id`  

---

## ⚙️ Postman Environment Setup

Create a Postman Environment with these variables:

| Variable | Value |
|----------|-------|
| `baseUrl` | `http://localhost:3000` |
| `musicId` | *(paste the `_id` after creating an item)* |

Then use `{{baseUrl}}/api/music` and `{{baseUrl}}/api/music/{{musicId}}` in your requests.
