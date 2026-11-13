// @vitest-environment jsdom
/**
 * The GC contact sheet (the Gray Fox spike, 2026-11-02): the three fields, the button that names the count,
 * the caption that says which bids keep their own, the draft rule, Escape and Cancel. Made-up names only.
 */
import { cleanup, fireEvent, screen } from '@testing-library/react'
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { installDomShims, renderWithProviders } from '../../test/renderSmokeMocks'
import { DevelopmentGcContactSheet } from './DevelopmentGcContactSheet'

vi.mock('../../lib/supabase', async () => {
  const { makeSupabaseStub } = await import('../../test/renderSmokeMocks')
  return { supabase: makeSupabaseStub() }
})

beforeAll(installDomShims)
afterEach(cleanup)

describe('DevelopmentGcContactSheet', () => {
  it('with no contact yet: Put it on N bids, and a name of two letters before it sends', () => {
    const onSave = vi.fn()
    renderWithProviders(<DevelopmentGcContactSheet siteName="Harlow Ranch" current={null} targetCount={15} keptCount={0} busy={false} onSave={onSave} onClose={() => {}} />)
    expect(screen.getByText('none on the bids yet')).toBeTruthy()
    const press = screen.getByText('Put it on 15 bids').closest('button')!
    fireEvent.change(screen.getByLabelText("The GC contact's name"), { target: { value: 'P' } })
    fireEvent.click(press)
    expect(onSave).not.toHaveBeenCalled()
    expect(screen.getByText('The name needs two letters or more.')).toBeTruthy()
    fireEvent.change(screen.getByLabelText("The GC contact's name"), { target: { value: ' Pat Lee ' } })
    fireEvent.change(screen.getByLabelText("The GC contact's phone"), { target: { value: '803 555 0100' } })
    fireEvent.click(press)
    expect(onSave).toHaveBeenCalledWith({ name: 'Pat Lee', phone: '803 555 0100', email: null })
  })

  it('changing a contact: Change it on N bids, the caption counts the bids that keep another name, and the fields start filled', () => {
    renderWithProviders(<DevelopmentGcContactSheet siteName="Harlow Ranch" current={{ name: 'Pat Lee', phone: '803', email: null }} targetCount={12} keptCount={3} busy={false} onSave={() => {}} onClose={() => {}} />)
    expect(screen.getByText('Change it on 12 bids')).toBeTruthy()
    expect((screen.getByLabelText("The GC contact's name") as HTMLInputElement).value).toBe('Pat Lee')
    expect(screen.getByTestId('gc-contact-caption').textContent).toBe('3 bids name another contact and keep it.')
  })

  it('with every bid naming someone else the press is dead and the caption says so; Escape and Cancel close', () => {
    const onClose = vi.fn()
    renderWithProviders(<DevelopmentGcContactSheet siteName="Harlow Ranch" current={null} targetCount={0} keptCount={4} busy={false} onSave={() => {}} onClose={onClose} />)
    expect(screen.getByText('Put it on bids').closest('button')!.hasAttribute('disabled')).toBe(true)
    expect(screen.getByTestId('gc-contact-caption').textContent).toBe('Every bid here names another contact.')
    fireEvent.click(screen.getByText('Cancel'))
    fireEvent.keyDown(window, { key: 'Escape' })
    expect(onClose).toHaveBeenCalledTimes(2)
  })
})
