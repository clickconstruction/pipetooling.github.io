import { describe, expect, it } from 'vitest'
import { checklistJobLinkLabel, composeChecklistJobTitle } from '../checklistJobPreset'
import { plainWordsFailures } from '../plainWords'
import { newestLineIn, SEND_AS_TASK, THREAD_TASK_NAME_MAX, threadTaskPreset } from './threadTask'

describe('threadTaskPreset (v2.6228)', () => {
  const dale = { id: 'c-dale', name: 'Dale Ferris', company: 'Hill Country Supply' }
  const line = { id: 'm-1', channel: 'email' as const, subject: 'W-9 and certificate of insurance needed', body: 'Please send both for your account.' }

  it('puts the thread on the bar: the channel, the person and the line’s words, the company under, the thread as link [1]', () => {
    const preset = threadTaskPreset(dale, line, 'https://clicktooling.com')
    expect(preset.title).toBe('')
    expect(preset.job.number).toBe('Email')
    expect(preset.job.name).toBe('Dale Ferris · W-9 and certificate of insurance needed')
    expect(preset.job.customer).toBe('Hill Country Supply')
    expect(preset.job.path).toBe('/gc?view=messages&thread=c-dale&at=m-1')
    expect(preset.job.url).toBe('https://clicktooling.com/gc?view=messages&thread=c-dale&at=m-1')
    expect(preset.links).toEqual([preset.job.url])
    // What Send stores, the job doors' shape unchanged.
    expect(composeChecklistJobTitle(preset.job, 'Send our W-9 and COI')).toBe('{{1:Email · Dale Ferris · W-9 and certificate of insurance needed}} — Send our W-9 and COI')
  })

  it('a thread with no line in: Thread, the person alone, the thread as the link', () => {
    const preset = threadTaskPreset({ id: 'c-x', name: 'Someone', company: '' }, null, 'https://clicktooling.com')
    expect(checklistJobLinkLabel(preset.job)).toBe('Thread · Someone')
    expect(preset.job.customer).toBeNull()
    expect(preset.job.path).toBe('/gc?view=messages&thread=c-x')
  })

  it('clips a long line to one row', () => {
    const preset = threadTaskPreset(dale, { ...line, subject: 'x'.repeat(200) }, '')
    expect(preset.job.name.length).toBeLessThanOrEqual(THREAD_TASK_NAME_MAX)
  })

  it('finds the newest line in', () => {
    const lines = [
      { id: 'a', contactId: 'c', direction: 'in' },
      { id: 'b', contactId: 'c', direction: 'out' },
      { id: 'c', contactId: 'd', direction: 'in' },
      { id: 'd', contactId: 'c', direction: 'in' },
    ]
    expect(newestLineIn(lines, 'c')?.id).toBe('d')
    expect(newestLineIn(lines, 'e')).toBeNull()
  })

  it('writes plain words', () => {
    expect(plainWordsFailures(SEND_AS_TASK.tip)).toEqual([])
  })
})
