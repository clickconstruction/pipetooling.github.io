/**
 * Equipment pre-use check (punch list #270): the pure kernel. The types the phone and the fleet board draw, the gauges
 * (a tank, a sight glass, a dipstick, a dial) and their words, the walk's rules (the next open row, the verdict, the
 * line a machine reads today), the leaving check, the plan (a machine on a job's day), the pair per day with the hours
 * between, rentals, and the names a photo files under. No reads here: `machinesIo.ts` maps the rows in and writes out.
 */

export type MachineKind = 'excavator' | 'directional_drill' | 'trencher' | 'skid_steer' | 'compactor' | 'trailer' | 'other'

export const MACHINE_KIND_WORDS: Record<MachineKind, string> = {
  excavator: 'excavator',
  directional_drill: 'directional drill',
  trencher: 'trencher',
  skid_steer: 'skid steer',
  compactor: 'compactor',
  trailer: 'trailer',
  other: 'machine',
}

export interface Machine {
  id: string
  /** The name the crew says: E-12, D-3. */
  unitLabel: string
  make: string
  model: string
  kind: MachineKind
  /** The template its gauges and questions come from, or null for its own alone. */
  templateId: string | null
  /** The label's eight characters. */
  code: string
  /** The job that holds it, or null in the yard. */
  jobId: string | null
  jobWords: string | null
  heldSince: string | null
  /** The gauges this machine has, in the order the crew reads them; each drawn the way it looks on the machine. */
  levels: LevelDef[]
  /** A rented machine is known by its agreement; null when it is ours. */
  rental: Rental | null
  /** The machine's own Drive folder once the sweep has made it. */
  driveLink: string | null
}

/**
 * A rented machine: the checks at pickup and at return are the evidence against the rental company's damage claim,
 * and the fleet board says when it is due back.
 */
export interface Rental {
  /** Who it is from: Sunbelt, United, Herc. */
  from: string
  agreementNo: string
  /** The day it went out, YYYY-MM-DD. */
  outOn: string
  /** The day it is due back, YYYY-MM-DD, or empty while open-ended. */
  dueBack: string
}

/**
 * Two checks bracket a shift. The pre-use walk is the safety check, asked of the person about to run it. The leaving
 * check is short and asks only what using the machine changes: hours, levels, anything new wrong, and how it was
 * left, so a problem found at four gets the night to be fixed and damage has a window.
 */
export type CheckKind = 'pre' | 'post'
export const CHECK_KIND_WORDS: Record<CheckKind, { title: string; short: string; lead: string }> = {
  pre: { title: 'Pre-use check', short: 'pre-use', lead: 'Walk around' },
  post: { title: 'Leaving it', short: 'leaving', lead: 'Before you go' },
}

export interface MachineQuestion {
  id: string
  /** A template's list, or one machine's extra (`machineId` set); both null is every machine's. */
  templateId: string | null
  machineId: string | null
  words: string
  /** A No on this one holds the machine. */
  holdsMachine: boolean
  /** Which check asks it: the morning walk, the leaving check, or both. */
  when: CheckKind | 'both'
}

export type MachinePick = 'yes' | 'no' | 'not_here'

export interface Answer {
  questionId: string
  pick: MachinePick
  note: string
  /** The No's photo, a `machine_check_photos` id. */
  photoId: string | null
  at: string
}

/**
 * A level is kept as how full the gauge reads, 0 to 100, set by dragging a gauge drawn the way the real one is: a fuel
 * tank fills in quarters, a sight glass has a line the oil should sit on, a dipstick has two marks, a dial swings a
 * needle over a red and a green zone. Which gauges a machine has, and what each looks like, is the machine's own list
 * (`Machine.levels`), so the crew sees the gauge they are standing in front of. The words come from where the level
 * sits against the gauge's own marks, so a guess at the tank reads *about ⅜* and a needle reads *in the red*.
 */
export type Levels = Record<string, number | undefined>
export type GaugeLook = 'tank' | 'glass' | 'stick' | 'dial'
export interface LevelMark {
  /** Where on the gauge, 0 at the bottom (or the dial's left) and 100 at the top (or its right). */
  at: number
  label: string
  /** The line the level should sit on (a sight glass's line, a dipstick's FULL). */
  line?: boolean
}
export interface LevelDef {
  /** The key the check stores the reading under: `fuel`, `hydraulic`, or a minted one. */
  key: string
  name: string
  look: GaugeLook
  marks: readonly LevelMark[]
  /** Below this the level reads low; on a dial it is where the red zone ends. */
  lowBelow: number
  /** The gauge's fill colour, the fluid's own. */
  color: string
  /** Where on the machine to read it, in the crew's words. */
  where: string
}

export const GAUGE_LOOK_WORDS: Record<GaugeLook, { name: string; how: string }> = {
  tank: { name: 'Tank', how: 'fills in quarters, E to F' },
  glass: { name: 'Sight glass', how: 'a window with a line the oil sits on' },
  stick: { name: 'Dipstick', how: 'a stick with ADD and FULL' },
  dial: { name: 'Dial', how: 'a needle over a red and a green zone' },
}
export const GAUGE_LOOKS: readonly GaugeLook[] = ['tank', 'glass', 'stick', 'dial']

const PRESET_MARKS: Record<GaugeLook, { marks: readonly LevelMark[]; lowBelow: number }> = {
  tank: { marks: [{ at: 0, label: 'E' }, { at: 25, label: '¼' }, { at: 50, label: '½' }, { at: 75, label: '¾' }, { at: 100, label: 'F' }], lowBelow: 30 },
  glass: { marks: [{ at: 30, label: 'Low' }, { at: 65, label: 'The line', line: true }], lowBelow: 55 },
  stick: { marks: [{ at: 35, label: 'ADD' }, { at: 75, label: 'FULL', line: true }], lowBelow: 35 },
  dial: { marks: [{ at: 0, label: 'E' }, { at: 100, label: 'F' }], lowBelow: 30 },
}

/** The fluid's own colour, from the gauge's name. */
export function fluidColor(name: string): string {
  const n = name.toLowerCase()
  if (n.includes('fuel') || n.includes('diesel') || n.includes('gas')) return '#f59e0b'
  if (n.includes('hydraulic')) return '#2563eb'
  if (n.includes('engine') || n.includes('motor')) return '#92400e'
  if (n.includes('coolant') || n.includes('radiator')) return '#16a34a'
  if (n.includes('drilling') || n.includes('mud') || n.includes('water')) return '#0891b2'
  if (n.includes('def')) return '#7c3aed'
  return '#db2777'
}

/** A gauge of one look with the marks that look starts with; the machine's list can keep or change them. */
export function gaugePreset(look: GaugeLook, name: string, where = '', key?: string): LevelDef {
  const p = PRESET_MARKS[look]
  return { key: key ?? newId('g'), name, look, marks: p.marks, lowBelow: p.lowBelow, color: fluidColor(name), where }
}

/** The gauges a kind of machine usually has; a machine's own list starts here and the owner edits it. */
export function defaultLevels(kind: MachineKind): LevelDef[] {
  switch (kind) {
    case 'directional_drill':
      return [
        gaugePreset('dial', 'Fuel', 'Dial on the operator panel', 'fuel'),
        gaugePreset('dial', 'Hydraulic oil', 'Dial on the operator panel, beside fuel', 'hydraulic'),
        gaugePreset('stick', 'Engine oil', 'Dipstick under the engine cover', 'engine_oil'),
        gaugePreset('tank', 'Drilling fluid', 'Mix tank on the trailer', 'drilling_fluid'),
      ]
    case 'trailer':
      return []
    case 'other':
      return [gaugePreset('tank', 'Fuel', '', 'fuel'), gaugePreset('stick', 'Engine oil', '', 'engine_oil')]
    default:
      return [
        gaugePreset('tank', 'Fuel', 'Gauge on the dash', 'fuel'),
        gaugePreset('glass', 'Hydraulic oil', 'Sight glass on the tank, behind the cab', 'hydraulic'),
        gaugePreset('stick', 'Engine oil', 'Dipstick under the side hood', 'engine_oil'),
        gaugePreset('glass', 'Coolant', 'Overflow bottle by the radiator', 'coolant'),
      ]
  }
}

const EIGHTHS = ['empty', '⅛', '¼', '⅜', '½', '⅝', '¾', '⅞', 'full'] as const

/** What the level reads in words, against the gauge's own marks, and whether it is low. */
export function levelWords(def: LevelDef, value: number | undefined): { word: string; low: boolean } {
  if (value == null) return { word: 'not read', low: false }
  const v = Math.max(0, Math.min(100, value))
  const low = v < def.lowBelow
  if (def.look === 'tank') {
    const i = Math.round(v / 12.5)
    const word = EIGHTHS[i] ?? 'full'
    const exact = Math.abs(v - i * 12.5) < 2
    return { word: `${exact || i === 0 || i === 8 ? '' : 'about '}${word}${low ? ' · low' : ''}`, low }
  }
  if (def.look === 'dial') {
    if (low) return { word: v < def.lowBelow / 2 ? 'deep in the red · low' : 'in the red · low', low }
    if (v - def.lowBelow <= 8) return { word: 'just out of the red', low: false }
    if (v >= 92) return { word: 'full, in the green', low: false }
    return { word: 'in the green', low: false }
  }
  const line = def.marks.find((m) => m.line)
  const floor = def.marks.find((m) => !m.line)
  if (line && Math.abs(v - line.at) <= 5) return { word: def.look === 'stick' ? 'at FULL' : 'on the line', low: false }
  if (line && v > line.at) return { word: def.look === 'stick' ? 'over FULL' : 'above the line', low: false }
  if (floor && v < floor.at) return { word: def.look === 'stick' ? 'below ADD · low' : 'below Low · low', low: true }
  if (line && line.at - v > 20) return { word: def.look === 'stick' ? 'near ADD · low' : 'well below the line · low', low: true }
  return { word: def.look === 'stick' ? 'between the marks' : low ? 'a bit below the line · low' : 'just under the line', low }
}

export type ShotKey = 'meter' | 'front' | 'side' | 'back' | 'wrong'
export const SHOT_WORDS: Record<ShotKey, string> = { meter: 'Hour meter', front: 'Front', side: 'One side', back: 'Back', wrong: 'Anything wrong' }
export const SHOT_ORDER: readonly ShotKey[] = ['meter', 'front', 'side', 'back', 'wrong']

export type Verdict = 'safe' | 'held' | 'unfinished'

/** A `machine_check_photos` row as the sheet draws it; `shot` is a ShotKey, `gauge:<level key>` or `no:<question id>`. */
export interface MachinePhoto {
  id: string
  shot: string
  fileName: string
  /** A signed or object URL to draw, when the sheet has one. */
  src: string | null
  driveFileId: string | null
  filedAt: string | null
  failWhy: string | null
}

export interface MachineCheck {
  id: string
  kind: CheckKind
  machineId: string
  jobId: string | null
  jobWords: string | null
  day: string
  byName: string
  startedAt: string
  signedAt: string | null
  verdict: Verdict
  answers: Answer[]
  levels: Levels
  hours: number | null
  /** The check's photos: the shots, a gauge's, a No's. The sweep files each into the machine's Drive folder. */
  photos: MachinePhoto[]
  /** The leaving check's last answer: where the machine is tonight. */
  leftWhere: LeftWhere | null
  /** Dispatch's word on a held machine. */
  runAnyway: { byName: string; at: string } | null
  /** When the hold was sent to Dispatch's inbox (a real request row in the spike). */
  dispatchedAt: string | null
}

export type LeftWhere = 'job' | 'yard' | 'other'
export const LEFT_WHERE_WORDS: Record<LeftWhere, string> = { job: 'On the job', yard: 'Back to the yard', other: 'Going to another job' }

/**
 * Dispatch's plan: when a job goes on someone's day, the machines that ride with it go on too. An assignment is one
 * machine on one job on one day, with who brings it. The phone's morning asks whether it arrived; the answer is kept
 * here. The machine's place (`Machine.jobId`) is a separate fact the walk and the leaving check move.
 */
export type ArrivalAnswer = 'here' | 'later' | 'not_coming'
export interface MachineAssignment {
  id: string
  machineId: string
  jobId: string
  jobWords: string
  /** YYYY-MM-DD */
  day: string
  /** Who brings it, in the office's words; empty when it is already on the job. */
  broughtBy: string
  answer: ArrivalAnswer | null
  answeredAt: string | null
  /** Why it is not coming, for Dispatch. */
  why: string
}

export function newId(prefix: string): string {
  const rnd = typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`
  return `${prefix}-${rnd}`
}

/** A code for a machine added at the label: eight letters and digits from its id. */
export function machineCode(id: string): string {
  return id.replace(/[^0-9a-z]/gi, '').toUpperCase().padEnd(8, 'X').slice(-8)
}

/* ------------------------------------------------------------------ the rules (pure) */

export function machineName(m: { unitLabel: string; make: string; model: string }): string {
  return `${m.unitLabel} · ${m.make} ${m.model}`
}

export function questionsFor(questions: readonly MachineQuestion[], m: Machine, kind: CheckKind = 'pre'): MachineQuestion[] {
  return questions.filter((x) => (x.when === kind || x.when === 'both') && ((x.templateId === null && x.machineId === null) || (x.templateId !== null && x.templateId === m.templateId) || x.machineId === m.id))
}

/**
 * The blanks a template hands the crew, for the office choosing one in the block editor: its gauges by name and how
 * many stops each check asks (the template's own and every machine's), so the office sees the check will match.
 */
export function templateBlanksWords(levels: readonly LevelDef[], questions: readonly MachineQuestion[], templateId: string): string {
  const names = levels.map((l) => l.name)
  const gauges = names.length === 0 ? 'No gauges' : names.length === 1 ? names[0] : `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`
  const mine = questions.filter((q) => (q.templateId === null && q.machineId === null) || q.templateId === templateId)
  const pre = mine.filter((q) => q.when !== 'post').length
  const post = mine.filter((q) => q.when !== 'pre').length
  return `${gauges} · ${pre} ${pre === 1 ? 'stop' : 'stops'} before it runs, ${post} when leaving`
}

/* ------------------------------------------------------------------ the plan: machines on a job's day */

export function assignmentsFor(assignments: readonly MachineAssignment[], jobId: string, day: string): MachineAssignment[] {
  return assignments.filter((a) => a.jobId === jobId && a.day === day)
}

/** The other job this machine is planned on the same day, if any: the double-booking the editor shows red. */
export function assignmentClash(assignments: readonly MachineAssignment[], machineId: string, day: string, jobId: string): MachineAssignment | null {
  return assignments.find((a) => a.machineId === machineId && a.day === day && a.jobId !== jobId) ?? null
}

export interface MachineOnJob {
  machine: Machine
  /** Dispatch's plan for today, when there is one. */
  assignment: MachineAssignment | null
  /** Already sitting on the job (its place), whatever the plan says. */
  placed: boolean
}

/** The machines a job's day shows: the ones planned for it today and the ones already on it, each once. */
export function machinesOnJob(store: { machines: readonly Machine[]; assignments: readonly MachineAssignment[] }, jobId: string, day: string): MachineOnJob[] {
  const planned = assignmentsFor(store.assignments, jobId, day)
  const out: MachineOnJob[] = []
  for (const m of store.machines) {
    const a = planned.find((x) => x.machineId === m.id) ?? null
    const placed = m.jobId === jobId
    if (a || placed) out.push({ machine: m, assignment: a, placed })
  }
  return out
}

/** The line under a planned machine before it is checked: who brings it, or that it is already here. */
export function arrivalWords(x: MachineOnJob): string {
  if (x.assignment?.answer === 'not_coming') return `Not coming today${x.assignment.why ? ` · ${x.assignment.why}` : ''}`
  if (x.assignment?.answer === 'later') return 'Coming later today'
  if (x.placed) return `On this job${x.machine.heldSince ? ` since ${dayWords(dayOf(x.machine.heldSince), todayDay())}` : ''}`
  if (x.assignment?.broughtBy) return `${x.assignment.broughtBy} brings it`
  return 'Planned for today'
}

/** Where the machine's place goes after the leaving check's last answer. */
export function placeAfterLeaving(m: Machine, left: LeftWhere, other: { id: string; words: string } | null): Pick<Machine, 'jobId' | 'jobWords' | 'heldSince'> {
  if (left === 'yard') return { jobId: null, jobWords: null, heldSince: new Date().toISOString() }
  if (left === 'other' && other) return { jobId: other.id, jobWords: other.words, heldSince: new Date().toISOString() }
  return { jobId: m.jobId, jobWords: m.jobWords, heldSince: m.heldSince }
}

/* ------------------------------------------------------------------ the pair per day */

export interface MachineDay {
  day: string
  jobId: string | null
  jobWords: string | null
  pre: MachineCheck | null
  post: MachineCheck | null
  /** Hours between the two readings when both exist. */
  hoursUsed: number | null
}

/** One row per day a machine was on a job: the morning walk and the leaving check side by side, newest first. */
export function machineDays(checks: readonly MachineCheck[], machineId: string): MachineDay[] {
  const map = new Map<string, MachineDay>()
  for (const c of checksOf(checks, machineId)) {
    const key = `${c.day}|${c.jobId ?? ''}`
    const row = map.get(key) ?? { day: c.day, jobId: c.jobId, jobWords: c.jobWords, pre: null, post: null, hoursUsed: null }
    if (c.kind === 'pre' && (!row.pre || (c.signedAt && !row.pre.signedAt))) row.pre = c
    if (c.kind === 'post' && (!row.post || (c.signedAt && !row.post.signedAt))) row.post = c
    map.set(key, row)
  }
  const out = [...map.values()]
  for (const r of out) r.hoursUsed = r.pre?.hours != null && r.post?.hours != null ? Math.max(0, r.post.hours - r.pre.hours) : null
  return out.sort((a, b) => (a.day < b.day ? 1 : a.day > b.day ? -1 : 0))
}

/** The fleet card's words for one day: the two stamps, the hours between them, where it was left. */
export function machineDayWords(r: MachineDay, today: string): string {
  const parts: string[] = []
  parts.push(r.pre ? `walk ${clockWords(r.pre.signedAt ?? r.pre.startedAt)} ${r.pre.byName}${r.pre.signedAt ? '' : ' (not signed)'}` : 'no walk')
  if (r.post) parts.push(`left ${clockWords(r.post.signedAt ?? r.post.startedAt)} ${r.post.byName}${r.post.signedAt ? '' : ' (not signed)'}`)
  else if (r.day === today) parts.push('not left yet')
  else parts.push('no leaving check')
  if (r.pre?.hours != null || r.post?.hours != null) parts.push(`${r.pre?.hours?.toLocaleString() ?? '—'} → ${r.post?.hours?.toLocaleString() ?? '—'}${r.hoursUsed != null ? ` · ${r.hoursUsed} h` : ''}`)
  if (r.post?.leftWhere) parts.push(LEFT_WHERE_WORDS[r.post.leftWhere].toLowerCase())
  if (r.pre?.verdict === 'held' || r.post?.verdict === 'held') parts.push('held')
  return parts.join(' · ')
}

/* ------------------------------------------------------------------ rentals */

/**
 * Whether a rental's agreement is in (punch list #271): `typed` once the office has the number on the card, `photo` once
 * the tech has photographed the paper at pickup and the office has not typed the number yet, `none` before either. A
 * machine of ours reads `typed`, since nothing is owed on it.
 */
export type AgreementState = 'none' | 'photo' | 'typed'

/**
 * The shots a rental adds. The agreement paper at pickup files page by page, `agreement` for the first and
 * `agreement_p2`, `agreement_p3`… after it, since an agreement can run to several pages and the condition report is
 * often not the front (Taunya, 2026-11-06); the return slip when it goes back is `return_slip`.
 */
export const RETURN_SLIP_SHOT = 'return_slip'
export const RETURN_SLIP_WORDS = { tile: 'Return slip', file: 'return slip' } as const
export function agreementShot(page: number): string {
  return page <= 1 ? 'agreement' : `agreement_p${page}`
}
/** Which page of the agreement a shot is, or null for any other shot. */
export function agreementPage(shot: string): number | null {
  if (shot === 'agreement') return 1
  const m = /^agreement_p(\d+)$/.exec(shot)
  return m ? Number(m[1]) : null
}
export interface AgreementTile {
  page: number
  shot: string
  /** On the tile. */
  tile: string
  /** In the file's name. */
  file: string
  photo: MachinePhoto | null
}
/** The agreement's tiles on one check: every page taken, in order, then one empty tile for the next page. */
export function agreementTiles(photos: readonly MachinePhoto[]): AgreementTile[] {
  const taken = photos
    .flatMap((p) => {
      const page = agreementPage(p.shot)
      return page == null ? [] : [{ p, page }]
    })
    .sort((a, b) => a.page - b.page)
  const words = (page: number, empty: boolean) => ({ tile: page === 1 ? 'The agreement' : empty ? 'Another page' : `Page ${page}`, file: page === 1 ? 'agreement' : `agreement page ${page}` })
  const out: AgreementTile[] = taken.map(({ p, page }) => ({ page, shot: p.shot, ...words(page, false), photo: p }))
  const next = (taken[taken.length - 1]?.page ?? 0) + 1
  out.push({ page: next, shot: agreementShot(next), ...words(next, true), photo: null })
  return out
}

/** The agreement photos on a machine's checks, newest check first and its first page first, each with the check it was taken on. */
export function agreementPhotos(checks: readonly MachineCheck[], machineId: string): Array<{ photo: MachinePhoto; check: MachineCheck }> {
  const out: Array<{ photo: MachinePhoto; check: MachineCheck }> = []
  for (const c of checksOf(checks, machineId)) {
    const pages = c.photos.filter((p) => agreementPage(p.shot) != null).sort((a, b) => (agreementPage(a.shot) ?? 0) - (agreementPage(b.shot) ?? 0))
    for (const p of pages) out.push({ photo: p, check: c })
  }
  return out
}

export function agreementState(m: Machine, checks: readonly MachineCheck[]): AgreementState {
  if (!m.rental || m.rental.agreementNo.trim()) return 'typed'
  return agreementPhotos(checks, m.id).length ? 'photo' : 'none'
}

/** The pre-use check of a rental holds its sign until the agreement is in, by number or by photo; the leaving check never does. */
export function agreementDue(m: Machine, kind: CheckKind, checks: readonly MachineCheck[]): boolean {
  return kind === 'pre' && agreementState(m, checks) === 'none'
}

/** After the agreement on a later check: the photo is in, or filed in Drive once the sweep has copied it. Null with no photo. */
export function agreementPhotoWords(checks: readonly MachineCheck[], machineId: string): string | null {
  const [newest] = agreementPhotos(checks, machineId)
  if (!newest) return null
  return newest.photo.filedAt ? 'photo filed' : 'photo in'
}

/**
 * The newest agreement photo as the fleet board card draws it: a signed URL while the bytes are in the bucket, the
 * Drive file once the sweep has filed it, and the file's name alone when neither is in hand yet.
 */
export interface AgreementPhotoView {
  src: string | null
  /** Where Open the photo goes: the signed URL, else the Drive file, else nowhere yet. */
  href: string | null
  fileName: string
  byName: string
  day: string
}
export function agreementPhotoView(x: { photo: MachinePhoto; check: MachineCheck }, src: string | null | undefined): AgreementPhotoView {
  const drive = x.photo.driveFileId ? `https://drive.google.com/file/d/${x.photo.driveFileId}/view` : null
  const shown = src ?? x.photo.src
  return { src: shown, href: shown ?? drive, fileName: x.photo.fileName, byName: x.check.byName, day: x.check.day }
}

/** What the add forms type for a rental before it is a `Rental`: the out-on day is the day it is added. */
export interface RentalDraft {
  from: string
  agreementNo: string
  /** YYYY-MM-DD, or empty while open-ended. */
  dueBack: string
}
export const EMPTY_RENTAL_DRAFT: RentalDraft = { from: '', agreementNo: '', dueBack: '' }

/**
 * The add forms' gate (the board's + Add a machine, the label page's for a code the board does not know, the block
 * editor's A machine not on the board yet): a make, and the unit the crew says for ours, or who it is from or the
 * agreement number for a rental. The number may stay blank: the tech photographs the paper at pickup (#271).
 */
export function newMachineReady(ours: boolean, x: { unit: string; make: string; from: string; agreementNo: string }): boolean {
  if (!x.make.trim()) return false
  return ours ? x.unit.trim() !== '' : x.from.trim() !== '' || x.agreementNo.trim() !== ''
}

/** What the add press names: *E-14*, *it*, *the Sunbelt rental*, *the rental*. */
export function newMachineWords(ours: boolean, x: { unit: string; from: string }): string {
  return ours ? x.unit.trim() || 'it' : x.from.trim() ? `the ${x.from.trim()} rental` : 'the rental'
}

/** A rental's unit label, shared by the block editor's add form and the label page: *Rental 48812-3* by its number, *Sunbelt rental* without one. */
export function mintRentalLabel(from: string, agreementNo: string): string {
  const no = agreementNo.trim()
  const f = from.trim()
  return no ? `Rental ${no}` : f ? `${f} rental` : 'Rental'
}

/**
 * The rental line on the card and the sheet: who, the agreement (its number, or that it is in as a photo, or not in
 * yet), and when it is due back against today. The state defaults from the number alone; a caller with the checks in
 * hand passes `agreementState` so a photographed agreement reads as in.
 */
export function rentalWords(r: Rental, today: string, state: AgreementState = r.agreementNo.trim() ? 'typed' : 'none'): { words: string; late: boolean; soon: boolean } {
  const agreement = state === 'typed' && r.agreementNo.trim() ? `agreement ${r.agreementNo.trim()}` : state === 'photo' ? 'agreement photo in · number not typed yet' : 'agreement not in yet'
  const head = ['Rental', r.from.trim(), agreement].filter(Boolean).join(' · ')
  if (!r.dueBack) return { words: `${head} · open-ended`, late: false, soon: false }
  const days = daysBetween(today, r.dueBack)
  if (days < 0) return { words: `${head} · due back ${dayWords(r.dueBack, today)} · ${-days} day${days === -1 ? '' : 's'} over`, late: true, soon: false }
  if (days === 0) return { words: `${head} · due back today`, late: false, soon: true }
  return { words: `${head} · due back ${dayWords(r.dueBack, today)} (${days} day${days === 1 ? '' : 's'})`, late: false, soon: days <= 1 }
}

/** `b` minus `a` in whole days, both YYYY-MM-DD. */
export function daysBetween(a: string, b: string): number {
  const [ay = 0, am = 1, ad = 1] = a.split('-').map(Number)
  const [by = 0, bm = 1, bd = 1] = b.split('-').map(Number)
  return Math.round((Date.UTC(by, bm - 1, bd) - Date.UTC(ay, am - 1, ad)) / 86400000)
}

/* ------------------------------------------------------------------ where the photos go */

/**
 * Every photo a check takes files into the machine's own Drive folder, the way a job's photos file into the job's:
 * the photo-save sweep copies the waiting rows there every few minutes. The folder is named so a rental's is found by
 * its agreement when the claim comes.
 */
export const FLEET_ROOT_WORDS = 'PipeTooling Fleet'

/** The same words as the sweep's `_shared/machineWords.ts` (held equal by `machineFolder.test.ts` once both are on main). */
export function machineFolderName(m: Machine): string {
  return m.rental ? `Rental · ${[m.rental.from.trim(), m.rental.agreementNo.trim()].filter(Boolean).join(' ')} · ${m.make} ${m.model}` : `${m.unitLabel} · ${m.make} ${m.model}`
}

/** The file's name in the folder: day, who, the unit, which check, which shot. */
export function photoFileName(c: MachineCheck, m: Machine, shot: string): string {
  return `${c.day} ${c.byName} · ${m.unitLabel} ${CHECK_KIND_WORDS[c.kind].short} ${shot}.jpg`
}


export function dayOf(iso: string): string {
  return iso.slice(0, 10)
}

export function todayDay(now = new Date()): string {
  const y = now.getFullYear()
  const mo = String(now.getMonth() + 1).padStart(2, '0')
  const d = String(now.getDate()).padStart(2, '0')
  return `${y}-${mo}-${d}`
}

/** The machine's checks, newest first. */
export function checksOf(checks: readonly MachineCheck[], machineId: string): MachineCheck[] {
  return checks.filter((c) => c.machineId === machineId).sort((a, b) => (a.startedAt < b.startedAt ? 1 : -1))
}

/** The newest check that was signed (safe or held), for yesterday's levels and the last reading. */
export function lastSignedCheck(checks: readonly MachineCheck[], machineId: string): MachineCheck | null {
  return checksOf(checks, machineId).find((c) => c.signedAt) ?? null
}

/** The newest hour reading on the machine. */
export function lastHours(checks: readonly MachineCheck[], machineId: string): { hours: number; day: string } | null {
  const c = checksOf(checks, machineId).find((x) => x.hours != null)
  return c && c.hours != null ? { hours: c.hours, day: c.day } : null
}

/** A held machine stays held until Dispatch says run it anyway or a newer check signs it safe. */
export function isHeld(checks: readonly MachineCheck[], machineId: string): MachineCheck | null {
  const newest = checksOf(checks, machineId).find((c) => c.verdict !== 'unfinished')
  return newest && newest.verdict === 'held' && !newest.runAnyway ? newest : null
}

export type LineState =
  | { kind: 'held'; check: MachineCheck; why: string }
  | { kind: 'checked'; check: MachineCheck }
  | { kind: 'unfinished'; check: MachineCheck }
  | { kind: 'unchecked'; last: MachineCheck | null }

/** What the Job Mode card's line reads for one machine today: the morning walk, with a hold from either check. */
export function lineState(checks: readonly MachineCheck[], machineId: string, day: string): LineState {
  const held = isHeld(checks, machineId)
  if (held) return { kind: 'held', check: held, why: heldWhy(held) }
  const today = checksOf(checks, machineId).filter((c) => c.day === day && c.kind === 'pre')
  const signed = today.find((c) => c.signedAt)
  if (signed) return { kind: 'checked', check: signed }
  const open = today.find((c) => c.verdict === 'unfinished')
  if (open) return { kind: 'unfinished', check: open }
  return { kind: 'unchecked', last: lastSignedCheck(checks, machineId) }
}

export type LeaveState = { kind: 'left'; check: MachineCheck } | { kind: 'open'; check: MachineCheck } | { kind: 'none' }

/** The leaving line under a checked machine: signed, started, or not yet. */
export function leaveState(checks: readonly MachineCheck[], machineId: string, day: string): LeaveState {
  const today = checksOf(checks, machineId).filter((c) => c.day === day && c.kind === 'post')
  const signed = today.find((c) => c.signedAt)
  if (signed) return { kind: 'left', check: signed }
  const open = today.find((c) => c.verdict === 'unfinished')
  if (open) return { kind: 'open', check: open }
  return { kind: 'none' }
}

export function leaveWords(state: LeaveState, unit: string): { head: string; sub: string; press: string } {
  switch (state.kind) {
    case 'left':
      return { head: 'Left', sub: `${state.check.byName} · ${clockWords(state.check.signedAt ?? state.check.startedAt)}${state.check.hours != null ? ` · ${hoursWords(state.check.hours)}` : ''}`, press: 'Left ✓' }
    case 'open':
      return { head: 'Leaving, not finished', sub: `${state.check.byName} started at ${clockWords(state.check.startedAt)}`, press: 'Finish it ›' }
    case 'none':
      return { head: `Leaving ${unit}?`, sub: 'Hours, fuel and anything new wrong, before you go', press: 'Leaving ›' }
  }
}

export function heldWhy(c: MachineCheck): string {
  const no = c.answers.find((a) => a.pick === 'no' && a.note)
  return no?.note ?? 'a No on a check that holds it'
}

export function clockWords(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
}

export function dayWords(day: string, today: string): string {
  if (day === today) return 'today'
  const [y = 0, m = 1, d = 1] = day.split('-').map(Number)
  const [ty = 0, tm = 1, td = 1] = today.split('-').map(Number)
  const diff = Math.round((Date.UTC(ty, tm - 1, td) - Date.UTC(y, m - 1, d)) / 86400000)
  if (diff === 1) return 'yesterday'
  return new Date(y, m - 1, d).toLocaleDateString([], { month: 'short', day: 'numeric' })
}

export function lineWords(state: LineState, today: string): { head: string; sub: string; press: string } {
  switch (state.kind) {
    case 'held':
      return { head: 'Held', sub: `${state.why} · ${state.check.byName} · ${dayWords(state.check.day, today)} ${clockWords(state.check.startedAt)}`, press: 'Held ›' }
    case 'checked':
      return { head: 'Checked', sub: `${state.check.byName} · ${clockWords(state.check.signedAt ?? state.check.startedAt)}${state.check.hours != null ? ` · ${hoursWords(state.check.hours)}` : ''} · safe to run`, press: 'Checked ✓' }
    case 'unfinished':
      return { head: 'Not finished', sub: `${state.check.byName} started at ${clockWords(state.check.startedAt)}`, press: 'Finish it ›' }
    case 'unchecked':
      return {
        head: 'Not checked today',
        sub: state.last ? `${state.last.byName} checked it ${dayWords(state.last.day, today)}${state.last.hours != null ? `, ${hoursWords(state.last.hours)}` : ''}` : 'Never checked here',
        press: 'Check it ›',
      }
  }
}

export function hoursWords(h: number): string {
  return `${h.toLocaleString()} h`
}

/** The next question with no answer, in the walk's order. */
export function nextOpen(questions: readonly MachineQuestion[], answers: readonly Answer[]): MachineQuestion | null {
  return questions.find((x) => !answers.some((a) => a.questionId === x.id)) ?? null
}

export function walkProgress(questions: readonly MachineQuestion[], answers: readonly Answer[]): { answered: number; asked: number; nos: number } {
  const answered = questions.filter((x) => answers.some((a) => a.questionId === x.id)).length
  const nos = questions.filter((x) => answers.some((a) => a.questionId === x.id && a.pick === 'no')).length
  return { answered, asked: questions.length, nos }
}

/** Held when any holding question got a No. */
export function verdictOf(questions: readonly MachineQuestion[], answers: readonly Answer[]): 'safe' | 'held' {
  return questions.some((x) => x.holdsMachine && answers.some((a) => a.questionId === x.id && a.pick === 'no')) ? 'held' : 'safe'
}

/** The hour box's line under the number: yesterday's reading and the change, amber when it went backwards. */
export function hoursLine(hours: number | null, last: { hours: number; day: string } | null, today: string): { words: string; bad: boolean } {
  if (!last) return { words: 'The first reading on this machine', bad: false }
  const when = dayWords(last.day, today)
  const When = when.charAt(0).toUpperCase() + when.slice(1)
  if (hours == null) return { words: `${when === 'today' ? 'Earlier today' : When} ${last.hours.toLocaleString()}`, bad: false }
  const diff = hours - last.hours
  if (diff < 0) return { words: `${When} ${last.hours.toLocaleString()} · this is ${Math.abs(diff).toLocaleString()} h less. Read it again?`, bad: true }
  return { words: `${When} ${last.hours.toLocaleString()} · +${diff.toLocaleString()} h`, bad: false }
}

/** The sign line, in the first person. */
export function signWords(m: Machine, byName: string, verdict: 'safe' | 'held', kind: CheckKind = 'pre'): string {
  if (kind === 'post') {
    return verdict === 'safe'
      ? `I read ${m.unitLabel}'s hours and levels and left it as the check says. · ${byName}`
      : `I found something new wrong with ${m.unitLabel} as I left. Dispatch has it for the night. · ${byName}`
  }
  return verdict === 'safe'
    ? `I walked around ${m.unitLabel}, read its levels and took the photos. It is safe to run. · ${byName}`
    : `I walked around ${m.unitLabel} and found something that holds it. Dispatch has it. · ${byName}`
}

export function signPressWords(m: Machine, verdict: 'safe' | 'held', kind: CheckKind = 'pre'): string {
  if (kind === 'post') return verdict === 'safe' ? `I left ${m.unitLabel} as it says` : `Leave it held, Dispatch gets the night`
  return verdict === 'safe' ? `${m.unitLabel} is safe to run` : `Finish the walk, ${m.unitLabel} stays held`
}

/** The ledger row for a check, as the fleet board draws it; `questions` and `levels` are the machine's own lists. */
export function ledgerWords(c: MachineCheck, questions: readonly MachineQuestion[], levels: readonly LevelDef[]): string {
  const p = walkProgress(questions, c.answers)
  const lows = levels.filter((d) => levelWords(d, c.levels[d.key]).low).map((d) => `${d.name.toLowerCase()} ${levelWords(d, c.levels[d.key]).word.replace(' · low', '')}`)
  const photos = c.photos.length
  const tail = c.verdict === 'held' ? (c.runAnyway ? `held · ${c.runAnyway.byName} said run it anyway` : `held · ${heldWhy(c)}`) : c.verdict === 'safe' ? 'safe to run' : 'not finished'
  return [`${c.byName}`, `${p.answered} of ${p.asked}${p.nos ? ` · ${p.nos} No` : ' yes'}`, lows.length ? lows.join(', ') : null, c.hours != null ? hoursWords(c.hours) : null, photos ? `${photos} photo${photos === 1 ? '' : 's'}` : null, tail]
    .filter(Boolean)
    .join(' · ')
}

