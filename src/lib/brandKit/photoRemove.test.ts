import { describe, expect, it, vi } from 'vitest'

vi.mock('../supabase', () => ({ supabase: {} }))

import type { CardLoad } from './cardIo'
import { photoRemoveConfirm, photoRemoveDrawn, photoRemoveProblem, removePersonPhoto } from './photoRemove'

const load = (name: string | null, photoPath: string | null = 'u1/photo-1.jpg'): CardLoad => ({ facts: { name, card_name: null, title: null, email: null, phone: null }, photoPath, crop: { fx: 0.5, fy: 0.5, zoom: 1 }, columnsOn: true, look: null, lookOn: true, size: null, sizeOn: true })

describe('photoRemoveDrawn', () => {
  it('draws the press on any person with a photo: whoever reads the card reads it, as they read Change the photo', () => {
    expect(photoRemoveDrawn({ photoPath: 'u1/photo-1.jpg' })).toBe(true)
    // A real person's card and a test person's read the same (v2.8565 drew it for a dev on a test person alone).
    expect(photoRemoveDrawn(load('Marisol'))).toBe(true)
    expect(photoRemoveDrawn(load('ZZ Test Learner'))).toBe(true)
  })
  it('draws nothing where there is no photo', () => {
    expect(photoRemoveDrawn({ photoPath: null })).toBe(false)
    expect(photoRemoveDrawn({ photoPath: '' })).toBe(false)
  })
})

describe('photoRemoveProblem', () => {
  it('lets any person’s photo go', () => {
    expect(photoRemoveProblem(load('ZZ Test Learner'))).toBe('')
    expect(photoRemoveProblem(load('Marisol'))).toBe('')
    expect(photoRemoveProblem(load(null))).toBe('')
  })
  it('refuses where there is no photo', () => {
    expect(photoRemoveProblem(load('Marisol', null))).toBe('There is no photo to remove.')
  })
})

describe('photoRemoveConfirm', () => {
  it('names the act on the button, never OK, the person in the title, and what the team’s cards do', () => {
    expect(photoRemoveConfirm('Marisol Vega')).toEqual({
      title: 'Remove the photo of Marisol Vega?',
      message: 'The photo comes off the card and the footer, and its file is deleted. It cannot be brought back. The team’s cards leave this person out until a new photo is saved.',
      confirmLabel: 'Remove the photo',
    })
    expect(photoRemoveConfirm('  ').title).toBe('Remove the photo?')
  })
})

describe('removePersonPhoto', () => {
  it('reads the person again, then removes the photo that read names', async () => {
    const io = { load: vi.fn(async () => load('Marisol', 'u1/photo-9.jpg')), removePhoto: vi.fn(async () => ({ fileGone: true })) }
    expect(await removePersonPhoto(io, 'u1')).toEqual({ fileGone: true })
    expect(io.load).toHaveBeenCalledWith('u1')
    expect(io.removePhoto).toHaveBeenCalledWith('u1', 'u1/photo-9.jpg')
  })
  it('refuses when the photo is already gone, and writes nothing', async () => {
    const io = { load: vi.fn(async () => load('Marisol', null)), removePhoto: vi.fn(async () => ({ fileGone: true })) }
    await expect(removePersonPhoto(io, 'u1')).rejects.toThrow('There is no photo to remove.')
    expect(io.removePhoto).not.toHaveBeenCalled()
  })
  it('hands on the database’s refusal, for a person who may not change this account', async () => {
    const refusal = 'The photo was not removed. You may not have leave to change this account, or the photo was changed meanwhile.'
    const io = { load: vi.fn(async () => load('Marisol')), removePhoto: vi.fn(async () => Promise.reject(new Error(refusal))) }
    await expect(removePersonPhoto(io, 'u1')).rejects.toThrow(refusal)
  })
  it('writes nothing when the read fails', async () => {
    const io = {
      load: vi.fn(async (): Promise<CardLoad> => {
        throw new Error('The card could not be read.')
      }),
      removePhoto: vi.fn(async () => ({ fileGone: true })),
    }
    await expect(removePersonPhoto(io, 'u1')).rejects.toThrow('The card could not be read.')
    expect(io.removePhoto).not.toHaveBeenCalled()
  })
})
