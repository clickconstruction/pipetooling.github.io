import { describe, expect, it } from 'vitest'
import { CARD_TIPS, offCard, portalSoFar, stepCard, whoseMove, wordsText, type StepCard } from './card'
import { CHANGE_ORDERS, NOW, at, day, demoPeople, demoPerson, fact } from './demoPeople.fixture'
import type { PersonFlow } from './nudges'
import { laneOf, type FlowStep } from './state'
import { FLOW_PAPERS } from './facts'
import { plainWordsFailures } from '../plainWords'

const MARK = { ok: '✓', no: '○', wait: '↗', bad: '!', off: '–', next: '→' } as const

/** The card as lines of text, in the order the prototype drew it. */
function text(card: StepCard | null): string[] {
  if (!card) return []
  const out = [`${card.title} | ${wordsText(card.status)}`]
  for (const s of card.sections) {
    out.push(`[${s.heading}]`)
    for (const l of s.lines) {
      const presses = l.presses.length ? ` {${l.presses.map((p) => p.label).join(', ')}}` : ''
      out.push(`${MARK[l.mark]} ${l.text} <${wordsText(l.small)}>${presses}`)
    }
    for (const w of s.says) out.push(`says: ${wordsText(w)}`)
    for (const h of s.history) out.push(`hist: ${h.label} · ${h.words}`)
    if (s.empty) out.push(`empty: ${s.empty}`)
    for (const t of s.teamNotes) out.push(`team: ${t.by} · ${t.text} ${t.when}`)
    if (s.presses.length) out.push(`presses: ${s.presses.map((p) => p.label).join(' · ')}`)
  }
  return out
}

/** The job a step's card is for: the person's job on a Per job step. */
const jobOf = (person: PersonFlow, stepId: string) => (laneOf(person.flow, stepId) === 'per_job' ? person.reading.defaultJobId : null)
const cardOf = (person: PersonFlow, stepId: string, people = demoPeople()) => stepCard(person, stepId, jobOf(person, stepId), NOW, people)
const card = (id: string, stepId: string) => cardOf(demoPerson(id), stepId)

// What the prototype v1.178 draws for each card, read off its own stepCardHtml on its clock. The demo presses
// (their upload arrives, sign) are left out, as BUILD_PLAN.md says. A line marked CHANGED is a decision of the lead's
// review of cluster 5 (2026-10-12), named in the PR. A line marked STAMPS reads a day or a name from the stamps
// (flows/state.ts's FactReading and RoundReading) where the prototype had the words typed in its demo state; one marked
// READFLOW is where cluster 4's readFlow reads the demo people's stamps apart from the prototype's typed state.
const PROTOTYPE: Record<string, string[]> = {
  'greg/ask': [
    "Asked to quote | Greg's move. On it 10 days, usually 6. Late 2 days.",
    '[Each ask]',
    // READFLOW: each job's lane holds its own rounds, so Boerne's card shows Boerne's ask. Stone Oak's and Pad B's rounds
    // read on their own jobs' lanes, where the prototype listed every ask of Greg's on one card.
    '↗ Boerne Retail Shell <late 2 days, promised Wed Sep 30> {Ask again}',
    '[Next]',
    '→ Compared, our move. <Done when we carried their quote or we did not carry it.>',
    '[Reminder]',
    'says: Greg passed the day. It is on Follow up now.',
    'presses: Remind now · Hold until Mon · ⌕ see it',
    '[So far]',
    'hist: Invited · Tue Sep 8',
    'hist: Portal opened · Wed Sep 9',
    'hist: Papers in · Sat Sep 12', // STAMPS: was 'Sat Sep 12, insurance current to Sep 30'
    'hist: MSA signed · Mon Sep 14',
    'hist: Asked to quote · since Tue Sep 22',
    'presses: + a note · Skip for Greg · See their page',
  ],
  'greg/papers': [
    "Papers in | Greg's insurance certificate ran out Sep 30. We need a new one.",
    '[What we need]',
    '✓ W-9 <signed Sep 12> {Open}',
    '! Insurance certificate <ran out Sep 30> {Ask for it}',
    'presses: File one we were handed',
    '[Until then]',
    'says: No statement of work can go to Greg. Greg can still quote.',
    '[Reminder]',
    // CHANGED: the prototype said 5, the step's own count; a lapsed paper's row comes after 3 quiet days.
    'says: Call after 3 quiet days. Greg wrote today, so not yet.',
    'presses: Remind now · Hold until Mon · ⌕ see it',
    '[So far]',
    'hist: Invited · Tue Sep 8',
    'hist: Portal opened · Wed Sep 9',
    'hist: Papers in · Sat Sep 12', // STAMPS: was 'Sat Sep 12, insurance current to Sep 30'
    'hist: Ran out · Sep 30. Nobody did this. The date passed.',
    'presses: + a note · Skip for Greg · See their page',
  ],
  'elena/payapp': [
    "Pay application | Waiting on Jonah, 4 days. Not Elena's move and not ours.",
    '[Each month]',
    '✓ Pay app 3 <Fri Sep 25> {Open}', // STAMPS: was 'Sep 25'
    '↗ Pay app 4 <due Fri Oct 30> {Remind}',
    '[Until then]',
    'says: Jonah has it for the certificate. Nothing reminds Elena. The reminder goes to Jonah.',
    "presses: Open Jonah's thread · Remind Jonah now",
    '[Next]',
    '→ Closeout, our move. <Done when the job is closed.>',
    '[So far]',
    'hist: Master agreement · Tue Aug 4',
    'hist: Asked us · Tue Aug 11',
    'hist: Our bid · Thu Aug 20',
    'hist: Said yes · Fri Aug 28',
    'hist: Contract signed · Wed Sep 2',
    'hist: Start date · Tue Sep 8',
    'hist: On site · Mon Sep 14',
    'hist: Pay application · since Mon Sep 28',
    // CHANGED: no "Not signed." on a pay application, which nobody signs.
    'hist: Portal · Elena opened the pay application Tue Sep 29 8:05 AM.',
    'presses: + a note · Skip for Elena · See their page',
  ],
  'priya/start': [
    'Start date | Our move. On it 13 days, usually 3.',
    '[What we need]',
    '○ Start date letter <not sent yet> {Send it}',
    '[Next]',
    '→ On site, our move. <Done when the job started.>',
    '[Reminder]',
    'says: No reminder on this step.',
    // CHANGED: no Remind now or Hold until Mon on a step with no reminder.
    '[So far]',
    'hist: Asked us · Tue Sep 1',
    'hist: Our bid · Thu Sep 10',
    'hist: Said yes · Fri Sep 18',
    'hist: Contract signed · Sat Sep 19',
    'hist: Start date · since Sat Sep 19',
    'presses: + a note · Skip for Priya · See their page',
  ],
  'priya/co': [
    'Change orders | Any time in the job. 2 so far, 1 open.',
    '[Each change]',
    '✓ CO 1 · exam 2 cabinets <Mon Sep 28> {Open}',
    '↗ CO 2 · a sink in exam 3 <since Wed Sep 30> {Ask again}', // STAMPS: was 'sent Wed Sep 30, with Priya'
    // CHANGED: an open change order nudges, as the owner drew it; with no portal row passed, its row is there.
    '[Reminder]',
    'says: Text after 3 quiet days. Priya has been quiet 6 days, so it is on Follow up now.',
    'presses: Remind now · Hold until Mon · ⌕ see it',
    '[So far]',
    'hist: Asked us · Tue Sep 1',
    'hist: Our bid · Thu Sep 10',
    'hist: Said yes · Fri Sep 18',
    'hist: Contract signed · Sat Sep 19',
    'hist: Portal · Priya has not opened the change order 2 yet.',
    'presses: + a note · Skip for Priya · See their page',
  ],
  'tom/papers': [
    "Papers in | Tom's move. On it 4 days, usually 3.",
    '[What we need]',
    '✓ W-9 <signed Sep 29> {Open}',
    '○ Insurance certificate <nothing yet> {Ask for it}',
    'presses: File one we were handed',
    '[Next]',
    "→ MSA signed, Tom's move. <We send the master agreement once this is done.> {Send it now}",
    '[Reminder]',
    // CHANGED: quiet days count their last word (helper 4's quietDays); Tom has not written, and our text was Wed.
    'says: Call after 5 quiet days. Tom has not written yet. We wrote Wed Sep 30, so not yet.',
    'presses: Remind now · Hold until Mon · ⌕ see it',
    '[So far]',
    'hist: Invited · Fri Sep 25',
    'hist: Portal opened · Mon Sep 28',
    'hist: Papers in · since Mon Sep 28. W-9 signed Sep 29',
    'team: Rosa · Their broker renews the policy Nov 1; the certificate comes after. Thu Oct 1',
    'presses: + a note · Skip for Tom · See their page',
  ],
  'bill/compare': [
    'Compared | Our move. On it 3 days, usually 2.',
    '[What we need]',
    '○ We carried their quote <not yet>',
    '○ We did not carry it <not yet>',
    'says: Either one finishes it.',
    '[Next]',
    "→ Statement of work, Bill's move. <We send the statement of work once this is done.> {Send it now}",
    '[Reminder]',
    'says: No reminder on this step.',
    '[So far]',
    'hist: Invited · Tue Sep 8',
    'hist: Portal opened · Tue Sep 8',
    'hist: Papers in · Wed Sep 9',
    'hist: MSA signed · Thu Sep 10',
    'hist: Asked to quote · Tue Sep 29',
    'hist: Compared · since Tue Sep 29',
    'presses: + a note · Skip for Bill · See their page',
  ],
  'jonah/addenda': [
    // CHANGED (moverOf): Jonah filed addendum 2 and it waits on us to send it to the trades, so the move is ours.
    'Addenda | Our move. On it 0 days, usually 1.',
    '[Each addendum]',
    '✓ Addendum 1 <Fri Sep 25> {Open}', // STAMPS: was 'done'
    '↗ Addendum 2 <since Fri Oct 2> {Remind}', // STAMPS: was 'filed today, not sent to the trades yet'; ours to send, so Remind
    '[Next]',
    "→ Submittals, Jonah's move. <Done when the submittal is reviewed.>",
    '[Reminder]',
    'says: No reminder on this step.',
    '[So far]',
    'hist: Plans in · Tue Sep 15',
    'hist: Addenda · since Fri Oct 2',
    'presses: + a note · Skip for Jonah · See their page',
  ],
  // CHANGED: off the flow is the office's word on the person (contacts.off_*: since, why, by), and the lane's ended
  // fact says how the bid went; the prototype read the reason off the bid.
  'marcus/contract': [
    'Off the flow | Since Tue Sep 29. They declined.',
    '[Why]',
    '– Declined our bid, went with another plumber. <Rosa marked Marcus off the flow with that reason.> {Open the bid}',
    '[What stops, what stays]',
    'says: Nudges stop. The thread, the papers and the jobs stay. Marcus stays in Messages and Customers under a filter, off the flow, folded by default.',
    '[Back on]',
    'says: A new ask, a new bid, or Put Marcus back on with a reason. Marcus re-enters at the step the facts say, not at the start.',
  ],
  'marcus/asked': [
    'Asked us | Done Mon Sep 14.',
    '[What we have]',
    '✓ They asked us <Marcus, Mon Sep 14>', // STAMPS: the day and who; the prototype typed its own words
    '[So far]',
    'hist: Asked us · Mon Sep 14',
    'presses: + a note · See their page',
  ],
  'greg/msa': [
    'MSA signed | Done Mon Sep 14.',
    '[What we have]',
    '✓ Master agreement <signed Sep 14> {Open}',
    '[So far]',
    'hist: Invited · Tue Sep 8',
    'hist: Portal opened · Wed Sep 9',
    'hist: Papers in · Sat Sep 12', // STAMPS: was 'Sat Sep 12, insurance current to Sep 30'
    'hist: MSA signed · Mon Sep 14',
    'presses: + a note · See their page',
  ],
  'priya/agreement': [
    'Master agreement | Skipped for Priya: One job, so no master agreement.', // READFLOW: the skip's reason as stamped
    '[What we need]',
    '○ Master agreement <not sent yet> {Send it}',
    '[So far]',
    'empty: Nothing yet.',
    'presses: + a note · Put it back · See their page',
  ],
  'priya/yes': [
    'Said yes | Done Fri Sep 18.',
    '[What we have]',
    '✓ They said yes <Fri Sep 18>', // STAMPS: was 'she said yes Fri Sep 18'
    '○ They declined <not yet>',
    'says: Either one finishes it.',
    '[So far]',
    'hist: Asked us · Tue Sep 1',
    'hist: Our bid · Thu Sep 10',
    'hist: Said yes · Fri Sep 18',
    'presses: + a note · See their page',
  ],
  'greg/sow': [
    'Statement of work | Not started yet. Comes after Compared.',
    '[What we need]',
    '○ Statement of work <not sent yet> {Send it}',
    '[So far]',
    'hist: Invited · Tue Sep 8',
    'hist: Portal opened · Wed Sep 9',
    'hist: Papers in · Sat Sep 12', // STAMPS: was 'Sat Sep 12, insurance current to Sep 30'
    'hist: MSA signed · Mon Sep 14',
    'presses: + a note · Skip for Greg · See their page',
  ],
  'greg/draws': [
    'Draws | Not started yet. Comes after Statement of work.',
    '[Each draw]',
    'empty: None yet.',
    '[So far]',
    'hist: Invited · Tue Sep 8',
    'hist: Portal opened · Wed Sep 9',
    'hist: Papers in · Sat Sep 12', // STAMPS: was 'Sat Sep 12, insurance current to Sep 30'
    'hist: MSA signed · Mon Sep 14',
    'presses: + a note · Skip for Greg · See their page',
  ],
  'elena/co': [
    'Change orders | Any time in the job. 2 so far.',
    '[Each change]',
    '✓ CO 1 <Sat Sep 12> {Open}', // STAMPS: was 'done'
    '✓ CO 2 <Fri Sep 18> {Open}', // STAMPS: was 'done'
    '[So far]',
    'hist: Master agreement · Tue Aug 4',
    'hist: Asked us · Tue Aug 11',
    'hist: Our bid · Thu Aug 20',
    'hist: Said yes · Fri Aug 28',
    'hist: Contract signed · Wed Sep 2',
    'hist: Start date · Tue Sep 8',
    'hist: On site · Mon Sep 14',
    'presses: + a note · Skip for Elena · See their page',
  ],
  'unk1/who': [
    'Who is this? | Our move.',
    '[What we need]',
    '○ Someone said who this is <not yet>',
    '[Reminder]',
    'says: No reminder on this step.',
    '[So far]',
    'empty: Nothing yet.',
    'presses: + a note · Skip for (830) · See their page',
  ],
}

describe('whose move by its facts (moverOf)', () => {
  // Jonah filed addendum 2 on Fri Oct 2, and it has not gone to the trades: the step is his, its open fact is ours.
  it('reads Jonah’s filed addendum as ours on its card, its open round and the Next line of Questions', () => {
    const addenda = text(card('jonah', 'addenda'))
    expect(addenda[0]).toBe('Addenda | Our move. On it 0 days, usually 1.')
    expect(addenda).toContain('↗ Addendum 2 <since Fri Oct 2> {Remind}')
    expect(text(card('jonah', 'questions'))).toContain('→ Addenda, our move. <Done when the addendum is filed and the addendum went to the trades.>')
  })
})

describe('the step card reads as the prototype v1.178 drew it', () => {
  it.each(Object.keys(PROTOTYPE))('%s', (key) => {
    const [id = '', stepId = ''] = key.split('/')
    expect(text(card(id, stepId))).toEqual(PROTOTYPE[key])
  })
})

describe('plain words', () => {
  it('hold on every demo card: the status, the lines and what each section says', () => {
    const people = demoPeople()
    const failures = people.flatMap((person) =>
      person.reading.lanes.flatMap((lane) =>
        lane.steps.flatMap((step) => {
          const shown = cardOf(person, step.stepId, people)
          if (!shown) return []
          const texts = [shown.status, ...shown.sections.flatMap((s) => [...s.says, ...s.lines.map((l) => l.small)])].map(wordsText)
          return texts.flatMap((t) => plainWordsFailures(t))
        }),
      ),
    )
    expect(failures).toEqual([])
  })
})

describe('the status sentence', () => {
  it('marks only the late words late', () => {
    const ask = card('greg', 'ask')
    expect(ask?.status.filter((x) => x.late).map((x) => x.text)).toEqual(['Late 2 days.'])
    expect(ask?.sections[0]?.lines[0]?.small).toEqual([{ text: 'late 2 days', late: true }, { text: ', promised Wed Sep 30' }])
  })

  it('counts a wait of one day as one day', () => {
    const elena = demoPerson('elena', (seed) => {
      const payapp = seed.steps.payapp
      if (payapp?.waitingOn) payapp.waitingOn.since = day(10, 1)
      return seed
    })
    expect(wordsText(cardOf(elena, 'payapp')?.status ?? [])).toBe("Waiting on Jonah, 1 day. Not Elena's move and not ours.")
  })

  it('says who has it without a paper when the step waited on names none, and someone else when we cannot tell', () => {
    const elena = demoPerson('elena', (seed) => {
      const payapp = seed.steps.payapp
      if (payapp?.waitingOn) payapp.waitingOn.stepId = 'questions'
      return seed
    })
    const until = cardOf(elena, 'payapp')?.sections.find((s) => s.id === 'untilThen')
    expect(wordsText(until?.says[0] ?? [])).toBe('Jonah has it. Nothing reminds Elena. The reminder goes to Jonah.')
    expect(wordsText(cardOf(demoPerson('elena'), 'payapp', [])?.status ?? [])).toBe("Waiting on someone else, 4 days. Not Elena's move and not ours.")
  })

  it('reads a step aside by its rounds, whatever state the reading gives it, with a Reminder line while a round is open', () => {
    expect(wordsText(card('elena', 'co')?.status ?? [])).toBe('Any time in the job. 2 so far.')
    expect(card('elena', 'co')?.sections.map((s) => s.id)).toEqual(['rounds', 'soFar'])
    expect(card('priya', 'co')?.sections.map((s) => s.id)).toEqual(['rounds', 'reminder', 'soFar'])
  })

  it('says a change order on a portal row is there instead, with nothing to press', () => {
    const skip = (contactId: string, paper: string, key: string | null) => contactId === 'priya' && paper === 'co' && key === CHANGE_ORDERS.priya2
    const priya = demoPerson('priya')
    const reminder = stepCard(priya, 'co', 'helotes', NOW, [], { skip })?.sections.find((s) => s.id === 'reminder')
    expect(wordsText(reminder?.says[0] ?? [])).toBe('Text after 3 quiet days. Follow up shows it as a portal row instead.')
    expect(reminder?.presses).toEqual([])
  })

  it('shows a done step to a person off the flow, and the off card for the rest', () => {
    expect(card('marcus', 'asked')?.title).toBe('Asked us')
    expect(card('marcus', 'contract')).toEqual(offCard(demoPerson('marcus')))
    expect(card('marcus', 'nothing')).toBeNull()
  })

  it('reads the move from the thread when the step on now is both sides', () => {
    const elena = demoPerson('elena', (seed) => {
      if (seed.steps.payapp) seed.steps.payapp.waitingOn = undefined
      return seed
    })
    expect(wordsText(cardOf(elena, 'payapp')?.status ?? [])).toBe('Both sides. On it 4 days, usually 21. Due Fri Oct 30.')
    expect(wordsText(cardOf({ ...elena, court: 'theirs' }, 'payapp')?.status ?? [])).toMatch(/^Elena's move\./)
    expect(wordsText(cardOf({ ...elena, owe: true }, 'payapp')?.status ?? [])).toMatch(/^Our move\./)
  })
})

describe('a lapsed step', () => {
  it('keeps the day it was done in So far, not the day its paper ran out', () => {
    const soFar = card('greg', 'papers')?.sections.find((s) => s.id === 'soFar')
    expect(soFar?.history.find((h) => h.label === 'Papers in')?.words).toBe('Sat Sep 12')
  })

  it('shows a loop with nothing open a Reminder line with nothing to press', () => {
    const reminder = cardOf(demoPerson('tom'), 'ask')?.sections.find((s) => s.id === 'reminder')
    expect(reminder?.says.map(wordsText)).toEqual(['Nothing is open with Tom on this step yet.'])
    expect(reminder?.presses).toEqual([])
  })
})

describe('the presses', () => {
  it('carry hover cards in plain words, for the longest paper names too', () => {
    const names = Object.values(FLOW_PAPERS).map((p) => p.name)
    const tips = Object.values(CARD_TIPS).flatMap((tip) =>
      typeof tip === 'function' ? names.flatMap((name) => [tip(name, true), tip(name, false)]) : [tip],
    )
    expect(tips.flatMap((t) => [...plainWordsFailures(t.does), ...plainWordsFailures(t.changes)])).toEqual([])
  })

  it('carry the paper, the step and the job they act on', () => {
    const papers = card('greg', 'papers')
    expect(papers?.sections[0]?.lines[1]?.presses).toEqual([{ id: 'askForIt', label: 'Ask for it', tip: CARD_TIPS.askForIt, primary: true, paper: 'coi' }])
    expect(papers?.sections[0]?.presses[0]).toMatchObject({ id: 'fileByHand', stepId: 'papers', jobId: null })
    const next = card('tom', 'papers')?.sections.find((s) => s.id === 'next')
    expect(next?.lines[0]?.presses[0]).toMatchObject({ id: 'sendItNow', paper: 'msa', stepId: 'msa', jobId: null })
    expect(card('greg', 'ask')?.sections[0]?.lines[0]?.presses[0]).toEqual({
      id: 'askAgain',
      label: 'Ask again',
      primary: true,
      round: 'inv-greg-boerne',
      paper: 'quote',
    })
    const remind = card('greg', 'ask')?.sections.find((s) => s.id === 'reminder')?.presses[0]
    expect(remind).toMatchObject({ id: 'remindNow', stepId: 'ask', jobId: 'boerne' })
    const back = card('marcus', 'contract')?.sections[2]?.says[0]?.find((x) => x.press)
    expect(back?.press).toEqual({ id: 'putBackOn', label: 'Put Marcus back on', who: 'marcus' })
  })

  it('say a paper nobody signs is done once it goes', () => {
    expect(card('priya', 'start')?.sections[0]?.lines[0]?.presses[0]?.tip).toEqual({
      name: 'Send it',
      does: 'Sends the schedule as an email with the paper, the way the company window does. The sent copy is filed and shown in the thread.',
      changes: 'The step is done once it goes.',
    })
    expect(card('tom', 'msa')?.sections[0]?.lines[0]?.presses[0]?.tip?.changes).toBe('The step waits on their signature after that.')
  })

  it('read Remind them on a paper of ours out to sign', () => {
    const priya = demoPerson('priya', (seed) => {
      seed.steps.contract = { state: 'now', since: day(9, 18), facts: [fact('contract_signed', 'wait', { at: day(9, 18) })] }
      return seed
    })
    const line = cardOf(priya, 'contract')?.sections[0]?.lines[0]
    expect(line?.small).toEqual([{ text: 'sent Sep 18, waiting on their signature' }])
    expect(line?.presses.map((p) => p.id)).toEqual(['remindThem'])
  })
})

describe('Next', () => {
  it('names the paper we send, and never says "the our"', () => {
    const priya = demoPerson('priya', (seed) => {
      seed.steps.yes = { state: 'now', since: day(9, 28) }
      seed.steps.contract = { state: 'next' }
      return seed
    })
    const next = cardOf(priya, 'yes')?.sections.find((s) => s.id === 'next')
    expect(next?.lines[0]?.text).toBe("Contract signed, Priya's move.")
    expect(wordsText(next?.lines[0]?.small ?? [])).toBe('We send the contract once this is done.')
  })

  it('skips a step aside and a step skipped for them', () => {
    const elena = demoPerson('elena', (seed) => {
      if (seed.steps.payapp) seed.steps.payapp.waitingOn = undefined
      seed.steps.close = { state: 'skipped', skip: 'We close it with the warranty.' }
      return seed
    })
    const next = cardOf(elena, 'payapp')?.sections.find((s) => s.id === 'next')
    expect(next?.lines[0]?.text).toBe('Warranty, our move.')
  })
})

describe('the portal in So far', () => {
  it('keeps Not signed for a paper they sign, and the contract reads as the contract', () => {
    const priya = demoPerson('priya', (seed) => {
      seed.steps.contract = { state: 'now', since: day(9, 18), facts: [fact('contract_signed', 'wait', { at: day(9, 18) })] }
      return seed
    })
    const step = priya.reading.lanes[1]?.steps.find((x) => x.stepId === 'contract')
    expect(step && portalSoFar(priya, step)).toEqual(['Priya opened the contract Sat Sep 19 8:02 AM. Not signed.'])
  })

  it('says nothing for a person with no portal reads', () => {
    const greg = demoPerson('greg')
    const step = greg.reading.lanes[0]?.steps[0]
    expect(step && portalSoFar(greg, step)).toEqual([])
  })
})

describe('the days', () => {
  it('read a stamp in the company calendar, whatever the device', () => {
    const greg = demoPerson('greg', (seed) => {
      // 11:30 PM Central on Sep 14 is already Sep 15 in UTC; the card still says Mon Sep 14.
      if (seed.steps.msa) seed.steps.msa.facts = [fact('msa_signed', 'ok', { at: at(9, 14, 23, 30) })]
      return seed
    })
    expect(wordsText(cardOf(greg, 'msa')?.status ?? [])).toBe('Done Mon Sep 14.')
  })

  it('name who did a fact when the stamp says', () => {
    const priya = demoPerson('priya', (seed) => {
      if (seed.steps.yes) seed.steps.yes.facts = [fact('said_yes', 'ok', { at: day(9, 18), by: 'Rosa' }), fact('declined')]
      return seed
    })
    expect(cardOf(priya, 'yes')?.sections[0]?.lines[0]?.small).toEqual([{ text: 'Rosa, Fri Sep 18' }])
  })
})

describe('whoseMove', () => {
  const step = (who: FlowStep['who']) => ({ who })
  const on = { onNow: true, waiting: false, perJob: false, owe: false, court: null }

  it('reads the step on now from what we owe, then the thread', () => {
    expect(whoseMove(step('them'), { ...on, waiting: true })).toBe('wait')
    expect(whoseMove(step('both'), { ...on, onNow: false })).toBe('both')
    expect(whoseMove(step('them'), { ...on, perJob: true, owe: true })).toBe('them')
    expect(whoseMove(step('them'), { ...on, owe: true })).toBe('us')
    expect(whoseMove(step('us'), { ...on, court: 'theirs' })).toBe('them')
    expect(whoseMove(step('both'), on)).toBe('both')
  })
})
