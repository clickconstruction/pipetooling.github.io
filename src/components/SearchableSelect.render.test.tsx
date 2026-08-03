// @vitest-environment jsdom
/**
 * Render tests for SearchableSelect's `noMatchesAction` prop (v2.1327): the
 * optional create-new affordance in the no-matches panel. Baseline behavior
 * (no prop → plain "No matches") is pinned alongside.
 */
import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'

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
