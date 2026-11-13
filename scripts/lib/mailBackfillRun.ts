/**
 * The mail backfill's run (punch list #332), its small parts: the ledger of what was planned, filed, refused and taken
 * back; the sheet a person reads; the arguments. `scripts/mail-backfill.ts` does the calls. The ledger and the sheets
 * hold real names and live outside the repo.
 */
import { existsSync, readFileSync } from 'node:fs'

/** One line of the ledger. The newest line for a mailbox and a thread says where that conversation stands. */
export interface LedgerEntry {
  at: string
  kind: 'plan' | 'applied' | 'refused' | 'untagged'
  jobKey: string
  account: string
  threadId: string
  /** The seat's hash of the plan: an apply quotes it, and the seat files only when the conversation still reads so. */
  planHash?: string
  counts?: Record<string, number>
  /** The rule that matched (`backfillMatch.ts`). */
  rule?: string
  /** What the seat said: the filing's words, or the refusal's. */
  words?: string
}

export const ledgerLine = (entry: LedgerEntry): string => `${JSON.stringify(entry)}\n`

/** The ledger's lines, oldest first. A line that does not read is skipped: the file is appended to, never rewritten. */
export function parseLedger(text: string): LedgerEntry[] {
  const out: LedgerEntry[] = []
  for (const line of text.split('\n')) {
    if (!line.trim()) continue
    try {
      const e = JSON.parse(line) as LedgerEntry
      if (e && typeof e.kind === 'string' && typeof e.account === 'string' && typeof e.threadId === 'string' && typeof e.jobKey === 'string') out.push(e)
    } catch {
      // A torn last line from a run that was stopped.
    }
  }
  return out
}

export function readLedger(path: string): LedgerEntry[] {
  return existsSync(path) ? parseLedger(readFileSync(path, 'utf8')) : []
}

/** Each conversation's newest line for a job, in the order the conversations first appeared. */
function newestOf(entries: readonly LedgerEntry[], jobKey: string): LedgerEntry[] {
  const by = new Map<string, LedgerEntry>()
  for (const e of entries) if (e.jobKey === jobKey) by.set(`${e.account}\n${e.threadId}`, e)
  return [...by.values()]
}

/**
 * The conversations ready to file: planned, with a hash, and nothing since. One that was filed, refused or taken back
 * after its plan is not here: a person plans it again and reads the new sheet.
 */
export function plannedOf(entries: readonly LedgerEntry[], jobKey: string): Array<LedgerEntry & { planHash: string }> {
  return newestOf(entries, jobKey).filter((e): e is LedgerEntry & { planHash: string } => e.kind === 'plan' && typeof e.planHash === 'string' && e.planHash !== '')
}

/** The conversations on the job by this run: filed, and not taken back since. */
export function appliedOf(entries: readonly LedgerEntry[], jobKey: string): LedgerEntry[] {
  return newestOf(entries, jobKey).filter((e) => e.kind === 'applied')
}

/** A cell as a spreadsheet may safely open it: quoted, and never read as a formula. */
function cell(value: string): string {
  const v = /^[=+\-@\t\r]/.test(value) ? `'${value}` : value
  return /[",\n\r]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v
}

/** A sheet as CSV: the head, then a row a conversation. */
export function sheetCsv(head: readonly string[], rows: readonly (readonly string[])[]): string {
  return `${[head, ...rows].map((r) => r.map((c) => cell(String(c ?? ''))).join(',')).join('\n')}\n`
}

/** `--name value` from the arguments, or null. */
export function argOf(argv: readonly string[], name: string): string | null {
  const i = argv.indexOf(name)
  const v = i >= 0 ? argv[i + 1] : undefined
  return v !== undefined && !v.startsWith('--') ? v : null
}

export const flagOf = (argv: readonly string[], name: string): boolean => argv.includes(name)

/** The never-tag list's head, as `seed` writes it. */
export const NEVER_TAG_HEAD = [
  '# Never filed onto a job, whatever the mail says (punch list #332).',
  '# One address or @domain a line. A # starts a comment.',
  '# The office adds to this: the accountant, payroll, the bank, insurers, anyone whose mail is private.',
  '# This file holds real addresses. It lives outside the repo and is never committed.',
].join('\n')
