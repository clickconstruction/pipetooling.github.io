// @vitest-environment jsdom
/**
 * The older confirm component (v2.8429): its plain window's two presses stand 44 px tall at a
 * phone's width and keep the desk look at a desk, the size the shared confirm took in v2.8397
 * (`confirmPressSize`). The `keep` window's three presses keep their own 44 px at both widths.
 */
import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import ConfirmDialog from './ConfirmDialog'

/** A matchMedia that answers the phone query `(max-width: 640px)` as `narrow` says. */
function stubWidth(narrow: boolean) {
  const mq = (query: string) => ({ matches: narrow && query.includes('max-width: 640px'), media: query, addEventListener: () => {}, removeEventListener: () => {}, addListener: () => {}, removeListener: () => {}, onchange: null, dispatchEvent: () => false })
  Object.defineProperty(window, 'matchMedia', { configurable: true, writable: true, value: mq })
}

const noop = () => undefined

function plain() {
  render(<ConfirmDialog title="Remove this row?" body="It leaves the list." confirmLabel="Remove the row" onConfirm={noop} onCancel={noop} />)
}

function withKeep() {
  render(
    <ConfirmDialog
      title="Leave this page?"
      body="The row has words nobody saved."
      confirmLabel="Leave without saving"
      keep={{ label: 'Save and leave', onPress: noop }}
      onConfirm={noop}
      onCancel={noop}
    />,
  )
}

afterEach(() => {
  cleanup()
})

describe('ConfirmDialog · the plain window', () => {
  it('stands its two presses 44 px tall at a phone width, so a thumb lands on them', () => {
    stubWidth(true)
    plain()
    for (const name of ['Cancel', 'Remove the row']) {
      const press = screen.getByRole('button', { name })
      expect(press.style.minHeight).toBe('44px')
      expect(press.style.boxSizing).toBe('border-box')
      expect(press.style.padding).toBe('0.5rem 1rem')
    }
  })

  it('keeps the desk look at a desk width: the same padding and no floor', () => {
    stubWidth(false)
    plain()
    for (const name of ['Cancel', 'Remove the row']) {
      const press = screen.getByRole('button', { name })
      expect(press.style.minHeight).toBe('')
      expect(press.style.boxSizing).toBe('')
      expect(press.style.padding).toBe('0.5rem 1rem')
    }
  })

  it('keeps its colours, its words and its order at both widths', () => {
    for (const narrow of [true, false]) {
      stubWidth(narrow)
      plain()
      expect(screen.getAllByRole('button').map((press) => press.textContent)).toEqual(['Cancel', 'Remove the row'])
      const cancel = screen.getByRole('button', { name: 'Cancel' })
      const act = screen.getByRole('button', { name: 'Remove the row' })
      expect(cancel.style.background).toBe('var(--surface)')
      expect(act.style.background).toBe('rgb(220, 38, 38)')
      expect(act.style.color).toBe('white')
      cleanup()
    }
  })
})

describe('ConfirmDialog · the keep window', () => {
  it('keeps all three presses 44 px tall and stacked, at a phone width and at a desk', () => {
    for (const narrow of [true, false]) {
      stubWidth(narrow)
      withKeep()
      const order: Record<string, string> = { 'Save and leave': '1', 'Leave without saving': '2', Cancel: '3' }
      for (const name of Object.keys(order)) {
        const press = screen.getByRole('button', { name })
        expect(press.style.minHeight).toBe('44px')
        expect(press.style.padding).toBe('0.5rem 1rem')
        expect(press.style.order).toBe(order[name])
      }
      expect(screen.getByRole('button', { name: 'Cancel' }).parentElement!.style.flexDirection).toBe('column')
      cleanup()
    }
  })
})
