export class FeedDO {
  private sockets = new Map<string, WebSocket>();

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === "/connect") {
      if (request.headers.get("Upgrade") !== "websocket") {
        return new Response("Expected websocket", { status: 426 });
      }

      const pair = new WebSocketPair();
      const client = pair[0];
      const server = pair[1];
      const userId = url.searchParams.get("userId") ?? crypto.randomUUID();
      server.accept();
      this.sockets.set(userId, server);

      const cleanup = () => {
        this.sockets.delete(userId);
      };

      server.addEventListener("message", (event) => {
        if (event.data === "ping") {
          server.send("pong");
        }
      });

      server.addEventListener("close", cleanup);
      server.addEventListener("error", cleanup);

      return new Response(null, {
        status: 101,
        webSocket: client,
      });
    }

    if (url.pathname === "/broadcast" && request.method === "POST") {
      const payload = await request.text();
      for (const [userId, socket] of this.sockets.entries()) {
        try {
          socket.send(payload);
        } catch {
          this.sockets.delete(userId);
        }
      }
      return new Response(null, { status: 204 });
    }

    return new Response("Not found", { status: 404 });
  }
}
