// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import { pickHopRow, rowIdFromTakeoffTableTarget } from './takeoffHop'

describe('pickHopRow', () => {
  const rows = [
    { id: 'a', top: -300 },
    { id: 'b', top: -40 },
    { id: 'c', top: 200 },
    { id: 'd', top: 900 },
  ]
  it('prefers the row you touched while it is still on the bid', () => {
    expect(pickHopRow(rows, 'd', 120)).toBe('d')
    expect(pickHopRow(rows, 'gone', 120)).toBe('c')
  })
  it('falls back to the first row at or below the header', () => {
    expect(pickHopRow(rows, null, 120)).toBe('c')
    expect(pickHopRow(rows, null, 200)).toBe('c')
    expect(pickHopRow(rows, null, 201)).toBe('d')
  })
  it('takes the last row above the header when everything is scrolled past', () => {
    expect(pickHopRow(rows, null, 1000)).toBe('d')
  })
  it('ignores unmeasured rows and returns null with nothing to go on', () => {
    expect(pickHopRow([{ id: 'x', top: null }, { id: 'y', top: 50 }], null, 120)).toBe('y')
    expect(pickHopRow([{ id: 'x', top: null }], null)).toBeNull()
    expect(pickHopRow([], 'a')).toBeNull()
  })
})

describe('rowIdFromTakeoffTableTarget', () => {
  function table(): HTMLElement {
    document.body.innerHTML = `
      <table><tbody>
        <tr id="takeoff-row-r1"><td>WC <span data-t="wc-label">label</span></td></tr>
        <tr><td><input data-t="wc-line-2" /></td></tr>
        <tr><td><button data-t="wc-line-3">x</button></td></tr>
        <tr id="takeoff-row-r2"><td data-t="lav">LAV</td></tr>
        <tr><td data-t="lav-line">line</td></tr>
      </tbody></table>
      <div data-t="outside">outside</div>`
    return document.body
  }
  const t = (key: string) => table().querySelector(`[data-t="${key}"]`)
  it('maps the id-bearing row and the line rows under it to the same fixture', () => {
    expect(rowIdFromTakeoffTableTarget(t('wc-label'))).toBe('r1')
    expect(rowIdFromTakeoffTableTarget(t('wc-line-2'))).toBe('r1')
    expect(rowIdFromTakeoffTableTarget(t('wc-line-3'))).toBe('r1')
    expect(rowIdFromTakeoffTableTarget(t('lav'))).toBe('r2')
    expect(rowIdFromTakeoffTableTarget(t('lav-line'))).toBe('r2')
  })
  it('returns null outside the table or for a non-element target', () => {
    expect(rowIdFromTakeoffTableTarget(t('outside'))).toBeNull()
    expect(rowIdFromTakeoffTableTarget(null)).toBeNull()
    expect(rowIdFromTakeoffTableTarget(document)).toBeNull()
  })
})
