import { demandDate } from '../jobsDocuments/demandDate'
import type { SentFiling } from '../sent/sentCopies'
import type { LienDeskPile } from './lienDesk'

/**
 * One page of a monthly notice, exported alone (v2.7432, Taunya's ask of 2026-11-15: *"at the top of each of these
 * letters I would like export tools to download them as PDFs or open them in a new tab where it is just the letter"*).
 *
 * Each page bar in the notice pane carries two presses, *Open ↗* and *PDF ↓*. This kernel says, for a page key, how
 * its PDF is made, what the file is called, whether it carries the draft line and where that line sits, and what a
 * download files under Sent from this job. Pure: the drawing is `lienPageExportIo.ts`.
 */
export type LienExportPageKey = 'cover' | 'release' | 'notice' | 'pay'

export const LIEN_EXPORT_PAGE_KEYS: ReadonlyArray<LienExportPageKey> = ['cover', 'release', 'notice', 'pay']

export function isLienExportPageKey(key: string): key is LienExportPageKey {
  return (LIEN_EXPORT_PAGE_KEYS as ReadonlyArray<string>).includes(key)
}

/** The presses' words. A phone shows the arrow alone and says the label to a screen reader. */
export const LIEN_PAGE_EXPORT_WORDS = {
  open: { label: 'Open', arrow: '↗', title: 'Open this page alone in a new tab, as it prints' },
  pdf: { label: 'PDF', arrow: '↓', title: 'Save this page as a PDF' },
  busy: 'Making the PDF…',
  blocked: 'Popup blocked. Allow popups to open this page in a new tab.',
  failed: 'Could not make the PDF',
} as const

/** What a press says to a screen reader, with its page, so three pairs down the pane read apart. */
export function lienExportPressLabel(press: 'open' | 'pdf', key: LienExportPageKey): string {
  return press === 'open' ? `Open the ${PAGE_NAMES[key]} in a new tab` : `Save the ${PAGE_NAMES[key]} as a PDF`
}

/** The page's name as the file says it. */
const PAGE_NAMES: Record<LienExportPageKey, string> = {
  cover: 'cover letter',
  release: 'conditional release',
  notice: 'notice',
  pay: 'pay codes',
}

export function lienExportPageName(key: LienExportPageKey): string {
  return PAGE_NAMES[key]
}

/**
 * How a page's PDF is made: the builder and the options the run uses for that part (`buildRunNoticePdf`), so an
 * exported page is the page that mails. The cover is a filing paper held to one page with no citation at its foot,
 * the notice and the pay page are filing papers with the § 53.056 citation, the release is the waiver's own form.
 */
export type LienExportRecipe = { builder: 'filing'; fit: 'one-page' | null; citation: boolean } | { builder: 'waiver' }

const RECIPES: Record<LienExportPageKey, LienExportRecipe> = {
  cover: { builder: 'filing', fit: 'one-page', citation: false },
  release: { builder: 'waiver' },
  notice: { builder: 'filing', fit: null, citation: true },
  pay: { builder: 'filing', fit: null, citation: true },
}

export function lienExportRecipe(key: LienExportPageKey): LienExportRecipe {
  return RECIPES[key]
}

/** A word made safe for a file name on any desk: no path or reserved marks, one space between words, no dot at an end. */
function fileSafe(words: string): string {
  return (words ?? '')
    .replace(/[\\/:*?"<>|]+/g, ' ')
    // A control character has no place in a file name.
    .replace(/[\u0000-\u001f\u007f]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^[.\s]+|[.\s]+$/g, '')
}

const JOB_WORDS_MAX = 80

/**
 * The file's name without its ending: the job's number, its name, then the page ("523 Mission Hills, cover letter").
 * It is the tab's title and the sent copy's title too. A job with no number or no name reads with what it has, and a
 * job with neither reads "Lien notice".
 */
export function lienExportTitle(input: { jobNumber: string | null | undefined; jobName: string | null | undefined; key: LienExportPageKey }): string {
  const job = fileSafe([input.jobNumber ?? '', input.jobName ?? ''].map((w) => fileSafe(w)).filter((w) => w && w !== '—').join(' ')).slice(0, JOB_WORDS_MAX).trim()
  return `${job || 'Lien notice'}, ${PAGE_NAMES[input.key]}`
}

export function lienExportFileName(input: { jobNumber: string | null | undefined; jobName: string | null | undefined; key: LienExportPageKey }): string {
  return `${lienExportTitle(input)}.pdf`
}

/** The piles a notice sits in before the leader has approved it. Missed is one: nothing went. */
const NOT_APPROVED: ReadonlySet<LienDeskPile> = new Set<LienDeskPile>(['needs_owner', 'to_draft', 'awaiting', 'held', 'missed'])

/** Whether an exported page is a draft: until the notice is approved, and when no notice is picked. */
export function lienExportIsDraft(pile: LienDeskPile | null | undefined): boolean {
  return pile == null || NOT_APPROVED.has(pile)
}

/** The line at the foot of a draft's exported page, with the day it was made. Empty once the notice is approved. */
export function lienExportDraftLine(pile: LienDeskPile | null | undefined, todayYmd: string): string {
  return lienExportIsDraft(pile) ? `Draft, not sent · ${demandDate(todayYmd)}` : ''
}

/**
 * Where the draft line sits on a page, in millimetres from the sheet's left and top edges. The line is stamped on the
 * finished PDF, so neither builder changes. The cover's foot holds only the page number, so the line starts at the
 * left margin. The notice and the pay page hold the citation there, and the release holds its form's title, so on
 * those the line is centred in the clear middle of the foot, on the foot's own baseline.
 */
export type LienExportDraftStamp = { align: 'left' | 'center'; xMm: number; baselineMm: number }

const STAMPS: Record<LienExportPageKey, LienExportDraftStamp> = {
  cover: { align: 'left', xMm: 22, baselineMm: 272 },
  notice: { align: 'center', xMm: 135, baselineMm: 272 },
  pay: { align: 'center', xMm: 135, baselineMm: 272 },
  release: { align: 'center', xMm: 135, baselineMm: 274 },
}

export function lienExportDraftStamp(key: LienExportPageKey): LienExportDraftStamp {
  return STAMPS[key]
}

/**
 * What a *PDF ↓* files under Sent from this job, as *Saved as a file* (`docs/SENT_COPIES.md`). A draft's download is
 * not a send and files nothing, so this is null for one. *Open ↗* is a look and never files.
 */
export function lienExportFiling(input: { pile: LienDeskPile | null | undefined; jobId: string | null | undefined; title: string; recipientName?: string | null }): Omit<SentFiling, 'how'> | null {
  if (lienExportIsDraft(input.pile) || !input.jobId) return null
  return { kind: 'lien_notice_page', title: input.title, jobIds: [input.jobId], recipientName: input.recipientName?.trim() || null }
}
