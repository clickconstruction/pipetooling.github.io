/**
 * The desk's read of the legal tables (v2.5780): what a failed read means, and when to try again.
 *
 * `useLegalMatters` reads four tables at once. Before this, one failed read of any of them — a
 * dropped connection, a slow gateway, an aborted request — flipped the desk to *Read-only until
 * the legal tables are applied* and never read again; the owner saw that line on prod one morning
 * on a desk whose tables were there all along. The read has two different failures: the tables
 * are **missing** (the migration is not applied; the line is true and no retry helps) or the read
 * **failed** (anything else; the desk tries again on its own, spaced out, and offers *Retry*).
 */
export type LegalReadState = 'ok' | 'missing' | 'failed'

export type LegalReadError = { code?: string | null; message?: string | null } | null | undefined

/** Postgres's undefined_table, and PostgREST's "could not find the table in the schema cache". */
const MISSING_CODES: ReadonlySet<string> = new Set(['42P01', 'PGRST205'])
const MISSING_MESSAGE = /relation .* does not exist|schema cache/i

/** One failure means missing when any table is not there; a read that fails for another reason is retried. */
export function classifyLegalRead(errors: ReadonlyArray<LegalReadError>): LegalReadState {
  const failed = errors.filter((e): e is NonNullable<LegalReadError> => e != null)
  if (failed.length === 0) return 'ok'
  const missing = failed.some((e) => (e.code && MISSING_CODES.has(e.code)) || (e.message && MISSING_MESSAGE.test(e.message)))
  return missing ? 'missing' : 'failed'
}

/** The waits before each automatic retry, in order; after the last the line's Retry is the only way back. */
export const LEGAL_READ_RETRY_MS: ReadonlyArray<number> = [2_000, 8_000, 30_000]

/** How long to wait before retrying after the n-th consecutive failure (1-based); null once the schedule is spent. */
export function legalReadRetryDelay(failures: number): number | null {
  if (failures < 1) return null
  return LEGAL_READ_RETRY_MS[failures - 1] ?? null
}

export const LEGAL_READ_MISSING_WORDS = 'Read-only until the legal tables are applied.'
export const LEGAL_READ_FAILED_WORDS = 'Could not read the legal tables'

/** The line beside the account's header while the desk cannot read: null when it can. */
export function legalReadWords(state: LegalReadState): string | null {
  if (state === 'missing') return LEGAL_READ_MISSING_WORDS
  if (state === 'failed') return LEGAL_READ_FAILED_WORDS
  return null
}
