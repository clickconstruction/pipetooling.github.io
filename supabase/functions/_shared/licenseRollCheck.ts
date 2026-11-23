/**
 * State roll (punch list #411): one plumbing number against the plumbing board's own files, for the dev seat's
 * `check_license`. The board publishes every license as free files, so a number can be answered without its search,
 * which asks for a robot check. Pure: the seat fetches the files and hands their rows here, and nothing is kept.
 * Tested from `src/lib/licenseRoll/licenseRollCheck.test.ts`.
 */
import { rollNumberKey, tsbpeFile, type RollClass, type RollRow, type RollStatus, type TsbpeFile, type TsbpeFileKey } from './licenseRoll.ts'

/** The board's page that lists its free files. */
export const TSBPE_LIST_URL = 'https://tsbpe.texas.gov/free-licensee-list/'

/** How long one file's read waits before it gives up. The two zips are the whole state's journeymen and apprentices. */
export const TSBPE_CHECK_TIMEOUT_MS = 30_000
/** The reason a read that hit that wait reports, the wait named. */
export const TSBPE_CHECK_TIMEOUT_REASON = `TSBPE did not answer within ${TSBPE_CHECK_TIMEOUT_MS / 1000} seconds. Try again in a minute.`

/** A file with fewer rows than this is not the board's roll, whatever it says. The weekly pull holds the same line. */
export const TSBPE_FEWEST_ROWS = 200

/** The files a license of each level is found in. A master is on either master file. */
const FILES_FOR_LEVEL: Record<string, readonly TsbpeFileKey[]> = {
  apprentice: ['PA'],
  tradesman: ['TP'],
  journeyman: ['JP'],
  master: ['MP', 'RMP'],
}

/** The levels a plumbing license is checked at, lowest first. */
export const TSBPE_CHECK_LEVELS: readonly string[] = Object.keys(FILES_FOR_LEVEL)

/** The board's files to read for a plumbing license of this level. Empty for a level the board does not issue. */
export function tsbpeFilesForLevel(level: string): TsbpeFile[] {
  return (FILES_FOR_LEVEL[level.trim().toLowerCase()] ?? []).map((k) => tsbpeFile(k)).filter((f): f is TsbpeFile => f !== null)
}

/** What each class of license is called, as People → Licenses writes it. A responsible master has no line there. */
const CLASS_WORDS: Partial<Record<RollClass, string>> = {
  apprentice: 'Plumber Apprentice',
  tradesman: 'Tradesman Plumber-Limited',
  journeyman: 'Journeyman Plumber',
  master: 'Master Plumber',
  responsible_master: 'Responsible Master Plumber',
}

/** The holder as the board writes them, first name first: `MARLON T FENWICK JR`. */
export function tsbpeHolder(row: Pick<RollRow, 'first_name' | 'middle_name' | 'last_name' | 'suffix'>): string {
  return [row.first_name, row.middle_name, row.last_name, row.suffix].map((v) => v.trim()).filter(Boolean).join(' ')
}

/** One license the board lists under a number. No ZIP and no county: the check is of a number, not of where a person lives. */
export type TsbpeLicense = {
  file: TsbpeFileKey
  type: string
  holder: string
  status: RollStatus
  licensed: string | null
  expires: string | null
  endorsements: string[]
  /** A responsible master's company, and the day the insurance on file with the board ends. Null on every other file. */
  company: string | null
  insurance_ends: string | null
}

export type TsbpeAnswer =
  | { kind: 'found'; holder: string; type: string; status: RollStatus; expiryYmd: string | null; licensedYmd: string | null; endorsements: string[]; company: string | null; insuranceEndsYmd: string | null }
  | { kind: 'none'; reason: string }

function licenseOf(file: TsbpeFile, row: RollRow): TsbpeLicense {
  return {
    file: file.file,
    type: CLASS_WORDS[file.license_class] ?? file.says,
    holder: tsbpeHolder(row),
    status: row.status,
    licensed: row.licensed_on,
    expires: row.expires_on,
    endorsements: [...row.endorsements],
    company: row.company.trim() || null,
    insurance_ends: row.insurance_ends_on,
  }
}

/** `journeyman`, or `master and responsible master`: the files read, as a reason names them. */
function filesWords(files: readonly TsbpeFile[]): string {
  const names = files.map((f) => f.license_class.replace(/_/g, ' '))
  return names.length > 1 ? `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]} files` : `${names[0] ?? ''} file`
}

export type TsbpeFileRead = { file: TsbpeFile; rows: readonly RollRow[] }

/**
 * The board's answer for one number at one level. The number is compared as `rollNumberKey` writes it, so `J-000412`,
 * `#412` and the board's `000412` are one number. A master who is on both master files is answered by the row that
 * is current, and both are listed. When no file has the number the reason names the files read, and says that the
 * two zipped files can run a week behind.
 */
export function tsbpeAnswer(reads: readonly TsbpeFileRead[], number: string): { answer: TsbpeAnswer; every: TsbpeLicense[] } {
  const key = rollNumberKey(number)
  const every: TsbpeLicense[] = []
  if (key) {
    for (const read of reads) {
      const hit = read.rows.find((r) => rollNumberKey(r.license_number) === key)
      if (hit) every.push(licenseOf(read.file, hit))
    }
  }
  const hit = every.find((l) => l.status === 'current') ?? every[0]
  if (!hit) {
    const files = reads.map((r) => r.file)
    const behind = files.some((f) => f.zipped) ? ' The board refreshes that file about weekly, so a license issued in the last week may not be on it yet.' : ''
    return { answer: { kind: 'none', reason: `TSBPE's ${filesWords(files)} ${files.length > 1 ? 'have' : 'has'} no license under that number.${behind}` }, every }
  }
  return {
    answer: { kind: 'found', holder: hit.holder, type: hit.type, status: hit.status, expiryYmd: hit.expires, licensedYmd: hit.licensed, endorsements: hit.endorsements, company: hit.company, insuranceEndsYmd: hit.insurance_ends },
    every,
  }
}
