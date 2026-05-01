# OpenSpot Frontend — How It Works

## Tech Stack

- **Expo (SDK 54)** — React Native framework that handles the build toolchain, native modules, and development server
- **Expo Router** — File-based navigation built on top of React Navigation. The folder structure inside `app/` directly defines the routes
- **Zustand** — Lightweight state management for auth state
- **expo-secure-store** — Stores the refresh token in the device's secure enclave (iOS Keychain / Android Keystore)

---

## Project Structure

```
frontend/
├── app/                  ← File-based routes (Expo Router)
├── components/           ← Reusable UI pieces
├── hooks/                ← Business logic hooks
├── services/             ← API layer
├── store/                ← Global state (Zustand)
├── types/                ← TypeScript interfaces
└── constants/            ← Design tokens (theme)
```

---

## Navigation (Expo Router)

With Expo Router, every file inside `app/` becomes a screen. Route groups (folders wrapped in parentheses) let you share a layout without affecting the URL/path.

There are two route groups:

### `(auth)` — Unauthenticated screens
A `Stack` navigator with no tab bar. Contains login, register, and forgot-password screens. These screens are only accessible when the user is not logged in.

### `(tabs)` — Authenticated screens
A `Tabs` navigator with a bottom tab bar. Contains the home feed, post listing, and profile screens. These are only accessible when the user is logged in.

### Auth Guard

`app/_layout.tsx` is the root layout that wraps the entire app. It does two things:

1. **Hydration** — On every app start, it checks `expo-secure-store` for a stored refresh token. If one exists, it silently calls `POST /api/auth/refresh` to get a new access token and restore the session without requiring the user to log in again. If the refresh fails (token expired or revoked), the user is sent to login.

2. **Route Guard** — A `useEffect` watches the `isAuthenticated` flag in the Zustand store and the current route segment. If an unauthenticated user tries to access `(tabs)`, they're redirected to `/(auth)/login`. If an authenticated user ends up on `(auth)`, they're redirected to `/(tabs)`. This guard runs automatically whenever auth state changes — so when a user logs in or out, the redirect happens instantly.

---

## Auth State (Zustand Store)

`store/authStore.ts` holds the global auth state:

```
user          → { userId, email, roles }
accessToken   → string | null  (in memory only)
refreshToken  → string | null  (mirrored from SecureStore)
isAuthenticated → boolean
isLoading     → boolean (true while hydration is running on app start)
```

**`setAuth(tokenResponse)`** — Called after login, register, or token refresh. Saves the refresh token to `expo-secure-store` and updates all fields in the store.

**`clearAuth()`** — Called on logout. Deletes the refresh token from `expo-secure-store` and resets the store to unauthenticated state.

The access token lives in memory only (never persisted). This is intentional — if the app is killed, the access token is gone. The root layout hydrates it on the next launch using the persisted refresh token.

---

## API Layer

### `services/apiClient.ts`

The API client is a thin wrapper around `fetch` with three responsibilities:

1. **Token injection** — Reads the current access token from the Zustand store (via `useAuthStore.getState()`) and attaches it as a `Bearer` header on every request. This works because Zustand's `getState()` is synchronous and doesn't need React context.

2. **Automatic token refresh** — If the server returns a `401 Unauthorized`, the client automatically tries to refresh. It reads the refresh token directly from `expo-secure-store`, calls `POST /api/auth/refresh` using raw `fetch` (not through itself, to avoid circular calls), updates the store with the new tokens, then retries the original request once.

3. **Automatic logout on refresh failure** — If the refresh also fails (token expired or revoked), the client calls `clearAuth()` on the store. The route guard picks this up and redirects to login.

This means every screen and hook gets transparent auth handling for free — they never need to think about token expiry.

### `services/authService.ts` and `services/listingService.ts`

Thin modules that map API calls to typed functions using `apiClient`. They exist to keep the hooks clean and to centralise all the endpoint paths in one place.

---

## Hooks

Hooks are where business logic lives. They sit between the screens and the services, owning loading and error state so the screens stay declarative.

### `useAuth`

Wraps register, login, logout, and forgotPassword. Each action handles its own `loading` and `error` state and performs the navigation side-effect on success (e.g. `router.replace('/(tabs)')` after login). Screens just call `login(dto)` and react to `loading` and `error`.

### `useListings` and `useCreateListing`

`useListings` fetches all listings on mount and exposes a `refetch` function (used by pull-to-refresh). `useCreateListing` is a separate hook for the post screen so it doesn't trigger a fetch unnecessarily.

---

## Reusable Components

### `Button`
Accepts a `variant` prop (`primary` or `secondary`), a `loading` prop that swaps the label for a spinner, and a `disabled` prop. Handles the disabled+loading visual state internally.

### `Input`
Wraps `TextInput` with a label above and an inline error message below. Takes an `error` string — when set, the border turns red and the error message appears. All other `TextInput` props pass through.

### `ListingCard`
Displays a single listing with title, address, description, price, date range, and an availability badge. Used in the home feed `FlatList`.

### `ScreenWrapper`
A composable layout primitive that stacks `SafeAreaView` + optional `KeyboardAvoidingView` + optional `ScrollView`. Every screen uses it so safe area and keyboard behaviour is handled consistently and not repeated in each file.

---

## Design System (`constants/theme.ts`)

All visual constants live in one `theme` object:

- **`colors`** — Primary blue (`#1A56FF`), background, surface, text, muted text, border, error, success
- **`spacing`** — `xs` through `xxl` in consistent increments
- **`radius`** — Border radius scale (sm, md, lg, full)
- **`typography`** — Pre-defined text style objects (heading, subheading, body, caption, label)
- **`shadow`** — Card shadow values for iOS and Android

Every component imports from `theme` directly. Changing a colour or spacing value in one place updates the whole app.

---

## Auth Flow Summary

```
App opens
  └─ _layout.tsx hydrates
       ├─ Refresh token in SecureStore?
       │    Yes → POST /api/auth/refresh
       │           ├─ Success → setAuth() → route guard → (tabs)
       │           └─ Fail   → clearAuth() → route guard → (auth)/login
       └─ No → setLoading(false) → route guard → (auth)/login

User logs in
  └─ useAuth.login() → POST /api/auth/login
       └─ setAuth() → isAuthenticated = true → route guard → (tabs)

Access token expires mid-session
  └─ apiClient gets 401
       └─ tryRefresh() → POST /api/auth/refresh (raw fetch)
            ├─ Success → setAuth() → retry original request
            └─ Fail   → clearAuth() → route guard → (auth)/login

User logs out
  └─ useAuth.logout() → POST /api/auth/logout → clearAuth()
       └─ isAuthenticated = false → route guard → (auth)/login
```
