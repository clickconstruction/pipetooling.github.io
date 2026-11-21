import { describe, expect, it } from 'vitest'
import { PLAIN_WORDS_GLUE } from '../plainWords'
import { canAddPhoto, photoCountWords, photosKeptWords, WRITE_UP_MAX_PHOTOS, WRITE_UP_PHOTO_WORDS, writeUpEvidenceDraft, writeUpPhotoPath } from './writeUpPhotos'
import { createKeptPhotos, sendKeptPhotos, unsentKeptPhotos } from '../offline/keptPhotos'
import { newPress, type KeptShot } from '../offline/outbox'
import { createOutboxState } from '../offline/outboxState'
import { keptWriteUpLine, keptWriteUps, newWriteUpDraft, writeUpReadBack, type WriteUpPerson } from './writeUp'

// Made-up people and words (punch list #410, PR 5).
describe('a write-up’s photos', () => {
  it('are named by the writer, the press and the photo', () => {
    expect(writeUpPhotoPath('u-leader', 'press-1', 'ph-1')).toBe('u-leader/press-1/ph-1.jpg')
  })
  it('stop at four', () => {
    expect(WRITE_UP_MAX_PHOTOS).toBe(4)
    expect([0, 3, 4, 5].map(canAddPhoto)).toEqual([true, true, false, false])
  })
  it('are counted in words', () => {
    expect([0, 1, 3].map(photoCountWords)).toEqual(['', '1 photo', '3 photos'])
    expect([0, 1, 2].map(photosKeptWords)).toEqual(['', '1 photo kept', '2 photos kept'])
  })
  it('become an evidence record dated the day it happened', () => {
    expect(writeUpEvidenceDraft({ occurred_date: '2026-11-20', author_name: 'Marcus Hale', kind: 'safety' }, 'Safety', 2)).toEqual({
      datedOn: '2026-11-20',
      title: 'Field write-up, safety: 2 photos',
      memo: 'Taken on a phone by Marcus Hale and sent with the write-up of that day.',
    })
  })
  it('have plain words', () => {
    for (const words of Object.values(WRITE_UP_PHOTO_WORDS)) expect(PLAIN_WORDS_GLUE.test(words), words).toBe(false)
  })
})

describe('photos on the draft and on a kept write-up', () => {
  const dana: WriteUpPerson = { person_id: 'p-dana', name: 'Dana Pruitt', kind: 'helper', with_date: null, job_id: null, hcp_number: null, click_number: null, job_name: null, job_address: null, clocked_in_at: null }
  it('a new draft has none, and the read-back counts the ones taken', () => {
    const d = newWriteUpDraft(dana, { today: '2026-11-20', jobs: [] }, { ymd: '2026-11-20', hhmm: '12:41' })
    expect(d.photos).toEqual([])
    expect(writeUpReadBack(d).some((l) => l.label === 'Photos')).toBe(false)
    const one = { ...d, kind: 'safety' as const, photos: [{ id: 'ph-1', blob: new Blob(['x']), url: '', takenAt: '2026-11-20T18:22:00Z', originalBytes: 1, width: 10, height: 10 }] }
    expect(writeUpReadBack(one).slice(-1)).toEqual([{ label: 'Photos', value: '1 photo' }])
  })
  it('a kept write-up says how many photos wait with it', () => {
    const shot: KeptShot = { id: 'ph-1', sent: false, takenAt: '2026-11-20T18:22:00Z', bytes: 10, originalBytes: 20, width: 10, height: 10, byName: '' }
    const press = newPress({ id: 'press-1', seq: 1, kind: 'person-report', userId: 'u-leader', pressedAt: 1000, payload: { fields: { subject_person_id: 'p-dana', kind: 'safety', occurred_date: '2026-11-20' }, photos: [shot] } })
    const [kept] = keptWriteUps([press], 'u-leader')
    expect(kept?.photos).toBe(1)
    expect(keptWriteUpLine(kept!)).toBe('Safety · Fri, Nov 20 · 1 photo kept')
  })
})

describe('the replay sends a kept write-up’s photos before it lands', () => {
  const store = () => createOutboxState({ readAll: async () => [], write: async () => {}, del: async () => {}, clear: async () => {} })
  const shot = (id: string, sent = false): KeptShot => ({ id, sent, takenAt: '2026-11-20T18:22:00Z', bytes: 10, originalBytes: 20, width: 1200, height: 900, byName: '' })

  it('each unsent photo goes to its bucket under the press’s own id, and is marked sent', async () => {
    const bytes = createKeptPhotos({ open: async () => null })
    await bytes.keep('ph-2', new Blob(['two'], { type: 'image/jpeg' }))
    const press = newPress({ id: 'press-1', seq: 1, kind: 'person-report', userId: 'u-leader', pressedAt: 1000, payload: { fields: { subject_person_id: 'p-dana' }, photos: [shot('ph-1', true), shot('ph-2')] } })
    const s = store()
    s.put(press)
    const sent: unknown[] = []
    const out = await sendKeptPhotos(press, s, { bytes, sendWriteUp: async (input) => void sent.push({ id: input.id, pressId: input.pressId, byUserId: input.byUserId, takenAt: input.takenAt, width: input.width }) })
    expect(out).toEqual({ ok: true })
    expect(sent).toEqual([{ id: 'ph-2', pressId: 'press-1', byUserId: 'u-leader', takenAt: '2026-11-20T18:22:00Z', width: 1200 }])
    expect(unsentKeptPhotos(s.presses()[0]!)).toEqual([])
    expect(await bytes.read('ph-2')).toBeNull()
  })
  it('a photo that will not send stops the replay, so the write-up waits with it', async () => {
    const bytes = createKeptPhotos({ open: async () => null })
    await bytes.keep('ph-1', new Blob(['one'], { type: 'image/jpeg' }))
    const press = newPress({ id: 'press-1', seq: 1, kind: 'person-report', userId: 'u-leader', pressedAt: 1000, payload: { fields: {}, photos: [shot('ph-1')] } })
    const s = store()
    s.put(press)
    const out = await sendKeptPhotos(press, s, { bytes, sendWriteUp: async () => Promise.reject(new TypeError('Failed to fetch')) })
    expect(out.ok).toBe(false)
    expect(unsentKeptPhotos(s.presses()[0]!)).toHaveLength(1)
    expect(await bytes.read('ph-1')).not.toBeNull()
  })
})
