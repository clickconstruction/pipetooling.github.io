// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'

const insert = vi.fn(() => Promise.resolve({ data: null, error: null }))
vi.mock('./supabase', () => ({ supabase: { from: vi.fn(() => ({ insert })) } }))

import { navClickViewer, recordCallPressed, recordViewerNavClick, setNavClickViewer } from './navClickViewer'

function rowButton(): Element {
  const root = document.createElement('div')
  root.innerHTML =
    '<div data-navtrack="pipeline-row" data-navbuttons=""><button type="button" aria-label="Add a note to this job’s activity"><svg id="hit"></svg></button><a id="call" href="tel:5551234">Call</a></div>'
  return root
}

describe('navClickViewer (v2.5904)', () => {
  afterEach(() => {
    setNavClickViewer(null, null)
    insert.mockClear()
  })

  it('holds the viewer the auth provider sets, and empties on sign-out', () => {
    setNavClickViewer('u1', 'assistant')
    expect(navClickViewer()).toEqual({ userId: 'u1', role: 'assistant' })
    setNavClickViewer(undefined, undefined)
    expect(navClickViewer()).toEqual({ userId: null, role: null })
  })

  it('records a row button and a Call link as the viewer', async () => {
    setNavClickViewer('u1', 'assistant')
    const root = rowButton()
    recordViewerNavClick({ target: root.querySelector('#hit') })
    recordViewerNavClick({ target: root.querySelector('#call') })
    await vi.waitFor(() => expect(insert).toHaveBeenCalledTimes(2))
    expect(insert).toHaveBeenCalledWith(expect.objectContaining({ user_id: 'u1', role: 'assistant', control: 'pipeline-row', target: '#Add a note to this job' }))
    expect(insert).toHaveBeenCalledWith(expect.objectContaining({ user_id: 'u1', role: 'assistant', control: 'call_pressed', target: '#surface=pipeline-row' }))
  })

  it('records a Call press on a named site, and nothing while signed out', async () => {
    recordCallPressed('thread')
    recordViewerNavClick({ target: rowButton().querySelector('#hit') })
    expect(insert).not.toHaveBeenCalled()
    setNavClickViewer('u2', 'helpers')
    recordCallPressed('thread')
    await vi.waitFor(() => expect(insert).toHaveBeenCalledTimes(1))
    expect(insert).toHaveBeenCalledWith(expect.objectContaining({ user_id: 'u2', role: 'helpers', control: 'call_pressed', target: '#surface=thread' }))
  })

  it('never throws from a press it cannot read', () => {
    setNavClickViewer('u1', 'assistant')
    expect(() => recordViewerNavClick({ target: null })).not.toThrow()
    expect(() => recordViewerNavClick({ target: {} as EventTarget })).not.toThrow()
  })
})
