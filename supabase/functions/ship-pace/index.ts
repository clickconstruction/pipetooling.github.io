import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { type PacePr, type PaceQueueRun, SHIP_PACE_KEY, SHIP_PACE_WINDOW_HOURS, shipPacePicture } from '../_shared/shipPace.ts'

/**
 * ship-pace — How fast a change ships (v2.6399): the cron that reads the repository's pull requests and the merge
 * queue from GitHub every 15 minutes and writes one `app_settings` row (`ship_pace_v1`) the Settings section reads,
 * so no office screen ever calls GitHub. The repository is public, but a browser reading GitHub's API would hit its
 * unauthenticated rate limit and spread the load across every screen; one reader with a fine-grained token reads it
 * about ten requests a run.
 *
 *   POST {}                         (X-Cron-Secret, the cron's door)
 *   POST { action: 'read' }         (a signed-in dev's JWT: the section's **Read GitHub now** press, for the first
 *                                    read after the deploy and for a screenshot; `is_dev()` asked as the caller)
 *     1. Lists every open pull request (created, draft) and the closed ones by last update, newest first, until a
 *        page falls before the window less an hour (a pull request merged or closed in the window was updated then).
 *     2. Lists the merge queue's builds (Actions runs of the `merge_group` event) created since the window's day,
 *        and asks GraphQL how many pull requests sit in the queue now. Either refused (the token lacks it) leaves
 *        those fields null; the pull requests are the picture, the queue is the colour.
 *     3. Hands them to `_shared/shipPace.ts` and writes the picture: the 72-hour series by the app calendar's hour,
 *        the headline over the last 24 hours, today's counts and what is open now.
 *
 *   → { success, asOf, prs, queueRuns, queueNow, last24h, today, now, ms }
 *
 * Refusals: 401 without the secret or a dev's session, 405 for anything but POST, 503 `{ noToken }` while
 * `GITHUB_PACE_TOKEN` is unset (nothing written: the section's empty state names the door), 502 `{ github }` when
 * GitHub refuses the pull requests (nothing written, so the row keeps the last good read and the section's stamp
 * shows it ageing). Secrets: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, SUPABASE_ANON_KEY (the dev's check),
 * CRON_SECRET, GITHUB_PACE_TOKEN (a fine-grained token on the repository: Pull requests read, Actions read,
 * Metadata read), optional GITHUB_PACE_REPO (`owner/name`, the app's own repository when unset). verify_jwt is off;
 * the secret or the in-function check is the door.
 */

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-cron-secret',
}

const DEFAULT_REPO = 'clickconstruction/pipetooling.github.io'
const GITHUB = 'https://api.github.com'
/** How many pages of 100 one list may take: 1,000 rows, ten times a quiet day's merges. */
const MAX_PAGES = 10
const HOUR_MS = 60 * 60 * 1000

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
}

type GhPr = { number: number; created_at: string; merged_at: string | null; closed_at: string | null; updated_at: string; draft?: boolean }
type GhRun = { created_at: string; conclusion: string | null }

class GitHubRefused extends Error {
  constructor(readonly status: number, readonly words: string) {
    super(`GitHub answered ${status}: ${words}`)
  }
}

async function ghGet<T>(token: string, path: string): Promise<T> {
  const res = await fetch(`${GITHUB}${path}`, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      'User-Agent': 'pipetooling-ship-pace',
    },
  })
  if (!res.ok) throw new GitHubRefused(res.status, (await res.text().catch(() => '')).slice(0, 300))
  return (await res.json()) as T
}

function toPr(p: GhPr): PacePr {
  return { number: p.number, createdAt: p.created_at, mergedAt: p.merged_at, closedAt: p.closed_at, draft: Boolean(p.draft) }
}

/** Every open pull request: a quiet day is one page. */
async function openPrs(token: string, repo: string): Promise<PacePr[]> {
  const out: PacePr[] = []
  for (let page = 1; page <= MAX_PAGES; page++) {
    const rows = await ghGet<GhPr[]>(token, `/repos/${repo}/pulls?state=open&per_page=100&page=${page}`)
    out.push(...rows.map(toPr))
    if (rows.length < 100) break
  }
  return out
}

/** The closed pull requests by last update, newest first, until a whole page falls before the window less an hour. */
async function closedPrsSince(token: string, repo: string, sinceMs: number): Promise<PacePr[]> {
  const out: PacePr[] = []
  for (let page = 1; page <= MAX_PAGES; page++) {
    const rows = await ghGet<GhPr[]>(token, `/repos/${repo}/pulls?state=closed&sort=updated&direction=desc&per_page=100&page=${page}`)
    out.push(...rows.map(toPr))
    const last = rows[rows.length - 1]
    if (rows.length < 100 || !last || Date.parse(last.updated_at) < sinceMs - HOUR_MS) break
  }
  return out
}

/** The merge queue's builds since the window's day; null when Actions is not the token's to read. */
async function queueRunsSince(token: string, repo: string, sinceMs: number): Promise<PaceQueueRun[] | null> {
  const day = new Date(sinceMs).toISOString().slice(0, 10)
  const out: PaceQueueRun[] = []
  try {
    for (let page = 1; page <= MAX_PAGES; page++) {
      const body = await ghGet<{ workflow_runs: GhRun[] }>(token, `/repos/${repo}/actions/runs?event=merge_group&created=${encodeURIComponent(`>=${day}`)}&per_page=100&page=${page}`)
      const rows = body.workflow_runs ?? []
      out.push(...rows.map((r) => ({ createdAt: r.created_at, conclusion: r.conclusion })))
      if (rows.length < 100) break
    }
    return out
  } catch (e) {
    if (e instanceof GitHubRefused && (e.status === 403 || e.status === 404)) return null
    throw e
  }
}

/** How many pull requests sit in the merge queue now; null when GraphQL refuses or the repository has no queue. */
async function queueNow(token: string, repo: string): Promise<number | null> {
  const [owner, name] = repo.split('/')
  try {
    const res = await fetch(`${GITHUB}/graphql`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', 'User-Agent': 'pipetooling-ship-pace' },
      body: JSON.stringify({
        query: 'query($owner: String!, $name: String!) { repository(owner: $owner, name: $name) { mergeQueue(branch: "main") { entries(first: 1) { totalCount } } } }',
        variables: { owner, name },
      }),
    })
    if (!res.ok) return null
    const body = (await res.json()) as { data?: { repository?: { mergeQueue?: { entries?: { totalCount?: number } } | null } } }
    const count = body.data?.repository?.mergeQueue?.entries?.totalCount
    return typeof count === 'number' ? count : null
  } catch {
    return null
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return json({ error: 'POST only.' }, 405)
  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const body = (await req.json().catch(() => ({}))) as { action?: unknown; cron_secret?: unknown }

    // The door: the cron's secret, or a signed-in dev asked as the caller.
    const cronSecret = Deno.env.get('CRON_SECRET')
    const headerSecret = req.headers.get('X-Cron-Secret') ?? req.headers.get('x-cron-secret') ?? (typeof body.cron_secret === 'string' ? body.cron_secret : null)
    let door: 'cron' | 'dev' | null = cronSecret && headerSecret && headerSecret === cronSecret ? 'cron' : null
    if (!door) {
      const auth = req.headers.get('Authorization')
      const anonKey = Deno.env.get('SUPABASE_ANON_KEY')
      if (auth && anonKey) {
        const asUser = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: auth } }, auth: { persistSession: false } })
        const { data: isDev } = await asUser.rpc('is_dev')
        if (isDev === true) door = 'dev'
      }
    }
    if (!door) return json({ error: 'The cron secret, or a dev signed in, is the door.' }, 401)

    const token = Deno.env.get('GITHUB_PACE_TOKEN')
    if (!token) return json({ success: false, noToken: true, line: 'GITHUB_PACE_TOKEN is not set, so GitHub was not read.' }, 503)
    const repo = Deno.env.get('GITHUB_PACE_REPO') || DEFAULT_REPO

    const started = Date.now()
    const now = new Date()
    const sinceMs = now.getTime() - SHIP_PACE_WINDOW_HOURS * HOUR_MS
    let prs: PacePr[]
    try {
      const [open, closed] = await Promise.all([openPrs(token, repo), closedPrsSince(token, repo, sinceMs)])
      prs = [...open, ...closed]
    } catch (e) {
      if (e instanceof GitHubRefused) return json({ success: false, github: e.status, line: `GitHub refused the pull requests (${e.status}). ${e.words}` }, 502)
      throw e
    }
    const [runs, queue] = await Promise.all([queueRunsSince(token, repo, sinceMs), queueNow(token, repo)])
    const picture = shipPacePicture({ now, prs, queueRuns: runs, queueNow: queue })

    const admin = createClient(supabaseUrl, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } })
    const { error } = await admin.from('app_settings').upsert({ key: SHIP_PACE_KEY, value_text: JSON.stringify(picture) }, { onConflict: 'key' })
    if (error) return json({ success: false, line: `The row would not save: ${error.message}` }, 500)

    return json({
      success: true,
      door,
      asOf: picture.asOf,
      prs: prs.length,
      queueRuns: runs?.length ?? null,
      queueNow: queue,
      last24h: picture.last24h,
      today: picture.today,
      now: picture.now,
      ms: Date.now() - started,
    })
  } catch (e) {
    console.error('ship-pace failed', e)
    return json({ error: e instanceof Error ? e.message : 'failed' }, 500)
  }
})
