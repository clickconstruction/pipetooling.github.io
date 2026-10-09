// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { GcBillCloseout } from './GcBillCloseout'
import { initialGcState } from '../../lib/gc/schedule/testState'
import type { GcProject, GcState } from '../../lib/gc/types'
import { installDomShims } from '../../test/renderSmokeMocks'

installDomShims()
afterEach(cleanup)

/** Stone Oak: every line billed, Cool Breeze still to send its final, and nothing accepted unless `over` says so. */
function setup(over: (p: GcProject) => Partial<GcProject> = () => ({})) {
  const state = initialGcState()
  const stoneOak = state.projects.find((p) => p.id === 'stoneoak')!
  const project: GcProject = { ...stoneOak, ...over(stoneOak) }
  const laid: GcState = { ...state, projects: state.projects.map((p) => (p.id === project.id ? project : p)) }
  const writes = { onAccept: vi.fn(), onSendFinal: vi.fn() }
  render(<GcBillCloseout state={laid} project={project} today="2026-10-26" writes={writes} />)
  return { writes }
}

/** Cool Breeze sends its final: every trade's final is in. */
const coolBreezeFinal = (p: GcProject): Partial<GcProject> => ({
  packages: p.packages.map((pkg) => {
    if (pkg.id !== 'shvac' || !pkg.sow) return pkg
    const last = pkg.sow.draws[pkg.sow.draws.length - 1]!
    return { ...pkg, sow: { ...pkg.sow, draws: [...pkg.sow.draws, { ...last, id: 'shvac-final', number: last.number + 1, final: true, status: 'requested' as const }] } }
  }),
})

const accepted = (p: GcProject): Partial<GcProject> => ({ ownerBilling: { ...p.ownerBilling!, acceptedOn: '2026-10-07' } })

describe('GcBillCloseout', () => {
  it('walks the six steps, marks the next one, and lists the trade still to send its final', () => {
    setup()
    expect(screen.getByText('Closeout')).toBeTruthy()
    for (const label of ['Every line billed', 'Every trade’s final pay application', 'The customer accepts the work', 'Our final pay application', 'The architect certifies it', 'The customer pays it']) {
      expect(screen.getByText(label)).toBeTruthy()
    }
    expect(screen.getAllByText('done')).toHaveLength(1)
    expect(screen.getAllByText('next')).toHaveLength(1)
    expect(screen.getByText('Cool Breeze Mechanical has not sent it yet.')).toBeTruthy()
    // The final waits on every trade's final (the lead's call 1): no Send yet.
    expect(screen.queryByRole('button', { name: 'Send the final pay application' })).toBeNull()
  })

  it('records the acceptance once they say who walked it, on a day already here', () => {
    const { writes } = setup()
    const accept = screen.getByRole('button', { name: 'Accept the work' }) as HTMLButtonElement
    expect(accept.disabled).toBe(true)
    fireEvent.change(screen.getByLabelText('Who walked the job and accepted it'), { target: { value: '  Elena Ruiz ' } })
    expect(accept.disabled).toBe(false)
    fireEvent.change(screen.getByLabelText('The day they accepted the work'), { target: { value: '2026-10-27' } })
    expect(accept.disabled).toBe(true)
    fireEvent.change(screen.getByLabelText('The day they accepted the work'), { target: { value: '2026-10-07' } })
    fireEvent.change(screen.getByLabelText('A note on the acceptance'), { target: { value: 'Walked it with the architect. ' } })
    fireEvent.click(accept)
    expect(writes.onAccept).toHaveBeenCalledWith('2026-10-07', 'Elena Ruiz', 'Walked it with the architect.')
  })

  it('sends the final once every trade’s final and the acceptance are in, the email off to start', () => {
    const { writes } = setup((p) => ({ ...coolBreezeFinal(p), ...accepted(p) }))
    expect(screen.getByText('Accepted Oct 7.')).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Accept the work' })).toBeNull()
    const send = screen.getByRole('button', { name: 'Send the final pay application' })
    fireEvent.click(send)
    expect(writes.onSendFinal).toHaveBeenCalledWith(false)
    fireEvent.click(screen.getByRole('checkbox', { name: 'Email it to the customer and the architect now' }))
    fireEvent.click(send)
    expect(writes.onSendFinal).toHaveBeenLastCalledWith(true)
  })

  it('waits for the trades after the acceptance', () => {
    setup(accepted)
    expect(screen.queryByRole('button', { name: 'Send the final pay application' })).toBeNull()
    expect(screen.getByText('Cool Breeze Mechanical has not sent it yet.')).toBeTruthy()
  })

  it('shows nothing before every line is billed', () => {
    const state = initialGcState()
    const fairOaks = state.projects.find((p) => p.id === 'fairoaksd')!
    render(<GcBillCloseout state={state} project={fairOaks} today="2026-10-26" writes={{ onAccept: vi.fn(), onSendFinal: vi.fn() }} />)
    expect(screen.queryByText('Closeout')).toBeNull()
  })
})
