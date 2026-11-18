// @vitest-environment jsdom
/**
 * The notice pane with no job picked (v2.7619). With a job on it the pane reads 117 of the desk's names, so the
 * pane drawn whole is held where it always was, by `LienDesk.render.test.tsx` through the desk.
 */
import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, render } from '@testing-library/react'
import { LienDeskNoticePane, type LienNoticePaneContext } from './LienDeskNoticePane'

afterEach(() => cleanup())

describe('LienDeskNoticePane', () => {
  it('with no job picked, a computer says to pick one', () => {
    const { container } = render(<LienDeskNoticePane ctx={{ selected: null, isMobile: false } as unknown as LienNoticePaneContext} />)
    expect(container.textContent).toBe('Pick a job on the left.')
    expect(container.querySelector('[data-lien-desk-paper]')).toBeNull()
  })

  it('with no job picked, a phone says nothing: the list is the whole screen there', () => {
    const { container } = render(<LienDeskNoticePane ctx={{ selected: null, isMobile: true } as unknown as LienNoticePaneContext} />)
    expect(container.textContent).toBe('')
  })
})
