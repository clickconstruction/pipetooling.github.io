/**
 * State roll (punch list #411): the pure half of `license-roll-pull`. It reads one of the plumbing board's free
 * files into rows, and says what a pull would keep, change and drop against the rows already kept. No fetch and no
 * database here: the function does those. Tested from `src/lib/licenseRoll/licenseRoll.test.ts`.
 *
 * The state's file says what is true today and keeps no history, so what changed is known only by comparing a pull
 * with the rows the last one kept. That comparison is `planRollPull`.
 */

export type RollSource = 'tsbpe' | 'tdlr'
export type RollTrade = 'plumbing' | 'electrical' | 'hvac'
export type RollClass =
  | 'apprentice'
  | 'tradesman'
  | 'journeyman'
  | 'master'
  | 'responsible_master'
  | 'registered_tech'
  | 'certified_tech'
  | 'contractor'
export type RollStatus = 'current' | 'expired'

/** One license as the state's file has it today. The columns of `license_roll` the state fills. */
export type RollRow = {
  source: RollSource
  trade: RollTrade
  license_class: RollClass
  license_number: string
  status: RollStatus
  licensed_on: string | null
  expires_on: string | null
  last_name: string
  first_name: string
  middle_name: string
  suffix: string
  name_key: string
  zip: string
  county: string
  endorsements: string[]
  company: string
  insurance_ends_on: string | null
}

/** A row already kept, as the pull reads it back. */
export type KeptRow = RollRow & { id: string; ours: boolean; gone_on: string | null }

export type RollChangeKind = 'first_seen' | 'renewed' | 'lapsed' | 'current_again' | 'moved' | 'endorsement' | 'named' | 'gone' | 'back'
export type RollChange = { roll_id: string; kind: RollChangeKind; was: Record<string, unknown>; now_is: Record<string, unknown> }

/** The plumbing board's files, by the letters the board names them with. */
export type TsbpeFileKey = 'RMP' | 'MP' | 'JP' | 'TP' | 'PA'
export type TsbpeFile = { file: TsbpeFileKey; license_class: RollClass; url: string; zipped: boolean; says: string }

/**
 * Where each file is. Four are made on request; the journeyman and apprentice files are zips the board refreshes
 * about weekly. Read 2026-11-20 from https://tsbpe.texas.gov/free-licensee-list/.
 */
export const TSBPE_FILES: readonly TsbpeFile[] = [
  { file: 'RMP', license_class: 'responsible_master', url: 'https://tsbpe.texas.gov/download-csv/RMP/', zipped: false, says: 'Plumbing · responsible master' },
  { file: 'MP', license_class: 'master', url: 'https://tsbpe.texas.gov/download-csv/MP/', zipped: false, says: 'Plumbing · master' },
  { file: 'JP', license_class: 'journeyman', url: 'https://tsbpe.texas.gov/wp-content/uploads/2015/03/JP.csv.zip', zipped: true, says: 'Plumbing · journeyman' },
  { file: 'TP', license_class: 'tradesman', url: 'https://tsbpe.texas.gov/download-csv/TP/', zipped: false, says: 'Plumbing · tradesman' },
  { file: 'PA', license_class: 'apprentice', url: 'https://tsbpe.texas.gov/wp-content/uploads/2015/03/PA.csv.zip', zipped: true, says: 'Plumbing · apprentice' },
]

/** The files a weekly pull keeps our counties from. */
export const TSBPE_WEEKLY_FILES: readonly TsbpeFileKey[] = ['RMP', 'MP', 'JP', 'TP']

/**
 * The files read only for our own people's numbers: no county's rows are kept from them. The apprentice file gives
 * no age and an apprentice can be 16, so the only apprentices on the roll are our own.
 */
export const TSBPE_OWN_ONLY_FILES: readonly TsbpeFileKey[] = ['PA']

/**
 * A license number as it is compared: digits only, with no leading zeros. The state writes `012345`; our own records
 * write `#12345`, `J-12345` or `12345`. Empty when the text holds no digit.
 */
export function rollNumberKey(raw: string | null | undefined): string {
  return (raw ?? '').replace(/\D/g, '').replace(/^0+/, '')
}

/** One of our own people's licenses, as the app's own reader makes it out (`parseLicenseType`). */
export type OwnLicense = { trade: string | null; cls: string | null; number: string | null }

/**
 * Our own people's plumbing numbers, by the class of the state file each would be found in. A master may be on
 * either master file, since a responsible master is a master who contracts with the public, so a master's number is
 * looked for in both. A license with no number, or of another trade, names nothing.
 */
export function ownPlumbingNumbers(licenses: readonly OwnLicense[]): Partial<Record<RollClass, Set<string>>> {
  const out: Partial<Record<RollClass, Set<string>>> = {}
  const add = (cls: RollClass, key: string) => (out[cls] ??= new Set<string>()).add(key)
  for (const l of licenses) {
    const key = rollNumberKey(l.number)
    if (l.trade !== 'plumbing' || !key) continue
    if (l.cls === 'master') {
      add('master', key)
      add('responsible_master', key)
    } else if (l.cls === 'apprentice' || l.cls === 'tradesman' || l.cls === 'journeyman') add(l.cls, key)
  }
  return out
}

export function tsbpeFile(key: string): TsbpeFile | null {
  const k = key.trim().toUpperCase()
  return TSBPE_FILES.find((f) => f.file === k) ?? null
}

/** A CSV's lines as cells. Quoted cells may hold commas, line breaks and doubled quotes. A blank line is skipped. */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = []
  let row: string[] = []
  let cell = ''
  let quoted = false
  const s = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text
  for (let i = 0; i < s.length; i++) {
    const ch = s[i]!
    if (quoted) {
      if (ch === '"') {
        if (s[i + 1] === '"') {
          cell += '"'
          i++
        } else quoted = false
      } else cell += ch
      continue
    }
    if (ch === '"') quoted = true
    else if (ch === ',') {
      row.push(cell)
      cell = ''
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && s[i + 1] === '\n') i++
      row.push(cell)
      cell = ''
      if (row.length > 1 || row[0] !== '') rows.push(row)
      row = []
    } else cell += ch
  }
  row.push(cell)
  if (row.length > 1 || row[0] !== '') rows.push(row)
  return rows
}

/**
 * `11/12/2026` as `2026-11-12`. Null for a blank, a day that is not one, or a year before 1930: the board writes
 * 01/01/1901 where it has no day on file.
 */
export function ymdFromUsDate(raw: string | undefined): string | null {
  const m = /^\s*(\d{1,2})\/(\d{1,2})\/(\d{4})\s*$/.exec(raw ?? '')
  if (!m) return null
  const mo = Number(m[1])
  const d = Number(m[2])
  const y = Number(m[3])
  if (y < 1930 || mo < 1 || mo > 12 || d < 1 || d > 31) return null
  const day = new Date(Date.UTC(y, mo - 1, d))
  if (day.getUTCMonth() !== mo - 1 || day.getUTCDate() !== d) return null
  return `${y}-${String(mo).padStart(2, '0')}-${String(d).padStart(2, '0')}`
}

/** The first five digits of a ZIP, or '' when it has none. */
export function zip5(raw: string | undefined): string {
  const m = /\d{5}/.exec(raw ?? '')
  return m ? m[0] : ''
}

/**
 * What joins one person's rows across ranks, and what Leave off is kept by: last name, first name, middle initial
 * and five-digit ZIP, lower case, letters and digits only. Two people can share one.
 */
export function nameKeyOf(last: string, first: string, middle: string, zip: string): string {
  const clean = (v: string) => v.toLowerCase().replace(/[^a-z0-9]/g, '')
  return [clean(last), clean(first), clean(middle).slice(0, 1), zip5(zip)].join('|')
}

/** The state's endorsement columns, and the word each is kept under. */
const TSBPE_ENDORSEMENTS: Record<string, string> = {
  MEDGAS_ENDR: 'medical_gas',
  MRF_ENDR: 'fire_sprinkler',
  WS_ENDR: 'water_supply',
  TDC_ENDR: 'drain_cleaner',
  ADC_ENDR: 'drain_cleaner',
  ADCR_ENDR: 'drain_cleaner_restricted',
  ARUI_ENDR: 'utilities_installer',
}

/** The columns every plumbing file must carry. A file without one is refused whole: the board changed its layout. */
const TSBPE_NEEDS = ['LICENSE_NBR', 'LIC_STATUS', 'LICENSE_DATE', 'EXPIRATION_DTE', 'LAST_NAME', 'FIRST_NAME', 'ZIP', 'COUNTY'] as const

export type FileRead = { rows: RollRow[]; seen: number; skipped: number }

/**
 * One plumbing file as rows. Throws, naming the column, when the header lacks one the pull needs. A line with no
 * number, no name, or a status that is neither Current nor Expired is skipped and counted. A number met twice keeps
 * its first line.
 */
export function tsbpeRows(file: TsbpeFile, text: string): FileRead {
  const lines = parseCsv(text)
  const head = (lines[0] ?? []).map((h) => h.trim().toUpperCase())
  for (const need of TSBPE_NEEDS) {
    if (!head.includes(need)) throw new Error(`The board's ${file.file} file has no ${need} column. Its layout changed.`)
  }
  const at = (name: string) => head.indexOf(name)
  const col = { nbr: at('LICENSE_NBR'), status: at('LIC_STATUS'), lic: at('LICENSE_DATE'), exp: at('EXPIRATION_DTE'), last: at('LAST_NAME'), first: at('FIRST_NAME'), middle: at('MIDDLE_NAME'), suffix: at('SUFFIX'), zip: at('ZIP'), county: at('COUNTY'), company: at('PLUMB_COMPANY'), ins: at('INS_EXPIRY_DTE') }
  const endorsementCols = Object.keys(TSBPE_ENDORSEMENTS).map((name) => ({ word: TSBPE_ENDORSEMENTS[name]!, i: at(name) })).filter((e) => e.i >= 0)
  const cell = (line: string[], i: number) => (i >= 0 ? (line[i] ?? '').trim() : '')
  const rows: RollRow[] = []
  const met = new Set<string>()
  let skipped = 0
  for (const line of lines.slice(1)) {
    const number = cell(line, col.nbr)
    const last = cell(line, col.last)
    const first = cell(line, col.first)
    const statusWord = cell(line, col.status).toLowerCase()
    const status: RollStatus | null = statusWord === 'current' ? 'current' : statusWord === 'expired' ? 'expired' : null
    if (!number || !last || !status || met.has(number)) {
      skipped++
      continue
    }
    met.add(number)
    const middle = cell(line, col.middle)
    const zip = cell(line, col.zip)
    const endorsements = [...new Set(endorsementCols.filter((e) => cell(line, e.i).toLowerCase() === 'yes').map((e) => e.word))].sort()
    rows.push({
      source: 'tsbpe',
      trade: 'plumbing',
      license_class: file.license_class,
      license_number: number,
      status,
      licensed_on: ymdFromUsDate(cell(line, col.lic)),
      expires_on: ymdFromUsDate(cell(line, col.exp)),
      last_name: last,
      first_name: first,
      middle_name: middle,
      suffix: cell(line, col.suffix),
      name_key: nameKeyOf(last, first, middle, zip),
      zip,
      county: cell(line, col.county).toUpperCase(),
      endorsements,
      company: cell(line, col.company),
      insurance_ends_on: ymdFromUsDate(cell(line, col.ins)),
    })
  }
  return { rows, seen: lines.length > 0 ? lines.length - 1 : 0, skipped }
}

/** A person who asked not to be listed: by number within a source, or by name key. */
export type LeftOff = { numbers: ReadonlySet<string>; nameKeys: ReadonlySet<string> }

export function isLeftOff(row: Pick<RollRow, 'license_number' | 'name_key'>, leftOff: LeftOff): boolean {
  return leftOff.numbers.has(row.license_number) || leftOff.nameKeys.has(row.name_key)
}

export type RollPullInput = {
  /** The state's file, read today. */
  rows: readonly RollRow[]
  /** Every row already kept for this source and class. */
  kept: readonly KeptRow[]
  /** The counties kept, upper case. */
  counties: ReadonlySet<string>
  /** Our own people's and subs' numbers at this class, each as `rollNumberKey` writes it. Kept whatever the county. */
  ours: ReadonlySet<string>
  leftOff: LeftOff
  today: string
  /** Makes an id for a new row, so its first change can name it before the insert returns. */
  newId: () => string
}

export type RollInsert = RollRow & { id: string; ours: boolean; first_seen_on: string; last_seen_on: string }
export type RollPatch = { id: string; patch: Partial<RollRow> & { ours?: boolean; gone_on?: string | null } }

export type RollPullPlan = {
  inserts: RollInsert[]
  patches: RollPatch[]
  changes: RollChange[]
  /** Rows to take off the kept roll: left off, out of our counties, or missing from the state's file too long. */
  deletes: string[]
  /** Kept rows the file still has, to stamp as seen today. */
  seenIds: string[]
  counts: { seen: number; kept: number; added: number; changed: number; gone: number }
  /** Kept rows this pull found missing from the file for the first time. What `fileLooksCutShort` weighs. */
  markedGone: number
}

/** A row missing from the state's file is kept this many days, in case the file was cut short, then dropped. */
export const GONE_KEPT_DAYS = 28

function daysBetween(from: string, to: string): number {
  return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000)
}

const sameList = (a: readonly string[], b: readonly string[]) => a.length === b.length && a.every((v, i) => v === b[i])

/**
 * What changed on one kept row, as the changes a person reads: lapsed, current again, renewed, moved, an
 * endorsement, a name. Each carries the fields before and after. The patch is every field that differs.
 */
export function rowChanges(was: KeptRow, now: RollRow): { patch: Partial<RollRow>; changes: Omit<RollChange, 'roll_id'>[] } {
  const patch: Partial<RollRow> = {}
  const changes: Omit<RollChange, 'roll_id'>[] = []
  const statusChanged = was.status !== now.status
  const expiryChanged = was.expires_on !== now.expires_on
  if (statusChanged) patch.status = now.status
  if (expiryChanged) patch.expires_on = now.expires_on
  if (statusChanged) {
    changes.push({ kind: now.status === 'expired' ? 'lapsed' : 'current_again', was: { status: was.status, expires_on: was.expires_on }, now_is: { status: now.status, expires_on: now.expires_on } })
  } else if (expiryChanged && now.status === 'current') {
    changes.push({ kind: 'renewed', was: { expires_on: was.expires_on }, now_is: { expires_on: now.expires_on } })
  }
  if (was.county !== now.county || zip5(was.zip) !== zip5(now.zip)) {
    changes.push({ kind: 'moved', was: { county: was.county, zip: was.zip }, now_is: { county: now.county, zip: now.zip } })
  }
  if (was.county !== now.county) patch.county = now.county
  if (was.zip !== now.zip) patch.zip = now.zip
  const wasEnd = [...was.endorsements].sort()
  const nowEnd = [...now.endorsements].sort()
  if (!sameList(wasEnd, nowEnd)) {
    patch.endorsements = nowEnd
    changes.push({ kind: 'endorsement', was: { endorsements: wasEnd }, now_is: { endorsements: nowEnd } })
  }
  const nameFields = ['last_name', 'first_name', 'middle_name', 'suffix'] as const
  if (nameFields.some((f) => was[f] !== now[f])) {
    for (const f of nameFields) if (was[f] !== now[f]) patch[f] = now[f]
    changes.push({
      kind: 'named',
      was: Object.fromEntries(nameFields.map((f) => [f, was[f]])),
      now_is: Object.fromEntries(nameFields.map((f) => [f, now[f]])),
    })
  }
  // Kept in step without a line of history: a derived key, and facts nobody reads as an event.
  if (was.name_key !== now.name_key) patch.name_key = now.name_key
  if (was.licensed_on !== now.licensed_on) patch.licensed_on = now.licensed_on
  if (was.company !== now.company) patch.company = now.company
  if (was.insurance_ends_on !== now.insurance_ends_on) patch.insurance_ends_on = now.insurance_ends_on
  return { patch, changes }
}

/**
 * What one pull of one file does to the kept roll.
 *
 * - A row is kept when its county is one of ours or its number is one of our own, and it is not left off.
 * - A new row is added with a `first_seen` change.
 * - A kept row the file still has is stamped as seen, patched where it differs, and each difference a person would
 *   read as an event becomes a change.
 * - A kept row that no longer qualifies (left off, or out of our counties) is taken off.
 * - A kept row the file no longer has is marked gone the first time, and taken off after `GONE_KEPT_DAYS`.
 */
export function planRollPull(input: RollPullInput): RollPullPlan {
  const { rows, kept, counties, ours, leftOff, today, newId } = input
  const keptByNumber = new Map(kept.map((k) => [k.license_number, k]))
  const inserts: RollInsert[] = []
  const patches: RollPatch[] = []
  const changes: RollChange[] = []
  const deletes: string[] = []
  const seenIds: string[] = []
  const met = new Set<string>()
  let changed = 0
  let gone = 0
  let markedGone = 0

  for (const row of rows) {
    const numberKey = rollNumberKey(row.license_number)
    const isOurs = numberKey !== '' && ours.has(numberKey)
    const qualifies = !isLeftOff(row, leftOff) && (isOurs || counties.has(row.county))
    const was = keptByNumber.get(row.license_number)
    met.add(row.license_number)
    if (!was) {
      if (!qualifies) continue
      const id = newId()
      inserts.push({ ...row, id, ours: isOurs, first_seen_on: today, last_seen_on: today })
      changes.push({ roll_id: id, kind: 'first_seen', was: {}, now_is: { status: row.status, license_class: row.license_class, county: row.county } })
      continue
    }
    if (!qualifies) {
      deletes.push(was.id)
      gone++
      continue
    }
    seenIds.push(was.id)
    const diff = rowChanges(was, row)
    const patch: RollPatch['patch'] = { ...diff.patch }
    if (was.ours !== isOurs) patch.ours = isOurs
    if (was.gone_on) {
      patch.gone_on = null
      changes.push({ roll_id: was.id, kind: 'back', was: { gone_on: was.gone_on }, now_is: {} })
    }
    for (const c of diff.changes) changes.push({ roll_id: was.id, ...c })
    if (Object.keys(patch).length > 0) patches.push({ id: was.id, patch })
    if (diff.changes.length > 0 || was.gone_on) changed++
  }

  for (const was of kept) {
    if (met.has(was.license_number)) continue
    if (isLeftOff(was, leftOff)) {
      deletes.push(was.id)
      gone++
    } else if (!was.gone_on) {
      patches.push({ id: was.id, patch: { gone_on: today } })
      changes.push({ roll_id: was.id, kind: 'gone', was: { status: was.status, expires_on: was.expires_on }, now_is: {} })
      gone++
      markedGone++
    } else if (daysBetween(was.gone_on, today) >= GONE_KEPT_DAYS) {
      deletes.push(was.id)
    }
  }

  const keptAfter = kept.length - deletes.length + inserts.length
  return { inserts, patches, changes, deletes, seenIds, counts: { seen: rows.length, kept: keptAfter, added: inserts.length, changed, gone }, markedGone }
}

/**
 * A file that looks cut short: the pull is refused before it marks anyone gone. A first pull has nothing to compare
 * with and passes. Past that, a file that would mark more than a third of the kept rows gone is not believed.
 */
export function fileLooksCutShort(keptThere: number, wouldMarkGone: number): boolean {
  return keptThere >= 30 && wouldMarkGone > keptThere / 3
}

/** The words for a pull that failed, kept on the ledger and shown on Pulls. Never longer than a line or two. */
export function pullErrorWords(e: unknown): string {
  const said = typeof e === 'string' ? e : (e as { message?: unknown } | null)?.message
  const words = typeof said === 'string' && said.trim() ? said : 'The pull stopped without saying why.'
  return words.slice(0, 400)
}
