// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest'
import { showReplyFoot } from './replyFoot'

/** A column with a reply box at its foot and a field in the box. Their rects are given: jsdom lays nothing out. */
function thread(set: { scrolls: boolean; columnBottom: number; boxBottom: number }) {
  const column = document.createElement('div')
  column.setAttribute('data-thread-column', '')
  if (set.scrolls) column.style.overflowY = 'auto'
  const box = document.createElement('div')
  box.setAttribute('data-reply-box', '')
  const field = document.createElement('textarea')
  box.append(field)
  column.append(box)
  document.body.append(column)
  const rect = (bottom: number) => () => ({ top: 0, left: 0, right: 375, bottom, width: 375, height: bottom, x: 0, y: 0, toJSON: () => ({}) }) as DOMRect
  column.getBoundingClientRect = rect(set.columnBottom)
  box.getBoundingClientRect = rect(set.boxBottom)
  return { column, box, field }
}

afterEach(() => {
  document.body.innerHTML = ''
})

describe('showReplyFoot (finding 319)', () => {
  it('scrolls the column by what stands under its foot while the box holds the focus', () => {
    const t = thread({ scrolls: true, columnBottom: 300, boxBottom: 380 })
    t.column.scrollTop = 120
    t.field.focus()
    expect(showReplyFoot(t.box)).toBe(true)
    expect(t.column.scrollTop).toBe(200)
  })

  it('moves nothing when the foot already shows', () => {
    const t = thread({ scrolls: true, columnBottom: 300, boxBottom: 290 })
    t.column.scrollTop = 120
    t.field.focus()
    expect(showReplyFoot(t.box)).toBe(false)
    expect(t.column.scrollTop).toBe(120)
  })

  it('moves nothing while the focus is somewhere else: the person is reading', () => {
    const t = thread({ scrolls: true, columnBottom: 300, boxBottom: 380 })
    expect(showReplyFoot(t.box)).toBe(false)
    expect(t.column.scrollTop).toBe(0)
  })

  it('moves nothing at a desk, where the column does not scroll', () => {
    const t = thread({ scrolls: false, columnBottom: 300, boxBottom: 380 })
    t.field.focus()
    expect(showReplyFoot(t.box)).toBe(false)
    expect(t.column.scrollTop).toBe(0)
  })

  it('moves nothing for a box outside a thread’s column, or no box', () => {
    const loose = document.createElement('div')
    document.body.append(loose)
    expect(showReplyFoot(loose)).toBe(false)
    expect(showReplyFoot(null)).toBe(false)
  })
})
