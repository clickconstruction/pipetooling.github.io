// @vitest-environment jsdom
/**
 * v2.5094: the Workflow page's person-contact window as a component. Pins the move — nothing
 * drawn with no contact; the name, the email and phone as mailto: / tel: links, "Not a user"
 * for a name with no account, the empty-contact line; Close and the backdrop close it, a click
 * inside does not.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, screen } from '@testing-library/react'
import { renderSettled } from '../../test/renderSmokeMocks'
import { PersonContactModal } from './PersonContactModal'

const sam = { name: 'Sam Ortiz', email: 'sam@example.test', phone: '(512) 555-0142', isUser: true }
const lee = { name: 'Lee Park', email: null, phone: null, isUser: false }

afterEach(() => {
  cleanup()
})

describe('PersonContactModal', () => {
  it('draws nothing with no contact', async () => {
    const { container } = await renderSettled(<PersonContactModal contact={null} onClose={() => {}} />, {
      loaded: () => true,
    })
    expect(container.innerHTML).toBe('')
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('shows the name with the email and phone as links', async () => {
    await renderSettled(<PersonContactModal contact={sam} onClose={() => {}} />, {
      loaded: () => screen.findByRole('dialog', { name: 'Contact information for Sam Ortiz' }),
    })
    expect(screen.getByRole('heading', { name: 'Sam Ortiz' })).toBeTruthy()
    expect(screen.getByRole('link', { name: 'sam@example.test' }).getAttribute('href')).toBe('mailto:sam@example.test')
    expect(screen.getByRole('link', { name: '(512) 555-0142' }).getAttribute('href')).toBe('tel:+15125550142')
    expect(screen.queryByText('Not a user')).toBeNull()
    expect(screen.queryByText('No contact information on file.')).toBeNull()
  })

  it('says Not a user and No contact information on file for a bare name', async () => {
    await renderSettled(<PersonContactModal contact={lee} onClose={() => {}} />, {
      loaded: () => screen.findByRole('dialog', { name: 'Contact information for Lee Park' }),
    })
    expect(screen.getByText('Not a user')).toBeTruthy()
    expect(screen.getAllByText('—')).toHaveLength(2)
    expect(screen.queryByRole('link')).toBeNull()
    expect(screen.getByText('No contact information on file.')).toBeTruthy()
  })

  it('closes on Close and on the backdrop, not on a click inside', async () => {
    const onClose = vi.fn()
    await renderSettled(<PersonContactModal contact={sam} onClose={onClose} />, {
      loaded: () => screen.findByRole('dialog'),
    })
    fireEvent.click(screen.getByRole('heading', { name: 'Sam Ortiz' }))
    expect(onClose).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: 'Close' }))
    expect(onClose).toHaveBeenCalledTimes(1)
    fireEvent.click(screen.getByRole('dialog'))
    expect(onClose).toHaveBeenCalledTimes(2)
  })
})
