import { describe, expect, it } from 'vitest'
import { initialGcState } from './gcFixture'
import { gcReducer } from './gcReducer'
import { plainWordsFailures } from '../plainWords'
import { startNeeds } from './gcStartReminders'
import { walkItems } from './gcScheduleWalk'
import type { GanttHold } from './gcGantt'
import type { GcProject, GcState, Partner } from './gcTypes'
import { chartHolds } from './gcChartHolds'
import { NOT_READY_LATE_DAYS, holdWordsInList, lapsedInsuranceWords, notReadyBars, notReadyBlock, notReadyWords, startGaps, uninsuredBars, uninsuredBlock, uninsuredNotes, withNotReady, type NotReadyBlock } from './gcNotReady'
import { scheduleMeasures } from './gcBuildingSchedule'
import { ganttBars, ganttCounts } from './gcGantt'

/** Fair Oaks Shops, Building D, being built; the made-up today is Fri Oct 2, and Pecan Valley's insurance ran out Sep 15. */
const fairOaks = (state: GcState) => state.projects.find((p) => p.id === 'fairoaksd')!

function withPartner(state: GcState, id: string, change: Partial<Partner>): GcState {
  return { ...state, partners: state.partners.map((p) => (p.id === id ? { ...p, ...change } : p)) }
}

/**
 * Helotes Dental Office, drawn from Mon Oct 5 and, unless `start` is off, started anyway: Electrical's
 * statement of work is out for signature, HVAC's master agreement is out and its statement of work
 * only drafted, Millwork has no company. Framing has every paper in.
 */
function helotes(start = true): { state: GcState; project: GcProject } {
  let state = gcReducer(initialGcState(), { type: 'draftSchedule', projectId: 'helotes', start: '2026-10-05' })
  if (start) state = gcReducer(state, { type: 'startProject', projectId: 'helotes', anyway: { reason: 'The slab before the rain', by: 'Robert' } })
  return { state, project: state.projects.find((p) => p.id === 'helotes')! }
}

/** The submittal hold the Schedule tab puts on Fire alarm (`holdsOf`). */
const fireAlarmSubmittal = (late = false) => new Map<string, GanttHold>([['felec-4', { kind: 'submittal', words: 'submittal 28 31 11-01', late }]])

/** Every sentence a block shows. */
function sentencesOf(block: NotReadyBlock | null): string[] {
  if (!block) return []
  return [block.title, ...block.lines.flatMap((l) => [l.line, l.promise, l.hint]), block.last].filter((s): s is string => Boolean(s))
}

describe('a trade not ready to start (G-77)', () => {
  it('holds only the bars that have not started, on a trade whose papers are not in', () => {
    const state = initialGcState()
    const project = fairOaks(state)
    // Pecan Valley is on site, so its Panels and feeders and its Lighting are under way, not waiting to start.
    expect(notReadyBars(state, project).map((b) => [b.lineId, b.start, b.late, notReadyWords(b.gaps)])).toEqual([
      ['felec-5', '2026-10-19', false, 'current insurance, theirs ran out Sep 15'],
      ['felec-4', '2026-11-02', false, 'current insurance, theirs ran out Sep 15'],
    ])
    // On the chart: Site lighting is held by its papers alone; Fire alarm keeps its submittal, after them.
    const holds = fireAlarmSubmittal()
    const out = withNotReady(holds, state, project)
    expect(out.get('felec-5')).toEqual({ kind: 'paperwork', words: 'current insurance, theirs ran out Sep 15', late: false })
    expect(out.get('felec-4')).toEqual({ kind: 'paperwork', words: 'current insurance and submittal 28 31 11-01', late: false })
    expect(out.size).toBe(2)
    expect(holds.size).toBe(1)
    // A renewed certificate takes them off, and the chart keeps the map it had.
    const renewed = withPartner(state, 'pecanvalley', { coiExpires: '2027-09-15' })
    expect(notReadyBars(renewed, fairOaks(renewed))).toEqual([])
    expect(withNotReady(holds, renewed, fairOaks(renewed))).toBe(holds)
  })

  it('reads insurance on the day each bar starts, once the renewal ask is due', () => {
    const base = initialGcState()
    // Runs out Sun Oct 25: after Site lighting starts Oct 19, before Fire alarm starts Nov 2.
    const oct25 = withPartner(base, 'pecanvalley', { coiExpires: '2026-10-25' })
    expect(notReadyBars(oct25, fairOaks(oct25)).map((b) => [b.lineId, notReadyWords(b.gaps)])).toEqual([['felec-4', 'current insurance, theirs runs out Oct 25']])
    expect(notReadyBlock(oct25, fairOaks(oct25), 'felec-4')?.lines.map((l) => l.line)).toEqual(['Insurance runs out Sun Oct 25, before this starts.'])
    // Cool Breeze has Rooftop units Oct 12, Controls Nov 2 and Test and balance Nov 30 still to start.
    // A certificate 30 days off is asked for now; 32 days off, the usual renewal has time.
    const hvac = (state: GcState) => notReadyBars(state, fairOaks(state)).filter((b) => b.pkg.id === 'fhvac').map((b) => b.lineId)
    expect(hvac(withPartner(base, 'coolbreeze', { coiExpires: '2026-11-01' }))).toEqual(['fhvac-3', 'fhvac-4'])
    expect(hvac(withPartner(base, 'coolbreeze', { coiExpires: '2026-11-03' }))).toEqual([])
    // None on file holds every bar of theirs not started.
    const none = withPartner(base, 'coolbreeze', { coiExpires: null })
    expect(notReadyBars(none, fairOaks(none)).filter((b) => b.pkg.id === 'fhvac').map((b) => [b.lineId, notReadyWords(b.gaps)])).toEqual([
      ['fhvac-1', 'insurance, none on file'],
      ['fhvac-3', 'insurance, none on file'],
      ['fhvac-4', 'insurance, none on file'],
    ])
    expect(notReadyBlock(none, fairOaks(none), 'fhvac-1')?.lines.map((l) => [l.line, l.verb])).toEqual([['Insurance: none on file.', 'Ask for it']])
  })

  it('says what each trade still needs on a job started anyway', () => {
    const { state, project } = helotes()
    const one = 'a signed statement of work, sent Sep 30'
    const two = 'a signed master agreement and a signed statement of work'
    const none = 'an award, no company yet'
    // Framing has every paper in; our own plumbing and the inspections need none.
    expect(notReadyBars(state, project).map((b) => [b.lineId, notReadyWords(b.gaps)])).toEqual([
      ['delec-1', one],
      ['delec-4', one],
      ['dhvac-1', two],
      ['dhvac-2', two],
      ['mill-1', none],
      ['mill-2', none],
      ['mill-3', none],
      ['delec-2', one],
      ['delec-3', one],
      ['dhvac-3', two],
    ])
    expect(startGaps(state, project, project.packages.find((k) => k.id === 'dry')!, '2026-11-12')).toEqual([])
    expect(startGaps(state, project, project.packages.find((k) => k.id === 'dplumb')!, '2026-10-05')).toEqual([])
    // Several papers and a hold already there read as one list.
    const held = new Map<string, GanttHold>([['dhvac-1', { kind: 'submittal', words: 'submittal 23 81 26-01', late: false }]])
    expect(withNotReady(held, state, project).get('dhvac-1')?.words).toBe('a signed master agreement, a signed statement of work and submittal 23 81 26-01')
  })

  it('holds nothing while the job is being bought out: Get started is the place for that', () => {
    const { state, project } = helotes(false)
    expect(project.stage).toBe('buyout')
    expect(notReadyBars(state, project)).toEqual([])
    const holds = new Map<string, GanttHold>()
    expect(withNotReady(holds, state, project)).toBe(holds)
  })

  it('turns late once the bar starts within three days, or its day passed with nothing reported', () => {
    expect(NOT_READY_LATE_DAYS).toBe(3)
    const on = (today: string) => {
      const state = { ...initialGcState(), today }
      return { state, bar: notReadyBars(state, fairOaks(state)).find((b) => b.lineId === 'felec-5') }
    }
    expect(on('2026-10-15').bar?.late).toBe(false)
    expect(on('2026-10-16').bar?.late).toBe(true)
    const startDay = on('2026-10-19')
    expect(notReadyBlock(startDay.state, fairOaks(startDay.state), 'felec-5')?.title).toBe('This starts today. Pecan Valley Electric is not ready.')
    const passed = on('2026-10-21')
    expect(passed.bar?.late).toBe(true)
    expect(notReadyBlock(passed.state, fairOaks(passed.state), 'felec-5')).toMatchObject({ title: 'This was to start Mon Oct 19. Pecan Valley Electric is not ready.', late: true })
    // A late hold already on the bar keeps it late.
    const state = initialGcState()
    expect(withNotReady(fireAlarmSubmittal(true), state, fairOaks(state)).get('felec-4')?.late).toBe(true)
  })

  it('reads on the weekly walk the way any hold does', () => {
    // Site lighting starts Mon Oct 19: on the walk from Mon Oct 12, a week out; late from Fri Oct 16.
    const facts = (today: string) => {
      const state = { ...initialGcState(), today }
      const project = fairOaks(state)
      return walkItems(state, project, withNotReady(new Map(), state, project)).find((i) => i.lineId === 'felec-5')
    }
    expect(facts('2026-10-12')).toMatchObject({ kind: 'held', chip: 'held' })
    expect(facts('2026-10-12')?.facts).toContain('It waits on current insurance, theirs ran out Sep 15.')
    expect(facts('2026-10-16')?.facts).toContain('It waits on current insurance, theirs ran out Sep 15, which is late.')
  })

  it('folds a hold already on the bar in as the office typed it, lowercasing only a plain first word', () => {
    expect(holdWordsInList('The transformer, expected Oct 15 and not in')).toBe('the transformer, expected Oct 15 and not in')
    expect(holdWordsInList('RFI-004, waiting on us')).toBe('RFI-004, waiting on us')
    expect(holdWordsInList('CPS Energy service drop, expected Oct 15 and not in')).toBe('CPS Energy service drop, expected Oct 15 and not in')
    for (const first of ['A', 'An', 'Their', 'Its', 'Our']) expect(holdWordsInList(`${first} new panel`)).toBe(`${first.toLowerCase()} new panel`)
    // Only the whole first word: these stay as typed.
    expect(holdWordsInList('Anchor bolts')).toBe('Anchor bolts')
    expect(holdWordsInList('A/C units')).toBe('A/C units')
    // On the chart, Mon Oct 19: Site lighting waits on its papers and the transformer that did not come.
    const oct19 = { ...initialGcState(), today: '2026-10-19' }
    expect(chartHolds(oct19, fairOaks(oct19)).get('felec-5')?.words).toBe('current insurance and the transformer, expected Oct 15 and not in')
    // A question and a utility named by the office keep their capitals.
    const state = initialGcState()
    const folded = (kind: GanttHold['kind'], words: string) => withNotReady(new Map<string, GanttHold>([['felec-5', { kind, words, late: false }]]), state, fairOaks(state)).get('felec-5')?.words
    expect(folded('rfi', 'RFI-004, waiting on us')).toBe('current insurance and RFI-004, waiting on us')
    expect(folded('utility', 'CPS Energy service drop, expected Oct 15 and not in')).toBe('current insurance and CPS Energy service drop, expected Oct 15 and not in')
  })

  it('opens on what to do: each paper with its own next step', () => {
    const state = initialGcState()
    const project = fairOaks(state)
    expect(notReadyBlock(state, project, 'felec-5')).toMatchObject({
      title: 'Pecan Valley Electric is not ready to start this on Mon Oct 19.',
      last: 'The bar stays held until it is in.',
      late: false,
      lines: [{ kind: 'insurance', line: 'Insurance ran out Tue Sep 15.', doc: 'insurance', verb: 'Ask for it', promise: null, hint: null }],
    })
    // A bar under way, a bar done, an inspection and our own crew's stage have nothing to say.
    for (const lineId of ['felec-2', 'felec-1', 'fairoaksd-insp-final', 'fplumb-4']) expect(notReadyBlock(state, project, lineId)).toBeNull()

    const h = helotes()
    // Kendall Air's master agreement comes first; Get started sends its statement of work once it is in.
    expect(notReadyBlock(h.state, h.project, 'dhvac-1')).toMatchObject({ title: 'Kendall Air is not ready to start this on Tue Oct 20.', last: 'The bar stays held until they are in.' })
    expect(notReadyBlock(h.state, h.project, 'dhvac-1')?.lines.map((l) => [l.line, l.doc, l.verb, l.hint])).toEqual([
      ['Master agreement sent Sep 29, not signed.', 'msa', 'Remind them', null],
      ['Statement of work drafted, not sent.', 'sow-dhvac', null, 'It goes once the papers above are in.'],
    ])
    // A day Brightline gave shows under its line, in Follow up's words.
    const promised = gcReducer(h.state, { type: 'recordPromise', partnerId: 'brightline', kind: 'sow', projectId: 'helotes', packageId: 'delec', by: '2026-10-09', from: 'office' })
    expect(notReadyBlock(promised, promised.projects.find((p) => p.id === 'helotes')!, 'delec-1')?.lines).toMatchObject([
      { line: 'Statement of work sent Sep 30, not signed.', doc: 'sow-delec', verb: 'Remind them', promise: 'Promised the signed statement of work by Fri Oct 9, in 7 days.', hint: null },
    ])
    // Nobody to send to on Millwork: Get started's sentence instead of a button.
    expect(notReadyBlock(h.state, h.project, 'mill-1')).toMatchObject({
      title: 'Nobody is awarded this work yet. It starts Tue Nov 17.',
      lines: [{ line: 'Award: no company picked.', doc: null, verb: null, hint: 'Pick a company and award the trade.' }],
      last: 'The bar stays held until the trade is awarded.',
    })
  })

  it('counts a statement of work signed on older plans as not in, as Get started does', () => {
    const { state } = helotes()
    const reissued: GcState = {
      ...state,
      projects: state.projects.map((p) => (p.id === 'helotes' ? { ...p, planSets: [...p.planSets, { rev: 1, label: 'Addendum 1', issuedOn: '2026-10-01', note: '', changedSheets: [], touches: ['dry'] }] } : p)),
    }
    const project = reissued.projects.find((p) => p.id === 'helotes')!
    // Ceilings has not started; Hill Country signed on the Permit set.
    expect(notReadyWords(notReadyBars(reissued, project).find((b) => b.lineId === 'dry-3')?.gaps ?? [])).toBe('a new statement of work, the plans changed')
    expect(notReadyBlock(reissued, project, 'dry-3')?.lines).toMatchObject([
      { line: 'Statement of work signed on Permit set, older than the plans.', verb: null, hint: 'The plans changed after they signed. Send a new statement of work.' },
    ])
  })

  it('says every sentence in plain words', () => {
    const fo = initialGcState()
    const none = withPartner(fo, 'coolbreeze', { coiExpires: null })
    const oct25 = withPartner(fo, 'pecanvalley', { coiExpires: '2026-10-25' })
    const passed = { ...fo, today: '2026-10-21' }
    const h = helotes()
    const promised = gcReducer(h.state, { type: 'recordPromise', partnerId: 'brightline', kind: 'sow', projectId: 'helotes', packageId: 'delec', by: '2026-10-09', from: 'office' })
    const blocks = [
      notReadyBlock(fo, fairOaks(fo), 'felec-5'),
      notReadyBlock(none, fairOaks(none), 'fhvac-1'),
      notReadyBlock(oct25, fairOaks(oct25), 'felec-4'),
      notReadyBlock(passed, fairOaks(passed), 'felec-5'),
      notReadyBlock(h.state, h.project, 'dhvac-1'),
      notReadyBlock(h.state, h.project, 'mill-1'),
      notReadyBlock(promised, promised.projects.find((p) => p.id === 'helotes')!, 'delec-1'),
    ]
    expect(blocks.every(Boolean)).toBe(true)
    const sentences = blocks.flatMap(sentencesOf)
    expect(sentences.length).toBeGreaterThan(15)
    expect(sentences.flatMap(plainWordsFailures)).toEqual([])
  })

  it('never leaves out a paper the trade’s own start reminder names (G-114)', () => {
    // Tri-County's sitework on Fair Oaks D starts Mon Jul 6; its reminders go Jun 22 and Jul 3.
    // Submittals are left out on purpose: the chart holds a bar for its submittal on its own.
    const cases: { coiExpires?: string | null; sow?: 'sent' }[] = [{}, { coiExpires: null }, { coiExpires: '2026-07-01' }, { sow: 'sent' }, { coiExpires: '2026-07-01', sow: 'sent' }]
    let named = 0
    for (const today of ['2026-06-22', '2026-07-03']) {
      for (const c of cases) {
        const fresh = { ...initialGcState(), today }
        const changed = 'coiExpires' in c ? withPartner(fresh, 'tricounty', { coiExpires: c.coiExpires ?? null }) : fresh
        const state: GcState = c.sow
          ? { ...changed, projects: changed.projects.map((p) => (p.id !== 'fairoaksd' ? p : { ...p, packages: p.packages.map((k) => (k.id === 'fsite' && k.sow ? { ...k, sow: { ...k.sow, status: c.sow ?? k.sow.status } } : k)) })) }
          : changed
        const project = fairOaks(state)
        const pkg = project.packages.find((k) => k.id === 'fsite')!
        const needs = startNeeds(state, 'tricounty', project, pkg, '2026-07-06', 'en')
        const kinds = startGaps(state, project, pkg, '2026-07-06').map((g) => g.kind)
        const wanted = [
          ...(needs.some((n) => n.startsWith('Your insurance certificate')) ? (['insurance'] as const) : []),
          ...(needs.includes('Your statement of work is not signed yet.') ? (['sow'] as const) : []),
        ]
        named += wanted.length
        expect(kinds).toEqual(expect.arrayContaining(wanted))
      }
    }
    // The cases do name papers: the check is not empty.
    expect(named).toBe(10)
  })
})

describe('a trade at work with its insurance run out (G-138)', () => {
  const running = 'Pecan Valley Electric\'s insurance ran out Tue Sep 15. Nothing they do for us is covered.'

  it('says so in red on Pecan Valley’s bars under way, while its bars not started stay held (G-77)', () => {
    const state = initialGcState()
    const project = fairOaks(state)
    const notes = uninsuredNotes(state, project)
    const holds = chartHolds(state, project)
    // Side by side: Panels and feeders and Lighting are under way, Site lighting and Fire alarm are not started.
    expect([...notes]).toEqual([
      ['felec-2', { note: 'insurance ran out Sep 15', words: running }],
      ['felec-3', { note: 'insurance ran out Sep 15', words: running }],
    ])
    expect(holds.has('felec-2') || holds.has('felec-3')).toBe(false)
    expect(holds.get('felec-5')?.words).toBe('current insurance, theirs ran out Sep 15')
    expect(holds.get('felec-4')?.words).toBe('current insurance and submittal 28 31 11-01')
    expect(notes.has('felec-5') || notes.has('felec-4')).toBe(false)
    // No stripes: the Held filter stays at 6.
    const m = scheduleMeasures(state, project)
    expect(ganttCounts(ganttBars(m.items, m.float, holds, state.today, true)).held).toBe(6)
  })

  it('says nothing for a trade insured, our own crew, or a job being bought out', () => {
    const state = initialGcState()
    // Summit's TPO membrane is under way and insured; our own Top out is under way too.
    expect(uninsuredBars(state, fairOaks(state)).map((b) => b.lineId)).toEqual(['felec-2', 'felec-3'])
    // With no certificate on file at all, it says that instead.
    const none = withPartner(state, 'summit', { coiExpires: null })
    expect(uninsuredNotes(none, fairOaks(none)).get('froof-1')).toEqual({ note: 'no insurance on file', words: 'Summit Roofing has no insurance on file. Nothing they do for us is covered.' })
    // A renewed certificate clears Pecan Valley.
    const renewed = withPartner(state, 'pecanvalley', { coiExpires: '2027-09-15' })
    expect(uninsuredNotes(renewed, fairOaks(renewed)).size).toBe(0)
    const { state: drawn, project } = helotes(false)
    expect(uninsuredBars(drawn, project)).toEqual([])
  })

  it('opens on what to do, and the guard that already stands', () => {
    const state = initialGcState()
    const project = fairOaks(state)
    expect(notReadyBlock(state, project, 'felec-3')).toBeNull()
    expect(uninsuredBlock(state, project, 'felec-3')).toMatchObject({
      title: 'Pecan Valley Electric is working on this without current insurance.',
      lines: [{ kind: 'insurance', line: 'Insurance ran out Tue Sep 15.', doc: 'insurance', verb: 'Ask for it', promise: null, hint: null }],
      last: 'On Draws, Approve stays locked until a current certificate is in.',
      late: true,
    })
    // Once asked, with a day they gave: the reminder and the day, in Follow up's words.
    const asked = gcReducer(state, { type: 'recordPromise', partnerId: 'pecanvalley', kind: 'insurance', by: '2026-10-09', from: 'office' })
    expect(uninsuredBlock(asked, fairOaks(asked), 'felec-3')?.lines).toMatchObject([{ verb: 'Remind them', promise: 'Promised the renewed insurance certificate by Fri Oct 9, in 7 days.' }])
    // A bar not started keeps G-77's block; a bar insured or done has none.
    expect(uninsuredBlock(state, project, 'felec-5')).toBeNull()
    expect(uninsuredBlock(state, project, 'froof-1')).toBeNull()
    expect(uninsuredBlock(state, project, 'felec-1')).toBeNull()
  })

  it('gives the morning list its line, read on the list’s day', () => {
    const pecan = initialGcState().partners.find((p) => p.id === 'pecanvalley')!
    expect(lapsedInsuranceWords(pecan, '2026-10-02')).toBe('Their insurance ran out Tue Sep 15. Nothing they do for us is covered.')
    expect(lapsedInsuranceWords(pecan, '2026-09-14')).toBeNull()
    expect(lapsedInsuranceWords({ ...pecan, coiExpires: null }, '2026-10-02')).toBe('No insurance on file. Nothing they do for us is covered.')
  })

  it('says every sentence in plain words', () => {
    const state = initialGcState()
    const block = uninsuredBlock(state, fairOaks(state), 'felec-3')
    const sentences = [...[...uninsuredNotes(state, fairOaks(state)).values()].flatMap((n) => [n.note, n.words]), ...sentencesOf(block), 'No insurance on file. Nothing they do for us is covered.']
    expect(sentences.flatMap(plainWordsFailures)).toEqual([])
  })
})
