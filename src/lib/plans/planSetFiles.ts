/**
 * Files on a set of plans (punch list #239, PR 5): the rules and the words behind one Drive subfolder per set and
 * the crew's as-built taken as photos of the marked sheets or a PDF. The folder is Plans › <set name> under the
 * job's folder, made by `plan-set-files` as needed; a set with no link takes the folder's link, so the register
 * mirrors Drive. A batch of photos acts on what is clean and names what it held (`batchWords`), and after the
 * filing says what took and what did not (`batchOutcomeWords`). A mail's files follow its paper the same way, and a
 * file that stayed in Gmail is named instead of sent. Pure.
 */
import { batchOutcomeWords, batchWords, countedLabel, type BatchOutcome, type BatchWords } from '../batchWords'
import { addFileSizeWords } from '../jobs/jobFolderAddFile'

/** The function's cap: a file from the phone or this computer comes in as base64, up to 10 MB. */
export const PLAN_SET_FILE_MAX_BYTES = 10 * 1024 * 1024

/** What the as-built press takes: photos of the marked sheets, or a PDF. */
export const AS_BUILT_ACCEPT = 'image/*,application/pdf'

export type PickedFile = { name: string; size: number; type: string; lastModified?: number }

export type FileKind = 'photo' | 'pdf' | 'other'

export function planSetFileKind(f: Pick<PickedFile, 'name' | 'type'>): FileKind {
  if (f.type.startsWith('image/')) return 'photo'
  if (f.type === 'application/pdf' || /\.pdf$/i.test(f.name)) return 'pdf'
  if (/\.(jpe?g|png|heic|heif|webp|gif)$/i.test(f.name)) return 'photo'
  return 'other'
}

/** Why a picked file is held, or null when it goes. */
export function fileHoldWhy(f: PickedFile): string | null {
  if (f.size > PLAN_SET_FILE_MAX_BYTES) return `over 10 MB (${addFileSizeWords(f.size)})`
  if (planSetFileKind(f) === 'other') return 'not a photo or a PDF'
  return null
}

export type SplitFiles<F extends PickedFile> = { ready: F[]; held: Array<{ file: F; why: string }> }

/** The files that go now and the ones that stay, each with its reason: a hold on one never stops the rest. */
export function splitReadyFiles<F extends PickedFile>(files: ReadonlyArray<F>): SplitFiles<F> {
  const ready: F[] = []
  const held: Array<{ file: F; why: string }> = []
  for (const f of files) {
    const why = fileHoldWhy(f)
    if (why) held.push({ file: f, why })
    else ready.push(f)
  }
  return { ready, held }
}

/**
 * A second pick adds to the first: a phone's camera hands back one shot a press, so three shots of the marked sheets
 * take three presses. The same file picked twice counts once.
 */
export function addPickedFiles<F extends PickedFile>(have: ReadonlyArray<F>, more: ReadonlyArray<F>): F[] {
  const key = (f: PickedFile) => `${f.name}|${f.size}|${f.lastModified ?? ''}`
  const seen = new Set(have.map(key))
  const out = [...have]
  for (const f of more) {
    if (seen.has(key(f))) continue
    seen.add(key(f))
    out.push(f)
  }
  return out
}

/** *3 photos and 1 PDF · 4.2 MB*; *1 photo · 860 KB*; '' for none. */
export function pickedFilesWords(files: ReadonlyArray<PickedFile>): string {
  if (files.length === 0) return ''
  const photos = files.filter((f) => planSetFileKind(f) === 'photo').length
  const pdfs = files.filter((f) => planSetFileKind(f) === 'pdf').length
  const other = files.length - photos - pdfs
  const bits: string[] = []
  if (photos) bits.push(`${photos} ${photos === 1 ? 'photo' : 'photos'}`)
  if (pdfs) bits.push(`${pdfs} ${pdfs === 1 ? 'PDF' : 'PDFs'}`)
  if (other) bits.push(`${other} other ${other === 1 ? 'file' : 'files'}`)
  const what = bits.length <= 1 ? bits.join('') : `${bits.slice(0, -1).join(', ')} and ${bits[bits.length - 1]}`
  return `${what} · ${addFileSizeWords(files.reduce((n, f) => n + f.size, 0))}`
}

function extensionOf(f: Pick<PickedFile, 'name' | 'type'>): string {
  const m = /\.([A-Za-z0-9]{1,5})$/.exec(f.name)
  if (m) return m[1]!.toLowerCase()
  if (f.type === 'application/pdf') return 'pdf'
  if (f.type.startsWith('image/')) return f.type.slice('image/'.length).replace('jpeg', 'jpg')
  return 'bin'
}

/**
 * The name a crew's photo lands under: *As-built · JP972 · 2026-11-02 · 1 of 3.jpg*. A PDF keeps its own name
 * when it has one worth keeping; a phone's *IMG_4411.jpg* does not.
 */
export function asBuiltFileName(jobLabel: string, ymd: string, index1: number, total: number, f: Pick<PickedFile, 'name' | 'type'>): string {
  const ext = extensionOf(f)
  if (planSetFileKind(f) === 'pdf' && !/^(img|image|scan|document|doc|file|photo|pxl|dsc)[_ -]?\d*\.pdf$/i.test(f.name.trim())) return f.name.trim()
  const count = total > 1 ? ` · ${index1} of ${total}` : ''
  return `As-built · ${jobLabel} · ${ymd}${count}.${ext}`
}

/**
 * The as-built press names what it will do: *Add the as-built* with nothing picked; *Add the as-built with 3 files*;
 * with a hold, *Add the as-built with 2 files · 1 held ▸* and the foot; with only held files the as-built still
 * adds, without them, and the foot says why they stay.
 */
export function asBuiltPressWords(ready: number, held: number): BatchWords {
  if (ready + held === 0) return { button: 'Add the as-built', foot: null, dead: false }
  if (ready === 0) return { button: `Add the as-built without the ${held === 1 ? 'file' : 'files'} ▸`, foot: `${held} ${held === 1 ? 'is' : 'are'} held. ${held === 1 ? 'It stays' : 'They stay'} here with the reason. The as-built adds without ${held === 1 ? 'it' : 'them'}.`, dead: false }
  return batchWords({ verb: 'Add the as-built with', ready, held, heldWhy: 'held', noun: ['file', 'files'] })
}

/** *Filing 2 of 5…* while the photos go up one by one. */
export function filingWords(done: number, total: number): string {
  return `Filing ${Math.min(done + 1, total)} of ${total}…`
}

/** After the filing: what landed in the set's folder and what did not, the rows that failed staying with their reason. */
export function filedWords(done: number, failed: number): BatchOutcome {
  return batchOutcomeWords({ verb: 'file', past: 'Filed', done, failed, noun: ['file', 'files'] })
}

/** The press that tries the files that did not land: *File 1 file again*. */
export function fileAgainLabel(n: number): string {
  return `${countedLabel('File', n, ['file', 'files'])} again`
}

/** A file held back when it was picked, still named once the form has closed. */
export function heldBehindLine(name: string, why: string): string {
  return `${name} stayed behind · ${why}`
}

export const PLAN_SET_FILES_WORDS = {
  pick: 'Photos or a PDF',
  pickTitle: 'Take photos of the marked sheets, or pick a PDF',
  change: 'Add more',
  clear: 'Not these',
  addToSet: 'Add photos or a PDF',
  addToSetTitle: 'Take photos of the marked sheets, or pick a PDF, and file them in this as-built’s folder',
  makeFolder: 'Make its folder',
  makeFolderTitle: 'Make this set’s own folder under the job’s Plans folder in Drive, and give the set its link',
  mailFiled: (n: number) => (n === 1 ? 'The mail’s file is in the paper’s folder.' : `The mail’s ${n} files are in the paper’s folder.`),
  mailReadAgain: 'Read the mail’s files again',
  /** Said in the form, while the person can still press Put it on the job. */
  mailNoLineAhead: (n: number) =>
    n === 1 ? 'This mail’s file stays in Gmail for now. Press Put it on the job first and it follows the paper.' : `This mail’s ${n} files stay in Gmail for now. Press Put it on the job first and they follow the paper.`,
} as const

/** A file on a mail's line in Messages: our copy of it, or why it stayed in Gmail. */
export type MailFile = { id: string; name: string; mime: string | null; copied: boolean; leftWhy: string | null }

/** The files we hold a copy of go; the others stay in Gmail and are named. */
export function splitMailFiles(files: ReadonlyArray<MailFile>): { ready: MailFile[]; left: MailFile[] } {
  return { ready: files.filter((f) => f.copied), left: files.filter((f) => !f.copied) }
}

export type MailFilesResult = {
  /** The read of the mail's files failed, with its reason. Nothing else is known then. */
  readFailed: string | null
  landed: number
  failed: ReadonlyArray<{ name: string; why: string }>
  left: ReadonlyArray<Pick<MailFile, 'name' | 'leftWhy'>>
  /** The person typed a link on the paper. */
  linkTyped: boolean
  /** The mail shows this many files, and no line on the job holds it, so none of them could follow. */
  noLineFiles: number
}

const sentence = (s: string): string => (/[.!?]$/.test(s.trim()) ? s.trim() : `${s.trim()}.`)

/** What became of a mail's files once its paper is kept. Green only when nothing stayed behind. */
export function mailFilesWords(r: MailFilesResult): { words: string; tone: 'success' | 'warning' } {
  if (r.readFailed) return { words: `The mail’s files did not read: ${sentence(r.readFailed)} The paper is kept.`, tone: 'warning' }
  if (r.noLineFiles > 0) return { words: r.noLineFiles === 1 ? 'The mail’s file stayed in Gmail, since no line on the job holds this mail.' : `The mail’s ${r.noLineFiles} files stayed in Gmail, since no line on the job holds this mail.`, tone: 'warning' }
  const bits: string[] = []
  if (r.landed > 0) bits.push(PLAN_SET_FILES_WORDS.mailFiled(r.landed))
  for (const f of r.left) bits.push(`${f.name} stays in Gmail, ${f.leftWhy === 'too_big' ? 'too big for us to keep' : 'never copied here'}.`)
  if (r.failed.length > 0) bits.push(`${r.failed.length === 1 ? 'One file did not land' : `${r.failed.length} files did not land`}: ${r.failed.map((f) => sentence(`${f.name}: ${f.why}`)).join(' ')}`)
  if (bits.length === 0) return { words: r.linkTyped ? 'The mail had no file to keep. The paper holds its link.' : 'The mail had no file to keep.', tone: 'success' }
  return { words: bits.join(' '), tone: r.failed.length > 0 || r.left.length > 0 ? 'warning' : 'success' }
}
