import { describe, expect, it } from 'vitest'
import { pairKey, verdictWords, verdictsByPair } from './jobCallbacks'

describe('jobCallbacks', () => {
  it('keys a pair, maps the verdicts, and reads the chip', () => {
    const rows = [
      { first_job_id: 'a', second_job_id: 'b', verdict: 'callback' as const, decided_by_name: 'Rosa Office', decided_at: '2026-11-06T20:00:00Z' },
      { first_job_id: 'c', second_job_id: 'd', verdict: 'not_callback' as const, decided_by_name: '', decided_at: 'bad' },
    ]
    const m = verdictsByPair(rows)
    expect(m.get(pairKey('a', 'b'))?.verdict).toBe('callback')
    expect(verdictWords(rows[0]!)).toBe('Callback · Rosa Office · Nov 6')
    expect(verdictWords(rows[1]!)).toBe('Not a callback · the office')
  })
})
