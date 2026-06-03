# Next.js 16 Admin Dashboard – Frontend Architecture

Frontend-only; backend is a separate project. No Next.js API routes.

## Folder Structure

```
src/
├── app/                          # ROUTING ONLY – no business logic, no API
│   ├── (auth)/                   # Public auth routes
│   │   ├── login/page.tsx
│   │   ├── forgot-password/page.tsx
│   │   └── layout.tsx
│   ├── (dashboard)/               # Protected admin routes (home = "/")
│   │   ├── layout.tsx             # Dashboard layout (Navbar + Sidebar + toggle)
│   │   ├── page.tsx               # "/" home
│   │   ├── templates/             # "/templates"
│   │   ├── media/                 # "/media"
│   │   ├── announcements/         # "/announcements"
│   │   └── upload/                # "/upload"
│   ├── layout.tsx
│   ├── providers.tsx             # Redux + Auth + UI providers
│   └── globals.css
│
├── features/                     # Feature-based modules (strict isolation)
│   ├── auth/
│   │   ├── api/
│   │   │   └── auth.api.ts       # HTTP only, uses @/lib/api-client
│   │   ├── services/
│   │   │   ├── auth.service.ts   # Business logic + token storage only
│   │   │   └── index.ts
│   │   ├── hooks/
│   │   │   └── useLogin.ts       # Calls services only
│   │   ├── components/           # UI only; use hooks, no API/service
│   │   ├── context/
│   │   │   ├── AuthContext.tsx
│   │   │   └── index.ts
│   │   ├── types.ts
│   │   └── index.ts
│   ├── dashboard/
│   ├── templates/
│   ├── media/
│   ├── announcements/
│   └── upload/
│
├── lib/                          # Single source of truth for shared infra
│   ├── api-client.ts             # ONE Axios instance; token + error interceptors
│   ├── env.ts
│   ├── utils.ts
│   ├── validation.ts
│   └── index.ts
│
├── components/                   # Reusable UI only (no feature logic)
│   ├── ui/
│   └── layout/
│
├── store/                        # Redux Toolkit
│   ├── index.ts
│   ├── hooks.ts
│   ├── rootReducer.ts
│   └── slices/
│
├── context/                      # Global UI context (e.g. sidebar state)
│   └── ui-context.tsx
│
├── services/                     # Legacy: re-exports lib + features for backward compat
│   ├── http/                     # Re-exports @/lib/api-client
│   ├── auth/                     # Re-exports features/auth api
│   └── constants/                # Endpoint constants (optional)
│
└── types/                        # Shared global types only (no feature types)
```

## Data Flow (strict)

- **Components** → use **hooks** only. No direct API or service calls.
- **Hooks** → call **services** only.
- **Services** → call **api** (feature api layer); contain **business logic only** (no HTTP).
- **API** (feature) → uses **@/lib/api-client** only. No business logic.

## Import Rules

- Use **absolute aliases** (`@/lib/...`, `@/components/...`, `@/features/<name>/...`) for cross-folder imports.
- Within a feature, same-folder files may use relative imports (e.g. `context/index.ts` → `./AuthContext`).
- **Feature types** live in `features/<name>/types.ts`. Do not put feature types in `src/types`.

## Naming Consistency

- Feature API: `api/<feature>.api.ts` (e.g. `auth.api.ts`).
- Feature service: `services/<feature>.service.ts` (e.g. `auth.service.ts`).
- One API client: `lib/api-client.ts`. Root `services/http` only re-exports it.

## Feature Template

Each feature is self-contained:

- `api/<name>.api.ts` – HTTP calls via `@/lib/api-client`; no business logic.
- `services/<name>.service.ts` – Orchestration, validation, token handling; calls api only.
- `hooks/` – React hooks that call services.
- `components/` – UI that uses hooks only (no API, no service calls).
- `types.ts` – Feature-specific types.

## Scalability

- New features: add `features/<name>/` with api, services, hooks, components, types.
- New shared utilities: add to `lib/` and re-export from `lib/index.ts`.
- State: global UI in `context/`; domain state in Redux `store/slices/` or feature context.
