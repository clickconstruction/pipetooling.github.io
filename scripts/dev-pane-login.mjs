#!/usr/bin/env node
/**
 * Sign a browser into the deployed app (clicktooling.com) with no password (v2.6124): the same `dev-login` edge
 * function the dev server's /dev-login page calls, with the secret the main checkout's `.env.local` already holds,
 * asked for a magic link that lands on the deployed site instead of localhost. Prints one single-use link; a session
 * navigates the Claude app's browser pane to it and the pane is signed in as the dev-login identity from then on
 * (the pane's profile persists across app restarts). The link dies on first use. Nothing here is a new secret.
 *
 *   node scripts/dev-pane-login.mjs            → a link landing on /dashboard
 *   node scripts/dev-pane-login.mjs /jobs      → a link landing on /jobs
 *
 * It signs in as a real account on prod (`DEV_LOGIN_EMAIL` in src/pages/DevLogin.tsx). The rule for what a session
 * may do there is AGENTS.md → Logging in as an agent: read as the task needs; make test rows only with the ZZ test
 * name the repo uses, and delete every one before the session ends; never change a real customer's or person's row.
 */
import { readFileSync, existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const SITE = 'https://clicktooling.com'
const EMAIL = 'robert@douglasmining.com'

function readEnvLocal() {
  // A worktree symlinks or copies .env.local from the main checkout; fall back to the main checkout's own file.
  const candidates = [join(ROOT, '.env.local'), join(ROOT, '..', '..', '..', '.env.local')]
  const file = candidates.find((p) => existsSync(p))
  if (!file) throw new Error('.env.local not found beside the repo or in the main checkout')
  return Object.fromEntries(
    readFileSync(file, 'utf8')
      .split('\n')
      .filter((l) => l.includes('=') && !l.trim().startsWith('#'))
      .map((l) => [l.slice(0, l.indexOf('=')).trim(), l.slice(l.indexOf('=') + 1).trim().replace(/^["']|["']$/g, '')]),
  )
}

const env = readEnvLocal()
const need = (k) => {
  if (!env[k]) {
    console.error(`${k} is not in .env.local`)
    process.exit(1)
  }
  return env[k]
}
const url = need('VITE_SUPABASE_URL')
const anon = need('VITE_SUPABASE_ANON_KEY')
const secret = need('VITE_DEV_LOGIN_SECRET')
const path = process.argv[2]?.startsWith('/') ? process.argv[2] : '/dashboard'

const res = await fetch(`${url}/functions/v1/dev-login`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', apikey: anon, Authorization: `Bearer ${anon}`, 'X-Dev-Login-Secret': secret },
  body: JSON.stringify({ email: EMAIL, redirectTo: `${SITE}${path}` }),
})
const body = await res.json().catch(() => ({}))
if (!res.ok || !body.action_link) {
  console.error(`dev-login answered ${res.status}: ${body.error ?? 'no action_link'}`)
  process.exit(1)
}
console.log(body.action_link)
