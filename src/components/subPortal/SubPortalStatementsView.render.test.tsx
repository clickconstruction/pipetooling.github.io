// @vitest-environment jsdom
/**
 * The sub's Statements view, drawn (punch list #371, step 2): the head with Still open, the statement of account,
 * the work statements and the payments, in both languages, the papers it hands the PDF press, and the state a sub
 * meets when the papers do not add up. The rows are the made-up ones of `subPortalPapersFixture.ts`.
 */
import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import type { StatementRange } from '../../../supabase/functions/_shared/subPapers'
import { buildSubPortalPapers } from '../../../supabase/functions/_shared/subPortalPapers'
import { subPortalT, type SubPortalLang, type SubPortalStringKey } from '../../lib/subPortal/subPortalI18n'
import { parseSubPortalPapers, type SubPortalPapers } from '../../lib/subPortal/subPortalPapersPayload'
import { SENDING_226, harlanRows } from '../../lib/subPortal/subPortalPapersFixture'
import type { SubPaper } from '../../lib/subWorkOrders/subPaperSend'
import { SubPortalStatementsView } from './SubPortalStatementsView'

const WHO = { subName: 'Harlan Mechanical', company: { name: 'Your Company Name', lines: ['100 Example Way, Suite 4'] }, officePhone: '(555) 010-0100', now: new Date('2026-11-16T15:30:00Z') }
const PAPERS = parseSubPortalPapers(JSON.parse(JSON.stringify(buildSubPortalPapers(harlanRows({ acks: [{ kind: 'received', paper_id: null, labor_job_id: null, sending_id: SENDING_226, payment_id: null, note: null, created_at: '2026-11-02T18:00:00Z' }] }), WHO))))!

function draw(lang: SubPortalLang = 'en', papers: SubPortalPapers = PAPERS) {
  const saved: Array<{ paper: SubPaper; range: StatementRange }> = []
  const savePaper = vi.fn(async (paper: SubPaper, range: StatementRange) => void saved.push({ paper, range }))
  const t = (key: SubPortalStringKey, vars?: Record<string, string>) => subPortalT(lang, key, vars)
  render(<SubPortalStatementsView papers={papers} subName="Harlan Mechanical" lang={lang} t={t} switcher={<div>the switch</div>} savePaper={savePaper} />)
  return { saved, savePaper }
}

describe('SubPortalStatementsView', () => {
  it('draws the head, the statement of account, every work statement and every payment', () => {
    draw()
    expect(screen.getByRole('heading', { name: 'Your statements' })).toBeTruthy()
    expect(screen.getByText('Still open')).toBeTruthy()
    expect(screen.getByTestId('statements-still-open').textContent).toBe('$1,500.00')
    expect(screen.getByText('the switch')).toBeTruthy()
    expect(screen.getByTestId('statements-soa').textContent).toContain('To date, live · still open · last payment $2,200.00 on Nov 12, 2026')

    const work = screen.getAllByTestId('statements-work-row')
    expect(work.map((r) => r.textContent)).toEqual([
      // cedar-1 changed since the office's copy in this fixture, so the row says so.
      expect.stringContaining('WS-2041-1#2041 Cedar Hollow ClinicComes to $4,000.00 · paid $2,500.00 · $1,500.00 open'),
      expect.stringContaining('WS-2041-2#2041 Cedar Hollow ClinicComes to $1,200.00 · paid $1,200.00'),
      expect.stringContaining('#2033 Alder Court RemodelComes to $1,800.00 · paid $1,800.00'),
    ])
    expect(within(work[1]!).getByText('Paid')).toBeTruthy()
    expect(within(work[1]!).getByText("Changed since the office's copy of Nov 5, 2026")).toBeTruthy()

    const pay = screen.getAllByTestId('statements-payment-row')
    expect(pay).toHaveLength(4)
    expect(pay[0]!.textContent).toContain('PR-0231Nov 12, 2026 · Zelle 8841')
    expect(pay[0]!.textContent).toContain('$1,200.00 on WS-2041-2 · $1,000.00 on WS-2041-1')
    expect(within(pay[1]!).getByText('Received Nov 2, 2026')).toBeTruthy()
    expect(pay[2]!.textContent).toContain('$900.00 on Sheet of Sep 1, 2026 · $50.00 kept as your credit · recorded before payments had numbers')
    expect(pay[3]!.textContent).toContain('recorded Sep 2, 2026 · Check 1140')
    expect(screen.getByText('One job you share with someone else is on Today only.')).toBeTruthy()
  })

  it('is screen only, so Print never prints a list of buttons', () => {
    draw()
    expect(screen.getByTestId('sub-portal-statements').hasAttribute('data-screen-only')).toBe(true)
  })

  it('reads in Spanish, with the dates and the method in Spanish too', () => {
    draw('es')
    expect(screen.getByRole('heading', { name: 'Sus estados de cuenta' })).toBeTruthy()
    expect(screen.getByText('Pendiente')).toBeTruthy()
    expect(screen.getByTestId('statements-soa').textContent).toContain('Al día de hoy · pendiente · último pago $2,200.00 el 12 nov 2026')
    expect(screen.getByRole('button', { name: 'Guardar como PDF' })).toBeTruthy()
    const pay = screen.getAllByTestId('statements-payment-row')
    expect(pay[1]!.textContent).toContain('31 oct 2026 · Cheque 1182')
    expect(within(pay[1]!).getByText('Recibido el 2 nov 2026')).toBeTruthy()
    expect(pay[2]!.textContent).toContain('20 sep 2026 · Efectivo')
    expect(screen.getByText(/Los PDF están en inglés\./)).toBeTruthy()
  })

  it('Save as PDF hands over a statement of account with no number, saved from the page', async () => {
    const { saved, savePaper } = draw()
    fireEvent.click(screen.getByRole('button', { name: 'Save as PDF' }))
    await waitFor(() => expect(savePaper).toHaveBeenCalledTimes(1))
    const { paper, range } = saved[0]!
    expect(range).toEqual({ from: null, to: null })
    expect(paper.kind).toBe('statement_of_account')
    expect(paper.number).toBe('')
    expect(paper.foot).toMatch(/^Saved from your page .+ Central time · 3 statements · 4 payments$/)
  })

  it('each row’s PDF hands over that row’s own paper', async () => {
    const { saved, savePaper } = draw()
    fireEvent.click(within(screen.getAllByTestId('statements-work-row')[0]!).getByRole('button', { name: 'PDF' }))
    await waitFor(() => expect(savePaper).toHaveBeenCalledTimes(1))
    expect(saved[0]!.paper).toMatchObject({ kind: 'work_statement', number: 'WS-2041-1', stillOpen: 1500 })
    fireEvent.click(within(screen.getAllByTestId('statements-payment-row')[0]!).getByRole('button', { name: 'PDF' }))
    await waitFor(() => expect(savePaper).toHaveBeenCalledTimes(2))
    expect(saved[1]!.paper).toMatchObject({ kind: 'payment_record', number: 'PR-0231', amountSent: 2200 })
  })

  it('Pick dates makes a period: the card says what was open on its last day, and a start after the end stops the save', async () => {
    const { saved, savePaper } = draw()
    fireEvent.click(screen.getByRole('button', { name: 'Pick dates' }))
    fireEvent.change(screen.getByLabelText('From'), { target: { value: '2026-10-01' } })
    fireEvent.change(screen.getByLabelText('To'), { target: { value: '2026-10-31' } })
    expect(screen.getByTestId('statements-soa').textContent).toContain('Oct 1, 2026 – Oct 31, 2026 · still open on Oct 31, 2026: $2,600.00')
    // The big figure stays today's.
    expect(screen.getByTestId('statements-still-open').textContent).toBe('$1,500.00')
    fireEvent.click(screen.getByRole('button', { name: 'Save as PDF' }))
    await waitFor(() => expect(savePaper).toHaveBeenCalledTimes(1))
    expect(saved[0]!.range).toEqual({ from: '2026-10-01', to: '2026-10-31' })

    fireEvent.change(screen.getByLabelText('From'), { target: { value: '2026-11-10' } })
    expect(screen.getByText('Pick a start that is not after the end, and no day past today.')).toBeTruthy()
    expect((screen.getByRole('button', { name: 'Save as PDF' }) as HTMLButtonElement).disabled).toBe(true)
  })

  it('a PDF that cannot be made says so, with the door', async () => {
    const t = (key: SubPortalStringKey, vars?: Record<string, string>) => subPortalT('en', key, vars)
    render(<SubPortalStatementsView papers={PAPERS} subName="Harlan Mechanical" lang="en" t={t} switcher={null} savePaper={async () => Promise.reject(new Error('no pdf'))} />)
    fireEvent.click(screen.getByRole('button', { name: 'Save as PDF' }))
    expect((await screen.findByRole('alert')).textContent).toBe('The PDF could not be made. Try again, or call the office.')
  })

  it('papers that do not add up show no figure: the office is checking, with its phone', () => {
    draw('en', { ok: false, officePhone: '(555) 010-0100' })
    expect(screen.getByRole('status').textContent).toBe('The office is checking your statements.Call the office if you need a figure today: (555) 010-0100')
    expect(screen.getByRole('link', { name: '(555) 010-0100' }).getAttribute('href')).toBe('tel:5550100100')
    expect(screen.queryByTestId('statements-still-open')).toBeNull()
    expect(screen.queryByText(/\$/)).toBeNull()
    expect(screen.queryByRole('button', { name: 'Save as PDF' })).toBeNull()
  })

  it('a new sub with nothing yet reads what will show here', () => {
    const empty = parseSubPortalPapers(JSON.parse(JSON.stringify(buildSubPortalPapers({ ...harlanRows(), sheets: [], items: [], payments: [], assignees: [], register: [] }, WHO))))!
    draw('en', empty)
    expect(screen.getByTestId('statements-soa').textContent).toContain('To date, live · Nothing is open with you.')
    expect(screen.getByText('A statement shows here for each piece of work the office writes up for you.')).toBeTruthy()
    expect(screen.getByText('Each payment shows here the day the office records it.')).toBeTruthy()
  })
})
