// @vitest-environment jsdom
/**
 * Render tests for SearchableMultiSelect's `keyboardSelect` contract:
 * typing filters, Enter toggles the highlighted option (or the top match
 * before any arrowing) and clears the query for the next name, arrows walk
 * the list with wrap, Space toggles without clearing the query, and none of
 * it fires when the prop is off.
 */
import { describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'

import { SearchableMultiSelect } from './SearchableMultiSelect'
import { installDomShims } from '../test/renderSmokeMocks'

const people = [
  { value: 'u-alex', label: 'Alex Rivera' },
  { value: 'u-mike', label: 'Mike Holloway' },
  { value: 'u-sam', label: 'Sam Patel' },
]

function renderPicker(opts: { keyboardSelect?: boolean; value?: string[] } = {}) {
  installDomShims()
  const onChange = vi.fn()
  render(
    <SearchableMultiSelect
      options={people}
      value={opts.value ?? []}
      onChange={onChange}
      listAriaLabel="People to add"
      searchPlaceholder="Search people…"
      keyboardSelect={opts.keyboardSelect ?? true}
    />,
  )
  const search = screen.getByPlaceholderText('Search people…') as HTMLInputElement
  return { search, onChange }
}

describe('SearchableMultiSelect keyboardSelect', () => {
  it('typing then Enter toggles the top match and clears the query', () => {
    const { search, onChange } = renderPicker()
    fireEvent.change(search, { target: { value: 'mik' } })
    fireEvent.keyDown(search, { key: 'Enter' })
    expect(onChange).toHaveBeenCalledWith(['u-mike'])
    expect(search.value).toBe('')
    cleanup()
  })

  it('arrows walk the list and Enter toggles the highlighted person', () => {
    const { search, onChange } = renderPicker()
    fireEvent.keyDown(search, { key: 'ArrowDown' })
    fireEvent.keyDown(search, { key: 'ArrowDown' })
    fireEvent.keyDown(search, { key: 'Enter' })
    expect(onChange).toHaveBeenCalledWith(['u-mike'])
    cleanup()
  })

  it('ArrowUp from no highlight wraps to the last person; Space toggles without clearing the query', () => {
    const { search, onChange } = renderPicker()
    fireEvent.change(search, { target: { value: 'a' } })
    // Filtered to Alex Rivera / Sam Patel (both contain "a"); wrap to the last.
    fireEvent.keyDown(search, { key: 'ArrowUp' })
    fireEvent.keyDown(search, { key: ' ' })
    expect(onChange).toHaveBeenCalledWith(['u-sam'])
    expect(search.value).toBe('a')
    cleanup()
  })

  it('Enter unchecks a person who is already selected', () => {
    const { search, onChange } = renderPicker({ value: ['u-mike'] })
    fireEvent.change(search, { target: { value: 'mik' } })
    fireEvent.keyDown(search, { key: 'Enter' })
    expect(onChange).toHaveBeenCalledWith([])
    cleanup()
  })

  it('Enter with no matches is a no-op (still swallowed)', () => {
    const { search, onChange } = renderPicker()
    fireEvent.change(search, { target: { value: 'zzz' } })
    fireEvent.keyDown(search, { key: 'Enter' })
    expect(onChange).not.toHaveBeenCalled()
    cleanup()
  })

  it('without keyboardSelect, Enter/arrows/Space change nothing', () => {
    const { search, onChange } = renderPicker({ keyboardSelect: false })
    fireEvent.change(search, { target: { value: 'mik' } })
    fireEvent.keyDown(search, { key: 'ArrowDown' })
    fireEvent.keyDown(search, { key: 'Enter' })
    fireEvent.keyDown(search, { key: ' ' })
    expect(onChange).not.toHaveBeenCalled()
    cleanup()
  })
})
