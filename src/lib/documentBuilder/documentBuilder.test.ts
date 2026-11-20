import { describe, expect, it } from 'vitest'
import { plainWordsFailures } from '../plainWords'
import {
  PAPER_OFF,
  alignedWith,
  basisLine,
  basisNote,
  breachGroups,
  clauseDrawing,
  confirmWords,
  flowSteps,
  goToStep,
  isOffBasis,
  isStepShut,
  levelFacts,
  nextLabel,
  nextStep,
  offBasisKeys,
  paperLevel,
  paperLevelLine,
  paperStops,
  prevStep,
  reviewLine,
  settleFlow,
  signerCount,
  siteAsks,
  siteLines,
  siteNeeds,
  startFlow,
  startSettings,
  stepCountLine,
  stepStop,
  stopAt,
  stopName,
  stopPercent,
  stopRank,
  topicFloor,
  topicOf,
  topicSays,
  withAck,
  withBasis,
  withPaperOff,
  withTopic,
  type PaperDef,
  type PaperFlow,
} from './documentBuilder'
import { SECRECY_PAPER_FIXTURE as DEF } from './secrecyPaper.fixture'

const TICKED: PaperFlow = { step: 0, ackAt: '2026-11-19T15:00:00.000Z', done: false }

describe('levels and stops', () => {
  it('lists Off, then the four levels the owner settled, loosest first', () => {
    expect(paperStops(DEF)).toEqual(['off', 'std', 'gov', 'mid', 'strict'])
    expect(paperStops(DEF).map((s) => stopName(DEF, s))).toEqual(['Off', 'Standard', 'Elevated', 'Aggressive', 'Strict'])
  })

  it('says what each level is aligned with, and nothing for Off', () => {
    expect(DEF.levels.map((l) => alignedWith(DEF, l.id))).toEqual([
      'Aligned with regular businesses',
      'Aligned with hospitals, banks and government buildings',
      'Aligned with military bases and defense plants',
      'Aligned with private research labs',
    ])
    expect(alignedWith(DEF, PAPER_OFF)).toBe('')
  })

  it('places the stops evenly along the track', () => {
    expect(paperStops(DEF).map((s) => stopPercent(DEF, s))).toEqual([0, 25, 50, 75, 100])
    expect(stopRank(DEF, 'mid')).toBe(3)
    expect(stopRank(DEF, 'nope')).toBe(-1)
  })

  it('holds a place inside the ends of the list', () => {
    expect(stopAt(DEF, -2)).toBe('off')
    expect(stopAt(DEF, 2)).toBe('gov')
    expect(stopAt(DEF, 9)).toBe('strict')
  })
})

describe('topics', () => {
  it('has the seven topics, and only the first four can be Off', () => {
    expect(DEF.topics.map((t) => t.key)).toEqual(['photos', 'devices', 'access', 'talk', 'term', 'files', 'report'])
    expect(DEF.topics.map((t) => topicFloor(t))).toEqual([0, 0, 0, 0, 1, 1, 1])
  })

  it('has a meaning, breach lines and site lines for every level of every topic', () => {
    for (const topic of DEF.topics) {
      for (const level of DEF.levels) {
        expect(topicSays(DEF, topic.key, level.id), `${topic.key} ${level.id}`).not.toBe('')
        const groups = breachGroups(DEF, topic.key, level.id)
        expect(groups.own.length + groups.carried.length, `${topic.key} ${level.id}`).toBeGreaterThan(0)
        expect(Array.isArray(siteLines(DEF, topic.key, level.id))).toBe(true)
      }
      if (!topic.inEveryPaper) expect(topicSays(DEF, topic.key, PAPER_OFF), topic.key).not.toBe('')
    }
  })

  it('says nothing puts a person in breach, and asks nothing of the site, when a topic is Off', () => {
    expect(breachGroups(DEF, 'photos', PAPER_OFF)).toEqual({ own: [], carried: [], newAt: null })
    expect(siteLines(DEF, 'devices', PAPER_OFF)).toEqual([])
  })

  it('splits the breach lines into what the level brings and what also applies from the level under it', () => {
    expect(breachGroups(DEF, 'photos', 'gov')).toEqual({
      own: ['Taking a photo that shows people, screens or signs.'],
      carried: ['Taking a photo that is not of the work.', 'Keeping a work photo on a phone after it is uploaded.', 'Sending or posting a job photo to anyone outside the job.'],
      newAt: 'Elevated',
    })
    expect(breachGroups(DEF, 'access', 'strict')).toEqual({
      own: ['Being in a marked area without an escort.'],
      carried: ['Being on site without a badge.', 'Not signing in or out.', 'Starting work before the background check clears.'],
      newAt: 'Strict',
    })
  })

  it('leaves out a line the level replaced: it no longer applies', () => {
    const mid = breachGroups(DEF, 'photos', 'mid')
    expect(mid.own).toEqual(['Taking any photo, unless you are the site lead.', 'Taking a photo off site before it is checked.'])
    expect(mid.carried).toEqual(['Sending or posting a job photo to anyone outside the job.'])
    expect(breachGroups(DEF, 'photos', 'strict').carried).toEqual([])
  })

  it('keeps every line of the level, in one group or the other', () => {
    for (const topic of DEF.topics) {
      for (const level of DEF.levels) {
        const groups = breachGroups(DEF, topic.key, level.id)
        expect([...groups.own, ...groups.carried].sort(), `${topic.key} ${level.id}`).toEqual([...(topic.levels[level.id]?.breach ?? [])].sort())
      }
    }
  })

  it('calls nothing new on the loosest level, since nothing sits under it', () => {
    expect(breachGroups(DEF, 'photos', 'std')).toEqual({ own: DEF.topics[0]?.levels.std?.breach, carried: [], newAt: null })
  })

  it('calls nothing new on a topic with a blank, though a line the number does not touch still carries', () => {
    for (const key of ['term', 'files', 'report']) {
      for (const level of DEF.levels) expect(breachGroups(DEF, key, level.id).newAt, `${key} ${level.id}`).toBeNull()
    }
    expect(breachGroups(DEF, 'files', 'gov')).toEqual({
      own: ['Keeping any job file more than 7 days after your work ends.'],
      carried: ['Not confirming in writing that the files are gone.'],
      newAt: null,
    })
  })

  it('lists what a whole level asks of the site, leaving out a topic that asks nothing', () => {
    expect(siteAsks(DEF, 'std').map((r) => r.key)).toEqual(['devices', 'access'])
    expect(siteAsks(DEF, 'strict').map((r) => r.key)).toEqual(['photos', 'devices', 'access', 'talk'])
    expect(siteAsks(DEF, 'std')[1]?.lines).toEqual(['Badges, and someone to issue them.', 'A sign-in sheet at the door.'])
  })

  it('lists what the paper as it stands asks of the site, each topic at its own stop', () => {
    const start = startSettings(DEF)
    expect(siteNeeds(DEF, start)).toEqual(siteAsks(DEF, 'std'))
    const moved = withTopic(DEF, withTopic(DEF, start, 'photos', 'strict'), 'devices', PAPER_OFF)
    expect(siteNeeds(DEF, moved).map((r) => r.key)).toEqual(['photos', 'access'])
    expect(siteNeeds(DEF, moved)[0]?.lines).toEqual(['Someone on site who watches for cameras.'])
    expect(siteNeeds(DEF, withPaperOff(moved))).toEqual([])
  })

  it('says what a level does as the same few facts on every level', () => {
    expect(levelFacts(DEF, 'std')).toEqual([
      { key: 'term', label: 'Secrecy lasts', value: '3 years' },
      { key: 'files', label: 'Time to return files', value: '10 days' },
      { key: 'report', label: 'Time to report a leak', value: '3 days' },
      { key: 'site', label: 'The site must have', value: '3 things' },
    ])
    expect(DEF.levels.map((l) => levelFacts(DEF, l.id).map((f) => f.value))).toEqual([
      ['3 years', '10 days', '3 days', '3 things'],
      ['5 years', '7 days', '2 days', '3 things'],
      ['7 years', '5 days', '24 hours', '6 things'],
      ['10 years', '3 days', 'the same day', '7 things'],
    ])
    expect(levelFacts(DEF, PAPER_OFF)).toEqual([])
  })

  it('draws the clause as bars, more of them the stricter the level, and never as words', () => {
    expect(clauseDrawing(DEF, 'photos', PAPER_OFF)).toEqual({ kind: 'out' })
    expect(clauseDrawing(DEF, 'photos', 'std')).toEqual({ kind: 'picked', tag: 'Wording A', bars: [100, 47] })
    expect(clauseDrawing(DEF, 'photos', 'strict')).toEqual({ kind: 'picked', tag: 'Wording D', bars: [100, 100, 100, 100, 86] })
    expect(clauseDrawing(DEF, 'term', 'gov')).toEqual({ kind: 'blank', tag: 'Filled in: 5 years', blank: '5 years' })
  })
})

describe('the basis', () => {
  it('starts a paper on, with every topic on the loosest level', () => {
    const s = startSettings(DEF)
    expect(s.off).toBe(false)
    expect(s.basis).toBe('std')
    expect(paperLevel(DEF, s)).toBe('std')
    expect(offBasisKeys(DEF, s)).toEqual([])
    expect(paperLevelLine(DEF, s)).toBe('Standard')
    expect(basisNote(DEF, s)).toBe('Every page is on Standard.')
    expect(reviewLine(DEF, s)).toBe('Your basis is Standard. Every page is on it.')
  })

  it('moves one page off the basis and says so', () => {
    const s = withTopic(DEF, startSettings(DEF), 'photos', 'mid')
    expect(s.basis).toBe('std')
    expect(isOffBasis(s, 'photos')).toBe(true)
    expect(isOffBasis(s, 'devices')).toBe(false)
    expect(paperLevel(DEF, s)).toBe('custom')
    expect(paperLevelLine(DEF, s)).toBe('Standard, 1 page off it')
    expect(basisLine(DEF, s)).toBe('Your basis is Standard.')
    expect(basisNote(DEF, s)).toBe('1 page is off the basis. Picking a level here sets every page back to it.')
    expect(reviewLine(DEF, s)).toBe('Your basis is Standard. 1 page is off it.')
  })

  it('counts two pages in the plural', () => {
    const s = withTopic(DEF, withTopic(DEF, startSettings(DEF), 'photos', 'mid'), 'talk', PAPER_OFF)
    expect(offBasisKeys(DEF, s)).toEqual(['photos', 'talk'])
    expect(paperLevelLine(DEF, s)).toBe('Standard, 2 pages off it')
    expect(basisNote(DEF, s)).toBe('2 pages are off the basis. Picking a level here sets every page back to it.')
  })

  it('puts a page back on the basis', () => {
    const moved = withTopic(DEF, startSettings(DEF), 'photos', 'strict')
    expect(withTopic(DEF, moved, 'photos', moved.basis)).toEqual(startSettings(DEF))
  })

  it('holds a topic that is in every paper at its loosest level, never Off', () => {
    const s = withTopic(DEF, startSettings(DEF), 'term', PAPER_OFF)
    expect(s.topics.term).toBe('std')
  })

  it('sets every page back when a level is picked as the basis', () => {
    const mixed = withTopic(DEF, startSettings(DEF), 'photos', 'strict')
    const s = withBasis(DEF, mixed, 'gov')
    expect(s.basis).toBe('gov')
    expect(paperLevel(DEF, s)).toBe('gov')
    expect(offBasisKeys(DEF, s)).toEqual([])
    expect(withBasis(DEF, mixed, 'nope')).toBe(mixed)
  })

  it('makes a level the basis once every page has been moved onto it', () => {
    let s = startSettings(DEF)
    for (const t of DEF.topics) s = withTopic(DEF, s, t.key, 'gov')
    expect(s.basis).toBe('gov')
    expect(paperLevelLine(DEF, s)).toBe('Elevated')
  })

  it('switches the whole paper off, and a level picked afterwards turns it on again', () => {
    const off = withPaperOff(withTopic(DEF, startSettings(DEF), 'photos', 'mid'))
    expect(off.off).toBe(true)
    expect(paperLevelLine(DEF, off)).toBe('Off')
    expect(basisNote(DEF, off)).toBe('Off. This job requires no secrecy paper.')
    const on = withBasis(DEF, off, 'std')
    expect(on).toEqual(startSettings(DEF))
  })
})

describe('the flow', () => {
  it('has eleven steps: the disclaimer, the basis, the site, seven topics and the review', () => {
    expect(flowSteps(DEF).map((s) => s.name)).toEqual([
      'Before you start',
      'The basis',
      'Match the paper to the site',
      'Photos and video',
      'Phones and devices',
      'Getting on site',
      'Talking on site',
      'How long secrecy lasts',
      'Files at the end',
      'Reporting a leak or a legal demand',
      'Review',
    ])
    expect(stepCountLine(DEF, startFlow())).toBe('Step 1 of 11')
  })

  it('gives the step bar each step\'s stop: the basis, each topic\'s own, and none for the rest', () => {
    const s = withTopic(DEF, withBasis(DEF, startSettings(DEF), 'gov'), 'access', 'strict')
    expect(flowSteps(DEF).map((step) => stepStop(s, step))).toEqual([null, 'gov', null, 'gov', 'gov', 'strict', 'gov', 'gov', 'gov', 'gov', null])
    expect(flowSteps(DEF).map((step) => stepStop(withPaperOff(s), step))).toEqual([null, 'off', null, 'off', 'off', 'off', 'off', 'off', 'off', 'off', null])
  })

  it('opens nothing past the disclaimer until its box is ticked', () => {
    const s = startSettings(DEF)
    const flow = startFlow()
    expect(flowSteps(DEF).map((_, i) => isStepShut(DEF, s, flow, i))).toEqual([false, true, true, true, true, true, true, true, true, true, true])
    expect(goToStep(DEF, s, flow, 4).step).toBe(0)
    const ticked = withAck(flow, true, '2026-11-19T15:00:00.000Z')
    expect(ticked.ackAt).toBe('2026-11-19T15:00:00.000Z')
    expect(flowSteps(DEF).some((_, i) => isStepShut(DEF, s, ticked, i))).toBe(false)
    expect(goToStep(DEF, s, ticked, 4).step).toBe(4)
  })

  it('sends a person back to the first page when the tick is taken off', () => {
    const s = startSettings(DEF)
    const unticked = withAck({ ...TICKED, step: 5 }, false, '')
    expect(unticked.ackAt).toBeNull()
    expect(settleFlow(DEF, s, unticked).step).toBe(0)
  })

  it('names the page the Next press opens', () => {
    const s = startSettings(DEF)
    expect(nextLabel(DEF, s, TICKED)).toBe('Next: The basis')
    expect(nextLabel(DEF, s, { ...TICKED, step: 2 })).toBe('Next: Photos and video')
    expect(nextLabel(DEF, s, { ...TICKED, step: 9 })).toBe('Next: Review')
  })

  it('skips from the basis to the review, and back, when the paper is Off', () => {
    const off = withPaperOff(startSettings(DEF))
    const atBasis = { ...TICKED, step: 1 }
    expect(nextStep(DEF, off, atBasis)).toBe(10)
    expect(nextLabel(DEF, off, atBasis)).toBe('Next: Review')
    expect(prevStep(DEF, off, { ...TICKED, step: 10 })).toBe(1)
    expect(flowSteps(DEF).map((_, i) => isStepShut(DEF, off, TICKED, i))).toEqual([false, false, true, true, true, true, true, true, true, true, false])
    expect(goToStep(DEF, off, atBasis, 5).step).toBe(0)
    expect(settleFlow(DEF, off, { ...TICKED, step: 5 }).step).toBe(1)
  })

  it('walks one step at a time when the paper is on, and stops at the ends', () => {
    const s = startSettings(DEF)
    expect(nextStep(DEF, s, { ...TICKED, step: 1 })).toBe(2)
    expect(prevStep(DEF, s, { ...TICKED, step: 10 })).toBe(9)
    expect(prevStep(DEF, s, TICKED)).toBe(0)
    expect(nextStep(DEF, s, { ...TICKED, step: 10 })).toBe(10)
  })

  it('leaves a person where they are when their step is still open', () => {
    const flow = { ...TICKED, step: 6 }
    expect(settleFlow(DEF, startSettings(DEF), flow)).toBe(flow)
  })

  it('clears a pressed confirm on any move', () => {
    expect(goToStep(DEF, startSettings(DEF), { ...TICKED, step: 10, done: true }, 3).done).toBe(false)
  })

  it('words the review press: what it will do, what it did, and dead when the paper is Off', () => {
    const s = startSettings(DEF)
    expect(signerCount(DEF)).toBe(14)
    expect(confirmWords(DEF, s, { ...TICKED, step: 10 })).toEqual({ label: 'Confirm and require this paper', dead: false, note: 'Nothing reaches a signer until this press.' })
    expect(confirmWords(DEF, s, { ...TICKED, step: 10, done: true }).note).toBe('Required. 14 people asked to sign. You are first.')
    expect(confirmWords(DEF, withPaperOff(s), { ...TICKED, step: 10 })).toEqual({ label: 'Nothing to require', dead: true, note: 'Secrecy is off on J2391.' })
  })
})

describe('a second kind of paper', () => {
  // The kernel knows nothing of secrecy: a paper with two levels and one topic walks the same rules.
  const OTHER: PaperDef = {
    ...DEF,
    id: 'other',
    levels: [
      { id: 'a', name: 'Plain', alignedWith: 'Aligned with a small job' },
      { id: 'b', name: 'Full', alignedWith: 'Aligned with a large job', shortName: 'Full' },
    ],
    topics: [{ key: 'pay', label: 'When pay is due', section: 'Section 2: Pay', inEveryPaper: true, levels: { a: { says: 'In 30 days.', breach: ['Paying late.'], site: [] }, b: { says: 'In 10 days.', breach: ['Paying late.', 'Paying short.'], site: [] } } }],
  }

  it('takes its levels, topics and steps from its own definition', () => {
    expect(paperStops(OTHER)).toEqual(['off', 'a', 'b'])
    expect(flowSteps(OTHER).map((s) => s.name)).toEqual(['Before you start', 'The basis', 'Match the paper to the site', 'When pay is due', 'Review'])
    expect(breachGroups(OTHER, 'pay', 'b')).toEqual({ own: ['Paying short.'], carried: ['Paying late.'], newAt: 'Full' })
    expect(paperLevelLine(OTHER, withTopic(OTHER, startSettings(OTHER), 'pay', 'b'))).toBe('Full')
    expect(levelFacts(OTHER, 'a')).toEqual([{ key: 'site', label: 'The site must have', value: 'Nothing' }])
  })
})

describe('the fixture', () => {
  it('ties every topic to every level and to no other', () => {
    const ids = DEF.levels.map((l) => l.id).sort()
    for (const topic of DEF.topics) expect(Object.keys(topic.levels).sort(), topic.key).toEqual(ids)
    expect(topicOf(DEF, 'nope')).toBeUndefined()
  })

  it('reads in plain words: one idea a sentence, none over 20 words, no glue', () => {
    const texts: string[] = [...Object.values(DEF.words), ...DEF.notice.lines, DEF.notice.title, DEF.notice.placeholder, DEF.notice.tick, DEF.site.lead, DEF.site.title, ...DEF.site.lines, DEF.site.asksNothing, DEF.site.placeholder]
    for (const level of DEF.levels) texts.push(level.name, level.alignedWith)
    for (const topic of DEF.topics) {
      texts.push(topic.label, topic.section, topic.offSays ?? '', topic.fact ?? '')
      for (const l of Object.values(topic.levels)) texts.push(l.says, ...l.breach, ...l.site)
    }
    expect(texts.flatMap((t) => plainWordsFailures(t))).toEqual([])
  })

  it('says the same in the lines the kernel builds', () => {
    const mixed = withTopic(DEF, startSettings(DEF), 'photos', 'mid')
    const built = [basisLine(DEF, mixed), basisNote(DEF, mixed), reviewLine(DEF, mixed), paperLevelLine(DEF, mixed), confirmWords(DEF, mixed, { ...TICKED, done: true }).note]
    expect(built.flatMap((t) => plainWordsFailures(t))).toEqual([])
  })
})
