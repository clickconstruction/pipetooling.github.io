# Deploy: restore-user

Restore archived users. Requires `SUPABASE_SERVICE_ROLE_KEY`.

```bash
supabase functions deploy restore-user --no-verify-jwt
```

Set secrets:
```bash
supabase secrets set SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```
