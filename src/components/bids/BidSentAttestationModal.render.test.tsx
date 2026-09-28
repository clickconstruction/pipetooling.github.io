// @vitest-environment jsdom
/**
 * Render smoke for "Confirm bid sent": the three lines, the stamp under a ticked line,
 * Confirm held until all three are ticked (and while nobody is signed in), the note, and the
 * two buttons' calls.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { BidSentAttestationModal } from './BidSentAttestationModal'
import type { BidDateSentAttestation } from '../../hooks/useBidDateSentAttestation'

afterEach(() => cleanup())

type Modal = BidDateSentAttestation['modal']

function modal(over: Partial<Modal> = {}): Modal {
  return {
    acks: {
      email: { checked: false, checkedAt: null },
      phone: { checked: false, checkedAt: null },
      honesty: { checked: false, checkedAt: null },
    },
    allAcked: false,
    followupNoteDraft: '',
    setFollowupNoteDraft: vi.fn(),
    toggleAck: vi.fn(),
    cancel: vi.fn(),
    confirm: vi.fn(),
    ...over,
  }
}

const ALL_TICKED: Modal['acks'] = {
  email: { checked: true, checkedAt: '2026-09-27T15:00:00.000Z' },
  phone: { checked: true, checkedAt: '2026-09-27T15:00:05.000Z' },
  honesty: { checked: true, checkedAt: '2026-09-27T15:00:09.000Z' },
}

describe('BidSentAttestationModal', () => {
  it('draws the dialog with its three lines, unticked', () => {
    render(<BidSentAttestationModal modal={modal()} signerName="Tristen" />)
    expect(screen.getByRole('dialog', { name: 'Confirm bid sent' })).toBeTruthy()
    const boxes = screen.getAllByRole('checkbox') as HTMLInputElement[]
    expect(boxes).toHaveLength(3)
    expect(boxes.every((b) => !b.checked)).toBe(true)
    expect(screen.getByText('I sent the bid via email and the client knew it was coming')).toBeTruthy()
    expect(screen.getByText('I followed up with a phone call')).toBeTruthy()
    expect(screen.getByText('I understand that lying about this will result in my suspension')).toBeTruthy()
  })

  it('ticking a line hands back which line and that it is on', () => {
    const m = modal()
    render(<BidSentAttestationModal modal={m} signerName="Tristen" />)
    fireEvent.click(screen.getByLabelText('I followed up with a phone call'))
    expect(m.toggleAck).toHaveBeenCalledWith('phone', true)
  })

  it('stamps a ticked line with the signer', () => {
    render(<BidSentAttestationModal modal={modal({ acks: { ...ALL_TICKED, honesty: { checked: false, checkedAt: null } } })} signerName="Tristen" />)
    expect(screen.getAllByText(/^Tristen ·/)).toHaveLength(2)
  })

  it('holds Confirm until all three are ticked', () => {
    const m = modal()
    render(<BidSentAttestationModal modal={m} signerName="Tristen" />)
    const confirm = screen.getByRole('button', { name: 'Confirm sent date' }) as HTMLButtonElement
    expect(confirm.disabled).toBe(true)
    expect(confirm.style.cursor).toBe('not-allowed')
    fireEvent.click(confirm)
    expect(m.confirm).not.toHaveBeenCalled()
  })

  it('Confirm calls through once all three are ticked', () => {
    const m = modal({ acks: ALL_TICKED, allAcked: true })
    render(<BidSentAttestationModal modal={m} signerName="Tristen" />)
    const confirm = screen.getByRole('button', { name: 'Confirm sent date' }) as HTMLButtonElement
    expect(confirm.disabled).toBe(false)
    fireEvent.click(confirm)
    expect(m.confirm).toHaveBeenCalledTimes(1)
  })

  it('with nobody signed in, Confirm is held and no stamp draws', () => {
    render(<BidSentAttestationModal modal={modal({ acks: ALL_TICKED, allAcked: true })} signerName={null} />)
    expect((screen.getByRole('button', { name: 'Confirm sent date' }) as HTMLButtonElement).disabled).toBe(true)
    expect(screen.queryByText(/·/)).toBeNull()
  })

  it('the note and Cancel call through', () => {
    const m = modal({ followupNoteDraft: 'left a voicemail' })
    render(<BidSentAttestationModal modal={m} signerName="Tristen" />)
    const note = screen.getByPlaceholderText('What happened when you called them or left a voicemail?') as HTMLTextAreaElement
    expect(note.value).toBe('left a voicemail')
    fireEvent.change(note, { target: { value: 'spoke to Dana' } })
    expect(m.setFollowupNoteDraft).toHaveBeenCalledWith('spoke to Dana')
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(m.cancel).toHaveBeenCalledTimes(1)
  })
})
