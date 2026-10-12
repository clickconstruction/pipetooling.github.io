// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { NewPaperDraft, SavedPaper } from '../../../lib/flows/newPaper'
import { installDomShims } from '../../../test/renderSmokeMocks'

installDomShims()

const ID = '0b5e3c1e-2f4a-4c1b-9d7e-1a2b3c4d5e6f'
let result: () => Promise<SavedPaper & { clauses: number; told?: { names: string[]; pushSent: number; emailSent: number } | null }> = () => Promise.reject(new Error('no answer'))
const saves: { flow: string; draft: NewPaperDraft }[] = []
vi.mock('../../../lib/flows/newPaperIo', () => ({
  saveFlowPaper: (flow: string, draft: NewPaperDraft) => {
    saves.push({ flow, draft })
    return result()
  },
}))
const { GcNewPaperWindow } = await import('./GcNewPaperWindow')

const onSaved = vi.fn()
const onClose = vi.fn()
const open = (flowKind: 'trade' | 'customer' | 'arch' = 'trade') =>
  render(<GcNewPaperWindow flowKind={flowKind} step={{ id: 'papers', name: 'Papers in' }} trades={['Sitework', 'Electrical']} onClose={onClose} onSaved={onSaved} />)
const win = () => within(screen.getByRole('dialog', { name: 'A new paper' }))

describe('GcNewPaperWindow', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    saves.length = 0
  })

  it('asks for the kind first, and says where the paper turns on', () => {
    open()
    expect(win().getByText('Papers in')).toBeTruthy()
    expect(win().getByText(/in the trade partner flow/)).toBeTruthy()
    fireEvent.click(win().getByRole('button', { name: 'Save' }))
    expect(win().getByRole('alert').textContent).toBe('Pick what kind of paper it is.')
    expect(saves).toHaveLength(0)
  })

  it('adds an upload that runs out, and hands the editor the paper with its one fact', async () => {
    result = () => Promise.resolve({ paperId: `doc:${ID}`, factIds: [`doc:${ID}:current`], label: 'Bond', kind: 'upload', state: 'published', clauses: 0 })
    open()
    fireEvent.click(win().getByRole('button', { name: /They give it to us/ }))
    fireEvent.change(win().getByLabelText('What it is called'), { target: { value: 'their bond' } })
    fireEvent.change(win().getByLabelText('In Spanish'), { target: { value: 'su fianza' } })
    fireEvent.change(win().getByLabelText('Does it run out?'), { target: { value: 'yes' } })
    fireEvent.change(win().getByLabelText('Days before it runs out'), { target: { value: '45' } })
    expect(win().getByText('Their bond is on file and its date is ahead of today. Their upload in the portal, or one we file by hand, finishes Papers in.')).toBeTruthy()
    fireEvent.click(win().getByRole('button', { name: 'Save' }))
    await waitFor(() => expect(onSaved).toHaveBeenCalledWith(expect.objectContaining({ paperId: `doc:${ID}`, factIds: [`doc:${ID}:current`] })))
    expect(saves[0]).toMatchObject({ flow: 'trade', draft: { kind: 'upload', name: 'their bond', nameEs: 'su fianza', runsOut: true, renewAskDays: 45 } })
    expect(win().getByRole('status').textContent).toBe('Bond is a paper now. Their upload finishes Papers in.')
    expect(win().getByRole('button', { name: 'Close' })).toBeTruthy()
  })

  it('writes a contract’s clauses, one kept to a trade, and says whom the approvers’ push and email reached', async () => {
    result = () => Promise.resolve({ paperId: `doc:${ID}`, factIds: [`doc:${ID}:signed`], label: 'Safety agreement', kind: 'contract', state: 'proposed', clauses: 2, told: { names: ['Maria', 'Robert'], pushSent: 2, emailSent: 2 } })
    open()
    fireEvent.click(win().getByRole('button', { name: /We write it, they sign it/ }))
    fireEvent.click(win().getByRole('button', { name: 'Save' }))
    expect(win().getByRole('alert').textContent).toBe('Give it a name. A contract needs at least one clause.')
    fireEvent.change(win().getByLabelText('What it is called'), { target: { value: 'the safety agreement' } })
    fireEvent.change(win().getByLabelText('Clause 1 in English'), { target: { value: 'Tie off above six feet.' } })
    fireEvent.click(win().getByRole('button', { name: 'Add a clause' }))
    fireEvent.change(win().getByLabelText('Clause 2 in English'), { target: { value: 'A locate before any dig.' } })
    fireEvent.change(win().getByLabelText('Who clause 2 is for'), { target: { value: 'Sitework' } })
    fireEvent.click(win().getByRole('button', { name: 'Save' }))
    await waitFor(() => expect(onSaved).toHaveBeenCalled())
    expect(saves[0]?.draft.clauses).toEqual([
      { en: 'Tie off above six feet.', es: '', scope: ['all'] },
      { en: 'A locate before any dig.', es: '', scope: ['Sitework'] },
    ])
    expect(win().getByRole('status').textContent).toBe('Safety agreement is saved with 2 clauses. Maria and Robert got a push and an email to approve them.')
  })

  it('asks a notice for its words, and says a refused save in words', async () => {
    result = () => Promise.reject(new Error('Only the office adds a paper.'))
    open('customer')
    fireEvent.click(win().getByRole('button', { name: /We send it to inform/ }))
    fireEvent.change(win().getByLabelText('What it is called'), { target: { value: 'the start letter' } })
    fireEvent.click(win().getByRole('button', { name: 'Save' }))
    expect(win().getByRole('alert').textContent).toBe('Write the notice.')
    fireEvent.change(win().getByLabelText('The words in English'), { target: { value: 'Dear {person}, we start on {start}.' } })
    fireEvent.click(win().getByRole('button', { name: 'Save' }))
    await waitFor(() => expect(win().getByRole('alert').textContent).toBe('Only the office adds a paper.'))
    expect(onSaved).not.toHaveBeenCalled()
  })

  it('closes on Not now and on Escape', () => {
    open()
    fireEvent.click(win().getByRole('button', { name: 'Not now' }))
    fireEvent.keyDown(window, { key: 'Escape' })
    expect(onClose).toHaveBeenCalledTimes(2)
  })
})
