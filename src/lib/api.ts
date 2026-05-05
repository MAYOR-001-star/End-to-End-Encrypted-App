/**
 * WhisperBox API Client
 */

const BASE_URL = "https://whisperbox.koyeb.app";

export interface User {
  id: string;
  username: string;
  display_name: string;
  public_key?: string;
  wrapped_private_key?: string;
  pbkdf2_salt?: string;
  created_at: string;
}

export interface AuthResponse {
  access_token: string;
  refresh_token: string;
  token_type: string;
  expires_in: number;
  user: User;
}

export interface MessagePayload {
  ciphertext: string;
  iv: string;
  encryptedKey: string;
  encryptedKeyForSelf: string;
}

export interface Message {
  id: string;
  from_user_id: string;
  to_user_id: string;
  payload: MessagePayload;
  delivered: boolean;
  created_at: string;
}

export interface Conversation {
  user_id: string;
  display_name: string;
  username: string;
  last_message_at: string;
}

class APIClient {
  private accessToken: string | null = null;
  private refreshToken: string | null = localStorage.getItem("refresh_token");

  setTokens(access: string, refresh: string) {
    this.accessToken = access;
    this.refreshToken = refresh;
    localStorage.setItem("refresh_token", refresh);
  }

  clearTokens() {
    this.accessToken = null;
    this.refreshToken = null;
    localStorage.removeItem("refresh_token");
  }

  async request<T>(path: string, options: RequestInit = {}): Promise<T> {
    const headers = new Headers(options.headers || {});
    if (this.accessToken) {
      headers.set("Authorization", `Bearer ${this.accessToken}`);
    }

    let response = await fetch(`${BASE_URL}${path}`, { ...options, headers });

    // Handle token refresh
    if (response.status === 401 && this.refreshToken) {
      const refreshed = await this.refresh();
      if (refreshed) {
        headers.set("Authorization", `Bearer ${this.accessToken}`);
        response = await fetch(`${BASE_URL}${path}`, { ...options, headers });
      }
    }

    if (!response.ok) {
      const error = await response.json().catch(() => ({ detail: "Unknown error" }));
      throw new Error(error.detail || "Request failed");
    }

    return response.json();
  }

  async refresh(): Promise<boolean> {
    if (!this.refreshToken) return false;
    try {
      const res = await fetch(`${BASE_URL}/auth/refresh`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refresh_token: this.refreshToken }),
      });
      if (res.ok) {
        const data = await res.json();
        this.accessToken = data.access_token;
        // The API returns expires_in, etc.
        return true;
      }
    } catch (e) {
      console.error("Token refresh failed", e);
    }
    this.clearTokens();
    return false;
  }

  async register(data: any): Promise<AuthResponse> {
    const res = await this.request<AuthResponse>("/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    this.setTokens(res.access_token, res.refresh_token);
    return res;
  }

  async login(data: any): Promise<AuthResponse> {
    const res = await this.request<AuthResponse>("/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    this.setTokens(res.access_token, res.refresh_token);
    return res;
  }

  async getMe(): Promise<User> {
    return this.request<User>("/auth/me");
  }

  async searchUsers(query: string): Promise<User[]> {
    return this.request<User[]>(`/users/search?q=${encodeURIComponent(query)}`);
  }

  async getUserPublicKey(userId: string): Promise<string> {
    const res = await this.request<{ public_key: string }>(`/users/${userId}/public-key`);
    return res.public_key;
  }

  async getConversations(): Promise<Conversation[]> {
    return this.request<Conversation[]>("/conversations");
  }

  async getMessages(userId: string, before?: string): Promise<Message[]> {
    let url = `/conversations/${userId}/messages?limit=50`;
    if (before) url += `&before=${encodeURIComponent(before)}`;
    return this.request<Message[]>(url);
  }

  async logout() {
    if (this.refreshToken) {
      await fetch(`${BASE_URL}/auth/logout`, {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          "Authorization": `Bearer ${this.accessToken}`
        },
        body: JSON.stringify({ refresh_token: this.refreshToken }),
      }).catch(() => {});
    }
    this.clearTokens();
  }

  getAccessToken() { return this.accessToken; }
}

export const api = new APIClient();
