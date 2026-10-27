import { FunctionsFetchError } from '@supabase/supabase-js'
import { describe, expect, it } from 'vitest'
import { isFetchLayerTypeError, isNetworkFetchErrorMessage, OFFLINE_ERROR_MESSAGE } from './networkErrorMessage'

describe('isNetworkFetchErrorMessage', () => {
  it('recognizes the per-engine fetch failure signatures, wrapped or bare', () => {
    expect(isNetworkFetchErrorMessage('TypeError: Load failed')).toBe(true)
    expect(isNetworkFetchErrorMessage('Failed to insert jobs_ledger_thread_note modal: TypeError: Load failed')).toBe(true)
    expect(isNetworkFetchErrorMessage('TypeError: Failed to fetch')).toBe(true)
    expect(isNetworkFetchErrorMessage('NetworkError when attempting to fetch resource.')).toBe(true)
    expect(isNetworkFetchErrorMessage('The Internet connection appears to be offline.')).toBe(true)
  })
  it('does not read the app\'s own "Failed to <operation>:" prefix as the engine signature (J18-N1)', () => {
    // ~100 operations are named `fetch…`; their DatabaseError message starts
    // "Failed to fetch<Op>: …", which used to match the `failed to fetch` token.
    expect(isNetworkFetchErrorMessage('Failed to fetchScheduleJobContext: invalid input syntax for type uuid: "bid:…"')).toBe(false)
    expect(isNetworkFetchErrorMessage('Failed to fetch bid for preview: permission denied for table bids')).toBe(false)
    expect(isNetworkFetchErrorMessage('Failed to fetch common jobs: column does not exist')).toBe(false)
    // …while the real engine signature, bare or wrapped at the END of a message, still counts.
    expect(isNetworkFetchErrorMessage('Failed to fetch')).toBe(true)
    expect(isNetworkFetchErrorMessage('Failed to fetch.')).toBe(true)
    expect(isNetworkFetchErrorMessage('Failed to fetch bid for preview: TypeError: Failed to fetch')).toBe(true)
  })
  it('recognizes the fetch-layer TypeError by class + signature', () => {
    expect(isFetchLayerTypeError(new TypeError('Failed to fetch'))).toBe(true)
    expect(isFetchLayerTypeError(new TypeError('Load failed'))).toBe(true)
    expect(isFetchLayerTypeError(new TypeError('x is not a function'))).toBe(false)
    expect(isFetchLayerTypeError(new Error('Failed to fetch'))).toBe(false)
    expect(isFetchLayerTypeError('Failed to fetch')).toBe(false)
  })
  it('counts an edge function invoke whose fetch rejected, never one that was aborted (v2.5986)', () => {
    expect(isFetchLayerTypeError(new FunctionsFetchError(new TypeError('Load failed')))).toBe(true)
    expect(isFetchLayerTypeError(new FunctionsFetchError(new TypeError('Failed to fetch')))).toBe(true)
    // A timed-out or cancelled invoke may have landed, so it is not "nothing was saved".
    expect(isFetchLayerTypeError(new FunctionsFetchError(new DOMException('The operation was aborted.', 'AbortError')))).toBe(false)
    expect(isFetchLayerTypeError(new FunctionsFetchError(new TypeError('x is not a function')))).toBe(false)
    // The name alone is not enough: only what the wrapper carries decides.
    expect(isFetchLayerTypeError(Object.assign(new Error('Failed to send a request to the Edge Function'), { name: 'FunctionsFetchError' }))).toBe(false)
    expect(isFetchLayerTypeError({ name: 'FunctionsFetchError', context: new TypeError('Failed to fetch') })).toBe(false)
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
