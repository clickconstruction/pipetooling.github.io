import { describe, expect, it } from 'vitest'
import { BILLING_TAB_RETIRED_WORDS, jobsPageTabs, retiredJobsTab, type JobsPageTabKey } from './jobsPageTabs'
import { isAssistantLike } from '../subcontractorLikeRole'

const words = (authRole: string | null, myRole: string | null = authRole) => jobsPageTabs({ authRole, myRole }).map((t) => t.label)

/**
 * The row as the Jobs page drew it before this kernel, one condition a button, copied from the page's markup
 * of v2.8285, less the Billing tab, which left in v2.8698: its bar now sits before whichever tab follows
 * Pipeline. A `|` is the thin bar. The kernel must draw the same row for every pair of roles.
 */
function rowBefore(authRole: string | null, myRole: string | null): string[] {
  const isPrimaryOrUnknown = authRole === 'primary' || myRole === 'primary' || (authRole === null && myRole === null)
  const showPrimaryRestrictedTabs = !isPrimaryOrUnknown
  const isSuperintendent = authRole === 'superintendent' || myRole === 'superintendent'
  const showStagesAndBillingTabs = showPrimaryRestrictedTabs && !isSuperintendent
  const showTeamsTab =
    showPrimaryRestrictedTabs && !isAssistantLike(authRole) && authRole !== 'superintendent' && myRole !== 'superintendent' && !isAssistantLike(myRole)
  const showTeamLaborTab = authRole !== 'assistant' && myRole !== 'assistant' && authRole !== 'superintendent' && myRole !== 'superintendent'
  const showSuperintendentExtraTabs = !isSuperintendent
  const row: string[] = []
  if (showTeamsTab) row.push('teams-summary:Crew P&L')
  row.push('reports:Reports')
  if (showStagesAndBillingTabs) row.push('stages:Pipeline')
  if (showPrimaryRestrictedTabs) {
    if (showStagesAndBillingTabs) row.push('|')
    if (showTeamLaborTab) row.push('combined-labor:Team')
    row.push('subs:Subs')
    if (showSuperintendentExtraTabs) row.push('parts:Parts')
    if (showSuperintendentExtraTabs) row.push('materials:Materials')
  }
  if (showPrimaryRestrictedTabs && showSuperintendentExtraTabs) row.push('job-summary:Job Summary')
  if (showPrimaryRestrictedTabs && showSuperintendentExtraTabs) row.push('|', 'inspections:Inspections')
  return row
}

function rowNow(authRole: string | null, myRole: string | null): string[] {
  return jobsPageTabs({ authRole, myRole }).flatMap((t) => (t.barBefore ? ['|', `${t.key}:${t.label}`] : [`${t.key}:${t.label}`]))
}

const ROLES = ['dev', 'master_technician', 'assistant', 'controller', 'superintendent', 'estimator', 'primary', 'helpers', 'subcontractor', 'digital_twin', 'a-role-added-later']

describe('jobsPageTabs', () => {
  it('a dev and a leader have the whole row, in its order', () => {
    const whole = ['Crew P&L', 'Reports', 'Pipeline', 'Team', 'Subs', 'Parts', 'Materials', 'Job Summary', 'Inspections']
    expect(words('dev')).toEqual(whole)
    expect(words('master_technician')).toEqual(whole)
  })

  it('an assistant has no Crew P&L and no Team', () => {
    expect(words('assistant')).toEqual(['Reports', 'Pipeline', 'Subs', 'Parts', 'Materials', 'Job Summary', 'Inspections'])
  })

  it('a controller has no Crew P&L and keeps Team', () => {
    expect(words('controller')).toEqual(['Reports', 'Pipeline', 'Team', 'Subs', 'Parts', 'Materials', 'Job Summary', 'Inspections'])
  })

  it('a superintendent has Reports and Subs', () => {
    expect(words('superintendent')).toEqual(['Reports', 'Subs'])
  })

  it('a primary has Reports alone, and so does a person whose role is not read yet', () => {
    expect(words('primary')).toEqual(['Reports'])
    expect(words(null, null)).toEqual(['Reports'])
  })

  it('reads the role on the person’s own row when the sign-in carries none yet', () => {
    expect(words(null, 'superintendent')).toEqual(['Reports', 'Subs'])
    expect(words(null, 'primary')).toEqual(['Reports'])
    expect(words(null, 'dev')).toEqual(words('dev'))
  })

  it('draws a thin bar after Pipeline and before Inspections, and nowhere else', () => {
    const bars = (role: string) => jobsPageTabs({ authRole: role, myRole: role }).filter((t) => t.barBefore).map((t) => t.key)
    expect(bars('dev')).toEqual<JobsPageTabKey[]>(['combined-labor', 'inspections'])
    expect(bars('assistant')).toEqual<JobsPageTabKey[]>(['subs', 'inspections'])
    expect(bars('superintendent')).toEqual([])
    expect(bars('primary')).toEqual([])
  })

  it('Materials alone carries words for a resting pointer', () => {
    const titled = jobsPageTabs({ authRole: 'dev', myRole: 'dev' }).filter((t) => t.title)
    expect(titled.map((t) => t.key)).toEqual(['materials'])
    expect(titled[0]!.title).toBe('Materials on site: what is in the cages and boxes on every job, what went missing, which containers are due a count')
  })

  it('has no Billing tab for any role (punch list #190, decision 5)', () => {
    for (const role of ROLES) expect(words(role), role).not.toContain('Billing')
  })

  it('lands an old Billing link, and its older ledger name, on the Pipeline', () => {
    expect(retiredJobsTab('billing')).toBe('stages')
    expect(retiredJobsTab('ledger')).toBe('stages')
    // A tab the row still has, the Billed stage's own address and no tab at all are left to the page.
    for (const tab of ['stages', 'reports', 'subs', 'billed', '', null, undefined, 'toString', 'constructor']) expect(retiredJobsTab(tab), String(tab)).toBeNull()
  })

  it('says where bills are made, in words that pass for a first-timer', () => {
    expect(BILLING_TAB_RETIRED_WORDS).toBe('The Billing tab is gone. Bills are made here on the Pipeline.')
  })

  it('every key is a tab once', () => {
    const keys = jobsPageTabs({ authRole: 'dev', myRole: 'dev' }).map((t) => t.key)
    expect(new Set(keys).size).toBe(keys.length)
  })

  it('draws the row the page drew before, for every pair of roles', () => {
    const each = [null, ...ROLES]
    let pairs = 0
    for (const authRole of each) {
      for (const myRole of each) {
        expect(rowNow(authRole, myRole), `${authRole} / ${myRole}`).toEqual(rowBefore(authRole, myRole))
        pairs += 1
      }
    }
    expect(pairs).toBe(144)
  })
})
