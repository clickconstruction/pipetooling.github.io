import { describe, expect, it } from 'vitest'
import { jobsPageTabs, type JobsPageTabKey } from './jobsPageTabs'
import { isAssistantLike } from '../subcontractorLikeRole'

const words = (authRole: string | null, myRole: string | null = authRole) => jobsPageTabs({ authRole, myRole }).map((t) => t.label)

/**
 * The row as the Jobs page drew it before this kernel, one condition a button, copied from the page's markup
 * of v2.8285. A `|` is the thin bar. The kernel must draw the same row for every pair of roles.
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
    if (showStagesAndBillingTabs) row.push('|', 'billing:Billing')
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
    const whole = ['Crew P&L', 'Reports', 'Pipeline', 'Billing', 'Team', 'Subs', 'Parts', 'Materials', 'Job Summary', 'Inspections']
    expect(words('dev')).toEqual(whole)
    expect(words('master_technician')).toEqual(whole)
  })

  it('an assistant has no Crew P&L and no Team', () => {
    expect(words('assistant')).toEqual(['Reports', 'Pipeline', 'Billing', 'Subs', 'Parts', 'Materials', 'Job Summary', 'Inspections'])
  })

  it('a controller has no Crew P&L and keeps Team', () => {
    expect(words('controller')).toEqual(['Reports', 'Pipeline', 'Billing', 'Team', 'Subs', 'Parts', 'Materials', 'Job Summary', 'Inspections'])
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

  it('draws a thin bar before Billing and before Inspections, and nowhere else', () => {
    const bars = (role: string) => jobsPageTabs({ authRole: role, myRole: role }).filter((t) => t.barBefore).map((t) => t.key)
    expect(bars('dev')).toEqual<JobsPageTabKey[]>(['billing', 'inspections'])
    expect(bars('assistant')).toEqual<JobsPageTabKey[]>(['billing', 'inspections'])
    expect(bars('superintendent')).toEqual([])
    expect(bars('primary')).toEqual([])
  })

  it('Materials alone carries words for a resting pointer', () => {
    const titled = jobsPageTabs({ authRole: 'dev', myRole: 'dev' }).filter((t) => t.title)
    expect(titled.map((t) => t.key)).toEqual(['materials'])
    expect(titled[0]!.title).toBe('Materials on site: what is in the cages and boxes on every job, what went missing, which containers are due a count')
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
