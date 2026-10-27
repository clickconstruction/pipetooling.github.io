/**
 * Gap answers (v2.5920, to-do legal-gap-answers): what the office knows about a packet gap, one
 * line per (matter, gap key), so a fact that is true and known — the work ran on a handshake,
 * there is no paper to record — stops reading as an unexplained hole. The rows live in
 * `legal_matter_gap_answers` (written through `legal_answer_gap` / `legal_clear_gap_answer`);
 * this kernel folds them under the gaps the packet computed, adds the answer the app already
 * holds elsewhere (a job marked *contract not needed* answers its agreement gap by itself), and
 * keeps the counts honest: a red gap stays red with its answer riding under it, an answered note
 * leaves the to-know-about count for an Answered group. Pure.
 */
import type { JobContractCoverage } from '../jobs/jobContractCoverage'

export const LEGAL_GAP_ANSWER_MAX = 500

/** One answer as the fold reads it; `auto` names the record it was read from instead of typed. */
export type LegalGapAnswer = {
  text: string
  /** Who typed it; null for an auto answer or an unknown account. */
  by: string | null
  /** 'YYYY-MM-DD'; '' when the source carries no day. */
  ymd: string
  documentId: string | null
  documentTitle: string
  auto: 'contract_not_needed' | null
}

/** A stored row, resolved by the caller (names and days are the caller's to look up). */
export type LegalGapAnswerLike = {
  gapKey: string
  text: string
  by: string | null
  ymd: string
  documentId: string | null
  documentTitle: string
}

/** The job's own *contract not needed* mark answers its agreement gap — nothing retyped. */
export function autoContractGapAnswer(coverage: JobContractCoverage): LegalGapAnswer | null {
  if (coverage.kind !== 'not_needed') return null
  const reason = (coverage.reason ?? '').trim()
  return {
    text: `Marked contract not needed on the job${reason ? `: “${reason}”` : ''}.`,
    by: null,
    ymd: (coverage.at ?? '').slice(0, 10),
    documentId: null,
    documentTitle: '',
    auto: 'contract_not_needed',
  }
}

/**
 * The answers by gap key: the office's stored rows, with the auto answers underneath them — a
 * typed answer on the same key wins over the auto one.
 */
export function gapAnswersByKey(
  stored: ReadonlyArray<LegalGapAnswerLike>,
  jobCoverage: ReadonlyArray<{ jobId: string; coverage: JobContractCoverage }>,
): Map<string, LegalGapAnswer> {
  const out = new Map<string, LegalGapAnswer>()
  for (const j of jobCoverage) {
    const auto = autoContractGapAnswer(j.coverage)
    if (auto) out.set(`contract:${j.jobId}`, auto)
  }
  for (const a of stored) {
    const text = a.text.trim()
    if (!a.gapKey || !text) continue
    out.set(a.gapKey, { text, by: a.by, ymd: a.ymd, documentId: a.documentId, documentTitle: a.documentTitle, auto: null })
  }
  return out
}

/** The honest counts: every stop is still a stop; an answered warn leaves the to-know-about count. */
export function gapAnswerCounts(gaps: ReadonlyArray<{ severity: 'stop' | 'warn'; answer?: LegalGapAnswer | null }>): {
  stops: number
  warns: number
  answered: number
} {
  let stops = 0
  let warns = 0
  let answered = 0
  for (const g of gaps) {
    if (g.severity === 'stop') stops += 1
    else if (!g.answer) warns += 1
    if (g.answer) answered += 1
  }
  return { stops, warns, answered }
}

/** The muted line under an answer: who and when, or where an auto answer was read from. */
export function gapAnswerByline(a: LegalGapAnswer): string {
  if (a.auto === 'contract_not_needed') return 'read from the job’s contract strip · nothing to retype'
  const who = a.by ? `answered by ${a.by}` : 'answered'
  return a.ymd ? `${who} · ${a.ymd}` : who
}
