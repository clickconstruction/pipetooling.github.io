import { describe, expect, it } from 'vitest'
import {
  JOB_WINDOW_TABS,
  JOB_WINDOW_TAB_LABELS,
  jobHistoryChannelName,
  jobWindowFormPaneHidden,
  singleJobHistoryRange,
} from './jobHistoryTab'

describe('job window tabs (T5-05)', () => {
  it('History is the fourth tab, labelled', () => {
    expect(JOB_WINDOW_TABS).toEqual(['job', 'edit', 'bill', 'history'])
    expect(JOB_WINDOW_TAB_LABELS.history).toBe('History')
  })
  it('the form pane hides on Job and History, shows on Edit and Bill', () => {
    expect(jobWindowFormPaneHidden('job')).toBe(true)
    expect(jobWindowFormPaneHidden('history')).toBe(true)
    expect(jobWindowFormPaneHidden('edit')).toBe(false)
    expect(jobWindowFormPaneHidden('bill')).toBe(false)
  })
})

describe('single-job history', () => {
  it('looks back 180 days from today', () => {
    expect(singleJobHistoryRange('2026-09-06')).toEqual({ start: '2026-03-10', end: '2026-09-06' })
  })
  it('gives the job-window mount its own realtime channel', () => {
    expect(jobHistoryChannelName('u1', null)).toBe('projects-job-history-u1')
    expect(jobHistoryChannelName('u1', 'j9')).toBe('projects-job-history-u1-job-j9')
  })
})
