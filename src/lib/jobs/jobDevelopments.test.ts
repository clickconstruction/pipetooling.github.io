import { describe, expect, it } from 'vitest'
import {
  developmentPickerOptions,
  resolveDevelopmentIdForJobPayload,
  validateNewDevelopmentName,
  type JobFormDevelopmentRow,
} from './jobDevelopments'

const MASTER = 'master-1'
const OTHER = 'master-2'

function dev(id: string, name: string, master = MASTER, archived_at: string | null = null): JobFormDevelopmentRow {
  return { id, name, master_user_id: master, archived_at }
}

describe('resolveDevelopmentIdForJobPayload', () => {
  it('keeps a pick owned by the job master', () => {
    expect(resolveDevelopmentIdForJobPayload('d1', MASTER, [dev('d1', 'Sagebrush')])).toBe('d1')
  })

  it('drops a cross-master pick to null (DB backstop would reject it)', () => {
    expect(resolveDevelopmentIdForJobPayload('d1', MASTER, [dev('d1', 'Sagebrush', OTHER)])).toBeNull()
  })

  it('trusts a pick not present in the supplied list', () => {
    expect(resolveDevelopmentIdForJobPayload('unknown', MASTER, [dev('d1', 'Sagebrush')])).toBe('unknown')
  })

  it('null pick stays null', () => {
    expect(resolveDevelopmentIdForJobPayload(null, MASTER, [dev('d1', 'Sagebrush')])).toBeNull()
  })
})

describe('developmentPickerOptions', () => {
  it('name-sorts active developments and drops archived ones', () => {
    const opts = developmentPickerOptions(
      [dev('d2', 'Wildflower'), dev('d1', 'Sagebrush Phase 2'), dev('d3', 'Old Town', MASTER, '2026-07-01')],
      null,
    )
    expect(opts.map((o) => o.name)).toEqual(['Sagebrush Phase 2', 'Wildflower'])
  })

  it('keeps the currently linked development even when archived', () => {
    const opts = developmentPickerOptions([dev('d3', 'Old Town', MASTER, '2026-07-01')], 'd3')
    expect(opts).toEqual([{ id: 'd3', name: 'Old Town' }])
  })

  it('blank names render as an em dash placeholder', () => {
    expect(developmentPickerOptions([dev('d1', '  ')], null)).toEqual([{ id: 'd1', name: '—' }])
  })
})

describe('validateNewDevelopmentName', () => {
  it('trims and accepts a fresh name', () => {
    expect(validateNewDevelopmentName('  Sagebrush Phase 2 ', [])).toEqual({ ok: true, name: 'Sagebrush Phase 2' })
  })

  it('rejects empty input', () => {
    const r = validateNewDevelopmentName('   ', [])
    expect(r.ok).toBe(false)
  })

  it('rejects a case-insensitive clash with an ACTIVE development', () => {
    const r = validateNewDevelopmentName('sagebrush', [dev('d1', 'Sagebrush')])
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.error).toContain('already exists')
  })

  it('allows re-using an archived development name (partial unique index ignores archived)', () => {
    expect(validateNewDevelopmentName('Old Town', [dev('d3', 'Old Town', MASTER, '2026-07-01')])).toEqual({
      ok: true,
      name: 'Old Town',
    })
  })
})
