// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest'
import { fireEvent, screen } from '@testing-library/react'
import { renderWithProviders } from '../../test/renderSmokeMocks'
import { BridgeLeftOut } from './BridgeLeftOut'
import type { LeftOutRule } from '../../lib/bridge/leftOut'

// Made-up developments, customers and addresses.
const developments = [
  { id: 'dev-1', name: 'Oak Hollow' },
  { id: 'dev-2', name: 'Cedar Bend' },
]
const customers = [{ id: 'cust-1', name: 'Ridgeway Builders' }]
const oak: LeftOutRule = { kind: 'development', key: 'dev-1', label: 'Oak Hollow' }

describe('BridgeLeftOut', () => {
  it('says what is left out in one line and keeps the list folded until Change is pressed', () => {
    renderWithProviders(<BridgeLeftOut rules={[oak]} isDefault={false} developments={developments} customers={customers} jobCount={12} onChange={() => {}} />)
    expect(screen.getByTestId('bridge-left-out-words').textContent).toBe('Leaves out Oak Hollow.')
    expect(screen.queryByTestId('bridge-left-out-panel')).toBeNull()
    fireEvent.click(screen.getByTestId('bridge-left-out-toggle'))
    expect(screen.getByTestId('bridge-left-out-panel').textContent).toContain('Today that is 12 jobs.')
    expect(screen.getByTestId('bridge-left-out-panel').textContent).not.toContain('has not been saved')
  })

  it('offers the developments not on the list yet, and leaves one out on its press', () => {
    const onChange = vi.fn()
    renderWithProviders(<BridgeLeftOut rules={[oak]} isDefault={false} developments={developments} customers={customers} jobCount={null} onChange={onChange} />)
    fireEvent.click(screen.getByTestId('bridge-left-out-toggle'))
    expect(screen.getAllByTestId('bridge-left-out-match').map((b) => b.textContent)).toEqual(['Leave out Cedar Bend'])
    fireEvent.click(screen.getByRole('button', { name: 'Leave out Cedar Bend' }))
    expect(onChange).toHaveBeenCalledWith([oak, { kind: 'development', key: 'dev-2', label: 'Cedar Bend' }])
  })

  it('puts a thing back on its press', () => {
    const onChange = vi.fn()
    renderWithProviders(<BridgeLeftOut rules={[oak]} isDefault={false} developments={developments} customers={customers} jobCount={3} onChange={onChange} />)
    fireEvent.click(screen.getByTestId('bridge-left-out-toggle'))
    fireEvent.click(screen.getByRole('button', { name: 'Put Oak Hollow back' }))
    expect(onChange).toHaveBeenCalledWith([])
  })

  it('finds a customer by its letters, and takes an address only once it is long enough to mean one place', () => {
    const onChange = vi.fn()
    renderWithProviders(<BridgeLeftOut rules={[]} isDefault developments={developments} customers={customers} jobCount={0} onChange={onChange} />)
    expect(screen.getByTestId('bridge-left-out-words').textContent).toBe('Nothing is left out.')
    fireEvent.click(screen.getByTestId('bridge-left-out-toggle'))
    expect(screen.getByTestId('bridge-left-out-panel').textContent).toContain('This list has not been saved yet.')
    fireEvent.click(screen.getByTestId('bridge-left-out-kind-customer'))
    fireEvent.change(screen.getByTestId('bridge-left-out-input'), { target: { value: 'ridge' } })
    expect(screen.getAllByTestId('bridge-left-out-match').map((b) => b.textContent)).toEqual(['Leave out Ridgeway Builders'])
    fireEvent.click(screen.getByTestId('bridge-left-out-kind-address'))
    const add = screen.getByTestId('bridge-left-out-add-address') as HTMLButtonElement
    fireEvent.change(screen.getByTestId('bridge-left-out-input'), { target: { value: '48 q' } })
    expect(add.disabled).toBe(true)
    fireEvent.change(screen.getByTestId('bridge-left-out-input'), { target: { value: '48 Quarry Road' } })
    expect(add.disabled).toBe(false)
    fireEvent.click(add)
    expect(onChange).toHaveBeenCalledWith([{ kind: 'address', key: '48 quarry road', label: '48 Quarry Road' }])
  })
})
