import { describe, expect, it } from 'vitest'
import { uncollectibleFirmWarning } from './uncollectibleFirmWarning'

const m = (stage: string, closed_at: string | null = null) => ({ stage, closed_at })

describe('uncollectibleFirmWarning (punch list #94, v2.4794)', () => {
  it('warns only while the firm holds the account', () => {
    expect(uncollectibleFirmWarning(m('demand'))).toMatch(/^The Legal desk has this account with the firm \(.*\)\. Marking it Uncollectible here tells the firm nothing\./)
    expect(uncollectibleFirmWarning(m('review'))).toBeNull()
    expect(uncollectibleFirmWarning(m('demand', '2026-10-01T00:00:00Z'))).toBeNull()
    expect(uncollectibleFirmWarning(null)).toBeNull()
  })
})
