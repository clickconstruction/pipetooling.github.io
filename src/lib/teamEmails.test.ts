import { describe, expect, it } from 'vitest'
import { EMAIL_CATALOG } from './emailCatalog'
import {
  TEAM_EMAILS,
  TEAM_EMAIL_FROM_LABEL,
  TEAM_EMAIL_WHEN_ORDER,
  groupTeamEmailsByWhen,
  personGetsTeamEmail,
  teamCoverageLine,
  teamEmailCoverage,
  teamEmailById,
  teamEmailsForPerson,
  teamEmailsForRole,
} from './teamEmails'

const ctx = { todayYmd: '2026-09-29', dateLabel: 'Sep 29, 2026', weekStartLabel: 'Sep 21', weekEndLabel: 'Sep 27', firstName: 'Malachi' }

describe('TEAM_EMAILS — the guard (punch list #60)', () => {
  it('every team or internal catalog row has a row here, and nothing else does', () => {
    const catalogIds = EMAIL_CATALOG.filter((e) => e.audience !== 'customer').map((e) => e.id).sort()
    const teamIds = TEAM_EMAILS.map((e) => e.id).sort()
    expect(teamIds).toEqual(catalogIds)
  })
  it('ids are unique and every row has a when, a rule, and at least one role', () => {
    expect(new Set(TEAM_EMAILS.map((e) => e.id)).size).toBe(TEAM_EMAILS.length)
    for (const e of TEAM_EMAILS) {
      expect(TEAM_EMAIL_WHEN_ORDER).toContain(e.when.kind)
      expect(e.recipients.rule.length, e.id).toBeGreaterThan(10)
      expect(e.recipients.roles.length, e.id).toBeGreaterThan(0)
      if (e.recipients.decidedBy === 'setting' && e.id !== 'report_email') expect(e.recipients.list, e.id).toBeTruthy()
    }
  })
  it('sample subjects are filled in — no {{vars}} left', () => {
    for (const e of TEAM_EMAILS) {
      const s = e.sampleSubject(ctx)
      expect(s, e.id).not.toMatch(/\{\{/)
      expect(s.length, e.id).toBeGreaterThan(4)
    }
    expect(teamEmailById('money_waiting')!.sampleSubject(ctx)).toBe('Money waiting — Sep 29, 2026')
    expect(teamEmailById('gc_word_ask')!.sampleSubject(ctx)).toBe('Malachi, where do your 7 GCs stand? — $312,500 owed')
  })
  it('the From is the software, on the shared fallback address', () => {
    expect(TEAM_EMAIL_FROM_LABEL).toBe('ClickTooling <team@noreply.clicktooling.com>')
  })
})

describe('whose week', () => {
  it('a controller gets the money digests but not the CT roster audit; a helper gets the once-and-event rows only', () => {
    const controller = teamEmailsForRole('controller').map((e) => e.id)
    expect(controller).toContain('money_waiting')
    expect(controller).toContain('weekly_money')
    expect(controller).not.toContain('ct_roster_audit')
    const helper = teamEmailsForRole('helpers').map((e) => e.id)
    expect(helper).toContain('invitation')
    expect(helper).toContain('workflow_notifications')
    expect(helper).not.toContain('money_waiting')
  })
  it('rows come back in the day’s order and group by when', () => {
    const rows = teamEmailsForRole('dev')
    for (let i = 1; i < rows.length; i += 1) expect(rows[i]!.when.order).toBeGreaterThanOrEqual(rows[i - 1]!.when.order)
    const groups = groupTeamEmailsByWhen(rows)
    expect(groups.map((g) => g.kind)).toEqual(['morning', 'event', 'weekly', 'once'])
    expect(groups[0]!.rows.map((r) => r.id)).toEqual(['crew_day', 'money_waiting', 'payment_forecast', 'schedule_day'])
  })
  it('a person: a setting-driven row asks its list; an unloaded list falls back to the role', () => {
    const paid = teamEmailById('paid_job')!
    const malachi = { id: 'u-malachi', role: 'controller' as const }
    expect(personGetsTeamEmail(paid, malachi, { paid_job: ['u-malachi'] })).toBe(true)
    expect(personGetsTeamEmail(paid, malachi, { paid_job: ['u-wendi'] })).toBe(false)
    expect(personGetsTeamEmail(paid, malachi, { paid_job: null })).toBe(true)
    expect(personGetsTeamEmail(paid, malachi, {})).toBe(true)
    // the role gate still comes first
    expect(personGetsTeamEmail(paid, { id: 'u-x', role: 'helpers' }, { paid_job: ['u-x'] })).toBe(false)
    const ids = teamEmailsForPerson(malachi, { paid_job: [], ready_to_bill: [], signed_agreements: [] }).map((e) => e.id)
    expect(ids).toContain('money_waiting')
    expect(ids).not.toContain('paid_job')
    expect(ids).not.toContain('signed_agreement_staff')
  })
})

describe('coverage', () => {
  it('counts the three render kinds and reads as one line', () => {
    const c = teamEmailCoverage()
    expect(c.total).toBe(25)
    expect(c.sample + c.real + c.soon).toBe(25)
    expect(c.sample).toBe(20)
    expect(c.real).toBe(0)
    expect(teamCoverageLine(c)).toBe('25 emails · 20 render live · 5 built on the server (next release)')
    expect(teamCoverageLine({ total: 1, sample: 1, real: 0, soon: 0 })).toBe('1 email · 1 render live')
  })
})
