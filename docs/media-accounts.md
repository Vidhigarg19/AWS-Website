# Media Portal accounts and passwords

## Lifecycle
1. A **super admin** creates a media member (Admin → Media members). The system generates a
   temporary password, shown once. Share it over a private channel.
2. At first sign-in the member is taken straight to **Choose your own password**. Until they do,
   they can reach nothing else: every portal page and every `/api/media/*` route refuses them
   (`403 password_change_required`). This is checked on every request.
3. A super-admin **reset** sets the same lock again, including for sessions that are already open,
   so a reset takes effect immediately, not at the next sign-in.
4. Any signed-in portal user can change their password later from the header ("Change password").

## What a password change does
1. Checks the new password (`lib/auth/password-policy.ts`): at least 10 characters, at most 72 bytes
   (bcrypt ignores the rest), different from the current one, no email name, no common guessable words.
   Length is preferred to symbol/digit rules.
2. Verifies the **current** password with a throwaway sign-in. A stolen session cannot change the password.
3. Sets the new password with the service key, clears `must_change_password`,
   and signs out the account's **other** sessions (best effort).

If setting the password fails, nothing else happens and the old password still works.

## Deploy
1. Apply `supabase/migrations/20261025000001_media_members_must_change_password.sql`.
   Existing members default to "must change", so everyone chooses their own password once.
2. Deploy the app.

## Not included (on purpose)
- **"Forgot password" email**: a super admin reset covers a small team. Add Supabase's email recovery later if needed.
- **App-side rate limiting** of wrong current passwords: Supabase Auth already rate-limits sign-in attempts.
  Tune it under Authentication → Rate Limits.
