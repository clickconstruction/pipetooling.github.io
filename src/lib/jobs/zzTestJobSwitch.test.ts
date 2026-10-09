// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest'
import { act, renderHook } from '@testing-library/react'
import {
  readDevShowsZzTestJobs,
  setDevShowsZzTestJobs,
  useDevShowsZzTestJobs,
  useZzTestJobsHidden,
  ZZ_TEST_JOBS_SHOWN_STORAGE_KEY,
} from './zzTestJobSwitch'

// Punch list #61 (v2.5120): the dev's switch, per device, hidden by default.
afterEach(() => localStorage.removeItem(ZZ_TEST_JOBS_SHOWN_STORAGE_KEY))

describe('the ZZ test jobs switch', () => {
  it('reads hidden by default, and keeps a show per device', () => {
    expect(readDevShowsZzTestJobs()).toBe(false)
    setDevShowsZzTestJobs(true)
    expect(localStorage.getItem(ZZ_TEST_JOBS_SHOWN_STORAGE_KEY)).toBe('1')
    expect(readDevShowsZzTestJobs()).toBe(true)
    setDevShowsZzTestJobs(false)
    expect(localStorage.getItem(ZZ_TEST_JOBS_SHOWN_STORAGE_KEY)).toBeNull()
  })

  it('moves every reader in the tab at once, and follows a flip made in another tab', () => {
    const a = renderHook(() => useDevShowsZzTestJobs())
    const b = renderHook(() => useZzTestJobsHidden('dev'))
    expect(a.result.current).toBe(false)
    expect(b.result.current).toBe(true)
    act(() => setDevShowsZzTestJobs(true))
    expect(a.result.current).toBe(true)
    expect(b.result.current).toBe(false)
    act(() => {
      localStorage.removeItem(ZZ_TEST_JOBS_SHOWN_STORAGE_KEY)
      window.dispatchEvent(new StorageEvent('storage', { key: ZZ_TEST_JOBS_SHOWN_STORAGE_KEY }))
    })
    expect(a.result.current).toBe(false)
  })

  it('never shows them to another role, whatever the device says', () => {
    setDevShowsZzTestJobs(true)
    const h = renderHook(() => useZzTestJobsHidden('assistant'))
    expect(h.result.current).toBe(true)
  })
})
