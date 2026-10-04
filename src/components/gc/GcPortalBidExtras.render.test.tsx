// @vitest-environment jsdom
/**
 * Render smoke for "What your quote leaves out" on the trade's quote form (owner, 2026-10-04): a
 * tick per usual exclusion, a unit price under a ticked one, something else typed, and the names in
 * Spanish when the portal reads Spanish.
 */
import { useState } from 'react'
import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { ExclusionsEditor, type ExclusionDraft } from './GcPortalBidExtras'
import { PortalLangContext } from './gcPortalLang'

afterEach(cleanup)

let last: ExclusionDraft = []

function Harness({ start }: { start: ExclusionDraft }) {
  const [value, setValue] = useState(start)
  last = value
  return (
    <ExclusionsEditor
      value={value}
      onChange={(next) => {
        last = next
        setValue(next)
      }}
    />
  )
}

const start: ExclusionDraft = [
  { name: 'Rock excavation', on: false, amount: '', unit: '' },
  { name: 'Sales tax', on: false, amount: '', unit: '' },
]

describe('what your quote leaves out', () => {
  it('ticks one, gives it a unit price, and adds something else', () => {
    render(
      <PortalLangContext.Provider value="en">
        <Harness start={start} />
      </PortalLangContext.Provider>,
    )
    expect(screen.getByText('What your quote leaves out')).toBeTruthy()
    expect(screen.queryByLabelText('Price per unit, if it comes up')).toBeNull()
    fireEvent.click(screen.getByLabelText('Rock excavation'))
    fireEvent.change(screen.getByLabelText('Price per unit, if it comes up'), { target: { value: '38' } })
    fireEvent.change(screen.getByLabelText('The unit, like cy'), { target: { value: 'cy' } })
    fireEvent.change(screen.getByLabelText('Something else you exclude'), { target: { value: 'Trench shoring' } })
    fireEvent.click(screen.getByRole('button', { name: 'Add it' }))
    expect(last).toEqual([
      { name: 'Rock excavation', on: true, amount: '38', unit: 'cy' },
      { name: 'Sales tax', on: false, amount: '', unit: '' },
      { name: 'Trench shoring', said: 'Trench shoring', on: true, amount: '', unit: '' },
    ])
  })

  it('names them in Spanish', () => {
    render(
      <PortalLangContext.Provider value="es">
        <Harness start={start} />
      </PortalLangContext.Provider>,
    )
    expect(screen.getByText('Lo que su cotización no incluye')).toBeTruthy()
    expect(screen.getByLabelText('Excavación en roca')).toBeTruthy()
    expect(screen.getByLabelText('Impuesto sobre ventas')).toBeTruthy()
  })
})
