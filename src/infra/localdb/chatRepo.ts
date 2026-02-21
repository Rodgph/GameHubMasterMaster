import Dexie from "dexie";
import {
  localDb,
  type LocalConversation,
  type LocalMessageRecord,
  type LocalMessageStatus,
  type OutboxPayload,
  type OutboxRecord,
} from "./db";

type CachedMessageInput = {
  id: string;
  clientId: string;
  conversationId: string;
  senderId: string;
  body: string;
  createdAt: number;
  status: LocalMessageStatus;
};

const LAST_SYNC_PREFIX = "lastSync:";

function makeLastSyncKey(conversationId: string): string {
  return `${LAST_SYNC_PREFIX}${conversationId}`;
}

export async function getMessagesByConversation(conversationId: string): Promise<LocalMessageRecord[]> {
  const list = await localDb.messages
    .where("[conversationId+createdAt]")
    .between([conversationId, Dexie.minKey], [conversationId, Dexie.maxKey])
    .toArray();
  return list.sort((a, b) => a.createdAt - b.createdAt);
}

export async function upsertMessages(messages: CachedMessageInput[]): Promise<void> {
  if (messages.length === 0) return;
  await localDb.transaction("rw", localDb.messages, localDb.conversations, async () => {
    for (const message of messages) {
      const existingByClient = await localDb.messages.where("clientId").equals(message.clientId).first();
      if (existingByClient && existingByClient.id !== message.id) {
        await localDb.messages.delete(existingByClient.id);
      }

      await localDb.messages.put({
        id: message.id,
        clientId: message.clientId,
        conversationId: message.conversationId,
        senderId: message.senderId,
        body: message.body,
        createdAt: message.createdAt,
        status: message.status,
      });

      const conversation: LocalConversation = {
        id: message.conversationId,
        updatedAt: Date.now(),
        lastMessageAt: message.createdAt,
        lastPreview: message.body,
      };
      await localDb.conversations.put(conversation);
    }
  });
}

export async function putPendingMessage(
  record: CachedMessageInput,
  payload: OutboxPayload,
): Promise<void> {
  await localDb.transaction("rw", localDb.messages, localDb.outbox, localDb.conversations, async () => {
    await localDb.messages.put({
      id: record.id,
      clientId: record.clientId,
      conversationId: record.conversationId,
      senderId: record.senderId,
      body: record.body,
      createdAt: record.createdAt,
      status: record.status,
    });
    const outboxRecord: OutboxRecord = {
      clientId: record.clientId,
      conversationId: record.conversationId,
      payload,
      createdAt: record.createdAt,
      tryCount: 0,
    };
    await localDb.outbox.put(outboxRecord);
    await localDb.conversations.put({
      id: record.conversationId,
      updatedAt: Date.now(),
      lastMessageAt: record.createdAt,
      lastPreview: record.body,
    });
  });
}

export async function updateMessageDelivery(
  clientId: string,
  next: {
    id: string;
    status: LocalMessageStatus;
    body: string;
    createdAt: number;
    senderId: string;
    conversationId: string;
  },
): Promise<void> {
  await localDb.transaction("rw", localDb.messages, localDb.outbox, async () => {
    const local = await localDb.messages.where("clientId").equals(clientId).first();
    if (local && local.id !== next.id) {
      await localDb.messages.delete(local.id);
    }

    await localDb.messages.put({
      id: next.id,
      clientId,
      conversationId: next.conversationId,
      senderId: next.senderId,
      body: next.body,
      createdAt: next.createdAt,
      status: next.status,
    });

    await localDb.outbox.delete(clientId);
  });
}

export async function markMessageFailed(clientId: string, reason: string): Promise<void> {
  await localDb.transaction("rw", localDb.messages, localDb.outbox, async () => {
    const local = await localDb.messages.where("clientId").equals(clientId).first();
    if (local) {
      await localDb.messages.put({ ...local, status: "failed" });
    }
    const pending = await localDb.outbox.get(clientId);
    if (pending) {
      await localDb.outbox.put({
        ...pending,
        tryCount: pending.tryCount + 1,
        lastError: reason,
      });
    }
  });
}

export async function listOutbox(conversationId?: string): Promise<OutboxRecord[]> {
  const list = conversationId
    ? await localDb.outbox.where("conversationId").equals(conversationId).toArray()
    : await localDb.outbox.toArray();
  return list.sort((a, b) => a.createdAt - b.createdAt);
}

export async function getLastSync(conversationId: string): Promise<number | null> {
  const record = await localDb.metadata.get(makeLastSyncKey(conversationId));
  if (!record) return null;
  const parsed = Number(record.value);
  return Number.isFinite(parsed) ? parsed : null;
}

export async function setLastSync(conversationId: string, value: number): Promise<void> {
  await localDb.metadata.put({
    key: makeLastSyncKey(conversationId),
    value: String(value),
  });
}
