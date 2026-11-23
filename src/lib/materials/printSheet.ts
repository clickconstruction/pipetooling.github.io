/**
 * The Print sheet on the Materials page's phone screen (v2.8282, the owner's approved design of 2026-11-22). On a
 * phone the strip's worded presses ran off the screen and a job's own print presses took two rows over its boxes, so
 * one print icon beside the group names opens a sheet that knows where it stands. With a job open it offers that
 * job's labels, its manifest, each reserved run to print again, a new run of stickers and the way to another job.
 * With no job open it offers what the strip's presses offer.
 *
 * The sheet is only a door: every row opens a window that was there before. Pure: the job, its boxes, its reserved
 * runs and the role in, the title and the rows out, each row live or dead with its reason. The sheet is
 * `MaterialsPrintSheet.tsx`.
 */
import { MATERIALS_PRESS_LABELS, type MaterialsPress } from './materialsGroups'
import { onSiteJobNumber, type OnSiteJobNamed } from './onSiteJobWords'
import { PRINT_RESERVED_SAME_WORDS, reservedRunByLine, type ReservedRunPrint } from './reservedPrint'
import { canMintStickers, STICKER_MINT_WHO } from './stickerRun'

/** What a row opens. `reserved` names its run, and whether it prints only the stickers that have not printed yet. */
export type PrintSheetAct =
  | { kind: 'labels' }
  | { kind: 'manifest' }
  | { kind: 'reserved'; runId: string; waiting: boolean }
  | { kind: 'stickers' }
  | { kind: 'another-job' }
  | { kind: 'page-labels' }
  | { kind: 'page-stickers' }

export type PrintSheetRow = {
  key: string
  act: PrintSheetAct
  /** The press's words. */
  label: string
  /** One quiet line under them: what the press opens, or why it is dead. */
  line: string
  dead: boolean
}

export type PrintSheet = { title: string; sub: string; rows: PrintSheetRow[] }

export const PRINT_SHEET_TITLE = 'Print'
export const PRINT_SHEET_LABELS = 'Labels for its boxes'
export const PRINT_SHEET_MANIFEST = 'The manifest'
export const PRINT_SHEET_STICKERS = 'Future stickers'
export const PRINT_SHEET_ANOTHER_JOB = 'Print for another job'
/** Why the labels and the manifest are dead on a job with no box. */
export const PRINT_SHEET_NO_BOX = 'This job has no box yet.'

/** The sheet's title on a job: *Print for job 224*, or *Print for this job* for a job with no number. */
export function jobPrintSheetTitle(job: OnSiteJobNamed | null | undefined): string {
  const number = onSiteJobNumber(job)
  return number ? `Print for job ${number}` : 'Print for this job'
}

/**
 * The sheet with a job open. The labels and the manifest are dead with their reason on a job with no box. Each
 * reserved run has the presses its line has (`ReservedPrintPresses`): what has not printed yet when that is some of
 * it, then every reserved sticker of the run. A role that may not print a run sees those and Future stickers dead with
 * the reason, never missing. Print for another job is last.
 */
export function jobPrintSheet(input: {
  job: OnSiteJobNamed | null | undefined
  /** Live boxes, Unsorted left out: what a label or a manifest page is printed for. */
  boxCount: number
  runs: ReadonlyArray<ReservedRunPrint>
  role: string | null | undefined
  /** Turns a run's day into words, for telling two runs apart. */
  dayWords: (iso: string) => string
}): PrintSheet {
  const { job, boxCount, runs, role } = input
  const noBox = boxCount <= 0
  const mayMint = canMintStickers(role)
  const rows: PrintSheetRow[] = [
    { key: 'labels', act: { kind: 'labels' }, label: PRINT_SHEET_LABELS, line: noBox ? PRINT_SHEET_NO_BOX : 'A label for each box, with its name and its code.', dead: noBox },
    { key: 'manifest', act: { kind: 'manifest' }, label: PRINT_SHEET_MANIFEST, line: noBox ? PRINT_SHEET_NO_BOX : 'One page for each box, to hang on it.', dead: noBox },
  ]
  for (const r of runs) {
    const by = reservedRunByLine(r, runs, input.dayWords)
    const line = mayMint ? [by ? `${by}.` : '', PRINT_RESERVED_SAME_WORDS].filter(Boolean).join(' ') : STICKER_MINT_WHO
    if (r.waiting.length > 0) rows.push({ key: `reserved:${r.run.id}:waiting`, act: { kind: 'reserved', runId: r.run.id, waiting: true }, label: r.waitingLabel, line, dead: !mayMint })
    rows.push({ key: `reserved:${r.run.id}`, act: { kind: 'reserved', runId: r.run.id, waiting: false }, label: r.label, line, dead: !mayMint })
  }
  rows.push({ key: 'stickers', act: { kind: 'stickers' }, label: PRINT_SHEET_STICKERS, line: mayMint ? 'New stickers for boxes that are not in the app yet.' : STICKER_MINT_WHO, dead: !mayMint })
  rows.push({ key: 'another-job', act: { kind: 'another-job' }, label: PRINT_SHEET_ANOTHER_JOB, line: 'Pick a job, then print its labels.', dead: false })
  const name = (job?.job_name ?? '').trim() || (job?.customer_name ?? '').trim()
  return { title: jobPrintSheetTitle(job), sub: name, rows }
}

/** The sheet with no job open: the print presses the strip offers this role, each by its own name. */
export function pagePrintSheet(presses: ReadonlyArray<MaterialsPress>): PrintSheet {
  const rows: PrintSheetRow[] = []
  if (presses.includes('print-labels')) rows.push({ key: 'page-labels', act: { kind: 'page-labels' }, label: MATERIALS_PRESS_LABELS['print-labels'], line: 'Pick a job, then print its labels.', dead: false })
  if (presses.includes('print-stickers')) rows.push({ key: 'page-stickers', act: { kind: 'page-stickers' }, label: MATERIALS_PRESS_LABELS['print-stickers'], line: 'Pick a job, then print stickers for its boxes to come.', dead: false })
  return { title: PRINT_SHEET_TITLE, sub: '', rows }
}
