// @vitest-environment jsdom
/**
 * A Document builder link, opened (punch list #404, step 4): the public page shows the published sheet light and
 * with no field, prints it, says a link is no longer open without saying why, and offers Try again when the page
 * could not be reached. Every name and amount here is made up.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'

vi.mock('../lib/supabase', async () => {
  const { makeSupabaseStub } = await import('../test/renderSmokeMocks')
  return { supabase: makeSupabaseStub() }
})

import { BUILDER_LINK_SAMPLE_PATH } from '../lib/customerJourneys'
import { INSURANCE_SHEET_FIXTURE } from '../lib/documentBuilder/insuranceSheet.fixture'
import type { openBuilderLink, BuilderLinkView } from '../lib/documentBuilder/linkIo'
import { SECRECY_PAPER_FIXTURE } from '../lib/documentBuilder/secrecyPaper.fixture'
import { layOver, startJobSheet } from '../lib/documentBuilder/sheet'
import BuilderLink from './BuilderLink'

afterEach(cleanup)

const SHEET = layOver(
  { ...INSURANCE_SHEET_FIXTURE, cover: INSURANCE_SHEET_FIXTURE.cover.map((c, i) => ({ ...c, limit: `Made-up amount ${i + 1}` })) },
  startJobSheet({ name: 'Cedar Park Medical Office', place: '410 Sample Street, Cedar Park, TX 78613', insured: ['Pecan Ridge Holdings, Ltd.'] }),
)

function open(answer: BuilderLinkView | BuilderLinkView[]) {
  const answers = Array.isArray(answer) ? [...answer] : [answer]
  const io = vi.fn<typeof openBuilderLink>(async () => (answers.length > 1 ? (answers.shift() as BuilderLinkView) : (answers[0] as BuilderLinkView)))
  render(
    <MemoryRouter initialEntries={['/d/abcdefgh23456789']} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <Routes>
        <Route path="/d/:code" element={<BuilderLink open={io} />} />
      </Routes>
    </MemoryRouter>,
  )
  return io
}

describe('BuilderLink', () => {
  it('shows the published sheet, light, with no field to type in', async () => {
    const io = open({ kind: 'sheet', sheet: SHEET, revision: 2, job: 'Cedar Park Medical Office' })
    expect(await screen.findByText('INSURANCE REQUIREMENTS')).toBeTruthy()
    expect(io).toHaveBeenCalledWith('abcdefgh23456789')
    expect(screen.getByText('For subcontractors on Cedar Park Medical Office')).toBeTruthy()
    expect(screen.getByText('Pecan Ridge Holdings, Ltd.')).toBeTruthy()
    expect(screen.getByText('Made-up amount 5')).toBeTruthy()
    expect(screen.getByText('Revision 2 · Cedar Park Medical Office')).toBeTruthy()
    expect(screen.queryByRole('textbox')).toBeNull()
    expect(document.querySelector('[data-builder-link]')?.getAttribute('data-theme')).toBe('light')
  })

  it('prints the sheet from its one press', async () => {
    const print = vi.spyOn(window, 'print').mockImplementation(() => {})
    open({ kind: 'sheet', sheet: SHEET, revision: 1, job: 'Cedar Park Medical Office' })
    fireEvent.click(await screen.findByRole('button', { name: 'Print this sheet' }))
    expect(print).toHaveBeenCalledTimes(1)
    print.mockRestore()
  })

  it('says a link is no longer open, and shows nothing of the sheet', async () => {
    open({ kind: 'gone', words: 'This link is no longer open. Ask for a new one.' })
    expect((await screen.findByRole('status')).textContent).toBe('This link is no longer open. Ask for a new one.')
    expect(screen.queryByText('INSURANCE REQUIREMENTS')).toBeNull()
    expect(screen.queryByRole('button', { name: 'Print this sheet' })).toBeNull()
  })

  it('offers Try again when the page could not be reached, and opens on the second try', async () => {
    const io = open([{ kind: 'signal' }, { kind: 'sheet', sheet: SHEET, revision: 1, job: '' }])
    fireEvent.click(await screen.findByRole('button', { name: 'Try again' }))
    expect(await screen.findByText('INSURANCE REQUIREMENTS')).toBeTruthy()
    expect(screen.getByText('Revision 1')).toBeTruthy()
    expect(io).toHaveBeenCalledTimes(2)
  })

  it('draws a made-up sheet for the sample, and reads no link', async () => {
    const io = vi.fn<typeof openBuilderLink>()
    render(
      <MemoryRouter initialEntries={[BUILDER_LINK_SAMPLE_PATH]} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <Routes>
          <Route path="/d/:code" element={<BuilderLink open={io} />} />
        </Routes>
      </MemoryRouter>,
    )
    expect(await screen.findByText('INSURANCE REQUIREMENTS')).toBeTruthy()
    expect(screen.getAllByText('A made-up amount')).toHaveLength(5)
    expect(io).not.toHaveBeenCalled()
  })

  it('draws a published builder as a flow to walk, under the name someone outside reads, with no field', async () => {
    const io = open({ kind: 'builder', builder: 'sub-nda', revision: 3, contents: JSON.parse(JSON.stringify(SECRECY_PAPER_FIXTURE)) })
    expect(await screen.findByRole('heading', { level: 1, name: 'Secrecy on your jobs' })).toBeTruthy()
    expect(io).toHaveBeenCalledWith('abcdefgh23456789')
    expect(screen.getByText('Revision 3')).toBeTruthy()
    expect(screen.getByText('Step 1 of 11')).toBeTruthy()
    expect(screen.getByText('This page is a look at the paper. Nothing you pick here is saved or sent.')).toBeTruthy()
    // Look only: not one field, and nothing of the office's own name for it.
    expect(screen.queryByRole('textbox')).toBeNull()
    expect(screen.queryByText(/Sub NDA/)).toBeNull()
    expect(screen.queryByRole('button', { name: 'Print this sheet' })).toBeNull()
    expect(document.querySelector('[data-builder-link]')?.getAttribute('data-theme')).toBe('light')
  })

  it('walks the builder to its last step, which has no press: nothing is confirmed, required or sent', async () => {
    open({ kind: 'builder', builder: 'sub-nda', revision: 1, contents: JSON.parse(JSON.stringify(SECRECY_PAPER_FIXTURE)) })
    fireEvent.click(await screen.findByRole('checkbox', { name: 'I have read this.' }))
    fireEvent.click(screen.getByRole('button', { name: 'Next: The basis' }))
    expect(screen.getByText('Step 2 of 11')).toBeTruthy()
    // A page still moves under the slider: a look is a walk.
    fireEvent.click(screen.getByRole('button', { name: 'Step 4: Photos and video' }))
    expect(screen.getByRole('slider', { name: 'Photos and video' })).toBeTruthy()
    expect(screen.queryByRole('textbox')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Step 11: Review' }))
    expect(screen.getByText('Step 11 of 11')).toBeTruthy()
    expect(screen.queryByRole('button', { name: SECRECY_PAPER_FIXTURE.words.confirmPress })).toBeNull()
    expect(screen.getByText('That is the whole paper. Press Back to look at a page again.')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Back' })).toBeTruthy()
  })

  it('says nothing is published for a builder whose contents are not a paper to walk', async () => {
    open({ kind: 'builder', builder: 'insurance', revision: 1, contents: { title: 'A made-up sheet' } })
    expect((await screen.findByRole('status')).textContent).toBe('Nothing is published on this link yet.')
    expect(screen.queryByText('Step 1 of 11')).toBeNull()
  })

  it('names the reason when the page answers with one', async () => {
    open({ kind: 'failed', words: 'Something went wrong. Try again in a moment.' })
    expect((await screen.findByRole('alert')).textContent).toContain('Something went wrong. Try again in a moment.')
  })
})
