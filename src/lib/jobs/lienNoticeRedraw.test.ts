import { describe, expect, it } from 'vitest'
import { lienNoticeParted } from './lienNoticeParted'
import { canRedrawItem, fieldsRedrawn, lienNoticePartedBand, lienNoticeRedrawConfirm, lienNoticeRedrawnToast, lienNoticeRedrawnWords, lienNoticeSignFields, redrawnLine, redrawnOf } from './lienNoticeRedraw'
import { lienFieldsHash } from './lienNoticeSignature'
import { plainWordsFailures } from '../plainWords'

const notice = (claimAmount: string, noticeDate: string) => ({ noticeDate, projectDescription: 'Harlow Dental — 12 Sample Rd, Marlow, TX', claimantName: 'Sample Plumbing LLC', laborMaterialsType: 'Plumbing labor and materials', originalContractorName: 'Ridgeway Builders', contractedWithIfDifferent: '', claimAmount, contactPerson: 'Sam Rowe, Master Plumber', claimantAddress: '' })
const WHO = { at: '2026-11-16T22:10:00Z', by: 'u-dana', byName: ' Dana ' }
const parted = lienNoticeParted({ claimAmount: '18400.00' }, { claimAmount: '6150.00' })!

describe('fieldsRedrawn: the stored paper replaced, the rest of the row kept (v2.7520)', () => {
  const stored = { notice: notice('18400.00', '2026-10-07'), gcEmail: 'ap@ridgeway.test', coverLetter: 'Dear owner,', runTakenBack: { at: '2026-11-16T22:01:00Z', by: 'u-dana', byName: 'Dana', printedAt: '2026-11-16T21:53:00Z' } }

  it('replaces the notice and keeps every other key, with the line of who redrew it and what it claimed', () => {
    const out = fieldsRedrawn(stored, notice('6150.00', '2026-11-16'), redrawnLine(stored.notice, WHO))
    expect(out.notice).toEqual(notice('6150.00', '2026-11-16'))
    expect(out.gcEmail).toBe('ap@ridgeway.test')
    expect(out.coverLetter).toBe('Dear owner,')
    expect(out.runTakenBack).toEqual(stored.runTakenBack)
    expect(redrawnOf(out)).toEqual({ at: WHO.at, by: 'u-dana', byName: 'Dana', wasClaim: '18400.00', wasDate: '2026-10-07' })
    // The stored row is not touched.
    expect(stored.notice.claimAmount).toBe('18400.00')
  })

  it('a redraw changes the hash, so a signature over the old paper reads as stale', () => {
    const out = fieldsRedrawn(stored, notice('6150.00', '2026-11-16'), redrawnLine(stored.notice, WHO))
    expect(lienFieldsHash(out)).not.toBe(lienFieldsHash(stored))
  })

  it('fields that are no object start from nothing; a row with no line reads none', () => {
    expect(fieldsRedrawn(null, notice('6150.00', '2026-11-16'), null)).toEqual({ notice: notice('6150.00', '2026-11-16') })
    expect(redrawnOf(stored)).toBeNull()
    expect(redrawnOf({ redrawn: { byName: 'Dana' } })).toBeNull()
  })
})

describe('lienNoticeSignFields: the paper a signing press signs', () => {
  const stored = { notice: notice('6150.00', '2026-11-16'), gcEmail: '' }

  it('the stored paper already the one shown comes back with the same hash: nothing to write', () => {
    expect(lienFieldsHash(lienNoticeSignFields(stored, notice('6150.00', '2026-11-16'), null, WHO))).toBe(lienFieldsHash(stored))
  })

  it('an earlier date alone is rewritten with no redraw line; parted money leaves the line', () => {
    const old = { notice: notice('6150.00', '2026-10-07'), gcEmail: '' }
    const dated = lienNoticeSignFields(old, notice('6150.00', '2026-11-16'), null, WHO)
    expect((dated.notice as { noticeDate: string }).noticeDate).toBe('2026-11-16')
    expect(redrawnOf(dated)).toBeNull()
    const money = lienNoticeSignFields({ notice: notice('18400.00', '2026-10-07'), gcEmail: '' }, notice('6150.00', '2026-11-16'), parted, WHO)
    expect(redrawnOf(money)).toMatchObject({ wasClaim: '18400.00', wasDate: '2026-10-07', byName: 'Dana' })
  })
})

describe('canRedrawItem', () => {
  it('past a draft, live and not printed', () => {
    expect(canRedrawItem({ status: 'approved', printed_at: null, voided_at: null })).toBe(true)
    expect(canRedrawItem({ status: 'awaiting_approval' })).toBe(true)
    expect(canRedrawItem({ status: 'held' })).toBe(true)
  })
  it('not a draft, a printed paper, a sent one, a closed one, or nothing', () => {
    expect(canRedrawItem({ status: 'drafted' })).toBe(false)
    expect(canRedrawItem({ status: 'approved', printed_at: '2026-11-16T21:53:00Z' })).toBe(false)
    expect(canRedrawItem({ status: 'sent' })).toBe(false)
    expect(canRedrawItem({ status: 'approved', voided_at: '2026-11-16T21:53:00Z' })).toBe(false)
    expect(canRedrawItem(null)).toBe(false)
  })
})

describe('the words', () => {
  it('the band says what parted, then what happens next by where the notice stands', () => {
    expect(lienNoticePartedBand(parted, 'signed', 'Sam Rowe')).toEqual({ head: 'The signed paper and the bills no longer agree', words: 'The paper claims $18,400.00. The bills now come to $6,150.00, $12,250.00 less.', next: 'The run holds it. Redraw it from the bills and Sam signs it again.' })
    expect(lienNoticePartedBand(parted, 'unsigned', 'Sam Rowe').next).toBe('This screen shows today’s figures. Sam signs those.')
    expect(lienNoticePartedBand(parted, 'printed').next).toBe('Check it before it is mailed. To redraw it, take it back first.')
    expect(lienNoticePartedBand(parted, 'signed').next).toBe('The run holds it. Redraw it from the bills and The leader signs it again.')
  })

  it('the confirm names the act and says a signature comes off', () => {
    const signed = lienNoticeRedrawConfirm(parted, { signed: true, leaderName: 'Sam Rowe' })
    expect(signed.title).toBe('Redraw this notice from the bills?')
    expect(signed.confirmLabel).toBe('Redraw the notice')
    expect(signed.message).toBe('The paper claims $18,400.00. The bills now come to $6,150.00, $12,250.00 less. The claim and the date on the form are redrawn. The wording typed on the notice stays. The signature comes off, and Sam signs it again before it prints.')
    expect(lienNoticeRedrawConfirm(parted, { signed: false, leaderName: 'Sam Rowe' }).message).toContain('Sam signs the new figures.')
  })

  it('the toast and the line under the paper', () => {
    expect(lienNoticeRedrawnToast(true, 'Sam Rowe')).toBe('Redrawn from the bills. Sam signs it again before it prints.')
    expect(lienNoticeRedrawnToast(false)).toBe('Redrawn from the bills.')
    expect(lienNoticeRedrawnWords({ at: WHO.at, by: 'u-dana', byName: 'Dana', wasClaim: '18400.00', wasDate: '2026-10-07' }, () => 'Nov 16')).toBe('Redrawn from the bills by Dana on Nov 16. It claimed $18,400.00 before.')
    expect(lienNoticeRedrawnWords({ at: WHO.at, by: null, byName: '', wasClaim: '', wasDate: '' }, () => '')).toBe('Redrawn from the bills.')
  })

  it('are plain', () => {
    for (const standing of ['signed', 'unsigned', 'printed'] as const) {
      const b = lienNoticePartedBand(parted, standing, 'Sam Rowe')
      expect(plainWordsFailures(`${b.head}. ${b.words} ${b.next}`)).toEqual([])
    }
    expect(plainWordsFailures(lienNoticeRedrawConfirm(parted, { signed: true, leaderName: 'Sam Rowe' }).message)).toEqual([])
  })
})
