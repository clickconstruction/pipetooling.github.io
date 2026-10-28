// @vitest-environment jsdom
/**
 * Render smoke for the kept read's stamp and its muting (#183 PR 2, v2.6031). The stamp's words are
 * the kernel's (`keptRead.test.ts`); here the line draws, Retry presses, and the `[data-kept-read]`
 * rules of `index.css`, read from the file and put on the page, mute money, counts and a table's
 * presses, so a kept page can never pass as live.
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { KeptReadStamp } from './KeptReadStamp'
import { APP_CALENDAR_TZ } from '../utils/dateUtils'

const READ_AT = Date.UTC(2026, 9, 28, 12, 52) // 7:52 AM in Chicago
const format = { timeZone: APP_CALENDAR_TZ }

/** The `[data-kept-read]` block of index.css, from its comment to the stamp's own rules. */
function keptReadCss(): string {
  const css = readFileSync(join(process.cwd(), 'src/index.css'), 'utf8')
  const rules = css.match(/^\[data-kept-read\][^{]*\{[^}]*\}/gm) ?? []
  return rules.join('\n')
}

afterEach(() => {
  cleanup()
  document.querySelectorAll('style[data-test]').forEach((s) => s.remove())
})

describe('KeptReadStamp render smoke', () => {
  it('reads the lead, the time and reading again while the live read runs', () => {
    render(<KeptReadStamp readAt={READ_AT} format={format} />)
    const stamp = screen.getByRole('status')
    expect(stamp.textContent).toBe('Read at 7:52 AM · reading again…') // first paint
    expect(stamp.getAttribute('data-kept-read-stamp')).toBe('reading')
    expect(stamp.className).toBe('keptReadStamp')
    expect(screen.queryByRole('button')).toBeNull()
  })

  it('reads could not read again with Retry once the live read failed, and Retry is the page’s read', () => {
    const onRetry = vi.fn()
    render(<KeptReadStamp readAt={READ_AT} failed onRetry={onRetry} format={format} lead="Counts from" />)
    const stamp = screen.getByRole('status')
    expect(stamp.textContent).toBe('Counts from 7:52 AM · could not read again · Retry') // first paint
    expect(stamp.getAttribute('data-kept-read-stamp')).toBe('failed')
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }))
    expect(onRetry).toHaveBeenCalledTimes(1)
  })

  it('the index.css rules mute money at 0.42 and grey, counts at 0.55, and make a table’s presses inert under data-kept-read', () => {
    const css = keptReadCss()
    expect(css).toContain('[data-kept-read] .stagesMoney')
    expect(css).toContain('[data-kept-read] .keptMoney')
    expect(css).toContain('[data-kept-read] .keptCount')
    const style = document.createElement('style')
    style.setAttribute('data-test', '')
    style.textContent = css
    document.head.appendChild(style)
    render(
      <div>
        <div data-kept-read="">
          <KeptReadStamp readAt={READ_AT} format={format} />
          <span className="stagesMoney">$1,200</span>
          <span className="keptMoney">$300</span>
          <span className="keptCount">3 open</span>
          <table>
            <tbody>
              <tr>
                <td>
                  <button type="button">Bill</button>
                </td>
              </tr>
            </tbody>
          </table>
          <button type="button" className="keptPress">
            Take it
          </button>
          <button type="button">Add job</button>
        </div>
        <div>
          <span className="stagesMoney">$9,000</span>
        </div>
      </div>,
    )
    const style_ = (text: string) => getComputedStyle(screen.getByText(text))
    expect(style_('$1,200').opacity).toBe('0.42')
    expect(style_('$1,200').filter).toBe('grayscale(1)')
    expect(style_('$300').opacity).toBe('0.42')
    expect(style_('3 open').opacity).toBe('0.55')
    expect(style_('Bill').pointerEvents).toBe('none')
    expect(style_('Bill').opacity).toBe('0.55')
    expect(style_('Take it').pointerEvents).toBe('none')
    expect(style_('Add job').pointerEvents).not.toBe('none')
    expect(style_('$9,000').opacity).not.toBe('0.42')
  })
})
