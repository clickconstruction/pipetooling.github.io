# Deploy: archive-user

Archive users (soft delete). Requires `SUPABASE_SERVICE_ROLE_KEY`.

```bash
supabase functions deploy archive-user --no-verify-jwt
```

Set secrets:
```bash
supabase secrets set SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```
