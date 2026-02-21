# Local chat cache (offline-first)

This layer stores chat data in IndexedDB (Dexie):

- `messages`: cached history by conversation
- `outbox`: pending messages while offline/failing
- `metadata`: `lastSync:<conversationId>` for delta sync
- `conversations`: lightweight list cache (last preview/timestamp)

## Runtime flow

1. Open conversation: load local messages first.
2. Run remote sync in parallel and upsert local cache.
3. Send message: write optimistic message + outbox first.
4. If send succeeds, mark as `sent` and remove from outbox.
5. If send fails, keep in outbox with retry metadata.
6. When back online, flush outbox in order, then sync delta.

## Manual test

1. Open a conversation, close app, reopen: history should render from cache quickly.
2. Disable network, send message: it must stay as pending/failed.
3. Re-enable network: pending message should be flushed and become sent.
