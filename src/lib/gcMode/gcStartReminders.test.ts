import { describe, expect, it } from 'vitest'
import { initialGcState } from './gcFixture'
import { gcReducer } from './gcReducer'
import { plainWordsFailures } from '../plainWords'
import type { GcState } from './gcTypes'
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
    // Pecan Valley's insurance ran out Sep 15, already past today: it says ran out (G-139), as the office's gap does.
    const felec = project.packages.find((k) => k.id === 'felec')!
    expect(startNeeds(state, 'pecanvalley', project, felec, '2026-10-19', 'en')).toContain('Your insurance certificate ran out Tue Sep 15. Send a current one.')
  })

  it('rides in the portal’s messages, as the job’s kind of email', () => {
    const { state } = job('2026-06-25')
    const mine = portalMessages(state, 'tricounty').filter((m) => m.kind === 'startSoon')
    expect(mine.map((m) => m.key)).toEqual(['fsite:startSoon:14'])
  })
})

/**
 * Helotes Dental Office drawn from Mon Oct 5, started anyway, read on Tue Oct 6: the 14-day reminders
 * for Mon Oct 20 have gone. Kendall Air's master agreement is out and its statement of work only drafted.
 */
function helotes(): { state: GcState; project: GcState['projects'][number] } {
  let state = gcReducer(initialGcState(), { type: 'draftSchedule', projectId: 'helotes', start: '2026-10-05' })
  state = { ...gcReducer(state, { type: 'startProject', projectId: 'helotes', anyway: { reason: 'The slab before the rain', by: 'Robert' } }), today: '2026-10-06' }
  return { state, project: state.projects.find((p) => p.id === 'helotes')! }
}

describe('one readiness list for both sides (G-139)', () => {
  it('tells Kendall Air what its bar waits on: the master agreement too, and a statement of work not sent', () => {
    const { state, project } = helotes()
    const [en] = startReminders(state, 'kendall', project, 'en', 'Hello Josie,')
    expect(en?.lines).toEqual([
      'Hello Josie,',
      'Your HVAC work on Helotes Dental Office starts Tue Oct 20, in 14 days: Split systems.',
      'Before then, this must be in place:',
      'Your master agreement is not signed yet. Sign it in your portal.',
      'Your statement of work is not sent yet. We will send it to sign.',
      'Answer in your portal with the day your crew will be on site.',
    ])
    const [es] = startReminders(state, 'kendall', project, 'es', 'Hola Josie,')
    expect(es?.lines.slice(2, 5)).toEqual([
      'Antes de eso, esto debe estar listo:',
      'Su contrato maestro aún no está firmado. Fírmelo en su portal.',
      'Su orden de trabajo aún no ha sido enviada. Se la enviaremos para firmar.',
    ])
  })

  it('names every paper the office lacks, in Get started’s order', () => {
    const { state: base, project } = helotes()
    // Brightline with every paper out: master agreement sent, no certificate, no W-9, its statement of work sent.
    const state: GcState = { ...base, partners: base.partners.map((p) => (p.id === 'brightline' ? { ...p, msa: 'sent', coiExpires: null, w9: false } : p)) }
    const delec = project.packages.find((k) => k.id === 'delec')!
    expect(startNeeds(state, 'brightline', project, delec, '2026-10-20', 'en')).toEqual([
      'Your master agreement is not signed yet. Sign it in your portal.',
      'Your insurance certificate: we have none on file.',
      'We have no W-9 from you yet. Fill it in and sign it in your portal.',
      'Your statement of work is not signed yet.',
    ])
    // A master agreement never sent, and a certificate that runs out before the start, within the month.
    const unsent: GcState = { ...base, partners: base.partners.map((p) => (p.id === 'brightline' ? { ...p, msa: 'none', coiExpires: '2026-10-15' } : p)) }
    expect(startNeeds(unsent, 'brightline', project, delec, '2026-10-20', 'en').slice(0, 2)).toEqual([
      'Your master agreement is not sent yet. We will send it to sign.',
      'Your insurance certificate runs out Thu Oct 15, before your work starts. Send a current one.',
    ])
  })

  it('asks for a new statement of work when the plans changed after it was signed', () => {
    const { state: base } = helotes()
    // Hill Country signed on the Permit set; Addendum 1 came after it.
    const state: GcState = {
      ...base,
      projects: base.projects.map((p) => (p.id === 'helotes' ? { ...p, planSets: [...p.planSets, { rev: 1, label: 'Addendum 1', issuedOn: '2026-10-01', note: '', changedSheets: [], touches: ['dry'] }] } : p)),
    }
    const project = state.projects.find((p) => p.id === 'helotes')!
    const dry = project.packages.find((k) => k.id === 'dry')!
    expect(startNeeds(state, 'hillcountry', project, dry, '2026-10-10', 'en')).toEqual(['The plans changed after you signed your statement of work. We will send a new one to sign.'])
  })

  it('says every new sentence in plain words', () => {
    const { state: base, project } = helotes()
    const state: GcState = { ...base, partners: base.partners.map((p) => (p.id === 'brightline' ? { ...p, msa: 'sent', coiExpires: '2026-09-01', w9: false } : p)) }
    const delec = project.packages.find((k) => k.id === 'delec')!
    const sentences = [...startNeeds(state, 'brightline', project, delec, '2026-10-20', 'en'), ...(startReminders(base, 'kendall', project, 'en', 'Hello Josie,')[0]?.lines ?? [])]
    expect(sentences.flatMap(plainWordsFailures)).toEqual([])
  })
})
