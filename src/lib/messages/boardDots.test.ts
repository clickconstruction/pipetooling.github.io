import { describe, expect, it } from 'vitest'
import type { QueueContact } from '../followUp/queue'
import { boardDotsByJob, boardDotTitle, type BoardDotLine } from './boardDots'

const NOW = new Date('2026-10-12T20:00:00Z')
const TODAY = '2026-10-12'
const dana: QueueContact = { id: 'c-dana', kind: 'customer', name: 'Dana Whitfield', state: 'waiting' }
const luis: QueueContact = { id: 'c-luis', kind: 'customer', name: 'Luis Ortega', goesBy: 'Lu', state: 'waiting' }
const line = (p: Partial<BoardDotLine> & Pick<BoardDotLine, 'id' | 'at'>): BoardDotLine => ({
  contactId: 'c-dana',
  jobId: 'job-1312',
  channel: 'text',
  direction: 'in',
  subject: null,
  body: 'Can you do Thursday?\nAlso is the water heater quote still good?',
  backOn: null,
  backBy: null,
  ...p,
})
const ASK = line({ id: 'm-ask', at: '2026-10-12T14:05:00Z' })

describe('boardDotsByJob', () => {
  it('puts a job on the map when its customer waits with their newest line on it, the hover in parts', () => {
    const dots = boardDotsByJob([dana], [ASK], TODAY, NOW)
    expect([...dots.keys()]).toEqual(['job-1312'])
    expect(dots.get('job-1312')).toEqual({ who: 'Dana', channel: 'text', when: '9:05 AM', line: 'Can you do Thursday?', status: 'Nobody has answered.' })
  })

  it('marks nothing when their newest line is tied to no job, though an older one is on the job', () => {
    const older = line({ id: 'm-old', at: '2026-10-11T14:05:00Z' })
    const newest = line({ id: 'm-new', at: '2026-10-12T14:05:00Z', jobId: null, body: 'Also, thanks!' })
    expect(boardDotsByJob([dana], [older, newest], TODAY, NOW).size).toBe(0)
  })

  it('marks nothing for a conversation done or snoozed ahead, and marks one whose snooze day has come', () => {
    expect(boardDotsByJob([{ ...dana, state: 'done' }], [ASK], TODAY, NOW).size).toBe(0)
    expect(boardDotsByJob([{ ...dana, state: 'snoozed', snoozedUntil: '2026-10-13' }], [ASK], TODAY, NOW).size).toBe(0)
    expect(boardDotsByJob([{ ...dana, state: 'snoozed', snoozedUntil: '2026-10-12' }], [ASK], TODAY, NOW).has('job-1312')).toBe(true)
  })

  it('gives one job the person waiting longest, by the name they go by', () => {
    const lu = line({ id: 'm-lu', at: '2026-10-12T13:00:00Z', contactId: 'c-luis', channel: 'email', subject: 'Gate code', body: 'The gate code is 4411.' })
    const dots = boardDotsByJob([dana, luis], [ASK, lu], TODAY, NOW)
    expect(dots.get('job-1312')).toMatchObject({ who: 'Lu', channel: 'email', when: '8:00 AM', line: 'Gate code' })
  })

  it('maps each job once across people and jobs', () => {
    const lu = line({ id: 'm-lu', at: '2026-10-12T13:00:00Z', contactId: 'c-luis', jobId: 'job-2200', body: 'Running late.' })
    const dots = boardDotsByJob([dana, luis], [ASK, lu], TODAY, NOW)
    expect([...dots.keys()].sort()).toEqual(['job-1312', 'job-2200'])
    expect(dots.get('job-2200')?.who).toBe('Lu')
  })
})

describe('boardDotTitle', () => {
  it('joins the hover’s parts side by side and skips an empty one', () => {
    expect(boardDotTitle({ who: 'Dana', channel: 'text', when: '9:05 AM', line: 'Can you do Thursday?', status: 'Nobody has answered.' })).toBe(
      'Dana · text · 9:05 AM · Can you do Thursday? · Nobody has answered.',
    )
    expect(boardDotTitle({ who: '', channel: 'missed call', when: 'yesterday', line: '', status: 'Nobody has answered.' })).toBe('missed call · yesterday · Nobody has answered.')
  })
})
