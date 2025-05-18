import express, { Request, Response, NextFunction } from 'express';
import knexConstructor from 'knex';
// @ts-ignore
import knexfile from '../../knexfile'; // Adjust path to knexfile relative to this file

const router = express.Router();
const db = knexConstructor(knexfile.development);

// Middleware for async error handling (local to this router)
const asyncHandler = 
  (fn: (req: Request, res: Response, next: NextFunction) => Promise<any>) => 
  (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
};

// GET all playlists (mounted at /api/playlists/)
router.get('/', asyncHandler(async (req: Request, res: Response) => {
  console.log('[API /api/playlists GET] Fetching all playlists');
  const playlists = await db("playlists")
    .orderBy("created_at", "desc") // Example ordering
    .select("*");
  res.status(200).json(playlists);
}));

// GET a single playlist by ID (mounted at /api/playlists/:id)
router.get('/:id', asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  console.log(`[API /api/playlists/:id GET] Fetching playlist with ID: ${id}`);
  const playlist = await db("playlists").where({ id: parseInt(id, 10) }).first(); // Ensure ID is an integer

  if (playlist) {
    res.status(200).json(playlist);
  } else {
    res.status(404).json({ message: "Playlist not found" });
  }
}));

// Create a new playlist
router.post('/', asyncHandler(async (req: Request, res: Response) => {
  const { name, spotify_playlist_id, description } = req.body;
  if (!name || !spotify_playlist_id) {
    return res.status(400).json({
      message: "Missing required fields: name and spotify_playlist_id",
    });
  }
  try {
    const [newPlaylistId] = await db("playlists").insert({
      name,
      spotify_playlist_id,
      description,
    });
    const newPlaylist = await db("playlists")
      .where({ id: newPlaylistId })
      .first();
    res.status(201).json(newPlaylist);
  } catch (error: unknown) {
    console.error("Error creating playlist:", error);
    res.status(500).json({ message: "Failed to create playlist" });
  }
}));

// Update a playlist (e.g., description)
router.put('/:id', asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const { name, description } = req.body;
  const updatedCount = await db("playlists")
    .where({ id })
    .update({ name, description, updated_at: db.fn.now() });
  if (updatedCount > 0) {
    const updatedPlaylist = await db("playlists").where({ id }).first();
    res.json(updatedPlaylist);
  } else {
    res.status(404).json({ message: "Playlist not found" });
  }
}));

// Increment vote for a playlist
router.post('/:id/vote', asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const playlist = await db("playlists").where({ id }).first();
  if (!playlist) {
    return res.status(404).json({ message: "Playlist not found" });
  }
  await db("playlists").where({ id }).increment("votes", 1);
  const updatedPlaylist = await db("playlists").where({ id }).first();
  res.json(updatedPlaylist);
}));

// Delete a playlist
router.delete('/:id', asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const deletedCount = await db("playlists").where({ id }).del();
  if (deletedCount > 0) {
    res.status(200).json({ message: "Playlist deleted successfully" });
  } else {
    res.status(404).json({ message: "Playlist not found" });
  }
}));

export default router; 