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
7. [Frontend Architecture](#7-frontend-architecture)
8. [Key Data Flows](#8-key-data-flows)
9. [Image Storage](#9-image-storage)
10. [Geolocation & Search](#10-geolocation--search)
11. [Known Limitations & Future Work](#11-known-limitations--future-work)

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
│  Static file serving (uploaded images)           │
└──────────────┬──────────────────────────────────┘
               │
               ▼
┌─────────────────────────────────────────────────┐
│               PostgreSQL                         │
│  Users, Listings, Images, Favorites              │
│  Conversations, Messages, RefreshTokens          │
└─────────────────────────────────────────────────┘
```

There is no separate API gateway, message queue, or cache layer in Phase 1. The backend is a single ASP.NET Core process that handles HTTP requests, WebSocket connections, database access, file I/O, and outbound email.

---

## 2. Technology Choices

### Why ASP.NET Core (.NET 10)?

- **Built-in SignalR**: Real-time WebSocket support is a first-class citizen, no third-party service needed.
- **ASP.NET Identity**: User management (password hashing, email confirmation tokens, password reset tokens) comes out of the box.
- **EF Core + Npgsql**: Type-safe ORM with PostgreSQL support and code-first migrations.
- **Strongly typed**: C# with nullable reference types catches bugs at compile time.

### Why React Native / Expo?

- **Cross-platform**: One codebase for iOS and Android.
- **Expo managed workflow**: Simplifies builds, native modules, and permissions (camera, location, secure storage).
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

- `Scoped`: `ApplicationDbContext`, `IAuthService`, `IListingService`, `IConversationService`, `IEmailService`
- `HttpClient` with `IHttpClientFactory`: `IGeocodingService` (Nominatim) — gets a preconfigured `HttpClient` with `User-Agent` header and 5-second timeout
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
 └── has many RefreshToken

Listing
 ├── has many ListingImage
 ├── has many UserFavorite
 └── has many Conversation

Conversation
 └── has many Message
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
     │                    │ SignalR push ────────►│
     │◄── 201 Created     │                      │ onMessage fires
                                                  │ setMessages(prev => [...prev, msg])
```

Messages are delivered by two paths:
1. **HTTP**: The sender gets the created message back as the POST response. The frontend adds it to local state immediately.
2. **SignalR**: The backend pushes the same message to the recipient's WebSocket connection. The recipient's `useMessages` hook appends it to their local state.

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

## 7. Frontend Architecture

### File-Based Routing (Expo Router)

```
app/
├── _layout.tsx               Root layout: auth guard + SignalR + hydration
├── index.tsx                 Redirect (handled by _layout)
├── (auth)/
│   ├── _layout.tsx           Stack for auth screens
│   ├── login.tsx
│   ├── register.tsx
│   └── forgot-password.tsx
├── (tabs)/
│   ├── _layout.tsx           Bottom tab bar
│   ├── index.tsx             Home — listing grid
│   ├── search.tsx            Text + location search
│   ├── post.tsx              Placeholder (tab opens modal)
│   ├── chat.tsx              Conversation list
│   └── profile.tsx           User info + navigation
├── create.tsx                Modal — create new listing
├── listing/[id].tsx          Listing detail
├── conversation/[id].tsx     Chat thread
├── edit-profile.tsx          Edit name/phone
├── my-listings.tsx           Owner's listings management
└── favorites.tsx             Saved listings
```

`(auth)` and `(tabs)` are Expo Router **route groups** — they scope the layout without adding to the URL path.

### Auth Guard

`AuthGuard` is a component rendered inside the root layout that reads auth state and uses `router.replace()` to redirect:

```
isLoading = true  →  show spinner (prevents flash of wrong screen)
isLoading = false, isAuthenticated, in (auth) group  →  redirect to /(tabs)
isLoading = false, not isAuthenticated, not in (auth) group  →  redirect to /(auth)/login
```

Hydration (`SecureStore.getItemAsync` → `authService.refresh`) happens in `RootLayout`'s `useEffect`. This runs once on mount. The `isLoading = true` default prevents the guard from redirecting before hydration completes.

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
| `useListings` | paginated listings with infinite scroll (`loadMore`, `totalCount`) |
| `useMyListings` | owner's listings + delete |
| `useCreateListing` | creation + sequential image uploads |
| `useFavoritesMap` | optimistic toggle for a list of listings |
| `useMyFavorites` | favorited listings + optimistic remove |
| `useSearch` | text + location search |
| `useConversations` | conversation list (re-fetches on tab focus) |
| `useMessages` | messages for one conversation + SignalR listener + send + send error |

### Optimistic Favorites

`useFavoritesMap` maintains a `pending` record (`{ [listingId]: boolean }`) that overrides the server state while an API call is in flight:

1. User taps heart → read current state from `pending` or `listings` array
2. Write optimistic opposite into `pending` → UI updates immediately
3. API call resolves → overwrite `pending` with server's actual value
4. API call fails → revert `pending` to original value

The hook uses a `useRef` (`pendingRef`) so that the toggle callback always reads the latest pending state without needing to be in its dependency array.

### API Client

`apiClient.ts` is a thin wrapper around `fetch`:

- Sets `Authorization: Bearer <token>` on every request.
- On 401: calls `tryRefresh()`, then retries the original request once with the new token.
- On continued failure: calls `clearAuth()` (triggers redirect to login via AuthGuard).
- On 204: returns `undefined as T` (avoids trying to parse an empty body).
- On non-ok responses: reads the response body as text and throws an `Error` with that message (backend returns human-readable error strings).

---

## 8. Key Data Flows

### Registration Flow

```
1. User fills form → register(dto)
2. POST /api/auth/register
3. Backend: FindByEmail (conflict check) → CreateAsync (hash password) → AddToRoleAsync("User") → SendVerificationEmail → GenerateTokensAsync
4. Return TokenResponseDto (access token + refresh token + user info)
5. Frontend: setAuth() → SecureStore.setItem(refresh token) → Zustand update
6. AuthGuard redirects to /(tabs)
7. User gets verification email → clicks link → GET /api/auth/verify-email → EmailConfirmed = true
   (Without this step, login is blocked)
```

### Message Send Flow

```
1. User types message → tap send
2. useMessages.sendMessage(body)
3. POST /api/conversations/{id}/messages (HTTP)
4. Backend: validate sender is in conversation → save Message to DB
5. Backend: SignalR push to recipient's group
6. Backend: return 201 Created + MessageDto
7. Frontend (sender): append message to local state from HTTP response
8. Frontend (recipient): onMessage handler fires → append to state
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

## 9. Image Storage

Images are stored on the **server's local filesystem** under `wwwroot/uploads/{listingId}/{uuid}.{ext}`. They are served as static files by ASP.NET Core's `UseStaticFiles()` middleware.

The absolute URL is stored in the database (e.g. `http://host/uploads/{listingId}/{filename}`). The frontend uses this URL directly in `<Image>` components.

**Limitations of this approach:**
- Files are lost if the server is redeployed to a new machine.
- No CDN, no replication.
- No image resizing or optimization.

**Phase 2 migration path**: Replace local storage with Azure Blob Storage or AWS S3. The database URL field stays the same — just the URL format and the upload logic in the controller changes.

**Image upload flow**: After a listing is created, the frontend uploads images one at a time (sequential, not parallel) via `POST /api/listings/{id}/images` with `multipart/form-data`. The backend saves the file, constructs the URL, and saves a `ListingImage` record. This is intentionally sequential to avoid partial success ambiguity.

---

## 10. Geolocation & Search

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

The **Haversine formula** calculates great-circle distance between two lat/lng points:

```
a = sin²(Δlat/2) + cos(lat1)·cos(lat2)·sin²(Δlon/2)
distance = 2R · atan2(√a, √(1-a))    where R = 6371 km
```

This is accurate for the distances involved (city-scale, < 50 km).

**Why not PostGIS?** PostGIS (PostgreSQL geospatial extension) would push the distance calculation into the database and scale much better. For Phase 1 with a small dataset in one city, in-memory Haversine is sufficient.

---

## 11. Known Limitations & Future Work

### Phase 1 Limitations

| Area | Current State | Production Fix |
|---|---|---|
| Image storage | Local disk (`wwwroot/uploads/`) | Object storage (S3, Azure Blob) |
| Geocoding | Nominatim (free, rate-limited) | Google Maps / Mapbox Geocoding API |
| Location search | In-memory Haversine after SQL text filter | PostGIS `ST_DWithin` query entirely in SQL |

### Phase 2: Escrow Payments

The planned Phase 2 adds payment processing between buyer and seller. Architectural additions needed:

- **Payment provider integration** (Stripe Connect): Stripe handles escrow, holding funds until a booking is confirmed, then releasing to the owner minus a platform fee.
- **Booking entity**: A `Booking` table linking a `Conversation` (or `Listing`), a `Buyer`, date range, amount, and payment status.
- **Webhook handling**: Stripe sends payment events (charge.succeeded, payout.paid) that must be processed idempotently.
- **PostgreSQL transactions**: Money operations must be atomic — the booking record and payment intent must be created in a single transaction.
- **HTTPS in production**: Required by Stripe; Stripe refuses webhooks to non-HTTPS endpoints.
