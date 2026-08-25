import { describe, expect, it } from 'vitest'
import {
  groupFieldPhotosByEstimate,
  handoverGroupLabel,
  isDriveLinkValid,
  type HandoverEstimateRow,
  type HandoverPhotoRow,
} from './fieldPhotoHandover'

const est = (over: Partial<HandoverEstimateRow>): HandoverEstimateRow => ({
  id: 'e1',
  estimate_number: 78,
  doc_kind: 'change_order',
  title: '',
  status: 'draft',
  customerName: 'Herber Custom Homes',
  ...over,
})

const photo = (over: Partial<HandoverPhotoRow>): HandoverPhotoRow => ({
  id: 'p1',
  estimate_id: 'e1',
  storage_path: 'e1/a.jpg',
  filename: 'a.jpg',
  created_at: '2026-08-25T10:00:00Z',
  ...over,
})

describe('handoverGroupLabel', () => {
  it('CO with customer', () => {
    expect(handoverGroupLabel(est({}))).toBe('CO #78 — Herber Custom Homes')
  })
  it('estimate falls back to title, then bare', () => {
    expect(
      handoverGroupLabel(est({ doc_kind: 'estimate', customerName: null, title: 'Field estimate — Mike' })),
    ).toBe('Estimate #78 — Field estimate — Mike')
    expect(handoverGroupLabel(est({ estimate_number: null, customerName: null, title: '' }))).toBe('CO')
  })
})

describe('groupFieldPhotosByEstimate', () => {
  it('groups per estimate, oldest group first, photos oldest first', () => {
    const groups = groupFieldPhotosByEstimate(
      [
        photo({ id: 'p2', estimate_id: 'e2', created_at: '2026-08-24T09:00:00Z' }),
        photo({ id: 'p1', created_at: '2026-08-25T10:00:00Z' }),
        photo({ id: 'p3', created_at: '2026-08-25T09:00:00Z', storage_path: 'e1/b.jpg' }),
      ],
      [est({}), est({ id: 'e2', estimate_number: 79 })],
    )
    expect(groups.map((g) => g.estimateId)).toEqual(['e2', 'e1'])
    expect(groups[1]!.photos.map((p) => p.id)).toEqual(['p3', 'p1'])
    expect(groups[1]!.oldestAt).toBe('2026-08-25T09:00:00Z')
  })
  it('skips photos whose estimate is not visible', () => {
    const groups = groupFieldPhotosByEstimate([photo({ estimate_id: 'ghost' })], [est({})])
    expect(groups).toEqual([])
  })
})

describe('isDriveLinkValid', () => {
  it('accepts https URLs, rejects everything else', () => {
    expect(isDriveLinkValid('https://drive.google.com/drive/folders/abc123')).toBe(true)
    expect(isDriveLinkValid('  https://drive.google.com/x ')).toBe(true)
    expect(isDriveLinkValid('http://drive.google.com/x')).toBe(false)
    expect(isDriveLinkValid('drive.google.com/x')).toBe(false)
    expect(isDriveLinkValid('')).toBe(false)
  })
})
