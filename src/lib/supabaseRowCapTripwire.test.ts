import { describe, expect, it, vi } from 'vitest'
import {
  detectRowCap,
  makeConsoleRowCapReporter,
  parseContentRange,
  restTableFromUrl,
  wrapFetchWithRowCapTripwire,
  type RowCapFinding,
} from './supabaseRowCapTripwire'

const BASE = 'https://proj.supabase.co/rest/v1/'

describe('restTableFromUrl', () => {
  it('names tables and set-returning rpcs, ignores everything else', () => {
    expect(restTableFromUrl(`${BASE}material_parts?select=*`)).toBe('material_parts')
    expect(restTableFromUrl(`${BASE}rpc/list_unlabeled_mercury_transactions`)).toBe('rpc:list_unlabeled_mercury_transactions')
    expect(restTableFromUrl('https://proj.supabase.co/auth/v1/token')).toBeNull()
    expect(restTableFromUrl('https://proj.supabase.co/functions/v1/dev-login')).toBeNull()
  })
})

describe('parseContentRange', () => {
  it('reads PostgREST ranges', () => {
    expect(parseContentRange('0-999/*')).toEqual({ rows: 1000, total: null })
    expect(parseContentRange('0-999/1713')).toEqual({ rows: 1000, total: 1713 })
    expect(parseContentRange('0-4/5')).toEqual({ rows: 5, total: 5 })
    expect(parseContentRange('*/0')).toEqual({ rows: 0, total: 0 })
    expect(parseContentRange(null)).toBeNull()
    expect(parseContentRange('bytes 0-99/100')).toBeNull()
  })
})

describe('detectRowCap', () => {
  const capped = { url: `${BASE}material_parts?select=*&service_type_id=eq.x&order=name.asc`, method: 'GET', contentRange: '0-999/*' }

  it('flags an un-limited read that came back with exactly max_rows rows', () => {
    expect(detectRowCap(capped)).toEqual({
      table: 'material_parts',
      rows: 1000,
      path: '/rest/v1/material_parts?select=*&service_type_id=eq.x&order=name.asc',
    })
  })

  it('stays quiet for paged reads (limit/offset params from .range() and .limit())', () => {
    expect(detectRowCap({ ...capped, url: `${capped.url}&offset=0&limit=1000` })).toBeNull()
    expect(detectRowCap({ ...capped, url: `${capped.url}&limit=1000` })).toBeNull()
  })

  it('stays quiet when the response is short, or exactly 1000 with a known total of 1000', () => {
    expect(detectRowCap({ ...capped, contentRange: '0-998/*' })).toBeNull()
    expect(detectRowCap({ ...capped, contentRange: '0-999/1000' })).toBeNull()
    expect(detectRowCap({ ...capped, contentRange: '*/0' })).toBeNull()
    expect(detectRowCap({ ...capped, contentRange: null })).toBeNull()
  })

  it('flags exactly 1000 rows with a known LARGER total (count: exact, no limit)', () => {
    expect(detectRowCap({ ...capped, contentRange: '0-999/1713' })?.rows).toBe(1000)
  })

  it('covers set-returning rpcs but not writes or non-REST urls', () => {
    expect(detectRowCap({ url: `${BASE}rpc/big_report`, method: 'POST', contentRange: '0-999/*' })?.table).toBe('rpc:big_report')
    expect(detectRowCap({ url: `${BASE}material_parts`, method: 'POST', contentRange: '0-999/*' })).toBeNull()
    expect(detectRowCap({ url: `${BASE}material_parts`, method: 'PATCH', contentRange: '0-999/*' })).toBeNull()
    expect(detectRowCap({ url: 'https://proj.supabase.co/auth/v1/user', method: 'GET', contentRange: '0-999/*' })).toBeNull()
  })

  it('honors a custom cap', () => {
    expect(detectRowCap({ ...capped, contentRange: '0-49/*' }, 50)?.rows).toBe(50)
  })
})

function fakeResponse(contentRange: string | null): Response {
  return new Response('[]', { status: 200, headers: contentRange ? { 'content-range': contentRange } : {} })
}

describe('wrapFetchWithRowCapTripwire', () => {
  it('reports a capped response and returns the response untouched', async () => {
    const res = fakeResponse('0-999/*')
    const base = vi.fn(async () => res)
    const report = vi.fn()
    const wrapped = wrapFetchWithRowCapTripwire(base, report)
    const got = await wrapped(`${BASE}people_hours?select=*`, { method: 'GET' })
    expect(got).toBe(res)
    expect(report).toHaveBeenCalledTimes(1)
    expect((report.mock.calls[0]![0] as RowCapFinding).table).toBe('people_hours')
  })

  it('reads the method and url from a Request object and stays quiet on short pages', async () => {
    const base = vi.fn(async () => fakeResponse('0-9/*'))
    const report = vi.fn()
    const wrapped = wrapFetchWithRowCapTripwire(base, report)
    await wrapped(new Request(`${BASE}jobs_ledger?select=id`))
    expect(report).not.toHaveBeenCalled()
  })

  it('never lets a reporter failure break the query', async () => {
    const res = fakeResponse('0-999/*')
    const wrapped = wrapFetchWithRowCapTripwire(async () => res, () => { throw new Error('boom') })
    await expect(wrapped(`${BASE}bids?select=*`)).resolves.toBe(res)
  })
})

describe('makeConsoleRowCapReporter', () => {
  it('logs once per table per session with the fix in the message', () => {
    const log = vi.fn()
    const report = makeConsoleRowCapReporter(log)
    const f: RowCapFinding = { table: 'material_parts', rows: 1000, path: '/rest/v1/material_parts' }
    report(f)
    report(f)
    report({ ...f, table: 'people_hours' })
    expect(log).toHaveBeenCalledTimes(2)
    expect(log.mock.calls[0]![0]).toContain('[row-cap] material_parts')
    expect(log.mock.calls[0]![0]).toContain('fetchAllRows')
  })
})
