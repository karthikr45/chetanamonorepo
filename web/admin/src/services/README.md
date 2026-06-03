# Services (legacy / backward compatibility)

This folder **re-exports** from `@/lib/api-client` and `@/features/auth` for backward compatibility.

- **New code**: use **features** + **lib** only.
  - API calls: `features/<name>/api/<name>.api.ts` using `@/lib/api-client`.
  - Business logic: `features/<name>/services/<name>.service.ts`.
  - UI: `features/<name>/hooks` + `components` (no direct API/service in components).

## Structure

- **http/** – Re-exports `get`, `post`, `put`, `patch`, `del`, `httpClient`, `ApiError`, `setAuthTokenGetter` from `@/lib/api-client`.
- **auth/** – Re-exports `verifyLogin`, `VerifyLoginRequest`, `ApiError`; delegates to `@/features/auth` api layer.
- **constants/** – `API_ENDPOINTS` by feature (optional reference).

See **ARCHITECTURE.md** for the canonical data flow and feature template.
