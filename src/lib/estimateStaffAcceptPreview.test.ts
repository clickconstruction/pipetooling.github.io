import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  STAFF_ACCEPT_PREVIEW_STORAGE_PREFIX,
  buildStaffAcceptPreviewSnapshot,
  readAndConsumeStaffAcceptPreviewSnapshot,
  staffAcceptPreviewStorageKey,
  writeStaffAcceptPreviewSnapshot,
  type StaffAcceptPreviewSnapshotV1,
} from './estimateStaffAcceptPreview'

/** Minimal Storage stand-in — the node test environment has none. */
function makeStorage() {
  const m = new Map<string, string>()
  return {
    getItem: (k: string) => (m.has(k) ? m.get(k)! : null),
    setItem: (k: string, v: string) => void m.set(k, String(v)),
    removeItem: (k: string) => void m.delete(k),
    clear: () => m.clear(),
    get size() { return m.size },
  }
}

const g = globalThis as unknown as { localStorage?: unknown; sessionStorage?: unknown }
let local: ReturnType<typeof makeStorage>
let session: ReturnType<typeof makeStorage>

beforeEach(() => {
  local = makeStorage()
  session = makeStorage()
  g.localStorage = local
  g.sessionStorage = session
  vi.useFakeTimers()
  vi.setSystemTime(new Date('2026-09-06T12:00:00Z'))
})
afterEach(() => {
  delete g.localStorage
  delete g.sessionStorage
  vi.useRealTimers()
})

const LINE = { line_item: 'Labor', description: 'Install', quantity: 1, unit_price_cents: 1000, amount_cents: 1000 }

function build(over: Partial<Parameters<typeof buildStaffAcceptPreviewSnapshot>[0]> = {}): StaffAcceptPreviewSnapshotV1 {
  return buildStaffAcceptPreviewSnapshot({
    estimateId: 'est-1',
    title: 'Water heater',
    terms: 'Net 15',
    validUntilTrimmed: '2026-09-30',
    lines: [LINE],
    totalCents: 1000,
    forLineEffective: '  Pat Customer  ',
    cxOverrideFields: {},
    ...over,
  })
}

describe('buildStaffAcceptPreviewSnapshot', () => {
  it('normalises the optional fields and omits what is absent', () => {
    expect(build()).toEqual({
      v: 1,
      estimateId: 'est-1',
      title: 'Water heater',
      terms: 'Net 15',
      valid_until: '2026-09-30',
      line_items: [LINE],
      total_cents: 1000,
      for_line: 'Pat Customer',
      overrides: null,
      accept_header_brand: null,
    })
    expect(staffAcceptPreviewStorageKey('est-1')).toBe(`${STAFF_ACCEPT_PREVIEW_STORAGE_PREFIX}est-1`)
  })
  it('keeps only meaningful overrides, blank valid-until and for-line become null, options and attachment ride along when present', () => {
    const s = build({
      validUntilTrimmed: '  ',
      forLineEffective: '',
      cxOverrideFields: { accept_submit_label: ' Approve ', thank_you_title: '  ' },
      acceptHeaderBrand: 'elec',
      customerAttachment: { url: 'https://e.com/a.pdf', label: null },
      options: [{ id: 'o1' }],
    })
    expect(s.valid_until).toBeNull()
    expect(s.for_line).toBeNull()
    expect(s.overrides).toEqual({ accept_submit_label: 'Approve' })
    expect(s.accept_header_brand).toBe('elec')
    expect(s.customer_attachment).toEqual({ url: 'https://e.com/a.pdf', label: null })
    expect(s.options).toEqual([{ id: 'o1' }])
    expect('options' in build({ options: [] })).toBe(false)
  })
})

describe('write → read-and-consume', () => {
  it('round-trips through localStorage and consumes the key', () => {
    const snap = build({ acceptHeaderBrand: 'plum', customerAttachment: { url: 'https://e.com/a.pdf', label: ' Plans ' } })
    writeStaffAcceptPreviewSnapshot(snap)
    expect(local.size).toBe(1)
    const read = readAndConsumeStaffAcceptPreviewSnapshot('est-1')
    expect(read).toEqual({ ...snap, customer_attachment: { url: 'https://e.com/a.pdf', label: 'Plans' } })
    expect(local.size).toBe(0)
    expect(readAndConsumeStaffAcceptPreviewSnapshot('est-1')).toBeNull()
  })
  it('a snapshot older than an hour is discarded and cleared', () => {
    writeStaffAcceptPreviewSnapshot(build())
    vi.setSystemTime(new Date('2026-09-06T13:00:01Z'))
    expect(readAndConsumeStaffAcceptPreviewSnapshot('est-1')).toBeNull()
    expect(local.size).toBe(0)
  })
  it('a snapshot for another estimate id is refused and cleared', () => {
    writeStaffAcceptPreviewSnapshot(build())
    local.setItem(staffAcceptPreviewStorageKey('est-2'), local.getItem(staffAcceptPreviewStorageKey('est-1'))!)
    expect(readAndConsumeStaffAcceptPreviewSnapshot('est-2')).toBeNull()
    expect(local.getItem(staffAcceptPreviewStorageKey('est-2'))).toBeNull()
  })
  it('reads a legacy unwrapped v1 payload from sessionStorage and clears both stores', () => {
    session.setItem(staffAcceptPreviewStorageKey('est-1'), JSON.stringify(build()))
    expect(readAndConsumeStaffAcceptPreviewSnapshot('est-1')?.title).toBe('Water heater')
    expect(session.size).toBe(0)
  })
  it('malformed JSON, a non-object, or a bad envelope timestamp all read as null and clear', () => {
    const key = staffAcceptPreviewStorageKey('est-1')
    local.setItem(key, '{not json')
    expect(readAndConsumeStaffAcceptPreviewSnapshot('est-1')).toBeNull()
    local.setItem(key, '[1,2]')
    expect(readAndConsumeStaffAcceptPreviewSnapshot('est-1')).toBeNull()
    local.setItem(key, JSON.stringify({ v: 2, writtenAt: 'yesterday', payload: build() }))
    expect(readAndConsumeStaffAcceptPreviewSnapshot('est-1')).toBeNull()
    expect(local.size).toBe(0)
  })
  it('parses the optional fields defensively: bad brand → null, http attachment → null, negative total → 0', () => {
    const key = staffAcceptPreviewStorageKey('est-1')
    local.setItem(key, JSON.stringify({ ...build(), accept_header_brand: 'gas', customer_attachment: { url: 'http://e.com/a.pdf' }, total_cents: -5, for_line: 42 }))
    const read = readAndConsumeStaffAcceptPreviewSnapshot('est-1')
    expect(read).toMatchObject({ accept_header_brand: null, customer_attachment: null, total_cents: 0 })
    expect('for_line' in read!).toBe(false)
  })
  it('a snapshot missing a required field is refused', () => {
    const key = staffAcceptPreviewStorageKey('est-1')
    const { terms: _t, ...noTerms } = build()
    local.setItem(key, JSON.stringify(noTerms))
    expect(readAndConsumeStaffAcceptPreviewSnapshot('est-1')).toBeNull()
  })
})
