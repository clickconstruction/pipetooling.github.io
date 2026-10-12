import { describe, expect, it } from 'vitest'
import { CHANGE_ORDERS, NOW, at, day, demoPeople, demoPerson, fact, round, withJob, type Seed } from './demoPeople.fixture'
import {
  historyWords,
  holdNudge,
  lapsedWhy,
  nextMonday,
  nudgeDue,
  nudgeNow,
  nudgeRows,
  paperSigned,
  paperToAsk,
  reminderWords,
  worstFirst,
  type NudgeMark,
  type NudgeOptions,
  type PersonFlow,
} from './nudges'
import { stepById, type StepReading } from './state'

const stepOf = (person: PersonFlow, id: string): StepReading => {
  const step = person.reading.lanes.flatMap((l) => l.steps).find((x) => x.stepId === id)
  if (!step) throw new Error(`no step ${id}`)
  return step
}
const due = (person: PersonFlow, id: string, now = NOW, options: NudgeOptions = {}) => nudgeDue(person, stepOf(person, id), now, options)
const words = (person: PersonFlow, id: string, now = NOW, options: NudgeOptions = {}) => reminderWords(person, stepOf(person, id), now, options)

/**
 * Follow up's portal rows on the prototype's clock: Priya opened the page, and change order 2 went Wed Sep 30, so Needs
 * you shows it as a portal row and its nudge stays out. The key is the change order's own row id.
 */
const portalRows: NudgeOptions = { skip: (contactId, paper, key) => contactId === 'priya' && paper === 'co' && key === CHANGE_ORDERS.priya2 }
const with_ = (change: Partial<Seed>) => (seed: Seed): Seed => ({ ...seed, ...change })

/** Tom, on Papers in since Mon Sep 28, waiting on the insurance certificate: quiet this many days, our last message then. */
const tom = (quietDays: number | null, lastOutAt: string | null, marks: NudgeMark[] = []) =>
  demoPerson('tom', with_({ quietDays, lastOutAt, marks }))

const insuranceRow = (why: string) => ({ contactId: 'tom', stepId: 'papers', jobId: null, how: 'call', why, paper: 'coi' })

describe('Follow up rows on the demo people', () => {
  it('are the prototype v1.178 rows, word for word', () => {
    expect(nudgeRows(demoPeople(), NOW, portalRows)).toEqual([
      {
        contactId: 'greg',
        stepId: 'ask',
        jobId: 'boerne',
        how: 'text',
        why: 'late 2 days · waiting on their quote · insurance expired',
        paper: 'quote',
        steps: [
          {
            stepId: 'ask',
            jobId: 'boerne',
            due: true,
            lateDays: 2,
            named: true,
            lapsed: false,
            why: 'late 2 days · waiting on their quote',
            how: 'text',
            paper: 'quote',
            waitedOnBy: null,
            round: 'Boerne Shell',
          },
          {
            stepId: 'papers',
            jobId: null,
            due: false,
            lateDays: null,
            named: false,
            lapsed: true,
            why: 'lapsed · insurance expired',
            how: 'call',
            paper: 'coi',
            waitedOnBy: null,
            round: null,
          },
        ],
      },
      {
        contactId: 'jonah',
        stepId: 'certify',
        jobId: 'boerne',
        how: 'email',
        why: "with Jonah 4 days · Elena's pay application waits on it",
        paper: null,
        steps: [
          {
            stepId: 'certify',
            jobId: 'boerne',
            due: true,
            lateDays: null,
            named: true,
            lapsed: false,
            why: "with Jonah 4 days · Elena's pay application waits on it",
            how: 'email',
            paper: null,
            waitedOnBy: 'elena',
            round: 'Pay app 4 · Cibolo Creek',
          },
        ],
      },
    ])
  })

  it('fold a lapsed step into the row once, when both steps are due', () => {
    const people = demoPeople({ greg: with_({ quietDays: 4, lastOutAt: at(9, 20) }) })
    expect(due(people[0]!, 'papers').reason).toBe('lapsed')
    const greg = nudgeRows(people, NOW).filter((r) => r.contactId === 'greg')
    expect(greg.map((r) => r.why)).toEqual(['late 2 days · waiting on their quote · insurance expired'])
    expect(greg[0]?.steps.map((s) => [s.stepId, s.due, s.named])).toEqual([
      ['ask', true, true],
      ['papers', true, true],
    ])
  })

  it('lead with a lapsed paper after three quiet days, and carry the step on now behind it', () => {
    const people = demoPeople({
      greg: (seed) => {
        const ask = seed.steps.ask
        if (ask?.rounds) ask.rounds = [round('Boerne Shell', 'now', [fact('quote_in', 'wait')], { opened: day(9, 22) })]
        return { ...seed, quietDays: 3, lastOutAt: at(9, 25) }
      },
    })
    expect(nudgeRows(people, NOW).find((r) => r.contactId === 'greg')).toMatchObject({
      stepId: 'papers',
      jobId: null,
      how: 'call',
      why: 'lapsed · insurance expired · quiet 3 days · Asked to quote',
      paper: 'coi',
    })
  })

  it('come after the quiet days, and not while we wrote inside them', () => {
    const quiet = demoPeople({ tom: with_({ quietDays: 5, lastOutAt: at(9, 25) }) })
    expect(nudgeRows(quiet, NOW).find((r) => r.contactId === 'tom')).toMatchObject(
      insuranceRow('quiet 5 days · the flow says a call. We are waiting on their certificate of insurance.'),
    )
    const wrote = demoPeople({ tom: with_({ quietDays: 6, lastOutAt: at(10, 1, 16) }) })
    expect(nudgeRows(wrote, NOW).some((r) => r.contactId === 'tom')).toBe(false)
  })

  it('come for someone who never wrote once our last message is that far back, and put them first', () => {
    const people = demoPeople({ tom: with_({ quietDays: null, lastOutAt: at(9, 25) }) })
    const rows = nudgeRows(people, NOW, portalRows)
    expect(rows[0]).toMatchObject(insuranceRow('no word from them yet · the flow says a call. We are waiting on their certificate of insurance.'))
    expect(rows.map((r) => r.contactId)).toEqual(['tom', 'greg', 'jonah'])
  })

  it('say a paper of ours went to sign, with its sends', () => {
    const people = demoPeople({
      tom: (seed) => {
        seed.steps.papers = { state: 'done', facts: [fact('w9_signed', 'ok', { at: day(9, 29) }), fact('coi_current', 'ok', { at: day(10, 1) })] }
        seed.steps.msa = { state: 'now', since: day(10, 1), facts: [fact('msa_signed', 'wait', { at: day(9, 30) })] }
        return { ...seed, nowStepId: 'msa', quietDays: 3, lastOutAt: at(9, 28), sends: { msa: [at(9, 30, 10), at(10, 1)] } }
      },
    })
    expect(nudgeRows(people, NOW).find((r) => r.contactId === 'tom')?.why).toBe(
      'the master agreement went to sign · First sent Sep 30, 2 days ago. Reminded once, last Oct 1.',
    )
  })

  it('never come for our move, for a number nobody named, or for a person off the flow', () => {
    const people = demoPeople({
      priya: with_({ quietDays: 30, lastOutAt: null }),
      unk1: with_({ quietDays: 30 }),
      marcus: with_({ quietDays: 30, lastOutAt: null }),
    })
    const ids = nudgeRows(people, NOW, portalRows).map((r) => r.contactId)
    expect(ids).not.toContain('priya')
    expect(ids).not.toContain('unk1')
    expect(ids).not.toContain('marcus')
    expect(due(people.find((p) => p.id === 'priya')!, 'start').reason).toBe('no reminder')
    expect(due(people.find((p) => p.id === 'marcus')!, 'asked').reason).toBe('off')
  })

  it('nudge an open change order like any other step, unless Follow up shows its paper on a portal row', () => {
    const asked: [string, string, string | null][] = []
    const skip: NudgeOptions['skip'] = (contactId, paper, key) => {
      asked.push([contactId, paper, key])
      return portalRows.skip?.(contactId, paper, key) ?? false
    }
    const priya = nudgeRows(demoPeople(), NOW).find((r) => r.contactId === 'priya')
    expect(priya).toMatchObject({ stepId: 'co', jobId: 'helotes', how: 'text', why: 'the change order went to sign', paper: null })
    expect(priya?.steps.map((s) => s.round)).toEqual([CHANGE_ORDERS.priya2])
    expect(nudgeRows(demoPeople(), NOW, { skip }).some((r) => r.contactId === 'priya')).toBe(false)
    expect(asked).toContainEqual(['priya', 'co', CHANGE_ORDERS.priya2])
    const person = demoPerson('priya')
    expect(due(person, 'co').reason).toBe('quiet')
    expect(due(person, 'co', NOW, portalRows).reason).toBe('portal')
    expect(due(demoPerson('elena'), 'co').reason).toBe('not on')
  })
})

describe('one row per person, never one per job', () => {
  const padb = (seed: Parameters<typeof withJob>[2]['ask']) => withJob(demoPerson('greg'), 'padb', { ask: seed })

  it('carries each job’s step on now worst first, as the lead’s Greg reads: Boerne late 2 days, then Pad B due Oct 22', () => {
    const rows = nudgeRows([padb({ state: 'now', since: day(9, 22), due: day(10, 22), facts: [fact('quote_in')] })], NOW)
    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({
      contactId: 'greg',
      stepId: 'ask',
      jobId: 'boerne',
      why: 'Boerne Retail Shell: late 2 days · waiting on their quote · Boerne Retail Pad B: due Oct 22 · insurance expired',
    })
    expect(rows[0]?.steps.map((s) => [s.jobId, s.stepId, s.due, s.lateDays, s.named])).toEqual([
      ['boerne', 'ask', true, 2, true],
      ['padb', 'ask', false, -20, false],
      [null, 'papers', false, null, false],
    ])
  })

  it('puts the worse job first, and names in the one message any step due within the week', () => {
    const late = nudgeRows([padb({ state: 'now', since: day(9, 22), due: day(9, 29), facts: [fact('quote_in')] })], NOW)
    expect(late.map((r) => [r.jobId, r.why])).toEqual([
      ['padb', 'Boerne Retail Pad B: late 3 days · waiting on their quote · Boerne Retail Shell: late 2 days · insurance expired'],
    ])
    const soon = nudgeRows([padb({ state: 'now', since: day(9, 22), due: day(10, 5), facts: [fact('quote_in')] })], NOW)
    expect(soon[0]?.steps.map((s) => [s.jobId, s.named])).toEqual([
      ['boerne', true],
      ['padb', true],
      [null, false],
    ])
  })

  it('folds the step someone else waits on into that person’s own row, once', () => {
    const jonah = (change: (seed: Seed) => Seed) => demoPeople({ jonah: change })
    const questions = (seed: Seed): Seed => {
      if (seed.steps.questions) seed.steps.questions.state = 'now'
      return { ...seed, nowStepId: 'questions' }
    }
    const row = nudgeRows(jonah(questions), NOW).find((r) => r.contactId === 'jonah')
    expect(row?.why).toBe("with Jonah 4 days · Elena's pay application waits on it · Questions: due Mon")
    expect(row?.steps.map((s) => [s.stepId, s.due, s.named, s.waitedOnBy])).toEqual([
      ['certify', true, true, 'elena'],
      ['questions', false, true, null],
    ])
    const both = nudgeRows(
      jonah((seed) => {
        if (seed.steps.certify) seed.steps.certify.state = 'now'
        return questions(seed)
      }),
      NOW,
    ).filter((r) => r.contactId === 'jonah')
    expect(both).toHaveLength(1)
    expect(both[0]?.steps.filter((s) => s.stepId === 'certify')).toHaveLength(1)
  })

  it('orders steps by due, then days late, then the soonest day', () => {
    const step = (due: boolean, lateDays: number | null) => ({ due, lateDays })
    const sorted = [step(false, null), step(false, -20), step(true, null), step(false, -3), step(true, 2)].sort(worstFirst)
    expect(sorted).toEqual([step(true, 2), step(true, null), step(false, -3), step(false, -20), step(false, null)])
  })
})

describe('the row for the person waited on', () => {
  const certify = (mark: Partial<NudgeMark>): NudgeMark[] => [{ stepId: 'certify', jobId: 'boerne', ...mark }]
  const since = (d: string) => (seed: Seed): Seed => {
    if (seed.steps.payapp?.waitingOn) seed.steps.payapp.waitingOn.since = d
    return seed
  }

  it('waits for that person’s hold, comes on Remind now, and not after we just wrote them', () => {
    const held = demoPeople({ jonah: with_({ marks: certify({ holdUntil: '2026-10-05' }) }) })
    expect(nudgeRows(held, NOW).some((r) => r.contactId === 'jonah')).toBe(false)
    expect(nudgeRows(held, new Date(at(10, 5, 8))).some((r) => r.contactId === 'jonah')).toBe(true)
    expect(nudgeRows(demoPeople({ elena: since(day(10, 1)) }), NOW).some((r) => r.contactId === 'jonah')).toBe(false)
    const pressed = demoPeople({ elena: since(day(10, 1)), jonah: with_({ marks: certify({ nudgedAt: NOW.toISOString() }) }) })
    expect(nudgeRows(pressed, NOW).find((r) => r.contactId === 'jonah')?.why).toBe("with Jonah 1 day · Elena's pay application waits on it")
    const wrote = demoPeople({ jonah: with_({ lastOutAt: at(10, 1) }) })
    expect(nudgeRows(wrote, NOW).some((r) => r.contactId === 'jonah')).toBe(false)
  })
})

describe('the Reminder line on the card agrees with the rows', () => {
  it('reads the step’s days, their quiet, our last message, and whether the row is there', () => {
    expect(words(tom(2, at(9, 30, 11)), 'papers')).toBe('Call after 5 quiet days. Tom has been quiet 2 days, so not yet.')
    expect(words(tom(0, at(9, 30, 11)), 'papers')).toBe('Call after 5 quiet days. Tom wrote today, so not yet.')
    expect(words(tom(5, at(9, 25)), 'papers')).toBe('Call after 5 quiet days. Tom has been quiet 5 days, so it is on Follow up now.')
    expect(words(tom(6, at(10, 1, 16)), 'papers')).toBe('Call after 5 quiet days. Tom has been quiet 6 days. We wrote Thu Oct 1, so not yet.')
    expect(words(tom(null, at(9, 30, 11)), 'papers')).toBe('Call after 5 quiet days. Tom has not written yet. We wrote Wed Sep 30, so not yet.')
    expect(words(tom(null, at(9, 25)), 'papers')).toBe('Call after 5 quiet days. Tom has not written yet, so it is on Follow up now.')
    expect(words(demoPerson('greg'), 'ask')).toBe('Greg passed the day. It is on Follow up now.')
    expect(words(demoPerson('greg'), 'papers')).toBe('Call after 3 quiet days. Greg wrote today, so not yet.')
  })

  it('names the app when the app sends it, and the day when the step has only a day', () => {
    const portal = demoPerson('tom', (seed) => {
      seed.steps.portal = { state: 'now', since: day(9, 28) }
      seed.steps.papers = { state: 'next' }
      return { ...seed, nowStepId: 'portal', quietDays: 2 }
    })
    expect(words(portal, 'portal')).toBe('Text after 3 quiet days, sent by the app. Tom has been quiet 2 days, so not yet.')
    const questions = demoPerson('jonah', (seed) => {
      if (seed.steps.questions) seed.steps.questions.state = 'now'
      if (seed.steps.addenda) seed.steps.addenda.state = 'later'
      return { ...seed, nowStepId: 'questions' }
    })
    expect(words(questions, 'questions')).toBe('At questions close.')
  })

  it('reads Hold until Mon through Sunday, then lets the row back', () => {
    const mark = holdNudge({ stepId: 'papers', jobId: null }, NOW)
    expect(mark).toEqual({ stepId: 'papers', jobId: null, holdUntil: '2026-10-05' })
    const held = tom(6, at(9, 25), [mark])
    expect(words(held, 'papers')).toBe('Held until Mon Oct 5.')
    expect(due(held, 'papers').due).toBe(false)
    expect(due(held, 'papers', new Date(at(10, 4, 20))).due).toBe(false)
    expect(due(held, 'papers', new Date(at(10, 5, 7))).reason).toBe('quiet')
  })

  it('reads Remind now until we next send them anything', () => {
    const mark = nudgeNow({ stepId: 'papers', jobId: null, holdUntil: '2026-10-05' }, NOW)
    expect(mark).toEqual({ stepId: 'papers', jobId: null, holdUntil: null, nudgedAt: NOW.toISOString() })
    const pressed = tom(2, at(9, 30, 11), [mark])
    expect(words(pressed, 'papers')).toBe('Remind now put it on Follow up today.')
    expect(nudgeRows([pressed], NOW)).toMatchObject([insuranceRow('quiet 2 days · the flow says a call. We are waiting on their certificate of insurance.')])
    const sent = tom(2, new Date(NOW.getTime() + 60_000).toISOString(), [mark])
    expect(due(sent, 'papers').reason).toBe('not yet')
  })

  it('says a change order on a portal row is there instead', () => {
    const priya = demoPerson('priya')
    expect(words(priya, 'co')).toBe('Text after 3 quiet days. Priya has been quiet 6 days, so it is on Follow up now.')
    expect(words(priya, 'co', NOW, portalRows)).toBe('Text after 3 quiet days. Follow up shows it as a portal row instead.')
  })

  it('has no reminder on our move or a step with none', () => {
    expect(words(demoPerson('bill'), 'compare')).toBe('No reminder on this step.')
    expect(words(demoPerson('unk1'), 'who')).toBe('No reminder on this step.')
  })
})

describe('the reads a reminder needs', () => {
  it('asks for the first paper of theirs not on file, against the round on now', () => {
    const greg = demoPerson('greg')
    const ask = (person: PersonFlow, id: string) => paperToAsk(stepById(person.flow, id)!, stepOf(person, id))
    expect(ask(greg, 'ask')).toBe('quote')
    expect(ask(greg, 'papers')).toBe('coi')
    expect(ask(greg, 'msa')).toBeNull()
    expect(ask(demoPerson('bill'), 'compare')).toBeNull()
  })

  it('names a lapsed step by its paper', () => {
    expect(lapsedWhy(stepOf(demoPerson('greg'), 'papers'))).toBe('lapsed · insurance expired')
  })

  it('reads a paper’s sends in words', () => {
    expect(historyWords(undefined, NOW)).toBe('')
    expect(historyWords([at(10, 2, 8)], NOW)).toBe('First sent Oct 2, today. No reminder yet.')
    expect(historyWords([at(10, 1)], NOW)).toBe('First sent Oct 1, yesterday. No reminder yet.')
    expect(historyWords([at(9, 20), at(9, 24), at(9, 28)], NOW)).toBe('First sent Sep 20, 12 days ago. Reminded 2 times, last Sep 28.')
  })

  it('knows the papers nobody signs', () => {
    expect((['invitation', 'bid', 'schedule', 'payapp'] as const).filter(paperSigned)).toEqual([])
    expect((['msa', 'sow', 'contract', 'co'] as const).every(paperSigned)).toBe(true)
  })

  it('holds until the next Monday in the company calendar', () => {
    expect(nextMonday(NOW)).toBe('2026-10-05')
    expect(nextMonday(new Date(at(10, 4, 23)))).toBe('2026-10-05')
    expect(nextMonday(new Date(at(10, 5, 8)))).toBe('2026-10-12')
    // 11:30 PM Sunday in Chicago is already Monday in UTC; the hold still ends this Monday.
    expect(nextMonday(new Date('2026-10-05T04:30:00Z'))).toBe('2026-10-05')
  })
})
