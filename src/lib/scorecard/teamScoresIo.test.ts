import { beforeEach, describe, expect, it, vi } from 'vitest'
import { FunctionsFetchError, FunctionsHttpError } from '@supabase/functions-js'

const invoke = vi.fn()
vi.mock('../supabase', () => ({ supabase: { functions: { invoke: (name: string, opts: unknown) => invoke(name, opts) } } }))

import { buildEstimatorScore } from './estimatorScore'
import { buildFieldScore } from './fieldScore'
import { buildHurdle, DEFAULT_HURDLE_SETTING } from './hurdle'
import type { ScorecardRead } from './scorecardReads'
import { estimatorScoresToWire, scorecardToWire } from './scorecardWire'
import { fetchEstimatorScores, fetchTeamScores, teamScoresIsMissing } from './teamScoresIo'

const hurdle = buildHurdle({ overheadUsd: 22_000, paidFieldHours: 1_000, windowDays: 56, setting: DEFAULT_HURDLE_SETTING })
const read: ScorecardRead = {
  fromYmd: '2026-09-21',
  toYmd: '2026-11-15',
  todayYmd: '2026-11-15',
  windowDays: 56,
  burden: 1.2,
  setting: DEFAULT_HURDLE_SETTING,
  hurdle,
  field: buildFieldScore({ jobs: [], burden: 1.2, hurdle }),
  ownersByJob: new Map(),
  estimator: buildEstimatorScore({ bids: [], hurdle, fromYmd: '2026-09-21', toYmd: '2026-11-15', todayYmd: '2026-11-15' }),
  pendingFieldHours: 0,
  actualsUnread: 0,
}

const refusal = (status: number, body: unknown) => new FunctionsHttpError(new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } }))

beforeEach(() => invoke.mockReset())

describe('fetchTeamScores', () => {
  it('asks team-scores for the window and reads the scores back', async () => {
    invoke.mockResolvedValue({ data: { ok: true, scores: JSON.parse(JSON.stringify(scorecardToWire(read))) }, error: null })
    const answer = await fetchTeamScores(56)
    expect(invoke).toHaveBeenCalledWith('team-scores', { body: { windowDays: 56 } })
    expect(answer).toEqual({ kind: 'scores', read })
  })

  it('a function that is not deployed is missing, not a failure: the page reads as before', async () => {
    invoke.mockResolvedValue({ data: null, error: refusal(404, { code: 'NOT_FOUND', message: 'Requested function was not found' }) })
    expect(await fetchTeamScores(56)).toEqual({ kind: 'missing' })
  })

  it('a browser never sees that 404: the gateway sends no CORS headers, so the request fails, and that is missing too', async () => {
    const blocked = new FunctionsFetchError(new TypeError('Failed to fetch'))
    expect(teamScoresIsMissing(blocked)).toBe(true)
    invoke.mockResolvedValue({ data: null, error: blocked })
    expect(await fetchTeamScores(56)).toEqual({ kind: 'missing' })
    expect(await fetchEstimatorScores(56, 'mine')).toEqual({ kind: 'missing' })
    expect(teamScoresIsMissing(refusal(403, {}))).toBe(false)
    expect(teamScoresIsMissing(new Error('network'))).toBe(false)
  })

  it('the function’s own refusal is shown in its words', async () => {
    invoke.mockResolvedValue({ data: null, error: refusal(403, { ok: false, error: 'The scores are for the owner, a dev and whoever has payroll access.' }) })
    await expect(fetchTeamScores(56)).rejects.toThrow('The scores are for the owner, a dev and whoever has payroll access.')
    invoke.mockResolvedValue({ data: null, error: new Error('Failed to send a request to the Edge Function') })
    await expect(fetchTeamScores(56)).rejects.toThrow('The scores could not be read.')
  })

  it('an answer that is not a scorecard is refused, never drawn', async () => {
    invoke.mockResolvedValue({ data: { ok: true, scores: { nothing: true } }, error: null })
    await expect(fetchTeamScores(56)).rejects.toThrow(/shape this page does not read/)
  })
})

describe('fetchEstimatorScores (PR 5)', () => {
  const estimating = () => JSON.parse(JSON.stringify(estimatorScoresToWire({ fromYmd: read.fromYmd, toYmd: read.toYmd, todayYmd: read.todayYmd, windowDays: 56, hurdle, estimator: read.estimator, actualsUnread: 0 }, 'mine')))

  it('asks for the view and reads the estimating score back', async () => {
    invoke.mockResolvedValue({ data: { ok: true, estimating: estimating() }, error: null })
    const answer = await fetchEstimatorScores(56, 'mine')
    expect(invoke).toHaveBeenCalledWith('team-scores', { body: { windowDays: 56, view: 'mine' } })
    expect(answer.kind).toBe('scores')
    if (answer.kind === 'scores') expect(answer.read.hurdlePerHourUsd).toBe(47)
  })

  it('a function not deployed, or one older than the view, is missing: no row and no chips', async () => {
    invoke.mockResolvedValue({ data: null, error: refusal(404, { code: 'NOT_FOUND' }) })
    expect(await fetchEstimatorScores(56, 'bids')).toEqual({ kind: 'missing' })
    invoke.mockResolvedValue({ data: { ok: true, scores: JSON.parse(JSON.stringify(scorecardToWire(read))) }, error: null })
    expect(await fetchEstimatorScores(56, 'bids')).toEqual({ kind: 'missing' })
  })

  it('a refusal is the function’s own word', async () => {
    invoke.mockResolvedValue({ data: null, error: refusal(403, { ok: false, error: 'The scores are for the owner, a dev and whoever has payroll access.' }) })
    await expect(fetchEstimatorScores(56, 'bids')).rejects.toThrow('The scores are for the owner')
  })
})
