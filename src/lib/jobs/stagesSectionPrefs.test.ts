import { describe, expect, it } from 'vitest'
import {
  readStagesSectionOpenPrefs,
  scopesForOpenStagesSections,
  STAGES_SECTION_DEFAULT_OPEN,
  writeStagesSectionOpenPrefs,
} from './stagesSectionPrefs'

function memStorage(initial: Record<string, string> = {}) {
  const m = new Map(Object.entries(initial))
  return {
    getItem: (k: string) => m.get(k) ?? null,
    setItem: (k: string, v: string) => void m.set(k, v),
  }
}

describe('stages section prefs', () => {
  it('fresh device: Ready to Bill only', () => {
    expect(readStagesSectionOpenPrefs(memStorage())).toEqual(STAGES_SECTION_DEFAULT_OPEN)
    expect(STAGES_SECTION_DEFAULT_OPEN.readyToBill).toBe(true)
    expect(STAGES_SECTION_DEFAULT_OPEN.working).toBe(false)
  })

  it('round-trips explicit picks; malformed values fall back per-key', () => {
    const s = memStorage()
    writeStagesSectionOpenPrefs({ ...STAGES_SECTION_DEFAULT_OPEN, working: true, readyToBill: false }, s)
    const back = readStagesSectionOpenPrefs(s)
    expect(back.working).toBe(true)
    expect(back.readyToBill).toBe(false)
    const junk = memStorage({ pipetooling_stages_sections_v2: '{"working": "yes", "paid": true}' })
    const j = readStagesSectionOpenPrefs(junk)
    expect(j.working).toBe(false)
    expect(j.paid).toBe(true)
    expect(readStagesSectionOpenPrefs(memStorage({ pipetooling_stages_sections_v2: 'not json' }))).toEqual(
      STAGES_SECTION_DEFAULT_OPEN,
    )
  })

  it('maps open sections to deduped scopes (billed + collections share billed_all)', () => {
    expect(scopesForOpenStagesSections(STAGES_SECTION_DEFAULT_OPEN)).toEqual(['ready_to_bill'])
    expect(
      scopesForOpenStagesSections({ waiting: false, working: true, readyToBill: false, billed: true, collections: true, paid: false }),
    ).toEqual(['working', 'billed_all'])
    expect(
      scopesForOpenStagesSections({ waiting: false, working: false, readyToBill: false, billed: false, collections: false, paid: false }),
    ).toEqual([])
  })
})
