// @vitest-environment jsdom
/**
 * Is this public property? (v2.7443): the window that takes a property off the lien path, the question on the record,
 * the answered line and the put-back window. The reads and the one write are mocked; made-up ZZ Test jobs, shaped as
 * jobs 883 (billed) and 523 (still being worked) stood on 2026-11-16.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, screen, waitFor } from '@testing-library/react'
import { renderWithProviders } from '../../test/renderSmokeMocks'

const { readLienPublicProperty, setLienPublicAnswer } = vi.hoisted(() => ({ readLienPublicProperty: vi.fn(), setLienPublicAnswer: vi.fn() }))
vi.mock('../../lib/jobs/lienPublicPropertyIo', () => ({ readLienPublicProperty, setLienPublicAnswer }))
vi.mock('../../lib/supabase', async () => {
  const { makeSupabaseStub } = await import('../../test/renderSmokeMocks')
  return { supabase: makeSupabaseStub() }
})

import LienPublicPropertyWindow from './LienPublicPropertyWindow'
import LienPublicPutBackWindow from './LienPublicPutBackWindow'
import LienPublicQuestion, { LienPublicAnswerLine } from './LienPublicQuestion'

const missed = (m: string) => ({ kind: 'notice_53_056', status: 'missed', months: [m] })
const READ = {
  addressId: 'addr-1',
  address: '100 Sample Rd, Sampletown',
  ownerName: 'ZZ TEST CITY OF',
  answer: null,
  answeredAt: null,
  reason: '',
  jobs: [
    { jobId: 'j523', number: '523', name: 'ZZ Test Hills', status: 'working', unpaid: 29323.4, papers: [missed('2026-06'), missed('2026-07'), missed('2026-08'), missed('2026-09')], gcName: 'ZZ Test Builders', bond: 'unknown', attorneySince: null },
    { jobId: 'j883', number: '883', name: 'ZZ Test Drains', status: 'billed', unpaid: 2918.4, papers: [{ kind: 'notice_53_056', status: 'sent', sent_at: '2026-10-08T15:00:00Z' }, { kind: 'affidavit', status: 'approved', approved_at: '2026-11-11T16:00:00Z' }], gcName: 'ZZ Test Builders', bond: 'unknown', attorneySince: null },
  ],
}
const REASON = 'Public property. The owner of record is ZZ TEST CITY OF. A mechanic’s lien does not attach.'
const press = () => screen.getByTestId('lien-public-take-off') as HTMLButtonElement

afterEach(() => {
  cleanup()
  readLienPublicProperty.mockReset()
  setLienPublicAnswer.mockReset()
})

describe('LienPublicPropertyWindow', () => {
  const open = async (onClose = vi.fn()) => {
    readLienPublicProperty.mockResolvedValue(READ)
    renderWithProviders(<LienPublicPropertyWindow addressId="addr-1" onClose={onClose} />)
    await screen.findByText('523 · ZZ Test Hills')
    return onClose
  }

  it('lists every job at the property with its money and what went out, names the one Collections will hold, and fills the reason in', async () => {
    await open()
    expect(readLienPublicProperty).toHaveBeenCalledWith('addr-1')
    expect(screen.getByRole('dialog', { name: 'Take this property off the lien path?' })).toBeTruthy()
    expect(screen.getByText('100 Sample Rd, Sampletown · owner of record ZZ TEST CITY OF')).toBeTruthy()
    const rows = [...document.querySelectorAll('[data-lien-public-job]')] as HTMLElement[]
    expect(rows.map((r) => r.getAttribute('data-lien-public-job'))).toEqual(['j523', 'j883'])
    expect(rows[0]!.textContent).toContain('$29,323')
    expect(rows[0]!.textContent).toContain('No lien paper has gone out. Four months were missed.')
    expect(rows[0]!.querySelector('[data-lien-public-list-note]')!.textContent).toBe('523 is still being worked, so it cannot go on the Collections list yet. It still leaves the lien path.')
    expect(rows[1]!.textContent).toContain('A lien notice was mailed Oct 8. An affidavit was approved Nov 11 and not filed.')
    expect(rows[1]!.querySelector('[data-lien-public-list-note]')).toBeNull()
    expect(rows.every((r) => (r.querySelector('input[type="checkbox"]') as HTMLInputElement).checked)).toBe(true)
    expect((screen.getByLabelText('Why this property is off the lien path') as HTMLTextAreaElement).value).toBe(REASON)
    expect(document.querySelector('[data-lien-public-bond="unknown"]')!.getAttribute('aria-checked')).toBe('true')
    expect([...document.querySelectorAll('[data-lien-public-does] li')].map((l) => l.textContent)).toEqual([
      'Both jobs leave the lien bins. Nothing is filed and nothing is deleted.',
      'Every job at this address, now and later, stays off the lien path.',
      '883 goes on the attorney’s list for a bond claim, with what already went out.',
    ])
    expect(press().textContent).toBe('Take 2 jobs off the lien path ▸')
    expect(press().disabled).toBe(false)
  })

  it('the press stores the answer, sends each ticked job with its own note, leaves an unknown bond alone, and keeps the held job in sight with the function’s reason', async () => {
    const onClose = await open()
    setLienPublicAnswer.mockResolvedValue({
      answer: 'public',
      jobs: [
        { job_id: 'j523', bond_set: false, on_attorney_list: false, already_on_list: false, held: 'Job must be in Billed Awaiting Payment to change Collections' },
        { job_id: 'j883', bond_set: false, on_attorney_list: true, already_on_list: false, held: null },
      ],
    })
    fireEvent.click(press())
    await waitFor(() => expect(setLienPublicAnswer).toHaveBeenCalledTimes(1))
    expect(setLienPublicAnswer).toHaveBeenCalledWith({
      addressId: 'addr-1',
      answer: 'public',
      reason: REASON,
      jobs: [
        { job_id: 'j523', note: `${REASON} No lien paper has gone out. Four months were missed.` },
        { job_id: 'j883', note: `${REASON} A lien notice was mailed Oct 8. An affidavit was approved Nov 11 and not filed.` },
      ],
      bond: null,
    })
    const held = await screen.findByText('This job did not go on the attorney’s list. It left the lien path all the same.')
    expect(held).toBeTruthy()
    expect(document.querySelector('[data-lien-public-held-job="j523"]')!.textContent).toContain('Job must be in Billed Awaiting Payment to change Collections')
    expect(screen.getAllByText('The property is off the lien path. 883 is on the attorney’s list. 523 did not go on it.').length).toBeGreaterThan(0)
    expect(onClose).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: 'Close' }))
    expect(onClose).toHaveBeenCalledWith(true)
  })

  it('a known bond is written, an unticked job is not sent, and with every job going to the attorney the window closes', async () => {
    const onClose = await open()
    setLienPublicAnswer.mockResolvedValue({ answer: 'public', jobs: [{ job_id: 'j883', bond_set: true, on_attorney_list: true, already_on_list: false, held: null }] })
    fireEvent.click(document.querySelector('[data-lien-public-bond="no"]') as HTMLElement)
    fireEvent.click(screen.getByLabelText('Put 523 · ZZ Test Hills on the attorney’s list'))
    expect([...document.querySelectorAll('[data-lien-public-does] li')][0]!.textContent).toBe('Both jobs leave the lien bins. Nothing is filed and nothing is deleted.')
    fireEvent.click(press())
    await waitFor(() => expect(onClose).toHaveBeenCalledWith(true))
    expect(setLienPublicAnswer.mock.calls[0]![0]).toMatchObject({ bond: 'no', jobs: [{ job_id: 'j883' }] })
  })

  it('asks for a reason before the press, and a refusal says why and keeps the window', async () => {
    const onClose = await open()
    fireEvent.change(screen.getByLabelText('Why this property is off the lien path'), { target: { value: '  ' } })
    expect(press().disabled).toBe(true)
    expect(screen.getByText('Say why in a few words. The reason goes with each job.')).toBeTruthy()
    fireEvent.change(screen.getByLabelText('Why this property is off the lien path'), { target: { value: 'City land.' } })
    setLienPublicAnswer.mockRejectedValue(new Error('Read-only (training) mode: changes are blocked.'))
    fireEvent.click(press())
    expect(await screen.findByText('The property is still on the lien path: Read-only (training) mode: changes are blocked.')).toBeTruthy()
    expect(onClose).not.toHaveBeenCalled()
    expect(press().textContent).toBe('Take 2 jobs off the lien path ▸')
  })

  it('a read that fails says why and offers to try again', async () => {
    readLienPublicProperty.mockRejectedValueOnce(new Error('network down')).mockResolvedValueOnce(READ)
    renderWithProviders(<LienPublicPropertyWindow addressId="addr-1" onClose={() => {}} />)
    expect(await screen.findByText('The property could not be read: network down')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }))
    expect(await screen.findByText('523 · ZZ Test Hills')).toBeTruthy()
  })
})

describe('LienPublicQuestion · the record asks once', () => {
  it('No, it is private stores the answer, and Yes opens the window', async () => {
    const onAnswered = vi.fn()
    setLienPublicAnswer.mockResolvedValue({ answer: 'private', jobs: [] })
    renderWithProviders(<LienPublicQuestion addressId="addr-1" canAnswer onAnswered={onAnswered} />)
    expect(document.querySelector('[data-lien-public-question]')!.textContent).toContain('This owner reads as a public body. A mechanic’s lien does not attach to public property. Is this public property?')
    fireEvent.click(screen.getByRole('button', { name: 'No, it is private' }))
    await waitFor(() => expect(onAnswered).toHaveBeenCalledWith('private'))
    expect(setLienPublicAnswer).toHaveBeenCalledWith({ addressId: 'addr-1', answer: 'private' })
    readLienPublicProperty.mockReturnValue(new Promise(() => {}))
    fireEvent.click(screen.getByRole('button', { name: 'Yes, public property…' }))
    expect(await screen.findByText('Reading the jobs at this property…')).toBeTruthy()
  })

  it('anyone outside the lien office reads the question without presses', () => {
    renderWithProviders(<LienPublicQuestion addressId="addr-1" canAnswer={false} onAnswered={() => {}} />)
    expect(screen.queryByRole('button', { name: 'Yes, public property…' })).toBeNull()
    expect(screen.getByText('The office answers this. Until then the lien papers here hold.')).toBeTruthy()
  })

  it('an answered record says so: Ask again clears a private answer, and a public one opens the put-back window', async () => {
    const onAnswered = vi.fn()
    setLienPublicAnswer.mockResolvedValue({ answer: null, jobs: [] })
    renderWithProviders(<LienPublicAnswerLine addressId="addr-1" answer="private" answeredAt="2026-11-16T18:00:00Z" canAnswer onAnswered={onAnswered} />)
    expect(screen.getByText('Not public property, answered Nov 16. Its lien papers can go out.')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Ask again' }))
    await waitFor(() => expect(onAnswered).toHaveBeenCalledWith(null))
    expect(setLienPublicAnswer).toHaveBeenCalledWith({ addressId: 'addr-1', answer: 'unanswered' })
    cleanup()
    readLienPublicProperty.mockReturnValue(new Promise(() => {}))
    renderWithProviders(<LienPublicAnswerLine addressId="addr-1" answer="public" answeredAt="2026-11-16T18:00:00Z" canAnswer onAnswered={() => {}} />)
    expect(screen.getByText('Public property, answered Nov 16. Every job here is off the lien path.')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Put it back on the lien path…' }))
    expect(screen.getByRole('dialog', { name: 'Put this property back on the lien path?' })).toBeTruthy()
  })
})

describe('LienPublicPutBackWindow', () => {
  it('asks why, then puts every job at the property back with the reason', async () => {
    readLienPublicProperty.mockResolvedValue({ ...READ, answer: 'public', reason: 'City land.' })
    setLienPublicAnswer.mockResolvedValue({ answer: null, jobs: [] })
    const onClose = vi.fn()
    renderWithProviders(<LienPublicPutBackWindow addressId="addr-1" onClose={onClose} />)
    await screen.findByText('523 · ZZ Test Hills')
    expect(screen.getByText('City land.')).toBeTruthy()
    const putBack = screen.getByTestId('lien-public-put-back-press') as HTMLButtonElement
    expect(putBack.textContent).toBe('Put 2 jobs back on the lien path ▸')
    expect(putBack.disabled).toBe(true)
    fireEvent.change(screen.getByLabelText('Why this property goes back on the lien path'), { target: { value: 'The county sold the lot.' } })
    fireEvent.click(putBack)
    await waitFor(() => expect(onClose).toHaveBeenCalledWith(true))
    expect(setLienPublicAnswer).toHaveBeenCalledWith({ addressId: 'addr-1', answer: 'unanswered', reason: 'The county sold the lot.' })
  })
})
