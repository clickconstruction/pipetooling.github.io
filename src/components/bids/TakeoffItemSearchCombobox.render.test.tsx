// @vitest-environment jsdom
/**
 * Render tests for TakeoffItemSearchCombobox (v2.1326) — the unified
 * pick-and-stay-open parts + assemblies search in the Add Assembly modal:
 * grouped results, immediate pick with query clear, Enter behavior (lone match,
 * never submits the form), and the create-new action row.
 */
import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'

import { TakeoffItemSearchCombobox } from './TakeoffItemSearchCombobox'
import type { RoughTakeoffMaterialPart } from './SortableRoughPartLineRow'
import type { MaterialTemplateWithAssemblyType } from '../../lib/bids/bidPricingEngineTypes'

const parts = [
  { id: 'p1', name: 'Copper pipe', manufacturer: 'CONEX', part_types: { name: 'Pipe' } },
  { id: 'p2', name: 'Copper elbow', manufacturer: 'CONEX', part_types: { name: 'Elbow' } },
] as unknown as RoughTakeoffMaterialPart[]

const templates = [
  { id: 't1', name: 'Copper stub-out kit', description: 'four parts' },
] as unknown as MaterialTemplateWithAssemblyType[]

const filterParts = (list: RoughTakeoffMaterialPart[], q: string) =>
  list.filter((p) => p.name.toLowerCase().includes(q.trim().toLowerCase()))
const filterTemplates = (list: MaterialTemplateWithAssemblyType[], q: string) =>
  list.filter((t) => t.name.toLowerCase().includes(q.trim().toLowerCase()))

function renderBox(overrides: Partial<Parameters<typeof TakeoffItemSearchCombobox>[0]> = {}) {
  const onPick = vi.fn()
  const onCreateNew = vi.fn()
  render(
    <TakeoffItemSearchCombobox
      parts={parts}
      templates={templates}
      filterPartsByQuery={filterParts}
      filterTemplatesByQuery={filterTemplates}
      onPick={onPick}
      onCreateNew={onCreateNew}
      {...overrides}
    />,
  )
  const input = screen.getByPlaceholderText('Search parts and assemblies…')
  return { input, onPick, onCreateNew }
}

describe('TakeoffItemSearchCombobox', () => {
  it('shows grouped Parts and Assemblies results on focus', () => {
    const { input } = renderBox()
    fireEvent.focus(input)
    expect(screen.getByText('Parts')).toBeTruthy()
    expect(screen.getByText('Assemblies')).toBeTruthy()
    expect(screen.getByText('Copper stub-out kit')).toBeTruthy()
    expect(screen.getByText('CONEX · Pipe')).toBeTruthy()
  })

  it('clicking a result picks it and clears the query, staying open for the next search', () => {
    const { input, onPick } = renderBox()
    fireEvent.focus(input)
    fireEvent.change(input, { target: { value: 'elbow' } })
    fireEvent.click(screen.getByText('Copper elbow'))
    expect(onPick).toHaveBeenCalledWith({ kind: 'part', id: 'p2' })
    expect((input as HTMLInputElement).value).toBe('')
  })

  it('Enter picks the lone match without arrowing (and never submits the form)', () => {
    const onSubmit = vi.fn((e: React.FormEvent) => e.preventDefault())
    const onPick = vi.fn()
    render(
      <form onSubmit={onSubmit}>
        <TakeoffItemSearchCombobox
          parts={parts}
          templates={templates}
          filterPartsByQuery={filterParts}
          filterTemplatesByQuery={filterTemplates}
          onPick={onPick}
          onCreateNew={vi.fn()}
        />
      </form>,
    )
    const input = screen.getByPlaceholderText('Search parts and assemblies…')
    fireEvent.focus(input)
    fireEvent.change(input, { target: { value: 'stub-out' } })
    fireEvent.keyDown(input, { key: 'Enter' })
    expect(onPick).toHaveBeenCalledWith({ kind: 'template', id: 't1' })
    expect(onSubmit).not.toHaveBeenCalled()
  })

  it('offers "Add … as a new part" and routes the query to onCreateNew', () => {
    const { input, onCreateNew } = renderBox()
    fireEvent.focus(input)
    fireEvent.change(input, { target: { value: 'brass nipple' } })
    const createRow = screen.getByText('+ Add “brass nipple” as a new part…')
    fireEvent.click(createRow)
    expect(onCreateNew).toHaveBeenCalledWith('brass nipple')
  })

  it('Enter with no matches triggers create-new as the only row', () => {
    const { input, onCreateNew, onPick } = renderBox()
    fireEvent.focus(input)
    fireEvent.change(input, { target: { value: 'brass nipple' } })
    fireEvent.keyDown(input, { key: 'Enter' })
    expect(onCreateNew).toHaveBeenCalledWith('brass nipple')
    expect(onPick).not.toHaveBeenCalled()
  })

  it('arrow keys move through results across group headers, Enter picks the active row', () => {
    const { input, onPick } = renderBox()
    fireEvent.focus(input)
    fireEvent.change(input, { target: { value: 'copper' } })
    fireEvent.keyDown(input, { key: 'ArrowDown' })
    fireEvent.keyDown(input, { key: 'ArrowDown' })
    fireEvent.keyDown(input, { key: 'ArrowDown' })
    fireEvent.keyDown(input, { key: 'Enter' })
    expect(onPick).toHaveBeenCalledWith({ kind: 'template', id: 't1' })
  })

  it('searches parts only when templates is empty', () => {
    const { input } = renderBox({ templates: [] })
    fireEvent.focus(input)
    expect(screen.getByText('Parts')).toBeTruthy()
    expect(screen.queryByText('Assemblies')).toBeNull()
  })
})
