export type Message = {
  id: string;
  clientId?: string;
  conversationUserId: string;
  senderId: string;
  text: string;
  createdAt: string;
  status?: "sending" | "sent" | "failed";
};
