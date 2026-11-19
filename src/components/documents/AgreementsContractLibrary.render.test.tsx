// @vitest-environment jsdom
/**
 * Documents → Agreements, the Contract library door: closed, it reads nothing; opened, it reads the library and hands
 * it to the window People → Contracts opens, with that page's role rules; a save reads again and tells the tab; Send
 * to… hands the paper's name up; and a read that fails says why and closes the door.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, screen, waitFor } from '@testing-library/react'
import { renderWithProviders } from '../../test/renderSmokeMocks'
import { AgreementsContractLibrary } from './AgreementsContractLibrary'

const io = vi.hoisted(() => ({ role: 'assistant' as string, reads: 0, fail: null as null | Error }))
vi.mock('../../hooks/useAuth', () => {
  const auth = () => ({ role: io.role, user: { id: 'u1' } })
  return { useAuth: auth, useOptionalAuth: auth }
})
vi.mock('../../lib/contracts/contractsLibraryIo', () => ({
  readContractsLibrary: async () => {
    io.reads += 1
    if (io.fail) throw io.fail
    return { templates: [{ id: 't1', name: 'New hire', sequence_order: 1 }], templateDocuments: [{ id: 'b1' }, { id: 'b2' }], assignments: [], personDocuments: [{ id: 'd1' }] }
  },
}))
// The window is its own file's: here it says what it was handed, and its buttons stand for a save and a Send to….
vi.mock('../contracts/ContractLibraryModal', () => ({
  ContractLibraryModal: (p: { templates: unknown[]; templateDocuments: unknown[]; personDocuments: unknown[]; canDeletePeopleContracts: boolean; canUseFormStudio?: boolean; onSaved: () => void; onQuickSend: (n: string) => void; onClose: () => void }) => (
    <div data-testid="library-window">
      {`${p.templates.length}|${p.templateDocuments.length}|${p.personDocuments.length}|delete:${p.canDeletePeopleContracts}|forms:${p.canUseFormStudio}`}
      <button type="button" onClick={p.onSaved}>
        fake save
      </button>
      <button type="button" onClick={() => p.onQuickSend('W-9')}>
        fake send to
      </button>
    </div>
  ),
}))

beforeEach(() => {
  io.role = 'assistant'
  io.reads = 0
  io.fail = null
})
afterEach(() => cleanup())

describe('AgreementsContractLibrary', () => {
  it('reads nothing while closed', () => {
    renderWithProviders(<AgreementsContractLibrary open={false} onClose={() => {}} onQuickSend={() => {}} />)
    expect(io.reads).toBe(0)
    expect(screen.queryByTestId('library-window')).toBeNull()
  })

  it('opened, hands the library to the window; an assistant neither deletes nor sees Forms', async () => {
    renderWithProviders(<AgreementsContractLibrary open onClose={() => {}} onQuickSend={() => {}} />)
    expect((await screen.findByTestId('library-window')).textContent).toContain('1|2|1|delete:false|forms:false')
    expect(io.reads).toBe(1)
  })

  it('keeps People’s role rules: the owner deletes, the controller sees Forms, a dev does both', async () => {
    for (const [role, words] of [
      ['master_technician', 'delete:true|forms:false'],
      ['controller', 'delete:false|forms:true'],
      ['dev', 'delete:true|forms:true'],
    ] as const) {
      io.role = role
      renderWithProviders(<AgreementsContractLibrary open onClose={() => {}} onQuickSend={() => {}} />)
      expect((await screen.findByTestId('library-window')).textContent).toContain(words)
      cleanup()
    }
  })

  it('a save reads the library again and tells the tab; Send to… hands the paper’s name up', async () => {
    const onChanged = vi.fn()
    const onQuickSend = vi.fn()
    renderWithProviders(<AgreementsContractLibrary open onClose={() => {}} onQuickSend={onQuickSend} onChanged={onChanged} />)
    fireEvent.click(await screen.findByRole('button', { name: 'fake save' }))
    await waitFor(() => expect(io.reads).toBe(2))
    expect(onChanged).toHaveBeenCalledTimes(1)
    fireEvent.click(screen.getByRole('button', { name: 'fake send to' }))
    expect(onQuickSend).toHaveBeenCalledWith('W-9')
  })

  it('a read that fails says why and closes the door', async () => {
    io.fail = new Error('permission denied for table contract_templates')
    const onClose = vi.fn()
    renderWithProviders(<AgreementsContractLibrary open onClose={onClose} onQuickSend={() => {}} />)
    expect(await screen.findByText('permission denied for table contract_templates')).toBeTruthy()
    await waitFor(() => expect(onClose).toHaveBeenCalled())
    expect(screen.queryByTestId('library-window')).toBeNull()
  })
})
