// @vitest-environment jsdom
/**
 * Settings → What the team sees (v2.4142): the role chips pick whose week, the rows group by
 * when, a sample row opens to the built email, a real row offers the function's preview, a
 * soon row says so, and "A person" reads the recipient lists.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, screen, within } from '@testing-library/react'
import { installDomShims, renderSettled } from '../../test/renderSmokeMocks'
import { SettingsWhatTheTeamSeesTab, sampleRecipientFor, weekStartLabel } from './SettingsWhatTheTeamSeesTab'

const tables: Record<string, unknown[]> = {
  users: [
    { id: 'u-malachi', name: 'Malachi Sample', role: 'controller', email: 'malachi@example.com' },
    { id: 'u-wendi', name: 'Wendi Sample', role: 'master_technician', email: 'wendi@example.com' },
  ],
  email_templates: [{ template_type: 'sign_in', subject: 'Your link, {{name}}', body: 'Tap: {{link}}' }],
  app_settings: [{ key: 'paid_job_email_recipients_v1', value_text: JSON.stringify(['u-wendi']) }],
}

vi.mock('../../lib/supabase', async () => {
  const { makeSupabaseStub } = await import('../../test/renderSmokeMocks')
  const stub = makeSupabaseStub() as unknown as { from: (table: string) => unknown; rpc: (name: string) => unknown }
  const plain = stub.from
  stub.from = (table: string) => {
    const builder = plain(table) as Record<string, unknown>
    const rows = () => Promise.resolve({ data: tables[table] ?? [], error: null, count: 0 })
    builder.then = (ok?: (v: unknown) => unknown, bad?: (e: unknown) => unknown) => rows().then(ok, bad)
    return builder
  }
  stub.rpc = () => Promise.resolve({ data: { report_schedules: [] }, error: null })
  return { supabase: stub }
})

vi.mock('../../hooks/useAuth', async () => {
  const { useAuthModuleMock } = await import('../../test/renderSmokeMocks')
  return useAuthModuleMock({ role: 'dev', profileName: 'Robert Douglas' })
})

vi.mock('../../lib/crewDayEmailClient', () => ({ fetchCrewDayPreview: vi.fn(async () => '<p>crew day, live</p>'), sendCrewDayTest: vi.fn(async () => undefined) }))
vi.mock('../../lib/moneyWaitingEmailClient', () => ({ fetchMoneyWaitingPreview: vi.fn(async () => '<p>money waiting, live</p>'), sendMoneyWaitingTest: vi.fn(async () => undefined) }))
vi.mock('../../lib/paymentForecastEmailClient', () => ({ fetchPaymentForecastPreview: vi.fn(async () => ''), sendPaymentForecastTest: vi.fn(async () => undefined) }))
vi.mock('../../lib/billedReportEmailClient', () => ({ fetchBilledReportPreview: vi.fn(async () => ''), sendBilledReportTest: vi.fn(async () => undefined) }))

installDomShims()
afterEach(() => cleanup())

function mount() {
  return renderSettled(<SettingsWhatTheTeamSeesTab />, { loaded: () => screen.getByTestId('wtts-coverage') })
}

describe('SettingsWhatTheTeamSeesTab', () => {
  it('opens on a controller’s week, grouped by when, with the count line', async () => {
    await mount()
    expect(screen.getByTestId('wtts-coverage').textContent).toContain('25 emails · 12 render live · 3 show the real one · 10 built on the server (next release)')
    const headings = screen.getAllByRole('heading', { level: 3 }).map((h) => h.textContent ?? '')
    expect(headings[0]).toContain('Every morning')
    expect(headings.some((h) => h.includes('When something happens'))).toBe(true)
    expect(screen.getByTestId('wtts-row-money_waiting').textContent).toContain('Money waiting —')
    expect(screen.queryByTestId('wtts-row-ct_roster_audit')).toBeNull()
  })
  it('a role chip changes whose week; a helper has no digests', async () => {
    await mount()
    fireEvent.click(screen.getByRole('radio', { name: 'Helper' }))
    expect(screen.queryByTestId('wtts-row-money_waiting')).toBeNull()
    expect(screen.getByTestId('wtts-row-invitation')).toBeTruthy()
  })
  it('a sample row opens to the built email, on the live template', async () => {
    await mount()
    fireEvent.click(screen.getByRole('radio', { name: 'Helper' }))
    fireEvent.click(within(screen.getByTestId('wtts-row-sign_in')).getByRole('button', { name: 'Sign-in link' }))
    const expanded = screen.getByTestId('wtts-expanded')
    expect(expanded.textContent).toContain('Subject: Your link, Helper Sample')
    expect(expanded.querySelector('iframe')?.getAttribute('srcdoc')).toContain('Tap: ')
  })
  it('a real row offers the function’s preview and shows it', async () => {
    await mount()
    fireEvent.click(within(screen.getByTestId('wtts-row-money_waiting')).getByRole('button', { name: 'Money waiting' }))
    fireEvent.click(screen.getByRole('button', { name: /Show the real one/ }))
    const frame = await screen.findByTitle('Money waiting — real')
    expect(frame.getAttribute('srcdoc')).toBe('<p>money waiting, live</p>')
  })
  it('a soon row says which function builds it', async () => {
    await mount()
    fireEvent.click(within(screen.getByTestId('wtts-row-weekly_money')).getByRole('button', { name: 'Weekly money movement' }))
    expect(screen.getByTestId('wtts-expanded').textContent).toContain('weekly-money-email-dispatch')
  })
  it('a person reads the recipient lists: Malachi is not on the Paid job list', async () => {
    await mount()
    fireEvent.change(screen.getByLabelText('A person'), { target: { value: 'Mala' } })
    fireEvent.click(screen.getByRole('option', { name: /Malachi Sample/ }))
    expect(screen.getByTestId('wtts-row-money_waiting')).toBeTruthy()
    expect(screen.queryByTestId('wtts-row-paid_job')).toBeNull()
    expect(screen.getByTestId('wtts-row-gc_word_ask').textContent).toContain('Malachi, where do your 7 GCs stand?')
  })
  it('the only-soon toggle keeps the next-release rows', async () => {
    await mount()
    fireEvent.click(screen.getByRole('button', { name: "Only what doesn't render yet" }))
    expect(screen.queryByTestId('wtts-row-money_waiting')).toBeNull()
    expect(screen.getByTestId('wtts-row-weekly_money')).toBeTruthy()
  })
})

describe('helpers', () => {
  it('weekStartLabel is the Monday of the week', () => {
    expect(weekStartLabel('2026-09-29')).toBe('Sep 28')
    expect(weekStartLabel('2026-09-28')).toBe('Sep 28')
    expect(weekStartLabel('2026-09-27')).toBe('Sep 21')
  })
  it('sampleRecipientFor names the role', () => {
    expect(sampleRecipientFor('controller')).toEqual({ name: 'Controller Sample', email: 'controller@example.com', role: 'controller' })
    expect(sampleRecipientFor('master_technician').name).toBe('Leader Sample')
  })
})
