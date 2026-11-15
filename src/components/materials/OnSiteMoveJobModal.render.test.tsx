// @vitest-environment jsdom
/**
 * Move everything on site to another job (punch list #209, v2.7305): the window picks the receiving job (the same
 * site's jobs first, then a search), Read the plan draws the dry run as the confirm window with the verb and the counts
 * on its button, the apply calls the same RPC and the page is told what to say, and a refusal is said with its reason.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, screen, waitFor } from '@testing-library/react'
import { renderWithProviders } from '../../test/renderSmokeMocks'
import { readMovePlan } from '../../lib/materials/onSiteMoveJob'
import { PLAN_REPLY } from '../../lib/materials/onSiteMoveJob.fixture'
import OnSiteMoveJobModal from './OnSiteMoveJobModal'

const FROM = PLAN_REPLY.from.id
const TO = PLAN_REPLY.to.id
const jobs = [
  { id: FROM, label: 'JP224 · Materials: Phase 2 draws' },
  { id: TO, label: 'JP1091 · Lift stations and site visit' },
  { id: 'j3', label: 'JP1111 · ZZ Test bio walk' },
]
const siteOfJob = new Map<string, string | null>([[FROM, 'gun-dog'], [TO, 'gun-dog'], ['j3', null]])
const plan = readMovePlan(PLAN_REPLY)!

afterEach(cleanup)

describe('the move window', () => {
  it('lists the same site’s job first, reads the plan and draws it as the confirm window, then moves', async () => {
    const planSpy = vi.fn(async () => plan)
    const applySpy = vi.fn(async () => ({ ...plan, dryRun: false }))
    const after = vi.fn(async () => 'Its 90 box photos are moving to the job’s Drive folder.')
    const onMoved = vi.fn()
    const onClose = vi.fn()
    renderWithProviders(<OnSiteMoveJobModal sourceJobId={FROM} jobs={jobs} siteOfJob={siteOfJob} role="assistant" onClose={onClose} onMoved={onMoved} plan={planSpy} apply={applySpy} after={after} />)
    expect(screen.getByTestId('move-job-source').textContent).toBe('JP224 · Materials: Phase 2 draws')
    const same = screen.getByTestId('move-job-same-site')
    expect(same.textContent).toContain('JP1091')
    expect(same.textContent).not.toContain('JP1111')
    // Nothing picked: Read the plan is dead and the window says what to do.
    const read = screen.getByTestId('move-job-read') as HTMLButtonElement
    expect(read.disabled).toBe(true)
    expect(screen.getByText('Pick the job the material belongs on, then press Read the plan.')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'JP1091 · Lift stations and site visit' }))
    expect(read.disabled).toBe(false)
    fireEvent.click(read)
    await waitFor(() => expect(screen.getByTestId('move-job-plan')).toBeTruthy())
    expect(planSpy).toHaveBeenCalledWith(FROM, TO)
    expect(screen.getByText('Everything on site on JP224 moves to JP1091.')).toBeTruthy()
    const moved = screen.getByTestId('move-job-moved').textContent ?? ''
    expect(moved).toContain('92 cages and boxes, 6 of them retired')
    expect(moved).toContain('284 presses on the ledger')
    expect(moved).toContain('91 photos')
    expect(screen.getByTestId('move-job-folds').textContent).toContain('Gun dog joins JP1091’s Gun dog with its 5 boxes.')
    expect(screen.getByTestId('move-job-folds').textContent).toContain('G6 becomes G95.')
    const table = screen.getByTestId('move-job-before-after').textContent ?? ''
    expect(table).toContain('JP224')
    expect(table).toContain('2,230')
    expect(table).toContain('2,233')
    expect(screen.getByTestId('move-job-photos').textContent).toContain('90 files already in Drive follow to JP1091’s Drive folder by the photo sweep.')
    expect(screen.queryByTestId('move-job-on-hand')).toBeNull()
    const confirm = screen.getByTestId('move-job-confirm')
    expect(confirm.textContent).toBe('Move 92 boxes and 284 presses to JP1091')
    fireEvent.click(confirm)
    await waitFor(() => expect(onMoved).toHaveBeenCalled())
    expect(applySpy).toHaveBeenCalledWith(FROM, TO)
    expect(after).toHaveBeenCalledWith(FROM, TO, 'assistant')
    expect(onMoved).toHaveBeenCalledWith(FROM, TO, 'JP1091 now holds the 92 boxes that were on JP224. JP224 has nothing on site. A note is on both jobs. Its 90 box photos are moving to the job’s Drive folder.')
    expect(onClose).toHaveBeenCalled()
  })

  it('finds a job on no site by its words, and says a refused plan with its reason', async () => {
    const planSpy = vi.fn(async () => { throw new Error('on_site_move_job: JP224 has nothing on site to move — no place, cage, box, ledger row, photo, part rename, sticker run, Same part? answer or price') })
    renderWithProviders(<OnSiteMoveJobModal sourceJobId={FROM} jobs={jobs} siteOfJob={siteOfJob} role="dev" onClose={() => {}} onMoved={() => {}} plan={planSpy} apply={async () => plan} after={async () => ''} />)
    fireEvent.change(screen.getByLabelText('Find another job'), { target: { value: 'zz' } })
    const found = screen.getByTestId('move-job-found')
    expect(found.textContent).toContain('JP1111')
    expect(found.textContent).not.toContain('JP1091')
    fireEvent.click(screen.getByRole('button', { name: 'JP1111 · ZZ Test bio walk' }))
    fireEvent.click(screen.getByTestId('move-job-read'))
    await waitFor(() => expect(screen.getByTestId('move-job-refused')).toBeTruthy())
    expect(screen.getByTestId('move-job-refused').textContent).toContain('JP224 has nothing on site to move')
    expect(planSpy).toHaveBeenCalledWith(FROM, 'j3')
    expect(screen.queryByTestId('move-job-plan')).toBeNull()
  })

  it('from the desk’s site row, picks the source from the site’s jobs, and a refused move keeps the plan with its reason', async () => {
    const applySpy = vi.fn(async () => { throw new Error('on_site_move_job: the rows on JP1091 after the move do not add up to both jobs’ rows — nothing written') })
    const onMoved = vi.fn()
    renderWithProviders(<OnSiteMoveJobModal sourceJobId={null} sourceChoices={jobs.slice(0, 2)} jobs={jobs} siteOfJob={siteOfJob} role="controller" onClose={() => {}} onMoved={onMoved} plan={async () => plan} apply={applySpy} after={async () => ''} />)
    expect(screen.queryByTestId('move-job-same-site')).toBeNull()
    fireEvent.change(screen.getByTestId('move-job-source-pick'), { target: { value: FROM } })
    expect(screen.getByTestId('move-job-same-site').textContent).toContain('JP1091')
    fireEvent.click(screen.getByRole('button', { name: 'JP1091 · Lift stations and site visit' }))
    fireEvent.click(screen.getByTestId('move-job-read'))
    await waitFor(() => expect(screen.getByTestId('move-job-confirm')).toBeTruthy())
    fireEvent.click(screen.getByTestId('move-job-confirm'))
    await waitFor(() => expect(screen.getByTestId('move-job-refused')).toBeTruthy())
    expect(screen.getByTestId('move-job-refused').textContent).toContain('do not add up')
    expect(screen.getByTestId('move-job-plan')).toBeTruthy()
    expect(onMoved).not.toHaveBeenCalled()
  })

  it('says when the parts on hand do not add up, and never refuses for it', async () => {
    const unsure = readMovePlan({ ...PLAN_REPLY, on_hand: { holds: false, words: 'The parts on hand do not add up: 2230 from JP224 and 3 already on JP1091 read 2200 after.' } })!
    renderWithProviders(<OnSiteMoveJobModal sourceJobId={FROM} jobs={jobs} siteOfJob={siteOfJob} role="master_technician" onClose={() => {}} onMoved={() => {}} plan={async () => unsure} apply={async () => unsure} after={async () => ''} />)
    fireEvent.click(screen.getByRole('button', { name: 'JP1091 · Lift stations and site visit' }))
    fireEvent.click(screen.getByTestId('move-job-read'))
    await waitFor(() => expect(screen.getByTestId('move-job-on-hand')).toBeTruthy())
    expect(screen.getByTestId('move-job-on-hand').textContent).toContain('do not add up')
    expect((screen.getByTestId('move-job-confirm') as HTMLButtonElement).disabled).toBe(false)
  })
})
