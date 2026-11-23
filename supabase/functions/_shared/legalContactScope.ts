/**
 * Which of the payer's contact log entries go to the collections law firm
 * (punch list #85, item 24). `customer_contacts` is the customer's general
 * contact log: calls and emails about any job, any bid, or the account. It has
 * no job column. `legal-portal` sent every entry for the payer, filtered only
 * by date, so the firm read calls about jobs that were never referred.
 *
 * The rule: an entry that names one of the matter's jobs goes. An entry that
 * names only the payer's other jobs stays home. An entry that names no job is
 * about the account, and goes.
 *
 * "Names a job" means the entry's text carries the job's number (its HCP
 * number, else its Click number) **where it stands as a job's number**:
 * `1042`, `#1042`, `J1042`, `job 1042`, `job#1042`, and a bill of it,
 * `1042-1` / `#1042-2` / `Invoice 1042-1` (a dash and one or two digits).
 *
 * The same digits do not name the job when they are part of something else
 * (`nonJobSpans`):
 *
 * - a phone number, `(512) 555-1042`, `512 555 1042`, `555-1042`, `ext 1042`,
 *   `ending in 1042`;
 * - a date or a year: `11/22/2026`, and a number that reads as a year (1950 to
 *   2049) names a job only with *job*, *J*, *#*, *invoice* or *bill* before it,
 *   so `in 2026` and `Nov 2026` never do;
 * - money, `$1042`, `$ 1,042`, `1042.50`, `1042 dollars`;
 * - a street address, `1042 Main St`, `512 N Lamar Blvd`;
 * - a count of time or measure, `120 days`, `100%`, `300 ft`, `745 pm`;
 * - a number labelled as another thing, `check #1042`, `ck 1042`, `PO 512`,
 *   `Suite 300`, `Lot 214`, `permit 2031` (*check 1042* with no `#` still
 *   names the job, since *check* is also what the office does);
 * - a longer run of digits, `10425`, `1042-2026`, `512-1042-5555`.
 *
 * Still read as a job, because nothing around the digits says otherwise: a
 * clock time with no *am* or *pm* (`Arrive 645`), a count of things with no
 * unit (`284 rows`), and a price with no sign (`920 a fixture`).
 *
 * Most jobs carry a three-digit number, and three digits turn up in prose all
 * day (an area code, a street number, a count of days), which is why the
 * context decides and the bare digits do not. A wrong match cuts both ways: a
 * false match on another job's number holds an account entry back, and a false
 * match on a matter job's number sends an entry that is about other work.
 *
 * An explicit share wins: an entry the office shared by hand
 * (`held_overrides[key] === false`) goes whatever job it names
 * (`contactGoesWithShare`).
 *
 * Lives in `_shared` so the function and its test read one rule;
 * `src/lib/legal/legalContactScope.ts` is the client's door.
 */

type JobLike = { id?: unknown; hcp_number?: unknown; click_number?: unknown }

/** A job's number as the office writes it: HCP first, else Click (`effectiveJobLedgerNumber`). Lower-cased, trimmed. */
export function jobNumberOf(job: JobLike): string {
  const hcp = typeof job.hcp_number === 'string' ? job.hcp_number.trim() : ''
  const click = typeof job.click_number === 'string' ? job.click_number.trim() : ''
  return (hcp || click).toLowerCase()
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/** A run of digits that starts a span: never the tail of a word, a code (`C-219`) or a longer number. */
const NUM_START = '(?<![\\w.,/\\-#$])'

/**
 * What a number is labelled as when it is not a job: a payment, a purchase
 * order, a phone's extension or last four, a place, another file. Kept to
 * words the office numbers things by; *case*, *claim* and *order* are left
 * out because a collections note says *in case 512 pays* and *change order*.
 */
const OTHER_LABELS = [
  'ck', 'chk', 'cheque', 'confirmation',
  'po', 'p\\.o\\.',
  'ext', 'extension', 'ending(?:\\s+in)?', 'ends\\s+in', 'last\\s+(?:four|4)',
  'suite', 'ste', 'unit', 'apt', 'lot', 'room', 'rm', 'box', 'bldg', 'hwy', 'highway', 'fm', 'cr', 'route',
  'permit', 'acct', 'ticket', 'policy',
].join('|')

/** Labels that are also verbs or plain words (*check 512 and call back*): they label a number only with `#` or *no.* between. */
const LABELS_NEEDING_A_MARK = ['check', 'account', 'building'].join('|')

/**
 * What a count is a count of: time and measure only, and a clock time
 * (*745 pm*). A thing the job has
 * (*the 1042 fixtures*, *the 512 units*) is left out, since that names the job.
 */
const UNITS = [
  'days?', 'hrs?', 'hours?', 'weeks?', 'wks?', 'months?', 'mos?', 'years?', 'yrs?', 'minutes?', 'mins?',
  'ft', 'feet', 'foot', 'inch(?:es)?', 'lf', 'sf', 'sq', 'gal(?:lons?)?', 'psi', 'lbs?',
  'times', 'percent', 'pct', 'am', 'pm',
].join('|')

/** Street words that are not also everyday words (no *court*, *way*, *place*, *run*). */
const STREET_WORDS = ['st', 'street', 'ave', 'avenue', 'blvd', 'boulevard', 'rd', 'road', 'dr', 'drive', 'ln', 'lane', 'ct', 'pkwy', 'parkway', 'hwy', 'highway', 'trl', 'trail', 'cir', 'circle', 'cv', 'cove', 'ter', 'terrace'].join('|')

/** Words that are never part of a street's name, so `1042 is on the road` is not an address. */
const NOT_A_STREET_NAME = [
  'a', 'an', 'the', 'is', 'was', 'are', 'were', 'be', 'been', 'has', 'had', 'have', 'on', 'at', 'in', 'to', 'for', 'of', 'and', 'or', 'but', 'by', 'with', 'from', 'about', 're',
  'will', 'would', 'should', 'could', 'can', 'may', 'might', 'must', 'did', 'does', 'do', 'not', 'no', 'still', 'needs?', 'wants?', 'goes', 'going', 'went', 'gets?', 'got',
  'job', 'jobs', 'balance', 'invoice', 'bill', 'payment', 'pricing', 'they', 'he', 'she', 'we', 'i', 'it',
].join('|')

const NON_JOB_SPANS: ReadonlyArray<RegExp> = [
  // Phones: ten digits with an area code (spaces, dots or dashes), then seven with a dot or a dash.
  new RegExp(`(?<![\\w])(?:\\+?1[\\s.\\-]?)?(?:\\(\\d{3}\\)\\s?|\\d{3}[\\s.\\-])\\d{3}[\\s.\\-]\\d{4}(?!\\d)`, 'g'),
  new RegExp(`(?<![\\w])\\d{3}[.\\-]\\d{4}(?![\\w])`, 'g'),
  // Money: a dollar sign with a space, or the word after the amount. (`$1042` and `1042.50` never reach here.)
  new RegExp(`\\$\\s*\\d[\\d,]*(?:\\.\\d+)?`, 'g'),
  new RegExp(`${NUM_START}\\d[\\d,]*(?:\\.\\d+)?\\s*(?:dollars?|bucks|usd)\\b`, 'g'),
  // A number labelled as another thing: `check #1042`, `PO 512`, `ext. 204`, `Suite 300`.
  new RegExp(`(?<![\\w])(?:${OTHER_LABELS})\\.?\\s*(?:no\\.?|number|num\\.?)?\\s*[#:]?\\s*\\d+`, 'g'),
  new RegExp(`(?<![\\w])(?:${LABELS_NEEDING_A_MARK})\\s*(?:#|(?:no\\.?|number|num\\.?)\\s*[#:]?)\\s*\\d+`, 'g'),
  // A count of something: `120 days`, `100%`, `300 ft`.
  new RegExp(`${NUM_START}\\d+\\s*(?:%|(?:${UNITS})\\b)`, 'g'),
  // A street address: the number, a direction, one or two name words, a street word.
  new RegExp(`${NUM_START}\\d+\\s+(?:(?:n|s|e|w|ne|nw|se|sw|north|south|east|west)\\.?\\s+)?(?:(?!(?:${NOT_A_STREET_NAME})\\b)[a-z0-9'.]+\\s+){1,2}(?:${STREET_WORDS})\\b`, 'g'),
]

/**
 * The text, lower-cased, with every span that is plainly not a job's number
 * blanked out: phones, money, labelled numbers, counts and street addresses.
 * A span is blanked whatever stands before it, so *job 300 days late* names no
 * job; only a `#` holds a count or an address off (`#512 days late`).
 * Same length as the input, so positions still line up.
 */
export function nonJobSpans(text: string | null | undefined): string {
  let out = (text ?? '').toLowerCase()
  for (const re of NON_JOB_SPANS) out = out.replace(re, (m) => '~'.repeat(m.length))
  return out
}

/**
 * A number that reads as a year someone would write in a note, 1950 to 2049.
 * It names a job only with a marker before it. (No job carried such a number
 * on 2026-11-22; the window is fixed so the rule reads the same every year.)
 */
function readsAsYear(num: string): boolean {
  return /^(?:19[5-9]|20[0-4])\d$/.test(num)
}

/**
 * True when the text names job number `n` where it stands as a job's number:
 * outside every span `nonJobSpans` blanks, optionally after `#`, `J`, `job`,
 * `job#`, `invoice` or `bill`, never touching a letter, digit, `$`, a separator
 * or a dash before it; optionally followed by a bill suffix (`-1`, `-12`); and
 * never followed by a letter, a digit, or a separator and another digit. A
 * number that reads as a year needs the marker.
 */
export function textNamesJob(text: string | null | undefined, n: string): boolean {
  const num = n.trim().toLowerCase()
  if (num.length < 3) return false
  const marker = `(?:(?:jobs?|invoice|inv\\.?|bill)\\s*(?:no\\.?|number|num\\.?)?\\s*[#:]?\\s*|#|j)`
  const re = new RegExp(`(?<![\\w$.,/\\-#])${marker}${readsAsYear(num) ? '' : '?'}${escapeRegExp(num)}(?:-\\d{1,2}(?![\\w]))?(?![\\w]|[.,/\\-]\\d)`)
  return re.test(nonJobSpans(text))
}

/**
 * The two number sets for one matter: its jobs' numbers, and the numbers of
 * the payer's other jobs (a number shared with a matter job counts as the
 * matter's). Numbers shorter than three characters are left out; they are too
 * common in plain text to mean a job.
 */
export function contactScopeNumbers(matterJobs: ReadonlyArray<JobLike>, payerJobs: ReadonlyArray<JobLike>): { matter: Set<string>; other: Set<string> } {
  const matterIds = new Set(matterJobs.map((j) => j.id))
  const matter = new Set(matterJobs.map(jobNumberOf).filter((n) => n.length >= 3))
  const other = new Set(payerJobs.filter((j) => !matterIds.has(j.id)).map(jobNumberOf).filter((n) => n.length >= 3 && !matter.has(n)))
  return { matter, other }
}

export type ContactScope = 'matter' | 'other_job' | 'account'

/** Where one entry belongs: about the matter's jobs, about another job only, or about the account. */
export function contactScopeOf(text: string | null | undefined, numbers: { matter: ReadonlySet<string>; other: ReadonlySet<string> }): ContactScope {
  for (const n of numbers.matter) if (textNamesJob(text, n)) return 'matter'
  for (const n of numbers.other) if (textNamesJob(text, n)) return 'other_job'
  return 'account'
}

/** True when the entry goes to the firm: it names a matter job, or no job at all. */
export function contactGoesToCounsel(text: string | null | undefined, numbers: { matter: ReadonlySet<string>; other: ReadonlySet<string> }): boolean {
  return contactScopeOf(text, numbers) !== 'other_job'
}

/** The scope rule with the office's own say: an entry it shared by hand (`held_overrides[key] === false`) always goes. */
export function contactGoesWithShare(text: string | null | undefined, numbers: { matter: ReadonlySet<string>; other: ReadonlySet<string> }, override: unknown): boolean {
  return override === false || contactGoesToCounsel(text, numbers)
}
