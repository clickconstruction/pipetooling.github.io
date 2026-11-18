// @vitest-environment jsdom
import { useState } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import EstimateDeliverySection, { type EstimateDeliverySectionProps } from './EstimateDeliverySection'
import { installDomShims } from '../../test/renderSmokeMocks'

const ME = { id: 'me', email: 'me@office.test' }

/** The section over real state for the notify list, so a functional setter is exercised as the page runs it. */
function Harness({ initial, onIds, over = {} }: { initial: string[]; onIds: (ids: string[]) => void; over?: Partial<EstimateDeliverySectionProps> }) {
  const [ids, setIds] = useState(initial)
  onIds(ids)
  return (
    <EstimateDeliverySection
      flash={false}
      stepDot={<span data-testid="dot">4</span>}
      user={ME}
      profileName="ZZ Office"
      acceptNotifyUserIds={ids}
      setAcceptNotifyUserIds={setIds}
      notifyUserOptions={[{ id: 'u2', name: 'ZZ Master', email: 'master@office.test', role: 'master_technician' }]}
      linkedProjectId=""
      setLinkedProjectId={vi.fn()}
      projectsForPicker={[{ id: 'p1', name: 'ZZ Project', project_number: null }]}
      internalNotes=""
      setInternalNotes={vi.fn()}
      {...over}
    />
  )
}

afterEach(cleanup)

describe('EstimateDeliverySection', () => {
  it('draws the step, who is told, the project and the notes', () => {
    installDomShims()
    render(<Harness initial={['me']} onIds={() => {}} />)
    expect(screen.getByRole('heading', { name: /Delivery/ })).toBeTruthy()
    expect(screen.getByTestId('dot')).toBeTruthy()
    expect(screen.getByText('The customer never sees this section.')).toBeTruthy()
    expect(screen.getByText('Email when customer accepts')).toBeTruthy()
    expect(screen.getByText('· ZZ Office')).toBeTruthy()
    expect(screen.getByText('· me@office.test')).toBeTruthy()
    expect(screen.getByText('Project')).toBeTruthy()
    expect(screen.getByText('Internal notes')).toBeTruthy()
  })

  it('Notify me adds and removes the person editing, and leaves the others', () => {
    installDomShims()
    let ids: string[] = []
    render(<Harness initial={['u2']} onIds={(v) => (ids = v)} />)
    const tick = screen.getByLabelText(/Notify me/) as HTMLInputElement
    expect(tick.checked).toBe(false)
    fireEvent.click(tick)
    expect(ids).toEqual(['me', 'u2'])
    fireEvent.click(screen.getByLabelText(/Notify me/))
    expect(ids).toEqual(['u2'])
  })

  it('pulses when the step rail jumps to it', () => {
    installDomShims()
    const { container, rerender } = render(<Harness initial={[]} onIds={() => {}} />)
    const section = container.querySelector('#est-step-delivery')!
    expect(section.className).toBe('est-backstage-card est-region-tint')
    rerender(<Harness initial={[]} onIds={() => {}} over={{ flash: true }} />)
    expect(section.className).toBe('est-backstage-card est-region-tint estimate-customer-search-highlight')
  })

  it('hands a typed note to the page', () => {
    installDomShims()
    const setInternalNotes = vi.fn()
    const { container } = render(<Harness initial={[]} onIds={() => {}} over={{ setInternalNotes }} />)
    fireEvent.change(container.querySelector('textarea')!, { target: { value: 'ZZ gate code' } })
    expect(setInternalNotes).toHaveBeenCalledWith('ZZ gate code')
  })

  it('draws no Notify me with nobody signed in', () => {
    installDomShims()
    render(<Harness initial={[]} onIds={() => {}} over={{ user: null }} />)
    expect(screen.queryByLabelText(/Notify me/)).toBeNull()
  })
})
