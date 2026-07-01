# Database Entity-Relationship Diagram

This document presents the Entity-Relationship Diagram (ERD) for the NexLab application. The backend uses **MongoDB** as its primary data store, using six key collections for user authentication, chat session management, activity tracking, and token usage telemetry.

## Schema Summary

The database architecture is designed around the central **`users`** entity:
1.  **Authentication & Security**: The **`users`** collection stores credentials, roles, status flags, and usage aggregates. **`otps`** manages temporal passcode verification for registration and password resets.
2.  **Conversations & History**: Chat sessions are split into **`chat_metadata`** (for fast indexing, listing, pagination, and session statistics) and **`chats`** (which contains the raw, serialized LangChain history). They share a one-to-one relationship mapped by `SessionId` (which is constructed as `user_id_chat_id`).
3.  **Auditing & Telemetry**: **`admin_messages`** acts as a denormalized activity feed for admin monitoring. **`token_usage`** is a MongoDB **Time-Series collection** structured to track token consumption details across different models and chats for fine-grained logging and analytics.

---

## Entity-Relationship Diagram

```mermaid
erDiagram
    users ||--o{ otps : "receives"
    users ||--o{ chat_metadata : "owns"
    chat_metadata ||--|| chats : "has"
    users ||--o{ admin_messages : "triggers"
    users ||--o{ token_usage : "tracks"
    chat_metadata ||--o{ token_usage : "accumulates"

    users {
        object_id id PK
        string email UK
        string name
        string password
        string role
        string auth_method
        datetime created_at
        boolean is_active
        boolean is_bounced
        boolean is_complained
        int chat_count
        int total_tokens
        array models_used
    }
    
    otps {
        object_id id PK
        string email FK
        int otp
        datetime expires_at
    }

    chat_metadata {
        string SessionId PK
        object_id user_id FK
        string chat_id
        string title
        int message_count
        int total_input_tokens
        int total_output_tokens
        int total_tokens
        datetime created_at
        datetime updated_at
    }

    chats {
        string SessionId PK
        array History
        datetime created_at
    }

    admin_messages {
        object_id id PK
        object_id user_id FK
        string user_name
        string user_email
        string input_message
        string ai_response
        datetime timestamp
        string chat_id
        string session_id FK
        string model_name
        boolean deleted
        datetime deleted_at
    }

    token_usage {
        object_id id PK
        datetime timestamp
        object_id user_id FK
        string chat_id
        string model_name
        int input_tokens
        int output_tokens
        int total_tokens
        object input_token_details
        object output_token_details
    }
```

---

## Data Dictionary

| Collection / Entity | Source Schema / Collection Name | Description |
| :--- | :--- | :--- |
| **`users`** | `settings.USER_COLLECTION_NAME` (`users`) | Stores registered user accounts, roles (`user`, `admin`), active status, email delivery health flags (`is_bounced`, `is_complained`), and cache/aggregates for chat count, total token usage, and used models list. |
| **`otps`** | `settings.OTP_COLLECTION_NAME` (`otps`) | Holds verification passcodes used during registration and password reset. Features a TTL index on `expires_at` that automatically deletes expired entries after 5 minutes. |
| **`chat_metadata`**| `settings.CHAT_METADATA_COLLECTION_NAME` (`chat_metadata`) | Stores metadata summary per chat session (title, count, model and token aggregation) for fast query listing and pagination. |
| **`chats`** | `settings.CHAT_COLLECTION_NAME` (`chats`) | Stores the full conversation history. The `History` attribute is a list of serialized messages (human messages and AI response documents including model information and metadata). |
| **`admin_messages`**| `settings.ADMIN_MESSAGES_COLLECTION_NAME` (`admin_messages`) | Denormalized activity feed. Captures input messages and assistant responses for admin auditing. Supports logical soft delete. |
| **`token_usage`** | `settings.TOKEN_USAGE_COLLECTION_NAME` (`token_usage`) | Time-series collection tracking granular input and output token breakdowns (e.g., text, audio, reasoning, cache hits) for each chat request. |
