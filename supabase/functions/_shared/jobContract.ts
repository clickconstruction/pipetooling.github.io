/**
 * Job-contract helpers shared by send-job-contract / get-job-contract /
 * sign-job-contract (Contract Desk PR 2). Deno-side twins of the client
 * kernels where the server needs the same words.
 */

export const JOB_CONTRACT_BUCKET = 'job-contract-documents'
export const JOB_CONTRACT_LINK_DAYS = 90
export const JOB_CONTRACT_REMINDER_DAYS = 3

export function randomUrlToken(): string {
  const bytes = new Uint8Array(32)
  crypto.getRandomValues(bytes)
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

export function clientIp(req: Request): string | null {
  const fwd = req.headers.get('x-forwarded-for')
  if (fwd) return fwd.split(',')[0]?.trim() ?? null
  return req.headers.get('cf-connecting-ip')
}

export function appOrigin(preferred?: unknown): string {
  const p = typeof preferred === 'string' && /^https?:\/\//.test(preferred) ? preferred : null
  return (p ?? Deno.env.get('APP_ORIGIN') ?? 'https://clicktooling.com').replace(/\/$/, '')
}

export function signingUrl(origin: string, token: string): string {
  return `${origin}/contract/sign?t=${encodeURIComponent(token)}`
}

export function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

export function jobNumberLabel(job: { hcp_number: string | null; click_number: string | null }): string {
  return (job.hcp_number ?? '').trim() || (job.click_number ?? '').trim() || '—'
}

export function contractHeading(job: { job_address: string | null; job_name: string | null }): string {
  const addr = (job.job_address ?? '').trim()
  if (addr) return `Service agreement for ${addr.split(',')[0]?.trim() || addr}`
  const name = (job.job_name ?? '').trim()
  return name ? `Service agreement — ${name}` : 'Service agreement'
}

/** The kind of job agreement a row is (the owner's call of 2026-11-02): our contract, or the warranty sent in place of one. */
export type JobAgreementKind = 'contract' | 'warranty'
export const agreementKindOf = (raw: unknown): JobAgreementKind => (raw === 'warranty' ? 'warranty' : 'contract')
/** "Contract" / "Warranty", and in a sentence. The client's twin is `src/lib/jobs/jobAgreementKind.ts`. */
export const agreementNoun = (kind: JobAgreementKind): { Noun: string; noun: string; amountLabel: string } =>
  kind === 'warranty' ? { Noun: 'Warranty', noun: 'warranty', amountLabel: 'Price' } : { Noun: 'Contract', noun: 'contract', amountLabel: 'Contract amount' }

/** The paper's heading by kind: "Service agreement for 407 E 6th St", "Warranty for 407 E 6th St". */
export function agreementHeading(kind: JobAgreementKind, job: { job_address: string | null; job_name: string | null }): string {
  if (kind !== 'warranty') return contractHeading(job)
  const addr = (job.job_address ?? '').trim()
  if (addr) return `Warranty for ${addr.split(',')[0]?.trim() || addr}`
  const name = (job.job_name ?? '').trim()
  return name ? `Warranty — ${name}` : 'Warranty'
}

/** A warranty's lines to initial, as its `fields.initial_lines` keeps them. */
export function initialLinesOf(fields: unknown): string[] {
  const raw = fields && typeof fields === 'object' ? (fields as Record<string, unknown>).initial_lines : null
  return Array.isArray(raw) ? raw.filter((x): x is string => typeof x === 'string').map((x) => x.trim()).filter(Boolean) : []
}

/** Initials as typed, with dots and spaces off and in capitals; two to four letters pass. The client's rule is the same. */
export const cleanInitials = (raw: string): string => raw.replace(/[.\s]/g, '').toUpperCase()
export const INITIALS_SHAPE = /^[A-Za-z]{2,4}$/

/**
 * The customer's initials on a warranty's lines, checked and kept: `[{line, initials}]` in the lines' order, or the
 * refusal in words when a line is blank or its initials are not two to four letters. A contract takes none.
 */
export function initialsForLines(lines: readonly string[], typed: unknown): { ok: true; entries: { line: string; initials: string }[] } | { ok: false; error: string } {
  if (lines.length === 0) return { ok: true, entries: [] }
  const list = Array.isArray(typed) ? typed.map((x) => (typeof x === 'string' ? cleanInitials(x) : '')) : []
  const missing = lines.findIndex((_, i) => !list[i])
  if (missing >= 0) return { ok: false, error: lines.length === 1 ? 'Initial the line above to continue.' : `Initial every line to continue. Line ${missing + 1} is still blank.` }
  const odd = lines.findIndex((_, i) => !INITIALS_SHAPE.test(list[i] ?? ''))
  if (odd >= 0) return { ok: false, error: `Initials are two to four letters. Line ${odd + 1} reads "${list[odd] ?? ''}".` }
  return { ok: true, entries: lines.map((line, i) => ({ line, initials: list[i] ?? '' })) }
}

export function amountCentsFromFields(fields: unknown): number | null {
  if (!fields || typeof fields !== 'object') return null
  const v = (fields as { amount_cents?: unknown }).amount_cents
  return typeof v === 'number' && Number.isFinite(v) ? Math.round(v) : null
}

export function formatMoney(cents: number): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(cents / 100)
}

/** PNG magic bytes + a size cap, like accept-estimate. */
export function decodeSignaturePng(dataUrlOrBase64: string): Uint8Array | null {
  const b64 = dataUrlOrBase64.includes(',') ? dataUrlOrBase64.slice(dataUrlOrBase64.indexOf(',') + 1) : dataUrlOrBase64
  let bytes: Uint8Array
  try {
    const bin = atob(b64)
    bytes = new Uint8Array(bin.length)
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
  } catch {
    return null
  }
  if (bytes.length > 512 * 1024) return null
  const magic = [0x89, 0x50, 0x4e, 0x47]
  if (bytes.length < 8 || magic.some((m, i) => bytes[i] !== m)) return null
  return bytes
}

export function isValidEmail(v: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)
}

export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

export const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })

/** Short record ID printed inside the signature frame (client twin: src/lib/signedRecordId.ts). */
export function signedRecordId(prefix: 'E' | 'J', number: string | number | null | undefined, rowId: string | null | undefined): string {
  const n = String(number ?? '').replace(/[^a-zA-Z0-9]/g, '') || '0'
  const hex = (rowId ?? '').replace(/-/g, '').slice(0, 6).toUpperCase() || '000000'
  return `${prefix}${n}-${hex}`
}
