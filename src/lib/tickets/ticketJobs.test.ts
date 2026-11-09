import { describe, expect, it } from 'vitest'
import { plainWordsFailures } from '../plainWords'
import {
  EMPTY_TICKET_CHOICE,
  SECOND_JOB_WORDS,
  chosenOptions,
  firstTicketChoice,
  tapJobLater,
  tapNoOneJob,
  tapTicketJob,
  ticketChoiceReady,
  ticketChoiceWrite,
  ticketJobOptions,
  ticketJobWhyWords,
  ticketSaveLabel,
  withPickedJob,
  type TicketJobFacts,
  type TicketPoFacts,
} from './ticketJobs'

const oak: TicketJobFacts = { jobId: 'oak', label: 'JP1042', name: 'Oak Hollow Bldg C' }
const cedar: TicketJobFacts = { jobId: 'cedar', label: 'JP1038', name: 'Cedar Bend water heater' }
const elm: TicketJobFacts = { jobId: 'elm', label: 'JP1050', name: 'Elm Street repipe' }
const po: TicketPoFacts = { ...cedar, poEntryId: 'po1', poCode: '41207', houseName: 'Ridgeway Supply' }

describe('the chips on the sheet', () => {
  it('lists a PO code, then the clocked job, then the day, then a picked job', () => {
    const options = ticketJobOptions({ poEntries: [po], clockedJob: oak, dayJobs: [elm], picked: [{ jobId: 'x', label: 'JP9', name: 'Other' }] })
    expect(options.map((o) => `${o.why}:${o.label}`)).toEqual(['po:JP1038', 'clocked:JP1042', 'day:JP1050', 'picked:JP9'])
    expect(options[0]).toMatchObject({ key: 'po:po1', poEntryId: 'po1', poCode: '41207', houseName: 'Ridgeway Supply' })
  })

  it('lists a job once: under its PO code, or where it first comes', () => {
    const options = ticketJobOptions({ poEntries: [po], clockedJob: cedar, dayJobs: [cedar, oak, oak], picked: [oak] })
    expect(options.map((o) => o.key)).toEqual(['po:po1', 'job:oak'])
  })

  it('keeps two PO codes for one job apart', () => {
    const second: TicketPoFacts = { ...po, poEntryId: 'po2', poCode: '41208', houseName: 'The Home Depot' }
    expect(ticketJobOptions({ poEntries: [po, second, po], clockedJob: null, dayJobs: [], picked: [] }).map((o) => o.key)).toEqual(['po:po1', 'po:po2'])
  })

  it('says why each is offered, in plain words', () => {
    const options = ticketJobOptions({ poEntries: [po], clockedJob: oak, dayJobs: [elm], picked: [{ jobId: 'x', label: 'JP9', name: 'Other' }] })
    expect(options.map(ticketJobWhyWords)).toEqual(['Your PO code at Ridgeway Supply', 'Clocked in now', 'On your day', 'You picked it'])
    expect(ticketJobWhyWords({ why: 'po', poCode: '41207', houseName: null })).toBe('Your PO code')
    for (const line of [...options.map(ticketJobWhyWords), SECOND_JOB_WORDS]) expect(plainWordsFailures(line), line).toEqual([])
  })
})

describe('what is picked', () => {
  const options = ticketJobOptions({ poEntries: [], clockedJob: oak, dayJobs: [cedar, elm], picked: [] })

  it('starts on today’s PO code, else on the job clocked in now', () => {
    expect(firstTicketChoice(ticketJobOptions({ poEntries: [po], clockedJob: oak, dayJobs: [], picked: [] }))).toEqual({ keys: ['po:po1'], noOneJob: false })
    expect(firstTicketChoice(options)).toEqual({ keys: ['job:oak'], noOneJob: false })
  })

  it('never assumes a job that is only on the day', () => {
    expect(firstTicketChoice(ticketJobOptions({ poEntries: [], clockedJob: null, dayJobs: [cedar], picked: [] }))).toEqual(EMPTY_TICKET_CHOICE)
  })

  it('adds a second job on a second tap, and takes one off on a tap again', () => {
    const two = tapTicketJob(firstTicketChoice(options), 'job:cedar')
    expect(two.keys).toEqual(['job:oak', 'job:cedar'])
    expect(tapTicketJob(two, 'job:oak').keys).toEqual(['job:cedar'])
  })

  it('clears the jobs for no one job, and a job clears that', () => {
    const none = tapNoOneJob(firstTicketChoice(options))
    expect(none).toEqual({ keys: [], noOneJob: true })
    expect(tapTicketJob(none, 'job:elm')).toEqual({ keys: ['job:elm'], noOneJob: false })
    expect(tapNoOneJob(none)).toEqual(EMPTY_TICKET_CHOICE)
  })

  it('saves with the job left for later, and a job takes that off', () => {
    const later = tapJobLater(firstTicketChoice(options))
    expect(later).toEqual({ keys: [], noOneJob: false, later: true })
    expect(ticketChoiceReady(later, options)).toBe(true)
    expect(ticketChoiceWrite(later, options)).toEqual({ job_id: null, also_job_ids: [], no_one_job: false, po_entry_id: null })
    expect(ticketSaveLabel(later, options)).toBe('Save the ticket and pick the job later')
    expect(tapTicketJob(later, 'job:oak')).toEqual({ keys: ['job:oak'], noOneJob: false })
    expect(tapJobLater(later)).toEqual(EMPTY_TICKET_CHOICE)
  })

  it('picks a job found through Another job as it is added', () => {
    expect(withPickedJob(EMPTY_TICKET_CHOICE, 'x')).toEqual({ keys: ['job:x'], noOneJob: false })
    expect(withPickedJob({ keys: ['job:x'], noOneJob: false }, 'x').keys).toEqual(['job:x'])
    expect(withPickedJob({ keys: [], noOneJob: true }, 'x')).toEqual({ keys: ['job:x'], noOneJob: false })
  })

  it('skips a key the chips no longer hold', () => {
    expect(chosenOptions({ keys: ['job:gone', 'job:oak'], noOneJob: false }, options).map((o) => o.jobId)).toEqual(['oak'])
  })

  it('is ready with a job or with no one job, and not with nothing', () => {
    expect(ticketChoiceReady(firstTicketChoice(options), options)).toBe(true)
    expect(ticketChoiceReady({ keys: [], noOneJob: true }, options)).toBe(true)
    expect(ticketChoiceReady(EMPTY_TICKET_CHOICE, options)).toBe(false)
    expect(ticketChoiceReady({ keys: ['job:gone'], noOneJob: false }, options)).toBe(false)
  })
})

describe('what the choice writes and the button says', () => {
  const options = ticketJobOptions({ poEntries: [po], clockedJob: oak, dayJobs: [elm], picked: [] })

  it('writes the first job, the rest, and the PO code among them', () => {
    expect(ticketChoiceWrite({ keys: ['job:oak'], noOneJob: false }, options)).toEqual({ job_id: 'oak', also_job_ids: [], no_one_job: false, po_entry_id: null })
    expect(ticketChoiceWrite({ keys: ['job:oak', 'po:po1', 'job:elm'], noOneJob: false }, options)).toEqual({ job_id: 'oak', also_job_ids: ['cedar', 'elm'], no_one_job: false, po_entry_id: 'po1' })
    expect(ticketChoiceWrite({ keys: [], noOneJob: true }, options)).toEqual({ job_id: null, also_job_ids: [], no_one_job: true, po_entry_id: null })
    expect(ticketChoiceWrite(EMPTY_TICKET_CHOICE, options)).toEqual({ job_id: null, also_job_ids: [], no_one_job: false, po_entry_id: null })
  })

  it('names exactly what Save will do', () => {
    expect(ticketSaveLabel({ keys: ['job:oak'], noOneJob: false }, options)).toBe('Save the ticket to JP1042')
    expect(ticketSaveLabel({ keys: ['job:oak', 'po:po1'], noOneJob: false }, options)).toBe('Save the ticket to JP1042 and JP1038')
    expect(ticketSaveLabel({ keys: ['job:oak', 'po:po1', 'job:elm'], noOneJob: false }, options)).toBe('Save the ticket to JP1042, JP1038 and JP1050')
    expect(ticketSaveLabel({ keys: [], noOneJob: true }, options)).toBe('Save the ticket for no one job')
    expect(ticketSaveLabel(EMPTY_TICKET_CHOICE, options)).toBe('Pick a job to save the ticket')
  })
})
