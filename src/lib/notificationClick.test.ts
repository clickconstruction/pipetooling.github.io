import { describe, expect, it } from 'vitest'
import { notificationClickHref, notificationClickWindow } from './notificationClick'

const ORIGIN = 'https://clicktooling.com'

describe('notificationClickHref', () => {
  it('resolves the paths the server pushes send against the worker origin', () => {
    expect(notificationClickHref('/checklist', ORIGIN)).toBe('https://clicktooling.com/checklist')
    expect(notificationClickHref('/bids?tab=counts&bidId=abc', ORIGIN)).toBe('https://clicktooling.com/bids?tab=counts&bidId=abc')
    expect(notificationClickHref('/jobs?tab=stages&edit=j1&editFocus=payments', ORIGIN)).toBe(
      'https://clicktooling.com/jobs?tab=stages&edit=j1&editFocus=payments',
    )
  })

  it('keeps a full link as it is — the workflow pushes, and a link to another origin', () => {
    expect(notificationClickHref('https://clicktooling.com/workflows/p1#step-s2', ORIGIN)).toBe('https://clicktooling.com/workflows/p1#step-s2')
    expect(notificationClickHref('https://pipetooling.com/dashboard', ORIGIN)).toBe('https://pipetooling.com/dashboard')
    expect(notificationClickHref('http://localhost:5173/dashboard', 'http://localhost:5173')).toBe('http://localhost:5173/dashboard')
  })

  it('falls back to the app home when the url is missing, unparseable or not a web link', () => {
    for (const url of [undefined, null, 42, {}, '', 'http://', 'javascript:alert(1)', 'mailto:team@example.com']) {
      expect(notificationClickHref(url, ORIGIN)).toBe('https://clicktooling.com/')
    }
  })
})

describe('notificationClickWindow', () => {
  const win = (url: string) => ({ url })

  it('reuses a window already on the page, even when another was focused more recently', () => {
    const dashboard = win('https://clicktooling.com/dashboard')
    const checklist = win('https://clicktooling.com/checklist')
    expect(notificationClickWindow([dashboard, checklist], 'https://clicktooling.com/checklist')).toBe(checklist)
  })

  it('else reuses the first app window, the most recently focused', () => {
    const bids = win('https://clicktooling.com/bids')
    const jobs = win('https://clicktooling.com/jobs')
    expect(notificationClickWindow([bids, jobs], 'https://clicktooling.com/checklist')).toBe(bids)
  })

  it('opens a new window when none is open, or when the link is on another origin', () => {
    expect(notificationClickWindow([], 'https://clicktooling.com/checklist')).toBeUndefined()
    expect(notificationClickWindow([win('https://clicktooling.com/jobs')], 'https://pipetooling.com/dashboard')).toBeUndefined()
  })

  it('never throws on a bad url', () => {
    expect(notificationClickWindow([win('not a url'), win('https://clicktooling.com/jobs')], 'https://clicktooling.com/x')?.url).toBe(
      'https://clicktooling.com/jobs',
    )
    expect(notificationClickWindow([win('https://clicktooling.com/jobs')], '/checklist')).toBeUndefined()
  })
})
