import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import {
  ACCOUNT_KINDS,
  ACCOUNT_PERSON_SELECT,
  ACCOUNT_USER_SELECT,
  NAME_KEYED_PAY_TABLES,
  RECOVERY_RESEND_MINUTES,
  accountAppliedWords,
  accountDryRun,
  accountFacts,
  accountInput,
  addWorkerArgs,
  agoWords,
  argsWithoutPasswords,
  authStateOf,
  createLoginBody,
  isAccountVerb,
  kindOf,
  loginAppliedWords,
  loginDryRun,
  loginInput,
  loginStateReading,
  passwordResetAppliedWords,
  passwordResetDryRun,
  passwordResetInput,
  payConfigRow,
  personRefKind,
  pickByName,
  salaryTemplateRow,
  type AccountPersonRow,
  type AccountUserRow,
  type AccountWorld,
  type AuthState,
} from '../../../supabase/functions/_shared/devMcpAccount'
import { WRITE_VERBS, alreadyApplied, planHash, planReply, planVerbFor, writeRpcBody } from '../../../supabase/functions/_shared/devMcpWrites'
import { CATALOG_TABLES } from '../../../supabase/functions/dev-mcp/catalog'
import { APP_CALENDAR_TZ } from '../../../supabase/functions/_shared/appTimeZone'

const SERVER = readFileSync('supabase/functions/dev-mcp/index.ts', 'utf8')
const README = readFileSync('docs/dev-mcp/README.md', 'utf8')
const GUIDE = readFileSync('src/content/help/connect-a-coding-agent.md', 'utf8')
/** The app's own lists, read as text: combinePeople.ts imports the browser client, and the Users tab's shared file its hooks. */
const listIn = (file: string, name: string): string[] => {
  const m = readFileSync(file, 'utf8').match(new RegExp(`export const ${name}[^=]*= \\{?\\[?([\\s\\S]*?)\\]? as const|export const ${name}: Record<PersonKind, string> = \\{([\\s\\S]*?)\\}`))
  const body = m ? (m[1] ?? m[2] ?? '') : ''
  return [...body.matchAll(/^\s*'?([a-z_]+)'?[,:]/gm)].map((x) => x[1]!)
}
const NAME_KEYED_TABLES = listIn('src/lib/combinePeople.ts', 'NAME_KEYED_TABLES')
const KIND_TO_USER_ROLE_TEXT = readFileSync('src/components/people/peopleUsersTabShared.ts', 'utf8').match(/export const KIND_TO_USER_ROLE: Record<PersonKind, string> = \{([\s\S]*?)\}/)![1]!
const KIND_TO_USER_ROLE: Record<string, string> = Object.fromEntries([...KIND_TO_USER_ROLE_TEXT.matchAll(/^\s*([a-z_]+): '([a-z_]+)'/gm)].map((x) => [x[1]!, x[2]!]))

const DEV = 'd0000000-0000-4000-8000-00000000000d'
const USER = '2a9722b9-b354-49d0-a60c-53d6f0345bb4'
const PERSON = 'd73eebbd-ba46-43ed-9940-ed8d919b55ba'
const OTHER = '11111111-2222-4333-8444-555555555555'
const HASH = 'a'.repeat(64)
const NOW = '2026-11-09T16:00:00.000Z'
const TODAY = '2026-11-09'

/** The owner's row of 2026-11-09, as the task found it: named wrong, no login. */
const noLogin: AccountUserRow = { id: USER, name: 'Dobert Rouglas', email: 'robert@example.com', role: 'assistant', title: null, phone: null, login_attached_at: null, archived_at: null, is_sample: false, is_digital_twin: false, is_walk_tester: false, read_only: false, updated_at: '2026-11-09T14:00:00Z' }
const roster: AccountPersonRow = { id: PERSON, name: 'Dobert Rouglas', kind: 'assistant', email: 'robert@example.com', phone: null, start_date: '2026-11-09', end_date: null, archived_at: null, account_user_id: USER }
const withLogin: AccountUserRow = { ...noLogin, name: 'Robert Douglas', login_attached_at: '2026-11-09T15:00:00Z' }
const quiet: AuthState = { email: 'robert@example.com', created_at: '2026-11-09T15:00:00Z', invited_at: null, confirmation_sent_at: null, email_confirmed_at: '2026-11-09T15:00:00Z', recovery_sent_at: null, last_sign_in_at: null, banned_until: null }
const world = (over: Partial<AccountWorld> = {}): AccountWorld => ({ user: noLogin, person: roster, nameHolder: null, emailHolder: null, archivedMatch: null, ...over })
const caller = { userId: DEV }

describe('the account verbs are on the allowlist with no wrapper RPC', () => {
  it('six write verbs, rpc null, plan before apply, and the server declares each with the login-state read', () => {
    for (const v of ['plan_account', 'apply_account', 'plan_login', 'apply_login', 'plan_password_reset', 'apply_password_reset'] as const) {
      expect(WRITE_VERBS[v]).toEqual({ rpc: null, step: v.startsWith('plan_') ? 'plan' : 'apply' })
      expect(isAccountVerb(v)).toBe(true)
      expect(SERVER).toContain(`name: '${v}'`)
      expect(SERVER).toContain(`case '${v}':`)
    }
    expect(isAccountVerb('plan_hr_entry')).toBe(false)
    expect(planVerbFor('apply_account')).toBe('plan_account')
    expect(planVerbFor('apply_login')).toBe('plan_login')
    expect(planVerbFor('apply_password_reset')).toBe('plan_password_reset')
    expect(SERVER).toContain("name: 'get_login_state'")
    expect(SERVER).toContain("case 'get_login_state': {")
    expect(SERVER).toContain("const SERVER_VERSION = '0.78.0'")
    expect(SERVER).toContain('plan_account → apply_account')
    expect(SERVER).toContain('ninety-seven verbs')
    expect(README).toContain('`plan_account(account)`')
    expect(README).toContain('`get_login_state(person)`')
  })

  it('the dry run reads real columns, the kinds are the Users tab\'s own map, and the rename cascade is the app\'s list', () => {
    for (const c of ACCOUNT_USER_SELECT.split(',')) expect(Object.keys(CATALOG_TABLES.users!.columns)).toContain(c)
    for (const c of ACCOUNT_PERSON_SELECT.split(',')) expect(Object.keys(CATALOG_TABLES.people!.columns)).toContain(c)
    for (const [kind, { role }] of Object.entries(ACCOUNT_KINDS)) expect(KIND_TO_USER_ROLE[kind]).toBe(role)
    expect(Object.keys(ACCOUNT_KINDS).sort()).toEqual(Object.keys(KIND_TO_USER_ROLE).sort())
    expect([...NAME_KEYED_PAY_TABLES]).toEqual([...NAME_KEYED_TABLES])
    for (const t of NAME_KEYED_PAY_TABLES) expect(Object.keys(CATALOG_TABLES[t]!.columns)).toContain('person_name')
    expect(kindOf('helpers')).toMatchObject({ kind: 'helper', role: 'helpers' })
    expect(kindOf('Sub')).toMatchObject({ kind: 'sub', role: 'subcontractor' })
    expect(kindOf('dev')).toBeNull()
  })

  it('every write the server runs is the desk\'s own door, as the dev, and the auth read is the service role\'s fourth use', () => {
    for (const fn of ['invite-user', 'create-user', 'send-sign-in-email', 'detach-login', 'change-user-email', 'set-user-password']) expect(SERVER).toContain(`'${fn}'`)
    expect(SERVER).toContain("restPost(session, 'rpc/add_worker', addWorkerArgs(n))")
    expect(SERVER).toContain('anon.auth.resetPasswordForEmail(')
    expect(SERVER).toContain('/reset-password-confirm')
    expect(SERVER).toContain('/accept-invite')
    expect(SERVER).toContain('admin.auth.admin.getUserById(userId)')
    expect(SERVER).toContain('if (isAccountVerb(name)) return argsWithoutPasswords(args)')
    // Never through view_as: the login-state read refuses a non-dev before any read, and the write verbs are refused by isWriteVerb.
    expect(SERVER).toContain("if (who.role !== 'dev') return refused('get_login_state is for devs")
  })
})

describe('plan_account — the shape', () => {
  it('a new person: name, kind, the address, the sign-in door, the pay row; a password only with sign_in password and never printed', () => {
    const built = writeRpcBody('plan_account', { account: { new: { name: '  ZZ  Test ', kind: 'assistant', email: 'ZZ@Example.com', start_date: '2026-11-10' } } })
    expect(built).toMatchObject({ ok: true, rpc: null, step: 'plan', target: 'zz@example.com', body: { p: { new: { name: 'ZZ Test', kind: 'assistant', role: 'assistant', email: 'zz@example.com', start_date: '2026-11-10', training: false, sign_in: 'email', phone: null, notes: null } } } })
    const none = accountInput('plan_account', { account: { new: { name: 'ZZ Test', kind: 'helpers' } } }, TODAY)
    expect(none).toMatchObject({ ok: true, target: 'ZZ Test', p: { new: { kind: 'helper', role: 'helpers', email: null, sign_in: 'none', start_date: TODAY } } })
    const pw = accountInput('plan_account', { account: { new: { name: 'ZZ Test', kind: 'sub', email: 'zz@example.com', sign_in: 'password', password: 'hunter22', training: true, phone: ' 512 555 0100 ' }, pay: { hourly_wage: 28.5, is_salary: false } } }, TODAY)
    expect(pw).toMatchObject({ ok: true, p: { new: { sign_in: 'password', password: 'hunter22', training: true, phone: '512 555 0100' }, pay: { hourly_wage: 28.5, is_salary: false, workday_start: null } } })
    const salaried = accountInput('plan_account', { account: { new: { name: 'ZZ Test', kind: 'estimator', email: 'zz@example.com' }, pay: { hourly_wage: 40.004, is_salary: true, workday_start: '07:30' } } }, TODAY)
    expect(salaried).toMatchObject({ ok: true, p: { pay: { hourly_wage: 40, is_salary: true, workday_start: '07:30' } } })
  })

  it('refuses in words: both or neither target, a change beside new, no name, a dev, a bad address, a bad day, a password with the wrong door, pay on a primary or with no wage', () => {
    const r = (account: unknown) => accountInput('plan_account', { account }, TODAY)
    expect(r({})).toMatchObject({ ok: false, error: expect.stringContaining('person') })
    expect(r({ person: USER, new: { name: 'x', kind: 'helper' } })).toMatchObject({ ok: false, error: expect.stringContaining('not both') })
    expect(r({ new: { name: 'x', kind: 'helper' }, role: 'sub' })).toMatchObject({ ok: false, error: expect.stringContaining('Make them first') })
    expect(r({ new: { kind: 'helper' } })).toMatchObject({ ok: false, error: expect.stringContaining('new.name') })
    expect(r({ new: { name: 'x', kind: 'dev' } })).toMatchObject({ ok: false, error: expect.stringContaining('dev account') })
    expect(r({ new: { name: 'x', kind: 'helper', email: 'nope' } })).toMatchObject({ ok: false, error: expect.stringContaining('address') })
    expect(r({ new: { name: 'x', kind: 'helper', start_date: 'Nov 9' } })).toMatchObject({ ok: false, error: expect.stringContaining('YYYY-MM-DD') })
    expect(r({ new: { name: 'x', kind: 'helper', sign_in: 'email' } })).toMatchObject({ ok: false, error: expect.stringContaining('needs new.email') })
    expect(r({ new: { name: 'x', kind: 'helper', email: 'a@b.co', sign_in: 'password' } })).toMatchObject({ ok: false, error: expect.stringContaining('at least 6') })
    expect(r({ new: { name: 'x', kind: 'helper', email: 'a@b.co', sign_in: 'password', password: '12345' } })).toMatchObject({ ok: false, error: expect.stringContaining('at least 6') })
    expect(r({ new: { name: 'x', kind: 'helper', email: 'a@b.co', password: 'hunter22' } })).toMatchObject({ ok: false, error: expect.stringContaining('goes with sign_in password') })
    expect(r({ new: { name: 'x', kind: 'primary' }, pay: { hourly_wage: 30 } })).toMatchObject({ ok: false, error: expect.stringContaining('never paid') })
    expect(r({ new: { name: 'x', kind: 'helper' }, pay: { hourly_wage: 0 } })).toMatchObject({ ok: false, error: expect.stringContaining('over 0') })
    expect(r({ new: { name: 'x', kind: 'helper' }, pay: { hourly_wage: 30, is_salary: true } })).toMatchObject({ ok: false, error: expect.stringContaining('workday_start') })
    expect(r({ person: USER, pay: { hourly_wage: 30 } })).toMatchObject({ ok: false, error: expect.stringContaining('pay goes with new') })
    expect(r({ person: USER })).toMatchObject({ ok: false, error: expect.stringContaining('at least one change') })
    expect(r({ person: USER, rename: {} })).toMatchObject({ ok: false, error: expect.stringContaining('names nothing') })
    expect(r({ person: USER, rename: { name: '  ' } })).toMatchObject({ ok: false, error: expect.stringContaining('empty') })
    expect(r({ person: USER, role: 'boss' })).toMatchObject({ ok: false, error: expect.stringContaining('role must be') })
    expect(writeRpcBody('apply_account', { account: { person: USER, role: 'sub' } })).toMatchObject({ ok: false, error: expect.stringContaining('plan_hash') })
  })

  it('a change on a person: rename with title and phone, a role by kind or role name, an address lower-cased', () => {
    const built = accountInput('plan_account', { account: { person: ' Dobert Rouglas ', rename: { name: 'Robert  Douglas', title: ' Office ', phone: null }, role: 'helper', email: 'Robert@Example.com' } }, TODAY)
    expect(built).toEqual({ ok: true, target: 'Dobert Rouglas', p: { person: 'Dobert Rouglas', rename: { name: 'Robert Douglas', title: 'Office', phone: null }, role: 'helpers', email: 'robert@example.com' } })
  })
})

describe('plan_account — the dry run', () => {
  it('a create names the door, the pay row and what is never written; a name, an address or an archived teammate already there refuses it', () => {
    const p = accountInput('plan_account', { account: { new: { name: 'ZZ Test', kind: 'assistant', email: 'zz@example.com' }, pay: { hourly_wage: 30 } } }, TODAY)
    expect(p.ok).toBe(true)
    if (!p.ok) return
    const dry = accountDryRun(p.p, world({ user: null, person: null }), caller)
    expect(dry.ok).toBe(true)
    if (!dry.ok) return
    expect(dry.reply).toMatchObject({ dry_run: true, action: 'create', person: { name: 'ZZ Test', as: 'an assistant', email: 'zz@example.com' }, sign_in: { how: 'email' }, pay: { hourly_wage: 30 }, not_written: expect.stringContaining('packet') })
    expect(JSON.stringify(dry.reply)).not.toContain('hunter')
    expect(accountDryRun(p.p, world({ user: null, person: null, nameHolder: { where: 'roster', id: OTHER, name: 'ZZ Test' } }), caller)).toMatchObject({ ok: false, refused: expect.stringContaining('already carries that exact name') })
    expect(accountDryRun(p.p, world({ user: null, person: null, emailHolder: { id: OTHER, name: 'Pat' } }), caller)).toMatchObject({ ok: false, refused: expect.stringContaining('already has the address') })
    expect(accountDryRun(p.p, world({ user: null, person: null, archivedMatch: { id: OTHER, name: 'ZZ Test', by: 'name', left: '2026-06-01' } }), caller)).toMatchObject({ ok: false, refused: expect.stringContaining('Bring back') })
    // A password never rides in the plan's words.
    const pw = accountInput('plan_account', { account: { new: { name: 'ZZ Test', kind: 'assistant', email: 'zz@example.com', sign_in: 'password', password: 'hunter22' } } }, TODAY)
    if (!pw.ok) throw new Error(pw.error)
    const pwDry = accountDryRun(pw.p, world({ user: null, person: null }), caller)
    expect(pwDry.ok && JSON.stringify(pwDry.reply)).not.toContain('hunter22')
    expect(pwDry.ok && (pwDry.reply.sign_in as { how: string }).how).toBe('password')
  })

  it('a rename names the old and new name, the roster row and the cascade; the same name, a taken name, a fixture or an archived row refuses', () => {
    const p = accountInput('plan_account', { account: { person: USER, rename: { name: 'Robert Douglas' } } }, TODAY)
    if (!p.ok) throw new Error(p.error)
    const dry = accountDryRun(p.p, world(), caller)
    expect(dry.ok).toBe(true)
    if (!dry.ok) return
    expect(dry.reply).toMatchObject({ action: 'change', account: { id: USER, name: 'Dobert Rouglas', login: 'none', updated_at: '2026-11-09T14:00:00Z', roster_row: { id: PERSON } }, changes: [{ change: 'rename', name: { from: 'Dobert Rouglas', to: 'Robert Douglas' }, roster_row: { from: 'Dobert Rouglas', to: 'Robert Douglas' }, cascade: expect.stringContaining('"Dobert Rouglas"') }] })
    expect(accountDryRun(p.p, world({ nameHolder: { where: 'account', id: OTHER, name: 'Robert Douglas' } }), caller)).toMatchObject({ ok: false, refused: expect.stringContaining('Names must be unique') })
    const same = accountInput('plan_account', { account: { person: USER, rename: { name: 'Dobert Rouglas' } } }, TODAY)
    expect(same.ok && accountDryRun(same.p, world(), caller)).toMatchObject({ ok: false, refused: expect.stringContaining('already reads') })
    expect(accountDryRun(p.p, world({ user: { ...noLogin, is_sample: true } }), caller)).toMatchObject({ ok: false, refused: expect.stringContaining('fixture account') })
    expect(accountDryRun(p.p, world({ user: { ...noLogin, archived_at: '2026-10-01T00:00:00Z' } }), caller)).toMatchObject({ ok: false, refused: expect.stringContaining('Bring them back') })
    expect(accountDryRun(p.p, world({ user: null, person: null }), caller)).toMatchObject({ ok: false, refused: expect.stringContaining('No account for') })
  })

  it('a role change never touches your own row or a dev; an address change names its door by whether a login stands', () => {
    const role = accountInput('plan_account', { account: { person: USER, role: 'helper' } }, TODAY)
    if (!role.ok) throw new Error(role.error)
    expect(accountDryRun(role.p, world(), caller)).toMatchObject({ ok: true, reply: { changes: [{ change: 'set_role', role: { from: 'assistant', to: 'helpers' } }] } })
    expect(accountDryRun(role.p, world(), { userId: USER })).toMatchObject({ ok: false, refused: expect.stringContaining('your own role') })
    expect(accountDryRun(role.p, world({ user: { ...noLogin, role: 'dev' } }), caller)).toMatchObject({ ok: false, refused: expect.stringContaining('is a dev') })
    const sameRole = accountInput('plan_account', { account: { person: USER, role: 'assistant' } }, TODAY)
    expect(sameRole.ok && accountDryRun(sameRole.p, world(), caller)).toMatchObject({ ok: false, refused: expect.stringContaining('already an assistant') })
    const email = accountInput('plan_account', { account: { person: USER, email: 'robert@clickexample.com' } }, TODAY)
    if (!email.ok) throw new Error(email.error)
    expect(accountDryRun(email.p, world(), caller)).toMatchObject({ ok: true, reply: { changes: [{ change: 'set_email', how: expect.stringContaining("app's copy alone") }] } })
    expect(accountDryRun(email.p, world({ user: withLogin }), caller)).toMatchObject({ ok: true, reply: { changes: [{ change: 'set_email', how: expect.stringContaining('change-user-email') }] } })
    expect(accountDryRun(email.p, world({ emailHolder: { id: OTHER, name: 'Pat' } }), caller)).toMatchObject({ ok: false, refused: expect.stringContaining('never share one') })
  })

  it('the plan hash commits to the row: a save since the plan (updated_at) or a login attached refuses the apply', async () => {
    const p = accountInput('plan_account', { account: { person: USER, rename: { name: 'Robert Douglas' } } }, TODAY)
    if (!p.ok) throw new Error(p.error)
    const a = accountDryRun(p.p, world(), caller)
    const b = accountDryRun(p.p, world({ user: { ...noLogin, updated_at: '2026-11-09T14:30:00Z' } }), caller)
    const c = accountDryRun(p.p, world({ user: { ...noLogin, login_attached_at: '2026-11-09T14:30:00Z' } }), caller)
    if (!a.ok || !b.ok || !c.ok) throw new Error('dry run refused')
    const ha = await planHash('plan_account', p.p, a.reply)
    expect(await planHash('plan_account', p.p, a.reply)).toBe(ha)
    expect(await planHash('plan_account', p.p, b.reply)).not.toBe(ha)
    expect(await planHash('plan_account', p.p, c.reply)).not.toBe(ha)
    expect(String(planReply('plan_account', a.reply, ha).next)).toContain('apply_account')
    expect(alreadyApplied('apply_account', { target: USER, at: NOW })).toContain('get_login_state')
  })

  it('the writes the server runs are the Hire form\'s: add_worker\'s args, invite-user\'s and create-user\'s body, the pay row, the workday template', () => {
    const p = accountInput('plan_account', { account: { new: { name: 'ZZ Test', kind: 'helper', email: 'zz@example.com', sign_in: 'password', password: 'hunter22', training: true, phone: '512', notes: 'n' }, pay: { hourly_wage: 30, is_salary: true, workday_start: '07:30' } } }, TODAY)
    if (!p.ok) throw new Error(p.error)
    const n = p.p.new!
    expect(addWorkerArgs(n)).toEqual({ p_name: 'ZZ Test', p_kind: 'helper', p_email: 'zz@example.com', p_phone: '512', p_notes: 'n', p_start_date: TODAY })
    expect(createLoginBody(n, 'https://clicktooling.com/accept-invite')).toEqual({ email: 'zz@example.com', role: 'helpers', name: 'ZZ Test', read_only: true, start_date: TODAY, password: 'hunter22' })
    expect(createLoginBody({ ...n, sign_in: 'email', password: undefined }, 'https://clicktooling.com/accept-invite')).toEqual({ email: 'zz@example.com', role: 'helpers', name: 'ZZ Test', read_only: true, start_date: TODAY, redirectTo: 'https://clicktooling.com/accept-invite' })
    expect(payConfigRow(p.p.pay!, 'ZZ Test', PERSON)).toEqual({ person_name: 'ZZ Test', person_id: PERSON, hourly_wage: 30, office_hourly_wage: null, is_salary: true, record_hours_but_salary: false })
    expect(salaryTemplateRow(USER, '07:30', APP_CALENDAR_TZ)).toMatchObject({ user_id: USER, timezone: APP_CALENDAR_TZ, exclude_weekends: true, mode: 'continuous', segment_a_start_local: '07:30:00', segment_a_duration_minutes: 480, segment_b_start_local: null, use_split_focus: false })
    expect(accountAppliedWords([{ step: 'person', ok: true, words: 'x' }], 'zz@example.com')).toContain('get_login_state("zz@example.com")')
    expect(accountAppliedWords([{ step: 'rename', ok: true, words: 'x' }, { step: 'pay_rows', ok: false, words: 'RLS' }], USER)).toContain('1 of 2 done; held: pay_rows (RLS)')
  })
})

describe('plan_login — attach, with the email or a password, or remove', () => {
  it('the shape: mode email by default, a password only with mode password, remove alone', () => {
    expect(loginInput('plan_login', { login: { person: USER } })).toEqual({ ok: true, target: USER, p: { person: USER, action: 'attach', mode: 'email' } })
    expect(loginInput('plan_login', { login: { person: USER, mode: 'password', password: 'hunter22', email: 'ZZ@Example.com' } })).toEqual({ ok: true, target: USER, p: { person: USER, action: 'attach', mode: 'password', password: 'hunter22', email: 'zz@example.com' } })
    expect(loginInput('plan_login', { login: { person: USER, remove: true } })).toEqual({ ok: true, target: USER, p: { person: USER, action: 'remove' } })
    expect(loginInput('plan_login', { login: { person: USER, remove: true, mode: 'email' } })).toMatchObject({ ok: false, error: expect.stringContaining('remove goes alone') })
    expect(loginInput('plan_login', { login: { person: USER, mode: 'password' } })).toMatchObject({ ok: false, error: expect.stringContaining('at least 6') })
    expect(loginInput('plan_login', { login: { person: USER, password: 'hunter22' } })).toMatchObject({ ok: false, error: expect.stringContaining('goes with mode password') })
    expect(loginInput('plan_login', { login: {} })).toMatchObject({ ok: false, error: expect.stringContaining('needs login') })
    expect(writeRpcBody('apply_login', { login: { person: USER } })).toMatchObject({ ok: false, error: expect.stringContaining('plan_hash') })
  })

  it('attach: the row\'s own address unless one is given, the door\'s refusals (a login already there, a fixture, archived, no address, a taken address)', () => {
    const p = loginInput('plan_login', { login: { person: USER } })
    if (!p.ok) throw new Error(p.error)
    const dry = loginDryRun(p.p, noLogin, roster, null, caller)
    expect(dry).toMatchObject({ ok: true, reply: { action: 'attach', email: 'robert@example.com', address_changes: null, mode: 'email', account: { login: 'none' }, how: expect.stringContaining('send-sign-in-email') } })
    const given = loginInput('plan_login', { login: { person: USER, email: 'new@example.com', mode: 'password', password: 'hunter22' } })
    if (!given.ok) throw new Error(given.error)
    const g = loginDryRun(given.p, noLogin, roster, null, caller)
    expect(g).toMatchObject({ ok: true, reply: { email: 'new@example.com', address_changes: { from: 'robert@example.com', to: 'new@example.com' }, how: expect.stringContaining('no email goes') } })
    expect(g.ok && JSON.stringify(g.reply)).not.toContain('hunter22')
    expect(loginDryRun(p.p, withLogin, roster, null, caller)).toMatchObject({ ok: false, refused: expect.stringContaining('already has a login') })
    expect(loginDryRun(p.p, { ...noLogin, is_digital_twin: true }, roster, null, caller)).toMatchObject({ ok: false, refused: expect.stringContaining('sample or a twin') })
    expect(loginDryRun(p.p, { ...noLogin, archived_at: '2026-10-01T00:00:00Z' }, roster, null, caller)).toMatchObject({ ok: false, refused: expect.stringContaining('Restore them first') })
    expect(loginDryRun(p.p, { ...noLogin, email: null }, roster, null, caller)).toMatchObject({ ok: false, refused: expect.stringContaining('Pass login.email') })
    expect(loginDryRun(p.p, noLogin, roster, { id: OTHER, name: 'Pat' }, caller)).toMatchObject({ ok: false, refused: expect.stringContaining('never share one') })
    expect(loginDryRun(p.p, null, null, null, caller)).toMatchObject({ ok: false, refused: expect.stringContaining('plan_account with new') })
  })

  it('remove: the detach door\'s refusals (your own, a fixture, no login), and what goes and stays', () => {
    const p = loginInput('plan_login', { login: { person: USER, remove: true } })
    if (!p.ok) throw new Error(p.error)
    expect(loginDryRun(p.p, withLogin, roster, null, caller)).toMatchObject({ ok: true, reply: { action: 'remove', goes: expect.stringContaining('push devices'), stays: expect.stringContaining('paperwork') } })
    expect(loginDryRun(p.p, withLogin, roster, null, { userId: USER })).toMatchObject({ ok: false, refused: expect.stringContaining('your own login') })
    expect(loginDryRun(p.p, noLogin, roster, null, caller)).toMatchObject({ ok: false, refused: expect.stringContaining('no login to remove') })
    expect(loginDryRun(p.p, { ...withLogin, is_sample: true }, roster, null, caller)).toMatchObject({ ok: false, refused: expect.stringContaining('its own door') })
    expect(loginAppliedWords(p.p, 'Robert Douglas', null)).toContain('plan_login attaches one again')
    expect(loginAppliedWords({ person: USER, action: 'attach', mode: 'email' }, 'Robert Douglas', true)).toContain('the sign-in email went')
    expect(loginAppliedWords({ person: USER, action: 'attach', mode: 'email' }, 'Robert Douglas', false)).toContain('did not go')
    expect(loginAppliedWords({ person: USER, action: 'attach', mode: 'password', password: 'x' }, 'Robert Douglas', null)).toContain('never prints it')
  })

  it('the plan commits to the row: a login attached since refuses the apply', async () => {
    const p = loginInput('plan_login', { login: { person: USER } })
    if (!p.ok) throw new Error(p.error)
    const a = loginDryRun(p.p, noLogin, roster, null, caller)
    const b = loginDryRun(p.p, { ...noLogin, updated_at: '2026-11-09T15:00:00Z' }, roster, null, caller)
    if (!a.ok || !b.ok) throw new Error('refused')
    expect(await planHash('plan_login', p.p, a.reply)).not.toBe(await planHash('plan_login', p.p, b.reply))
    expect(alreadyApplied('apply_login', { target: USER, at: null })).toContain('plan_password_reset')
  })
})

describe('plan_password_reset — the recovery email or a dictated password', () => {
  it('the shape', () => {
    expect(passwordResetInput('plan_password_reset', { reset: { person: 'robert@example.com' } })).toEqual({ ok: true, target: 'robert@example.com', p: { person: 'robert@example.com', mode: 'email' } })
    expect(passwordResetInput('plan_password_reset', { reset: { person: USER, mode: 'password', password: 'hunter22' } })).toEqual({ ok: true, target: USER, p: { person: USER, mode: 'password', password: 'hunter22' } })
    expect(passwordResetInput('plan_password_reset', { reset: { person: USER, mode: 'password', password: 'short' } })).toMatchObject({ ok: false, error: expect.stringContaining('at least 6') })
    expect(passwordResetInput('plan_password_reset', { reset: { person: USER, password: 'hunter22' } })).toMatchObject({ ok: false, error: expect.stringContaining('goes with mode password') })
    expect(passwordResetInput('plan_password_reset', { reset: { person: USER, mode: 'sms' } })).toMatchObject({ ok: false, error: expect.stringContaining('email or password') })
    expect(passwordResetInput('plan_password_reset', {})).toMatchObject({ ok: false, error: expect.stringContaining(`${RECOVERY_RESEND_MINUTES} minutes`) })
  })

  it('refused for your own row, a fixture, an archived person, a row with no login, a banned login; the ten-minute rule names the last send and when the next may', () => {
    const p = passwordResetInput('plan_password_reset', { reset: { person: USER } })
    if (!p.ok) throw new Error(p.error)
    const ok = passwordResetDryRun(p.p, withLogin, roster, quiet, caller, NOW)
    expect(ok).toMatchObject({ ok: true, reply: { action: 'send_reset_email', email: 'robert@example.com', last_link_sent_at: null, how: expect.stringContaining('/reset-password-confirm') } })
    expect(passwordResetDryRun(p.p, withLogin, roster, quiet, { userId: USER }, NOW)).toMatchObject({ ok: false, refused: expect.stringContaining('your own password') })
    expect(passwordResetDryRun(p.p, { ...withLogin, is_sample: true }, roster, quiet, caller, NOW)).toMatchObject({ ok: false, refused: expect.stringContaining('fixture') })
    expect(passwordResetDryRun(p.p, { ...withLogin, archived_at: '2026-10-01T00:00:00Z' }, roster, quiet, caller, NOW)).toMatchObject({ ok: false, refused: expect.stringContaining('Bring them back') })
    expect(passwordResetDryRun(p.p, noLogin, roster, null, caller, NOW)).toMatchObject({ ok: false, refused: expect.stringContaining('plan_login attaches one') })
    expect(passwordResetDryRun(p.p, withLogin, roster, { ...quiet, banned_until: '2026-12-01T00:00:00Z' }, caller, NOW)).toMatchObject({ ok: false, refused: expect.stringContaining('banned until') })
    const recent = passwordResetDryRun(p.p, withLogin, roster, { ...quiet, recovery_sent_at: '2026-11-09T15:57:00Z' }, caller, NOW)
    expect(recent).toMatchObject({ ok: false, refused: expect.stringContaining('3 minutes ago') })
    expect(recent.ok ? '' : recent.refused).toContain('plan again after 2026-11-09T16:07:00.000Z')
    expect(passwordResetDryRun(p.p, withLogin, roster, { ...quiet, recovery_sent_at: '2026-11-09T15:49:00Z' }, caller, NOW)).toMatchObject({ ok: true, reply: { last_link_sent_at: '2026-11-09T15:49:00Z' } })
    // A dictated password is not held by the mail rule, and never printed.
    const pw = passwordResetInput('plan_password_reset', { reset: { person: USER, mode: 'password', password: 'hunter22' } })
    if (!pw.ok) throw new Error(pw.error)
    const set = passwordResetDryRun(pw.p, withLogin, roster, { ...quiet, recovery_sent_at: '2026-11-09T15:59:00Z' }, caller, NOW)
    expect(set).toMatchObject({ ok: true, reply: { action: 'set_password', how: expect.stringContaining('set-user-password') } })
    expect(set.ok && JSON.stringify(set.reply)).not.toContain('hunter22')
    expect(passwordResetAppliedWords(p.p, 'Robert Douglas', 'robert@example.com', '2026-11-09T16:00:05Z')).toContain('The reset email went to robert@example.com')
    expect(passwordResetAppliedWords(pw.p, 'Robert Douglas', 'robert@example.com', null)).toContain('never prints it')
    expect(alreadyApplied('apply_password_reset', { target: USER, at: null })).toContain('ten minutes')
  })

  it('the plan reply carries no clock, so a plan and its apply minutes later hash alike unless a link went between them', async () => {
    const p = passwordResetInput('plan_password_reset', { reset: { person: USER } })
    if (!p.ok) throw new Error(p.error)
    const a = passwordResetDryRun(p.p, withLogin, roster, quiet, caller, NOW)
    const later = passwordResetDryRun(p.p, withLogin, roster, quiet, caller, '2026-11-09T16:04:00.000Z')
    const sent = passwordResetDryRun(p.p, withLogin, roster, { ...quiet, recovery_sent_at: '2026-11-09T15:30:00Z' }, caller, NOW)
    if (!a.ok || !later.ok || !sent.ok) throw new Error('refused')
    expect(await planHash('plan_password_reset', p.p, a.reply)).toBe(await planHash('plan_password_reset', p.p, later.reply))
    expect(await planHash('plan_password_reset', p.p, a.reply)).not.toBe(await planHash('plan_password_reset', p.p, sent.reply))
  })
})

describe('get_login_state — where getting someone online stands', () => {
  it('each stage with its words and the next press', () => {
    expect(loginStateReading('zz@example.com', null, null, null, NOW)).toMatchObject({ stage: 'no_account', next: expect.stringContaining('plan_account with new') })
    expect(loginStateReading(USER, noLogin, roster, null, NOW)).toMatchObject({ stage: 'no_login', words: expect.stringContaining('no login'), next: expect.stringContaining('plan_login { person }') })
    expect(loginStateReading(USER, { ...noLogin, email: null }, roster, null, NOW)).toMatchObject({ stage: 'no_login', next: expect.stringContaining('plan_login { person, email }') })
    expect(loginStateReading(USER, { ...withLogin, archived_at: '2026-10-01T00:00:00Z' }, roster, quiet, NOW)).toMatchObject({ stage: 'archived', next: expect.stringContaining('Bring back') })
    expect(loginStateReading(USER, withLogin, roster, null, NOW)).toMatchObject({ stage: 'login_no_auth', next: expect.stringContaining('Authentication → Users') })
    expect(loginStateReading(USER, withLogin, roster, quiet, NOW)).toMatchObject({ stage: 'login_quiet', words: expect.stringContaining('never signed in'), next: expect.stringContaining('plan_password_reset') })
    const invited = loginStateReading(USER, withLogin, roster, { ...quiet, email_confirmed_at: null, invited_at: '2026-11-09T15:57:00Z' }, NOW)
    expect(invited).toMatchObject({ stage: 'invite_sent', words: 'The invite email went to robert@example.com 3 minutes ago (2026-11-09T15:57:00Z); it has not been opened.', next: expect.stringContaining('Invite again') })
    const linked = loginStateReading(USER, withLogin, roster, { ...quiet, recovery_sent_at: '2026-11-09T14:00:00Z' }, NOW)
    expect(linked).toMatchObject({ stage: 'link_sent', words: expect.stringContaining('2 hours ago'), next: expect.stringContaining(`After ${RECOVERY_RESEND_MINUTES} minutes`) })
    const signedIn = loginStateReading(USER, withLogin, roster, { ...quiet, last_sign_in_at: '2026-11-09T15:14:00Z' }, NOW)
    expect(signedIn).toMatchObject({ stage: 'signed_in', words: 'Robert Douglas has signed in; the last time was 46 minutes ago (2026-11-09T15:14:00Z).', next: expect.stringContaining('Nothing owed') })
    const linkAfter = loginStateReading(USER, withLogin, roster, { ...quiet, last_sign_in_at: '2026-11-07T15:14:00Z', recovery_sent_at: '2026-11-09T15:50:00Z' }, NOW)
    expect(linkAfter).toMatchObject({ stage: 'signed_in', words: expect.stringContaining('A link went after that, 10 minutes ago') })
    expect((signedIn.account as { login: string }).login).toBe('attached')
    expect(signedIn.auth).toEqual({ ...quiet, last_sign_in_at: '2026-11-09T15:14:00Z' })
  })

  it('the auth stamps are picked by name — a hash or a token on the account never rides along', () => {
    const picked = authStateOf({ id: USER, email: 'robert@example.com', encrypted_password: 'x', recovery_token: 'y', last_sign_in_at: '2026-11-09T15:14:00Z', recovery_sent_at: '', invited_at: null, created_at: '2026-11-09T15:00:00Z' })
    expect(picked).toEqual({ email: 'robert@example.com', created_at: '2026-11-09T15:00:00Z', invited_at: null, confirmation_sent_at: null, email_confirmed_at: null, recovery_sent_at: null, last_sign_in_at: '2026-11-09T15:14:00Z', banned_until: null })
    expect(authStateOf(null)).toBeNull()
    expect(agoWords('2026-11-09T15:59:30Z', NOW)).toBe('just now')
    expect(agoWords('2026-11-09T15:59:00Z', NOW)).toBe('1 minute ago')
    expect(agoWords('2026-11-08T15:00:00Z', NOW)).toBe('25 hours ago')
    expect(agoWords('2026-11-06T15:00:00Z', NOW)).toBe('3 days ago')
    expect(agoWords(null, NOW)).toBeNull()
  })

  it('a person is named by id, by address or by name; a name picks one match or the exact one', () => {
    expect(personRefKind(USER)).toBe('uuid')
    expect(personRefKind('robert@example.com')).toBe('email')
    expect(personRefKind('Robert Douglas')).toBe('name')
    expect(personRefKind('  ')).toBe('empty')
    const rows = [{ id: USER, name: 'Robert Douglas', email: 'r@x.co', role: 'assistant' }, { id: OTHER, name: 'Robert Douglas Jr', email: 'j@x.co', role: 'helpers' }]
    expect(pickByName(rows, 'robert douglas')).toEqual({ id: USER })
    expect(pickByName(rows.slice(1), 'Robert')).toEqual({ id: OTHER })
    expect(pickByName(rows, 'Robert')).toMatchObject({ refused: expect.stringContaining('matches 2 accounts') })
    expect(pickByName([], 'Nobody')).toMatchObject({ refused: expect.stringContaining('plan_account with new') })
  })
})

describe('a password never reaches the log, and the guide says how to get a teammate online', () => {
  it('argsWithoutPasswords replaces every password key at any depth and leaves the rest', () => {
    expect(argsWithoutPasswords({ account: { new: { name: 'x', password: 'hunter22' } }, plan_hash: HASH })).toEqual({ account: { new: { name: 'x', password: '(set, not logged)' } }, plan_hash: HASH })
    expect(argsWithoutPasswords({ login: { person: USER, mode: 'password', password: 'hunter22' } })).toEqual({ login: { person: USER, mode: 'password', password: '(set, not logged)' } })
    expect(argsWithoutPasswords({ reset: { person: USER, password: '' } })).toEqual({ reset: { person: USER, password: '' } })
  })

  it('the help guide carries the section a session reads to walk a person through', () => {
    expect(GUIDE).toContain('## Get a teammate online with the seat')
    for (const verb of ['get_login_state', 'plan_account', 'plan_login', 'plan_password_reset']) expect(GUIDE).toContain(verb)
  })

  it('accountFacts is the row a plan commits to, roster row included', () => {
    expect(accountFacts(withLogin, roster)).toEqual({ id: USER, name: 'Robert Douglas', email: 'robert@example.com', role: 'assistant', title: null, phone: null, login: 'attached', login_attached_at: '2026-11-09T15:00:00Z', training_mode: false, updated_at: '2026-11-09T14:00:00Z', roster_row: { id: PERSON, name: 'Dobert Rouglas', kind: 'assistant', start_date: '2026-11-09' } })
  })
})
