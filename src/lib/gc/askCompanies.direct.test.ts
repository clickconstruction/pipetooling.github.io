/**
 * Main's own tests for the Ask window's choices (the Board's B4-a), run through the kernels on the
 * test data. The spike's own case: Concrete on Boerne Retail Pad B, where nobody is asked yet. The
 * spike's tests that ask through the reducer (`askDraft`) stay on the spike.
 */
import { describe, expect, it } from 'vitest'
import { askChoices, askStanding } from './askCompanies'
import { find } from './lookups'
import { initialGcState } from './schedule/testState'
import type { GcState } from './types'

/** Concrete on Boerne Retail Pad B: nobody asked yet in the made-up data. */
function padBConcrete() {
  const state = initialGcState()
  const project = state.projects.find((p) => p.name === 'Boerne Retail Pad B')
  const pkg = project?.packages.find((k) => k.trade === 'Concrete')
  if (!project || !pkg) throw new Error('the made-up data lost Pad B concrete')
  return { state, projectId: project.id, packageId: pkg.id }
}

/** The state with one more company asked on a trade, as `gc_invite_companies` leaves it. */
function asked(state: GcState, projectId: string, packageId: string, partnerId: string): GcState {
  return {
    ...state,
    projects: state.projects.map((p) =>
      p.id !== projectId
        ? p
        : { ...p, packages: p.packages.map((k) => (k.id !== packageId ? k : { ...k, invites: [...k.invites, { id: 'new-ask', partnerId, status: 'invited' as const, invitedOn: state.today, bid: null, seenRev: null }] })) },
    ),
  }
}

describe('asking companies to quote, before anything goes out', () => {
  it('offers every company in the trade we have not asked, those in range first, with the drive and how they answer', () => {
    const { state, projectId, packageId } = padBConcrete()
    const choices = askChoices(state, projectId, packageId)
    expect(choices.map((c) => [c.partner.company, c.inZone, c.travel, c.record])).toEqual([
      ['Alamo Concrete', true, '35 mi', 'reliable'],
      ['Guadalupe Flatwork', true, '58 mi', 'reliable'],
    ])
    expect(choices.every((c) => !c.notVetted && !c.declined)).toBe(true)
  })

  it('names who gets the invitation, and shows no address for a contact the record has none for', () => {
    const { state, projectId, packageId } = padBConcrete()
    expect(askChoices(state, projectId, packageId).map((c) => c.to)).toEqual([[{ name: 'Hector Luna', email: null }], [{ name: 'Ines Barrera', email: null }]])
    const withEmail = { ...state, partners: state.partners.map((p) => (p.company === 'Alamo Concrete' ? { ...p, email: 'hector@alamoconcrete.test' } : p)) }
    expect(askChoices(withEmail, projectId, packageId)[0]?.to).toEqual([{ name: 'Hector Luna', email: 'hector@alamoconcrete.test' }])
  })

  it('drops a company once it is asked, and counts it as out on the trade', () => {
    const { state, projectId, packageId } = padBConcrete()
    const one = askChoices(state, projectId, packageId)[0]!.partner
    const after = asked(state, projectId, packageId, one.id)
    expect(askChoices(after, projectId, packageId).map((c) => c.partner.id)).not.toContain(one.id)
    expect(askStanding(after, projectId, packageId, 1)).toMatchObject({ quotes: 0, out: 1 })
    expect(askStanding(after, projectId, packageId, 1).words).toContain('has the 2 quotes we want')
  })

  it('says whether the trade reaches the two quotes we want', () => {
    const { state, projectId, packageId } = padBConcrete()
    expect(askStanding(state, projectId, packageId, 0).words).toBe('Tick a company to ask.')
    expect(askStanding(state, projectId, packageId, 1).words).toBe("1 email goes out, each with the company's own portal link. That still leaves Concrete short of 2 quotes.")
    expect(askStanding(state, projectId, packageId, 2).words).toBe("2 emails go out, each with the company's own portal link. If they answer, Concrete has the 2 quotes we want.")
    expect(askStanding(state, projectId, packageId, 2)).toMatchObject({ quotes: 0, wanted: 2, out: 0 })
  })

  it('finds the project, the trade, the ask and its company, and nothing for an id it does not know', () => {
    const { state, projectId, packageId } = padBConcrete()
    const one = askChoices(state, projectId, packageId)[0]!.partner
    const found = find(asked(state, projectId, packageId, one.id), projectId, packageId, 'new-ask')
    expect([found.project?.name, found.pkg?.trade, found.invite?.id, found.partner?.company]).toEqual(['Boerne Retail Pad B', 'Concrete', 'new-ask', 'Alamo Concrete'])
    expect(find(state, projectId, 'no-such-trade')).toMatchObject({ pkg: undefined, invite: undefined, partner: undefined })
    expect(askChoices(state, projectId, 'no-such-trade')).toEqual([])
  })
})
