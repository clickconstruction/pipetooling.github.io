// @vitest-environment jsdom
/**
 * Messages, cut 5's wait line (v2.5538): the owner or a dev reads that the switch is the first card and nothing else is
 * needed first, with the page's name a link to it; an assistant reads who turns it on, with no link.
 */
import { cleanup, render } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { TEXTS_WAIT, TEXTS_WAIT_OTHERS } from '../../../../lib/messages/replyIo'
import { TextsWaitLine } from './TextsWaitLine'

const auth = vi.hoisted(() => ({ role: 'dev' as string | null }))
vi.mock('../../../../hooks/useAuth', () => ({ useOptionalAuth: () => ({ role: auth.role }) }))

function draw() {
  render(
    <MemoryRouter>
      <p data-line>
        <TextsWaitLine />
      </p>
    </MemoryRouter>,
  )
  return document.querySelector('[data-line]') as HTMLElement
}

afterEach(cleanup)

describe('TextsWaitLine', () => {
  it('links the owner or a dev to the switch, and says it is the first card', () => {
    for (const role of ['dev', 'master_technician']) {
      auth.role = role
      const line = draw()
      expect(line.textContent).toBe(TEXTS_WAIT)
      const link = line.querySelector('a')
      expect(link?.getAttribute('href')).toBe('/settings?tab=settings-phone-texts')
      expect(link?.textContent).toBe('Settings → Phone and texts')
      expect(line.textContent).toContain('It is the first card on Settings → Phone and texts. Nothing else there is needed first.')
      cleanup()
    }
  })

  it('tells anyone else who turns it on, with no link', () => {
    for (const role of ['assistant', 'estimator', 'controller', 'primary', null]) {
      auth.role = role
      const line = draw()
      expect(line.textContent).toBe(TEXTS_WAIT_OTHERS)
      expect(line.querySelector('a')).toBeNull()
      cleanup()
    }
  })
})
