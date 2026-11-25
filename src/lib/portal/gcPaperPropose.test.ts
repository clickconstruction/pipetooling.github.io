import { describe, expect, it } from 'vitest'
import { parseGcJobPapers, type GcJobPaper } from './gcJobPapers'
import { GC_PROPOSE, gcProposalLine, gcProposeGround, gcProposePickAt, gcProposeProblem, gcProposeTopic } from './gcPaperPropose'
import { PROPOSAL_WORDS } from '../contracts/jobPaperProposal'

/** Made-up words. The page's own key, as the portal function hands it. */
const listed = {
  settings: [
    { key: 'photos', label: 'Photos and video', choices: [
      { key: 'off', label: 'Off', says: 'Placeholder: no photo rule.', out: true },
      { key: 'standard', label: 'Standard', says: 'Placeholder: ask first.' },
      { key: 'strict', label: 'Strict', says: 'Placeholder: no photos.' },
    ] },
    { key: 'term', label: 'How long', choices: [
      { key: 'short', label: 'Short', says: 'Placeholder: a short term.' },
      { key: 'long', label: 'Long', says: 'Placeholder: a long term.' },
    ] },
  ],
  levels: [
    { key: 'standard', label: 'Standard', alignedWith: 'Aligned with a placeholder place', picks: { photos: 'standard', term: 'short' } },
    { key: 'strict', label: 'Strict', alignedWith: 'Aligned with another placeholder place', picks: { photos: 'strict', term: 'long' } },
  ],
  notice: { title: 'Before you start', tick: 'I have read this.', lines: ['Placeholder notice line.'] },
}

function paper(over: Record<string, unknown> = {}): GcJobPaper {
  const read = parseGcJobPapers([{ jobId: 'job-1', jobLabel: 'Sample job', papers: [{ id: 'row-1', name: 'Sample secrecy paper', settingsRevision: 1, said: [], signed: 0, total: 3, view: 'businesses', businesses: [], signers: [], propose: { def: listed, picks: { photos: 'standard', term: 'short' }, basis: 'standard' }, ...over }] }])
  return read[0]!.papers[0]!
}

describe('gcPaperPropose · a GC proposes a stricter setting', () => {
  it('reads the ground a panel is drawn from, and none when the list or a pick does not read', () => {
    const ground = gcProposeGround(paper())!
    expect(ground.def.settings.map((s) => s.key)).toEqual(['photos', 'term'])
    expect(ground.flow?.levels.map((l) => l.id)).toEqual(['standard', 'strict'])
    expect(ground.picks).toEqual({ photos: 'standard', term: 'short' })
    expect(ground.basis).toBe('standard')
    expect(ground.hasNotice).toBe(true)
    expect(gcProposeGround(paper({ propose: null }))).toBeNull()
    expect(gcProposeGround(paper({ propose: { def: { settings: [] }, picks: {}, basis: null } }))).toBeNull()
    // A pick that is no choice of the list: nothing to propose from.
    expect(gcProposeGround(paper({ propose: { def: listed, picks: { photos: 'loud', term: 'short' }, basis: 'standard' } }))).toBeNull()
    // A basis the list does not have is dropped, and a list with no levels has no sliders.
    expect(gcProposeGround(paper({ propose: { def: listed, picks: { photos: 'standard', term: 'short' }, basis: 'gone' } }))!.basis).toBeNull()
    const flat = gcProposeGround(paper({ propose: { def: { ...listed, levels: [], notice: undefined }, picks: { photos: 'standard', term: 'short' }, basis: null } }))!
    expect(flat.flow).toBeNull()
    expect(flat.hasNotice).toBe(false)
  })

  it('puts a topic on its stop, with every stop looser than the job’s out of reach', () => {
    const ground = gcProposeGround(paper())!
    const photos = ground.def.settings[0]!
    // Off is stop 0, Standard 1, Strict 2. The job sits on Standard, so the floor is 1.
    expect(gcProposeTopic(ground, photos, 'standard')).toEqual({ stop: 'standard', floor: 1, label: 'Standard', says: 'Placeholder: ask first.' })
    expect(gcProposeTopic(ground, photos, 'strict')).toEqual({ stop: 'strict', floor: 1, label: 'Strict', says: 'Placeholder: no photos.' })
    expect(gcProposePickAt(ground, photos, 'strict')).toBe('strict')
    expect(gcProposePickAt(ground, photos, 'off')).toBe('off')
    expect(gcProposePickAt(ground, ground.def.settings[1]!, 'off')).toBeNull()
    // A list with no levels: no stop, and the topic is set from its choices.
    const flat = gcProposeGround(paper({ propose: { def: { ...listed, levels: [] }, picks: { photos: 'standard', term: 'short' }, basis: null } }))!
    expect(gcProposeTopic(flat, flat.def.settings[0]!, 'standard').stop).toBeNull()
  })

  it('says what stops the send, as the database would', () => {
    const ground = gcProposeGround(paper())!
    expect(gcProposeProblem(ground, { photos: 'standard', term: 'short' }, 'Greta Sample', true)).toBe(PROPOSAL_WORDS.nothing)
    expect(gcProposeProblem(ground, { photos: 'off', term: 'short' }, 'Greta Sample', true)).toBe(PROPOSAL_WORDS.looser)
    expect(gcProposeProblem(ground, { photos: 'strict', term: 'short' }, 'Greta Sample', false)).toBe(PROPOSAL_WORDS.notice)
    expect(gcProposeProblem(ground, { photos: 'strict', term: 'short' }, '', true)).toBe(PROPOSAL_WORDS.name)
    expect(gcProposeProblem(ground, { photos: 'strict', term: 'short' }, 'Greta Sample', true)).toBeNull()
  })

  it('reads the last proposal off the answer and says where it stands', () => {
    const day = (iso: string | null) => (iso ? 'Nov 24, 2026' : null)
    const waiting = paper({ proposal: { state: 'waiting', byName: 'Greta Sample', proposedAt: '2026-11-25T02:00:00+00:00', decidedAt: null, why: null, picks: { photos: 'strict', term: 'short' } } }).proposal!
    expect(waiting.picks).toEqual({ photos: 'strict', term: 'short' })
    expect(gcProposalLine(waiting, day)).toEqual({ tone: 'amber', chip: 'With our office', line: `Your proposal of Nov 24, 2026 is with our office. ${GC_PROPOSE.nothingChanges}`, why: null })
    expect(gcProposalLine({ ...waiting, state: 'taken', decidedAt: '2026-11-25T03:00:00+00:00' }, day).line).toBe('Our office took your proposal of Nov 24, 2026 on Nov 24, 2026. The paper above shows it.')
    expect(gcProposalLine({ ...waiting, state: 'declined', decidedAt: '2026-11-25T03:00:00+00:00', why: 'Placeholder reason.' }, day)).toEqual({ tone: 'grey', chip: 'Declined', line: 'Our office declined your proposal of Nov 24, 2026 on Nov 24, 2026.', why: 'Placeholder reason.' })
    expect(gcProposalLine({ ...waiting, state: 'overtaken' }, day).line).toBe('Your proposal of Nov 24, 2026 was set aside. The paper changed after you sent it.')
    // With no day it still reads.
    expect(gcProposalLine({ ...waiting, proposedAt: null }, () => null).line).toBe(`Your proposal is with our office. ${GC_PROPOSE.nothingChanges}`)
    // A state that is none of the four is no proposal at all, and neither is a paper with none.
    expect(paper({ proposal: { state: 'lost', byName: 'x' } }).proposal).toBeNull()
    expect(paper().proposal).toBeNull()
  })
})
