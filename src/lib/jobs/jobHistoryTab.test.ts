import { describe, expect, it } from 'vitest'
import {
  JOB_WINDOW_TABS,
  JOB_WINDOW_TAB_LABELS,
  jobHistoryChannelName,
  jobWindowFormPaneHidden,
  jobWindowFormRegionForTab,
  singleJobHistoryRange,
} from './jobHistoryTab'

describe('job window tabs (T5-05)', () => {
  it('Job · Edit · Bill · Costs · History, labelled', () => {
    expect(JOB_WINDOW_TABS).toEqual(['job', 'edit', 'bill', 'costs', 'history'])
    expect(JOB_WINDOW_TAB_LABELS.history).toBe('History')
    expect(JOB_WINDOW_TAB_LABELS.costs).toBe('Costs')
    // v2.3182: the form pane shows on Edit / Bill / Costs, one region each.
    expect(jobWindowFormPaneHidden('costs')).toBe(false)
    expect(jobWindowFormRegionForTab('costs')).toBe('costs')
    expect(jobWindowFormRegionForTab('bill')).toBe('bill')
    expect(jobWindowFormRegionForTab('edit')).toBe('edit')
    expect(jobWindowFormRegionForTab('job')).toBe('edit')
  })
  it('the form pane hides on Job and History, shows on Edit, Bill and Costs', () => {
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
