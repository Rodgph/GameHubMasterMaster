CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  username TEXT NOT NULL UNIQUE,
  display_name TEXT,
  avatar_url TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS user_modules (
  user_id TEXT NOT NULL,
  module_id TEXT NOT NULL,
  enabled INTEGER NOT NULL DEFAULT 1,
  pinned INTEGER NOT NULL DEFAULT 0,
  sort_order INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (user_id, module_id),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_user_modules_user_id ON user_modules(user_id);

CREATE TABLE IF NOT EXISTS chat_rooms (
  id TEXT PRIMARY KEY,
  created_by TEXT NOT NULL,
  title TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS chat_room_members (
  room_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'member',
  joined_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (room_id, user_id)
);

CREATE TABLE IF NOT EXISTS chat_messages (
  id TEXT PRIMARY KEY,
  room_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  body TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  edited_at TEXT,
  deleted_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_chat_messages_room_time ON chat_messages(room_id, created_at);

-- === FEED START ===
CREATE TABLE IF NOT EXISTS feed_posts (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  body TEXT NOT NULL,
  image_url TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  edited_at TEXT,
  deleted_at TEXT
);

CREATE TABLE IF NOT EXISTS feed_likes (
  post_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (post_id, user_id)
);

CREATE TABLE IF NOT EXISTS feed_comments (
  id TEXT PRIMARY KEY,
  post_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  body TEXT NOT NULL,
  parent_comment_id TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  deleted_at TEXT
);

CREATE TABLE IF NOT EXISTS feed_post_versions (
  id TEXT PRIMARY KEY,
  post_id TEXT NOT NULL,
  body TEXT NOT NULL,
  edited_at TEXT NOT NULL,
  edited_by TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS feed_post_reactions (
  post_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  emoji TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (post_id, user_id, emoji)
);

CREATE INDEX IF NOT EXISTS idx_feed_posts_created ON feed_posts(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_feed_comments_post ON feed_comments(post_id, created_at);
CREATE INDEX IF NOT EXISTS idx_feed_post_versions ON feed_post_versions(post_id, edited_at);
-- === FEED END ===

-- === MUSIC START ===
CREATE TABLE IF NOT EXISTS music_artists (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  name TEXT NOT NULL,
  slug TEXT NOT NULL,
  avatar_key TEXT,
  cover_key TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS music_albums (
  id TEXT PRIMARY KEY,
  artist_id TEXT NOT NULL,
  title TEXT NOT NULL,
  cover_key TEXT,
  release_date TEXT,
  kind TEXT NOT NULL DEFAULT 'album' CHECK (kind IN ('single', 'ep', 'album')),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (artist_id) REFERENCES music_artists(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS music_tracks (
  id TEXT PRIMARY KEY,
  album_id TEXT NOT NULL,
  title TEXT NOT NULL,
  audio_key TEXT NOT NULL,
  duration_sec INTEGER,
  track_number INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (album_id) REFERENCES music_albums(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS music_genres (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS music_album_genres (
  album_id TEXT NOT NULL,
  genre_id TEXT NOT NULL,
  PRIMARY KEY (album_id, genre_id),
  FOREIGN KEY (album_id) REFERENCES music_albums(id) ON DELETE CASCADE,
  FOREIGN KEY (genre_id) REFERENCES music_genres(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS music_track_genres (
  track_id TEXT NOT NULL,
  genre_id TEXT NOT NULL,
  PRIMARY KEY (track_id, genre_id),
  FOREIGN KEY (track_id) REFERENCES music_tracks(id) ON DELETE CASCADE,
  FOREIGN KEY (genre_id) REFERENCES music_genres(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS music_track_likes (
  track_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (track_id, user_id),
  FOREIGN KEY (track_id) REFERENCES music_tracks(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS music_album_likes (
  album_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (album_id, user_id),
  FOREIGN KEY (album_id) REFERENCES music_albums(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS music_recent_listens (
  user_id TEXT NOT NULL,
  track_id TEXT NOT NULL,
  listened_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (user_id, track_id),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (track_id) REFERENCES music_tracks(id) ON DELETE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_music_genres_slug ON music_genres(slug);
CREATE UNIQUE INDEX IF NOT EXISTS idx_music_genres_name_nocase ON music_genres(name COLLATE NOCASE);
CREATE UNIQUE INDEX IF NOT EXISTS idx_music_artists_user_slug ON music_artists(user_id, slug);
CREATE INDEX IF NOT EXISTS idx_music_artists_user_created ON music_artists(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_music_albums_artist_created ON music_albums(artist_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_music_tracks_album_number ON music_tracks(album_id, track_number, created_at);
CREATE INDEX IF NOT EXISTS idx_music_track_likes_track ON music_track_likes(track_id);
CREATE INDEX IF NOT EXISTS idx_music_album_likes_album ON music_album_likes(album_id);
CREATE INDEX IF NOT EXISTS idx_music_recent_listens_user_time ON music_recent_listens(user_id, listened_at DESC);

INSERT OR IGNORE INTO music_genres (id, name, slug) VALUES
  ('genre-exp-pop', 'exp pop', 'exp-pop'),
  ('genre-hip-hop', 'hip hop', 'hip-hop'),
  ('genre-funk', 'funk', 'funk'),
  ('genre-rage', 'rage', 'rage'),
  ('genre-plug', 'plug', 'plug'),
  ('genre-drill', 'drill', 'drill');
-- === MUSIC END ===
