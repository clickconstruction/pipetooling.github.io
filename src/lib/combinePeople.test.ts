import { describe, expect, it } from 'vitest'
import { LABOR_ASSIGNED_DELIMITER, NAME_KEYED_TABLES, PERSON_ID_TABLES, replaceNameInAssignedList } from './combinePeople'

describe('combine table coverage', () => {
  it('covers all ten name-keyed pay/labor tables (Phase B + B2 inventory)', () => {
    // Mirrors migrations 20260722268000 (B: first five) + 20260722270000 (B2:
    // last five). A table missing here means a combine leaves its rows behind.
    expect([...NAME_KEYED_TABLES].sort()).toEqual(
      [
        'people_pay_config',
        'people_hours',
        'people_team_members',
        'people_hours_display_order',
        'people_crew_jobs',
        'people_crew_bids',
        'pay_stubs',
        'pay_stub_days',
        'person_offsets',
        'hours_reviewed',
      ].sort(),
    )
  })

  it('repoints person_id on every name-keyed table (all carry person_id since B2)', () => {
    // v2.1111 regression pin: PERSON_ID_TABLES was the original Phase-B five,
    // so combines left the five B2 tables pointing at the archived duplicate
    // (masked by name fallback — until Phase E removes fallback).
    expect(PERSON_ID_TABLES).toEqual(NAME_KEYED_TABLES)
  })
})

describe('replaceNameInAssignedList', () => {
  it('replaces an exact segment case-insensitively, preserving others', () => {
    expect(replaceNameInAssignedList('Behar Kraja (Rough In) | Jesse', 'behar kraja (rough in)', 'Behar Kraja')).toBe(
      `Behar Kraja${LABOR_ASSIGNED_DELIMITER}Jesse`,
    )
  })

  it('drops the segment instead of duplicating when the new name is already present', () => {
    expect(replaceNameInAssignedList('Behar Kraja (Rough In) | Behar Kraja', 'Behar Kraja (Rough In)', 'Behar Kraja')).toBe('Behar Kraja')
  })

  it('never partial-matches inside another segment', () => {
    expect(replaceNameInAssignedList('Behar Kraja Sr | Jesse', 'Behar Kraja', 'X')).toBeNull()
  })

  it('returns null when the name is absent or the list is empty', () => {
    expect(replaceNameInAssignedList('Jesse | Paige', 'Behar', 'X')).toBeNull()
    expect(replaceNameInAssignedList('', 'Behar', 'X')).toBeNull()
    expect(replaceNameInAssignedList(null, 'Behar', 'X')).toBeNull()
  })

  it('handles a single-name list and trims whitespace', () => {
    expect(replaceNameInAssignedList('  Behar Kraja (Rough In)  ', 'Behar Kraja (Rough In)', 'Behar Kraja')).toBe('Behar Kraja')
  })
})
