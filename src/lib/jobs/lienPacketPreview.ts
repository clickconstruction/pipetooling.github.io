/**
 * The lien copies packet as a file to look at (v2.7930): `npm run lien:packet` builds the PDF that the press on
 * **Filed liens: copies to mail** would print, and writes it to disk for a talk before anyone prints. The print is
 * `buildLienServeRun`, the half of the press that opens no tab and keeps nothing, fed the desk's own rows and each
 * saved copy read through the app's own reader, so the file is page for page what would print.
 *
 * This is the pure half of that command (`scripts/lien-packet/run.ts` does the reading and the writing): its flags,
 * where the file may go, which requests the command may make, what it says of the file, and a mark for each page so
 * two builds can be compared.
 *
 * The file holds customers' names and addresses and the repo is public, so it is never written inside the repo. The
 * command writes nothing to the database: `lienPacketRequestRefusal` is the fence, and a request it refuses stops the
 * command with no file.
 */
import { lienServeHeldLine, type LienServeHeld, type LienServeJob, type LienServeRunReady } from './lienServePackets'
import { lienCopyPagesWords } from './lienStampedCopy'

// ── The flags ───────────────────────────────────────────────────────────────────────────────────────────────────

export type LienPacketArgs = {
  /** Where the file goes; null takes the command's own folder under the computer's temporary files. */
  out: string | null
  /** The job numbers asked for; none asks for every lien on the list. */
  jobs: string[]
  /** The cover letter in front of each copy, as the window's box stands when first opened. */
  letter: boolean
  /** The job numbers whose saved copy a person has looked at and said is that lien alone (the window's own press). */
  alone: string[]
  /** Print a mark for each page, to compare with another build. */
  marks: boolean
  help: boolean
}

export const LIEN_PACKET_USAGE = [
  'npm run lien:packet -- [--out <file.pdf outside the repo>] [job numbers] [--no-letter] [--alone <job numbers>] [--marks]',
  '',
  '  Builds the PDF that Filed liens: copies to mail would print, and writes it to disk. Reads only.',
  '  job numbers     only these liens, by job number, separated by spaces or commas; none takes every lien on the list',
  '  --out <path>    where the file goes; it must end in .pdf and be outside the repo',
  '  --no-letter     the stamped copies alone, as the window prints with its letter box unticked',
  '  --alone <jobs>  print a saved copy the window holds as "may be more than one lien", for these jobs',
  '  --marks         a mark for each page, to compare with another build',
] as const

const listed = (value: string): string[] =>
  value
    .split(/[\s,]+/)
    .map((s) => s.trim())
    .filter(Boolean)

/** The command's flags. A flag it does not know, or one missing its value, is refused in words. */
export function parseLienPacketArgs(argv: ReadonlyArray<string>): { args: LienPacketArgs } | { refused: string } {
  const args: LienPacketArgs = { out: null, jobs: [], letter: true, alone: [], marks: false, help: false }
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]!
    const valueOf = (): string | null => {
      const eq = a.indexOf('=')
      if (eq > 0) return a.slice(eq + 1)
      const next = argv[i + 1]
      if (next === undefined || next.startsWith('--')) return null
      i += 1
      return next
    }
    const flag = a.startsWith('--') ? a.split('=')[0]! : ''
    if (flag === '--help' || a === '-h') args.help = true
    else if (flag === '--no-letter') args.letter = false
    else if (flag === '--marks') args.marks = true
    else if (flag === '--out') {
      const v = valueOf()
      if (!v) return { refused: '--out needs a path: where the PDF goes, outside the repo.' }
      args.out = v
    } else if (flag === '--alone' || flag === '--jobs') {
      const v = valueOf()
      if (!v) return { refused: `${flag} needs one job number or more.` }
      ;(flag === '--alone' ? args.alone : args.jobs).push(...listed(v))
    } else if (flag) return { refused: `${flag} is not a flag this command knows.` }
    else args.jobs.push(...listed(a))
  }
  return { args }
}

const sameNumber = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase()

/**
 * The liens asked for by job number, in the list's own order, and the numbers that are not on the list. None asked
 * takes them all. `numbersOf` hands every number a job answers to: the window's label carries the HCP number alone,
 * and a job made in the app may have only its Click number.
 */
export function pickLienPacketJobs<T extends Pick<LienServeJob, 'jobNumber'>>(jobs: ReadonlyArray<T>, wanted: ReadonlyArray<string>, numbersOf: (job: T) => ReadonlyArray<string | null | undefined> = (j) => [j.jobNumber]): { picked: T[]; notOnList: string[] } {
  if (wanted.length === 0) return { picked: [...jobs], notOnList: [] }
  const answers = (job: T, w: string) => numbersOf(job).some((n) => Boolean(n?.trim()) && sameNumber(w, n!))
  return {
    picked: jobs.filter((j) => wanted.some((w) => answers(j, w))),
    notOnList: [...new Set(wanted.map((w) => w.trim()))].filter((w) => !jobs.some((j) => answers(j, w))),
  }
}

// ── Where the file may go ───────────────────────────────────────────────────────────────────────────────────────

const slashed = (p: string) => p.replace(/\\/g, '/').replace(/\/+$/, '')

/**
 * Why the file may not be written at `out`, or null when it may. `out` and each root are whole paths with their links
 * followed (the command resolves them), and a root is a checkout of the repo: this one, and the main checkout that
 * holds every worktree.
 */
export function lienPacketOutRefusal(out: string, roots: ReadonlyArray<string>): string | null {
  const path = slashed(out)
  if (!/\.pdf$/i.test(path)) return 'The file is a PDF: give --out a path that ends in .pdf.'
  const inside = roots.map(slashed).find((root) => root && (path === root || path.startsWith(`${root}/`)))
  if (inside) return `The packet holds customers’ names and addresses and the repo is public, so the file is never written inside it (${inside}). Give --out a path outside the repo, or leave --out off.`
  return null
}

// ── The fence: what the command may ask the server ──────────────────────────────────────────────────────────────

export type LienPacketRequest = { method: string; url: string; /** The request's body as sent: JSON text, or nothing. */ body?: unknown }

/** The one thing the command asks of `drive-link`: a saved copy's own bytes. */
const DRIVE_READ = 'read'

function bodyAction(body: unknown): string {
  if (typeof body !== 'string') return ''
  try {
    const parsed = JSON.parse(body) as { action?: unknown } | null
    return typeof parsed?.action === 'string' ? parsed.action : ''
  } catch {
    return ''
  }
}

/**
 * Why a request is not made, or null when it is a read the command may make. Rows are read and never written: a table
 * takes a GET alone, and a function of the database is called only when it is one of the desk's own readers, which
 * are all named `list_…`. Of the edge functions it asks only the sign-in for its link and `drive-link` for a saved
 * copy's bytes. Anything else that is not a GET is refused. A refusal stops the command with no file, so a later
 * change that would make the preview write something fails loudly instead.
 */
export function lienPacketRequestRefusal(req: LienPacketRequest): string | null {
  const method = (req.method || 'GET').toUpperCase()
  const get = method === 'GET' || method === 'HEAD'
  let path = ''
  try {
    path = new URL(req.url).pathname
  } catch {
    return 'the address did not read'
  }
  const fn = /^\/functions\/v1\/([^/]+)/.exec(path)?.[1]
  if (fn === 'dev-login') return method === 'POST' ? null : 'the sign-in is asked by POST alone'
  if (fn === 'drive-link') return method === 'POST' && bodyAction(req.body) === DRIVE_READ ? null : 'drive-link is asked for a saved copy’s bytes alone'
  if (fn) return `the preview does not call the function ${fn}`
  const rpc = /^\/rest\/v1\/rpc\/([^/]+)/.exec(path)?.[1]
  if (rpc) return get || rpc.startsWith('list_') ? null : `the preview calls the desk’s readers alone, and ${rpc} is not one`
  if (get) return null
  if (path === '/auth/v1/verify' || path === '/auth/v1/token') return null
  return `the preview reads and never writes: ${method} ${path}`
}

// ── What the command says of the file ───────────────────────────────────────────────────────────────────────────

export type LienPacketReportInput = {
  /** Where the file was written; '' when none was. */
  path: string
  /** The pages in the whole file: the mail sheet's, then every lien's. */
  pages: number
  /** The cover letter was asked for. */
  letter: boolean
  /** The liens in the file, in the stack's order, each with the pages its own papers take. */
  ready: ReadonlyArray<{ pages: number; ready: Pick<LienServeRunReady, 'job' | 'envelopes' | 'letter' | 'file'> }>
  held: ReadonlyArray<LienServeHeld>
  /** The liens the print left out after all, each with its reason. */
  notPrinted: ReadonlyArray<{ job: Pick<LienServeJob, 'jobLabel'>; reason: string }>
  /** The job numbers asked for that are not on the list. */
  notOnList: ReadonlyArray<string>
  /** The number that picks a job, said after a label that does not carry it; absent says none. */
  numberOf?: (jobId: string) => string
}

const count = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`
const span = (first: number, last: number) => (first === last ? `page ${first}` : `pages ${first}–${last}`)

/**
 * The lines the command prints: where the file is, each lien in it with its pages, what was held with its reason, and
 * the numbers asked for that are not on the list. The page numbers are the file's own, so a reader can turn to a lien.
 */
export function lienPacketReport(input: LienPacketReportInput): string[] {
  const lines: string[] = []
  // A job with no HCP number is labelled by its name alone, so its line says the number that picks it.
  const label = (job: Pick<LienServeJob, 'jobId' | 'jobLabel'>) => {
    const number = (input.numberOf?.(job.jobId) ?? '').trim()
    return number && !job.jobLabel.startsWith(number) ? `${job.jobLabel} (job ${number})` : job.jobLabel
  }
  const envelopes = input.ready.reduce((n, r) => n + r.ready.envelopes.length, 0)
  if (input.ready.length === 0) lines.push('No file was written: no lien on the list can print.')
  else {
    lines.push(`Lien copies packet: ${count(input.ready.length, 'lien', 'liens')} · ${count(envelopes, 'envelope', 'envelopes')} · ${lienCopyPagesWords(input.pages)}`)
    lines.push(input.path)
    lines.push(`Built by the Lien desk’s own print${input.letter ? ', with the cover letter' : ', with no cover letter'}. Nothing was saved, filed or marked as mailed.`)
    lines.push('', 'In the file:')
    const sheet = input.pages - input.ready.reduce((n, r) => n + r.pages, 0)
    lines.push(`  ${span(1, Math.max(1, sheet))} · Mail sheet`)
    let at = sheet
    for (const r of input.ready) {
      const each = r.ready.letter && input.letter ? `each a letter and ${count(r.ready.file.pages, 'stamped page', 'stamped pages')}` : `each ${count(r.ready.file.pages, 'stamped page', 'stamped pages')}, no letter`
      lines.push(`  ${span(at + 1, at + r.pages)} · ${label(r.ready.job)} · ${count(r.ready.envelopes.length, 'envelope', 'envelopes')}, ${each}`)
      at += r.pages
    }
  }
  if (input.held.length > 0) {
    lines.push('', 'Held, not in the file:')
    for (const h of input.held) lines.push(`  ${lienServeHeldLine(h)}`)
  }
  if (input.notPrinted.length > 0) {
    lines.push('', 'Left out by the print:')
    for (const f of input.notPrinted) lines.push(`  ${f.job.jobLabel}: ${f.reason.trim().replace(/[.\s]+$/, '')}.`)
  }
  if (input.notOnList.length > 0) lines.push('', `Not on Filed liens: copies to mail: ${input.notOnList.join(', ')}`)
  return lines
}

// ── A mark for each page ────────────────────────────────────────────────────────────────────────────────────────

/**
 * One mark for each page of a PDF: the page copied alone into a file with no date or maker on it, and that file's
 * SHA-256, shortened. Two builds whose marks agree, page by page, hold the same pages: the same drawing, the same
 * scan, the same size. A file's own bytes cannot be compared, because every build stamps the time it was made.
 */
export async function lienPacketPageMarks(bytes: Uint8Array): Promise<string[]> {
  const lib = await import('pdf-lib')
  const doc = await lib.PDFDocument.load(bytes, { updateMetadata: false })
  const marks: string[] = []
  for (const index of doc.getPageIndices()) {
    const one = await lib.PDFDocument.create({ updateMetadata: false })
    const [page] = await one.copyPages(doc, [index])
    one.addPage(page!)
    const digest = await crypto.subtle.digest('SHA-256', (await one.save({ useObjectStreams: false })) as BufferSource)
    marks.push(Array.from(new Uint8Array(digest).slice(0, 8), (b) => b.toString(16).padStart(2, '0')).join(''))
  }
  return marks
}
