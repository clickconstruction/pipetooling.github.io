import { describe, expect, it } from 'vitest'
import { plainWordsFailures } from '../plainWords'
import type { FollowUpContact } from './followUpRows'
import { canSortAll, DESK_DONE, DESK_OPEN_THREAD, DESK_SKIP, deskContact, deskStep, skipOne, SORT_ALL } from './sortDesk'

// The customer Messages prototype's four (v0.8, screen 7): nothing here is a real row.
const lane = (...ids: string[]) => ids.map((contactId) => ({ contactId }))
const FOUR = lane('kevin', 'bexar', 'dana', 'greg')

describe('Sort all', () => {
  it('shows on New’s header from two people, as the mockup has it', () => {
    expect(canSortAll(0)).toBe(false)
    expect(canSortAll(1)).toBe(false)
    expect(canSortAll(2)).toBe(true)
    expect(canSortAll(30)).toBe(true)
  })

  it('starts on the top of the lane, with how far the desk has come in parts', () => {
    expect(deskStep(FOUR, new Set(), 4)).toEqual({ current: 'kevin', progress: ['New', '4 to sort', '1 of 4'], more: '3 more after this' })
  })

  it('counts the ones sorted since it opened, and says when it is on the last one', () => {
    expect(deskStep(lane('dana', 'greg'), new Set(), 4)).toEqual({ current: 'dana', progress: ['New', '2 to sort', '3 of 4'], more: '1 more after this' })
    expect(deskStep(lane('greg'), new Set(), 4)).toEqual({ current: 'greg', progress: ['New', '1 to sort', '4 of 4'], more: 'The last one' })
  })

  it('never counts past the total when more came in since it opened', () => {
    expect(deskStep(lane('kevin', 'bexar', 'dana', 'greg', 'elena'), new Set(), 4).progress).toEqual(['New', '5 to sort', '1 of 5'])
  })

  it('is all sorted when the lane is empty', () => {
    expect(deskStep([], new Set(['kevin']), 4)).toEqual({ current: null, progress: [], more: null })
  })

  it('puts a skipped person after the rest, and keeps them after a press sorts the next one', () => {
    let skipped = skipOne(FOUR, new Set(), 'kevin')
    expect(deskStep(FOUR, skipped, 4).current).toBe('bexar')
    skipped = skipOne(FOUR, skipped, 'bexar')
    expect(deskStep(FOUR, skipped, 4).current).toBe('dana')
    // Dana is sorted and leaves the lane: Greg is up, not Kevin, whom the desk skipped.
    expect(deskStep(lane('kevin', 'bexar', 'greg'), skipped, 4)).toEqual({ current: 'greg', progress: ['New', '3 to sort', '2 of 4'], more: '2 more after this' })
  })

  it('starts the walk over once every person left was skipped', () => {
    let skipped = new Set<string>()
    for (const id of ['kevin', 'bexar', 'dana']) skipped = skipOne(FOUR, skipped, id)
    expect(deskStep(FOUR, skipped, 4).current).toBe('greg')
    skipped = skipOne(FOUR, skipped, 'greg')
    expect([...skipped]).toEqual(['greg'])
    expect(deskStep(FOUR, skipped, 4).current).toBe('kevin')
  })

  it('forgets a skip once its person left the lane', () => {
    const skipped = skipOne(lane('bexar', 'dana'), new Set(['kevin']), 'bexar')
    expect([...skipped]).toEqual(['bexar'])
  })

  it('hands the sort card the person as Follow up read them, with no record or channels', () => {
    const priya: FollowUpContact = {
      id: 'priya',
      kind: 'customer',
      name: 'Dr. Priya Raman',
      company: 'Helotes Dental Office',
      state: 'waiting',
      hasUserId: null,
      hasSince: null,
      hasHow: null,
      jobIds: ['pipeline:j-helotes', 'pipeline:j-helotes-2'],
      defaultJobId: 'pipeline:j-helotes',
    }
    expect(deskContact(priya)).toEqual({
      id: 'priya',
      kind: 'customer',
      name: 'Dr. Priya Raman',
      goesBy: null,
      company: 'Helotes Dental Office',
      record: null,
      channels: [],
      jobIds: ['pipeline:j-helotes', 'pipeline:j-helotes-2'],
      defaultJobId: 'pipeline:j-helotes',
    })
    expect(deskContact({ id: 'unk1', kind: 'unknown', name: '(210) 555-0188', state: 'waiting', hasUserId: null, hasSince: null, hasHow: null })).toMatchObject({
      company: '',
      jobIds: [],
      defaultJobId: null,
    })
  })

  it('keeps every word plain', () => {
    const step = deskStep(FOUR, new Set(), 4)
    const all = [SORT_ALL, DESK_SKIP, DESK_DONE.title, DESK_DONE.note, DESK_DONE.back, DESK_OPEN_THREAD, ...step.progress, step.more ?? '', 'The last one']
    expect(all.flatMap(plainWordsFailures)).toEqual([])
  })
})
