// @vitest-environment jsdom
/**
 * Render smoke for the sheet's page as the editor (punch list #404): the line under the title. The usual holds the
 * job's name as a blank, drawn after the words or written out inside them, and a job's line typed back to what the
 * usual reads is not kept as the job's own. The rules are held by `sheet.test.ts`; this holds the wiring. Every name
 * here is made up.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { INSURANCE_SHEET_FIXTURE } from '../../lib/documentBuilder/insuranceSheet.fixture'
import { SHEET_JOB_BLANK, fieldPath, startJobSheet, withUsualWords, type JobSheet, type SheetDef } from '../../lib/documentBuilder/sheet'
import { SheetPaperEdit } from './SheetPaper'

afterEach(cleanup)

const USUAL: SheetDef = INSURANCE_SHEET_FIXTURE
const CEDAR = (): JobSheet => startJobSheet({ name: 'Cedar Park Medical Office', place: '410 Sample Street, Cedar Park, TX 78613', insured: ['Pecan Ridge Holdings, Ltd.'] })
const LINE = 'The line under the title'

function type(label: string, words: string) {
  const field = screen.getByRole('textbox', { name: label })
  field.textContent = words
  fireEvent.input(field)
}

describe('SheetPaperEdit, the line under the title', () => {
  it('draws the blank after the usual’s words when the line does not write it out', () => {
    render(<SheetPaperEdit mode="usual" def={USUAL} stamp="" onUsual={vi.fn()} />)
    expect(screen.getByRole('textbox', { name: LINE }).textContent).toBe('For subcontractors on')
    expect(screen.getByText("the job's name")).toBeTruthy()
  })

  it('draws the blank once, in the line’s own words, when the usual writes it out', () => {
    const def = withUsualWords(USUAL, fieldPath('sub'), `On ${SHEET_JOB_BLANK}, for every trade`)
    render(<SheetPaperEdit mode="usual" def={def} stamp="" onUsual={vi.fn()} />)
    expect(screen.getByRole('textbox', { name: LINE }).textContent).toBe(`On ${SHEET_JOB_BLANK}, for every trade`)
    expect(screen.queryByText("the job's name")).toBeNull()
  })

  it('reads the usual’s line with the job’s name in its blank on a job', () => {
    const def = withUsualWords(USUAL, fieldPath('sub'), `On ${SHEET_JOB_BLANK}, for every trade`)
    render(<SheetPaperEdit mode="job" def={def} job={CEDAR()} stamp="" onJob={vi.fn()} />)
    expect(screen.getByRole('textbox', { name: LINE }).textContent).toBe('On Cedar Park Medical Office, for every trade')
  })

  it('keeps a job’s typed line as its own, and lets it go when it is typed back to the usual’s reading', () => {
    const onJob = vi.fn()
    const view = render(<SheetPaperEdit mode="job" def={USUAL} job={CEDAR()} stamp="" onJob={onJob} />)
    type(LINE, 'For every trade on Cedar Park Medical Office')
    const typed = onJob.mock.calls[0]?.[0] as JobSheet
    expect(typed.over).toEqual({ [fieldPath('sub')]: 'For every trade on Cedar Park Medical Office' })
    view.rerender(<SheetPaperEdit mode="job" def={USUAL} job={typed} stamp="" onJob={onJob} />)
    type(LINE, 'For subcontractors on Cedar Park Medical Office')
    expect((onJob.mock.calls[1]?.[0] as JobSheet).over).toEqual({})
  })
})
