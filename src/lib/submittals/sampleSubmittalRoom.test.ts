import { describe, expect, it } from 'vitest'
import { sampleSubmittalRoomResponse } from '../../../supabase/functions/_shared/customerSampleFixtures'
import { PORTAL_COMPANY } from '../../../supabase/functions/_shared/portalCompany'
import { roomHeadline, roomSubline } from '../../../supabase/functions/_shared/submittalRoomPayload'

const today = '2026-10-05'
const live = sampleSubmittalRoomResponse('live', PORTAL_COMPANY, today).revisions[0]!
const done = sampleSubmittalRoomResponse('done', PORTAL_COMPANY, today).revisions[0]!
const byTag = (rev: typeof live, tag: string) => rev.rows.find((r) => r.tag === tag)

describe('the sample review room, through the room’s own kernel (v2.4595, #62)', () => {
  it('open: the headline and subline a real room would print for these rows, in the room’s order', () => {
    expect(roomHeadline(live.counts)).toBe('3 products need your answer')
    expect(roomSubline(live.counts)).toBe('1 product matches the plans and is marked approved. 2 differ — each says why. 1 is a product we intend to install. 1 has no product yet. 1 is accessory the plans leave to us.')
    expect(live.rows.map((r) => r.tag)).toEqual(['WC-1', 'WH-1', 'SH-1', 'TP-1', 'MB-1', 'L-1'])
    expect(live.rows.every((r) => r.decision == null)).toBe(true)
  })

  it('says only what a real room can: the kernel’s sentences, not hand-written ones', () => {
    expect(byTag(live, 'MB-1')!.why).toBe('No product yet — to follow.')
    expect(byTag(live, 'SH-1')!.why).toBe('This is the product we intend to install.')
    expect(byTag(live, 'TP-1')!.why).toBe('Required by the fixture; the plans leave it to the contractor.')
    expect(byTag(live, 'WC-1')!.why).toBe('The specified product has a long lead time · about 6 weeks for the model on the plans · in stock.')
    expect(byTag(live, 'WH-1')!.why).toBe('A performance value differs from the plans · the specified product is discontinued.')
    expect(byTag(live, 'WH-1')!.performanceChange).toBe(true)
    expect(live.rows.some((r) => /scope|by others/i.test(r.why))).toBe(false)
  })

  it('a fixture of parts: the architect sees each part the GC sees; the order-only row and part never reach the page', () => {
    expect(byTag(live, 'WC-1')!.parts!.map((p) => p.head)).toEqual(['TOTO CT728CUVG#01', 'TOTO SS114#01', 'ZURN Z1203-N'])
    expect(byTag(live, 'HB-1')).toBeUndefined()
    expect(live.counts.total).toBe(6)
  })

  it('after the review: each part carries its own answer and the row reads their roll-up; all three are decided', () => {
    const wc = byTag(done, 'WC-1')!
    expect(wc.parts!.map((p) => p.decision?.kind)).toEqual(['approved', 'approved', 'revise'])
    expect(wc.decision).toMatchObject({ kind: 'revise', note: 'ZURN Z1203-N: Match the wall depth on A-501.', byName: 'Alex Sample' })
    expect(byTag(done, 'SH-1')!.decision?.kind).toBe('approved')
    expect(byTag(done, 'WH-1')!.decision).toMatchObject({ kind: 'revise', note: 'Keep 120 gal — confirm with the engineer.' })
    expect(roomHeadline(done.counts)).toBe('All 3 decided — thank you')
  })
})
