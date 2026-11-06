/**
 * The record (punch list #237, PR 3): a stage's checklist filed as a document on the job. When the last question is
 * answered the database files `stage_checklist_records` by itself (migration 20261106050000, `stage_checklist_record_settle`,
 * the SQL twin of `questionWaitsOn`): one row per stage and version with the rows as they stood, a record id
 * `CL-<job number>-<n>` counted per job, the last answer's stamp as the filing time, and the PDF the photo-save sweep
 * draws into the job's Drive folder, each version its own file. Filed means immutable: adding a check, skipping a
 * question, taking an answer back or the office's **Amend** marks the filed record *amended*, the stage is open again,
 * and the next completion files version n+1; version n stays readable and printable.
 *
 * Pure: the row as the client reads it, where a stage stands against its records, the words of the filed paper, the
 * read-out and Amend, and the paper's HTML for Print. The io is `stageChecklistRecordIo.ts`.
 */
import { formatDenverCalendarDayShort, formatDenverTimeOnly } from '../../utils/dateUtils'
import { PICK_WORDS, isStageChecklistPick, questionWaitsOn, signatureStands, stampWords, type ChecklistSignatureMode, type StageChecklistAnswer, type StageChecklistKind, type StageChecklistPick, type StageChecklistQuestion } from './stageChecklist'

/** One row of the snapshot: the question and its answer as they stood at filing. */
export interface RecordRow {
  questionId: string
  scope: 'company' | 'job'
  words: string
  sheet: string | null
  why: string | null
  addedBy: string | null
  pick: StageChecklistPick
  note: string
  by: string
  at: string | null
  signature: { mode: ChecklistSignatureMode; printedName: string; signedAt: string; storagePath: string | null } | null
  photo: { fileName: string; driveFileId: string | null; filedAt: string | null } | null
}

export interface RecordSkipped {
  words: string
  by: string
  why: string
}

export type RecordState = 'filed' | 'amended'

export interface ChecklistRecord {
  id: string
  jobId: string
  fixtureId: string
  recordNo: number
  version: number
  recordId: string
  stageName: string
  kind: StageChecklistKind
  state: RecordState
  filedAt: string
  filedBy: string
  rows: RecordRow[]
  skipped: RecordSkipped[]
  answerCount: number
  signedCount: number
  noCount: number
  amendedAt: string | null
  amendedBy: string
  amendWhy: string | null
  pdf: { fileName: string | null; driveFileId: string | null; filedAt: string | null; failWhy: string | null }
}

/** A record row as the table keeps it. */
export interface RecordRowDb {
  id: string
  job_id: string
  fixture_id: string
  record_no: number
  version: number
  record_id: string
  stage_name: string
  stage_kind: string
  state: string
  filed_at: string
  filed_by_name?: string | null
  snapshot: unknown
  answer_count: number
  signed_count: number
  no_count: number
  amended_at?: string | null
  amended_by_name?: string | null
  amend_why?: string | null
  pdf_file_name?: string | null
  pdf_drive_file_id?: string | null
  pdf_filed_at?: string | null
  pdf_fail_why?: string | null
}

function str(v: unknown): string {
  return typeof v === 'string' ? v : ''
}
function strOrNull(v: unknown): string | null {
  return typeof v === 'string' && v ? v : null
}

/** The snapshot's rows as the kernel reads them; a row the snapshot wrote with no pick is left out (it cannot be: a filed list is complete). */
export function recordRowsFrom(snapshot: unknown): { rows: RecordRow[]; skipped: RecordSkipped[] } {
  const s = (snapshot && typeof snapshot === 'object' ? snapshot : {}) as { rows?: unknown; skipped?: unknown }
  const rows: RecordRow[] = []
  for (const raw of Array.isArray(s.rows) ? s.rows : []) {
    const r = (raw ?? {}) as Record<string, unknown>
    if (!isStageChecklistPick(r.pick)) continue
    const sig = r.signature && typeof r.signature === 'object' ? (r.signature as Record<string, unknown>) : null
    const photo = r.photo && typeof r.photo === 'object' ? (r.photo as Record<string, unknown>) : null
    rows.push({
      questionId: str(r.questionId),
      scope: r.scope === 'job' ? 'job' : 'company',
      words: str(r.words),
      sheet: strOrNull(r.sheet),
      why: strOrNull(r.why),
      addedBy: strOrNull(r.addedBy),
      pick: r.pick,
      note: str(r.note),
      by: str(r.by),
      at: strOrNull(r.at),
      signature: sig && typeof sig.signedAt === 'string' ? { mode: sig.mode === 'draw' ? 'draw' : 'type', printedName: str(sig.printedName), signedAt: sig.signedAt, storagePath: strOrNull(sig.storagePath) } : null,
      photo: photo && typeof photo.fileName === 'string' ? { fileName: photo.fileName, driveFileId: strOrNull(photo.driveFileId), filedAt: strOrNull(photo.filedAt) } : null,
    })
  }
  const skipped: RecordSkipped[] = []
  for (const raw of Array.isArray(s.skipped) ? s.skipped : []) {
    const k = (raw ?? {}) as Record<string, unknown>
    if (typeof k.words !== 'string' || !k.words) continue
    skipped.push({ words: k.words, by: str(k.by), why: str(k.why) })
  }
  return { rows, skipped }
}

export function recordFromRow(r: RecordRowDb): ChecklistRecord {
  const { rows, skipped } = recordRowsFrom(r.snapshot)
  return {
    id: r.id,
    jobId: r.job_id,
    fixtureId: r.fixture_id,
    recordNo: Number(r.record_no) || 0,
    version: Number(r.version) || 1,
    recordId: r.record_id,
    stageName: r.stage_name,
    kind: r.stage_kind === 'rough_in' || r.stage_kind === 'top_out' ? r.stage_kind : 'trim_set',
    state: r.state === 'amended' ? 'amended' : 'filed',
    filedAt: r.filed_at,
    filedBy: r.filed_by_name ?? '',
    rows,
    skipped,
    answerCount: Number(r.answer_count) || rows.length,
    signedCount: Number(r.signed_count) || 0,
    noCount: Number(r.no_count) || 0,
    amendedAt: r.amended_at ?? null,
    amendedBy: r.amended_by_name ?? '',
    amendWhy: r.amend_why ?? null,
    pdf: { fileName: r.pdf_file_name ?? null, driveFileId: r.pdf_drive_file_id ?? null, filedAt: r.pdf_filed_at ?? null, failWhy: r.pdf_fail_why ?? null },
  }
}

// ── Where a stage stands against its records ─────────────────────────────────

/** A stage's records, newest version first. */
export function recordsOfStage(records: readonly ChecklistRecord[], fixtureId: string): ChecklistRecord[] {
  return records.filter((r) => r.fixtureId === fixtureId).sort((a, b) => b.version - a.version)
}

/** The filed record the stage reads as paper, or null while it is open (never filed, or its latest version amended). */
export function filedRecordOf(records: readonly ChecklistRecord[], fixtureId: string): ChecklistRecord | null {
  const latest = recordsOfStage(records, fixtureId)[0]
  return latest && latest.state === 'filed' ? latest : null
}

/** The latest amended record, when the stage is open again after a filing: the sheet says *amending v2*. */
export function amendingRecordOf(records: readonly ChecklistRecord[], fixtureId: string): ChecklistRecord | null {
  const latest = recordsOfStage(records, fixtureId)[0]
  return latest && latest.state === 'amended' ? latest : null
}

/** True when the stage reads as paper. */
export function stageIsFiled(records: readonly ChecklistRecord[], fixtureId: string): boolean {
  return filedRecordOf(records, fixtureId) != null
}

// ── The words ────────────────────────────────────────────────────────────────

/** *Oct 15 · 4:02 pm* in the company's calendar; '' without a time. */
export function filedWhenWords(iso: string | null | undefined): string {
  const ms = iso ? Date.parse(iso) : NaN
  if (!Number.isFinite(ms)) return ''
  return `${formatDenverCalendarDayShort(ms)} · ${formatDenverTimeOnly(ms).toLowerCase()}`
}

/** *4 answers, 1 signed · 1 No*; *1 answer*; the counts a header prints. */
export function recordCountWords(r: Pick<ChecklistRecord, 'answerCount' | 'signedCount' | 'noCount'>): string {
  const answers = r.answerCount === 1 ? '1 answer' : `${r.answerCount} answers`
  const signed = r.signedCount > 0 ? `, ${r.signedCount} signed` : ''
  const nos = r.noCount > 0 ? ` · ${r.noCount} No` : ''
  return `${answers}${signed}${nos}`
}

/** Where the PDF stands: in the folder, on its way, or held with its reason. */
export function recordPdfWords(r: Pick<ChecklistRecord, 'pdf'>): string {
  if (r.pdf.driveFileId) return "PDF in the job's Drive folder"
  if (r.pdf.failWhy) return `PDF not filed yet: ${r.pdf.failWhy}`
  return "PDF on its way to the job's Drive folder"
}

/** The PDF's address in Drive, or null while it waits. */
export function recordPdfUrl(r: Pick<ChecklistRecord, 'pdf'>): string | null {
  return r.pdf.driveFileId ? `https://drive.google.com/file/d/${encodeURIComponent(r.pdf.driveFileId)}/view` : null
}

/** The filed sheet's header: *Record CL-1042-1 · v1 · Oct 15 · 4:02 pm · 4 answers, 1 signed · PDF in the job's Drive folder*. */
export function filedHeaderWords(r: ChecklistRecord): string {
  return [`Record ${r.recordId}`, `v${r.version}`, filedWhenWords(r.filedAt), recordCountWords(r), recordPdfWords(r)].filter(Boolean).join(' · ')
}

/** The sheet's title once filed: *Trim Set · filed*. */
export function filedTitleWords(stageName: string): string {
  return `${stageName} · filed`
}

/** The toast and the paper's first line the moment it files: *Filed as record CL-1042-1 with the last answer.* */
export function filedJustNowWords(r: Pick<ChecklistRecord, 'recordId'>): string {
  return `Filed as record ${r.recordId} with the last answer.`
}

/** The paper's foot: what filing did, and what the office acts on. */
export function filedFootWords(stageName: string, noCount: number): string {
  const ready = `${stageName} now reads ready on the Pipeline.`
  if (noCount === 0) return ready
  return `${ready} ${noCount === 1 ? 'One check reads No' : `${noCount} checks read No`}; the office acts on that.`
}

export const FILED_PAPER_WORDS = {
  /** Under the paper, over Close. */
  foot: 'Filed. Nothing here changes. The office can amend it as a new version.',
  /** Over a paper the office amended, on the open sheet. */
  amending: (version: number) => `Amending v${version}. The filed version stays; the next completion files v${version + 1}.`,
  /** A row's photo on the paper. */
  photoInDrive: "photo in the job's Drive folder",
  photoOnItsWay: 'photo on its way to Drive',
  /** The line under the rows for the company questions left off this job. */
  skippedLead: 'Not on this job:',
} as const

/** The read-out's chip once filed: *Filed · CL-1042-1*; the stage's line under it. */
export function filedChipWords(r: Pick<ChecklistRecord, 'recordId'>): string {
  return `Filed · ${r.recordId}`
}

/** *Amending v2 · 3 of 6* on the read-out's chip while the stage is open after a filing. */
export function amendingChipWords(r: Pick<ChecklistRecord, 'version'>, answered: number, asked: number): string {
  return `Amending v${r.version} · ${answered} of ${asked}`
}

/** The read-out's line under a filed stage: *Record CL-1042-1 · v1 · Oct 15 · 4:02 pm · 4 answers, 1 signed · PDF in the job's Drive folder*. */
export function recordLineWords(r: ChecklistRecord): string {
  return filedHeaderWords(r)
}

/** The versions line under a stage with more than one: *Versions: CL-1042-1 v1 (amended by Jo Sample · Nov 5 · 4:10 pm: the roofer came back) · CL-1042-3 v2*. */
export function versionsLineWords(records: readonly ChecklistRecord[]): string {
  if (records.length < 2) return ''
  const parts = [...records]
    .sort((a, b) => a.version - b.version)
    .map((r) => (r.state === 'amended' ? `${r.recordId} v${r.version} (amended by ${stampWords(r.amendedBy, r.amendedAt)}${r.amendWhy ? `: ${r.amendWhy}` : ''})` : `${r.recordId} v${r.version}`))
  return `Versions: ${parts.join(' · ')}`
}

/** The two-press Amend: the hint says what it does before the confirm, and the reason it keeps. */
export const AMEND_WORDS = {
  press: 'Amend',
  hint: 'The filed version stays as it is. The stage opens again, and the next completion files a new version with a new record number. Say why.',
  label: 'Why the record is amended',
  placeholder: 'Why, like the roofer came back',
  confirm: 'Amend as a new version',
  keep: 'Keep it filed',
  refused: 'That record was not amended. It may be amended already, or this job may not be yours to change.',
} as const

export const AMEND_WHY_MIN_CHARS = 3
export const AMEND_WHY_MAX_CHARS = 200

/** What stops an amend, in words, or null: it needs its reason. */
export function amendProblem(why: string): string | null {
  return why.trim().length < AMEND_WHY_MIN_CHARS ? 'Say why the record is amended.' : null
}

/** The toast once amended: *Amended. Trim Set is open again as v2.* */
export function amendedToastWords(stageName: string, r: Pick<ChecklistRecord, 'version'>): string {
  return `Amended. ${stageName} is open again; the next completion files v${r.version + 1}.`
}

export const PRINT_WORDS = {
  press: 'Print the checklists',
  /** The print window was blocked. */
  blocked: 'The print window was blocked. Allow pop-ups for this site and press Print the checklists again.',
  /** No stage to print. */
  nothing: 'No stage has a checklist to print yet.',
} as const

// ── The paper ────────────────────────────────────────────────────────────────

/** A row on the paper, from a filed record's snapshot or from a live row of an open stage. */
export interface PaperRow {
  glyph: string
  words: string
  sheet: string | null
  /** *Yes · Luis Ortega · Nov 1 · 9:14 am* */
  answer: string
  signedBy: string | null
  signatureMode: ChecklistSignatureMode | null
  signatureStoragePath: string | null
  note: string
  photo: string
  isNo: boolean
}

export function pickGlyph(pick: StageChecklistPick | null): string {
  return pick === 'yes' ? '✓' : pick === 'no' ? '✗' : pick === 'not_here' ? '—' : '☐'
}

export function paperRowFromRecordRow(r: RecordRow): PaperRow {
  return {
    glyph: pickGlyph(r.pick),
    words: r.words,
    sheet: r.sheet,
    answer: `${PICK_WORDS[r.pick]} · ${stampWords(r.by, r.at)}`,
    signedBy: r.signature?.printedName ?? null,
    signatureMode: r.signature?.mode ?? null,
    signatureStoragePath: r.signature?.storagePath ?? null,
    note: r.note,
    photo: r.photo ? (r.photo.driveFileId ? FILED_PAPER_WORDS.photoInDrive : FILED_PAPER_WORDS.photoOnItsWay) : '',
    isNo: r.pick === 'no',
  }
}

/** A paper row from a live question and its answer, for an open stage on the printed paper: *open* where there is no pick yet. */
export function paperRowFromLive(q: StageChecklistQuestion, a: StageChecklistAnswer | null | undefined): PaperRow {
  const waits = questionWaitsOn(q, a)
  const pick = a?.pick && waits !== 'pick' ? a.pick : null
  const sig = signatureStands(q, a)
  const answer = pick ? `${PICK_WORDS[pick]}${waits === 'signature' ? ', not signed yet' : waits === 'photo' ? ', no photo yet' : ''} · ${stampWords(a?.answeredBy, a?.answeredAt)}` : 'open'
  return {
    glyph: pickGlyph(pick),
    words: q.words,
    sheet: q.sheet ?? null,
    answer,
    signedBy: sig?.printedName ?? null,
    signatureMode: sig?.mode ?? null,
    signatureStoragePath: sig?.storagePath ?? null,
    note: a?.note ?? '',
    photo: a?.photo ? (a.photo.state === 'filed' ? FILED_PAPER_WORDS.photoInDrive : FILED_PAPER_WORDS.photoOnItsWay) : '',
    isNo: pick === 'no',
  }
}

/** The paper's job line: *Job 1088 · ZZ TEST Riders Walk*; the number as the record id names it. */
export function paperJobLabel(job: { id: string; hcp_number?: string | null; click_number?: string | null; job_name?: string | null }): string {
  const number = (job.hcp_number ?? '').trim() || (job.click_number ?? '').trim() || job.id.slice(0, 8)
  const name = (job.job_name ?? '').trim()
  return name ? `Job ${number} · ${name}` : `Job ${number}`
}

/** *Not on this job: Is the grease interceptor set (the owner took it out, Pat Sample)* */
export function skippedLineWords(skipped: readonly RecordSkipped[]): string {
  if (skipped.length === 0) return ''
  return `${FILED_PAPER_WORDS.skippedLead} ${skipped.map((s) => `${s.words.replace(/\?$/, '')} (${s.why}${s.by ? `, ${s.by}` : ''})`).join(' · ')}`
}

/** One stage on the printed paper: filed from its record, or open with its live rows and what is left. */
export interface PaperStage {
  name: string
  /** *Record CL-1042-1 · v1 · …* for a filed stage; *Open · 3 of 6 answered* for one still open; *No questions yet* with no list. */
  standing: string
  rows: PaperRow[]
  skipped: string
  foot: string
}

export interface PaperInput {
  jobLabel: string
  customer: string | null
  address: string | null
  printedAtIso: string
  stages: PaperStage[]
}

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

/**
 * The paper as HTML for the print window: the job's three stages on light Letter paper, every answer with its name and
 * time, a signature where one was required (the printed name in the cursive face; the ink is on the PDF in Drive), the
 * record number once filed. What an inspector or the GC reads; the filed PDF is the same paper.
 */
export function buildChecklistPaperHtml(input: PaperInput): string {
  const stages = input.stages
    .map((s) => {
      const rows = s.rows
        .map(
          (r, i) => `<div class="row">
  <span class="glyph${r.isNo ? ' no' : ''}">${esc(r.glyph)}</span>
  <div>
    <div class="words">${i + 1}. ${esc(r.words)}${r.sheet ? ` <span class="muted">· ${esc(r.sheet)}</span>` : ''}</div>
    <div class="meta"><span>${esc(r.answer)}</span>${r.signedBy ? `<span class="ink">${esc(r.signedBy)}</span>` : ''}${r.photo ? `<span>· ${esc(r.photo)}</span>` : ''}${r.note ? `<span class="${r.isNo ? 'no' : ''}">· ${esc(r.note)}</span>` : ''}</div>
  </div>
</div>`,
        )
        .join('\n')
      return `<section class="stage">
  <h2>${esc(s.name)} <span class="standing">${esc(s.standing)}</span></h2>
  ${rows || '<p class="muted">No questions on this stage.</p>'}
  ${s.skipped ? `<p class="muted skipped">${esc(s.skipped)}</p>` : ''}
  ${s.foot ? `<p class="foot">${esc(s.foot)}</p>` : ''}
</section>`
    })
    .join('\n')
  return `<!doctype html>
<html lang="en" data-theme="light">
<head>
<meta charset="utf-8">
<title>Stage checklists · ${esc(input.jobLabel)}</title>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Great+Vibes&display=swap">
<style>
  @page { size: Letter; margin: 0.6in; }
  body { margin: 0; font-family: Georgia, "Times New Roman", serif; color: #111; background: #fff; font-size: 11pt; }
  h1 { font-size: 16pt; margin: 0 0 0.15rem; }
  .job { font-size: 10pt; color: #555; margin: 0 0 1rem; }
  .stage { margin: 0 0 1.2rem; page-break-inside: avoid; }
  h2 { font-size: 13pt; margin: 0 0 0.3rem; border-bottom: 1px solid #999; padding-bottom: 0.2rem; }
  .standing { font-size: 9.5pt; font-weight: normal; color: #555; margin-left: 0.5rem; }
  .row { display: grid; grid-template-columns: 1.3rem 1fr; gap: 0.1rem 0.5rem; padding: 0.3rem 0; border-top: 1px solid #e5e5e5; }
  .glyph { font-weight: 700; }
  .no { color: #b91c1c; }
  .words { font-size: 11pt; }
  .meta { font-size: 9.5pt; color: #555; display: flex; gap: 0.5rem; flex-wrap: wrap; align-items: baseline; }
  .ink { font-family: "Great Vibes", cursive; font-size: 15pt; color: #111; }
  .muted { font-size: 9.5pt; color: #555; }
  .skipped { margin: 0.4rem 0 0; }
  .foot { font-size: 9.5pt; margin: 0.5rem 0 0; border-top: 1px solid #999; padding-top: 0.3rem; }
  .printed { font-size: 8.5pt; color: #777; margin-top: 1.5rem; }
</style>
</head>
<body>
<h1>Stage checklists</h1>
<p class="job">${esc(input.jobLabel)}${input.customer ? ` · ${esc(input.customer)}` : ''}${input.address ? ` · ${esc(input.address)}` : ''}</p>
${stages}
<p class="printed">Printed ${esc(filedWhenWords(input.printedAtIso))}. Every answer is stamped with the person's name and the time; a signed answer carries the signer's name, and the ink is on the record's PDF in the job's Drive folder.</p>
</body>
</html>`
}
