import { describe, expect, it } from 'vitest'
import type { SubjectJob } from '../emailIn/jobInSubject'
import { MY_MAIL_NO_SUBJECT, type MyMailJobChip, type MyMailParty } from './contract'
import { guessJob, type MyMailGuessFacts } from './mailGuess'

// Made-up jobs and people: Dale Okafor at Ridgeway Builders, Priya Nair at the Cedar Bend HOA.
const elm: MyMailJobChip = { kind: 'pipeline', id: 'job-elm', key: 'pipeline:job-elm', num: 'JP1077', name: '4 Elm Ct' }
const harbor: MyMailJobChip = { kind: 'pipeline', id: 'job-harbor', key: 'pipeline:job-harbor', num: 'JP1081', name: '19 Harbor Ln' }
const clubhouse: MyMailJobChip = { kind: 'bid', id: 'bid-club', key: 'bid:bid-club', num: 'BP523', name: 'Cedar Bend clubhouse' }
const dale: MyMailParty = { name: 'Dale Okafor', address: 'dale@ridgeway.example' }
const priya: MyMailParty = { name: '', address: 'priya@cedarbend.example' }

/** A job as `subjectJobs` gives it: its numbers, its name, and whether the other party is on it. */
const subjectJob = (chip: MyMailJobChip, mine: boolean, more: string[] = []): SubjectJob => ({ key: chip.key, labels: [chip.num, ...more], name: chip.name, mine })

const facts = (over: Partial<MyMailGuessFacts> = {}): MyMailGuessFacts => ({ subjectJobs: [], partyJobs: [], domainJobs: [], taggedJob: null, ...over })
const mailFrom = (who: MyMailParty, subject: string) => ({ who, subject })

describe('guessJob: the job the app guesses, in order', () => {
  it('makes no guess on a tagged conversation, which lands by itself', () => {
    expect(guessJob(mailFrom(dale, 'JP1077 water heater'), facts({ subjectJobs: [subjectJob(elm, true)], taggedJob: elm }))).toBeNull()
  })

  it('takes the job the subject names by its number, and says so', () => {
    expect(guessJob(mailFrom(dale, 'Re: JP1077 water heater'), facts({ subjectJobs: [subjectJob(elm, false)] }))).toEqual({ ...elm, why: 'the subject names JP1077' })
  })

  it('names the number that stood in the subject, a Click number too, with the job’s own number on the chip', () => {
    expect(guessJob(mailFrom(dale, 'C88 punch walk'), facts({ subjectJobs: [subjectJob(elm, true, ['C88'])] }))).toEqual({ ...elm, why: 'the subject names C88' })
  })

  it('takes a job’s whole name in the subject among the other party’s own jobs alone', () => {
    const named = facts({ subjectJobs: [subjectJob(elm, true), subjectJob(harbor, true)] })
    expect(guessJob(mailFrom(dale, 'Re: 4 Elm Ct water heater'), named)).toEqual({ ...elm, why: 'the subject names 4 Elm Ct' })
    expect(guessJob(mailFrom(dale, 'Re: 4 Elm Ct water heater'), facts({ subjectJobs: [subjectJob(elm, false)] }))).toBeNull()
  })

  it('names none when two jobs stand in the subject, and tries the other party’s star next', () => {
    const two = facts({ subjectJobs: [subjectJob(elm, true), subjectJob(harbor, true)], partyJobs: [{ chip: harbor, star: true, open: true }] })
    expect(guessJob(mailFrom(dale, 'JP1077 and JP1081 schedule'), two)).toEqual({ ...harbor, why: 'Dale Okafor is on this job' })
  })

  it('never reads Gmail’s no-subject words as a job’s name', () => {
    const odd = facts({ subjectJobs: [{ key: 'bid:odd', labels: [], name: MY_MAIL_NO_SUBJECT, mine: true }] })
    expect(guessJob(mailFrom(dale, MY_MAIL_NO_SUBJECT), odd)).toBeNull()
  })

  it('takes the other party’s one starred job, over their open ones', () => {
    const party = facts({ partyJobs: [{ chip: elm, star: false, open: true }, { chip: harbor, star: true, open: false }] })
    expect(guessJob(mailFrom(dale, 'Thursday'), party)).toEqual({ ...harbor, why: 'Dale Okafor is on this job' })
  })

  it('takes their one open job with no star, and names the address when the header gave no name', () => {
    const party = facts({ partyJobs: [{ chip: clubhouse, star: false, open: true }, { chip: elm, star: false, open: false }] })
    expect(guessJob(mailFrom(priya, 'The board meets Tuesday'), party)).toEqual({ ...clubhouse, why: 'priya@cedarbend.example is on this job' })
  })

  it('names none for two open jobs, and tries the domain next', () => {
    const two = facts({
      partyJobs: [{ chip: elm, star: false, open: true }, { chip: harbor, star: false, open: true }],
      domainJobs: [{ chip: elm, customer: 'Ridgeway Builders' }],
    })
    expect(guessJob(mailFrom(dale, 'Thursday'), two)).toEqual({ ...elm, why: 'ridgeway.example is Ridgeway Builders' })
  })

  it('counts one job listed twice as one', () => {
    expect(guessJob(mailFrom(dale, 'Thursday'), facts({ partyJobs: [{ chip: elm, star: false, open: true }, { chip: elm, star: false, open: true }] }))).toEqual({ ...elm, why: 'Dale Okafor is on this job' })
  })

  it('takes a customer’s domain with exactly one open job, never an open mail service’s, and never a customer with no name', () => {
    const ridgeway = facts({ domainJobs: [{ chip: elm, customer: 'Ridgeway Builders' }] })
    expect(guessJob(mailFrom({ name: 'Ana', address: 'ana@ridgeway.example' }, 'Hello'), ridgeway)).toEqual({ ...elm, why: 'ridgeway.example is Ridgeway Builders' })
    expect(guessJob(mailFrom({ name: 'Ana', address: 'ana.ridgeway@gmail.com' }, 'Hello'), facts({ domainJobs: [{ chip: elm, customer: 'Ridgeway Builders' }] }))).toBeNull()
    expect(guessJob(mailFrom({ name: 'Ana', address: 'ana@ridgeway.example' }, 'Hello'), facts({ domainJobs: [{ chip: elm, customer: '  ' }] }))).toBeNull()
    const two = facts({ domainJobs: [{ chip: elm, customer: 'Ridgeway Builders' }, { chip: harbor, customer: 'Ridgeway Builders' }] })
    expect(guessJob(mailFrom({ name: 'Ana', address: 'ana@ridgeway.example' }, 'Hello'), two)).toBeNull()
  })

  it('makes no guess with nothing to go on, and the row offers Tag…', () => {
    expect(guessJob(mailFrom(dale, 'Invoice 88412'), facts())).toBeNull()
  })
})
