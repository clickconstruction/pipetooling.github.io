// @vitest-environment jsdom
/**
 * The two small windows the Workbench's price cards open, as their own pieces (decomposition queue
 * row 1). Both draw and report, so every case is a prop in and a call out. The tab's own smoke
 * (`BidsPricingTab.render.test.tsx`) opens both from the screen.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { AddPriceOptionWindow, PricingEditWindow } from './PricingPriceWindows'

afterEach(cleanup)

describe('PricingEditWindow', () => {
  const setup = (over: Partial<Parameters<typeof PricingEditWindow>[0]> = {}) => {
    const calls = { name: vi.fn(), del: vi.fn(), close: vi.fn(), save: vi.fn() }
    render(<PricingEditWindow name="Alternate 1" deleteBlocked={null} onNameChange={calls.name} onDelete={calls.del} onClose={calls.close} onSave={calls.save} {...over} />)
    return calls
  }
  const win = () => screen.getByRole('dialog', { name: 'Price' })

  it('shows the name and reports what is typed', () => {
    const calls = setup()
    const box = screen.getByLabelText('Name') as HTMLInputElement
    expect(box.value).toBe('Alternate 1')
    fireEvent.change(box, { target: { value: 'Value option' } })
    expect(calls.name).toHaveBeenCalledWith('Value option')
  })

  it('Enter in the box and the Save button both save', () => {
    const calls = setup()
    fireEvent.keyDown(screen.getByLabelText('Name'), { key: 'Enter' })
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))
    expect(calls.save).toHaveBeenCalledTimes(2)
    expect(calls.close).not.toHaveBeenCalled()
  })

  it('Cancel, Escape and a press outside close; a press inside does not', () => {
    const calls = setup()
    fireEvent.click(win())
    expect(calls.close).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    fireEvent.keyDown(win(), { key: 'Escape' })
    fireEvent.click(screen.getByRole('presentation'))
    expect(calls.close).toHaveBeenCalledTimes(3)
  })

  it('a price that can go has a live Delete, and Delete reports', () => {
    const calls = setup()
    const del = screen.getByRole('button', { name: 'Delete' }) as HTMLButtonElement
    expect(del.disabled).toBe(false)
    expect(del.title).toBe('Delete this price')
    fireEvent.click(del)
    expect(calls.del).toHaveBeenCalledTimes(1)
  })

  it("a price a letter is built on has a dead Delete that says why", () => {
    const why = "The GC's letter is built on this price — make another price the base first."
    const calls = setup({ deleteBlocked: why })
    const del = screen.getByRole('button', { name: 'Delete' }) as HTMLButtonElement
    expect(del.disabled).toBe(true)
    expect(del.title).toBe(why)
    fireEvent.click(del)
    expect(calls.del).not.toHaveBeenCalled()
  })
})

describe('AddPriceOptionWindow', () => {
  const OPTIONS = [
    { id: 'base', name: 'Base price', isBase: true },
    { id: 'alt', name: 'Alternate 1', isBase: false },
  ]
  const setup = (over: Partial<Parameters<typeof AddPriceOptionWindow>[0]> = {}) => {
    const calls = { change: vi.fn(), close: vi.fn(), create: vi.fn() }
    render(
      <AddPriceOptionWindow
        gc="North Builders"
        gcShort="North Builders"
        options={OPTIONS}
        value={{ name: '', fromId: 'base', offer: true }}
        defaultName="Alternate 2"
        busy={false}
        onChange={calls.change}
        onClose={calls.close}
        onCreate={calls.create}
        {...over}
      />,
    )
    return calls
  }
  const win = () => screen.getByRole('dialog', { name: 'Another price for North Builders' })
  const nameBox = () => screen.getByPlaceholderText('Alternate 2') as HTMLInputElement

  it('names the GC, offers the prices to start from and marks the base', () => {
    setup()
    expect(win().textContent).toContain('Another price for North Builders')
    expect(screen.getAllByRole('option').map((o) => o.textContent)).toEqual(['Base price · ★ base', 'Alternate 1'])
    expect((screen.getByRole('combobox') as HTMLSelectElement).value).toBe('base')
    expect(win().textContent).toContain('Offer it to North Builders as an alternate right away')
    expect((screen.getByRole('checkbox') as HTMLInputElement).checked).toBe(true)
  })

  it('reports the name, the start price and the offer as they change', () => {
    const calls = setup()
    fireEvent.change(nameBox(), { target: { value: 'Value option' } })
    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'alt' } })
    fireEvent.click(screen.getByRole('checkbox'))
    expect(calls.change.mock.calls).toEqual([[{ name: 'Value option' }], [{ fromId: 'alt' }], [{ offer: false }]])
  })

  it('a start price that is no price reports null, never an empty id', () => {
    const calls = setup()
    fireEvent.change(screen.getByRole('combobox'), { target: { value: '' } })
    expect(calls.change).toHaveBeenCalledWith({ fromId: null })
  })

  it('Create with the box empty uses the default name', () => {
    const calls = setup()
    fireEvent.click(screen.getByRole('button', { name: 'Create' }))
    expect(calls.create).toHaveBeenCalledWith('Alternate 2', 'base', true)
  })

  it('Create and Enter send the typed name, trimmed, with the start price and the offer', () => {
    const calls = setup({ value: { name: '  Value option ', fromId: 'alt', offer: false } })
    fireEvent.click(screen.getByRole('button', { name: 'Create' }))
    fireEvent.keyDown(nameBox(), { key: 'Enter' })
    expect(calls.create.mock.calls).toEqual([
      ['Value option', 'alt', false],
      ['Value option', 'alt', false],
    ])
  })

  it('Cancel and a press outside close; a press inside does not', () => {
    const calls = setup()
    fireEvent.click(win())
    expect(calls.close).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    fireEvent.click(win().parentElement as HTMLElement)
    expect(calls.close).toHaveBeenCalledTimes(2)
  })

  it('while a price is being created the window holds still', () => {
    const calls = setup({ busy: true })
    expect((screen.getByRole('button', { name: 'Cancel' }) as HTMLButtonElement).disabled).toBe(true)
    const create = screen.getByRole('button', { name: 'Creating…' }) as HTMLButtonElement
    expect(create.disabled).toBe(true)
    fireEvent.click(win().parentElement as HTMLElement)
    expect(calls.close).not.toHaveBeenCalled()
  })

  it('with no price to start from, Create is dead', () => {
    setup({ options: [], value: { name: '', fromId: null, offer: true } })
    expect((screen.getByRole('button', { name: 'Create' }) as HTMLButtonElement).disabled).toBe(true)
  })
})
