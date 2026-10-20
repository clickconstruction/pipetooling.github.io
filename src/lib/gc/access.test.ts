import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import type { UserRole } from '../../hooks/useAuth'
import { GC_TRADE_EMAIL_ROLES } from '../../../supabase/functions/_shared/gcTradeEmail'
import { GC_CUSTOMER_EMAIL_ROLES } from '../../../supabase/functions/_shared/gcCustomerEmails'
import { MESSAGES_OFFICE_ROLES, MESSAGES_TECH_ROLES } from '../../../supabase/functions/_shared/messagesTeams'
import { GC_BOARD_WRITE_TEAM, GC_BUILDING_TEAM, GC_CLAUSE_APPROVE_TEAM, GC_CLAUSE_EDIT_TEAM, GC_MONEY_TEAM, GC_OFFICE_TEAM, GC_OWNER_CONTRACT_FILE_TEAM, GC_TRADE_EMAIL_TEAM, MESSAGES_TECH_TEAM, canApproveClause, canEditClause, canMessageCustomersFromJobMode, canOpenGcProjects, canOpenMessages, canReadJobMessages, canOpenOwnerContractFile, readsCustomerLinesInJobUpdates, canSeeGcMoney, canSendGcTradeEmail, canUseGcBoardWrites, canUseGcBuilding } from './access'
import { GC_TABLE_DOORS } from './doors'

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

describe('canMessageCustomersFromJobMode (Messages, R5)', () => {
  it('opens for the field roles that text a customer from Job Mode', () => {
    for (const role of ['primary', 'helpers'] as UserRole[]) expect(canMessageCustomersFromJobMode(role)).toBe(true)
  })

  it('stays shut for the office, the superintendent, a subcontractor and a session with no role yet', () => {
    for (const role of ['dev', 'master_technician', 'assistant', 'controller', 'estimator', 'superintendent', 'subcontractor'] as UserRole[]) {
      expect(canMessageCustomersFromJobMode(role)).toBe(false)
    }
    expect(canMessageCustomersFromJobMode(null)).toBe(false)
  })

  it('names the same roles as the database’s messages_tech_team(), so the two copies cannot drift', () => {
    expect([...MESSAGES_TECH_TEAM].sort()).toEqual(teamInSql('messages_tech_team').sort())
  })
})

describe('canOpenMessages (residential R2)', () => {
  it('opens /messages for the GC office team, the people the spine’s tables open to', () => {
    for (const role of GC_OFFICE_TEAM) expect(canOpenMessages(role)).toBe(true)
  })

  it('keeps the field, the subs and a session with no role yet out, since the field’s door is Job Mode', () => {
    for (const role of ['superintendent', 'primary', 'subcontractor', 'helpers'] as UserRole[]) {
      expect(canOpenMessages(role)).toBe(false)
    }
    expect(canOpenMessages(null)).toBe(false)
    expect(canOpenMessages(undefined)).toBe(false)
  })
})

describe('canReadJobMessages (Messages, cut 10: a job’s lines in Job activity)', () => {
  it('opens for the office team and the field roles of R5’s door', () => {
    for (const role of ['dev', 'master_technician', 'assistant', 'controller', 'estimator', 'primary', 'helpers'] as UserRole[]) {
      expect(canReadJobMessages(role)).toBe(true)
    }
  })

  it('stays shut for the superintendent, a subcontractor and a session with no role yet', () => {
    for (const role of ['superintendent', 'subcontractor'] as UserRole[]) expect(canReadJobMessages(role)).toBe(false)
    expect(canReadJobMessages(null)).toBe(false)
  })
})

describe('readsCustomerLinesInJobUpdates (the tech’s Customer pill in Job updates)', () => {
  it('opens for the field roles that read a job’s lines, and for nobody else', () => {
    for (const role of ['primary', 'helpers'] as UserRole[]) expect(readsCustomerLinesInJobUpdates(role)).toBe(true)
    for (const role of ['dev', 'master_technician', 'assistant', 'controller', 'estimator', 'superintendent', 'subcontractor'] as UserRole[]) {
      expect(readsCustomerLinesInJobUpdates(role)).toBe(false)
    }
    expect(readsCustomerLinesInJobUpdates(null)).toBe(false)
  })
})

/** The roles the newest migration that defines `fn` names in it: the database's copy of a GC team. */
function teamInSql(fn: 'gc_money_team' | 'gc_office_team' | 'gc_clause_approve_team' | 'messages_tech_team'): string[] {
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

/** The roles `get_gc_office_notices_due()` lets hear a notice as the project manager, in the newest migration that defines it. */
function officeNoticesTeamInSql(): string[] {
  const dir = join(process.cwd(), 'supabase', 'migrations')
  const sql = readdirSync(dir)
    .filter((f) => f.endsWith('.sql'))
    .sort()
    .reverse()
    .map((f) => readFileSync(join(dir, f), 'utf8'))
    .find((s) => s.includes('FUNCTION public.get_gc_office_notices_due('))
  const roles = sql && /mp\.role IN \(([^)]*)\)/.exec(sql)?.[1]
  if (!roles) throw new Error('no migration names the office notices\' roles')
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

  it('names the money team as gc-customer-email does, so the two copies cannot drift', () => {
    expect([...GC_MONEY_TEAM].sort()).toEqual([...GC_CUSTOMER_EMAIL_ROLES].sort())
  })

  it('names the office and the techs as messages-notify’s push for a reply does (R5), so the copies cannot drift', () => {
    expect([...GC_OFFICE_TEAM].sort()).toEqual([...MESSAGES_OFFICE_ROLES].sort())
    expect([...MESSAGES_TECH_TEAM].sort()).toEqual([...MESSAGES_TECH_ROLES].sort())
  })

  it('names the money team as the office notices do, who hear the money only on it (O10a)', () => {
    expect([...GC_MONEY_TEAM].sort()).toEqual(officeNoticesTeamInSql().sort())
  })
})

describe('canUseGcBuilding', () => {
  it('lets a dev write the daily log while Building is built', () => {
    expect(canUseGcBuilding('dev')).toBe(true)
  })

  it('keeps everyone else and a session with no role yet out', () => {
    for (const role of ['master_technician', 'assistant', 'controller', 'estimator', 'superintendent', 'primary', 'subcontractor', 'helpers'] as UserRole[]) {
      expect(canUseGcBuilding(role)).toBe(false)
    }
    expect(canUseGcBuilding(null)).toBe(false)
    expect(canUseGcBuilding(undefined)).toBe(false)
  })

  it('is a dev’s exactly while doors.ts keeps every Building table dev only, so Building’s door changes both', () => {
    const building = Object.values(GC_TABLE_DOORS).filter((d) => d.lane === 'Building')
    expect(building.length).toBeGreaterThan(0)
    expect(building.every((d) => d.door === 'dev')).toBe(GC_BUILDING_TEAM.length === 1 && GC_BUILDING_TEAM[0] === 'dev')
  })
})

describe('canUseGcBoardWrites', () => {
  it('lets a dev send a statement of work while award is a dev’s', () => {
    expect(canUseGcBoardWrites('dev')).toBe(true)
  })

  it('keeps the money team, who read it since O9, everyone else and a session with no role yet from writing', () => {
    for (const role of ['master_technician', 'assistant', 'controller', 'estimator', 'superintendent', 'primary', 'subcontractor', 'helpers'] as UserRole[]) {
      expect(canUseGcBoardWrites(role)).toBe(false)
    }
    expect(canUseGcBoardWrites(null)).toBe(false)
    expect(canUseGcBoardWrites(undefined)).toBe(false)
  })

  it('is a dev’s exactly while doors.ts keeps the statement of work dev only, so the award door changes both', () => {
    const award = ['gc_sows', 'gc_sow_lines'].map((t) => GC_TABLE_DOORS[t])
    expect(award.every((d) => d?.lane === 'Board')).toBe(true)
    expect(award.every((d) => d?.door === 'dev')).toBe(GC_BOARD_WRITE_TEAM.length === 1 && GC_BOARD_WRITE_TEAM[0] === 'dev')
  })
})

describe('canOpenOwnerContractFile (the Board’s B2b-v-iii)', () => {
  /** The newest migration's `gc_owner_contracts_select` on storage.objects: what it reads by. */
  function contractFileGate(): string {
    const dir = join(process.cwd(), 'supabase', 'migrations')
    const sql = readdirSync(dir)
      .filter((f) => f.endsWith('.sql'))
      .sort()
      .reverse()
      .map((f) => readFileSync(join(dir, f), 'utf8'))
      .find((s) => s.includes('CREATE POLICY gc_owner_contracts_select'))
    const using = sql?.match(/CREATE POLICY gc_owner_contracts_select[\s\S]*?USING \(([\s\S]*?)\);/)?.[1]
    if (!using) throw new Error('no migration creates gc_owner_contracts_select')
    return using.replace(/\s+/g, ' ').trim()
  }

  it('opens the file for a dev alone, as the bucket’s select policy reads by is_dev()', () => {
    expect(contractFileGate()).toBe("bucket_id = 'gc-owner-contracts' AND public.is_dev()")
    expect([...GC_OWNER_CONTRACT_FILE_TEAM]).toEqual(['dev'])
    expect(canOpenOwnerContractFile('dev')).toBe(true)
    for (const role of ['master_technician', 'controller', 'assistant', 'estimator', 'superintendent'] as UserRole[]) expect(canOpenOwnerContractFile(role)).toBe(false)
    expect(canOpenOwnerContractFile(null)).toBe(false)
  })
})

describe('canEditClause and canApproveClause (Messages, cut 4c)', () => {
  it('lets anyone in the office edit a clause, and nobody else', () => {
    expect([...GC_CLAUSE_EDIT_TEAM].sort()).toEqual([...GC_OFFICE_TEAM].sort())
    for (const role of ['dev', 'master_technician', 'assistant', 'controller', 'estimator'] as UserRole[]) expect(canEditClause(role)).toBe(true)
    for (const role of ['superintendent', 'subcontractor', 'helpers', 'primary'] as UserRole[]) expect(canEditClause(role)).toBe(false)
    expect(canEditClause(null)).toBe(false)
  })

  it('lets a dev or a controller approve, and nobody else (the owner, 2026-10-12)', () => {
    expect([...GC_CLAUSE_APPROVE_TEAM].sort()).toEqual(['controller', 'dev'])
    for (const role of ['master_technician', 'assistant', 'estimator', 'superintendent', 'subcontractor'] as UserRole[]) expect(canApproveClause(role)).toBe(false)
    expect(canApproveClause(null)).toBe(false)
  })

  it('keeps every approver on the team that edits', () => {
    for (const role of GC_CLAUSE_APPROVE_TEAM) expect(canEditClause(role)).toBe(true)
  })

  it('names the same approvers as the database’s gc_clause_approve_team(), so the two copies cannot drift', () => {
    expect([...GC_CLAUSE_APPROVE_TEAM].sort()).toEqual(teamInSql('gc_clause_approve_team').sort())
  })
})
