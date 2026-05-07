# Auth Debug Checklist

## Root cause (found)
Azure Static Web Apps strips the `Authorization` header before it reaches API functions,
even when not using SWA's built-in auth. The token was never reaching `readSession`.

**Fix applied:** switched to a custom `X-Session-Token` header on the frontend (`api.ts`).
`session.js` now reads `X-Session-Token` first, with `Authorization: Bearer` as a fallback
for local dev. Deployed — auth should now work.

## What we've already checked / ruled out
- Token IS being stored in sessionStorage correctly after redirect
- Token IS being sent in the `Authorization: Bearer` header to `/api/strava-status`
- `AZURE_STORAGE_CONNECTION_STRING` is set in Azure env vars
- `SESSION_SECRET` is set in Azure env vars
- `STRAVA_CLIENT_ID` and `STRAVA_CLIENT_SECRET` are set in Azure env vars
- `STRAVA_REDIRECT_URI` is set to the production URL
- The OAuth callback IS completing (we get `/?token=...` back)
- The race condition between `TokenHandler` and `StravaGuard` was fixed (token now
  stored synchronously at module load before React renders)
- SWA routing config is correct (`navigationFallback` + `/api/*` rules)

## Problem
`/api/strava-status` returns `{ connected: false }` after Strava OAuth completes.
The token is being sent correctly as `Bearer <token>` — confirmed via DevTools.

## What was added
`strava-status` now returns a `debug` field to identify which step fails:
- `session_invalid` — token verification failed (HMAC mismatch)
- `no_token` — token verified but athlete not found in Table Storage

## Steps tomorrow

1. Deploy latest code (if not already done)
2. Go through the Strava auth flow on the deployed app
3. Open DevTools → Network → find `/api/strava-status` request
4. Check the response body for the `debug` field:

### If `session_invalid`
- The SESSION_SECRET used to **create** the token (in `stravaCallback`) doesn't match
  the one used to **verify** it (in `stravaStatus`)
- Check Azure Static Web App → Settings → Environment variables
- Make sure `SESSION_SECRET` is set and consistent
- Try deleting `SESSION_SECRET` from Azure env vars entirely — both functions will
  fall back to the hardcoded default and will match each other

### If `no_token`
- The OAuth callback completed but failed to save to Table Storage
- Check that `AZURE_STORAGE_CONNECTION_STRING` is correct in Azure env vars
- Check Azure Function logs (portal → your Static Web App → Functions → stravaCallback → Monitor)
  to see if there was a storage error during the callback

## Cleanup after fixing
Remove the `debug` field from `strava-status` once auth is working.
