import { describe, expect, it } from 'vitest'
import {
  MIGRATE_DELETE_ESTIMATE_UNLINKED_LINE,
  combineJobsSuccessToast,
  migrateDeleteEstimateUnlinked,
  migrateDeleteSuccessToast,
} from './migrateDeleteReply'

describe('migrateDeleteReply', () => {
  it('reads estimate_unlinked only when the RPC says true', () => {
    expect(migrateDeleteEstimateUnlinked({ ok: true, estimate_unlinked: true })).toBe(true)
    expect(migrateDeleteEstimateUnlinked({ ok: true, estimate_unlinked: false })).toBe(false)
    expect(migrateDeleteEstimateUnlinked({ ok: true })).toBe(false)
    expect(migrateDeleteEstimateUnlinked({ ok: true, estimate_unlinked: 'true' })).toBe(false)
    expect(migrateDeleteEstimateUnlinked(null)).toBe(false)
  })

  it('names the Combined note when the RPC posted one', () => {
    expect(migrateDeleteSuccessToast({ ok: true, note_body: 'Combined "x" (Job #1) into this job' })).toContain(
      'A "Combined" note was posted',
    )
    expect(migrateDeleteSuccessToast({ ok: true })).toContain('Open the target job to verify')
    expect(combineJobsSuccessToast({ ok: true, note_body: 'n' })).toContain('the source job was removed')
    expect(combineJobsSuccessToast({ ok: true })).toContain('Open the target job to verify')
  })

  it('adds the estimate line only when the source estimate stayed apart', () => {
    for (const toast of [migrateDeleteSuccessToast, combineJobsSuccessToast]) {
      const plain = toast({ ok: true, note_body: 'n' })
      expect(plain).not.toContain(MIGRATE_DELETE_ESTIMATE_UNLINKED_LINE)
      const apart = toast({ ok: true, note_body: 'n', estimate_unlinked: true })
      expect(apart.startsWith(plain)).toBe(true)
      expect(apart).toContain(MIGRATE_DELETE_ESTIMATE_UNLINKED_LINE)
    }
  })
})
