// @vitest-environment jsdom
/**
 * The delete on a by-hand record (punch list #443, row 4): a dev reads it on a by-hand line, nobody else does, and
 * a record of a real bill stays and says why. Every name is made up.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, screen, waitFor } from '@testing-library/react'
import { renderWithProviders } from '../../test/renderSmokeMocks'
import { ByHandRecordDelete } from './ByHandRecordDelete'

const io = vi.hoisted(() => ({ role: 'dev', phone: false, asked: [] as string[], refuse: null as null | Error }))
vi.mock('../../hooks/useIsMobile', () => ({ useIsMobile: () => io.phone }))
vi.mock('../../hooks/useAuth', () => {
  const auth = () => ({ role: io.role, user: { id: 'u1' }, profileName: 'Priya' })
  return { useAuth: auth, useOptionalAuth: auth }
})
vi.mock('../../lib/billing/byHandRecordDeleteIo', () => ({
  deleteByHandRecord: async (id: string) => {
    if (io.refuse) throw io.refuse
    io.asked.push(id)
  },
}))

const line = (over: Partial<{ id: string; route: string; test: boolean; billId: string | null }> = {}) => ({ id: 'h1', route: 'by_hand', test: true, billId: 'b1', ...over })
const draw = (l = line()) => {
  const gone = { n: 0 }
  renderWithProviders(<ByHandRecordDelete line={l} head="Handed over by Priya" when="Tue, Nov 10" onGone={() => (gone.n += 1)} />)
  return gone
}

beforeEach(() => {
  io.role = 'dev'
  io.phone = false
  io.asked = []
  io.refuse = null
})
afterEach(cleanup)

describe('ByHandRecordDelete', () => {
  it('draws nothing for every role but a dev', () => {
    for (const role of ['master_technician', 'assistant', 'controller', 'estimator', 'primary', 'superintendent', 'subcontractor', 'helpers']) {
      io.role = role
      draw()
      expect(screen.queryByTestId('bills-sent-by-hand-delete')).toBeNull()
      cleanup()
    }
  })

  it('draws nothing for a dev on a send that is not a by-hand record', () => {
    for (const route of ['email', 'text', 'printed', 'statement', 'housecall_pro']) {
      draw(line({ route }))
      expect(screen.queryByTestId('bills-sent-by-hand-delete')).toBeNull()
      cleanup()
    }
  })

  it('deletes a test bill’s record after a confirm that names the act and reads the record back', async () => {
    const gone = draw()
    expect(screen.getByTestId('bills-sent-by-hand-delete').textContent).toContain('Only a developer sees this. It is for a record of a test bill.')
    fireEvent.click(screen.getByRole('button', { name: 'Delete this record…' }))
    const yes = await screen.findByRole('button', { name: 'Delete the record' })
    expect(screen.getByText('Delete this record made by hand?')).toBeTruthy()
    expect(screen.getByText('Handed over by Priya, Tue, Nov 10. It is a record of a test bill. The record leaves the bill, and it cannot be brought back.')).toBeTruthy()
    expect(io.asked).toEqual([])
    fireEvent.click(yes)
    await waitFor(() => expect(io.asked).toEqual(['h1']))
    await waitFor(() => expect(gone.n).toBe(1))
    expect(await screen.findByText('The record was deleted.')).toBeTruthy()
  })

  it('deletes nothing when the confirm is cancelled', async () => {
    const gone = draw()
    fireEvent.click(screen.getByRole('button', { name: 'Delete this record…' }))
    await screen.findByRole('button', { name: 'Delete the record' })
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    await waitFor(() => expect(screen.queryByRole('button', { name: 'Delete the record' })).toBeNull())
    expect(io.asked).toEqual([])
    expect(gone.n).toBe(0)
  })

  it('keeps a record of a real bill: a dead press, and the line says why', () => {
    draw(line({ test: false }))
    const press = screen.getByRole('button', { name: 'Delete this record…' }) as HTMLButtonElement
    expect(press.disabled).toBe(true)
    expect(screen.getByTestId('bills-sent-by-hand-delete').textContent).toContain('Only a record of a test bill can be deleted. This bill is a real one.')
    fireEvent.click(press)
    expect(screen.queryByRole('button', { name: 'Delete the record' })).toBeNull()
  })

  it('says the reason when the fresh read refuses, and the page is not read again', async () => {
    io.refuse = new Error('Only a record of a test bill can be deleted. This bill is a real one.')
    const gone = draw()
    fireEvent.click(screen.getByRole('button', { name: 'Delete this record…' }))
    fireEvent.click(await screen.findByRole('button', { name: 'Delete the record' }))
    expect(await screen.findByText('Only a record of a test bill can be deleted. This bill is a real one.')).toBeTruthy()
    expect(gone.n).toBe(0)
  })

  it('stands a thumb tall on a phone', () => {
    io.phone = true
    draw()
    expect((screen.getByRole('button', { name: 'Delete this record…' }) as HTMLButtonElement).style.minHeight).toBe('44px')
  })
})
