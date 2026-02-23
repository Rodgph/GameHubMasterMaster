import Dexie, { type Table } from "dexie";

export type LocalConversation = {
  id: string;
  updatedAt: number;
  lastMessageAt: number;
  lastPreview?: string;
};

export type LocalMessageStatus = "sending" | "sent" | "failed";

export type LocalMessageRecord = {
  id: string;
  clientId: string;
  conversationId: string;
  senderId: string;
  body: string;
  createdAt: number;
  status: LocalMessageStatus;
};

export type OutboxPayload = {
  conversationId: string;
  senderId: string;
  receiverId: string;
  text: string;
};

export type OutboxRecord = {
  clientId: string;
  conversationId: string;
  payload: OutboxPayload;
  createdAt: number;
  tryCount: number;
  lastError?: string;
};

export type MetadataRecord = {
  key: string;
  value: string;
};

export type LocalMusicHistoryRecord = {
  id: string;
  userId: string;
  trackId: string;
  title: string;
  artist: string;
  albumId: string;
  albumTitle: string;
  albumCoverKey: string | null;
  listenedAt: number;
};

class GameHubLocalDb extends Dexie {
  conversations!: Table<LocalConversation, string>;
  messages!: Table<LocalMessageRecord, string>;
  outbox!: Table<OutboxRecord, string>;
  metadata!: Table<MetadataRecord, string>;
  musicHistory!: Table<LocalMusicHistoryRecord, string>;

  constructor() {
    super("gamehub_local_v1");
    this.version(1).stores({
      conversations: "id, updatedAt, lastMessageAt",
      messages: "id, &clientId, [conversationId+createdAt], conversationId, createdAt, status",
      outbox: "clientId, conversationId, createdAt",
      metadata: "key",
    });
    this.version(2).stores({
      conversations: "id, updatedAt, lastMessageAt",
      messages: "id, &clientId, [conversationId+createdAt], conversationId, createdAt, status",
      outbox: "clientId, conversationId, createdAt",
      metadata: "key",
      musicHistory: "id, userId, trackId, listenedAt, [userId+listenedAt]",
    });
  }
}

export const localDb = new GameHubLocalDb();
