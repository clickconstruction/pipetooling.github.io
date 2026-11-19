/**
 * The lien copies packet as a file (v2.7930): the PDF that the press on **Filed liens: copies to mail** would print,
 * written to disk so it can be looked at before anyone prints. Run it through `npm run lien:packet`
 * (`scripts/lien-packet/start.ts` hands in the keys); the flags are `LIEN_PACKET_USAGE`.
 *
 * Nothing here is a second drawing of the print. The rows are the Lien desk's own read, the hook the page itself
 * calls, run unchanged in a jsdom page. Each saved copy comes through `loadLienSavedCopy`, the window's reader. The
 * file is `buildLienServeRun`, the half of the press that opens no tab and keeps nothing. So the file is page for
 * page what the window would print for the same liens on the same day.
 *
 * It signs in as the dev (`scripts/lib/paySession.ts`), so every read is under his own access. It writes nothing to
 * the database: it never calls `printLienServeRun` or `fileSentCopy`, and every request passes the fence in
 * `src/lib/jobs/lienPacketPreview.ts` first. A request the fence refuses, or a read that never came back, stops the
 * command with no file, because the desk's read would otherwise go on with part of its rows missing.
 */
import { execFileSync } from 'node:child_process'
import { chmodSync, existsSync, mkdirSync, realpathSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { basename, dirname, isAbsolute, join, resolve } from 'node:path'
import { LIEN_PACKET_USAGE, lienPacketOutRefusal, lienPacketPageMarks, lienPacketReport, lienPacketRequestRefusal, parseLienPacketArgs, pickLienPacketJobs } from '../../src/lib/jobs/lienPacketPreview'
import { formatErrorMessage } from '../../src/utils/errorHandling'
import { mainCheckoutRoot } from '../walk/env'

const stop = (words: string, code = 1): never => {
  console.error(words)
  process.exit(code)
}

const parsed = parseLienPacketArgs(process.argv.slice(2))
if ('refused' in parsed) stop(`${parsed.refused}\n\n${LIEN_PACKET_USAGE.join('\n')}`, 2)
const args = 'args' in parsed ? parsed.args : stop('', 2)
if (args.help) {
  console.log(LIEN_PACKET_USAGE.join('\n'))
  process.exit(0)
}

/** A path with its links followed as far as it exists, so a link into the repo is still seen as inside it. */
function realPath(path: string): string {
  let at = path
  const rest: string[] = []
  while (!existsSync(at) && dirname(at) !== at) {
    rest.unshift(basename(at))
    at = dirname(at)
  }
  return join(realpathSync(at), ...rest)
}

// ── The fence: every request passes it, and a read that does not come back is remembered ────────────────────────
const refused: string[] = []
const notBack = new Map<string, string>()
const realFetch = globalThis.fetch
globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
  const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url
  const method = (init?.method ?? (typeof input === 'object' && 'method' in input ? input.method : 'GET')).toUpperCase()
  const at = new URL(url)
  const why = lienPacketRequestRefusal({ method, url, body: init?.body })
  if (why) {
    refused.push(`${method} ${at.pathname}: ${why}`)
    return new Response(JSON.stringify({ message: why, error: why }), { status: 403, headers: { 'Content-Type': 'application/json' } })
  }
  // A saved copy that Drive does not hand over is a hold with its reason, as in the window; a row read that fails is not.
  const counted = !at.pathname.startsWith('/functions/v1/')
  const key = `${method} ${at.pathname}${at.search}`
  try {
    const res = await realFetch(input, init)
    if (counted) {
      if (res.ok) notBack.delete(key)
      else notBack.set(key, `${method} ${at.pathname}: HTTP ${res.status}`)
    }
    return res
  } catch (e) {
    if (counted) notBack.set(key, `${method} ${at.pathname}: ${formatErrorMessage(e, 'no answer')}`)
    throw e
  }
}) as typeof fetch

const stopIfUnsafe = () => {
  if (refused.length > 0) stop(`No file was written. The preview reads and never writes, and it refused:\n  ${[...new Set(refused)].join('\n  ')}`)
  if (notBack.size > 0) stop(`No file was written. These reads did not come back, so the list may not be whole. Run it again:\n  ${[...new Set(notBack.values())].join('\n  ')}`)
}

const { calendarYmdInAppTzFromIso } = await import('../../src/utils/dateUtils')
const todayYmd = calendarYmdInAppTzFromIso(new Date().toISOString())

// ── Where the file goes: outside the repo, always ───────────────────────────────────────────────────────────────
const typedIn = process.env.LIEN_PACKET_CWD || process.cwd()
const outAsked = args.out ? (isAbsolute(args.out) ? args.out : resolve(typedIn, args.out)) : join(tmpdir(), 'pipetooling-lien-packet', `lien-copies-${todayYmd}.pdf`)
const out = realPath(outAsked)
const worktree = execFileSync('git', ['rev-parse', '--show-toplevel'], { encoding: 'utf8' }).trim()
const outRefusal = lienPacketOutRefusal(out, [realPath(worktree), realPath(mainCheckoutRoot())])
if (outRefusal) stop(outRefusal, 2)

// ── Sign in as the dev, on the app's own client ─────────────────────────────────────────────────────────────────
const { supabase } = await import('../../src/lib/supabase')
const { signInAsOwner } = await import('../lib/paySession')
const keys = Object.fromEntries(Object.entries(process.env).filter((e): e is [string, string] => e[0].startsWith('VITE_') && typeof e[1] === 'string'))
const owner = await signInAsOwner(keys)
const session = (await owner.auth.getSession()).data.session
if (!session) stop('The sign-in gave no session.')
const signedIn = await supabase.auth.setSession({ access_token: session!.access_token, refresh_token: session!.refresh_token })
if (signedIn.error) stop(`The sign-in did not hold: ${signedIn.error.message}`)

// ── The desk's own read: the page's hook, unchanged, in a jsdom page ────────────────────────────────────────────
const { JSDOM } = await import('jsdom')
const dom = new JSDOM('<!doctype html><html><body><div id="root"></div></body></html>', { url: 'http://localhost/' })
const g = globalThis as Record<string, unknown>
g.window = dom.window
g.document = dom.window.document
g.localStorage = dom.window.localStorage
g.HTMLElement = dom.window.HTMLElement
Object.defineProperty(globalThis, 'navigator', { value: dom.window.navigator, configurable: true })
const React = await import('react')
const { createRoot } = await import('react-dom/client')
const { useLienDeskData } = await import('../../src/hooks/useLienDeskData')
type DeskData = NonNullable<ReturnType<typeof useLienDeskData>['data']>

const DESK_WAIT_MS = 120_000
const root = createRoot(dom.window.document.getElementById('root')!)
const desk = await new Promise<DeskData>((done, fail) => {
  const late = setTimeout(() => fail(new Error('The Lien desk did not finish reading in two minutes.')), DESK_WAIT_MS)
  function Desk() {
    // As LienDeskPage reads it: the full read, ZZ test jobs hidden, which is how a browser stands until a dev shows them.
    const { data, loading } = useLienDeskData(true, todayYmd, { light: false, hideZzTestJobs: true })
    React.useEffect(() => {
      if (!data || loading) return
      clearTimeout(late)
      done(data)
    }, [data, loading])
    return null
  }
  root.render(React.createElement(Desk))
}).catch((e: unknown) => stop(formatErrorMessage(e, 'The Lien desk did not read.')))
root.unmount()
stopIfUnsafe()

// The letterhead (Settings → Company), read as the page reads it. No role is handed in: the one branch of this read
// that saves a draft is a dev's, so it can never be taken here.
const { fetchPhysicalInvoiceIssuerFromAppSettings, getPhysicalInvoiceIssuerDraft } = await import('../../src/lib/physicalInvoiceIssuer')
await fetchPhysicalInvoiceIssuerFromAppSettings()
const issuer = getPhysicalInvoiceIssuerDraft()
stopIfUnsafe()

// ── The window's own plan, for the liens asked for ──────────────────────────────────────────────────────────────
const { lienServeJobsFromDesk, lienServePlan, lienServePlanRead } = await import('../../src/lib/jobs/lienServePackets')
const { loadLienSavedCopy } = await import('../../src/lib/jobs/lienStampedCopyIo')
const { buildLienServeRun } = await import('../../src/lib/jobs/lienServePrintIo')
const { filingLetterheadFromIssuer } = await import('../../src/lib/jobsDocuments/lienFilingDocuments')
type CopyRead = Awaited<ReturnType<typeof loadLienSavedCopy>>

const onList = lienServeJobsFromDesk(desk)
// A job answers to its HCP number and to its Click number: the window's label carries the first alone.
const numbersOf = (j: (typeof onList)[number]) => [j.jobNumber, desk.jobsById[j.jobId]?.hcp_number, desk.jobsById[j.jobId]?.click_number]
const numberOf = (jobId: string) => [desk.jobsById[jobId]?.hcp_number, desk.jobsById[jobId]?.click_number].map((n) => (n ?? '').trim()).find(Boolean) ?? ''
const { picked, notOnList } = pickLienPacketJobs(onList, args.jobs, numbersOf)
const base = lienServePlan(picked, { todayYmd, phone: issuer?.phone ?? '' })

// Each saved copy, read three at a time as the window reads them.
const reads: Record<string, CopyRead['read']> = {}
const bytes = new Map<string, Uint8Array>()
const waiting = [...base.ready]
await Promise.all(
  Array.from({ length: 3 }, async () => {
    for (let r = waiting.shift(); r; r = waiting.shift()) {
      const loaded = await loadLienSavedCopy(r.job.jobId, r.copy.fileId)
      reads[r.job.filing.id] = loaded.read
      if (loaded.bytes) bytes.set(r.job.filing.id, loaded.bytes)
    }
  }),
)
stopIfUnsafe()

// A copy the window holds as "may be more than one lien" prints only for the jobs named with --alone.
const alone = new Set(args.alone.length ? pickLienPacketJobs(picked, args.alone, numbersOf).picked.map((j) => j.filing.id) : [])
const run = lienServePlanRead(base, reads, alone)
const built = await buildLienServeRun(run, (filingId) => bytes.get(filingId) ?? null, { letter: args.letter, letterhead: filingLetterheadFromIssuer(issuer), todayYmd, autoPrint: false })
stopIfUnsafe()

let pages = 0
let marks: string[] = []
if (built.stack) {
  const file = new Uint8Array(await built.stack.arrayBuffer())
  marks = await lienPacketPageMarks(file)
  pages = marks.length
  mkdirSync(dirname(out), { recursive: true })
  // The owner's eyes only: the file holds customers' names and addresses.
  writeFileSync(out, file, { mode: 0o600 })
  chmodSync(out, 0o600)
}

console.log('')
console.log(lienPacketReport({ path: built.stack ? out : '', pages, letter: args.letter, ready: built.ready, held: run.held, notPrinted: built.notPrinted, notOnList, numberOf }).join('\n'))
if (args.marks && marks.length > 0) console.log(`\nPage marks:\n${marks.map((m, i) => `  ${i + 1} ${m}`).join('\n')}`)
process.exit(0)
