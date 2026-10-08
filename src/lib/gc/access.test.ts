import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import type { UserRole } from '../../hooks/useAuth'
import { GC_MONEY_TEAM, canOpenGcProjects, canSeeGcMoney } from './access'

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
})

/** The roles in the newest migration's `gc_money_team()`: the database's copy of who sees our number. */
function moneyTeamInSql(): string[] {
  const dir = join(process.cwd(), 'supabase', 'migrations')
  const newest = readdirSync(dir)
    .filter((f) => f.endsWith('.sql'))
    .sort()
    .reverse()
    .map((f) => readFileSync(join(dir, f), 'utf8'))
    .find((sql) => sql.includes('FUNCTION public.gc_money_team()'))
  if (!newest) throw new Error('no migration defines gc_money_team()')
  const body = newest.slice(newest.indexOf('FUNCTION public.gc_money_team()'))
  const roles = /role IN \(([^)]*)\)/.exec(body)?.[1]
  if (!roles) throw new Error('gc_money_team() names no roles')
  return roles.split(',').map((r) => r.trim().replace(/^'|'$/g, ''))
}

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
