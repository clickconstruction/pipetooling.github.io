import { describe, expect, it } from 'vitest'
import { submittalRows } from './buildingSubmittals'
import { initialGcState } from './schedule/testState'
import {
  addSubmittalPayload,
  cameInPayload,
  submittalFromRows,
  submittalRoundExtras,
  submittalRoundKey,
  submittalsFromRows,
  tradeSpecSections,
  withSubmittals,
  type SubmittalTables,
} from './submittalRows'
import type { GcState, Submittal } from './types'

const fairOaks = (s: GcState) => {
  const p = s.projects.find((x) => x.id === 'fairoaksd')
  if (!p) throw new Error('no Fair Oaks D')
  return p
}

/** A register as the migration's three tables would hold it. The rounds come back in no order, as a read may give them. */
function rowsOf(projectId: string, subs: Submittal[]): SubmittalTables {
  return {
    submittals: subs.map((s, i) => ({
      id: s.id,
      project_id: projectId,
      package_id: s.packageId,
      number: s.number,
      title: s.title,
      kind: s.kind,
      spec_section: s.specSection ?? null,
      lead_days: s.leadDays,
      needed_by: s.neededBy ?? null,
      asked_on: s.askedOn,
      created_by: null,
      created_at: `2026-08-01T00:00:${String(i).padStart(2, '0')}Z`,
    })),
    holds: subs.flatMap((s) => s.lineIds.map((id) => ({ submittal_id: s.id, scope_item_id: id }))),
    rounds: subs
      .flatMap((s) =>
        s.rounds.map((r, i) => ({
          id: `${s.id}-round-${i + 1}`,
          submittal_id: s.id,
          round: i + 1,
          sent_on: r.sentOn,
          sent_by: 'trade',
          recorded_by: null,
          file_name: r.file,
          drive_url: null,
          note: r.note,
          to_architect_on: r.toArchitectOn,
          email_send_log_id: null,
          answered_on: r.answeredOn,
          answer: r.answer,
          answer_note: r.answerNote,
          created_at: '2026-08-01T00:00:00Z',
        })),
      )
      .reverse(),
  }
}

describe('the submittal register from its rows', () => {
  it('reads Fair Oaks D back as the prototype holds it', () => {
    const register = fairOaks(initialGcState()).submittals ?? []
    expect(register).toHaveLength(6)
    expect(submittalsFromRows('fairoaksd', rowsOf('fairoaksd', register))).toEqual(register)
  })

  it('gives the kernels the same register: whose move, when needed, how late', () => {
    const state = initialGcState()
    const register = fairOaks(state).submittals ?? []
    const without: GcState = { ...state, projects: state.projects.map((p) => ({ ...p, submittals: [] })) }
    const read = withSubmittals(without, rowsOf('fairoaksd', register))
    const words = (s: GcState) => submittalRows(s, fairOaks(s)).map((r) => `${r.submittal.number} ${r.state} ${r.neededBy ?? '-'} ${r.daysLate}`)
    expect(words(read)).toEqual(words(state))
  })

  it('lays each project its own submittals, and none on a project with no rows', () => {
    const state = initialGcState()
    const register = fairOaks(state).submittals ?? []
    const read = withSubmittals(state, rowsOf('fairoaksd', register))
    expect(read.projects.filter((p) => p.id !== 'fairoaksd').every((p) => (p.submittals ?? []).length === 0)).toBe(true)
    expect(fairOaks(read).submittals).toEqual(register)
  })

  it('orders a submittal’s rounds by their number and its holds by id, whatever the read gave', () => {
    const tables: SubmittalTables = {
      submittals: [{ id: 's1', project_id: 'p', package_id: 'k', number: '003', title: 'Mix design', kind: 'samples', spec_section: null, lead_days: 0, needed_by: '2026-11-02', asked_on: '2026-10-01', created_by: null, created_at: '2026-10-01T00:00:00Z' }],
      holds: [
        { submittal_id: 's1', scope_item_id: 'line-b' },
        { submittal_id: 's1', scope_item_id: 'line-a' },
      ],
      rounds: [],
    }
    expect(submittalFromRows(tables.submittals[0]!, tables.holds, tables.rounds)).toEqual({
      id: 's1',
      number: '003',
      packageId: 'k',
      title: 'Mix design',
      kind: 'samples',
      lineIds: ['line-a', 'line-b'],
      leadDays: 0,
      neededBy: '2026-11-02',
      askedOn: '2026-10-01',
      rounds: [],
    })
  })

  it('says a kind or an answer the app does not know in words', () => {
    const tables = rowsOf('fairoaksd', fairOaks(initialGcState()).submittals ?? [])
    const odd = { ...tables, submittals: tables.submittals.map((s, i) => (i === 0 ? { ...s, kind: 'brochure' } : s)) }
    expect(() => submittalsFromRows('fairoaksd', odd)).toThrow('A submittal\'s kind reads "brochure", which the app does not know.')
    const oddAnswer = { ...tables, rounds: tables.rounds.map((r) => (r.answer === 'approved' ? { ...r, answer: 'fine' } : r)) }
    expect(() => submittalsFromRows('fairoaksd', oddAnswer)).toThrow('A submittal\'s answer reads "fine", which the app does not know.')
  })

  it('keeps a round’s Drive link, sender and email beside the kernel’s shape', () => {
    const tables = rowsOf('fairoaksd', fairOaks(initialGcState()).submittals ?? [])
    const withLink = {
      ...tables,
      rounds: tables.rounds.map((r) =>
        r.submittal_id === 'fairoaksd-sub-1' && r.round === 2 ? { ...r, sent_by: 'office', drive_url: 'https://drive.google.com/file/d/r2', email_send_log_id: 'log-1' } : r,
      ),
    }
    const extras = submittalRoundExtras(withLink)
    expect(extras.get(submittalRoundKey('fairoaksd-sub-1', 2))).toEqual({ driveUrl: 'https://drive.google.com/file/d/r2', sentBy: 'office', emailSendLogId: 'log-1' })
    expect(extras.get(submittalRoundKey('fairoaksd-sub-1', 1))).toEqual({ driveUrl: null, sentBy: 'trade', emailSendLogId: null })
    expect(extras.get(submittalRoundKey('fairoaksd-sub-1', 3))).toBeUndefined()
  })
})

describe('what the presses send', () => {
  it('adds a submittal with its words trimmed, each line once, and whole days never below none', () => {
    expect(
      addSubmittalPayload({ packageId: 'k', title: '  Rebar shop drawings ', kind: 'shop drawings', specSection: ' 03 21 00 ', lineIds: ['a', 'b', 'a'], leadDays: 10.4, neededBy: ' ' }),
    ).toEqual({ packageId: 'k', title: 'Rebar shop drawings', kind: 'shop drawings', specSection: '03 21 00', lineIds: ['a', 'b'], leadDays: 10 })
    expect(addSubmittalPayload({ packageId: 'k', title: 'Mix', kind: 'samples', lineIds: [], leadDays: -4, neededBy: '2026-11-02' })).toEqual({
      packageId: 'k',
      title: 'Mix',
      kind: 'samples',
      lineIds: [],
      leadDays: 0,
      neededBy: '2026-11-02',
    })
    expect(addSubmittalPayload({ packageId: 'k', title: 'Mix', kind: 'samples', lineIds: [], leadDays: Number.NaN })).toMatchObject({ leadDays: 0 })
  })

  it('records a round that came by email with its link only when there is one', () => {
    expect(cameInPayload({ submittalId: 's', file: ' rebar-r1.pdf ', driveUrl: ' https://drive.google.com/file/d/r1 ', note: ' Laps per S-201. ' })).toEqual({
      submittalId: 's',
      file: 'rebar-r1.pdf',
      driveUrl: 'https://drive.google.com/file/d/r1',
      note: 'Laps per S-201.',
    })
    expect(cameInPayload({ submittalId: 's', file: 'rebar-r1.pdf', driveUrl: '  ' })).toEqual({ submittalId: 's', file: 'rebar-r1.pdf', note: '' })
  })

  it('suggests the sections a trade’s own scope lines name, each once', () => {
    expect(tradeSpecSections([{ specs: ['26 24 16', ' 26 05 19 '] }, { specs: null }, {}, { specs: ['26 24 16', ''] }])).toEqual(['26 24 16', '26 05 19'])
  })
})
