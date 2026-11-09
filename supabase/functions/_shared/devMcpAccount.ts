// dev-mcp's account verbs (punch list #260's seat door, v2.6792): a teammate's app account made and worked with until
// the person is signed in — plan_account → apply_account (make a person, rename them, change their role or address),
// plan_login → apply_login (attach a login to a users row and send the sign-in email, or set a password, or remove the
// login), plan_password_reset → apply_password_reset (the recovery email, or a password the owner dictated) and the
// read get_login_state (where getting someone online stands, and the next press). Every write goes through the edge
// function or RPC the desk itself calls — add_worker, invite-user, create-user, send-sign-in-email, detach-login,
// change-user-email, set-user-password, resetPasswordForEmail — so the app's own rules hold (name collisions, the
// archived-name match of v2.6525, the dev gates inside each function, the read-only and twin fences). No new RPC, so
// rpc is null in WRITE_VERBS: the dry run is the server's own read of the users row, the roster row and the auth account's
// stamps, hashed with the ask, and an apply whose row moved since the plan is refused.
//
// Pure: no network, no env. The server (dev-mcp/index.ts) reads the world and runs the legs; this file says what the ask
// may name, what is refused and why, what each write becomes, and the words. Tests: src/lib/devMcp/devMcpAccount.test.ts.
//
// A password never comes back: the plan names only that one was set, the log keeps `(set, not logged)` in its place
// (argsWithoutPasswords), and redactSecrets blanks any `password` key in a reply besides.

import { attachRowRefusal, type AttachCandidate } from './attachLoginDoor.ts'
import { DETACH_WORDS, detachRowRefusal, type DetachCandidate } from './detachLoginDoor.ts'

type Json = Record<string, unknown>
const obj = (v: unknown): Json | null => (v && typeof v === 'object' && !Array.isArray(v) ? (v as Json) : null)
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const YMD_RE = /^\d{4}-\d{2}-\d{2}$/
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const HHMM_RE = /^\d{2}:\d{2}$/

export const ACCOUNT_VERBS = ['plan_account', 'apply_account', 'plan_login', 'apply_login', 'plan_password_reset', 'apply_password_reset'] as const
export type AccountVerb = (typeof ACCOUNT_VERBS)[number]
export function isAccountVerb(verb: string): verb is AccountVerb {
  return (ACCOUNT_VERBS as readonly string[]).includes(verb)
}

/** The roster kinds the Hire form offers (people.kind) and the users role each makes — the Users tab's own map. */
export const ACCOUNT_KINDS: Record<string, { role: string; label: string }> = {
  assistant: { role: 'assistant', label: 'an assistant' },
  controller: { role: 'controller', label: 'the controller' },
  master_technician: { role: 'master_technician', label: 'a leader' },
  sub: { role: 'subcontractor', label: 'a subcontractor' },
  helper: { role: 'helpers', label: 'a helper' },
  estimator: { role: 'estimator', label: 'an estimator' },
  primary: { role: 'primary', label: 'a primary' },
  superintendent: { role: 'superintendent', label: 'a superintendent' },
}
/** A users role named in place of a kind reads as its kind (`helpers` → helper, `subcontractor` → sub). */
export function kindOf(raw: string): { kind: string; role: string; label: string } | null {
  const k = raw.trim().toLowerCase()
  if (ACCOUNT_KINDS[k]) return { kind: k, ...ACCOUNT_KINDS[k] }
  for (const [kind, v] of Object.entries(ACCOUNT_KINDS)) if (v.role === k) return { kind, ...v }
  return null
}

/** Roles never paid through the pay tables (personKey's NO_PAY set, hireWrites). */
const NO_PAY_KINDS = new Set(['primary'])
export const PASSWORD_MIN = 6
export const NAME_MAX = 120
/** One recovery email per address per ten minutes (the owner's rule for the seat). */
export const RECOVERY_RESEND_MINUTES = 10

/**
 * The name-keyed pay and hours tables a rename cascades through, the Active Accounts window's and the desk's list
 * (src/lib/combinePeople.ts NAME_KEYED_TABLES; devMcpAccount.test.ts pins the two equal). A rename that forgot one
 * orphaned person_offsets and hours_reviewed rows under the old name before v2.1112.
 */
export const NAME_KEYED_PAY_TABLES = [
  'people_pay_config',
  'people_hours',
  'people_team_members',
  'people_hours_display_order',
  'people_crew_jobs',
  'people_crew_bids',
  'pay_stubs',
  'pay_stub_days',
  'person_offsets',
  'hours_reviewed',
] as const

// ---------------------------------------------------------------------------
// The rows the server reads
// ---------------------------------------------------------------------------

/** The users columns the dry run commits to. */
export const ACCOUNT_USER_SELECT = 'id,name,email,role,title,phone,login_attached_at,archived_at,is_sample,is_digital_twin,is_walk_tester,read_only,updated_at'
export type AccountUserRow = {
  id: string
  name: string | null
  email: string | null
  role: string
  title: string | null
  phone: string | null
  login_attached_at: string | null
  archived_at: string | null
  is_sample: boolean | null
  is_digital_twin: boolean | null
  is_walk_tester: boolean | null
  read_only: boolean | null
  updated_at: string | null
}

/** The roster row (people) behind the account, when one is linked. */
export const ACCOUNT_PERSON_SELECT = 'id,name,kind,email,phone,start_date,end_date,archived_at,account_user_id'
export type AccountPersonRow = {
  id: string
  name: string
  kind: string | null
  email: string | null
  phone: string | null
  start_date: string | null
  end_date: string | null
  archived_at: string | null
  account_user_id: string | null
}

/** The auth account's stamps (auth.users, read as the service role by id — timestamps alone, never a hash). */
export type AuthState = {
  email: string | null
  created_at: string | null
  invited_at: string | null
  confirmation_sent_at: string | null
  email_confirmed_at: string | null
  recovery_sent_at: string | null
  last_sign_in_at: string | null
  banned_until: string | null
}

/** The auth fields the seat keeps, picked by name off the admin read; anything else on the account stays behind. */
export function authStateOf(user: Record<string, unknown> | null | undefined): AuthState | null {
  if (!user) return null
  const s = (k: string): string | null => (typeof user[k] === 'string' && (user[k] as string) ? (user[k] as string) : null)
  return { email: s('email'), created_at: s('created_at'), invited_at: s('invited_at'), confirmation_sent_at: s('confirmation_sent_at'), email_confirmed_at: s('email_confirmed_at'), recovery_sent_at: s('recovery_sent_at'), last_sign_in_at: s('last_sign_in_at'), banned_until: s('banned_until') }
}

// ---------------------------------------------------------------------------
// Naming a person
// ---------------------------------------------------------------------------

/** How the ask names a person: a users.id or people.id, an address, or a name. */
export function personRefKind(ref: string): 'uuid' | 'email' | 'name' | 'empty' {
  const r = ref.trim()
  if (!r) return 'empty'
  if (UUID_RE.test(r)) return 'uuid'
  if (r.includes('@')) return 'email'
  return 'name'
}

/** PostgREST `ilike` wildcard is `*`; a literal `*`, `,` or a paren in the text would change the pattern. */
export const likeTerm = (text: string): string => `*${text.trim().replace(/[*,()]/g, ' ').replace(/\s+/g, '*')}*`

/** The one users row a name picks: a single match, else the exact one; several or none are refused in words. */
export function pickByName(matches: readonly Pick<AccountUserRow, 'id' | 'name' | 'email' | 'role'>[], ref: string): { id: string } | { refused: string } {
  if (matches.length === 1) return { id: matches[0]!.id }
  const wanted = ref.trim().toLowerCase()
  const exact = matches.filter((m) => (m.name ?? '').trim().toLowerCase() === wanted)
  if (exact.length === 1) return { id: exact[0]!.id }
  if (matches.length === 0) return { refused: `No account matches "${ref.trim()}". find_person searches logins; a person with no login is on the roster by name. To make one, plan_account with new.` }
  return { refused: `"${ref.trim()}" matches ${matches.length} accounts — pass the id of one: ${matches.slice(0, 8).map((m) => `${m.name ?? m.email ?? '?'} (${m.id})`).join('; ')}` }
}

// ---------------------------------------------------------------------------
// plan_account / apply_account — the shape
// ---------------------------------------------------------------------------

export type AccountNew = { name: string; email: string | null; kind: string; role: string; start_date: string; training: boolean; sign_in: 'none' | 'email' | 'password'; password?: string; phone: string | null; notes: string | null }
export type AccountRename = { name?: string; title?: string | null; phone?: string | null }
export type AccountPay = { hourly_wage: number; is_salary: boolean; workday_start: string | null }
export type AccountPayload = { person?: string; new?: AccountNew; rename?: AccountRename; role?: string; email?: string; pay?: AccountPay }
export type AccountInput = { ok: true; p: AccountPayload; target: string } | { ok: false; error: string }

const ACCOUNT_SHAPE = `needs account — { person (a users.id, a people.id, an address or a name matching one account) with one or more changes: rename: { name?, title?, phone? }, role (${Object.keys(ACCOUNT_KINDS).join(' | ')}), email (the address they sign in with; refused when another row holds it) — or new: { name, kind (${Object.keys(ACCOUNT_KINDS).join(' | ')}), email?, start_date? (YYYY-MM-DD, today when left out), sign_in? (none | email | password — email when an address is given: the invite link; password: a password you set, no mail; none: on the roster with no login, a login attached later), password? (with sign_in password, at least ${PASSWORD_MIN} characters), training? (start in training mode), phone?, notes? } with pay?: { hourly_wage, is_salary?, workday_start? (HH:MM, a salaried day's start) } — the Hire form's run: the users row, the roster row, the pay row; never the paperwork packet }.`

const str = (o: Json, k: string): string => (typeof o[k] === 'string' ? (o[k] as string).trim() : '')
const blankToNull = (s: string): string | null => (s === '' ? null : s)

/** The ask's shape, refused in words. `today` fills a left-out start date so the plan and its apply hash alike within the day. */
export function accountInput(verb: 'plan_account' | 'apply_account', input: Json, today: string): AccountInput {
  const a = obj(input.account)
  const shape = `${verb} ${ACCOUNT_SHAPE}`
  if (!a) return { ok: false, error: shape }
  const person = str(a, 'person')
  const fresh = obj(a.new)
  if ((person === '') === !fresh) return { ok: false, error: `${verb}: name one of person (an account to change) or new (a person to make), not both and not neither. ${ACCOUNT_SHAPE}` }
  const rename = obj(a.rename)
  const roleRaw = str(a, 'role')
  const emailRaw = str(a, 'email').toLowerCase()
  const pay = obj(a.pay)
  if (fresh) {
    if (rename || roleRaw || emailRaw) return { ok: false, error: `${verb}: a new person is made with their name, kind and address inside new; rename, role and email change an account that exists. Make them first, then plan the change.` }
    const name = str(fresh, 'name').replace(/\s+/g, ' ')
    if (!name) return { ok: false, error: `${verb}: new.name is required — the name the roster and the pay tables carry.` }
    if (name.length > NAME_MAX) return { ok: false, error: `${verb}: new.name is over ${NAME_MAX} characters.` }
    const kind = kindOf(str(fresh, 'kind'))
    if (!kind) return { ok: false, error: `${verb}: new.kind must be one of ${Object.keys(ACCOUNT_KINDS).join(', ')} (a dev account is made by a dev signed in, on People → Users).` }
    const email = str(fresh, 'email').toLowerCase()
    if (email && !EMAIL_RE.test(email)) return { ok: false, error: `${verb}: "${email}" does not look like an address.` }
    const startDate = str(fresh, 'start_date') || today
    if (!YMD_RE.test(startDate)) return { ok: false, error: `${verb}: new.start_date must be YYYY-MM-DD.` }
    const signInRaw = str(fresh, 'sign_in').toLowerCase()
    const signIn = signInRaw || (email ? 'email' : 'none')
    if (signIn !== 'none' && signIn !== 'email' && signIn !== 'password') return { ok: false, error: `${verb}: new.sign_in must be none, email or password.` }
    if (signIn !== 'none' && !email) return { ok: false, error: `${verb}: sign_in ${signIn} needs new.email — the address the invite or the login is made on. With no address, sign_in none puts them on the roster and a login attaches later (plan_login).` }
    const password = typeof fresh.password === 'string' ? fresh.password : ''
    if (signIn === 'password' && password.length < PASSWORD_MIN) return { ok: false, error: `${verb}: sign_in password needs new.password, at least ${PASSWORD_MIN} characters. The seat never prints it back.` }
    if (signIn !== 'password' && password) return { ok: false, error: `${verb}: new.password goes with sign_in password; with sign_in email the person chooses their own from the link.` }
    if (fresh.training !== undefined && typeof fresh.training !== 'boolean') return { ok: false, error: `${verb}: new.training must be true or false.` }
    const made: AccountNew = { name, email: blankToNull(email), kind: kind.kind, role: kind.role, start_date: startDate, training: fresh.training === true, sign_in: signIn, phone: blankToNull(str(fresh, 'phone')), notes: blankToNull(str(fresh, 'notes')) }
    if (signIn === 'password') made.password = password
    const p: AccountPayload = { new: made }
    if (pay) {
      if (NO_PAY_KINDS.has(kind.kind)) return { ok: false, error: `${verb}: ${kind.label} is never paid through the pay tables; leave pay out.` }
      const wage = typeof pay.hourly_wage === 'number' ? pay.hourly_wage : NaN
      if (!(wage > 0)) return { ok: false, error: `${verb}: pay.hourly_wage must be a number over 0 — a pay row with no wage cannot be paid; a salaried hire's is the rate the flat 8-hour day is priced at.` }
      if (pay.is_salary !== undefined && typeof pay.is_salary !== 'boolean') return { ok: false, error: `${verb}: pay.is_salary must be true or false.` }
      const workdayStart = str(pay, 'workday_start')
      if (workdayStart && !HHMM_RE.test(workdayStart)) return { ok: false, error: `${verb}: pay.workday_start must be HH:MM.` }
      if (pay.is_salary === true && !workdayStart) return { ok: false, error: `${verb}: a salaried hire needs pay.workday_start (HH:MM), the 8-hour day's start.` }
      p.pay = { hourly_wage: Math.round(wage * 100) / 100, is_salary: pay.is_salary === true, workday_start: blankToNull(workdayStart) }
    }
    return { ok: true, p, target: email || name }
  }
  if (pay) return { ok: false, error: `${verb}: pay goes with new — a wage on a person who exists is changed on their desk's Pay section.` }
  if (!rename && !roleRaw && !emailRaw) return { ok: false, error: `${verb}: name at least one change for ${person}: rename, role or email. ${ACCOUNT_SHAPE}` }
  const p: AccountPayload = { person }
  if (rename) {
    const r: AccountRename = {}
    if (rename.name !== undefined) {
      const name = str(rename, 'name').replace(/\s+/g, ' ')
      if (!name) return { ok: false, error: `${verb}: rename.name is empty — type the name as it should read.` }
      if (name.length > NAME_MAX) return { ok: false, error: `${verb}: rename.name is over ${NAME_MAX} characters.` }
      r.name = name
    }
    if (rename.title !== undefined) r.title = rename.title === null ? null : blankToNull(str(rename, 'title'))
    if (rename.phone !== undefined) r.phone = rename.phone === null ? null : blankToNull(str(rename, 'phone'))
    if (r.name === undefined && r.title === undefined && r.phone === undefined) return { ok: false, error: `${verb}: rename names nothing — give name, title or phone.` }
    p.rename = r
  }
  if (roleRaw) {
    const kind = kindOf(roleRaw)
    if (!kind) return { ok: false, error: `${verb}: role must be one of ${Object.keys(ACCOUNT_KINDS).join(', ')} (a dev is made or unmade by a dev signed in).` }
    p.role = kind.role
  }
  if (emailRaw) {
    if (!EMAIL_RE.test(emailRaw)) return { ok: false, error: `${verb}: "${emailRaw}" does not look like an address.` }
    p.email = emailRaw
  }
  return { ok: true, p, target: person }
}

// ---------------------------------------------------------------------------
// plan_account / apply_account — the dry run
// ---------------------------------------------------------------------------

/** What the server read before the dry run: the account named (or none), its roster row, and who else holds the name or the address. */
export type AccountWorld = {
  user: AccountUserRow | null
  person: AccountPersonRow | null
  /** A live account or roster row, not this one, carrying the exact name a create or rename would take. */
  nameHolder: { where: 'account' | 'roster'; id: string; name: string } | null
  /** An account, not this one, whose address a create or set_email would take. */
  emailHolder: { id: string; name: string | null } | null
  /** An archived teammate carrying the name or the address (v2.6525: Bring back, never a second row). */
  archivedMatch: { id: string; name: string | null; by: 'name' | 'email' | 'both'; left: string | null } | null
}

export type AccountDryRun = { ok: true; reply: Json } | { ok: false; refused: string }

/** The account's facts the plan commits to — every column a change could move, and updated_at, so a save by anyone since refuses the apply. */
export function accountFacts(u: AccountUserRow, person: AccountPersonRow | null): Json {
  return {
    id: u.id,
    name: u.name,
    email: u.email,
    role: u.role,
    title: u.title,
    phone: u.phone,
    login: u.login_attached_at ? 'attached' : 'none',
    login_attached_at: u.login_attached_at,
    training_mode: u.read_only === true,
    updated_at: u.updated_at,
    roster_row: person ? { id: person.id, name: person.name, kind: person.kind, start_date: person.start_date } : null,
  }
}

/** The refusals every account verb shares once the row is read: a fixture account, an archived one. */
function standingRefusal(u: AccountUserRow): string | null {
  const who = (u.name ?? '').trim() || 'This account'
  if (u.is_sample || u.is_digital_twin || u.is_walk_tester) return `${who} is a sample, a twin or the walk tester: a fixture account kept from its own door (Settings → People & teams), never through this one.`
  if (u.archived_at) return `${who} is archived (${u.archived_at.slice(0, 10)}). Bring them back from their desk first; the seat does not restore an account.`
  return null
}

export function accountDryRun(p: AccountPayload, world: AccountWorld, caller: { userId: string }): AccountDryRun {
  if (p.new) {
    const n = p.new
    if (world.archivedMatch) {
      const by = world.archivedMatch.by === 'both' ? 'that name and that address' : world.archivedMatch.by === 'name' ? 'that name' : 'that address'
      return { ok: false, refused: `Nothing to plan: ${world.archivedMatch.name ?? 'an archived teammate'} (${world.archivedMatch.id}) is archived with ${by}${world.archivedMatch.left ? `, gone since ${world.archivedMatch.left}` : ''}. A returner comes back on the same account — Bring back on their desk — so their hours and HR file stay with them; the seat never makes a second row.` }
    }
    if (world.nameHolder) return { ok: false, refused: `Nothing to plan: ${world.nameHolder.name} already carries that exact name (${world.nameHolder.where} ${world.nameHolder.id}). The pay tables are keyed by name, so a second row would share their pay. Use a middle initial or a suffix, or change the one that exists.` }
    if (world.emailHolder) return { ok: false, refused: `Nothing to plan: ${world.emailHolder.name ?? 'an account'} (${world.emailHolder.id}) already has the address ${n.email}. Open their desk instead; get_login_state(${n.email}) says where they stand.` }
    const kind = kindOf(n.kind)!
    const signIn = n.sign_in === 'email' ? { how: 'email', words: `invite-user makes the login and emails ${n.email} the link that sets their password; the users row and the roster row are born linked.` } : n.sign_in === 'password' ? { how: 'password', words: `create-user makes the login on ${n.email} with the password you set (not shown here, never logged); no email goes. The users row and the roster row are born linked.` } : { how: 'none', words: `add_worker makes the users row with no login and the roster row linked to it${n.email ? `, the address ${n.email} kept on both` : ''}; plan_login attaches a login later on the same id.` }
    const reply: Json = {
      dry_run: true,
      action: 'create',
      person: { name: n.name, kind: n.kind, role: n.role, as: kind.label, email: n.email, start_date: n.start_date, training_mode: n.training, phone: n.phone, notes: n.notes },
      sign_in: signIn,
      pay: p.pay ? { hourly_wage: p.pay.hourly_wage, is_salary: p.pay.is_salary, workday_start: p.pay.workday_start, words: p.pay.is_salary ? `salaried at ${p.pay.hourly_wage.toFixed(2)}/h, the flat 8-hour day from ${p.pay.workday_start}, weekdays; sessions appear on the clock strip by themselves` : `${p.pay.hourly_wage.toFixed(2)}/h on the pay row, keyed by the name` } : null,
      not_written: 'the paperwork packet — assign it from Contracts',
      then: `apply makes ${n.name} as ${kind.label}${p.pay ? ' with the pay row' : ''}, then get_login_state(${n.email ?? JSON.stringify(n.name)}) says where they stand.`,
    }
    return { ok: true, reply }
  }
  const u = world.user
  if (!u) return { ok: false, refused: `No account for ${p.person} — not a users.id, a people.id, an address or a name that matches one. find_person searches logins; a person with no login is on the roster by name. To make one, plan_account with new.` }
  const standing = standingRefusal(u)
  if (standing) return { ok: false, refused: standing }
  const changes: Json[] = []
  const who = (u.name ?? '').trim() || u.email || u.id
  if (p.rename) {
    const r = p.rename
    if (r.name !== undefined) {
      if ((u.name ?? '').trim() === r.name && r.title === undefined && r.phone === undefined) return { ok: false, refused: `Nothing to plan: ${who} already reads ${JSON.stringify(r.name)}.` }
      if (world.nameHolder && (u.name ?? '').trim() !== r.name) return { ok: false, refused: `Nothing to plan: ${world.nameHolder.name} already carries the name ${JSON.stringify(r.name)} (${world.nameHolder.where} ${world.nameHolder.id}). Names must be unique: the pay tables are keyed by them.` }
    }
    const oldNames = [...new Set([u.name ?? '', world.person?.name ?? ''].map((s) => s.trim()).filter((s) => s && s !== r.name))]
    changes.push({
      change: 'rename',
      ...(r.name !== undefined ? { name: { from: u.name, to: r.name }, roster_row: world.person ? { from: world.person.name, to: r.name } : null, cascade: oldNames.length ? `the name-keyed pay and hours rows under ${oldNames.map((n) => JSON.stringify(n)).join(' and ')} follow to ${JSON.stringify(r.name)} (${NAME_KEYED_PAY_TABLES.length} tables)` : 'no pay rows to carry' } : {}),
      ...(r.title !== undefined ? { title: { from: u.title, to: r.title } } : {}),
      ...(r.phone !== undefined ? { phone: { from: u.phone, to: r.phone } } : {}),
    })
  }
  if (p.role) {
    if (u.id === caller.userId) return { ok: false, refused: 'Nothing to plan: your own role stays yours; another dev changes it on your desk.' }
    if (u.role === 'dev') return { ok: false, refused: `Nothing to plan: ${who} is a dev; a dev's role is changed by a dev signed in, on their desk.` }
    if (u.role === p.role) return { ok: false, refused: `Nothing to plan: ${who} is already ${kindOf(p.role)!.label}.` }
    changes.push({ change: 'set_role', role: { from: u.role, to: p.role }, words: `${who} becomes ${kindOf(p.role)!.label}; the roster row keeps its kind, as the desk's role change does, and the person's trades and extra doors stay as set.` })
  }
  if (p.email) {
    if ((u.email ?? '').toLowerCase() === p.email) return { ok: false, refused: `Nothing to plan: ${who} already has the address ${p.email}.` }
    if (world.emailHolder) return { ok: false, refused: `Nothing to plan: ${world.emailHolder.name ?? 'an account'} (${world.emailHolder.id}) already has the address ${p.email}. Two accounts never share one.` }
    changes.push({
      change: 'set_email',
      email: { from: u.email, to: p.email },
      how: u.login_attached_at ? 'change-user-email moves the login and the app\'s copy together, confirmed, so no confirmation mail goes; the roster row that held the old address follows.' : 'no login yet, so the app\'s copy alone changes, on the users row and the roster row; the login is made on this address when plan_login attaches it.',
    })
  }
  return {
    ok: true,
    reply: {
      dry_run: true,
      action: 'change',
      account: accountFacts(u, world.person),
      changes,
      then: `apply writes the ${changes.length === 1 ? 'change' : `${changes.length} changes`} as you, each reported done or held with its reason; the plan commits to the row as it reads now, so a save by anyone since refuses it.`,
    },
  }
}

/** The pay row the Hire form upserts (people_pay_config, keyed by the pay name). */
export function payConfigRow(p: AccountPay, name: string, personId: string | null): Json {
  return { person_name: name, person_id: personId, hourly_wage: p.hourly_wage, office_hourly_wage: null, is_salary: p.is_salary, record_hours_but_salary: false }
}

/** The salaried workday template the Hire form saves: one continuous 8-hour block from the start, weekdays. */
export function salaryTemplateRow(userId: string, workdayStart: string, timezone: string): Json {
  const start = workdayStart.length === 5 ? `${workdayStart}:00` : workdayStart
  return { user_id: userId, timezone, exclude_weekends: true, mode: 'continuous', segment_a_start_local: start, segment_a_duration_minutes: 480, segment_b_start_local: null, segment_b_duration_minutes: null, use_split_focus: false, job_ledger_id: null, bid_id: null, segment_b_job_ledger_id: null, segment_b_bid_id: null }
}

/** add_worker's arguments from a create with no login. */
export function addWorkerArgs(n: AccountNew): Json {
  return { p_name: n.name, p_kind: n.kind, p_email: n.email, p_phone: n.phone, p_notes: n.notes, p_start_date: n.start_date }
}

/** The body invite-user or create-user takes from a create that makes a login. */
export function createLoginBody(n: AccountNew, redirectTo: string): Json {
  const base: Json = { email: n.email, role: n.role, name: n.name, read_only: n.training, start_date: n.start_date }
  if (n.sign_in === 'password') return { ...base, password: n.password }
  return { ...base, redirectTo }
}

/** One applied change or hold, in the order planned. */
export type AccountStep = { step: string; ok: boolean; words: string }

export function accountAppliedWords(steps: AccountStep[], ref: string): string {
  const held = steps.filter((s) => !s.ok)
  if (held.length === 0) return `Done. get_login_state(${JSON.stringify(ref)}) says where they stand and the next press.`
  return `${steps.length - held.length} of ${steps.length} done; held: ${held.map((h) => `${h.step} (${h.words})`).join('; ')}. Fix the reason and plan again for what is left; what landed stays.`
}

// ---------------------------------------------------------------------------
// plan_login / apply_login
// ---------------------------------------------------------------------------

export type LoginPayload = { person: string; action: 'attach' | 'remove'; mode?: 'email' | 'password'; password?: string; email?: string }
export type LoginInput = { ok: true; p: LoginPayload; target: string } | { ok: false; error: string }

export function loginInput(verb: 'plan_login' | 'apply_login', input: Json): LoginInput {
  const l = obj(input.login)
  const shape = `${verb} needs login — { person (a users.id, a people.id, an address or a name matching one account with no login), mode? (email: the login is made on the row's id and the sign-in email goes, the default; password: a password you set, at least ${PASSWORD_MIN} characters, no mail), password?, email? (the address to attach on, when the row carries none or a different one), remove?: true (the desk's Remove the login: the sign-in, any password and their push devices go; the person, their hours, pay and paperwork stay) }.`
  if (!l) return { ok: false, error: shape }
  const person = str(l, 'person')
  if (!person) return { ok: false, error: shape }
  if (l.remove === true) {
    if (l.mode !== undefined || l.password !== undefined || l.email !== undefined) return { ok: false, error: `${verb}: remove goes alone — nothing is attached in the same plan.` }
    return { ok: true, p: { person, action: 'remove' }, target: person }
  }
  if (l.remove !== undefined && l.remove !== false) return { ok: false, error: `${verb}: remove must be true.` }
  const mode = (str(l, 'mode').toLowerCase() || 'email') as string
  if (mode !== 'email' && mode !== 'password') return { ok: false, error: `${verb}: mode must be email or password.` }
  const password = typeof l.password === 'string' ? l.password : ''
  if (mode === 'password' && password.length < PASSWORD_MIN) return { ok: false, error: `${verb}: mode password needs password, at least ${PASSWORD_MIN} characters. The seat never prints it back.` }
  if (mode === 'email' && password) return { ok: false, error: `${verb}: password goes with mode password; with mode email the person chooses their own from the link.` }
  const email = str(l, 'email').toLowerCase()
  if (email && !EMAIL_RE.test(email)) return { ok: false, error: `${verb}: "${email}" does not look like an address.` }
  const p: LoginPayload = { person, action: 'attach', mode }
  if (mode === 'password') p.password = password
  if (email) p.email = email
  return { ok: true, p, target: person }
}

export function loginDryRun(p: LoginPayload, u: AccountUserRow | null, person: AccountPersonRow | null, emailHolder: { id: string; name: string | null } | null, caller: { userId: string }): AccountDryRun {
  if (!u) return { ok: false, refused: `No account for ${p.person} — not a users.id, a people.id, an address or a name that matches one. A login attaches to a users row; plan_account with new makes the row (sign_in email makes the row and the login in one go).` }
  const who = (u.name ?? '').trim() || u.email || u.id
  if (p.action === 'remove') {
    const candidate: DetachCandidate = { id: u.id, name: u.name, login_attached_at: u.login_attached_at, is_sample: u.is_sample, is_digital_twin: u.is_digital_twin }
    const refusal = detachRowRefusal(candidate, caller.userId)
    if (refusal) return { ok: false, refused: `Nothing to plan: ${refusal.error}` }
    if (u.is_walk_tester) return { ok: false, refused: 'Nothing to plan: the walk tester keeps its login; the walk kit retires it.' }
    return { ok: true, reply: { dry_run: true, action: 'remove', account: accountFacts(u, person), goes: DETACH_WORDS.goes, stays: DETACH_WORDS.stays, then: `apply calls detach-login as you: the auth account behind ${who} goes and the row reads no login; plan_login attaches one again on the same id.` } }
  }
  const candidate: AttachCandidate = { id: u.id, name: u.name, role: u.role, email: u.email, login_attached_at: u.login_attached_at, is_sample: u.is_sample, is_digital_twin: u.is_digital_twin, archived_at: u.archived_at }
  const refusal = attachRowRefusal(candidate)
  if (refusal) return { ok: false, refused: `Nothing to plan: ${refusal.error}${u.login_attached_at ? ` get_login_state(${JSON.stringify(who)}) says where they stand; plan_password_reset sends a fresh link.` : ''}` }
  if (u.is_walk_tester) return { ok: false, refused: 'Nothing to plan: the walk tester gets its login from the walk kit.' }
  const email = p.email ?? (u.email ?? '').toLowerCase()
  if (!email) return { ok: false, refused: `Nothing to plan: ${who} has no address on the row. Pass login.email — the address they will sign in with.` }
  if (emailHolder) return { ok: false, refused: `Nothing to plan: ${emailHolder.name ?? 'an account'} (${emailHolder.id}) already has the address ${email}. Two accounts never share one.` }
  const how = p.mode === 'password'
    ? `create-user makes the login on ${who}'s own id with the password you set (not shown here, never logged); no email goes. Tell them the password yourself.`
    : `create-user makes the login on ${who}'s own id with an unguessable password, then send-sign-in-email emails ${email} a link that signs them in; they set their own password from Settings, or plan_password_reset sends the reset link.`
  return {
    ok: true,
    reply: {
      dry_run: true,
      action: 'attach',
      account: accountFacts(u, person),
      email,
      address_changes: email !== (u.email ?? '').toLowerCase() ? { from: u.email, to: email } : null,
      mode: p.mode,
      how,
      stays: 'the person, their hours, Charged as, pay, paperwork and portal — nothing that points at the row moves',
      then: `apply attaches the login as you. Then get_login_state(${JSON.stringify(who)}) tells when the email went and whether they have signed in.`,
    },
  }
}

export function loginAppliedWords(p: LoginPayload, who: string, emailSent: boolean | null): string {
  if (p.action === 'remove') return `The login behind ${who} is gone; the row reads no login. ${DETACH_WORDS.stays.charAt(0).toUpperCase()}${DETACH_WORDS.stays.slice(1)}. plan_login attaches one again on the same id.`
  if (p.mode === 'password') return `The login is attached to ${who} with the password you set. Tell them the password yourself; the seat never prints it. get_login_state says when they first sign in.`
  if (emailSent) return `The login is attached to ${who} and the sign-in email went. Call get_login_state in a few minutes: it says whether the link was used.`
  return `The login is attached to ${who}, but the sign-in email did not go. plan_password_reset sends them a link to set a password.`
}

// ---------------------------------------------------------------------------
// plan_password_reset / apply_password_reset
// ---------------------------------------------------------------------------

export type PasswordResetPayload = { person: string; mode: 'email' | 'password'; password?: string }
export type PasswordResetInput = { ok: true; p: PasswordResetPayload; target: string } | { ok: false; error: string }

export function passwordResetInput(verb: 'plan_password_reset' | 'apply_password_reset', input: Json): PasswordResetInput {
  const r = obj(input.reset)
  const shape = `${verb} needs reset — { person (a users.id, a people.id, an address or a name matching one account with a login), mode? (email: the app's own Forgot password email with the reset link, the default, one per address per ${RECOVERY_RESEND_MINUTES} minutes; password: a password you set, at least ${PASSWORD_MIN} characters, no mail), password? }. Refused for your own account and for a sample, a twin or an archived person.`
  if (!r) return { ok: false, error: shape }
  const person = str(r, 'person')
  if (!person) return { ok: false, error: shape }
  const mode = str(r, 'mode').toLowerCase() || 'email'
  if (mode !== 'email' && mode !== 'password') return { ok: false, error: `${verb}: mode must be email or password.` }
  const password = typeof r.password === 'string' ? r.password : ''
  if (mode === 'password' && password.length < PASSWORD_MIN) return { ok: false, error: `${verb}: mode password needs password, at least ${PASSWORD_MIN} characters. The seat never prints it back.` }
  if (mode === 'email' && password) return { ok: false, error: `${verb}: password goes with mode password; with mode email they choose their own from the link.` }
  const p: PasswordResetPayload = { person, mode }
  if (mode === 'password') p.password = password
  return { ok: true, p, target: person }
}

/** Minutes between two stamps, floored; null when either is missing or unreadable. */
export function minutesBetween(fromIso: string | null, toIso: string): number | null {
  if (!fromIso) return null
  const a = Date.parse(fromIso)
  const b = Date.parse(toIso)
  if (!Number.isFinite(a) || !Number.isFinite(b)) return null
  return Math.floor((b - a) / 60_000)
}

export function passwordResetDryRun(p: PasswordResetPayload, u: AccountUserRow | null, person: AccountPersonRow | null, auth: AuthState | null, caller: { userId: string }, nowIso: string): AccountDryRun {
  if (!u) return { ok: false, refused: `No account for ${p.person} — not a users.id, a people.id, an address or a name that matches one.` }
  const who = (u.name ?? '').trim() || u.email || u.id
  if (u.id === caller.userId) return { ok: false, refused: 'Nothing to plan: your own password is yours — Settings → Your account, or the sign-in page\'s Forgot password.' }
  const standing = standingRefusal(u)
  if (standing) return { ok: false, refused: `Nothing to plan: ${standing}` }
  if (!u.login_attached_at || !u.email) return { ok: false, refused: `Nothing to plan: ${who} has no login to reset a password on. plan_login attaches one and sends the sign-in email.` }
  if (auth?.banned_until && Date.parse(auth.banned_until) > Date.parse(nowIso)) return { ok: false, refused: `Nothing to plan: ${who}'s sign-in is banned until ${auth.banned_until}; a reset would land on a door that is shut.` }
  if (p.mode === 'email') {
    const since = minutesBetween(auth?.recovery_sent_at ?? null, nowIso)
    if (since !== null && since >= 0 && since < RECOVERY_RESEND_MINUTES) {
      const again = new Date(Date.parse(auth!.recovery_sent_at!) + RECOVERY_RESEND_MINUTES * 60_000).toISOString()
      return { ok: false, refused: `Nothing to plan: a link went to ${u.email} ${since === 0 ? 'under a minute' : `${since} minute${since === 1 ? '' : 's'}`} ago (${auth!.recovery_sent_at}). One send per address per ${RECOVERY_RESEND_MINUTES} minutes: plan again after ${again}. get_login_state says whether the last one was used.` }
    }
  }
  return {
    ok: true,
    reply: {
      dry_run: true,
      action: p.mode === 'email' ? 'send_reset_email' : 'set_password',
      account: accountFacts(u, person),
      email: u.email,
      last_link_sent_at: auth?.recovery_sent_at ?? null,
      last_sign_in_at: auth?.last_sign_in_at ?? null,
      how: p.mode === 'email'
        ? `the app's own Forgot password email (resetPasswordForEmail) goes to ${u.email} with the reset link, landing on /reset-password-confirm, where they choose a new password; the old one keeps working until they do.`
        : `set-user-password sets the password you gave (not shown here, never logged) on ${who}'s login now; every signed-in session of theirs stays signed in. Tell them the password yourself.`,
      then: p.mode === 'email' ? `apply sends it as you; get_login_state then says when it went and whether it was used.` : `apply sets it as you; get_login_state says when they next sign in.`,
    },
  }
}

export function passwordResetAppliedWords(p: PasswordResetPayload, who: string, email: string | null, sentAt: string | null): string {
  if (p.mode === 'password') return `The password on ${who}'s login is set. Tell them yourself; the seat never prints it. get_login_state says when they next sign in.`
  return `The reset email went to ${email ?? 'their address'}${sentAt ? ` (${sentAt})` : ''}. Call get_login_state in a few minutes: it says whether the link was used. One send per address per ${RECOVERY_RESEND_MINUTES} minutes.`
}

// ---------------------------------------------------------------------------
// get_login_state — where getting someone online stands
// ---------------------------------------------------------------------------

export type LoginStage = 'no_account' | 'archived' | 'no_login' | 'login_no_auth' | 'invite_sent' | 'link_sent' | 'login_quiet' | 'signed_in'

/** "just now", "3 minutes ago", "2 hours ago", "4 days ago" — words for a stamp against now. */
export function agoWords(iso: string | null, nowIso: string): string | null {
  const m = minutesBetween(iso, nowIso)
  if (m === null) return null
  if (m < 1) return 'just now'
  if (m < 60) return `${m} minute${m === 1 ? '' : 's'} ago`
  const h = Math.floor(m / 60)
  if (h < 48) return `${h} hour${h === 1 ? '' : 's'} ago`
  const d = Math.floor(h / 24)
  return `${d} day${d === 1 ? '' : 's'} ago`
}

const stamp = (iso: string | null, nowIso: string): string => (iso ? `${agoWords(iso, nowIso)} (${iso})` : 'never')

/**
 * The reading: one stage, the words a session says to the person it is walking through, and the next press. Pure over the
 * users row, the roster row and the auth account's stamps. A read, never hashed, so the words may carry "3 minutes ago".
 */
export function loginStateReading(ref: string, u: AccountUserRow | null, person: AccountPersonRow | null, auth: AuthState | null, nowIso: string): Json {
  if (!u) {
    return { ref, stage: 'no_account' as LoginStage, words: `No app account matches ${JSON.stringify(ref)}.`, next: 'plan_account with new makes the person: sign_in email makes the login and sends the invite in one go; sign_in none puts them on the roster and plan_login attaches a login later.', account: null, person: person ? { id: person.id, name: person.name } : null, auth: null }
  }
  const who = (u.name ?? '').trim() || u.email || u.id
  const account = accountFacts(u, person)
  const facts = auth ? { ...auth } : null
  const base = { ref, account, auth: facts, checked_at: nowIso }
  if (u.archived_at) return { ...base, stage: 'archived' as LoginStage, words: `${who} is archived (${u.archived_at.slice(0, 10)}); they cannot sign in.`, next: 'Bring back on their desk restores the account; the seat does not.' }
  if (!u.login_attached_at) return { ...base, stage: 'no_login' as LoginStage, words: `${who} is on the roster with no login${u.email ? ` (address on file: ${u.email})` : ' and no address on file'}.`, next: u.email ? `plan_login { person } attaches the login on this row and sends the sign-in email to ${u.email}; mode password sets one you dictate instead.` : 'plan_login { person, email } attaches the login on this row with the address they will sign in with and sends the sign-in email.' }
  if (!auth) return { ...base, stage: 'login_no_auth' as LoginStage, words: `${who}'s row says a login was attached ${stamp(u.login_attached_at, nowIso)}, but no auth account stands behind the id.`, next: 'Something is off: read_rows on users for the row, and check Authentication → Users on the dashboard. plan_login is refused while the row says attached.' }
  if (auth.last_sign_in_at) {
    const link = auth.recovery_sent_at && Date.parse(auth.recovery_sent_at) > Date.parse(auth.last_sign_in_at) ? ` A link went after that, ${stamp(auth.recovery_sent_at, nowIso)}, and has not been used.` : ''
    return { ...base, stage: 'signed_in' as LoginStage, words: `${who} has signed in; the last time was ${stamp(auth.last_sign_in_at, nowIso)}.${link}`, next: link ? 'Wait for them to open it, or plan_password_reset again after ten minutes.' : 'Nothing owed on the sign-in. If they are locked out, plan_password_reset sends the reset link.' }
  }
  if (!auth.email_confirmed_at && (auth.invited_at || auth.confirmation_sent_at)) {
    const sent = auth.invited_at ?? auth.confirmation_sent_at
    return { ...base, stage: 'invite_sent' as LoginStage, words: `The invite email went to ${auth.email ?? u.email} ${stamp(sent, nowIso)}; it has not been opened.`, next: 'Ask them to look for the invite (the sender is the company address; check spam). If it is lost, Invite again on People → Users replaces the pending invite with a fresh link.' }
  }
  if (auth.recovery_sent_at) return { ...base, stage: 'link_sent' as LoginStage, words: `A sign-in or reset link went to ${auth.email ?? u.email} ${stamp(auth.recovery_sent_at, nowIso)}; it has not been used.`, next: `Ask them to open the newest email from the company address. After ${RECOVERY_RESEND_MINUTES} minutes plan_password_reset sends another.` }
  return { ...base, stage: 'login_quiet' as LoginStage, words: `${who} has a login (attached ${stamp(u.login_attached_at, nowIso)}) and has never signed in; no email has gone from the seat.`, next: 'plan_password_reset { person } emails them the link that sets a password, or mode password sets one you dictate.' }
}

// ---------------------------------------------------------------------------
// The log
// ---------------------------------------------------------------------------

/** A password never reaches dev_mcp_calls: every `password` key under the ask reads `(set, not logged)`. */
export function argsWithoutPasswords(args: Json): Json {
  const strip = (v: unknown): unknown => {
    if (Array.isArray(v)) return v.map(strip)
    const o = obj(v)
    if (!o) return v
    const out: Json = {}
    for (const [k, val] of Object.entries(o)) out[k] = k === 'password' && typeof val === 'string' && val ? '(set, not logged)' : strip(val)
    return out
  }
  return strip(args) as Json
}
