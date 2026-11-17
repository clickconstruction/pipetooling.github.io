import type { PhysicalInvoiceIssuer } from '../physicalInvoiceIssuer'
import { batchWords, type BatchWords } from '../batchWords'
import { runCopyPages, runPagesHtml, type RunCopyPage, type RunNotice, type RunPayPages, type RunRecipient } from './lienDeskRun'
import { runDividerHtml, runDocumentWords, runMailing, runPageFoot } from './lienRunPaper'
import { runEnvelopes, type RunEnvelope } from './runEnvelopes'

/**
 * A § 53.056 notice printed by itself from the job's Lien window (the owner, 2026-11-16): *include a page like the
 * following in front of every notice … in front of each bundle for an envelope so there are no discrepancies*.
 *
 * Until then the window printed one set behind a help sheet that told the office to photocopy it for the second
 * envelope. Now it prints a set for each envelope, each behind the run's own divider, in the order the help sheet's
 * boxes name them. The notice the window prints is built as the run's is (`RunNotice`), so the envelopes, the holds,
 * the pages of each copy, the dividers and the feet all come from the run's builders: `runEnvelopes`, `runMailing`,
 * `runCopyPages`, `runDividerHtml`, `runPageFoot`. A divider's count and its amount are read off the same pages that
 * print behind it, so the two cannot disagree. Pure.
 */

/** One page behind a divider: the copy it belongs to and its HTML as the run prints it. */
export type LienOneOffPage = { notice: RunNotice; recipient: RunRecipient; page: RunCopyPage }

/** One envelope's bundle: the divider's envelope, then the pages that go in it, in print order. */
export type LienOneOffBundle = { env: RunEnvelope; pages: LienOneOffPage[]; labels: string[] }

export type LienOneOffPlan = {
  /** The envelopes that print, numbered 1 to N, each with its pages. */
  bundles: LienOneOffBundle[]
  /** The envelopes held back, each with the run's own reason. */
  held: Array<{ env: RunEnvelope; why: string }>
  /** The window's print press: *Print 2 envelopes*, *Print 1 envelope · 1 held ▸*, dead with nothing to print. */
  press: BatchWords
  /** A press for each envelope alone, its divider and its pages: *Reprint envelope 2 · the original contractor*. */
  reprints: Array<{ n: number; label: string }>
}

const ENVELOPE = ['envelope', 'envelopes'] as const

/** `Owner of record` → `the owner`, as the press says whose envelope it is. */
function whoseWords(label: string): string {
  return /owner/i.test(label) ? 'the owner' : /contractor/i.test(label) ? 'the original contractor' : label.toLowerCase()
}

/** The plan for one notice: the envelopes and their pages as the run would print them, the held ones, and the presses' words. */
export function lienNoticeOneOffPlan(notice: RunNotice, invoiceSectionsByJob?: Readonly<Record<string, readonly string[]>>, payPagesByJob?: RunPayPages): LienOneOffPlan {
  const mailing = runMailing(runEnvelopes([notice]))
  const bundles = mailing.mailed.map((env) => {
    const pages = env.contents.flatMap(({ notice: n, recipient: r }) => runCopyPages(n, r, invoiceSectionsByJob, payPagesByJob).map((page) => ({ notice: n, recipient: r, page })))
    return { env, pages, labels: pages.map((p) => p.page.label) }
  })
  return {
    bundles,
    held: mailing.held,
    press: batchWords({ verb: 'Print', ready: bundles.length, held: mailing.held.length, noun: ENVELOPE }),
    reprints: bundles.length > 1 ? bundles.map((b) => ({ n: b.env.n, label: `Reprint envelope ${b.env.n} · ${whoseWords(b.env.label)}` })) : [],
  }
}

/** The divider in front of one bundle: the run's own, with its count and its documents read off the bundle's pages. */
export function lienOneOffDividerHtml(plan: Pick<LienOneOffPlan, 'bundles'>, bundle: LienOneOffBundle, issuer: PhysicalInvoiceIssuer | null): string {
  return runDividerHtml(bundle.env, plan.bundles.length, issuer, bundle.labels)
}

/** One bundle's pages as they print behind its divider, each with the run's foot naming its copy and its place. */
export function lienOneOffBundlePages(bundle: LienOneOffBundle): string[] {
  return bundle.pages.map(({ notice, recipient, page }, i) => page.html + runPageFoot(notice, recipient, page.label, i + 1, bundle.pages.length))
}

/**
 * The print: the help sheet once when the caller hands one in, then for each envelope its divider and its pages.
 * `only` prints one envelope's bundle alone, its divider in front.
 */
export function lienOneOffPrintHtml(plan: LienOneOffPlan, opts: { issuer: PhysicalInvoiceIssuer | null; title: string; sheetHtml?: string; only?: number }): string {
  const bundles = opts.only ? plan.bundles.filter((b) => b.env.n === opts.only) : plan.bundles
  const pages: string[] = []
  if (opts.sheetHtml && !opts.only) pages.push(opts.sheetHtml)
  for (const b of bundles) pages.push(lienOneOffDividerHtml(plan, b, opts.issuer), ...lienOneOffBundlePages(b))
  return runPagesHtml(pages, opts.title)
}

/**
 * What is filed on the job for the print (`docs/SENT_COPIES.md`): the pages that go in the envelopes, every bundle once,
 * with no help sheet and no divider, which stay on the desk. Two envelopes printed is one notice, filed once.
 */
export function lienOneOffFiledHtml(plan: LienOneOffPlan, title: string, only?: number): string {
  const bundles = only ? plan.bundles.filter((b) => b.env.n === only) : plan.bundles
  return runPagesHtml(bundles.flatMap(lienOneOffBundlePages), title)
}

/** The divider's own count and words for a bundle, as `runDividerHtml` prints them: what the tests hold equal to the pages. */
export function lienOneOffDividerCount(bundle: LienOneOffBundle): { count: number; words: string } {
  return runDocumentWords(bundle.labels)
}

/** The line beside the press: what this window cannot print, said before the print, not after. */
export const LIEN_ONE_OFF_INK_WORDS = 'The signature does not print from this window. The help sheet asks for ink on each set.'
