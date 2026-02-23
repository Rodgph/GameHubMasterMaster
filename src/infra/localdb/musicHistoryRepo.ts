import Dexie from "dexie";
import { localDb, type LocalMusicHistoryRecord } from "./db";

export type MusicHistoryInput = {
  userId: string;
  trackId: string;
  title: string;
  artist: string;
  albumId: string;
  albumTitle: string;
  albumCoverKey: string | null;
  listenedAt?: number;
};

function makeHistoryId(userId: string, trackId: string) {
  return `${userId}:${trackId}`;
}

export async function upsertMusicHistory(input: MusicHistoryInput): Promise<void> {
  const record: LocalMusicHistoryRecord = {
    id: makeHistoryId(input.userId, input.trackId),
    userId: input.userId,
    trackId: input.trackId,
    title: input.title,
    artist: input.artist,
    albumId: input.albumId,
    albumTitle: input.albumTitle,
    albumCoverKey: input.albumCoverKey,
    listenedAt: input.listenedAt ?? Date.now(),
  };

  await localDb.musicHistory.put(record);
}

export async function listMusicHistory(userId: string, limit = 50): Promise<LocalMusicHistoryRecord[]> {
  const rows = await localDb.musicHistory
    .where("[userId+listenedAt]")
    .between([userId, Dexie.minKey], [userId, Dexie.maxKey])
    .reverse()
    .limit(limit)
    .toArray();

  return rows.sort((a, b) => b.listenedAt - a.listenedAt);
}

export async function clearMusicHistory(userId: string): Promise<void> {
  const ids = await localDb.musicHistory
    .where("userId")
    .equals(userId)
    .primaryKeys();

  await localDb.musicHistory.bulkDelete(ids);
}
