// @vitest-environment jsdom
import { useState } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import type { EstimateOption } from '../../lib/estimates/estimateOptions'
import EstimateOptionsStrip, { type EstimateOptionsStripProps } from './EstimateOptionsStrip'

function option(key: string, over: Partial<EstimateOption> = {}): EstimateOption {
  return { key, name: key, description: '', recommended: false, kind: 'choice', line_items: [{ line_item: `${key} line`, description: '', quantity: 1, unit_price_cents: 10_000, amount_cents: 10_000 }], ...over }
}

/** The strip over real option state, so the star and Start ticked run their functional setters as the page does. */
function Harness({ initial, viewed, over = {}, onState }: { initial: EstimateOption[]; viewed: string | null; over?: Partial<EstimateOptionsStripProps>; onState?: (options: EstimateOption[], preview: string[]) => void }) {
  const [options, setOptions] = useState(initial)
  const [preview, setPreview] = useState<string[]>([])
  onState?.(options, preview)
  const viewedOption = options.find((o) => o.key === viewed) ?? null
  return (
    <EstimateOptionsStrip
      estimateOptions={options}
      syncedEstimateOptions={options}
      viewedOptionKey={viewed}
      viewedOption={viewedOption}
      lines={viewedOption?.line_items ?? []}
      totalCents={10_000}
      switchViewedOption={vi.fn()}
      addEstimateOption={vi.fn()}
      patchViewedOption={vi.fn()}
      setViewedOptionKind={vi.fn()}
      removeViewedOption={vi.fn()}
      setEstimateOptions={setOptions}
      setPreviewSelectedOptionKeys={setPreview}
      {...over}
    />
  )
}

afterEach(cleanup)

describe('EstimateOptionsStrip', () => {
  it('is the one ＋ Option press on a plain estimate', () => {
    const addEstimateOption = vi.fn()
    render(<Harness initial={[]} viewed={null} over={{ addEstimateOption }} />)
    expect(screen.getAllByRole('button')).toHaveLength(1)
    fireEvent.click(screen.getByRole('button', { name: '＋ Option' }))
    expect(addEstimateOption).toHaveBeenCalledTimes(1)
    expect(screen.queryByLabelText('Option name')).toBeNull()
  })

  it('draws a card per option, marks the one being edited, and switches on a press', () => {
    const switchViewedOption = vi.fn()
    render(<Harness initial={[option('Repair', { recommended: true }), option('Replace')]} viewed="Repair" over={{ switchViewedOption }} />)
    const editing = screen.getByTitle('Editing this option')
    expect(editing.getAttribute('aria-pressed')).toBe('true')
    expect(editing.textContent).toContain('Repair')
    expect(editing.textContent).toContain('1 line item · editing')
    expect(screen.getByLabelText('Recommended')).toBeTruthy()
    fireEvent.click(screen.getByTitle('Edit this option'))
    expect(switchViewedOption).toHaveBeenCalledWith('Replace')
  })

  it('writes an add-on’s price with a plus while a choice is offered', () => {
    render(<Harness initial={[option('Repair', { recommended: true }), option('Camera', { kind: 'add_on' })]} viewed="Repair" />)
    expect(screen.getByTitle('Edit this option').textContent).toContain('+ $')
    expect(screen.getByTitle('Edit this option').textContent).toContain('+ add-on')
    expect(screen.getByTitle('Editing this option').textContent).toContain('one of the choices')
  })

  it('hands the name, the pitch, Offered as and Remove option to the page', () => {
    const patchViewedOption = vi.fn()
    const setViewedOptionKind = vi.fn()
    const removeViewedOption = vi.fn()
    render(<Harness initial={[option('Repair', { recommended: true }), option('Replace')]} viewed="Replace" over={{ patchViewedOption, setViewedOptionKind, removeViewedOption }} />)
    fireEvent.change(screen.getByLabelText('Option name'), { target: { value: 'Tankless' } })
    fireEvent.change(screen.getByLabelText('Option description'), { target: { value: 'Endless hot water' } })
    expect(patchViewedOption).toHaveBeenNthCalledWith(1, { name: 'Tankless' })
    expect(patchViewedOption).toHaveBeenNthCalledWith(2, { description: 'Endless hot water' })
    fireEvent.click(screen.getByRole('button', { name: 'An add-on' }))
    expect(setViewedOptionKind).toHaveBeenCalledWith('add_on')
    fireEvent.click(screen.getByRole('button', { name: 'Remove option' }))
    expect(removeViewedOption).toHaveBeenCalledTimes(1)
  })

  it('★ Recommended moves the star to the viewed choice', () => {
    let options: EstimateOption[] = []
    render(<Harness initial={[option('Repair', { recommended: true }), option('Replace')]} viewed="Replace" onState={(o) => (options = o)} />)
    fireEvent.click(screen.getByRole('button', { name: '★ Recommended' }))
    expect(options.map((o) => [o.key, o.recommended])).toEqual([
      ['Repair', false],
      ['Replace', true],
    ])
  })

  it('keeps the star off an add-on while a choice is offered', () => {
    render(<Harness initial={[option('Repair', { recommended: true }), option('Camera', { kind: 'add_on' })]} viewed="Camera" />)
    expect((screen.getByRole('button', { name: '★ Recommended' }) as HTMLButtonElement).disabled).toBe(true)
  })

  it('✓ Start ticked shows on an add-on only, and restarts the preview with it ticked', () => {
    let options: EstimateOption[] = []
    let preview: string[] = []
    const { unmount } = render(<Harness initial={[option('Repair', { recommended: true }), option('Camera', { kind: 'add_on' })]} viewed="Camera" onState={(o, p) => ((options = o), (preview = p))} />)
    fireEvent.click(screen.getByRole('button', { name: '✓ Start ticked' }))
    expect(options[1]!.preticked).toBe(true)
    expect(preview).toEqual(['Repair', 'Camera'])
    unmount()
    render(<Harness initial={[option('Repair', { recommended: true }), option('Replace')]} viewed="Repair" />)
    expect(screen.queryByRole('button', { name: '✓ Start ticked' })).toBeNull()
  })

  it('offers no ＋ Option at the cap', () => {
    render(<Harness initial={Array.from({ length: 6 }, (_, i) => option(`O${i}`, { recommended: i === 0 }))} viewed="O0" />)
    expect(screen.queryByRole('button', { name: '＋ Option' })).toBeNull()
  })
})
