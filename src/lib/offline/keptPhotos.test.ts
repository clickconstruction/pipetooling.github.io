import { describe, expect, it } from 'vitest'
import { createKeptPhotos, keptPhotosOf, sendKeptPhotos, unsentKeptPhotos, withPhoto } from './keptPhotos'
import { newPress, type KeptJobPhoto, type KeptReportPhoto, type KeptTaskPhoto, type OutboxPress } from './outbox'
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

  // Punch list #244, PR 5: a job photos press carries its photos as a report does and sends them to its own io.
  it('a job photos press carries its photos, and the replay sends the unsent ones with the job id', async () => {
    const jp = (id: string, sent = false): KeptJobPhoto => ({ ...photo(id, sent), description: 'Meter location' })
    const press = newPress({ id: 'p-jp', seq: 1, kind: 'job-photos', userId: 'u1', pressedAt: T, payload: { jobLedgerId: 'j1', photos: [jp('a', true), jp('b')] } })
    expect(keptPhotosOf(press).map((p) => p.id)).toEqual(['a', 'b'])
    expect(unsentKeptPhotos(press).map((p) => p.id)).toEqual(['b'])
    const bytes = memory()
    await bytes.keep('b', new Blob([new Uint8Array(3)], { type: 'image/jpeg' }), T)
    const s = store([press])
    const sent: string[] = []
    const out = await sendKeptPhotos(press, s, { bytes, send: async (input) => void sent.push(`${input.jobId}/${input.id}/${input.byName}`) })
    expect(out).toEqual({ ok: true })
    expect(sent).toEqual(['j1/b/Luis Ortega'])
    expect(unsentKeptPhotos(s.presses()[0]!)).toEqual([])
    expect(withPhoto(press, 'b', { lost: true }).payload).toMatchObject({ jobLedgerId: 'j1', photos: [{ id: 'a' }] })
  })

  // Punch list #273, v2.6628: a task photo press carries one shot and sends it to the card's own io, every fact kept.
  it('a task photo press carries its shot, and the replay sends it to the card under the kept id with its kind and line', async () => {
    const tp: KeptTaskPhoto = { id: 'tp-1', sent: false, kind: 'finish', percentAt: null, criterionId: 'c2', lineBody: 'Fittings are in labeled bins', takenAt: '2026-11-07T13:00:00Z', bytes: 310_000, originalBytes: 4_200_000, width: 1600, height: 1200, byName: 'Mateo Ruiz' }
    const press = newPress({ id: 'p-tp', seq: 1, kind: 'task-photo', userId: 'u1', pressedAt: T, payload: { instanceId: 'inst-1', photos: [tp] } })
    expect(keptPhotosOf(press).map((p) => p.id)).toEqual(['tp-1'])
    expect(unsentKeptPhotos(press).map((p) => p.id)).toEqual(['tp-1'])
    const bytes = memory()
    const blob = new Blob([new Uint8Array(3)], { type: 'image/jpeg' })
    await bytes.keep('tp-1', blob, T)
    const s = store([press])
    const sent: unknown[] = []
    const jobSends: string[] = []
    const out = await sendKeptPhotos(press, s, { bytes, send: async (input) => void jobSends.push(input.id), sendTask: async (input) => void sent.push(input) })
    expect(out).toEqual({ ok: true })
    expect(jobSends).toEqual([])
    expect(sent).toEqual([{ id: 'tp-1', instanceId: 'inst-1', blob, byUserId: 'u1', byName: 'Mateo Ruiz', takenAt: '2026-11-07T13:00:00Z', originalBytes: 4_200_000, width: 1600, height: 1200, kind: 'finish', percentAt: null, criterionId: 'c2', lineBody: 'Fittings are in labeled bins' }])
    expect(unsentKeptPhotos(s.presses()[0]!)).toEqual([])
    expect(await bytes.read('tp-1')).toBeNull()
  })

  it('a task shot whose bytes are gone is taken off its press, and a send that fails leaves it unsent', async () => {
    const tp: KeptTaskPhoto = { id: 'tp-2', sent: false, kind: 'progress', percentAt: 50, criterionId: null, lineBody: null, takenAt: '2026-11-07T13:00:00Z', bytes: 1, originalBytes: 1, width: 1, height: 1, byName: '' }
    const press = newPress({ id: 'p-tp2', seq: 1, kind: 'task-photo', userId: 'u1', pressedAt: T, payload: { instanceId: 'inst-1', photos: [tp] } })
    const gone = store([press])
    expect(await sendKeptPhotos(press, gone, { bytes: memory(), sendTask: async () => undefined })).toEqual({ ok: true })
    expect(keptPhotosOf(gone.presses()[0]!)).toEqual([])
    const bytes = memory()
    await bytes.keep('tp-2', new Blob([new Uint8Array(1)]), T)
    const s = store([press])
    const out = await sendKeptPhotos(press, s, { bytes, sendTask: async () => Promise.reject(new TypeError('Failed to fetch')) })
    expect(out.ok).toBe(false)
    expect(unsentKeptPhotos(s.presses()[0]!).map((p) => p.id)).toEqual(['tp-2'])
  })
})
