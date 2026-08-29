import { describe, expect, it } from 'vitest'
import { describeTwinRun, nextTwinSeat, relativeTimeFrom } from './twinConsoleDisplay'

describe('describeTwinRun', () => {
  it('mint via per-twin token resolves the key label', () => {
    const d = describeTwinRun(
      'mcp-mint',
      'mint via=token:24518a42-ebd0-4a5f-aac1-3919d73ad4a9 redirect=https://pipetooling.com/bids',
      (id) => (id.startsWith('24518a42') ? 'xAI harness' : null),
    )
    expect(d.verb).toBe('sign-in')
    expect(d.detail).toBe('via key “xAI harness” → /bids')
  })

  it('mint via token with no label falls back to the id prefix', () => {
    const d = describeTwinRun('twin-login', 'mint via=token:24518a42-ebd0-4a5f-aac1-3919d73ad4a9 redirect=-')
    expect(d.verb).toBe('sign-in')
    expect(d.detail).toBe('via key 24518a42…')
  })

  it('mint via master secret, dash redirect omitted', () => {
    const d = describeTwinRun('smoke-test-1', 'mint via=master redirect=-')
    expect(d.verb).toBe('sign-in')
    expect(d.detail).toBe('via master secret')
  })

  it('legacy mint note without via= still reads as a sign-in', () => {
    const d = describeTwinRun('smoke-test-1', 'mint redirect=https://pipetooling.com/bids?tab=board')
    expect(d.verb).toBe('sign-in')
    expect(d.detail).toBe('signed in → /bids?tab=board')
  })

  it('bare-origin redirect shows the host, not an empty slash', () => {
    const d = describeTwinRun('twin-login', 'mint via=master redirect=https://pipetooling.com/')
    expect(d.detail).toBe('via master secret → pipetooling.com')
  })

  it('report missions strip the prefix and carry the report text', () => {
    const d = describeTwinRun('report:M1', 'Found 1 lens bug; filed via help feedback.')
    expect(d).toEqual({ verb: 'report', mission: 'M1', detail: 'Found 1 lens bug; filed via help feedback.' })
  })

  it('report with empty mission name labels itself', () => {
    expect(describeTwinRun('report:', 'x').mission).toBe('unlabeled')
  })

  it('anything else passes through as a plain run', () => {
    const d = describeTwinRun('M2', 'custom note')
    expect(d).toEqual({ verb: 'run', mission: 'M2', detail: 'custom note' })
  })
})

describe('relativeTimeFrom', () => {
  const now = Date.parse('2026-08-28T12:00:00Z')
  it.each([
    ['2026-08-28T11:59:40Z', 'just now'],
    ['2026-08-28T11:35:00Z', '25m ago'],
    ['2026-08-28T09:00:00Z', '3h ago'],
    ['2026-08-27T05:00:00Z', 'yesterday'],
    ['2026-08-24T12:00:00Z', '4d ago'],
    ['2026-08-01T00:00:00Z', '2026-08-01'],
  ])('%s → %s', (iso, want) => {
    expect(relativeTimeFrom(iso, now)).toBe(want)
  })
  it('garbage passes through', () => {
    expect(relativeTimeFrom('not-a-date', now)).toBe('not-a-date')
  })
})

describe('nextTwinSeat', () => {
  it('first seat on an empty fleet', () => {
    expect(nextTwinSeat([])).toEqual({ n: 1, email: 'twin-estimator-1@twins.pipetooling.local' })
  })
  it('increments past the highest seat, ignoring non-fleet emails', () => {
    expect(
      nextTwinSeat(['twin-estimator-1@twins.pipetooling.local', 'twin-estimator-3@twins.pipetooling.local', 'robert@douglasmining.com']).n,
    ).toBe(4)
  })
})

describe('describeTwinRun — heartbeat rows (v2.2483)', () => {
  it('parses stage/state and frees the note', () => {
    const d = describeTwinRun('heartbeat', 'heartbeat stage=STG-3 takeoff state=working placing counters on P200', undefined)
    expect(d.verb).toBe('heartbeat')
    expect(d.mission).toBe('working')
    expect(d.detail).toContain('STG-3 takeoff')
    expect(d.detail).toContain('placing counters on P200')
  })
  it('blocked state surfaces as the mission', () => {
    const d = describeTwinRun('heartbeat', 'heartbeat stage=STG-2 state=blocked waiting on scale answer', undefined)
    expect(d.mission).toBe('blocked')
  })
})
