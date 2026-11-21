// @vitest-environment jsdom
/**
 * Render smokes for Write someone up (punch list #410): the press draws for a leader and a superintendent and for
 * nobody else; the sheet opens on the crew of today's job; a pick fills who, when and the job; the button says what is
 * missing; the read-back is the only place that sends; the send carries the facts and one press id; a failed send
 * keeps the words; the writer's own list takes one back with a reason. Made-up people and a made-up job.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, screen } from '@testing-library/react'

vi.mock('../../lib/supabase', async () => {
  const { makeSupabaseStub } = await import('../../test/renderSmokeMocks')
  return { supabase: makeSupabaseStub() }
})
vi.mock('../../hooks/useAuth', async () => {
  const { useAuthModuleMock } = await import('../../test/renderSmokeMocks')
  return useAuthModuleMock({ role: 'master_technician' })
})
vi.mock('../../lib/navClickTelemetry', () => ({ recordNavClick: vi.fn() }))

import { WriteUpSheet } from './WriteUpSheet'
import { WriteSomeoneUpDoor } from './WriteSomeoneUpDoor'
import { renderWithProviders, settle } from '../../test/renderSmokeMocks'
import type { WriteUpIo } from '../../lib/people/writeUpIo'
import type { MyWriteUpRow, WriteUpDraft, WriteUpList, WriteUpPerson } from '../../lib/people/writeUp'

const TODAY = '2026-11-20'
const NOW = new Date('2026-11-20T18:41:00Z') // 12:41 pm on the app's clock
const person = (over: Partial<WriteUpPerson> & { person_id: string; name: string }): WriteUpPerson => ({ kind: 'helper', with_date: null, job_id: null, hcp_number: null, click_number: null, job_name: null, job_address: null, clocked_in_at: null, ...over })
const LIST: WriteUpList = {
  allowed: true,
  today: TODAY,
  people: [
    person({ person_id: 'p-dana', name: 'Dana Pruitt', with_date: TODAY, job_id: 'j-cedar', job_name: 'Cedar Hollow Lot 14', clocked_in_at: '2026-11-20T13:04:00Z' }),
    person({ person_id: 'p-luis', name: 'Luis Ortega', with_date: TODAY, job_id: 'j-cedar', job_name: 'Cedar Hollow Lot 14', clocked_in_at: '2026-11-20T13:01:00Z' }),
    person({ person_id: 'p-nate', name: 'Nate Coyle', with_date: '2026-11-18', job_id: 'j-mill', job_name: 'Mill Road Duplex' }),
    person({ person_id: 'p-ivy', name: 'Ivy Castellan' }),
  ],
  jobs: [{ job_id: 'j-cedar', hcp_number: null, click_number: null, job_name: 'Cedar Hollow Lot 14', job_address: null, last_day: TODAY }],
}
const WAITING: MyWriteUpRow = { id: 'r-1', subject_person_id: 'p-nate', content: 'Came on site at 9:40.', status: 'pending', kind: 'late_no_show', occurred_date: '2026-11-18', occurred_time: '09:40:00', job_label: 'Mill Road Duplex', created_at: '2026-11-18T16:00:00Z', resolution_note: null, adds_to: null }

function makeIo(over: Partial<WriteUpIo> = {}) {
  return {
    list: vi.fn<WriteUpIo['list']>(over.list ?? (async () => LIST)),
    mine: vi.fn<WriteUpIo['mine']>(over.mine ?? (async () => [])),
    land: vi.fn<WriteUpIo['land']>(over.land ?? (async () => ({ already: false, id: 'r-new', status: 'pending' }))),
    takeBack: vi.fn<WriteUpIo['takeBack']>(over.takeBack ?? (async () => {})),
  }
}

const press = (name: string | RegExp) => fireEvent.click(screen.getByRole('button', { name }))

async function openOn(io: WriteUpIo, onDraft: (d: WriteUpDraft | null) => void = () => {}) {
  renderWithProviders(<WriteUpSheet userId="u-leader" initialDraft={null} onDraft={onDraft} onClose={() => {}} io={io} now={() => NOW} voiceWindow={null} />)
  await settle()
}

describe('the press', () => {
  it('draws for a leader, a superintendent and a dev', () => {
    for (const role of ['master_technician', 'superintendent', 'dev']) {
      const { unmount } = renderWithProviders(<WriteSomeoneUpDoor userId="u-1" role={role} surface="dashboard" />)
      expect(screen.getByRole('button', { name: /Write someone up/ })).toBeTruthy()
      unmount()
    }
  })
  it('draws nothing for anyone else, or with nobody signed in', () => {
    for (const role of ['assistant', 'helpers', 'subcontractor', 'estimator', 'controller', 'primary', null]) {
      const { container, unmount } = renderWithProviders(<WriteSomeoneUpDoor userId="u-1" role={role} surface="dashboard" />)
      expect(container.querySelector('[data-write-someone-up]')).toBeNull()
      unmount()
    }
    const { container } = renderWithProviders(<WriteSomeoneUpDoor userId={null} role="master_technician" surface="dashboard" />)
    expect(container.querySelector('[data-write-someone-up]')).toBeNull()
  })
})

describe('the sheet', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('opens on the crew of today’s job, then this week, then everyone else', async () => {
    await openOn(makeIo())
    expect(screen.getByText('With you today · Cedar Hollow Lot 14')).toBeTruthy()
    expect(screen.getByText('Helper · on the clock since 7:04 am')).toBeTruthy()
    expect(screen.getByText('With you this week')).toBeTruthy()
    expect(screen.getByText('Helper · Wed at Mill Road Duplex')).toBeTruthy()
    expect(screen.getByText('Everyone else')).toBeTruthy()
    const names = screen.getAllByRole('button').map((b) => b.textContent ?? '').filter((t) => /Pruitt|Ortega|Coyle|Castellan/.test(t))
    expect(names.map((t) => t.split(/Helper/)[0])).toEqual(['Dana Pruitt', 'Luis Ortega', 'Nate Coyle', 'Ivy Castellan'])
  })

  it('searches every name, and an empty search names the press that clears it', async () => {
    await openOn(makeIo())
    fireEvent.change(screen.getByRole('searchbox', { name: 'Search everyone' }), { target: { value: 'ivy' } })
    expect(screen.getByRole('button', { name: /Ivy Castellan/ })).toBeTruthy()
    expect(screen.queryByRole('button', { name: /Dana Pruitt/ })).toBeNull()
    fireEvent.change(screen.getByRole('searchbox', { name: 'Search everyone' }), { target: { value: 'zed' } })
    expect(screen.getByText(/No people match/)).toBeTruthy()
    press('Clear the search')
    expect(screen.getByRole('button', { name: /Dana Pruitt/ })).toBeTruthy()
  })

  it('a pick fills who, when and the job, and the button says what is missing', async () => {
    const onDraft = vi.fn()
    await openOn(makeIo(), onDraft)
    press(/Dana Pruitt/)
    expect(screen.getByText('Dana Pruitt')).toBeTruthy()
    expect(screen.getByRole('button', { name: /Today, the day it happened/ })).toBeTruthy()
    expect(screen.getByRole('button', { name: /12:41 pm, the time it happened/ })).toBeTruthy()
    expect(screen.getByRole('button', { name: /Cedar Hollow Lot 14, the job it happened on/ })).toBeTruthy()
    expect(screen.getByText('Have you talked to Dana about it?')).toBeTruthy()
    const dead = screen.getByRole('button', { name: 'Pick a kind and say what you saw' }) as HTMLButtonElement
    expect(dead.disabled).toBe(true)
    press('Safety')
    expect((screen.getByRole('button', { name: 'Say what you saw' }) as HTMLButtonElement).disabled).toBe(true)
    fireEvent.change(screen.getByLabelText('What did you see?'), { target: { value: 'The trench by the east wall was open at lunch.' } })
    expect((screen.getByRole('button', { name: 'Read it back' }) as HTMLButtonElement).disabled).toBe(false)
    expect(onDraft).toHaveBeenLastCalledWith(expect.objectContaining({ kind: 'safety', words: 'The trench by the east wall was open at lunch.' }))
  })

  it('reads the record back, and only Send write-up to HR saves it', async () => {
    const io = makeIo({ mine: vi.fn(async () => [WAITING]) })
    const onDraft = vi.fn()
    await openOn(io, onDraft)
    press(/Dana Pruitt/)
    press('Safety')
    fireEvent.change(screen.getByLabelText('What did you see?'), { target: { value: 'The trench by the east wall was open at lunch.' } })
    press('Luis Ortega')
    press('Yes')
    expect(io.land).not.toHaveBeenCalled()
    press('Read it back')
    expect(screen.getByText('Fri, Nov 20 · 12:41 pm')).toBeTruthy()
    expect(screen.getByText('You, Luis Ortega')).toBeTruthy()
    expect(screen.getByText('Talked to Dana')).toBeTruthy()
    expect(io.land).not.toHaveBeenCalled()
    press('Send write-up to HR')
    await settle()
    expect(io.land).toHaveBeenCalledTimes(1)
    const sent = io.land.mock.calls[0]![0]
    expect(sent).toMatchObject({
      subject_person_id: 'p-dana',
      kind: 'safety',
      content: 'The trench by the east wall was open at lunch.',
      occurred_date: TODAY,
      occurred_time: '12:41',
      job_ledger_id: 'j-cedar',
      job_label: 'Cedar Hollow Lot 14',
      author_saw_it: true,
      seen_by: [{ person_id: 'p-luis', name: 'Luis Ortega' }],
      talked_to_person: true,
      adds_to: null,
      pressed_at: NOW.toISOString(),
    })
    expect(String(sent.press_id)).toMatch(/^[0-9a-f-]{36}$/)
    expect(onDraft).toHaveBeenLastCalledWith(null)
    expect(screen.getByText(/Sent to HR at 12:41 pm\./)).toBeTruthy()
    expect(screen.getByText('Waiting on HR')).toBeTruthy()
  })

  it('a send that fails keeps the words and says why', async () => {
    const io = makeIo({ land: vi.fn(async () => { throw { code: 'P0001', message: 'You cannot write yourself up.' } }) })
    await openOn(io)
    press(/Dana Pruitt/)
    press('Other')
    fireEvent.change(screen.getByLabelText('What did you see?'), { target: { value: 'Words that must not be lost.' } })
    press('Read it back')
    press('Send write-up to HR')
    await settle()
    expect(screen.getByText(/The write-up did not send: You cannot write yourself up\./)).toBeTruthy()
    expect(screen.getByText('Words that must not be lost.')).toBeTruthy()
    press('Fix it')
    expect((screen.getByLabelText('What did you see?') as HTMLTextAreaElement).value).toBe('Words that must not be lost.')
  })

  it('a second read-back of changed words takes a new press id', async () => {
    const io = makeIo({ land: vi.fn(async () => { throw { code: 'P0001', message: 'Refused.' } }) })
    await openOn(io)
    press(/Dana Pruitt/)
    press('Other')
    fireEvent.change(screen.getByLabelText('What did you see?'), { target: { value: 'First words.' } })
    press('Read it back')
    press('Send write-up to HR')
    await settle()
    press('Fix it')
    fireEvent.change(screen.getByLabelText('What did you see?'), { target: { value: 'Second words.' } })
    press('Read it back')
    press('Send write-up to HR')
    await settle()
    const ids = io.land.mock.calls.map((c) => c[0].press_id)
    expect(ids).toHaveLength(2)
    expect(ids[0]).not.toBe(ids[1])
  })

  it('the writer’s own list takes one back with a reason', async () => {
    const io = makeIo({ mine: vi.fn(async () => [WAITING]) })
    await openOn(io)
    press(/Your write-ups/)
    expect(screen.getByText('Nate Coyle')).toBeTruthy()
    expect(screen.getByText('Late or no-show · Wed, Nov 18 · Mill Road Duplex')).toBeTruthy()
    press('Take it back')
    const go = screen.getByRole('button', { name: 'Take it back' }) as HTMLButtonElement
    expect(go.disabled).toBe(true)
    fireEvent.change(screen.getByLabelText('Why are you taking it back?'), { target: { value: 'It was the other crew.' } })
    press('Take it back')
    await settle()
    expect(io.takeBack).toHaveBeenCalledWith('r-1', 'It was the other crew.')
  })

  it('a kept draft opens on the form again', async () => {
    const kept: WriteUpDraft = { person: LIST.people[0]!, kind: 'conduct', date: TODAY, time: '10:15', job: null, words: 'Kept words.', sawIt: true, seenBy: [], talked: null, addsTo: null }
    renderWithProviders(<WriteUpSheet userId="u-leader" initialDraft={kept} onDraft={() => {}} onClose={() => {}} io={makeIo()} now={() => NOW} voiceWindow={null} />)
    await settle()
    expect((screen.getByLabelText('What did you see?') as HTMLTextAreaElement).value).toBe('Kept words.')
    expect(screen.getByRole('button', { name: 'Read it back' })).toBeTruthy()
  })

  it('a list that does not load says so, and a role that may not gets words', async () => {
    await openOn(makeIo({ list: vi.fn(async () => { throw { code: '57014', message: 'canceling statement due to statement timeout' } }) }))
    expect(screen.getByText(/The list of people did not load/)).toBeTruthy()
  })
  it('a caller the function refuses reads why', async () => {
    await openOn(makeIo({ list: vi.fn(async () => ({ allowed: false, today: TODAY, people: [], jobs: [] })) }))
    expect(screen.getByText('Only a leader or a superintendent can write someone up.')).toBeTruthy()
  })
})
