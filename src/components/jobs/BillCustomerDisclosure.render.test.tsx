// @vitest-environment jsdom
/**
 * Render smoke for `BillCustomerDisclosure`, the one disclosure the Bill Customer window's seven sections share (the
 * line item override, memo and footer of each Invoice Modifications card, and HouseCall Pro's memo). Until v2.7751 each
 * was written out by hand; the whole window's HTML was compared before and after to prove the piece draws the same.
 */
import { useState } from 'react'
import { describe, expect, it } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { BillCustomerDisclosure } from './BillCustomerDisclosure'

function Harness({ gaps = false }: { gaps?: boolean }) {
  const [open, setOpen] = useState(false)
  const [text, setText] = useState('')
  return (
    <BillCustomerDisclosure
      panelId="memo-panel"
      headingId="memo-heading"
      title="Memo"
      summary={text ? 'Custom' : 'None'}
      open={open}
      onToggle={() => setOpen((v) => !v)}
      {...(gaps ? { toggleMarginBottom: open ? '0.35rem' : '0.65rem', panelMarginBottom: '0.75rem' } : {})}
    >
      <textarea aria-label="Memo text" value={text} onChange={(e) => setText(e.target.value)} />
    </BillCustomerDisclosure>
  )
}

describe('BillCustomerDisclosure', () => {
  it('draws a press named for its title and summary, tied to a region panel that starts hidden', () => {
    render(<Harness />)
    const press = screen.getByRole('button')
    expect(press.textContent).toBe('▶MemoNone')
    expect(press.getAttribute('aria-expanded')).toBe('false')
    expect(press.getAttribute('aria-controls')).toBe('memo-panel')
    const panel = document.getElementById('memo-panel') as HTMLElement
    expect(panel.getAttribute('role')).toBe('region')
    expect(panel.getAttribute('aria-labelledby')).toBe('memo-heading')
    expect(document.getElementById('memo-heading')?.textContent).toBe('Memo')
    expect(panel.hidden).toBe(true)
  })

  it('the press opens and closes the panel through the caller’s state, and the caret follows', () => {
    render(<Harness />)
    const press = screen.getByRole('button')
    fireEvent.click(press)
    expect(press.getAttribute('aria-expanded')).toBe('true')
    expect(press.textContent).toBe('▼MemoNone')
    expect((document.getElementById('memo-panel') as HTMLElement).hidden).toBe(false)
    fireEvent.click(press)
    expect((document.getElementById('memo-panel') as HTMLElement).hidden).toBe(true)
  })

  it('keeps what is typed while closed: the panel is hidden, never unmounted, and the summary follows it', () => {
    render(<Harness />)
    const press = screen.getByRole('button')
    fireEvent.click(press)
    fireEvent.change(screen.getByRole('textbox', { name: 'Memo text' }), { target: { value: 'Net 30' } })
    fireEvent.click(press)
    expect(press.textContent).toBe('▶MemoCustom')
    expect((screen.getByRole('textbox', { name: 'Memo text', hidden: true }) as HTMLTextAreaElement).value).toBe('Net 30')
  })

  it('stacks tight by default, and takes the caller’s gaps when it stands alone', () => {
    const tight = render(<Harness />)
    expect(screen.getByRole('button').style.marginBottom).toBe('0px')
    expect((document.getElementById('memo-panel') as HTMLElement).style.marginBottom).toBe('0px')
    tight.unmount()
    render(<Harness gaps />)
    const press = screen.getByRole('button')
    expect(press.style.marginBottom).toBe('0.65rem')
    expect((document.getElementById('memo-panel') as HTMLElement).style.marginBottom).toBe('0.75rem')
    fireEvent.click(press)
    expect(press.style.marginBottom).toBe('0.35rem')
  })
})
