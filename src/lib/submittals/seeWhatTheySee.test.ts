import { describe, expect, it } from 'vitest'
import { describeForReviewer } from './seeWhatTheySee'
import type { RoomItemSource } from '../../../supabase/functions/_shared/submittalRoomPayload'

const item = (o: Partial<RoomItemSource> & Pick<RoomItemSource, 'id' | 'tag' | 'status'>): RoomItemSource => ({
  sequence_order: 1, specified_manufacturer: null, specified_model: null, specified_description: null, submitted_manufacturer: null, submitted_model: null, submitted_label: null,
  reason_kind: null, reason_note: null, lead_time_days: null, sheet_pages: null, review_decision: null, review_note: null, reviewed_by_name: null, reviewed_by_person_id: null, reviewed_at: null,
  ...o,
})

describe('describeForReviewer (v2.4174, #62 Layer 1)', () => {
  it('quotes the room’s own headline and subline for the draft, and says the GC sees nothing until you share', () => {
    const r = describeForReviewer(
      [
        item({ id: 'a', tag: 'WC-1', status: 'as_specified', sequence_order: 1 }),
        item({ id: 'b', tag: 'DWH-1', status: 'alternate', reason_kind: 'lead_time', sequence_order: 2 }),
        item({ id: 'c', tag: 'PRV-1', status: 'missing', sequence_order: 3 }),
        item({ id: 'd', tag: '', status: 'accessory', sequence_order: 4 }),
      ],
      false,
    )
    expect(r.lead).toBe('The GC’s page will read:')
    expect(r.line).toBe('“1 product needs your answer” — 1 product matches the plans and is marked approved. 1 differs — each says why. 1 has no product yet. 1 is accessory the plans leave to us.')
    expect(r.note).toBe('The GC sees nothing until you share.')
  })
  it('a shared revision reads as what the link shows now; a clean draft reads as matching', () => {
    const r = describeForReviewer([item({ id: 'a', tag: 'WC-1', status: 'as_specified' })], true)
    expect(r.lead).toBe('The GC’s page reads:')
    expect(r.line).toBe('“Everything matches the plans” — 1 product matches the plans and is marked approved.')
    expect(r.note).toBe('That is what the link shows now.')
    expect(describeForReviewer([], false).line).toBe('“Nothing to review yet”')
  })
})
