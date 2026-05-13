# OpenSpot — Refinement Plan

## Overview
This document covers the full plan for the next phase of OpenSpot: 5-tab navigation,
search, real-time chat, favorites, and a redesigned profile tab.

---

## Chat: Polling vs Real-Time (SignalR)

**Polling** means the app asks the server "any new messages?" every few seconds.
Simple to build, but wastes battery, adds server load, and feels laggy.

**SignalR** (the approach we'll use) is built into ASP.NET Core and uses WebSockets
under the hood. The server *pushes* new messages to the app the instant they arrive —
no asking, no lag. React Native supports WebSockets natively, and the official
`@microsoft/signalr` JS package works on Expo. It also falls back gracefully to
long-polling if WebSockets aren't available.

**Why SignalR for this app:** it's the standard for .NET real-time apps, zero extra
infrastructure (no Redis, no Kafka), and the UX matches what users expect from chat.

---

## Conversation Model

A conversation is uniquely scoped to **one listing + two users** (renter + owner).
If the same two people chat about two different listings → two separate conversations.
This matches the Facebook Marketplace mental model the user described.

```
Conversation
  Id           Guid
  ListingId    Guid  → Listing
  RenterId     string → User  (person who initiated)
  OwnerId      string → User  (listing owner)
  CreatedAt    DateTime

Message
  Id             Guid
  ConversationId Guid → Conversation
  SenderId       string → User
  Content        string
  SentAt         DateTime
  IsRead         bool
```

A new conversation is created (or an existing one returned) when a renter taps
"Message Owner" on a listing detail page. This prevents duplicate conversations
between the same pair on the same listing.

---

## Favorites Model

```
UserFavorite
  UserId     string → User   (composite PK with ListingId)
  ListingId  Guid   → Listing
  CreatedAt  DateTime
```

`GetListingDto` will include a nullable `IsFavorited` bool — `null` for anonymous,
`true/false` when the caller is authenticated.

---

## Search

- **Text search**: `ILIKE '%query%'` on `Address` and `Title` columns.
- **Near me**: requires coordinates on `Listing`. Plan:
  - Add nullable `Latitude double?` and `Longitude double?` to `Listing`.
  - On listing creation, call **Nominatim** (OpenStreetMap free geocoding — no API key,
    no cost). One HTTP call per listing resolves the address into lat/lng automatically.
    Comparable accuracy to Google Maps for full street addresses; free tier on Google
    would run out at scale whereas Nominatim is unlimited (rate-limited to 1 req/s, fine
    for our write volume).
  - Distance filter uses the Haversine formula in a raw SQL query or computed in-memory
    after a bounding-box pre-filter.
  - Frontend uses `expo-location` to request the user's GPS coordinates for the "Near me"
    toggle.

---

## Work Breakdown

### Phase A — Navigation & Tab Bar (frontend only)
1. Add Search, Chat tabs; redesign Post tab icon (colored, raised).
2. Rearrange `_layout.tsx` to 5 tabs: Home | Search | Post | Chat | Profile.

### Phase B — Search Tab (frontend + minor backend)
1. Add `Latitude` / `Longitude` to `Listing` model → migration.
2. Backend: `GET /api/listings/search?q=&lat=&lng=&radius=` endpoint.
3. Frontend: `app/(tabs)/search.tsx` — text input + "Near me" toggle using
   `expo-location`, results rendered as the same tile grid as Home.

### Phase C — Favorites (frontend + backend)
1. New `UserFavorite` entity → migration.
2. Backend:
   - `POST /api/listings/{id}/favorite` — toggle (add if not exists, remove if exists).
   - `GET /api/listings/favorites` — return user's favorited listings.
   - Update `GetListingDto` + `GetListingByIdAsync` to include `IsFavorited`.
3. Frontend:
   - Heart icon on listing tile (top-right).
   - Heart icon on listing detail page.
   - `useFavorites` hook.
   - My Favorites screen (`app/(tabs)/favorites.tsx`) — same grid layout.

### Phase D — Chat (backend + frontend, biggest feature)
**Backend:**
1. New `Conversation` and `Message` entities → migration.
2. `IConversationService` / `ConversationService`:
   - `GetOrCreateConversationAsync(listingId, renterId)` — idempotent.
   - `GetUserConversationsAsync(userId)` — list with last message + listing snapshot.
   - `GetMessagesAsync(conversationId, userId)` — paginated.
3. `ConversationController` (REST):
   - `POST /api/conversations` `{ listingId }` → returns conversation.
   - `GET /api/conversations` → inbox list.
   - `GET /api/conversations/{id}/messages` → message history.
4. `ChatHub` (SignalR):
   - Clients call `JoinConversation(conversationId)` on connect.
   - Clients call `SendMessage(conversationId, content)`.
   - Hub saves message to DB, then broadcasts `ReceiveMessage(message)` to both participants.
   - Authenticated via JWT passed in SignalR connection query string.
5. Register SignalR in `Program.cs`, map hub at `/hubs/chat`.

**Frontend:**
1. Install `@microsoft/signalr`.
2. `services/chatService.ts` — REST calls (get/create conversation, load history).
3. `services/signalRService.ts` — singleton SignalR connection manager.
   - Connects once on app start (after auth), reconnects on drop.
   - Exposes `joinConversation`, `sendMessage`, `onMessage` event subscription.
4. `hooks/useConversations.ts` — inbox list with last-message preview.
5. `hooks/useMessages.ts` — message history + real-time append via SignalR listener.
6. `app/(tabs)/chat.tsx` — inbox list (conversations), tapping opens thread.
7. `app/conversation/[id].tsx` — message thread:
   - Loads history on mount.
   - Appends new messages live via SignalR.
   - Text input + send button at the bottom.
8. **Unread badge on Chat tab icon:**
   - `Message.IsRead` tracks whether the recipient has read each message.
   - `GET /api/conversations/unread-count` returns the total unread message count for
     the current user across all conversations.
   - `useUnreadCount` hook polls this endpoint every 30 seconds and also updates
     instantly when a new `ReceiveMessage` SignalR event arrives.
   - Tab badge rendered via Expo Router's `tabBarBadge` option, hidden when count is 0.
9. "Message Owner" button on `app/listing/[id].tsx` creates/gets conversation then
   navigates to `app/conversation/[id].tsx`.
10. Marking messages as read when the user opens a conversation thread (calls
    `POST /api/conversations/{id}/read`), which clears the badge count.

### Phase E — Profile Redesign (frontend only)
1. Top section: initials avatar circle, full name, email.
2. Nav rows: My Listings → `/(tabs)/my-listings`, My Favorites → `/(tabs)/favorites`.
3. Sign Out button at the bottom.
4. Remove old profile content.

---

## File Summary

### New backend files
- `Chat/Conversation.cs`
- `Chat/Message.cs`
- `Chat/IConversationService.cs`
- `Chat/ConversationService.cs`
- `Chat/ConversationController.cs` — includes `/unread-count` and `/{id}/read` endpoints
- `Chat/ChatHub.cs`
- `Chat/DTOs/` (GetConversationDto, GetMessageDto, CreateConversationDto)
- `Listings/Favorites/UserFavorite.cs`
- Migration: `AddCoordinatesToListings`
- Migration: `AddFavorites`
- Migration: `AddChat`

### New/modified frontend files
- `app/(tabs)/_layout.tsx` — 5 tabs, redesigned Post icon
- `app/(tabs)/search.tsx` — new
- `app/(tabs)/chat.tsx` — new (inbox)
- `app/(tabs)/profile.tsx` — redesigned
- `app/conversation/[id].tsx` — new (message thread)
- `services/chatService.ts` — new
- `services/signalRService.ts` — new
- `services/listingService.ts` — add search + favorites calls
- `hooks/useConversations.ts` — new
- `hooks/useMessages.ts` — new
- `hooks/useUnreadCount.ts` — new (polls + SignalR event listener for badge)
- `hooks/useListings.ts` — add favorites hook
- `types/chat.ts` — new
- `types/listing.ts` — add `isFavorited` field

---

## Implementation Order
A → B → C → D → E
Each phase is independently testable. Chat (D) is the only one with a SignalR
dependency — everything else is plain REST.
