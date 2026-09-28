// @vitest-environment jsdom
/**
 * The Bid Date Sent flow end to end through the hook: a new date opens the checklist and the
 * field goes back to the saved date; confirming applies the date and hands the save its
 * stamps; cancelling, retyping, saving and reopening each leave the state the page relied on.
 */
import { afterEach, describe, expect, it } from 'vitest'
import { act, cleanup, renderHook } from '@testing-library/react'
import type { ChangeEvent, FocusEvent } from 'react'
import { useBidDateSentAttestation } from './useBidDateSentAttestation'
import { BID_DATE_SENT_ATTESTATION_NULLS, BID_DATE_SENT_ATTESTATION_REQUIRED_MESSAGE } from '../lib/bids/bidDateSentAttestation'

afterEach(() => cleanup())

const change = (value: string) => ({ target: { value } }) as ChangeEvent<HTMLInputElement>
const blur = (value: string) => ({ target: { value } }) as FocusEvent<HTMLInputElement>

function setup(props: { serverBidDateSent: string | null; userId: string | null } = { serverBidDateSent: '2026-09-01', userId: 'user-1' }) {
  const hook = renderHook((p: { serverBidDateSent: string | null; userId: string | null }) => useBidDateSentAttestation(p), { initialProps: props })
  act(() => hook.result.current.resetTo(props.serverBidDateSent))
  return hook
}

function tickAll(result: { current: ReturnType<typeof useBidDateSentAttestation> }) {
  act(() => result.current.modal.toggleAck('email', true))
  act(() => result.current.modal.toggleAck('phone', true))
  act(() => result.current.modal.toggleAck('honesty', true))
}

describe('useBidDateSentAttestation', () => {
  it('opens on the bid’s saved date with nothing pending', () => {
    const { result } = setup()
    expect(result.current.bidDateSent).toBe('2026-09-01')
    expect(result.current.savedBidDateSent()).toBe('2026-09-01')
    expect(result.current.modalOpen).toBe(false)
    expect(result.current.pending).toBeNull()
    expect(result.current.validateForSave()).toBeNull()
    expect(result.current.getPayloadMerge()).toEqual({})
  })

  it('normalizes the saved date and keeps the field as it came', () => {
    const { result } = setup({ serverBidDateSent: '2026-09-01T00:00:00+00:00', userId: 'user-1' })
    expect(result.current.bidDateSent).toBe('2026-09-01T00:00:00+00:00')
    expect(result.current.savedBidDateSent()).toBe('2026-09-01')
  })

  it('a new date opens the checklist on blur and the field goes back to the saved date', () => {
    const { result } = setup()
    act(() => result.current.handleInputChange(change('2026-09-27')))
    expect(result.current.bidDateSent).toBe('2026-09-27')
    expect(result.current.validateForSave()).toBe(BID_DATE_SENT_ATTESTATION_REQUIRED_MESSAGE)
    act(() => result.current.handleBlur(blur('2026-09-27')))
    expect(result.current.modalOpen).toBe(true)
    expect(result.current.bidDateSent).toBe('2026-09-01')
    expect(result.current.modal.allAcked).toBe(false)
  })

  it('promptIfNeeded answers whether it opened', () => {
    const { result } = setup()
    let opened = true
    act(() => { opened = result.current.promptIfNeeded('2026-09-01') })
    expect(opened).toBe(false)
    act(() => { opened = result.current.promptIfNeeded('') })
    expect(opened).toBe(false)
    act(() => { opened = result.current.promptIfNeeded('2026-09-27') })
    expect(opened).toBe(true)
    act(() => { opened = result.current.promptIfNeeded('2026-09-28') })
    expect(opened).toBe(false)
  })

  it('ticking a line stamps it, unticking clears the stamp', () => {
    const { result } = setup()
    act(() => { result.current.promptIfNeeded('2026-09-27') })
    act(() => result.current.modal.toggleAck('phone', true))
    expect(result.current.modal.acks.phone.checked).toBe(true)
    expect(result.current.modal.acks.phone.checkedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/)
    expect(result.current.modal.acks.email).toEqual({ checked: false, checkedAt: null })
    act(() => result.current.modal.toggleAck('phone', false))
    expect(result.current.modal.acks.phone).toEqual({ checked: false, checkedAt: null })
  })

  it('confirm does nothing until all three are ticked', () => {
    const { result } = setup()
    act(() => { result.current.promptIfNeeded('2026-09-27') })
    act(() => result.current.modal.toggleAck('email', true))
    act(() => result.current.modal.confirm())
    expect(result.current.modalOpen).toBe(true)
    expect(result.current.pending).toBeNull()
  })

  it('confirm does nothing with nobody signed in', () => {
    const { result } = setup({ serverBidDateSent: '2026-09-01', userId: null })
    act(() => { result.current.promptIfNeeded('2026-09-27') })
    tickAll(result)
    act(() => result.current.modal.confirm())
    expect(result.current.modalOpen).toBe(true)
    expect(result.current.pending).toBeNull()
  })

  it('confirming applies the date, holds the stamps and the trimmed note, and closes the checklist', () => {
    const { result } = setup()
    act(() => { result.current.promptIfNeeded('2026-09-27') })
    tickAll(result)
    const emailAt = result.current.modal.acks.email.checkedAt
    act(() => result.current.modal.setFollowupNoteDraft('  left a voicemail  '))
    act(() => result.current.modal.confirm())
    expect(result.current.modalOpen).toBe(false)
    expect(result.current.bidDateSent).toBe('2026-09-27')
    expect(result.current.pendingForDate).toBe('2026-09-27')
    expect(result.current.pendingFollowupNote).toBe('left a voicemail')
    expect(result.current.pending?.bid_date_sent_attested_by).toBe('user-1')
    expect(result.current.pending?.bid_date_sent_ack_email_at).toBe(emailAt)
    expect(result.current.validateForSave()).toBeNull()
    expect(result.current.getPayloadMerge()).toEqual(result.current.pending)
    expect(result.current.modal.acks.email).toEqual({ checked: false, checkedAt: null })
    expect(result.current.modal.followupNoteDraft).toBe('')
  })

  it('an empty note is no note', () => {
    const { result } = setup()
    act(() => { result.current.promptIfNeeded('2026-09-27') })
    tickAll(result)
    act(() => result.current.modal.setFollowupNoteDraft('   '))
    act(() => result.current.modal.confirm())
    expect(result.current.pendingFollowupNote).toBeNull()
  })

  it('cancelling closes the checklist and leaves the saved date in the field', () => {
    const { result } = setup()
    act(() => { result.current.promptIfNeeded('2026-09-27') })
    tickAll(result)
    act(() => result.current.modal.cancel())
    expect(result.current.modalOpen).toBe(false)
    expect(result.current.bidDateSent).toBe('2026-09-01')
    expect(result.current.pending).toBeNull()
    expect(result.current.modal.allAcked).toBe(false)
  })

  it('cancelling a second checklist keeps the first confirmation', () => {
    const { result } = setup()
    act(() => { result.current.promptIfNeeded('2026-09-27') })
    tickAll(result)
    act(() => result.current.modal.confirm())
    act(() => { result.current.promptIfNeeded('2026-09-28') })
    act(() => result.current.modal.cancel())
    expect(result.current.pendingForDate).toBe('2026-09-27')
  })

  it('typing another date after confirming drops the confirmation and its note', () => {
    const { result } = setup()
    act(() => { result.current.promptIfNeeded('2026-09-27') })
    tickAll(result)
    act(() => result.current.modal.setFollowupNoteDraft('called'))
    act(() => result.current.modal.confirm())
    act(() => result.current.handleInputChange(change('2026-09-28')))
    expect(result.current.pending).toBeNull()
    expect(result.current.pendingForDate).toBeNull()
    expect(result.current.pendingFollowupNote).toBeNull()
    expect(result.current.validateForSave()).toBe(BID_DATE_SENT_ATTESTATION_REQUIRED_MESSAGE)
  })

  it('emptying the field clears the stamps on save', () => {
    const { result } = setup()
    act(() => result.current.handleInputChange(change('')))
    expect(result.current.bidDateSent).toBe('')
    expect(result.current.validateForSave()).toBeNull()
    expect(result.current.getPayloadMerge()).toEqual(BID_DATE_SENT_ATTESTATION_NULLS)
  })

  it('a save makes the date the saved one and spends the confirmation', () => {
    const { result, rerender } = setup()
    act(() => { result.current.promptIfNeeded('2026-09-27') })
    tickAll(result)
    act(() => result.current.modal.setFollowupNoteDraft('called'))
    act(() => result.current.modal.confirm())
    act(() => result.current.markSaved())
    rerender({ serverBidDateSent: '2026-09-27', userId: 'user-1' })
    expect(result.current.savedBidDateSent()).toBe('2026-09-27')
    expect(result.current.pending).toBeNull()
    expect(result.current.pendingFollowupNote).toBeNull()
    expect(result.current.validateForSave()).toBeNull()
    expect(result.current.getPayloadMerge()).toEqual({})
    let opened = true
    act(() => { opened = result.current.promptIfNeeded('2026-09-27') })
    expect(opened).toBe(false)
  })

  it('a new bid starts empty and needs the checklist for its first date', () => {
    const { result } = setup({ serverBidDateSent: null, userId: 'user-1' })
    expect(result.current.bidDateSent).toBe('')
    expect(result.current.savedBidDateSent()).toBe('')
    act(() => { result.current.promptIfNeeded('2026-09-27') })
    expect(result.current.modalOpen).toBe(true)
    expect(result.current.bidDateSent).toBe('')
  })

  it('closing the form forgets the checklist and the confirmation, not the field', () => {
    const { result } = setup()
    act(() => { result.current.promptIfNeeded('2026-09-27') })
    tickAll(result)
    act(() => result.current.modal.confirm())
    act(() => result.current.clearFlow())
    expect(result.current.pending).toBeNull()
    expect(result.current.pendingFollowupNote).toBeNull()
    expect(result.current.bidDateSent).toBe('2026-09-27')
    act(() => { result.current.promptIfNeeded('2026-09-28') })
    expect(result.current.modalOpen).toBe(true)
    act(() => result.current.clearFlow())
    expect(result.current.modalOpen).toBe(false)
    expect(result.current.bidDateSent).toBe('2026-09-01')
  })

  it('the per-GC panel writing the date resets the field and the saved date together', () => {
    const { result } = setup()
    act(() => { result.current.promptIfNeeded('2026-09-27') })
    act(() => result.current.resetTo('2026-09-20'))
    expect(result.current.modalOpen).toBe(false)
    expect(result.current.bidDateSent).toBe('2026-09-20')
    expect(result.current.savedBidDateSent()).toBe('2026-09-20')
  })
})
