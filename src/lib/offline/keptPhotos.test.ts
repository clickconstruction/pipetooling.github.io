import { describe, expect, it } from 'vitest'
import { createKeptPhotos, keptPhotosOf, sendKeptPhotos, unsentKeptPhotos, withPhoto } from './keptPhotos'
import { newPress, type KeptReportPhoto, type OutboxPress } from './outbox'
import { createOutboxState } from './outboxState'

const T = 1_780_000_000_000

function photo(id: string, sent = false): KeptReportPhoto {
  return { id, sent, fixtureId: 'r', stageName: 'Rough In', caption: 'Rough In', questionId: null, questionWords: null, takenAt: '2026-11-01T13:00:00Z', bytes: 310_000, originalBytes: 4_200_000, width: 1600, height: 1200, byName: 'Luis Ortega' }
}

function report(photos: KeptReportPhoto[], jobLedgerId: string | null = 'j1'): OutboxPress {
  return newPress({ id: 'p-rep', seq: 1, kind: 'field-report', userId: 'u1', pressedAt: T, payload: { templateId: 't', fieldValues: {}, jobLedgerId, projectId: null, bidId: null, lat: null, lng: null, photos } })
}

function store(presses: OutboxPress[] = []) {
  const s = createOutboxState({ readAll: async () => [], write: async () => {}, del: async () => {}, clear: async () => {} })
  for (const p of presses) s.put(p)
  return s
}

/** The bytes with no database: kept in memory for the page's life. */
const memory = () => createKeptPhotos({ open: async () => null })

// A kept report's photos (punch list #229, PR 6).
describe('keptPhotos', () => {
  it('keeps, reads, drops and sweeps the bytes in memory when the device has no database', async () => {
    const bytes = memory()
    const blob = new Blob([new Uint8Array(10)], { type: 'image/jpeg' })
    expect(await bytes.keep('a', blob, T)).toBe(true)
    expect(await bytes.keep('b', blob, T - 10)).toBe(true)
    expect(await bytes.read('a')).toBe(blob)
    expect(await bytes.read('zz')).toBeNull()
    await bytes.sweep(T - 5)
    expect(await bytes.read('b')).toBeNull()
    expect(await bytes.read('a')).toBe(blob)
    await bytes.drop(['a'])
    expect(await bytes.read('a')).toBeNull()
  })

  it('reads the photos off a press and marks one sent or lost', () => {
    const p = report([photo('a'), photo('b', true)])
    expect(keptPhotosOf(p).map((x) => x.id)).toEqual(['a', 'b'])
    expect(unsentKeptPhotos(p).map((x) => x.id)).toEqual(['a'])
    expect(unsentKeptPhotos(withPhoto(p, 'a', { sent: true }))).toEqual([])
    expect(keptPhotosOf(withPhoto(p, 'a', { lost: true })).map((x) => x.id)).toEqual(['b'])
    expect(keptPhotosOf(newPress({ id: 'n', seq: 2, kind: 'job-note', userId: 'u1', pressedAt: T, payload: { jobId: 'j1', body: 'x' } }))).toEqual([])
  })

  it('sends the unsent photos in order, marks each sent on the press and drops its bytes', async () => {
    const bytes = memory()
    await bytes.keep('a', new Blob([new Uint8Array(3)]), T)
    await bytes.keep('c', new Blob([new Uint8Array(4)]), T)
    const s = store([report([photo('a'), photo('b', true), photo('c')])])
    const sent: string[] = []
    const out = await sendKeptPhotos(s.presses()[0]!, s, {
      bytes,
      send: async (input) => {
        sent.push(`${input.id}:${input.jobId}:${input.byUserId}:${input.byName}:${input.blob.size}`)
      },
    })
    expect(out).toEqual({ ok: true })
    expect(sent).toEqual(['a:j1:u1:Luis Ortega:3', 'c:j1:u1:Luis Ortega:4'])
    expect(keptPhotosOf(s.presses()[0]!).map((p) => [p.id, p.sent])).toEqual([['a', true], ['b', true], ['c', true]])
    expect(await bytes.read('a')).toBeNull()
  })

  it('a photo whose bytes are gone is taken off the press, and the report still goes', async () => {
    const bytes = memory()
    await bytes.keep('c', new Blob([new Uint8Array(4)]), T)
    const s = store([report([photo('a'), photo('c')])])
    const out = await sendKeptPhotos(s.presses()[0]!, s, { bytes, send: async () => undefined })
    expect(out).toEqual({ ok: true })
    expect(keptPhotosOf(s.presses()[0]!).map((p) => [p.id, p.sent])).toEqual([['c', true]])
  })

  it('the first send that fails stops the run with its error; what sent stays sent, the rest wait', async () => {
    const bytes = memory()
    for (const id of ['a', 'b', 'c']) await bytes.keep(id, new Blob([new Uint8Array(2)]), T)
    const s = store([report([photo('a'), photo('b'), photo('c')])])
    const out = await sendKeptPhotos(s.presses()[0]!, s, {
      bytes,
      send: async (input) => {
        if (input.id === 'b') throw new TypeError('Failed to fetch')
      },
    })
    expect(out.ok).toBe(false)
    expect(keptPhotosOf(s.presses()[0]!).map((p) => [p.id, p.sent])).toEqual([['a', true], ['b', false], ['c', false]])
    expect(await bytes.read('b')).not.toBeNull()
  })
})
