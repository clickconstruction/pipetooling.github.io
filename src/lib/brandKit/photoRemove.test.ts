import { describe, expect, it, vi } from 'vitest'

vi.mock('../supabase', () => ({ supabase: {} }))

import type { CardLoad } from './cardIo'
import { photoRemoveConfirm, photoRemoveDrawn, photoRemoveProblem, removeTestPersonPhoto } from './photoRemove'

const person = (name: string | null, card_name: string | null = null, photoPath: string | null = 'u1/photo-1.jpg') => ({ facts: { name, card_name }, photoPath })
const load = (name: string | null, photoPath: string | null = 'u1/photo-1.jpg'): CardLoad => ({ facts: { name, card_name: null, title: null, email: null, phone: null }, photoPath, crop: { fx: 0.5, fy: 0.5, zoom: 1 }, columnsOn: true, look: null, lookOn: true, size: null, sizeOn: true })

describe('photoRemoveDrawn', () => {
  it('draws the press for a dev on a person with a photo, and for no other role', () => {
    expect(photoRemoveDrawn('dev', { photoPath: 'u1/photo-1.jpg' })).toBe(true)
    for (const role of ['master_technician', 'assistant', 'controller', 'estimator', 'primary', 'superintendent', 'subcontractor', 'helpers', '', null, undefined]) expect(photoRemoveDrawn(role, { photoPath: 'u1/photo-1.jpg' })).toBe(false)
  })
  it('draws nothing where there is no photo', () => {
    expect(photoRemoveDrawn('dev', { photoPath: null })).toBe(false)
    expect(photoRemoveDrawn('dev', { photoPath: '' })).toBe(false)
  })
})

describe('photoRemoveProblem', () => {
  it('lets a test person’s photo go: the account’s name or the name on the card starts with ZZ', () => {
    expect(photoRemoveProblem(person('ZZ Test Learner'))).toBe('')
    expect(photoRemoveProblem(person('Learner', 'zz test learner'))).toBe('')
  })
  it('refuses a real person’s photo', () => {
    expect(photoRemoveProblem(person('Marisol', 'Marisol Vega'))).toBe('Only a test person’s photo can be removed. Their name must start with ZZ.')
    expect(photoRemoveProblem(person(null, null))).toMatch(/must start with ZZ/)
    expect(photoRemoveProblem(person('Test ZZ'))).toMatch(/must start with ZZ/)
  })
  it('refuses where there is no photo', () => {
    expect(photoRemoveProblem(person('ZZ Test Learner', null, null))).toBe('There is no photo to remove.')
  })
})

describe('photoRemoveConfirm', () => {
  it('names the act on the button, never OK, and the person in the title', () => {
    expect(photoRemoveConfirm('ZZ Test Learner')).toEqual({
      title: 'Remove the photo of ZZ Test Learner?',
      message: 'The photo comes off the card and the footer, and its file is deleted. It cannot be brought back.',
      confirmLabel: 'Remove the photo',
    })
    expect(photoRemoveConfirm('  ').title).toBe('Remove the photo?')
  })
})

describe('removeTestPersonPhoto', () => {
  it('reads the person again, then removes the photo that read names', async () => {
    const io = { load: vi.fn(async () => load('ZZ Test Learner', 'u1/photo-9.jpg')), removePhoto: vi.fn(async () => ({ fileGone: true })) }
    expect(await removeTestPersonPhoto(io, 'u1')).toEqual({ fileGone: true })
    expect(io.load).toHaveBeenCalledWith('u1')
    expect(io.removePhoto).toHaveBeenCalledWith('u1', 'u1/photo-9.jpg')
  })
  it('refuses a real person on the fresh read, and writes nothing', async () => {
    const io = { load: vi.fn(async () => load('Marisol')), removePhoto: vi.fn(async () => ({ fileGone: true })) }
    await expect(removeTestPersonPhoto(io, 'u1')).rejects.toThrow('Only a test person’s photo can be removed. Their name must start with ZZ.')
    expect(io.removePhoto).not.toHaveBeenCalled()
  })
  it('refuses when the photo is already gone, and writes nothing', async () => {
    const io = { load: vi.fn(async () => load('ZZ Test Learner', null)), removePhoto: vi.fn(async () => ({ fileGone: true })) }
    await expect(removeTestPersonPhoto(io, 'u1')).rejects.toThrow('There is no photo to remove.')
    expect(io.removePhoto).not.toHaveBeenCalled()
  })
  it('writes nothing when the read fails', async () => {
    const io = {
      load: vi.fn(async (): Promise<CardLoad> => {
        throw new Error('The card could not be read.')
      }),
      removePhoto: vi.fn(async () => ({ fileGone: true })),
    }
    await expect(removeTestPersonPhoto(io, 'u1')).rejects.toThrow('The card could not be read.')
    expect(io.removePhoto).not.toHaveBeenCalled()
  })
})
