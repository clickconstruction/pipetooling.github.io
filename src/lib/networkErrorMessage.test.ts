import { describe, expect, it } from 'vitest'
import { isNetworkFetchErrorMessage, OFFLINE_ERROR_MESSAGE } from './networkErrorMessage'

describe('isNetworkFetchErrorMessage', () => {
  it('recognizes the per-engine fetch failure signatures, wrapped or bare', () => {
    expect(isNetworkFetchErrorMessage('TypeError: Load failed')).toBe(true)
    expect(isNetworkFetchErrorMessage('Failed to insert jobs_ledger_thread_note modal: TypeError: Load failed')).toBe(true)
    expect(isNetworkFetchErrorMessage('TypeError: Failed to fetch')).toBe(true)
    expect(isNetworkFetchErrorMessage('NetworkError when attempting to fetch resource.')).toBe(true)
    expect(isNetworkFetchErrorMessage('The Internet connection appears to be offline.')).toBe(true)
  })
  it('leaves real server/database errors alone', () => {
    expect(isNetworkFetchErrorMessage('new row violates row-level security policy for table "people"')).toBe(false)
    expect(isNetworkFetchErrorMessage('duplicate key value violates unique constraint')).toBe(false)
    expect(isNetworkFetchErrorMessage('')).toBe(false)
    expect(isNetworkFetchErrorMessage(null)).toBe(false)
    expect(isNetworkFetchErrorMessage(undefined)).toBe(false)
  })
  it('exports a plain-language message', () => {
    expect(OFFLINE_ERROR_MESSAGE).toMatch(/No connection/)
    expect(OFFLINE_ERROR_MESSAGE).not.toMatch(/TypeError|fetch/i)
  })
})
