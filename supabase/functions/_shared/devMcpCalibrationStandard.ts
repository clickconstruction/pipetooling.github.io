// dev-mcp's plan_calibration_standard / apply_calibration_standard (v2.7934 / 0.110.0): a person made a calibration
// standard, or no longer one, as the ★ Calibration standard card at Settings → System → Digital twins does
// (DigitalTwinsPanel.setCalibrationStandard) — users.calibration_standard on the person's own row, as the dev under the
// users table's dev update policy. The flag is a person's, never a twin's: a shadow scored against a standard's sent
// number counts toward Gate B, and against anyone else it is practice. Who may be made one is the panel's own rule
// (_shared/twinTeachers.ts): an estimating role, not a twin, not archived; a flag already set can always be lifted.
// No new RPC and no dry-run wrapper: the dry run is the server's own read of the person, of every standard and of the
// scored shadow runs that name the person as teacher, and the plan hash commits to them, so a standard set or lifted
// since the plan, by anyone, refuses the apply. The way back is the same pair with the other value.
// Pure: no network, no env. Tests: src/lib/devMcp/devMcpCalibrationStandard.test.ts.

import { TWIN_PANEL_DOOR } from './devMcpTwin.ts'
import { calibrationStandardSummary, calibrationStandardToast, canBeCalibrationStandard, TEACHER_ROLES, type TeacherCandidate } from './twinTeachers.ts'

type Json = Record<string, unknown>
const obj = (v: unknown): Json | null => (v && typeof v === 'object' && !Array.isArray(v) ? (v as Json) : null)
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export const CALIBRATION_STANDARD_VERBS = ['plan_calibration_standard', 'apply_calibration_standard'] as const
export type CalibrationStandardVerb = (typeof CALIBRATION_STANDARD_VERBS)[number]
export function isCalibrationStandardVerb(verb: string): verb is CalibrationStandardVerb {
  return (CALIBRATION_STANDARD_VERBS as readonly string[]).includes(verb)
}

/** What the verb carries after the shape check: the person, and whether they are a standard. */
export type CalibrationStandardPayload = { person: string; standard: boolean }
export type CalibrationStandardInput = { ok: true; p: CalibrationStandardPayload; target: string } | { ok: false; error: string }

/** The ask's shape, refused in words: a person by id, true or false, and no other key. */
export function calibrationStandardInput(verb: CalibrationStandardVerb, input: Json): CalibrationStandardInput {
  const src = obj(input.calibration)
  const shape = `${verb} needs calibration — { person (a users.id — find_person), standard (true: shadows scored against their sent bids count toward Gate B; false: those scores read as practice) }. The flag is a person's, never a twin's.`
  if (!src) return { ok: false, error: shape }
  const person = typeof src.person === 'string' ? src.person.trim().toLowerCase() : ''
  if (!UUID_RE.test(person)) return { ok: false, error: shape }
  if (typeof src.standard !== 'boolean') return { ok: false, error: shape }
  const extra = Object.keys(src).filter((k) => k !== 'person' && k !== 'standard')
  if (extra.length) return { ok: false, error: `${verb}: calibration takes person and standard alone, not ${extra.join(', ')}.` }
  return { ok: true, p: { person, standard: src.standard }, target: person }
}

/** The columns the server reads of the person and of every standard: the panel's own candidate row. */
export const CALIBRATION_PERSON_SELECT = 'id,name,email,role,is_digital_twin,archived_at,calibration_standard'
export type CalibrationPersonRow = TeacherCandidate

/** The columns the server reads of the scored shadow runs that name the person as teacher. */
export const CALIBRATION_RUN_SELECT = 'axis,assisted_at'
export type CalibrationRunRow = { axis: string | null; assisted_at: string | null }
/** How many of those runs one read carries; a count at the limit is said to be at least that many. */
export const CALIBRATION_RUNS_LIMIT = 1000

export type CalibrationWorld = {
  person: CalibrationPersonRow | null
  /** Every user flagged a standard today, the person among them when flagged. */
  standards: readonly CalibrationPersonRow[]
  /** The scored shadow runs whose teacher is the person; null when the read was refused. */
  runs: readonly CalibrationRunRow[] | null
}

const nameOf = (u: Pick<CalibrationPersonRow, 'name' | 'email'>): string => (u.name ?? '').trim() || u.email

/** The person's scored runs as the gate reads them: those that count beside those an estimator took robot fixtures on, by axis. */
export function calibrationRunCounts(runs: readonly CalibrationRunRow[]): { scored: number; counted: number; assisted: number; by_axis: Record<string, number> } {
  const by_axis: Record<string, number> = {}
  let assisted = 0
  for (const r of runs) {
    if (r.assisted_at) {
      assisted++
      continue
    }
    const axis = (r.axis ?? '').trim() || 'unclassified'
    by_axis[axis] = (by_axis[axis] ?? 0) + 1
  }
  return { scored: runs.length, counted: runs.length - assisted, assisted, by_axis: Object.fromEntries(Object.entries(by_axis).sort(([a], [b]) => a.localeCompare(b))) }
}

export type CalibrationDryRun = { ok: true; reply: Json; person: CalibrationPersonRow } | { ok: false; refused: string }

/**
 * The dry run: the person, the standards before and after, and the scored shadow runs that move into or out of the
 * gate with them. No such person, a person already as asked, and a new standard the panel would not offer (a twin, an
 * archived person, a role that sends no bids) are each refused in words.
 */
export function calibrationStandardDryRun(p: CalibrationStandardPayload, world: CalibrationWorld): CalibrationDryRun {
  const person = world.person
  if (!person) return { ok: false, refused: `No person ${p.person} is visible to you — find_person resolves a name.` }
  const who = nameOf(person)
  const before = world.standards.filter((u) => u.calibration_standard)
  if (!!person.calibration_standard === p.standard) {
    return { ok: false, refused: `Nothing to plan: ${who} is ${p.standard ? 'already a calibration standard' : 'not a calibration standard'}. ${calibrationStandardSummary(before)}` }
  }
  if (p.standard && !canBeCalibrationStandard(person)) {
    const why = person.is_digital_twin ? 'a digital twin, and the robots calibrate to people' : person.archived_at ? 'archived' : `a ${person.role}, and the roles that send bids the robots could learn from are ${[...TEACHER_ROLES].join(', ')}`
    return { ok: false, refused: `Nothing to plan: ${who} is ${why}. The ★ Calibration standard card at ${TWIN_PANEL_DOOR} does not offer them, and neither does this door.` }
  }
  const after = p.standard ? [...before, { ...person, calibration_standard: true }] : before.filter((u) => u.id !== person.id)
  const afterSorted = [...after].sort((a, b) => nameOf(a).localeCompare(nameOf(b)))
  const beforeSorted = [...before].sort((a, b) => nameOf(a).localeCompare(nameOf(b)))
  const counts = world.runs ? calibrationRunCounts(world.runs) : null
  const atLimit = !!world.runs && world.runs.length >= CALIBRATION_RUNS_LIMIT
  const n = counts?.counted ?? 0
  const runWords = !counts
    ? 'The scored shadow runs that name them as teacher could not be read, so how many move is not known.'
    : counts.scored === 0
      ? `No scored shadow run names ${who} as teacher yet, so no score moves today: the flag decides the ones to come.`
      : `${atLimit ? 'At least ' : ''}${n} scored shadow run${n === 1 ? '' : 's'} that name${n === 1 ? 's' : ''} ${who} as teacher ${p.standard ? `would count toward Gate B, where ${n === 1 ? 'it reads' : 'they read'} as practice today` : `would read as practice, where ${n === 1 ? 'it counts' : 'they count'} toward Gate B today`}.${counts.assisted ? ` ${counts.assisted} more ${counts.assisted === 1 ? 'is' : 'are'} assisted (the estimator took robot fixtures) and never count${counts.assisted === 1 ? 's' : ''} either way.` : ''}`
  const warnings: string[] = []
  if (!p.standard && after.length === 0) warnings.push('No calibration standard would be left: every shadow score counts as practice and Gate B cannot be met.')
  if (p.standard && before.length > 0) warnings.push(`${before.length === 1 ? `${nameOf(before[0]!)} is the standard today` : `${beforeSorted.map(nameOf).join(', ')} are the standards today`}, and ${who} would be one beside them: this door adds, it does not replace.`)
  return {
    ok: true,
    person,
    reply: {
      dry_run: true,
      person: { id: person.id, name: person.name, email: person.email, role: person.role, archived: Boolean(person.archived_at) },
      from: person.calibration_standard ? 'a calibration standard' : 'not a calibration standard',
      to: p.standard ? 'a calibration standard' : 'not a calibration standard',
      standards_before: beforeSorted.map((u) => ({ id: u.id, name: nameOf(u) })),
      standards_after: afterSorted.map((u) => ({ id: u.id, name: nameOf(u) })),
      scored_shadow_runs: counts ? { ...counts, at_least: atLimit } : null,
      warnings,
      then: `apply sets calibration_standard ${p.standard ? 'true' : 'false'} on their users row as you, as the ★ Calibration standard card at ${TWIN_PANEL_DOOR} does. ${calibrationStandardSummary(afterSorted)} ${runWords} The flag is read by score_shadows and the Scoreboard's gate math the next time either runs: no score is rewritten. The way back is this pair with standard: ${p.standard ? 'false' : 'true'}.`,
    },
  }
}

/** The write: the panel's own, calibration_standard on the person's row. */
export function calibrationStandardPatch(standard: boolean): Json {
  return { calibration_standard: standard }
}

/** The users filter the write is held to: this person, still as the plan read them, and for a new standard still a live person. */
export function calibrationStandardPatchQuery(person: Pick<CalibrationPersonRow, 'id'>, standard: boolean): string {
  return standard
    ? `id=eq.${person.id}&calibration_standard=not.is.true&is_digital_twin=not.is.true&archived_at=is.null`
    : `id=eq.${person.id}&calibration_standard=is.true`
}

/** The line after the write: the panel's own toast, and the way back; or why nothing moved. */
export function calibrationStandardAppliedWords(landed: boolean, person: CalibrationPersonRow, standard: boolean, heldWords = ''): string {
  const who = nameOf(person)
  if (!landed) return `Nothing changed: ${who} is ${standard ? 'still not' : 'still'} a calibration standard${heldWords ? ` (${heldWords})` : ''}. Plan again from the row as it stands.`
  return `${calibrationStandardToast(who, standard)} The way back is plan_calibration_standard { calibration: { person: "${person.id}", standard: ${standard ? 'false' : 'true'} } }.`
}
