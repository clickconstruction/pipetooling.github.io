// @vitest-environment jsdom
/**
 * The book-match bar and a row's kind and tags, as their own pieces (decomposition queue row 1).
 * Both draw and report. The tab's own smoke mounts each from the screen.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { PricingBookMatchBar, PricingRowKindAndTags } from './PricingGridPieces'

afterEach(cleanup)

describe('PricingBookMatchBar', () => {
  const setup = (over: Partial<Parameters<typeof PricingBookMatchBar>[0]> = {}) => {
    const calls = { open: vi.fn(), fill: vi.fn() }
    render(<PricingBookMatchBar bookName="Base price" entryCount={12} matchCount={3} filling={false} onOpenBook={calls.open} onFill={calls.fill} {...over} />)
    return calls
  }
  const fill = () => screen.getByRole('button', { name: /match|Filling/ }) as HTMLButtonElement

  it('names the book with its entries and opens the price book', () => {
    const calls = setup()
    const chip = screen.getByRole('button', { name: /Base price · 12 entries/ })
    expect(chip.title).toBe('Open the price book — switch books, edit entries')
    fireEvent.click(chip)
    expect(calls.open).toHaveBeenCalledTimes(1)
    expect(calls.fill).not.toHaveBeenCalled()
  })

  it('one entry reads in the singular', () => {
    setup({ entryCount: 1 })
    expect(screen.getByRole('button', { name: /Base price · 1 entry/ })).toBeTruthy()
  })

  it('with rows that match, Fill says how many and reports', () => {
    const calls = setup()
    expect(fill().textContent).toBe('Fill 3 matching from book')
    expect(fill().disabled).toBe(false)
    expect(fill().title).toBe('Assign each matching row its book entry — prices fill from the book')
    fireEvent.click(fill())
    expect(calls.fill).toHaveBeenCalledTimes(1)
  })

  it('with nothing to match, Fill is dead and says why', () => {
    const calls = setup({ matchCount: 0 })
    expect(fill().textContent).toBe('0 unassigned rows match the book')
    expect(fill().disabled).toBe(true)
    expect(fill().title).toBe('No unassigned rows exactly match a book entry name')
    expect(fill().style.cursor).toBe('not-allowed')
    fireEvent.click(fill())
    expect(calls.fill).not.toHaveBeenCalled()
  })

  it('while it fills, the button is dead and says so', () => {
    setup({ filling: true })
    expect(fill().textContent).toBe('Filling…')
    expect(fill().disabled).toBe(true)
  })
})

describe('PricingRowKindAndTags', () => {
  const setup = (over: Partial<Parameters<typeof PricingRowKindAndTags>[0]> = {}) => {
    const calls = { kind: vi.fn(), remove: vi.fn(), add: vi.fn(), open: vi.fn(), close: vi.fn() }
    render(
      <PricingRowKindAndTags
        rowName="Water closet"
        kind="fixture"
        guessed={false}
        tags={['restrooms', 'phase 2']}
        tagBoxOpen={false}
        onKind={calls.kind}
        onRemoveTag={calls.remove}
        onAddTag={calls.add}
        onOpenTagBox={calls.open}
        onCloseTagBox={calls.close}
        {...over}
      />,
    )
    return calls
  }
  const box = () => screen.getByPlaceholderText('a tag, then Enter') as HTMLInputElement

  it("draws the row's kind and each tag, and a press on a tag removes it", () => {
    const calls = setup()
    expect(screen.getByRole('group', { name: 'Kind of Water closet' }).textContent).toContain('Fixture')
    fireEvent.click(screen.getByRole('button', { name: /phase 2/ }))
    expect(calls.remove).toHaveBeenCalledWith('phase 2')
    expect(calls.add).not.toHaveBeenCalled()
  })

  it('with the box closed, + opens it', () => {
    const calls = setup()
    expect(screen.queryByPlaceholderText('a tag, then Enter')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Add a tag to Water closet' }))
    expect(calls.open).toHaveBeenCalledTimes(1)
  })

  it('Enter in the box adds the cleaned tag and empties the box', () => {
    const calls = setup({ tagBoxOpen: true })
    expect(box().getAttribute('aria-label')).toBe('Add a tag to Water closet')
    expect(box().getAttribute('list')).toBe('pricing-row-tags')
    fireEvent.change(box(), { target: { value: '  Level 2  ' } })
    fireEvent.keyDown(box(), { key: 'Enter' })
    // Trimmed and in lower case, as `cleanTag` keeps every tag.
    expect(calls.add.mock.calls).toEqual([['level 2']])
    expect(box().value).toBe('')
    expect(calls.close).not.toHaveBeenCalled()
  })

  it('Enter on an empty box adds nothing', () => {
    const calls = setup({ tagBoxOpen: true })
    fireEvent.change(box(), { target: { value: '   ' } })
    fireEvent.keyDown(box(), { key: 'Enter' })
    expect(calls.add).not.toHaveBeenCalled()
  })

  it('Escape and leaving the box close it, and another key does nothing', () => {
    const calls = setup({ tagBoxOpen: true })
    fireEvent.keyDown(box(), { key: 'a' })
    expect(calls.close).not.toHaveBeenCalled()
    fireEvent.keyDown(box(), { key: 'Escape' })
    expect(calls.close).toHaveBeenCalledTimes(1)
    fireEvent.blur(box())
    expect(calls.close).toHaveBeenCalledTimes(2)
    expect(calls.add).not.toHaveBeenCalled()
  })

  it('a row with no name is called row', () => {
    setup({ rowName: 'row', tags: [] })
    expect(screen.getByRole('button', { name: 'Add a tag to row' })).toBeTruthy()
  })
})
