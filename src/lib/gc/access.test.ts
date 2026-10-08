import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import type { UserRole } from '../../hooks/useAuth'
import { GC_TRADE_EMAIL_ROLES } from '../../../supabase/functions/_shared/gcTradeEmail'
import { GC_MONEY_TEAM, GC_OFFICE_TEAM, GC_TRADE_EMAIL_TEAM, canOpenGcProjects, canSeeGcMoney, canSendGcTradeEmail } from './access'

describe('canOpenGcProjects', () => {
  it('opens for the office and estimators, as gc_office_team() does', () => {
    for (const role of ['dev', 'master_technician', 'assistant', 'controller', 'estimator'] as UserRole[]) {
      expect(canOpenGcProjects(role)).toBe(true)
    }
  })

  it('stays shut for the field, the subs and a session with no role yet', () => {
    for (const role of ['superintendent', 'primary', 'subcontractor', 'helpers'] as UserRole[]) {
      expect(canOpenGcProjects(role)).toBe(false)
    }
    expect(canOpenGcProjects(null)).toBe(false)
    expect(canOpenGcProjects(undefined)).toBe(false)
  })

  it('names the same roles as the database’s gc_office_team(), so the two copies cannot drift (door 2)', () => {
    expect([...GC_OFFICE_TEAM].sort()).toEqual(teamInSql('gc_office_team').sort())
  })
})

/** The roles the newest migration that defines `fn` names in it: the database's copy of a GC team. */
function teamInSql(fn: 'gc_money_team' | 'gc_office_team'): string[] {
  const dir = join(process.cwd(), 'supabase', 'migrations')
  const head = `FUNCTION public.${fn}()`
  const newest = readdirSync(dir)
    .filter((f) => f.endsWith('.sql'))
    .sort()
    .reverse()
    .map((f) => readFileSync(join(dir, f), 'utf8'))
    .find((sql) => sql.includes(head))
  if (!newest) throw new Error(`no migration defines ${fn}()`)
  const body = newest.slice(newest.indexOf(head))
  const roles = /role IN \(([^)]*)\)/.exec(body.slice(0, body.indexOf('$$;')))?.[1]
  if (!roles) throw new Error(`${fn}() names no roles`)
  return roles.split(',').map((r) => r.trim().replace(/^'|'$/g, ''))
}
const moneyTeamInSql = () => teamInSql('gc_money_team')

describe('canSeeGcMoney', () => {
  it('shows our number to dev, the leaders and the controller, as gc_money_team() does', () => {
    for (const role of ['dev', 'master_technician', 'controller'] as UserRole[]) {
      expect(canSeeGcMoney(role)).toBe(true)
    }
  })

  it('keeps it from the assistants, estimators, the field, the subs and a session with no role yet', () => {
    for (const role of ['assistant', 'estimator', 'superintendent', 'primary', 'subcontractor', 'helpers'] as UserRole[]) {
      expect(canSeeGcMoney(role)).toBe(false)
    }
    expect(canSeeGcMoney(null)).toBe(false)
    expect(canSeeGcMoney(undefined)).toBe(false)
  })

  it('names the same roles as the database, so the two copies cannot drift', () => {
    expect([...GC_MONEY_TEAM].sort()).toEqual(moneyTeamInSql().sort())
  })
})

describe('canSendGcTradeEmail', () => {
  it('lets a dev send while the portal is built', () => {
    expect(canSendGcTradeEmail('dev')).toBe(true)
  })

  it('keeps everyone else and a session with no role yet from sending', () => {
    for (const role of ['master_technician', 'assistant', 'controller', 'estimator', 'superintendent', 'primary', 'subcontractor', 'helpers'] as UserRole[]) {
      expect(canSendGcTradeEmail(role)).toBe(false)
    }
    expect(canSendGcTradeEmail(null)).toBe(false)
    expect(canSendGcTradeEmail(undefined)).toBe(false)
  })

  it('names the same roles as gc-trade-email, so the two copies cannot drift', () => {
    expect([...GC_TRADE_EMAIL_TEAM].sort()).toEqual([...GC_TRADE_EMAIL_ROLES].sort())
  })
})
