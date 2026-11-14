// @vitest-environment jsdom
/**
 * The dispatch job picker with the keyboard up on a phone (punch list #348, PR 2). Its card is docked to the top
 * and as tall as the room the keyboard leaves. It now also starts where the page has slid to.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, render, screen } from '@testing-library/react'

let phone = true
vi.mock('../../hooks/useIsMobile', () => ({ useIsMobile: () => phone }))

import { ScheduleDispatchAssignJobPickerModal } from './ScheduleDispatchAssignJobPickerModal'

type Listener = () => void

function installViewport(height: number) {
  const heard = new Set<Listener>()
  const vv = { height, offsetTop: 0, addEventListener: (_type: string, f: Listener) => heard.add(f), removeEventListener: (_type: string, f: Listener) => heard.delete(f) }
  Object.defineProperty(window, 'visualViewport', { value: vv, configurable: true })
  return {
    keyboard(room: number, slide: number) {
      vv.height = room
      vv.offsetTop = slide
      act(() => heard.forEach((f) => f()))
    },
  }
}

const open = () => render(<ScheduleDispatchAssignJobPickerModal open onClose={() => {}} subtitle="Pick a job" jobRows={[]} searchValue="" onSearchChange={() => {}} onPickJob={() => {}} />)
const card = () => screen.getByRole('dialog')

afterEach(() => {
  cleanup()
  phone = true
  Object.defineProperty(window, 'visualViewport', { value: undefined, configurable: true })
})

describe('the dispatch job picker and the keyboard', () => {
  it('is as tall as the room the keyboard leaves and starts where the page has slid to', () => {
    const vv = installViewport(740)
    open()
    expect([card().style.height, card().style.marginTop]).toEqual(['740px', '0px'])
    vv.keyboard(377, 0)
    expect([card().style.height, card().style.marginTop]).toEqual(['377px', '0px'])
    vv.keyboard(377, 253)
    expect([card().style.height, card().style.marginTop]).toEqual(['377px', '253px'])
  })

  it('fills the screen in a browser that cannot say what shows', () => {
    open()
    expect([card().style.height, card().style.marginTop]).toEqual(['100dvh', '0px'])
  })

  it('is a centred card at a desk and does not follow the keyboard', () => {
    phone = false
    const vv = installViewport(740)
    open()
    vv.keyboard(377, 253)
    expect([card().style.height, card().style.marginTop, card().style.maxHeight]).toEqual(['', '', '80vh'])
  })
})
