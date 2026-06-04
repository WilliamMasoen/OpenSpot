# OpenSpot — Architecture & System Design

A parking spot rental marketplace for downtown Toronto condos. Owners post parking spots; renters browse, favorite, and message owners directly. Phase 1 covers listings + real-time chat. Phase 2 will add escrow payments.

---

## Table of Contents

1. [High-Level Overview](#1-high-level-overview)
2. [Technology Choices](#2-technology-choices)
3. [Backend Architecture](#3-backend-architecture)
4. [Database Design](#4-database-design)
5. [Authentication & Security](#5-authentication--security)
6. [Real-Time Chat](#6-real-time-chat)
7. [Push Notifications](#7-push-notifications)
8. [Logging & Audit](#8-logging--audit)
9. [Frontend Architecture](#9-frontend-architecture)
10. [Key Data Flows](#10-key-data-flows)
11. [Image Storage](#11-image-storage)
12. [Geolocation & Search](#12-geolocation--search)
13. [Known Limitations & Future Work](#13-known-limitations--future-work)

---

## 1. High-Level Overview

```
┌─────────────────────────────────────────────────┐
│               React Native App (Expo)            │
│                                                   │
│  Expo Router (file-based nav)                    │
│  Zustand (auth state, unread count)              │
│  Custom hooks → apiClient → fetch                │
│  @microsoft/signalr (WebSocket client)           │
│  expo-notifications (push token + handler)       │
└──────────────┬──────────────────────────────────┘
               │ HTTPS + WSS
               ▼
┌─────────────────────────────────────────────────┐
│            ASP.NET Core 10 API                   │
│                                                   │
│  Controllers → Services → EF Core               │
│  ASP.NET Identity (user management)              │
│  JWT Bearer authentication                       │
│  SignalR Hub (WebSocket server)                  │
│  Nominatim (geocoding via HTTP)                  │
│  MailKit (SMTP email)                            │
│  Expo Push API (push notifications)              │
│  Serilog (structured request logging)            │
│  IAuditService (business event audit trail)      │
│  Static file serving (uploaded images)           │
└──────────────┬──────────────────────────────────┘
               │
               ▼
┌─────────────────────────────────────────────────┐
│               PostgreSQL                         │
│  Users, Listings, Images, Favorites              │
│  Conversations, Messages, RefreshTokens          │
│  PushTokens, AuditLogs                          │
└─────────────────────────────────────────────────┘
```

There is no separate API gateway, message queue, or cache layer in Phase 1. The backend is a single ASP.NET Core process that handles HTTP requests, WebSocket connections, database access, file I/O, and outbound email/push notifications.

---

## 2. Technology Choices

### Why ASP.NET Core (.NET 10)?

- **Built-in SignalR**: Real-time WebSocket support is a first-class citizen, no third-party service needed.
- **ASP.NET Identity**: User management (password hashing, email confirmation tokens, password reset tokens) comes out of the box.
- **EF Core + Npgsql**: Type-safe ORM with PostgreSQL support and code-first migrations.
- **Strongly typed**: C# with nullable reference types catches bugs at compile time.

### Why React Native / Expo?

- **Cross-platform**: One codebase for iOS and Android.
- **Expo managed workflow**: Simplifies builds, native modules, and permissions (camera, location, secure storage, notifications).
- **Expo Router**: File-based routing (similar to Next.js) gives a clean convention for screens and navigation groups.
- **New Architecture enabled**: Hermes + JSI for better performance.

### Why PostgreSQL?

- Full ACID compliance for financial correctness (needed for Phase 2 escrow).
- `ILike` operator for case-insensitive text search (used in listings search).
- Unique indexes with partial keys (used for `UserFavorite` composite key and `Conversation` uniqueness).

### Why Zustand (not Redux)?

- Minimal boilerplate for the two small stores needed (auth state, chat unread count).
- Reads outside React components work natively (`useAuthStore.getState()`), which is required by `apiClient.ts` and `signalRService.ts`.

---

## 3. Backend Architecture

### Layered Structure

```
Controller layer  →  receives HTTP requests, extracts claims, delegates to service
Service layer     →  all business logic, returns ServiceResult<T>
Data layer        →  ApplicationDbContext (EF Core), direct DbSet access
```

There is intentionally **no repository layer** on top of EF Core — the DbContext is injected directly into services. This keeps Phase 1 simple; a repository abstraction can be added when testability becomes a priority.

### ServiceResult Pattern

Every service method returns `ServiceResult<T>`:

```csharp
public class ServiceResult<T>
{
    public bool Success { get; }
    public ResultStatus Status { get; }  // Ok, Created, NotFound, Conflict, Forbidden, ValidationError, Error
    public T? Data { get; }
    public string? Message { get; }
}
```

Controllers switch on `result.Status` to return the correct HTTP status code. This decouples HTTP semantics from business logic — the service doesn't know or care that it runs in an HTTP context.

### Dependency Injection

Everything is registered in `Program.cs` via the built-in .NET DI container:

- `Scoped`: `ApplicationDbContext`, `IAuthService`, `IListingService`, `IConversationService`, `IEmailService`, `IAuditService`, `IPushNotificationService`
- `HttpClient` with `IHttpClientFactory`: `IGeocodingService` (Nominatim) — gets a preconfigured `HttpClient` with `User-Agent` header and 5-second timeout. `PushNotificationService` uses `IHttpClientFactory` to create a plain client per call.
- `Singleton` (SignalR default): `IHubContext<ChatHub>` — injected into `ConversationService` to push messages

### Seeding

On every startup, `SeedAsync()` runs before the app processes requests. It:
1. Creates `Admin` and `User` roles if they don't exist.
2. Creates the admin user if it doesn't exist (email + password from environment variables).

This is idempotent — safe to run on every deploy.

---

## 4. Database Design

### Entity Relationship Summary

```
User (ASP.NET Identity)
 ├── owns many Listing
 ├── has many UserFavorite → Listing
 ├── participates in many Conversation (as Buyer or Owner)
 ├── has many RefreshToken
 └── has many PushToken

Listing
 ├── has many ListingImage
 ├── has many UserFavorite
 └── has many Conversation

Conversation
 └── has many Message

AuditLog  (standalone, referenced by UserId string)
```

### Schema Details

**Users** — extends `IdentityUser`
| Column | Type | Notes |
|---|---|---|
| Id | string (GUID) | ASP.NET Identity default |
| Email | string | Unique, required |
| FirstName | string | |
| LastName | string | |
| PhoneNumber | string? | |
| EmailConfirmed | bool | Must be true to login |
| CreatedAt | DateTime | UTC, set on registration |

**Listings**
| Column | Type | Notes |
|---|---|---|
| Id | Guid | PK |
| Title | string | |
| Description | string | |
| Address | string | Human-readable |
| Price | int | Cents or dollars (not enforced) |
| StartDate | DateOnly | Availability window start |
| EndDate | DateOnly | Availability window end |
| IsAvailable | bool | Owner can toggle |
| Latitude | double? | Populated by geocoding on create |
| Longitude | double? | Populated by geocoding on create |
| OwnerId | string | FK → User |
| CreatedAt | DateTime | UTC |

**ListingImages**
| Column | Type | Notes |
|---|---|---|
| Id | Guid | PK |
| ListingId | Guid | FK → Listing |
| Url | string | Absolute URL served by the backend static files |
| CreatedAt | DateTime | UTC |

**UserFavorites** — join table
| Column | Type | Notes |
|---|---|---|
| UserId | string | FK → User |
| ListingId | Guid | FK → Listing |
| CreatedAt | DateTime | UTC |
| (UserId, ListingId) | composite PK | Enforced by EF config |

**RefreshTokens**
| Column | Type | Notes |
|---|---|---|
| Id | Guid | PK |
| Token | string | 64 random bytes, Base64-encoded |
| UserId | string | FK → User |
| ExpiresAt | DateTime | UTC |
| IsRevoked | bool | |
| CreatedAt | DateTime | UTC |

**Conversations**
| Column | Type | Notes |
|---|---|---|
| Id | Guid | PK |
| ListingId | Guid | FK → Listing |
| BuyerId | string | FK → User |
| OwnerId | string | FK → User |
| CreatedAt | DateTime | UTC |
| (ListingId, BuyerId) | unique index | One conversation per buyer per listing |

**Messages**
| Column | Type | Notes |
|---|---|---|
| Id | Guid | PK |
| ConversationId | Guid | FK → Conversation |
| SenderId | string | FK → User |
| Body | string | |
| SentAt | DateTime | UTC |
| IsRead | bool | |

**PushTokens**
| Column | Type | Notes |
|---|---|---|
| Id | Guid | PK |
| UserId | string | FK → User |
| Token | string | Expo push token (`ExponentPushToken[...]`), unique index |
| CreatedAt | DateTime | UTC |

**AuditLogs**
| Column | Type | Notes |
|---|---|---|
| Id | Guid | PK |
| UserId | string? | User who performed the action (null for anonymous) |
| Action | string | e.g. `auth.login`, `listing.created`, `listing.deleted` |
| EntityType | string? | e.g. `User`, `Listing` |
| EntityId | string? | ID of the affected entity |
| Details | string? | Free-text or JSON extra context |
| IpAddress | string? | Requester IP from `IHttpContextAccessor` |
| CreatedAt | DateTime | UTC |

### Pagination

The `GET /api/listings` endpoint returns a `PagedResult<GetListingDto>` instead of a flat array:

```json
{
  "items": [...],
  "totalCount": 150,
  "page": 1,
  "pageSize": 20,
  "hasMore": true
}
```

`page` and `pageSize` are query parameters (defaults: 1 and 20, max pageSize capped at 100 server-side). The frontend accumulates pages in a `listings` array and calls `loadMore()` when `FlatList.onEndReached` fires at 30% from the bottom. A pull-to-refresh resets to page 1 and replaces the full list.

### Key Database Decisions

- **`DateOnly` for listing dates**: Availability is date-range based, not datetime. `DateOnly` makes the intent explicit and avoids timezone confusion.
- **`int` for Price**: Avoids floating-point rounding. Convention is cents (e.g. 15000 = $150.00), though this isn't enforced in Phase 1.
- **Nullable coordinates**: Geocoding can fail (API timeout, unrecognized address). Listings can still be created without coordinates — they just won't appear in location-based searches.
- **Conversations store both BuyerId and OwnerId**: Denormalized from Listing for fast query access without a join back to Listing on every conversation load.
- **PushToken unique on Token, not UserId**: A user can have multiple devices. Uniqueness is on the token string itself — the same device can't register twice, but a user can have as many rows as devices.

---

## 5. Authentication & Security

### Token Architecture

OpenSpot uses a **dual-token** JWT system:

```
Access Token:   short-lived (15 min), stored in Zustand memory only
Refresh Token:  long-lived (30 days), stored in expo-secure-store (device keychain)
```

The access token is **never persisted to disk** on the device. If the app is killed, the access token is gone. On the next launch, `_layout.tsx` reads the refresh token from SecureStore and silently exchanges it for a new access token pair.

### Access Token Contents (Claims)

```
sub              → user ID
email            → user email
jti              → unique token ID (for future revocation)
ClaimTypes.NameIdentifier → user ID (duplicate of sub, required by SignalR UserIdentifier)
ClaimTypes.Role  → "Admin" or "User"
```

`ClockSkew = TimeSpan.Zero` is set on the server so tokens expire exactly at their stated time without a grace window.

### Refresh Token Rotation

Every refresh call:
1. Validates the incoming refresh token (exists, not revoked, not expired).
2. **Deletes** the old token from the database.
3. **Issues a brand new** refresh token.
4. Also deletes any other expired/revoked tokens for that user (cleanup on every refresh).

This is **refresh token rotation** — each token is single-use. A stolen token can only be used once; the legitimate client's next use will fail (the stolen token was already consumed), which is a signal of compromise.

### Auto Token Refresh in apiClient

```
Request → 401 Unauthorized
         → tryRefresh() reads refresh token from SecureStore
         → POST /api/auth/refresh
         → success: update Zustand + SecureStore, retry original request
         → failure: clearAuth() → user redirected to login
```

This is transparent to all callers — hooks and services just call `apiClient.get/post/put/delete`.

### Password Reset & Email Verification

Both flows use ASP.NET Identity's built-in token providers (TOTP-based, time-limited). The backend:
1. Generates the token via `_userManager.GenerateEmailConfirmationTokenAsync()` or `GeneratePasswordResetTokenAsync()`.
2. URL-encodes it and embeds it in a link.
3. Sends via MailKit / SMTP.

The `/api/auth/verify-email` endpoint is a GET, navigated to by the user clicking the link in their email. The backend decodes the token and calls `ConfirmEmailAsync`.

**Email enumeration protection**: `ForgotPasswordAsync` returns `204 No Content` regardless of whether the email exists. The frontend shows the same "check your email" message either way.

### SignalR Authentication

WebSocket connections can't send custom headers after the initial handshake. SignalR's solution is to pass the JWT as a query parameter on the initial HTTP upgrade request:

```
ws://host/hubs/chat?access_token=<jwt>
```

The backend `OnMessageReceived` event extracts `access_token` from the query string and sets it as the bearer token for that connection. After that, the connection is authenticated like any other JWT request.

---

## 6. Real-Time Chat

### Architecture

```
Sender device          Backend              Recipient device
     │                    │                      │
     │  POST /messages ──►│                      │
     │                    │ Save to DB           │
     │                    │ SignalR push ────────►│ (if connected)
     │                    │ Push notification ───►│ (always, via Expo)
     │◄── 201 Created     │                      │
```

Messages are delivered by two paths:
1. **HTTP**: The sender gets the created message back as the POST response. The frontend adds it to local state immediately.
2. **SignalR**: The backend pushes the same message to the recipient's WebSocket connection if they're online. The recipient's `useMessages` hook appends it to their local state.
3. **Push notification**: The backend always sends a push notification to the recipient's registered devices (see Section 7). If the app is in the foreground, the OS delivers it silently or via in-app handler. If backgrounded or closed, a system notification appears.

The sender does NOT receive their own message via SignalR — they get it via the HTTP response. This avoids duplicates.

### Hub Design (ChatHub)

The hub itself is minimal:

```csharp
[Authorize]
public class ChatHub : Hub
{
    public override async Task OnConnectedAsync()
    {
        var userId = Context.UserIdentifier;
        await Groups.AddToGroupAsync(Context.ConnectionId, $"user_{userId}");
        await base.OnConnectedAsync();
    }
}
```

Every authenticated connection is added to a group named `user_{userId}`. The `ConversationService` pushes messages to the recipient's group:

```csharp
await _hub.Clients.Group($"user_{recipientId}")
    .SendAsync("ReceiveMessage", dto, conversationId.ToString());
```

This design supports multiple simultaneous connections per user (e.g. multiple devices) — all receive the message.

### Client-Side Connection

`signalRService.ts` is a module-level singleton (not a React hook). It holds the `HubConnection` outside the React tree so the connection persists across screen navigation. It exposes:

- `connect()` — called when the user authenticates
- `disconnect()` — called on logout
- `onMessage(handler)` — registers a callback; returns an unsubscribe function

`useMessages` calls `onMessage` in a `useEffect` and unsubscribes on cleanup. Multiple conversation screens could technically subscribe simultaneously, but Expo Router unmounts screens when navigating away, so in practice only the active conversation receives the push.

### Unread Count

The unread count displayed on the Chat tab badge is managed by `chatStore` (Zustand):

- **Initial value**: Fetched on login by summing `unreadCount` across all conversations.
- **Decrement**: When a user opens a conversation, `useMessages` marks messages read and calls `decrementUnread(n)`.
- **Refresh**: When the user navigates to the Chat tab, `useConversations` re-fetches all conversations (via `useFocusEffect`) and recomputes the total unread count from the server.

---

## 7. Push Notifications

### Architecture

OpenSpot uses **Expo Push Notifications** as the delivery layer. Expo relays notifications to Apple APNs (iOS) and Google FCM (Android), removing the need to manage credentials for both platforms during development.

```
Backend                     Expo Push Service         Device
   │                              │                     │
   │  POST exp.host/push/send ───►│                     │
   │  { to: token, title, body }  │  APNs / FCM  ──────►│ system notification
   │                              │                     │   (if app backgrounded)
   │                              │                     │   or in-app handler
   │                              │                     │   (if app foregrounded)
```

### Token Lifecycle

1. **On login**: The frontend requests notification permission (`requestPermissionsAsync`). If granted, it calls `getExpoPushTokenAsync()` to get a device-specific `ExponentPushToken[...]` string and `POST /api/users/push-token` to store it.
2. **On logout**: The frontend calls `DELETE /api/users/push-token` to remove the token, stopping notifications to that device.
3. **Multiple devices**: A user can have multiple push token rows — one per device. All are notified when a message arrives.

### Backend Flow

`PushNotificationService.SendToUserAsync(userId, title, body)`:
1. Looks up all `PushToken` rows for that user.
2. If none, returns immediately (user hasn't granted permission or hasn't logged in on a real device).
3. Sends a single HTTP POST to `https://exp.host/push/send` with an array of messages (one per token).
4. Failures are logged as warnings but never throw — a failed push notification must not fail the message send.

`ConversationService.SendMessageAsync` calls push as a fire-and-forget (`_ = _push.SendToUserAsync(...)`) so the HTTP response to the sender is not delayed by the Expo API call.

### Frontend Notification Handler

`Notifications.setNotificationHandler` (set at module level in `_layout.tsx`) configures how notifications are displayed when the app is in the foreground:

```typescript
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});
```

Android requires a **notification channel** to be created before notifications can be shown. This is done in `registerPushToken()` via `setNotificationChannelAsync`.

### Production Notes

- During development, push notifications **only work on a real physical device** (not simulators/emulators). Expo Go on a physical device works fine.
- For production App Store / Play Store builds, APNs and FCM credentials must be configured in EAS (Expo Application Services). Until then, Expo's development push relay handles delivery.
- Expo Push is free with no per-message cost. APNs and FCM are also free.

---

## 8. Logging & Audit

### Two-Layer Approach

OpenSpot uses two complementary logging mechanisms:

**Layer 1 — Serilog request logging** (infrastructure):
- Automatically logs every HTTP request: method, path, status code, duration, and user identity.
- Configured via `builder.Host.UseSerilog(...)` and `app.UseSerilogRequestLogging()`.
- Zero manual code per endpoint. Output goes to the console (captured by the host environment in production).

**Layer 2 — Audit table** (business events):
- Records meaningful business actions for queryable history.
- `IAuditService.Log(action, userId, entityType, entityId, details)` adds a row to the `AuditLogs` table.
- The call is **synchronous and context-free** — it just appends to the `DbContext` change tracker. The row is saved atomically in the same `SaveChangesAsync` call as the business operation (no extra DB roundtrip, no partial audit if the main operation fails).
- IP address is captured automatically via `IHttpContextAccessor`.

### Audited Events

| Action | Trigger |
|---|---|
| `user.registered` | New account created |
| `auth.login` | Successful login |
| `listing.created` | New listing submitted |
| `listing.updated` | Listing fields edited |
| `listing.deleted` | Listing removed |
| `listing.availability_changed` | Owner marks as rented/available |
| `listing.favorited` | User adds to favorites |
| `listing.unfavorited` | User removes from favorites |

### Querying Audit Logs

Audit logs live in the `AuditLogs` table in PostgreSQL and can be queried directly:

```sql
-- All actions by a specific user
SELECT * FROM "AuditLogs" WHERE "UserId" = '...' ORDER BY "CreatedAt" DESC;

-- All deletions in the last 7 days
SELECT * FROM "AuditLogs" WHERE "Action" = 'listing.deleted'
  AND "CreatedAt" > NOW() - INTERVAL '7 days';

-- Login history for a user
SELECT "IpAddress", "CreatedAt" FROM "AuditLogs"
  WHERE "Action" = 'auth.login' AND "UserId" = '...'
  ORDER BY "CreatedAt" DESC;
```

---

## 9. Frontend Architecture

### File-Based Routing (Expo Router)

```
app/
├── _layout.tsx               Root layout: auth guard + SignalR + push notifications + hydration
├── onboarding.tsx            First-time tutorial (4 slides, skippable)
├── index.tsx                 Redirect (handled by _layout)
├── (auth)/
│   ├── _layout.tsx           Stack for auth screens
│   ├── login.tsx
│   ├── register.tsx
│   └── forgot-password.tsx
├── (tabs)/
│   ├── _layout.tsx           Bottom tab bar
│   ├── index.tsx             Home — listing grid with sort/price filters + nearest sort
│   ├── search.tsx            Text + location search
│   ├── post.tsx              Placeholder (tab opens modal)
│   ├── chat.tsx              Conversation list
│   └── profile.tsx           User info + navigation
├── create.tsx                Modal — create new listing
├── listing/[id].tsx          Listing detail
├── conversation/[id].tsx     Chat thread
├── edit-listing/[id].tsx     Modal — edit existing listing
├── edit-profile.tsx          Edit name/phone
├── my-listings.tsx           Owner's listings management
└── favorites.tsx             Saved listings
```

`(auth)` and `(tabs)` are Expo Router **route groups** — they scope the layout without adding to the URL path.

### Auth Guard

`AuthGuard` is a component rendered inside the root layout that reads auth state and uses `router.replace()` to redirect:

```
isLoading = true                              →  show spinner
!hasSeenOnboarding, not on /onboarding       →  redirect to /onboarding
hasSeenOnboarding, authenticated, in (auth)  →  redirect to /(tabs)
hasSeenOnboarding, not authenticated, not in (auth) or onboarding  →  redirect to /(auth)/login
```

Hydration reads `hasSeenOnboarding` and the refresh token from `expo-secure-store` in parallel, then attempts a silent token refresh if a refresh token exists. `isLoading = true` by default prevents any redirect until hydration completes.

### State Management

Two Zustand stores:

**authStore**: Auth identity + tokens
```typescript
{
  user: { userId, email, firstName, lastName, roles } | null
  accessToken: string | null
  refreshToken: string | null        // mirrors SecureStore
  isAuthenticated: boolean
  isLoading: boolean
}
```

**chatStore**: Chat badge
```typescript
{
  unreadCount: number
}
```

Everything else is local component state managed by custom hooks. There is no global listing state — each screen fetches fresh from the API on mount or focus.

### Custom Hooks Pattern

Each hook encapsulates one domain's data-fetching logic:

| Hook | What it manages |
|---|---|
| `useAuth` | login, register, logout, forgot-password |
| `useListings` | paginated listings with infinite scroll, sort/price filters, nearest sort with location |
| `useMyListings` | owner's listings + delete + availability toggle |
| `useCreateListing` | creation + sequential image uploads |
| `useEditListing` | update listing fields + new image uploads |
| `useFavoritesMap` | optimistic toggle backed by `updateListing` callback |
| `useMyFavorites` | favorited listings + optimistic remove |
| `useSearch` | text + location search |
| `useConversations` | conversation list (re-fetches on tab focus) |
| `useMessages` | messages for one conversation + SignalR listener + send + send error |

### Optimistic Favorites

`useFavoritesMap` accepts an `updateListing` callback that writes directly into the listings array — this is the single source of truth. On toggle:

1. User taps heart → read current `isFavorited` from the listings array
2. Call `updateListing(id, { isFavorited: !current })` → UI updates immediately
3. API call resolves → call `updateListing(id, { isFavorited: result.isFavorited })` with server value
4. API call fails → revert via `updateListing(id, { isFavorited: current })`

### API Client

`apiClient.ts` is a thin wrapper around `fetch`:

- Sets `Authorization: Bearer <token>` on every request.
- On 401: calls `tryRefresh()`, then retries the original request once with the new token.
- On continued failure: calls `clearAuth()` (triggers redirect to login via AuthGuard).
- On 204: returns `undefined as T` (avoids trying to parse an empty body).
- On non-ok responses: reads the response body as text and throws an `Error` with that message (backend returns human-readable error strings).

---

## 10. Key Data Flows

### Registration Flow

```
1. User fills form → register(dto)
2. POST /api/auth/register
3. Backend: FindByEmail (conflict check) → CreateAsync (hash password) → AddToRoleAsync("User")
           → SendVerificationEmail → audit log "user.registered" → GenerateTokensAsync
4. Return TokenResponseDto (access token + refresh token + user info)
5. Frontend: setAuth() → SecureStore.setItem(refresh token) → Zustand update
6. AuthGuard redirects to /(tabs)
7. Frontend: registerPushToken() runs → permission request → token saved to backend
8. User gets verification email → clicks link → GET /api/auth/verify-email → EmailConfirmed = true
```

### Message Send Flow (with Push Notification)

```
1. User types message → tap send
2. useMessages.sendMessage(body)
3. POST /api/conversations/{id}/messages (HTTP)
4. Backend: validate sender → save Message to DB → audit log "message.sent"
5. Backend: SignalR push to recipient's group (if connected)
6. Backend: fire-and-forget push to Expo Push API → Expo relays to APNs/FCM → device notification
7. Backend: return 201 Created + MessageDto
8. Frontend (sender): append message to local state from HTTP response
9. Frontend (recipient, foregrounded): onMessage SignalR handler fires → append to state
   Frontend (recipient, backgrounded): system notification appears
```

### Listing Search Flow

```
1. User types query OR requests location
2. useSearch.search({ q, lat, lng, radius })
3. GET /api/listings/search?q=...&lat=...&lng=...&radius=...
4. Backend: EF Core query with ILike for text match → ToListAsync (all text matches in memory)
5. If lat/lng provided: Haversine filter in C# memory (< radiusKm)
6. Return filtered list
```

### Nearest Listings Flow

```
1. App launches → silent location permission check (getForegroundPermissionsAsync)
2. If granted: getCurrentPositionAsync → setLocation(lat, lng) → setFilters("nearest", maxPrice)
3. GET /api/listings?sortBy=nearest&lat=...&lng=...
4. Backend: fetch all available listings → sort in C# memory by Haversine distance → page
5. Frontend: shows "Showing spots nearest to you" banner
6. User taps "Nearest" chip without permission → requestForegroundPermissionsAsync → same flow
```

### Token Refresh Flow (Silent, on Startup)

```
1. App launches → _layout.tsx useEffect runs
2. SecureStore.getItemAsync(REFRESH_TOKEN_KEY) → refreshToken or null
3. If token exists: POST /api/auth/refresh
4. Backend: find token in DB → validate (not revoked, not expired) → delete → issue new pair
5. setAuth(newTokenResponse) → update Zustand + SecureStore
6. setLoading(false) → AuthGuard allows navigation
```

---

## 11. Image Storage

Images are stored on the **server's local filesystem** under `wwwroot/uploads/{listingId}/{uuid}.{ext}`. They are served as static files by ASP.NET Core's `UseStaticFiles()` middleware.

The absolute URL is stored in the database (e.g. `http://host/uploads/{listingId}/{filename}`). The frontend uses this URL directly in `<Image>` components.

**Limitations of this approach:**
- Files are lost if the server is redeployed to a new machine.
- No CDN, no replication.
- No image resizing or optimization.

**Phase 2 migration path**: Replace local storage with Azure Blob Storage or AWS S3. The database URL field stays the same — just the URL format and the upload logic in the controller changes.

**Image upload flow**: After a listing is created, the frontend uploads images one at a time (sequential, not parallel) via `POST /api/listings/{id}/images` with `multipart/form-data`. The backend saves the file, constructs the URL, and saves a `ListingImage` record. This is intentionally sequential to avoid partial success ambiguity.

---

## 12. Geolocation & Search

### Geocoding (Address → Coordinates)

When a listing is created, if the frontend passes coordinates (`Latitude`, `Longitude`) in the DTO, those are used directly. If not, the backend calls the Nominatim (OpenStreetMap) API:

```
GET https://nominatim.openstreetmap.org/search?q={address}&format=json&limit=1
```

Nominatim returns a lat/lng pair. This call has a 5-second timeout (configured on `HttpClient`). If it times out or returns no results, the listing is saved with `null` coordinates — it won't appear in location searches but is still valid.

**Why Nominatim?** Free, no API key required, good coverage. For production scale, Google Maps Geocoding or Mapbox would be more reliable.

### Location-Based Search (Haversine)

The search endpoint accepts `lat`, `lng`, and `radius` (km, default 5). The backend:

1. Runs the text filter in SQL (`ILike`).
2. Loads all matching rows into C# memory.
3. Filters in C# using the Haversine formula.

The `GET /api/listings` endpoint also accepts `lat`, `lng`, and `sortBy=nearest`, which sorts all available listings by distance in C# memory before paging.

The **Haversine formula** calculates great-circle distance between two lat/lng points:

```
a = sin²(Δlat/2) + cos(lat1)·cos(lat2)·sin²(Δlon/2)
distance = 2R · atan2(√a, √(1-a))    where R = 6371 km
```

**Why not PostGIS?** PostGIS (PostgreSQL geospatial extension) would push the distance calculation into the database and scale much better. For Phase 1 with a small dataset in one city, in-memory Haversine is sufficient.

---

## 13. Known Limitations & Future Work

### Phase 1 Limitations

| Area | Current State | Production Fix |
|---|---|---|
| Image storage | Local disk (`wwwroot/uploads/`) | Object storage (S3, Azure Blob) |
| Geocoding | Nominatim (free, rate-limited) | Google Maps / Mapbox Geocoding API |
| Location search | In-memory Haversine after SQL text filter | PostGIS `ST_DWithin` query entirely in SQL |
| Push (dev) | Expo dev relay (physical device only) | EAS build with APNs + FCM credentials |
| Audit logs | Plain text `Details` field | JSON column for structured querying |

### Phase 2: Escrow Payments

The planned Phase 2 adds payment processing between buyer and seller. Architectural additions needed:

- **Payment provider integration** (Stripe Connect): Stripe handles escrow, holding funds until a booking is confirmed, then releasing to the owner minus a platform fee.
- **Booking entity**: A `Booking` table linking a `Conversation` (or `Listing`), a `Buyer`, date range, amount, and payment status.
- **Webhook handling**: Stripe sends payment events (charge.succeeded, payout.paid) that must be processed idempotently.
- **PostgreSQL transactions**: Money operations must be atomic — the booking record and payment intent must be created in a single transaction.
- **HTTPS in production**: Required by Stripe; Stripe refuses webhooks to non-HTTPS endpoints.
