import { describe, expect, it } from 'vitest'
import { initialGcState } from './gcFixture'
import { gcReducer } from './gcReducer'
import { askChoices, askDraft, askStanding } from './gcAskCompanies'

/** Concrete on Boerne Retail Pad B: nobody asked yet in the made-up data. */
function padBConcrete() {
  const state = initialGcState()
  const project = state.projects.find((p) => p.name === 'Boerne Retail Pad B')
  const pkg = project?.packages.find((k) => k.trade === 'Concrete')
  if (!project || !pkg) throw new Error('the made-up data lost Pad B concrete')
  return { state, projectId: project.id, packageId: pkg.id }
}

describe('asking companies to quote, before anything goes out', () => {
  it('offers every company in the trade we have not asked, those in range first', () => {
    const { state, projectId, packageId } = padBConcrete()
    const choices = askChoices(state, projectId, packageId)
    expect(choices.map((c) => c.partner.company).sort()).toEqual(['Alamo Concrete', 'Guadalupe Flatwork'])
    expect(choices.every((c) => c.inZone)).toBe(true)
    expect(choices.every((c) => c.to.length > 0)).toBe(true)
    const firstFar = choices.findIndex((c) => !c.inZone)
    expect(firstFar === -1 || choices.slice(firstFar).every((c) => !c.inZone || c.declined)).toBe(true)
  })

  it('drops a company once it is asked', () => {
    const { state, projectId, packageId } = padBConcrete()
    const one = askChoices(state, projectId, packageId)[0]!.partner
    const after = gcReducer(state, { type: 'invite', projectId, packageId, partnerId: one.id })
    expect(askChoices(after, projectId, packageId).map((c) => c.partner.id)).not.toContain(one.id)
    expect(askDraft(after, projectId, packageId, one.id)).toBeNull()
  })

  it('shows the invitation each would get, and asks nobody doing it', () => {
    const { state, projectId, packageId } = padBConcrete()
    const before = JSON.stringify(state)
    const one = askChoices(state, projectId, packageId)[0]!.partner
    const draft = askDraft(state, projectId, packageId, one.id)
    expect(draft?.kind).toBe('invite')
    expect(draft?.subject).toContain('Boerne Retail Pad B')
    expect(draft?.lines[0]).toContain(one.contact.split(' ')[0])
    expect((draft?.scope ?? []).length).toBeGreaterThan(0)
    expect(JSON.stringify(state)).toBe(before)
  })

  it('writes it in Spanish for a company that chose Spanish', () => {
    const { state, projectId, packageId } = padBConcrete()
    const one = askChoices(state, projectId, packageId)[0]!.partner
    const english = askDraft(state, projectId, packageId, one.id)
    const spanish = askDraft(gcReducer(state, { type: 'setPartnerLanguage', partnerId: one.id, lang: 'es' }), projectId, packageId, one.id)
    expect(spanish?.subject).not.toBe(english?.subject)
  })

  it('says whether the trade reaches the two quotes we want', () => {
    const { state, projectId, packageId } = padBConcrete()
    expect(askStanding(state, projectId, packageId, 0).words).toBe('Tick a company to ask.')
    expect(askStanding(state, projectId, packageId, 1).words).toContain('1 email goes out')
    expect(askStanding(state, projectId, packageId, 1).words).toContain('short of 2 quotes')
    expect(askStanding(state, projectId, packageId, 2).words).toContain('has the 2 quotes we want')
    expect(askStanding(state, projectId, packageId, 2).quotes).toBe(0)
  })
})
