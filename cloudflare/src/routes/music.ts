type MusicEnv = {
  DB: D1Database;
  MUSIC_ASSETS?: R2Bucket;
};

type JsonResponse = (data: unknown, request: Request, status?: number) => Response;

type MusicRouteContext = {
  request: Request;
  env: MusicEnv;
  userId: string;
  json: JsonResponse;
};

type GenreRow = {
  id: string;
  name: string;
  slug: string;
};

type AlbumRow = {
  id: string;
  artist_id: string;
  artist_name: string;
  title: string;
  cover_key: string | null;
  release_date: string | null;
  kind: string;
  created_at: string;
  tracks_count: number;
  likes_count: number;
};

type TrackRow = {
  id: string;
  album_id: string;
  album_title: string;
  artist_id: string;
  artist_name: string;
  title: string;
  audio_key: string;
  duration_sec: number | null;
  track_number: number;
  created_at: string;
  likes_count: number;
};

type HomeTrackRow = {
  track_id: string;
  track_title: string;
  duration_sec: number | null;
  album_id: string;
  album_title: string;
  album_cover_key: string | null;
  artist_id: string;
  artist_name: string;
  listened_at: string;
};

type HomeAlbumRow = {
  id: string;
  artist_id: string;
  artist_name: string;
  title: string;
  cover_key: string | null;
  release_date: string | null;
  kind: string;
};

type ArtistListRow = {
  id: string;
  user_id: string;
  name: string;
  slug: string;
  avatar_key: string | null;
  cover_key: string | null;
  created_at: string;
};

type AlbumListRow = {
  id: string;
  artist_id: string;
  artist_name: string;
  title: string;
  cover_key: string | null;
  release_date: string | null;
  kind: string;
  created_at: string;
};

type UploadScope = "artist-avatar" | "artist-cover" | "album-cover" | "track-cover" | "misc";

function parseLimit(url: URL, fallback = 20, max = 100) {
  const raw = Number(url.searchParams.get("limit") ?? String(fallback));
  if (!Number.isFinite(raw)) return fallback;
  return Math.max(1, Math.min(max, Math.floor(raw)));
}

function parseSearchQuery(url: URL) {
  const raw = (url.searchParams.get("query") ?? url.searchParams.get("q") ?? "").trim();
  return raw.slice(0, 120);
}

function parseUploadScope(raw: unknown): UploadScope {
  if (typeof raw !== "string") return "misc";
  const normalized = raw.trim().toLowerCase();
  if (normalized === "artist-avatar") return "artist-avatar";
  if (normalized === "artist-cover") return "artist-cover";
  if (normalized === "album-cover") return "album-cover";
  if (normalized === "track-cover") return "track-cover";
  return "misc";
}

function getImageExtension(file: File) {
  const contentType = file.type.toLowerCase();
  if (contentType === "image/jpeg" || contentType === "image/jpg") return "jpg";
  if (contentType === "image/png") return "png";
  if (contentType === "image/webp") return "webp";
  if (contentType === "image/gif") return "gif";
  if (contentType === "image/avif") return "avif";

  const filename = file.name.toLowerCase();
  if (filename.endsWith(".jpeg") || filename.endsWith(".jpg")) return "jpg";
  if (filename.endsWith(".png")) return "png";
  if (filename.endsWith(".webp")) return "webp";
  if (filename.endsWith(".gif")) return "gif";
  if (filename.endsWith(".avif")) return "avif";
  return "bin";
}

function sanitizeName(raw: unknown, max = 64) {
  if (typeof raw !== "string") return "";
  return raw.trim().slice(0, max);
}

function sanitizeKey(raw: unknown) {
  if (typeof raw !== "string") return null;
  const value = raw.trim();
  return value ? value : null;
}

function toSlug(raw: string) {
  return raw
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

function parseKind(raw: unknown): "single" | "ep" | "album" {
  if (raw === "single" || raw === "ep" || raw === "album") {
    return raw;
  }
  return "album";
}

function parseDuration(raw: unknown) {
  if (raw === null || raw === undefined || raw === "") return null;
  const value = Number(raw);
  if (!Number.isFinite(value)) return null;
  const normalized = Math.max(0, Math.floor(value));
  return normalized;
}

function parseTrackNumber(raw: unknown) {
  if (raw === null || raw === undefined || raw === "") return null;
  const value = Number(raw);
  if (!Number.isFinite(value)) return null;
  return Math.max(1, Math.floor(value));
}

function parseGenreIds(raw: unknown) {
  if (!Array.isArray(raw)) return [] as string[];
  return raw
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.trim())
    .filter(Boolean);
}

function parseDateOrNull(raw: unknown) {
  if (typeof raw !== "string") return null;
  const value = raw.trim();
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString();
}

function placeholders(total: number) {
  return new Array(total).fill("?").join(", ");
}

async function resolveExistingGenreIds(env: MusicEnv, genreIds: string[]) {
  if (genreIds.length === 0) return [] as string[];
  const sql = `SELECT id FROM music_genres WHERE id IN (${placeholders(genreIds.length)})`;
  const rows = await env.DB.prepare(sql).bind(...genreIds).all<{ id: string }>();
  return (rows.results ?? []).map((row) => row.id);
}

async function listGenres(env: MusicEnv) {
  const rows = await env.DB.prepare(
    "SELECT id, name, slug FROM music_genres ORDER BY name COLLATE NOCASE ASC",
  ).all<GenreRow>();
  return rows.results ?? [];
}

async function listGenresByAlbumId(env: MusicEnv, albumId: string) {
  const rows = await env.DB.prepare(
    `SELECT g.id, g.name, g.slug
     FROM music_album_genres ag
     JOIN music_genres g ON g.id = ag.genre_id
     WHERE ag.album_id = ?
     ORDER BY g.name COLLATE NOCASE ASC`,
  )
    .bind(albumId)
    .all<GenreRow>();
  return rows.results ?? [];
}

async function listGenresByTrackId(env: MusicEnv, trackId: string) {
  const rows = await env.DB.prepare(
    `SELECT g.id, g.name, g.slug
     FROM music_track_genres tg
     JOIN music_genres g ON g.id = tg.genre_id
     WHERE tg.track_id = ?
     ORDER BY g.name COLLATE NOCASE ASC`,
  )
    .bind(trackId)
    .all<GenreRow>();
  return rows.results ?? [];
}

async function mapAlbum(env: MusicEnv, row: AlbumRow) {
  return {
    id: row.id,
    artistId: row.artist_id,
    artistName: row.artist_name,
    title: row.title,
    coverKey: row.cover_key,
    releaseDate: row.release_date,
    kind: row.kind,
    createdAt: row.created_at,
    tracksCount: Number(row.tracks_count ?? 0),
    likesCount: Number(row.likes_count ?? 0),
    genres: await listGenresByAlbumId(env, row.id),
  };
}

async function mapTrack(env: MusicEnv, row: TrackRow) {
  return {
    id: row.id,
    albumId: row.album_id,
    albumTitle: row.album_title,
    artistId: row.artist_id,
    artistName: row.artist_name,
    title: row.title,
    audioKey: row.audio_key,
    durationSec: row.duration_sec === null ? null : Number(row.duration_sec),
    trackNumber: Number(row.track_number),
    createdAt: row.created_at,
    likesCount: Number(row.likes_count ?? 0),
    genres: await listGenresByTrackId(env, row.id),
  };
}

async function getArtist(env: MusicEnv, artistId: string) {
  return env.DB.prepare("SELECT id, user_id, name FROM music_artists WHERE id = ?")
    .bind(artistId)
    .first<{ id: string; user_id: string; name: string }>();
}

async function getAlbumWithArtist(env: MusicEnv, albumId: string) {
  return env.DB.prepare(
    `SELECT a.id as id, a.artist_id as artist_id, ar.user_id as owner_user_id, ar.name as artist_name
     FROM music_albums a
     JOIN music_artists ar ON ar.id = a.artist_id
     WHERE a.id = ?`,
  )
    .bind(albumId)
    .first<{ id: string; artist_id: string; owner_user_id: string; artist_name: string }>();
}

async function getTrackById(env: MusicEnv, trackId: string) {
  return env.DB.prepare("SELECT id FROM music_tracks WHERE id = ?")
    .bind(trackId)
    .first<{ id: string }>();
}

async function getAlbumById(env: MusicEnv, albumId: string) {
  const row = await env.DB.prepare(
    `SELECT a.id as id,
            a.artist_id as artist_id,
            ar.name as artist_name,
            a.title as title,
            a.cover_key as cover_key,
            a.release_date as release_date,
            a.kind as kind,
            a.created_at as created_at,
            (SELECT COUNT(*) FROM music_tracks t WHERE t.album_id = a.id) as tracks_count,
            (SELECT COUNT(*) FROM music_album_likes l WHERE l.album_id = a.id) as likes_count
     FROM music_albums a
     JOIN music_artists ar ON ar.id = a.artist_id
     WHERE a.id = ?`,
  )
    .bind(albumId)
    .first<AlbumRow>();

  if (!row) return null;
  return mapAlbum(env, row);
}

async function getTrackFullById(env: MusicEnv, trackId: string) {
  const row = await env.DB.prepare(
    `SELECT t.id as id,
            t.album_id as album_id,
            a.title as album_title,
            ar.id as artist_id,
            ar.name as artist_name,
            t.title as title,
            t.audio_key as audio_key,
            t.duration_sec as duration_sec,
            t.track_number as track_number,
            t.created_at as created_at,
            (SELECT COUNT(*) FROM music_track_likes l WHERE l.track_id = t.id) as likes_count
     FROM music_tracks t
     JOIN music_albums a ON a.id = t.album_id
     JOIN music_artists ar ON ar.id = a.artist_id
     WHERE t.id = ?`,
  )
    .bind(trackId)
    .first<TrackRow>();

  if (!row) return null;
  return mapTrack(env, row);
}

async function createGenre({ request, env, json }: MusicRouteContext) {
  const body = (await request.json().catch(() => null)) as { name?: unknown } | null;
  const name = sanitizeName(body?.name, 64);
  if (name.length < 2) {
    return json({ error: "invalid_name" }, request, 400);
  }

  const existing = await env.DB.prepare(
    "SELECT id, name, slug FROM music_genres WHERE lower(name) = lower(?)",
  )
    .bind(name)
    .first<GenreRow>();
  if (existing) {
    return json({ genre: existing }, request);
  }

  const baseSlug = toSlug(name);
  if (!baseSlug) {
    return json({ error: "invalid_name" }, request, 400);
  }

  let attempt = 0;
  let created: GenreRow | null = null;

  while (!created && attempt < 100) {
    const slug = attempt === 0 ? baseSlug : `${baseSlug}-${attempt + 1}`;
    const id = crypto.randomUUID();

    const conflict = await env.DB.prepare("SELECT id FROM music_genres WHERE slug = ?")
      .bind(slug)
      .first<{ id: string }>();
    if (conflict) {
      attempt += 1;
      continue;
    }

    await env.DB.prepare("INSERT INTO music_genres (id, name, slug) VALUES (?, ?, ?)")
      .bind(id, name, slug)
      .run();

    created = { id, name, slug };
  }

  if (!created) {
    return json({ error: "slug_conflict" }, request, 409);
  }

  return json({ genre: created }, request, 201);
}

async function createImageUpload({ request, env, userId, json }: MusicRouteContext) {
  if (!env.MUSIC_ASSETS) {
    return json({ error: "music_assets_unavailable" }, request, 500);
  }

  const formData = await request.formData().catch(() => null);
  if (!formData) {
    return json({ error: "invalid_form_data" }, request, 400);
  }

  const fileField = formData.get("file");
  if (!(fileField instanceof File)) {
    return json({ error: "file_required" }, request, 400);
  }

  const file = fileField;
  if (!file.type.toLowerCase().startsWith("image/")) {
    return json({ error: "invalid_file_type" }, request, 400);
  }

  const maxSizeBytes = 12 * 1024 * 1024;
  if (file.size > maxSizeBytes) {
    return json({ error: "file_too_large" }, request, 400);
  }

  const scope = parseUploadScope(formData.get("scope"));
  const ext = getImageExtension(file);
  const key = `music/${userId}/${scope}/${Date.now()}-${crypto.randomUUID()}.${ext}`;

  await env.MUSIC_ASSETS.put(key, file.stream(), {
    httpMetadata: {
      contentType: file.type || undefined,
      cacheControl: "public, max-age=31536000, immutable",
    },
    customMetadata: {
      uploadedBy: userId,
      scope,
      filename: file.name,
    },
  });

  return json({ key }, request, 201);
}

async function createArtist({ request, env, userId, json }: MusicRouteContext) {
  const body = (await request.json().catch(() => null)) as {
    name?: unknown;
    slug?: unknown;
    avatarKey?: unknown;
    coverKey?: unknown;
  } | null;
  const name = sanitizeName(body?.name, 80);
  if (name.length < 2) {
    return json({ error: "invalid_name" }, request, 400);
  }

  const providedSlugRaw = typeof body?.slug === "string" ? body.slug.trim() : "";
  const providedSlug = providedSlugRaw ? toSlug(providedSlugRaw) : "";
  if (providedSlugRaw && !providedSlug) {
    return json({ error: "invalid_slug" }, request, 400);
  }

  const existing = await env.DB.prepare(
    "SELECT id, name, slug, avatar_key, cover_key, created_at FROM music_artists WHERE user_id = ? AND lower(name) = lower(?)",
  )
    .bind(userId, name)
    .first<{
      id: string;
      name: string;
      slug: string;
      avatar_key: string | null;
      cover_key: string | null;
      created_at: string;
    }>();
  if (existing) {
    return json(
      {
        artist: {
          id: existing.id,
          userId,
          name: existing.name,
          slug: existing.slug,
          avatarKey: existing.avatar_key,
          coverKey: existing.cover_key,
          createdAt: existing.created_at,
        },
      },
      request,
    );
  }

  const baseSlug = providedSlug || toSlug(name) || `artist-${crypto.randomUUID().slice(0, 8)}`;
  let slug = baseSlug;
  let suffix = 2;
  while (true) {
    const conflict = await env.DB.prepare(
      "SELECT id FROM music_artists WHERE user_id = ? AND slug = ?",
    )
      .bind(userId, slug)
      .first<{ id: string }>();
    if (!conflict) break;
    slug = `${baseSlug}-${suffix}`;
    suffix += 1;
  }

  const id = crypto.randomUUID();
  const avatarKey = sanitizeKey(body?.avatarKey);
  const coverKey = sanitizeKey(body?.coverKey);
  const createdAt = new Date().toISOString();

  await env.DB.prepare(
    "INSERT INTO music_artists (id, user_id, name, slug, avatar_key, cover_key, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
  )
    .bind(id, userId, name, slug, avatarKey, coverKey, createdAt)
    .run();

  return json(
    {
      artist: {
        id,
        userId,
        name,
        slug,
        avatarKey,
        coverKey,
        createdAt,
      },
    },
    request,
    201,
  );
}

async function listArtists({ request, env, userId, json }: MusicRouteContext) {
  const url = new URL(request.url);
  const limit = parseLimit(url, 12, 50);
  const query = parseSearchQuery(url);

  let sql = `SELECT id, user_id, name, slug, avatar_key, cover_key, created_at
             FROM music_artists
             WHERE user_id = ?`;
  const params: unknown[] = [userId];

  if (query) {
    sql += " AND lower(name) LIKE lower(?)";
    params.push(`%${query}%`);
  }

  sql += " ORDER BY created_at DESC LIMIT ?";
  params.push(limit);

  const rows = await env.DB.prepare(sql).bind(...params).all<ArtistListRow>();
  return json(
    {
      artists: (rows.results ?? []).map((item) => ({
        id: item.id,
        userId: item.user_id,
        name: item.name,
        slug: item.slug,
        avatarKey: item.avatar_key,
        coverKey: item.cover_key,
        createdAt: item.created_at,
      })),
    },
    request,
  );
}

async function listAlbums({ request, env, userId, json }: MusicRouteContext) {
  const url = new URL(request.url);
  const limit = parseLimit(url, 12, 50);
  const query = parseSearchQuery(url);
  const artistId = (url.searchParams.get("artistId") ?? "").trim();

  let sql = `SELECT a.id as id,
                    a.artist_id as artist_id,
                    ar.name as artist_name,
                    a.title as title,
                    a.cover_key as cover_key,
                    a.release_date as release_date,
                    a.kind as kind,
                    a.created_at as created_at
             FROM music_albums a
             JOIN music_artists ar ON ar.id = a.artist_id
             WHERE ar.user_id = ?`;
  const params: unknown[] = [userId];

  if (artistId) {
    sql += " AND a.artist_id = ?";
    params.push(artistId);
  }

  if (query) {
    sql += " AND lower(a.title) LIKE lower(?)";
    params.push(`%${query}%`);
  }

  sql += " ORDER BY COALESCE(a.release_date, a.created_at) DESC, a.created_at DESC LIMIT ?";
  params.push(limit);

  const rows = await env.DB.prepare(sql).bind(...params).all<AlbumListRow>();
  return json(
    {
      albums: (rows.results ?? []).map((item) => ({
        id: item.id,
        artistId: item.artist_id,
        artistName: item.artist_name,
        title: item.title,
        coverKey: item.cover_key,
        releaseDate: item.release_date,
        kind: item.kind,
        createdAt: item.created_at,
      })),
    },
    request,
  );
}

async function listArtistAlbums(context: MusicRouteContext, artistId: string) {
  const { request, env, json } = context;
  const artist = await getArtist(env, artistId);
  if (!artist) {
    return json({ error: "artist_not_found" }, request, 404);
  }

  const rows = await env.DB.prepare(
    `SELECT a.id as id,
            a.artist_id as artist_id,
            ar.name as artist_name,
            a.title as title,
            a.cover_key as cover_key,
            a.release_date as release_date,
            a.kind as kind,
            a.created_at as created_at,
            (SELECT COUNT(*) FROM music_tracks t WHERE t.album_id = a.id) as tracks_count,
            (SELECT COUNT(*) FROM music_album_likes l WHERE l.album_id = a.id) as likes_count
     FROM music_albums a
     JOIN music_artists ar ON ar.id = a.artist_id
     WHERE a.artist_id = ?
     ORDER BY COALESCE(a.release_date, a.created_at) DESC, a.created_at DESC`,
  )
    .bind(artistId)
    .all<AlbumRow>();

  const albums = await Promise.all((rows.results ?? []).map((row) => mapAlbum(env, row)));

  return json(
    {
      artist: { id: artist.id, name: artist.name },
      albums,
    },
    request,
  );
}

async function createAlbum({ request, env, userId, json }: MusicRouteContext) {
  const body = (await request.json().catch(() => null)) as {
    artistId?: unknown;
    title?: unknown;
    coverKey?: unknown;
    releaseDate?: unknown;
    kind?: unknown;
    genreIds?: unknown;
  } | null;

  const artistId = typeof body?.artistId === "string" ? body.artistId.trim() : "";
  const title = sanitizeName(body?.title, 120);
  if (!artistId) return json({ error: "artist_id_required" }, request, 400);
  if (!title) return json({ error: "title_required" }, request, 400);

  const artist = await getArtist(env, artistId);
  if (!artist) return json({ error: "artist_not_found" }, request, 404);
  if (artist.user_id !== userId) return json({ error: "forbidden" }, request, 403);

  const coverKey = sanitizeKey(body?.coverKey);
  const releaseDate = parseDateOrNull(body?.releaseDate);
  const kind = parseKind(body?.kind);
  const createdAt = new Date().toISOString();
  const id = crypto.randomUUID();

  await env.DB.prepare(
    "INSERT INTO music_albums (id, artist_id, title, cover_key, release_date, kind, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
  )
    .bind(id, artistId, title, coverKey, releaseDate, kind, createdAt)
    .run();

  const requestedGenreIds = parseGenreIds(body?.genreIds);
  const validGenreIds = await resolveExistingGenreIds(env, requestedGenreIds);
  for (const genreId of validGenreIds) {
    await env.DB.prepare("INSERT OR IGNORE INTO music_album_genres (album_id, genre_id) VALUES (?, ?)")
      .bind(id, genreId)
      .run();
  }

  const album = await getAlbumById(env, id);
  return json({ album }, request, 201);
}

async function listAlbumTracks(context: MusicRouteContext, albumId: string) {
  const { request, env, json } = context;
  const album = await getAlbumById(env, albumId);
  if (!album) {
    return json({ error: "album_not_found" }, request, 404);
  }

  const rows = await env.DB.prepare(
    `SELECT t.id as id,
            t.album_id as album_id,
            a.title as album_title,
            ar.id as artist_id,
            ar.name as artist_name,
            t.title as title,
            t.audio_key as audio_key,
            t.duration_sec as duration_sec,
            t.track_number as track_number,
            t.created_at as created_at,
            (SELECT COUNT(*) FROM music_track_likes l WHERE l.track_id = t.id) as likes_count
     FROM music_tracks t
     JOIN music_albums a ON a.id = t.album_id
     JOIN music_artists ar ON ar.id = a.artist_id
     WHERE t.album_id = ?
     ORDER BY t.track_number ASC, t.created_at ASC`,
  )
    .bind(albumId)
    .all<TrackRow>();

  const tracks = await Promise.all((rows.results ?? []).map((row) => mapTrack(env, row)));
  return json({ album, tracks }, request);
}

async function createTrack({ request, env, userId, json }: MusicRouteContext) {
  const body = (await request.json().catch(() => null)) as {
    albumId?: unknown;
    title?: unknown;
    audioKey?: unknown;
    durationSec?: unknown;
    trackNumber?: unknown;
    genreIds?: unknown;
  } | null;

  const albumId = typeof body?.albumId === "string" ? body.albumId.trim() : "";
  const title = sanitizeName(body?.title, 120);
  const audioKey = sanitizeKey(body?.audioKey);
  if (!albumId) return json({ error: "album_id_required" }, request, 400);
  if (!title) return json({ error: "title_required" }, request, 400);
  if (!audioKey) return json({ error: "audio_key_required" }, request, 400);

  const albumWithArtist = await getAlbumWithArtist(env, albumId);
  if (!albumWithArtist) return json({ error: "album_not_found" }, request, 404);
  if (albumWithArtist.owner_user_id !== userId) return json({ error: "forbidden" }, request, 403);

  const providedTrackNumber = parseTrackNumber(body?.trackNumber);
  let nextTrackNumber = providedTrackNumber;
  if (!nextTrackNumber) {
    const maxTrack = await env.DB.prepare(
      "SELECT COALESCE(MAX(track_number), 0) as max_track_number FROM music_tracks WHERE album_id = ?",
    )
      .bind(albumId)
      .first<{ max_track_number: number }>();
    nextTrackNumber = Number(maxTrack?.max_track_number ?? 0) + 1;
  }

  const id = crypto.randomUUID();
  const durationSec = parseDuration(body?.durationSec);
  const createdAt = new Date().toISOString();

  await env.DB.prepare(
    "INSERT INTO music_tracks (id, album_id, title, audio_key, duration_sec, track_number, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
  )
    .bind(id, albumId, title, audioKey, durationSec, nextTrackNumber, createdAt)
    .run();

  const requestedGenreIds = parseGenreIds(body?.genreIds);
  const validGenreIds = await resolveExistingGenreIds(env, requestedGenreIds);
  for (const genreId of validGenreIds) {
    await env.DB.prepare("INSERT OR IGNORE INTO music_track_genres (track_id, genre_id) VALUES (?, ?)")
      .bind(id, genreId)
      .run();
  }

  const track = await getTrackFullById(env, id);
  return json({ track }, request, 201);
}

async function likeTrack(context: MusicRouteContext, trackId: string, remove: boolean) {
  const { request, env, userId, json } = context;
  const track = await getTrackById(env, trackId);
  if (!track) return json({ error: "track_not_found" }, request, 404);

  if (remove) {
    await env.DB.prepare("DELETE FROM music_track_likes WHERE track_id = ? AND user_id = ?")
      .bind(trackId, userId)
      .run();
  } else {
    await env.DB.prepare("INSERT OR IGNORE INTO music_track_likes (track_id, user_id) VALUES (?, ?)")
      .bind(trackId, userId)
      .run();
  }

  const likes = await env.DB.prepare("SELECT COUNT(*) as count FROM music_track_likes WHERE track_id = ?")
    .bind(trackId)
    .first<{ count: number }>();

  return json(
    {
      trackId,
      likesCount: Number(likes?.count ?? 0),
      userHasLiked: !remove,
    },
    request,
  );
}

async function likeAlbum(context: MusicRouteContext, albumId: string, remove: boolean) {
  const { request, env, userId, json } = context;
  const album = await getAlbumById(env, albumId);
  if (!album) return json({ error: "album_not_found" }, request, 404);

  if (remove) {
    await env.DB.prepare("DELETE FROM music_album_likes WHERE album_id = ? AND user_id = ?")
      .bind(albumId, userId)
      .run();
  } else {
    await env.DB.prepare("INSERT OR IGNORE INTO music_album_likes (album_id, user_id) VALUES (?, ?)")
      .bind(albumId, userId)
      .run();
  }

  const likes = await env.DB.prepare("SELECT COUNT(*) as count FROM music_album_likes WHERE album_id = ?")
    .bind(albumId)
    .first<{ count: number }>();

  return json(
    {
      albumId,
      likesCount: Number(likes?.count ?? 0),
      userHasLiked: !remove,
    },
    request,
  );
}

async function addRecentListen(context: MusicRouteContext, trackId: string) {
  const { request, env, userId, json } = context;
  const track = await getTrackById(env, trackId);
  if (!track) return json({ error: "track_not_found" }, request, 404);

  const listenedAt = new Date().toISOString();
  await env.DB.prepare(
    `INSERT INTO music_recent_listens (user_id, track_id, listened_at)
     VALUES (?, ?, ?)
     ON CONFLICT(user_id, track_id)
     DO UPDATE SET listened_at = excluded.listened_at`,
  )
    .bind(userId, trackId, listenedAt)
    .run();

  return json({ ok: true, listenedAt }, request);
}

async function getHome({ request, env, userId, json }: MusicRouteContext) {
  const url = new URL(request.url);
  const limit = parseLimit(url, 8, 24);
  const genreSlugRaw = url.searchParams.get("genre");
  const genreSlug = genreSlugRaw?.trim().toLowerCase() || null;

  const genres = await listGenres(env);
  let filterGenreId: string | null = null;
  if (genreSlug) {
    const genre = await env.DB.prepare("SELECT id FROM music_genres WHERE slug = ?")
      .bind(genreSlug)
      .first<{ id: string }>();
    filterGenreId = genre?.id ?? null;
  }

  let recentSql = `SELECT t.id as track_id,
                          t.title as track_title,
                          t.duration_sec as duration_sec,
                          a.id as album_id,
                          a.title as album_title,
                          a.cover_key as album_cover_key,
                          ar.id as artist_id,
                          ar.name as artist_name,
                          rl.listened_at as listened_at
                   FROM music_recent_listens rl
                   JOIN music_tracks t ON t.id = rl.track_id
                   JOIN music_albums a ON a.id = t.album_id
                   JOIN music_artists ar ON ar.id = a.artist_id`;
  const recentParams: unknown[] = [];

  if (filterGenreId) {
    recentSql += " JOIN music_track_genres tg ON tg.track_id = t.id";
  }

  recentSql += " WHERE rl.user_id = ?";
  recentParams.push(userId);

  if (filterGenreId) {
    recentSql += " AND tg.genre_id = ?";
    recentParams.push(filterGenreId);
  }

  recentSql += " ORDER BY rl.listened_at DESC LIMIT ?";
  recentParams.push(limit);

  const recentRows = await env.DB.prepare(recentSql)
    .bind(...recentParams)
    .all<HomeTrackRow>();

  let recentlyListened = recentRows.results ?? [];

  if (recentlyListened.length === 0) {
    let fallbackSql = `SELECT t.id as track_id,
                              t.title as track_title,
                              t.duration_sec as duration_sec,
                              a.id as album_id,
                              a.title as album_title,
                              a.cover_key as album_cover_key,
                              ar.id as artist_id,
                              ar.name as artist_name,
                              t.created_at as listened_at
                       FROM music_tracks t
                       JOIN music_albums a ON a.id = t.album_id
                       JOIN music_artists ar ON ar.id = a.artist_id`;
    const fallbackParams: unknown[] = [];

    if (filterGenreId) {
      fallbackSql += " JOIN music_track_genres tg ON tg.track_id = t.id";
    }

    fallbackSql += " WHERE 1 = 1";
    if (filterGenreId) {
      fallbackSql += " AND tg.genre_id = ?";
      fallbackParams.push(filterGenreId);
    }

    fallbackSql += " ORDER BY t.created_at DESC LIMIT ?";
    fallbackParams.push(limit);

    const fallbackRows = await env.DB.prepare(fallbackSql)
      .bind(...fallbackParams)
      .all<HomeTrackRow>();
    recentlyListened = fallbackRows.results ?? [];
  }

  const featuredRows = await env.DB.prepare(
    `SELECT a.id as id,
            ar.id as artist_id,
            ar.name as artist_name,
            a.title as title,
            a.cover_key as cover_key,
            a.release_date as release_date,
            a.kind as kind
     FROM music_albums a
     JOIN music_artists ar ON ar.id = a.artist_id
     ORDER BY COALESCE(a.release_date, a.created_at) DESC, a.created_at DESC
     LIMIT 6`,
  ).all<HomeAlbumRow>();

  return json(
    {
      genres,
      recentlyListened: recentlyListened.map((item) => ({
        trackId: item.track_id,
        title: item.track_title,
        durationSec: item.duration_sec === null ? null : Number(item.duration_sec),
        albumId: item.album_id,
        albumTitle: item.album_title,
        albumCoverKey: item.album_cover_key,
        artistId: item.artist_id,
        artist: item.artist_name,
        listenedAt: item.listened_at,
      })),
      featuredAlbums: (featuredRows.results ?? []).map((item) => ({
        id: item.id,
        artistId: item.artist_id,
        artist: item.artist_name,
        title: item.title,
        coverKey: item.cover_key,
        releaseDate: item.release_date,
        kind: item.kind,
      })),
    },
    request,
  );
}

export async function handleMusicRoutes(context: MusicRouteContext): Promise<Response | null> {
  const { request, env, json } = context;
  const url = new URL(request.url);
  const method = request.method;

  if (method === "GET" && url.pathname === "/music/home") {
    return getHome(context);
  }

  if (method === "GET" && url.pathname === "/music/genres") {
    const genres = await listGenres(env);
    return json({ genres }, request);
  }

  if (method === "POST" && url.pathname === "/music/genres") {
    return createGenre(context);
  }

  if (method === "POST" && url.pathname === "/music/uploads/image") {
    return createImageUpload(context);
  }

  if (method === "GET" && url.pathname === "/music/artists") {
    return listArtists(context);
  }

  if (method === "POST" && url.pathname === "/music/artists") {
    return createArtist(context);
  }

  if (method === "GET" && url.pathname === "/music/albums") {
    return listAlbums(context);
  }

  if (method === "POST" && url.pathname === "/music/albums") {
    return createAlbum(context);
  }

  if (method === "POST" && url.pathname === "/music/tracks") {
    return createTrack(context);
  }

  const artistAlbumsMatch = url.pathname.match(/^\/music\/artists\/([^/]+)\/albums$/);
  if (artistAlbumsMatch && method === "GET") {
    const artistId = decodeURIComponent(artistAlbumsMatch[1]);
    return listArtistAlbums(context, artistId);
  }

  const albumTracksMatch = url.pathname.match(/^\/music\/albums\/([^/]+)\/tracks$/);
  if (albumTracksMatch && method === "GET") {
    const albumId = decodeURIComponent(albumTracksMatch[1]);
    return listAlbumTracks(context, albumId);
  }

  const trackLikeMatch = url.pathname.match(/^\/music\/tracks\/([^/]+)\/like$/);
  if (trackLikeMatch) {
    const trackId = decodeURIComponent(trackLikeMatch[1]);
    if (method === "POST") return likeTrack(context, trackId, false);
    if (method === "DELETE") return likeTrack(context, trackId, true);
  }

  const albumLikeMatch = url.pathname.match(/^\/music\/albums\/([^/]+)\/like$/);
  if (albumLikeMatch) {
    const albumId = decodeURIComponent(albumLikeMatch[1]);
    if (method === "POST") return likeAlbum(context, albumId, false);
    if (method === "DELETE") return likeAlbum(context, albumId, true);
  }

  const trackListenMatch = url.pathname.match(/^\/music\/tracks\/([^/]+)\/listen$/);
  if (trackListenMatch && method === "POST") {
    const trackId = decodeURIComponent(trackListenMatch[1]);
    return addRecentListen(context, trackId);
  }

  return null;
}
