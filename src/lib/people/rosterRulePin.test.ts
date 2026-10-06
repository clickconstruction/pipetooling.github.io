/**
 * Who is a person is answered three times: by the `roster_people` view (20260922001000), by the
 * crew pickers' `isActiveRosterPerson` / `activeUsersQuery` (they read `users`, because the view
 * carries no email, phone or sign-in stamp and every picker would need a second read), and by the
 * edge functions' `REAL_ACCOUNT` (they run as the service role, which the view answers with no
 * rows). This pins the two copies to the view's SQL (punch list #29): a condition added to the
 * view's rollups fails here until both copies learn it.
 */
import { readdirSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { isActiveRosterPerson } from './activeRoster'

const ROOT = resolve(__dirname, '../../..')
const MIGRATIONS = resolve(ROOT, 'supabase/migrations')

/** The newest definition of the view, from CREATE to its FROM. */
const viewSql = (() => {
  const marker = 'CREATE OR REPLACE VIEW public.roster_people'
  const file = readdirSync(MIGRATIONS)
    .filter((n) => n.endsWith('.sql'))
    .sort()
    .filter((n) => readFileSync(resolve(MIGRATIONS, n), 'utf8').includes(marker))
    .pop()
  expect(file, 'a migration defines roster_people').toBeDefined()
  const sql = readFileSync(resolve(MIGRATIONS, file!), 'utf8')
  const start = sql.indexOf(marker)
  return sql.slice(start, sql.indexOf('FROM public.users u', start))
})()

/** The parenthesized expression a column alias closes: walked back from `) AS <alias>` to its `(`. */
function expressionOf(alias: string): string {
  const at = new RegExp(`\\)\\s+AS\\s+${alias}\\b`).exec(viewSql)
  expect(at, `the view has ${alias}`).not.toBeNull()
  let depth = 0
  for (let i = at!.index; i >= 0; i--) {
    if (viewSql[i] === ')') depth += 1
    if (viewSql[i] === '(' && --depth === 0) return viewSql.slice(i + 1, at!.index)
  }
  throw new Error(`unbalanced expression before ${alias}`)
}

/** One rollup's conditions, top-level ANDs split and whitespace folded. */
function conditions(alias: string): string[] {
  const parts: string[] = []
  let depth = 0
  let cur = ''
  const tokens = expressionOf(alias).replace(/\s+/g, ' ').trim().split(' ')
  for (const tok of tokens) {
    if (depth === 0 && tok === 'AND') {
      parts.push(cur.trim())
      cur = ''
      continue
    }
    depth += (tok.match(/\(/g)?.length ?? 0) - (tok.match(/\)/g)?.length ?? 0)
    cur += ` ${tok}`
  }
  parts.push(cur.trim())
  return parts.sort()
}

const TWIN = 'NOT COALESCE(u.is_digital_twin, false)'
const SAMPLE = 'NOT COALESCE(u.is_sample, false)'
const ACCOUNT_LIVE = 'u.archived_at IS NULL'
const PERSON_LIVE = 'p.archived_at IS NULL'
const NOT_DEV = "(u.role IS NULL OR u.role::text <> 'dev')"

describe('the roster rule, pinned to roster_people', () => {
  it('is_pay_roster is: not a twin, not a sample, neither half archived', () => {
    expect(conditions('is_pay_roster')).toEqual([TWIN, SAMPLE, PERSON_LIVE, ACCOUNT_LIVE].sort())
  })

  it('is_active_roster is is_pay_roster and not a dev', () => {
    expect(conditions('is_active_roster')).toEqual([TWIN, SAMPLE, PERSON_LIVE, ACCOUNT_LIVE, NOT_DEV].sort())
  })

  it("the edge functions' REAL_ACCOUNT is is_pay_roster's flags (archived stays with each caller)", () => {
    const rule = readFileSync(resolve(ROOT, 'supabase/functions/_shared/realAccount.ts'), 'utf8')
    const m = /export const REAL_ACCOUNT = \{([^}]*)\} as const/.exec(rule)
    expect(m).not.toBeNull()
    const flags = [...m![1]!.matchAll(/(\w+):\s*false/g)].map((x) => x[1]).sort()
    const viewFlags = conditions('is_pay_roster')
      .map((c) => /^NOT COALESCE\(u\.(\w+), false\)$/.exec(c)?.[1])
      .filter(Boolean)
      .sort()
    expect(flags).toEqual(viewFlags)
  })

  it("the crew pickers' isActiveRosterPerson refuses each condition of is_active_roster", () => {
    const person = { archived_at: null, is_digital_twin: false, is_sample: false, role: 'estimator' }
    expect(isActiveRosterPerson(person)).toBe(true)
    expect(isActiveRosterPerson({ ...person, is_digital_twin: true }), TWIN).toBe(false)
    expect(isActiveRosterPerson({ ...person, is_sample: true }), SAMPLE).toBe(false)
    expect(isActiveRosterPerson({ ...person, archived_at: '2026-10-01T00:00:00Z' }), ACCOUNT_LIVE).toBe(false)
    expect(isActiveRosterPerson({ ...person, role: 'dev' }), NOT_DEV).toBe(false)
    // PERSON_LIVE has no column on a users row: End employment archives both halves together, so a
    // login whose roster row is archived is already archived itself.
  })
})
