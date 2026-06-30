const BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

interface RequestOptions extends RequestInit {
  params?: Record<string, string | number | boolean | undefined>;
}

async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const url = new URL(`${BASE_URL}${path}`);
  if (options.params) {
    Object.entries(options.params).forEach(([key, val]) => {
      if (val !== undefined) {
        url.searchParams.append(key, String(val));
      }
    });
  }

  const token = typeof window !== "undefined" ? localStorage.getItem("access_token") : null;
  const headers = new Headers(options.headers);
  if (token && !headers.has("Authorization")) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  const response = await fetch(url.toString(), {
    ...options,
    headers,
  });

  if (response.status === 401 && typeof window !== "undefined" && path !== "/auth/refresh-token") {
    const rToken = localStorage.getItem("refresh_token");
    if (rToken) {
      try {
        const refreshResponse = await fetch(`${BASE_URL}/auth/refresh-token`, {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${rToken}`,
          },
        });
        if (refreshResponse.ok) {
          const tokens = await refreshResponse.json();
          localStorage.setItem("access_token", tokens.access_token);
          localStorage.setItem("refresh_token", tokens.refresh_token);
          headers.set("Authorization", `Bearer ${tokens.access_token}`);
          const retryResponse = await fetch(url.toString(), {
            ...options,
            headers,
          });
          if (!retryResponse.ok) {
            throw retryResponse;
          }
          return await retryResponse.json() as T;
        }
      } catch (err) {
        localStorage.removeItem("access_token");
        localStorage.removeItem("refresh_token");
        window.dispatchEvent(new Event("auth-logout"));
      }
    }
  }

  if (response.status === 204) {
    return {} as T;
  }

  if (!response.ok) {
    let errorDetail = "An error occurred";
    try {
      const errBody = await response.json();
      if (typeof errBody.detail === "string") {
        errorDetail = errBody.detail;
      } else if (Array.isArray(errBody.detail)) {
        errorDetail = errBody.detail.map((e: any) => e.msg || JSON.stringify(e)).join(", ");
      } else if (errBody.detail) {
        errorDetail = JSON.stringify(errBody.detail);
      }
    } catch (_) {}
    throw new Error(errorDetail);
  }

  return await response.json() as T;
}

export interface TokenResponse {
  access_token: string;
  refresh_token: string;
  token_type: string;
}

export interface MessageResponse {
  message: string;
}

export interface UserResponse {
  name: string;
  email: string;
  role: string;
  created_at: string;
  is_active: boolean;
}

export interface UsageMetadata {
  input_tokens: number;
  output_tokens: number;
  total_tokens: number;
  input_token_details?: Record<string, any>;
  output_token_details?: Record<string, any>;
}

export interface ChatResponse {
  response: string;
  chat_id: string;
  usage?: UsageMetadata;
}

export interface ChatMetadata {
  SessionId: string;
  user_id: string;
  chat_id: string;
  title?: string;
  message_count?: number;
  total_input_tokens?: number;
  total_output_tokens?: number;
  total_tokens?: number;
  created_at?: string;
  updated_at?: string;
}

export interface ChatListResponse {
  chats: ChatMetadata[];
  total: number;
}

export interface MessageItem {
  role: "user" | "assistant";
  content: string;
  timestamp?: string;
  usage_metadata?: UsageMetadata;
}

export interface ChatDetailResponse {
  chat_metadata: ChatMetadata;
  messages: MessageItem[];
}

export interface AvailableModelsResponse {
  default_model: string;
  providers: Record<string, string[]>;
  all_models: string[];
  total_models: number;
}

export interface ModelUsage {
  model_name: string;
  total_input_tokens: number;
  total_output_tokens: number;
  total_tokens: number;
  request_count: number;
  first_used?: string;
  last_used?: string;
}

export interface UsageTotals {
  total_input_tokens: number;
  total_output_tokens: number;
  total_tokens: number;
  total_requests: number;
}

export interface TokenUsageSummaryResponse {
  user_id: string;
  period_days: number;
  start_date: string;
  end_date: string;
  filter_model?: string;
  models: ModelUsage[];
  totals: UsageTotals;
}

export interface TokenUsageRecord {
  user_id: string;
  chat_id: string;
  model_name: string;
  input_tokens: number;
  output_tokens: number;
  total_tokens: number;
  input_token_details?: Record<string, any>;
  output_token_details?: Record<string, any>;
  timestamp: string;
}

export interface TokenUsageHistoryResponse {
  user_id: string;
  total_records: number;
  returned_records: number;
  skip: number;
  limit: number;
  records: TokenUsageRecord[];
}

export interface ChatModelUsage {
  model_name: string;
  total_input_tokens: number;
  total_output_tokens: number;
  total_tokens: number;
  request_count: number;
}

export interface ChatTokenUsageResponse {
  user_id: string;
  chat_id: string;
  models: ChatModelUsage[];
  totals: UsageTotals;
}

export interface ModelInfo {
  model_name: string;
  usage_count: number;
  last_used: string;
}

export interface UsedModelsResponse {
  user_id: string;
  models: ModelInfo[];
}

export const api = {
  generateOtp: async (email: string, captchaToken?: string): Promise<MessageResponse> => {
    return request<MessageResponse>("/auth/generate-otp", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, captcha_token: captchaToken || "" }),
    });
  },

  signupUser: async (name: string, email: string, password: string, otp: number): Promise<TokenResponse> => {
    return request<TokenResponse>("/auth/signup/user", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, email, password, otp }),
    });
  },

  loginUser: async (email: string, password: string): Promise<TokenResponse> => {
    const params = new URLSearchParams();
    params.append("username", email);
    params.append("password", password);
    return request<TokenResponse>("/auth/login/user", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: params.toString(),
    });
  },

  requestPasswordReset: async (email: string): Promise<MessageResponse> => {
    return request<MessageResponse>("/auth/password-reset/request", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    });
  },

  confirmPasswordReset: async (email: string, otp: number, newPassword: string): Promise<MessageResponse> => {
    return request<MessageResponse>("/auth/password-reset/verify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, otp, new_password: newPassword }),
    });
  },

  getProfile: async (): Promise<UserResponse> => {
    return request<UserResponse>("/user_management/me", {
      method: "GET",
    });
  },

  updateProfile: async (name?: string, password?: string): Promise<MessageResponse> => {
    return request<MessageResponse>("/user_management/me", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, password }),
    });
  },

  deleteAccount: async (): Promise<void> => {
    return request<void>("/user_management/me", {
      method: "DELETE",
    });
  },

  chat: async (message: string, chatId?: string, modelName?: string): Promise<ChatResponse> => {
    return request<ChatResponse>("/chatbot/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message, chat_id: chatId || null, model_name: modelName || null }),
    });
  },

  getAvailableModels: async (): Promise<AvailableModelsResponse> => {
    return request<AvailableModelsResponse>("/chatbot/available-models", {
      method: "GET",
    });
  },

  getChats: async (): Promise<ChatListResponse> => {
    return request<ChatListResponse>("/chatbot/chats", {
      method: "GET",
    });
  },

  getChatDetails: async (chatId: string): Promise<ChatDetailResponse> => {
    return request<ChatDetailResponse>(`/chatbot/chats/${chatId}`, {
      method: "GET",
    });
  },

  deleteChat: async (chatId: string): Promise<MessageResponse> => {
    return request<MessageResponse>(`/chatbot/chats/${chatId}`, {
      method: "DELETE",
    });
  },

  getTokenUsageSummary: async (modelName?: string, days: number = 30): Promise<TokenUsageSummaryResponse> => {
    return request<TokenUsageSummaryResponse>("/token-usage/summary", {
      method: "GET",
      params: { model_name: modelName, days },
    });
  },

  getTokenUsageHistory: async (modelName?: string, chatId?: string, limit: number = 100, skip: number = 0): Promise<TokenUsageHistoryResponse> => {
    return request<TokenUsageHistoryResponse>("/token-usage/history", {
      method: "GET",
      params: { model_name: modelName, chat_id: chatId, limit, skip },
    });
  },

  getChatTokenUsage: async (chatId: string): Promise<ChatTokenUsageResponse> => {
    return request<ChatTokenUsageResponse>(`/token-usage/by-chat/${chatId}`, {
      method: "GET",
    });
  },

  getUsedModels: async (): Promise<UsedModelsResponse> => {
    return request<UsedModelsResponse>("/token-usage/models", {
      method: "GET",
    });
  },
};
