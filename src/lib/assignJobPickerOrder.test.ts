import { describe, expect, it } from 'vitest'
import { compareJobsByCreatedAtDesc } from './assignJobPickerOrder'

const j = (created_at: string | null, hcp_number: string | null = null) => ({ created_at, hcp_number })

describe('compareJobsByCreatedAtDesc', () => {
  it('orders newest created_at first', () => {
    const rows = [j('2026-06-05T10:00:00Z'), j('2026-08-03T10:00:00Z'), j('2026-07-21T10:00:00Z')]
    expect(rows.sort(compareJobsByCreatedAtDesc).map((r) => r.created_at)).toEqual([
      '2026-08-03T10:00:00Z',
      '2026-07-21T10:00:00Z',
      '2026-06-05T10:00:00Z',
    ])
  })

  it('fixes the text-descending trap: job 926 (new) beats job 97 (old)', () => {
    const rows = [j('2025-06-05T10:00:00Z', '97'), j('2026-08-03T10:00:00Z', '926')]
    expect(rows.sort(compareJobsByCreatedAtDesc).map((r) => r.hcp_number)).toEqual(['926', '97'])
  })

  it('sinks rows without a parseable date to the end', () => {
    const rows = [j(null, '5'), j('2026-08-03T10:00:00Z', '1'), j('garbage', '9')]
    expect(rows.sort(compareJobsByCreatedAtDesc).map((r) => r.hcp_number)).toEqual(['1', '9', '5'])
  })

  it('breaks created_at ties (and missing dates) by numeric-aware job number, newest first', () => {
    const t = '2026-08-03T10:00:00Z'
    const rows = [j(t, '97'), j(t, '926'), j(t, null)]
    expect(rows.sort(compareJobsByCreatedAtDesc).map((r) => r.hcp_number)).toEqual(['926', '97', null])
  })
})
