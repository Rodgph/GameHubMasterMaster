export type Message = {
  id: string;
  clientId?: string;
  roomId?: string;
  conversationUserId: string;
  senderId: string;
  rawSenderId?: string;
  type?: "text" | "image" | "audio" | "file";
  text: string;
  mediaPath?: string | null;
  mediaUrl?: string | null;
  mediaMime?: string | null;
  mediaSize?: number | null;
  audioDurationMs?: number | null;
  replyToIds?: string[] | null;
  deletedForAll?: boolean;
  createdAt: string;
  editedAt?: string | null;
  status?: "sending" | "sent" | "failed";
  reactions?: MessageReaction[];
};

export type MessageReactionUser = {
  id: string;
  username: string;
  avatarUrl?: string | null;
};

export type MessageReaction = {
  emoji: string;
  count: number;
  reactedByMe: boolean;
  users: MessageReactionUser[];
};
