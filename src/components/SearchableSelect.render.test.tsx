// @vitest-environment jsdom
/**
 * Render tests for SearchableSelect: the `noMatchesAction` prop (v2.1327) and
 * the keyboard-navigation contract (v2.1391 — typing auto-highlights the first
 * match, arrows walk incrementally with wrap, Space selects on an empty query,
 * Tab commits the highlight and closes without trapping focus).
 */
import { describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'

import { SearchableSelect } from './SearchableSelect'
import { installDomShims } from '../test/renderSmokeMocks'

const options = [
  { value: 'a', label: 'Copper pipe' },
  { value: 'b', label: 'PVC elbow' },
]

function renderSelect(withAction: boolean) {
  installDomShims()
  const onChange = vi.fn()
  const onSelect = vi.fn()
  render(
    <SearchableSelect
      value=""
      onChange={onChange}
      options={options}
      placeholder="Pick a part"
      noMatchesAction={
        withAction ? { label: (q) => `+ Add “${q}” as a new part…`, onSelect } : undefined
      }
    />,
  )
  fireEvent.click(screen.getByRole('combobox'))
  const search = screen.getByPlaceholderText('Search…')
  return { search, onChange, onSelect }
}

describe('SearchableSelect noMatchesAction', () => {
  it('renders the action button in the no-matches panel and routes the query on click', () => {
    const { search, onSelect } = renderSelect(true)
    fireEvent.change(search, { target: { value: 'brass nipple' } })
    const action = screen.getByRole('button', { name: '+ Add “brass nipple” as a new part…' })
    fireEvent.click(action)
    expect(onSelect).toHaveBeenCalledWith('brass nipple')
  })

  it('Enter triggers the action when the filtered list is empty', () => {
    const { search, onSelect, onChange } = renderSelect(true)
    fireEvent.change(search, { target: { value: 'brass nipple' } })
    fireEvent.keyDown(search, { key: 'Enter' })
    expect(onSelect).toHaveBeenCalledWith('brass nipple')
    expect(onChange).not.toHaveBeenCalled()
  })

  it('does not offer the action while the query is empty or matches exist', () => {
    const { search } = renderSelect(true)
    expect(screen.queryByRole('button', { name: /as a new part/ })).toBeNull()
    fireEvent.change(search, { target: { value: 'copper' } })
    expect(screen.queryByRole('button', { name: /as a new part/ })).toBeNull()
  })

  it('without the prop, the no-matches panel stays a plain message', () => {
    const { search } = renderSelect(false)
    fireEvent.change(search, { target: { value: 'brass nipple' } })
    expect(screen.getByText('No matches')).toBeTruthy()
    expect(screen.queryByRole('button', { name: /as a new part/ })).toBeNull()
  })
})

describe('SearchableSelect keyboard navigation (v2.1391)', () => {
  const threeOptions = [
    { value: 'alex', label: 'Alexander Oil Company' },
    { value: 'amazon', label: 'Amazon' },
    { value: 'apple', label: 'Apple Lumber' },
  ]

  function renderKeyboardSelect() {
    installDomShims()
    const onChange = vi.fn()
    render(<SearchableSelect value="" onChange={onChange} options={threeOptions} placeholder="Supply house" />)
    fireEvent.click(screen.getByRole('combobox'))
    const search = screen.getByPlaceholderText('Search…')
    return { search, onChange }
  }

  it('typing auto-highlights the first match so Enter selects it in one motion', () => {
    const { search, onChange } = renderKeyboardSelect()
    fireEvent.change(search, { target: { value: 'ama' } })
    fireEvent.keyDown(search, { key: 'Enter' })
    expect(onChange).toHaveBeenCalledWith('amazon')
    cleanup()
  })

  it('arrows walk one row at a time with wrap-around, not jump-to-first', () => {
    const { search, onChange } = renderKeyboardSelect()
    fireEvent.keyDown(search, { key: 'ArrowDown' }) // → alex
    fireEvent.keyDown(search, { key: 'ArrowDown' }) // → amazon
    fireEvent.keyDown(search, { key: 'ArrowDown' }) // → apple
    fireEvent.keyDown(search, { key: 'ArrowDown' }) // wraps → alex
    fireEvent.keyDown(search, { key: 'ArrowUp' }) // wraps back → apple
    fireEvent.keyDown(search, { key: 'Enter' })
    expect(onChange).toHaveBeenCalledWith('apple')
    cleanup()
  })

  it('Space selects the highlight while the box is empty; with text it types a space', () => {
    const first = renderKeyboardSelect()
    fireEvent.keyDown(first.search, { key: 'ArrowDown' })
    fireEvent.keyDown(first.search, { key: ' ' })
    expect(first.onChange).toHaveBeenCalledWith('alex')
    cleanup()

    const second = renderKeyboardSelect()
    fireEvent.change(second.search, { target: { value: 'ama' } })
    fireEvent.keyDown(second.search, { key: ' ' }) // must NOT select while typing
    expect(second.onChange).not.toHaveBeenCalled()
    cleanup()
  })

  it('Tab commits the highlighted option and closes the panel without preventDefault', () => {
    const { search, onChange } = renderKeyboardSelect()
    fireEvent.change(search, { target: { value: 'apple' } })
    fireEvent.keyDown(search, { key: 'Tab' })
    expect(onChange).toHaveBeenCalledWith('apple')
    expect(screen.queryByRole('listbox')).toBeNull()
    cleanup()
  })

  it('Tab with no highlight just closes without selecting', () => {
    const { search, onChange } = renderKeyboardSelect()
    fireEvent.keyDown(search, { key: 'Tab' })
    expect(onChange).not.toHaveBeenCalled()
    expect(screen.queryByRole('listbox')).toBeNull()
    cleanup()
  })

  it('Escape closes without selecting', () => {
    const { search, onChange } = renderKeyboardSelect()
    fireEvent.change(search, { target: { value: 'ama' } })
    fireEvent.keyDown(search, { key: 'Escape' })
    expect(onChange).not.toHaveBeenCalled()
    expect(screen.queryByRole('listbox')).toBeNull()
    cleanup()
  })
})
