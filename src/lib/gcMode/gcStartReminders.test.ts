import { describe, expect, it } from 'vitest'
import { initialGcState } from './gcFixture'
import { portalMessages } from './gcPortal'
import { firstStartOf, startNeeds, startReminders } from './gcStartReminders'

/**
 * Fair Oaks Shops, Building D started Jul 1; Tri-County's sitework starts Mon Jul 6. The made-up job
 * is read at Oct 2 with its sitework long done, so the job is wound back: nothing reported, no daily log.
 */
const job = (today: string, wound = true) => {
  const fresh = initialGcState()
  const state = {
    ...fresh,
    today,
    projects: fresh.projects.map((p) =>
      p.id !== 'fairoaksd' || !wound
        ? p
        : { ...p, dailyLogs: [], packages: p.packages.map((k) => (k.id === 'fsite' && k.sow ? { ...k, sow: { ...k.sow, sov: k.sow.sov.map((l) => ({ ...l, pctReported: 0 })) } } : k)) },
    ),
  }
  return { state, project: state.projects.find((p) => p.id === 'fairoaksd')! }
}

describe('start reminders (G-114)', () => {
  it('knows a company’s first day on the job', () => {
    const { project } = job('2026-06-25')
    expect(firstStartOf(project, project.packages.find((k) => k.id === 'fsite')!)).toBe('2026-07-06')
  })

  it('goes out 14 days before, then 3, each once its day has come, while nobody is on site', () => {
    const early = job('2026-06-21')
    expect(startReminders(early.state, 'tricounty', early.project, 'en', 'Hello Marisol,')).toEqual([])
    const two = job('2026-06-25')
    const [first] = startReminders(two.state, 'tricounty', two.project, 'en', 'Hello Marisol,')
    expect(first).toMatchObject({ key: 'fsite:startSoon:14', on: '2026-06-22', kind: 'startSoon', projectId: 'fairoaksd', subject: 'Your work on Fair Oaks Shops, Building D starts Mon Jul 6' })
    expect(first?.lines).toEqual(['Hello Marisol,', 'Your Sitework work on Fair Oaks Shops, Building D starts Mon Jul 6, in 11 days: Clearing and grading.', 'Everything is in place on our side.', 'Answer in your portal with the day your crew will be on site.'])
    const both = job('2026-07-04')
    expect(startReminders(both.state, 'tricounty', both.project, 'en', 'Hello Marisol,').map((m) => m.key)).toEqual(['fsite:startSoon:14', 'fsite:startSoon:3'])
    // Once the daily log has them on site, or work is reported, nothing more.
    const later = job('2026-10-02', false)
    expect(startReminders(later.state, 'tricounty', later.project, 'en', 'Hello Marisol,')).toEqual([])
  })

  it('says what must be in place, in the company’s language', () => {
    const { state, project } = job('2026-10-05')
    const pkg = project.packages.find((k) => k.id === 'fhvac')!
    // Cool Breeze's controls drawings are not sent yet and hold its controls line; its insurance and statement of work are fine.
    expect(startNeeds(state, 'coolbreeze', project, pkg, '2026-11-02', 'en')).toEqual(['Your submittal 23 09 23-01, Controls: not sent yet. The work cannot start until it is approved.'])
    expect(startNeeds(state, 'coolbreeze', project, pkg, '2026-11-02', 'es')).toEqual(['Su submittal 23 09 23-01, Controls: aún no enviado. El trabajo no puede comenzar hasta que esté aprobado.'])
    // Pecan Valley's insurance ran out Sep 15, before a start after it.
    const felec = project.packages.find((k) => k.id === 'felec')!
    expect(startNeeds(state, 'pecanvalley', project, felec, '2026-10-19', 'en')).toContain('Your insurance certificate runs out Tue Sep 15, before your work starts. Send a current one.')
  })

  it('rides in the portal’s messages, as the job’s kind of email', () => {
    const { state } = job('2026-06-25')
    const mine = portalMessages(state, 'tricounty').filter((m) => m.kind === 'startSoon')
    expect(mine.map((m) => m.key)).toEqual(['fsite:startSoon:14'])
  })
})
