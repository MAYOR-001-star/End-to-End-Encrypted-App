/**
 * WhisperBox WebSocket Manager
 */

type SocketEvent = 
  | { event: "message.receive"; id: string; from_user_id: string; to_user_id: string; payload: any; created_at: string }
  | { event: "user.online"; user_id: string }
  | { event: "user.offline"; user_id: string }
  | { event: "error"; detail: string };

class SocketManager {
  private ws: WebSocket | null = null;
  private listeners: Set<(data: SocketEvent) => void> = new Set();
  private reconnectTimeout: number | null = null;

  connect(token: string) {
    if (this.ws) this.ws.close();

    const url = `wss://whisperbox.koyeb.app/ws?token=${token}`;
    this.ws = new WebSocket(url);

    this.ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        this.listeners.forEach(l => l(data));
      } catch (e) {
        console.error("Failed to parse socket message", e);
      }
    };

    this.ws.onclose = () => {
      console.log("Socket closed, reconnecting in 3s...");
      this.reconnectTimeout = window.setTimeout(() => {
        // We'll need a fresh token or assume the existing one is still valid for a bit
        // In a real app, we'd call api.getAccessToken() here
      }, 3000);
    };

    this.ws.onerror = (err) => {
      console.error("Socket error", err);
    };
  }

  disconnect() {
    if (this.ws) {
      this.ws.onclose = null; // Prevent reconnect
      this.ws.close();
      this.ws = null;
    }
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
    }
  }

  send(to: string, payload: any) {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      throw new Error("Socket not connected");
    }
    this.ws.send(JSON.stringify({
      event: "message.send",
      to,
      payload
    }));
  }

  addListener(l: (data: SocketEvent) => void) {
    this.listeners.add(l);
    return () => this.listeners.delete(l);
  }
}

export const socketManager = new SocketManager();
