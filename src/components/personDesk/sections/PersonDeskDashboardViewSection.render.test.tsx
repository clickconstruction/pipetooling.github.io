// @vitest-environment jsdom
/**
 * The desk's Dashboard view picker: the office sets a leader's or a superintendent's view to Short; a person
 * presses his own row; the desk of a role that takes no view has no section; a controller and a training account
 * read; a refused press names its reason.
 */
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { DashboardViewIo } from '../../../lib/dashboard/dashboardViewIo'
import { dashboardViewStorageKey, type DashboardView } from '../../../lib/dashboard/shortDashboard'
import type { PersonDeskViewer } from '../../../lib/people/personDeskGates'
import { PersonDeskDashboardViewSection } from './PersonDeskDashboardViewSection'

const viewer = (p: Partial<PersonDeskViewer> = {}): PersonDeskViewer => ({ role: 'assistant', isDev: false, canAccessPay: true, canAccessHours: true, canAccessVehicles: true, canAccessLicenses: true, canAccessContracts: true, readOnly: false, ...p })

function ioWith(initial: DashboardView, fail?: string): DashboardViewIo & { set: ReturnType<typeof vi.fn> } {
  return {
    read: vi.fn(async () => initial),
    set: vi.fn(async () => {
      if (fail) throw new Error(fail)
    }),
  }
}

afterEach(() => {
  cleanup()
  window.localStorage.clear()
})

describe('PersonDeskDashboardViewSection', () => {
  it('the office sets a leader’s view to Short, and its own device is left alone', async () => {
    const io = ioWith('full')
    render(<PersonDeskDashboardViewSection userId="u-marcus" displayName="Marcus Lee" personRole="master_technician" viewer={viewer()} viewerUserId="u-dana" changeKey={0} io={io} />)
    expect(screen.getByText('What Marcus sees when the app opens. The office can set it for them.')).toBeTruthy()
    const full = await screen.findByRole('button', { name: /^Full/ })
    await waitFor(() => expect(full.getAttribute('aria-pressed')).toBe('true'))
    fireEvent.click(screen.getByRole('button', { name: /^Short/ }))
    await waitFor(() => expect(io.set).toHaveBeenCalledWith('u-marcus', 'short'))
    await waitFor(() => expect(screen.getByRole('button', { name: /^Short/ }).getAttribute('aria-pressed')).toBe('true'))
    expect(window.localStorage.getItem(dashboardViewStorageKey('u-marcus'))).toBeNull()
  })

  it('a leader on his own desk is remembered on the device, so his Dashboard follows', async () => {
    const io = ioWith('full')
    const heard = vi.fn()
    window.addEventListener('pipetooling-dashboard-view-changed', heard)
    render(<PersonDeskDashboardViewSection userId="u-marcus" displayName="Marcus Lee" personRole="master_technician" viewer={viewer({ role: 'master_technician' })} viewerUserId="u-marcus" changeKey={0} io={io} />)
    const short = await screen.findByRole('button', { name: /^Short/ })
    await waitFor(() => expect((short as HTMLButtonElement).disabled).toBe(false))
    fireEvent.click(short)
    await waitFor(() => expect(window.localStorage.getItem(dashboardViewStorageKey('u-marcus'))).toBe('short'))
    expect(heard).toHaveBeenCalledTimes(1)
    window.removeEventListener('pipetooling-dashboard-view-changed', heard)
  })

  it('the office sets a superintendent’s view to Short (punch list #384)', async () => {
    const io = ioWith('full')
    render(<PersonDeskDashboardViewSection userId="u-sam" displayName="Sam Ortiz" personRole="superintendent" viewer={viewer()} viewerUserId="u-dana" changeKey={0} io={io} />)
    expect(screen.getByText('What Sam sees when the app opens. The office can set it for them.')).toBeTruthy()
    expect(screen.getByText('the office picks')).toBeTruthy()
    const short = await screen.findByRole('button', { name: /^Short/ })
    await waitFor(() => expect((short as HTMLButtonElement).disabled).toBe(false))
    fireEvent.click(short)
    await waitFor(() => expect(io.set).toHaveBeenCalledWith('u-sam', 'short'))
    expect(window.localStorage.getItem(dashboardViewStorageKey('u-sam'))).toBeNull()
  })

  it('a superintendent presses his own row and nobody else’s', async () => {
    const io = ioWith('full')
    const own = render(<PersonDeskDashboardViewSection userId="u-sam" displayName="Sam Ortiz" personRole="superintendent" viewer={viewer({ role: 'superintendent' })} viewerUserId="u-sam" changeKey={0} io={io} />)
    expect(screen.getByText('you pick')).toBeTruthy()
    const short = await screen.findByRole('button', { name: /^Short/ })
    await waitFor(() => expect((short as HTMLButtonElement).disabled).toBe(false))
    fireEvent.click(short)
    await waitFor(() => expect(io.set).toHaveBeenCalledWith('u-sam', 'short'))
    await waitFor(() => expect(window.localStorage.getItem(dashboardViewStorageKey('u-sam'))).toBe('short'))
    own.unmount()
    const other = render(<PersonDeskDashboardViewSection userId="u-lee" displayName="Lee Park" personRole="superintendent" viewer={viewer({ role: 'superintendent' })} viewerUserId="u-sam" changeKey={0} io={ioWith('full')} />)
    expect(other.container.innerHTML).toBe('')
  })

  it('no section on the desk of a role that takes no view, or for a viewer outside the office', () => {
    const a = render(<PersonDeskDashboardViewSection userId="u" displayName="Dana Ruiz" personRole="assistant" viewer={viewer()} changeKey={0} io={ioWith('full')} />)
    expect(a.container.innerHTML).toBe('')
    cleanup()
    const b = render(<PersonDeskDashboardViewSection userId="u" displayName="Marcus Lee" personRole="master_technician" viewer={viewer({ role: 'estimator' })} changeKey={0} io={ioWith('full')} />)
    expect(b.container.innerHTML).toBe('')
    cleanup()
    // A sub's own desk: his role takes no view, so there is nothing to press.
    const c = render(<PersonDeskDashboardViewSection userId="u-sub" displayName="Pat Sub" personRole="subcontractor" viewer={viewer({ role: 'subcontractor' })} viewerUserId="u-sub" changeKey={0} io={ioWith('full')} />)
    expect(c.container.innerHTML).toBe('')
  })

  it('a controller and a training account read the view and press nothing', async () => {
    const io = ioWith('short')
    render(<PersonDeskDashboardViewSection userId="u" displayName="Marcus Lee" personRole="master_technician" viewer={viewer({ role: 'controller' })} changeKey={0} io={io} />)
    const short = (await screen.findByRole('button', { name: /^Short/ })) as HTMLButtonElement
    await waitFor(() => expect(short.getAttribute('aria-pressed')).toBe('true'))
    expect(short.disabled).toBe(true)
    expect((screen.getByRole('button', { name: /^Full/ }) as HTMLButtonElement).disabled).toBe(true)
    cleanup()
    render(<PersonDeskDashboardViewSection userId="u" displayName="Marcus Lee" personRole="master_technician" viewer={viewer({ role: 'dev', readOnly: true })} changeKey={0} io={io} />)
    expect(((await screen.findByRole('button', { name: /^Full/ })) as HTMLButtonElement).disabled).toBe(true)
    expect(io.set).not.toHaveBeenCalled()
  })

  it('a refused press names its reason', async () => {
    render(<PersonDeskDashboardViewSection userId="u" displayName="Marcus Lee" personRole="master_technician" viewer={viewer()} changeKey={0} io={ioWith('full', 'Only the office sets another person’s Dashboard view.')} />)
    const short = await screen.findByRole('button', { name: /^Short/ })
    await waitFor(() => expect((short as HTMLButtonElement).disabled).toBe(false))
    fireEvent.click(short)
    expect((await screen.findByRole('alert')).textContent).toBe('Only the office sets another person’s Dashboard view.')
  })
})
