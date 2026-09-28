import { describe, expect, it, vi } from 'vitest'
import {
  jobFormAutosaveAggregate,
  jobFormAutosaveStatusColor,
  jobFormAutosaveStatusWords,
  jobFormFooterShowsDelete,
  type JobFormAutosaveAggregate,
} from './jobFormFooter'

const slice = (status: string, dirty = false) => ({ status, isDirty: () => dirty })

describe('jobFormAutosaveAggregate', () => {
  it('is saved when no slice is writing, failed, blocked or dirty', () => {
    expect(jobFormAutosaveAggregate([slice('idle'), slice('saved'), slice('idle'), slice('idle')], false)).toBe('saved')
    expect(jobFormAutosaveAggregate([], false)).toBe('saved')
  })

  it('a write in flight outranks everything else', () => {
    expect(jobFormAutosaveAggregate([slice('error', true), slice('saving')], true)).toBe('saving')
  })

  it('a failed save outranks blocked and pending', () => {
    expect(jobFormAutosaveAggregate([slice('idle', true), slice('error')], true)).toBe('error')
  })

  it('blocked outranks pending', () => {
    expect(jobFormAutosaveAggregate([slice('idle', true)], true)).toBe('blocked')
  })

  it('pending when any slice is dirty', () => {
    expect(jobFormAutosaveAggregate([slice('idle'), slice('saved', true)], false)).toBe('pending')
  })

  it('does not ask a slice whether it is dirty once a worse state answered', () => {
    const isDirty = vi.fn(() => true)
    expect(jobFormAutosaveAggregate([{ status: 'saving', isDirty }], false)).toBe('saving')
    expect(jobFormAutosaveAggregate([{ status: 'error', isDirty }], false)).toBe('error')
    expect(jobFormAutosaveAggregate([{ status: 'idle', isDirty }], true)).toBe('blocked')
    expect(isDirty).not.toHaveBeenCalled()
  })
})

describe('jobFormAutosaveStatusWords / Color', () => {
  it('says each state in the footer’s words', () => {
    const words: Record<JobFormAutosaveAggregate, string> = {
      saving: 'Saving…',
      error: 'Autosave failed — edit the field again to retry',
      blocked: 'Waiting on required fields',
      pending: 'Unsaved changes…',
      saved: 'All changes saved',
    }
    for (const [state, expected] of Object.entries(words)) {
      expect(jobFormAutosaveStatusWords(state as JobFormAutosaveAggregate)).toBe(expected)
    }
  })

  it('is red on a failure, green when saved, muted otherwise', () => {
    expect(jobFormAutosaveStatusColor('error')).toBe('var(--text-red-600)')
    expect(jobFormAutosaveStatusColor('saved')).toBe('var(--text-green-600)')
    expect(jobFormAutosaveStatusColor('saving')).toBe('var(--text-muted)')
    expect(jobFormAutosaveStatusColor('blocked')).toBe('var(--text-muted)')
    expect(jobFormAutosaveStatusColor('pending')).toBe('var(--text-muted)')
  })
})

describe('jobFormFooterShowsDelete', () => {
  it('never on a new job', () => {
    expect(jobFormFooterShowsDelete({ editing: false, role: 'dev', embedded: false, embeddedRegion: null })).toBe(false)
  })

  it('every role but primary in the standalone form', () => {
    for (const role of ['dev', 'master_technician', 'assistant', 'controller', 'superintendent', null, undefined]) {
      expect(jobFormFooterShowsDelete({ editing: true, role, embedded: false, embeddedRegion: null })).toBe(true)
    }
    expect(jobFormFooterShowsDelete({ editing: true, role: 'primary', embedded: false, embeddedRegion: null })).toBe(false)
  })

  it('in the Job window, on the Edit region only', () => {
    expect(jobFormFooterShowsDelete({ editing: true, role: 'dev', embedded: true, embeddedRegion: 'edit' })).toBe(true)
    expect(jobFormFooterShowsDelete({ editing: true, role: 'dev', embedded: true, embeddedRegion: 'bill' })).toBe(false)
    expect(jobFormFooterShowsDelete({ editing: true, role: 'dev', embedded: true, embeddedRegion: 'costs' })).toBe(false)
    expect(jobFormFooterShowsDelete({ editing: true, role: 'primary', embedded: true, embeddedRegion: 'edit' })).toBe(false)
  })
})
