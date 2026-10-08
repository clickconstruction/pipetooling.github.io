// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { GcBillCustomerWindow } from './GcBillCustomer'
import { initialGcState } from '../../lib/gc/schedule/testState'
import type { GcProject } from '../../lib/gc/types'
import { installDomShims } from '../../test/renderSmokeMocks'

installDomShims()

/** Fair Oaks D with its made-up bills, the last one still waiting on the architect. */
function setup(over: Partial<GcProject> = {}, waived: number[] = []) {
  const state = initialGcState()
  const fairOaks = state.projects.find((p) => p.id === 'fairoaksd')!
  const billing = fairOaks.ownerBilling!
  const apps = billing.payApps!
  const last = apps[apps.length - 1]!
  const project: GcProject = {
    ...fairOaks,
    ownerBilling: { ...billing, payApps: [...apps.slice(0, -1), { ...last, certified: null, certifiedOn: null }] },
    ...over,
  }
  const laid = { ...state, projects: state.projects.map((p) => (p.id === project.id ? project : p)) }
  const writes = { onSend: vi.fn(), onCertify: vi.fn(), onSetRetainage: vi.fn(), onDownload: vi.fn(), onWaiver: vi.fn() }
  render(<GcBillCustomerWindow state={laid} project={project} today="2026-10-26" writes={writes} waived={waived} onClose={() => undefined} />)
  return { writes, last }
}

describe('GcBillCustomerWindow', () => {
  it('sends this month\'s bill and opens its form', () => {
    const { writes, last } = setup()
    const next = last.number + 1
    fireEvent.click(screen.getByRole('button', { name: `Send pay application ${next}` }))
    expect(writes.onSend).toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: 'See the form in Excel' }))
    expect(writes.onDownload).toHaveBeenCalledWith('draft', 'xlsx')
    fireEvent.click(screen.getByRole('button', { name: 'See the form as a PDF' }))
    expect(writes.onDownload).toHaveBeenCalledWith('draft', 'pdf')
    expect(screen.getByText('This bill asks')).toBeTruthy()
  })

  it('records the architect\'s certificate, and asks why when it is less', () => {
    const { writes, last } = setup()
    expect(screen.getByText('waiting on the architect')).toBeTruthy()
    const record = screen.getByRole('button', { name: 'Record the certificate' }) as HTMLButtonElement
    expect(record.disabled).toBe(false)
    fireEvent.change(screen.getByLabelText(`What the architect certified on pay application ${last.number}`), { target: { value: '1000' } })
    expect(record.disabled).toBe(true)
    fireEvent.change(screen.getByLabelText(`Why the certificate on pay application ${last.number} is less`), { target: { value: 'Held the framing' } })
    fireEvent.click(record)
    expect(writes.onCertify).toHaveBeenCalledWith(last.number, 1000, '2026-10-26', 'Held the framing')
  })

  it('changes the retainage to one that goes down partway', () => {
    const { writes } = setup()
    fireEvent.click(screen.getByRole('button', { name: 'Change the retainage' }))
    fireEvent.change(screen.getByLabelText('Percent they hold'), { target: { value: '5' } })
    fireEvent.click(screen.getByLabelText('It goes down partway'))
    fireEvent.change(screen.getByLabelText('They hold'), { target: { value: '2.5' } })
    expect(screen.getByText('They will hold 5% until the work is half done, then 2.5% on the rest.')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Save the retainage' }))
    expect(writes.onSetRetainage).toHaveBeenCalledWith(5, { atPct: 50, toPct: 2.5, way: 'after' })
  })

  it('makes our conditional waiver for a sent one, and says when it went', () => {
    const { writes, last } = setup({}, [1, 2])
    expect(screen.getAllByText('our waiver went with it')).toHaveLength(2)
    const make = screen.getAllByRole('button', { name: 'Make our conditional waiver' })
    expect(make).toHaveLength(last.number - 2)
    fireEvent.click(make[0]!)
    expect(writes.onWaiver).toHaveBeenCalledWith(last.number)
  })

  it('asks for the contract to be marked signed before the first bill', () => {
    setup({ ownerContractSignedOn: null })
    expect(screen.queryByRole('button', { name: /Send pay application/ })).toBeNull()
    expect(document.body.textContent).toContain('is not marked signed yet')
  })
})
