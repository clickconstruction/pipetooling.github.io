import { describe, expect, it, vi } from 'vitest'

vi.mock('../supabase', () => ({ supabase: {} }))

import { voidLienFiling, type LienFilingVoidDeps } from './lienFilingVoidIo'

// Every id here is made up.
function deps(over: Partial<LienFilingVoidDeps> = {}) {
  const steps: string[] = []
  const d: LienFilingVoidDeps = {
    tiedPapers: async (filingId, kind) => (steps.push(`tied:${filingId}:${kind}`), ['paper-1']),
    voidFiling: async (filingId, at) => void steps.push(`void:${filingId}:${/^\d{4}-\d{2}-\d{2}T/.test(at)}`),
    papers: async (ids) => (steps.push(`papers:${ids.join(',')}`), [{ id: 'paper-1', status: 'approved', voided_at: null }]),
    ...over,
  }
  return { d, steps }
}

describe('voidLienFiling', () => {
  it('reads the papers tied to the filing, voids it with one write, then reads where the paper went', async () => {
    const { d, steps } = deps()
    await expect(voidLienFiling({ id: 'filing-1', kind: 'affidavit' }, d)).resolves.toBe('approved')
    expect(steps).toEqual(['tied:filing-1:affidavit', 'void:filing-1:true', 'papers:paper-1'])
  })

  it('writes nothing to the paper: a database that did not move it is told as it is', async () => {
    const { d, steps } = deps({ papers: async () => [{ id: 'paper-1', status: 'sent', voided_at: null }] })
    await expect(voidLienFiling({ id: 'filing-1', kind: 'affidavit' }, d)).resolves.toBe('still_sent')
    expect(steps).toEqual(['tied:filing-1:affidavit', 'void:filing-1:true'])
  })

  it('a notice’s record reads its own kind of paper around the void (v2.7911)', async () => {
    const { d, steps } = deps()
    await expect(voidLienFiling({ id: 'filing-2', kind: 'notice_53_056' }, d)).resolves.toBe('approved')
    expect(steps).toEqual(['tied:filing-2:notice_53_056', 'void:filing-2:true', 'papers:paper-1'])
  })

  it('a retainage notice and a release of record have no paper on the desk: one write and no reads', async () => {
    for (const kind of ['retainage_53_057', 'release_of_record']) {
      const { d, steps } = deps()
      await expect(voidLienFiling({ id: 'filing-3', kind }, d)).resolves.toBe('none')
      expect(steps).toEqual(['void:filing-3:true'])
    }
  })

  it('a lien with no paper tied to it voids and reads nothing after', async () => {
    const { d, steps } = deps({ tiedPapers: async () => [] })
    await expect(voidLienFiling({ id: 'filing-1', kind: 'affidavit' }, d)).resolves.toBe('none')
    expect(steps).toEqual(['void:filing-1:true'])
  })

  it('a read that fails never fails the void', async () => {
    const before = deps({ tiedPapers: async () => { throw { message: 'offline' } } })
    await expect(voidLienFiling({ id: 'filing-1', kind: 'affidavit' }, before.d)).resolves.toBe('none')
    expect(before.steps).toEqual(['void:filing-1:true'])
    const after = deps({ papers: async () => { throw { message: 'offline' } } })
    await expect(voidLienFiling({ id: 'filing-1', kind: 'affidavit' }, after.d)).resolves.toBe('none')
    expect(after.steps).toEqual(['tied:filing-1:affidavit', 'void:filing-1:true'])
  })

  it('throws the void’s own reason, and reads nothing after', async () => {
    const { d, steps } = deps({ voidFiling: async () => { throw { message: 'permission denied for table job_lien_filings' } } })
    await expect(voidLienFiling({ id: 'filing-1', kind: 'affidavit' }, d)).rejects.toMatchObject({ message: 'permission denied for table job_lien_filings' })
    expect(steps).toEqual(['tied:filing-1:affidavit'])
  })
})
