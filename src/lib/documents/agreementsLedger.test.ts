import { describe, expect, it } from 'vitest'
import { plainWordsFailures } from '../plainWords'
import { jobContractChips } from '../jobs/jobContractLifecycle'
import { theirPaperFromRow, theirPaperLine } from '../jobs/theirPaper'
import { buildJobWorkOrderCoverage, workOrderChipLabel, type WorkOrderRowLike } from '../subWorkOrders/workOrderCoverage'
import {
  AGREEMENTS_EMPTY_PAGE,
  AGREEMENTS_PAGE,
  AGREEMENTS_SELECT,
  AGREEMENT_GROUP_COLORS,
  AGREEMENT_GROUP_KINDS,
  AGREEMENT_KIND_CHIPS,
  AGREEMENT_STATE_CHIPS,
  AGREEMENT_STATE_COLORS,
  agreementCountWords,
  agreementDayWords,
  agreementDoor,
  agreementFindWords,
  agreementGroup,
  agreementJobTail,
  agreementJobTitle,
  agreementMonthGroups,
  agreementName,
  agreementStateChip,
  agreementTag,
  agreementsEmptyWords,
  agreementsNarrowed,
  canSeeAgreements,
  kindsOfPick,
  statesOfPick,
  waitingChipLabel,
  type AgreementRow,
} from './agreementsLedger'

/** Every name, job and date here is made up. */
const TODAY = '2026-11-17'

function row(over: Partial<AgreementRow>): AgreementRow {
  return {
    id: 'job_contract:c1',
    kind: 'job_contract',
    source_id: 'c1',
    state: 'signed',
    paper_name: 'Residential plumbing contract',
    with_name: 'Harlan Pierce',
    job_id: 'j1',
    job_hcp_number: '2418',
    job_click_number: '',
    job_name: 'Pierce kitchen repipe',
    job_address: '410 Maple St',
    more_jobs: 0,
    person_id: null,
    person_kind: null,
    at: '2026-11-14T18:00:00Z',
    at_day: '2026-11-14',
    facts: { status: 'signed', signer_mode: 'type', send_count: 1, view_count: 2, signed_at: '2026-11-14T18:00:00Z' },
    ...over,
  }
}

describe('who sees the tab', () => {
  it('is the four office roles, the ones the tables let read these papers', () => {
    for (const r of ['dev', 'master_technician', 'assistant', 'controller']) expect(canSeeAgreements(r), r).toBe(true)
    for (const r of ['estimator', 'primary', 'superintendent', 'subcontractor', 'helpers', '', null, undefined]) expect(canSeeAgreements(r), String(r)).toBe(false)
  })
})

describe('the chips', () => {
  it('opens on every kind and on sent and signed', () => {
    expect(AGREEMENT_KIND_CHIPS.map((c) => c.label)).toEqual(['All', 'Job contracts', 'Warranties', 'Staff and subs', 'Partners', 'Work orders'])
    expect(AGREEMENT_STATE_CHIPS.map((c) => c.label)).toEqual(['Sent and signed', 'Waiting on a signature', 'Signed', 'Voided or ended'])
    expect(AGREEMENT_KIND_CHIPS[0]?.key).toBe('all')
    expect(AGREEMENT_STATE_CHIPS[0]?.key).toBe('live')
  })

  it('a kind chip asks for its kinds, and All for every kind', () => {
    expect(kindsOfPick('all')).toBeNull()
    expect(kindsOfPick('jobs')).toEqual(['job_contract', 'their_paper'])
    expect(kindsOfPick('warranty')).toEqual(['job_warranty'])
    expect(kindsOfPick('people')).toEqual(['person_agreement'])
    expect(kindsOfPick('partners')).toEqual(['partner_agreement'])
    expect(kindsOfPick('orders')).toEqual(['work_order'])
  })

  it('no kind sits under two chips', () => {
    const all = Object.values(AGREEMENT_GROUP_KINDS).flat()
    expect(new Set(all).size).toBe(all.length)
  })

  it('a state chip asks for its states, and the default leaves the ended out', () => {
    expect(statesOfPick('live')).toEqual(['waiting', 'signed'])
    expect(statesOfPick('waiting')).toEqual(['waiting'])
    expect(statesOfPick('signed')).toEqual(['signed'])
    expect(statesOfPick('ended')).toEqual(['ended'])
  })

  it('groups a kind for its colours, an unknown kind with the job contracts', () => {
    expect(agreementGroup('job_contract')).toBe('jobs')
    expect(agreementGroup('their_paper')).toBe('jobs')
    expect(agreementGroup('job_warranty')).toBe('warranty')
    expect(agreementGroup('person_agreement')).toBe('people')
    expect(agreementGroup('partner_agreement')).toBe('partners')
    expect(agreementGroup('work_order')).toBe('orders')
    expect(agreementGroup('something_new')).toBe('jobs')
  })

  it('colours with theme tokens only', () => {
    for (const pair of [...Object.values(AGREEMENT_GROUP_COLORS), ...Object.values(AGREEMENT_STATE_COLORS)]) {
      expect(pair.background).toMatch(/^var\(--[a-z0-9-]+\)$/)
      expect(pair.color).toMatch(/^var\(--[a-z0-9-]+\)$/)
    }
  })

  it('the waiting chip carries its count only when something waits', () => {
    expect(waitingChipLabel('Waiting on a signature', 3)).toBe('Waiting on a signature · 3')
    expect(waitingChipLabel('Waiting on a signature', 0)).toBe('Waiting on a signature')
    expect(waitingChipLabel('Waiting on a signature', null)).toBe('Waiting on a signature')
  })
})

describe('the find box', () => {
  it('asks nothing under two characters', () => {
    expect(agreementFindWords('')).toEqual([])
    expect(agreementFindWords(' c ')).toEqual([])
  })

  it('lowers the words, drops marks the database would read as syntax, and keeps five words at most', () => {
    expect(agreementFindWords('Cedar  Bluff')).toEqual(['cedar', 'bluff'])
    expect(agreementFindWords('J2418')).toEqual(['j2418'])
    expect(agreementFindWords('O’Neil, (Ridgeway)*%')).toEqual(['o', 'neil', 'ridgeway'])
    expect(agreementFindWords("o'neil & sons wo-2391-01")).toEqual(["o'neil", '&', 'sons', 'wo-2391-01'])
    expect(agreementFindWords('one two three four five six seven')).toEqual(['one', 'two', 'three', 'four', 'five'])
  })

  it('says whether a chip or the box narrows the list', () => {
    expect(agreementsNarrowed({ kind: 'all', state: 'live', typed: '' })).toBe(false)
    expect(agreementsNarrowed({ kind: 'all', state: 'live', typed: 'c' })).toBe(false)
    expect(agreementsNarrowed({ kind: 'people', state: 'live', typed: '' })).toBe(true)
    expect(agreementsNarrowed({ kind: 'all', state: 'ended', typed: '' })).toBe(true)
    expect(agreementsNarrowed({ kind: 'all', state: 'live', typed: 'cedar' })).toBe(true)
  })
})

describe('the empty list', () => {
  const read = (w: { main: string; next: string; tail: string }) => [w.main, w.next, w.tail].filter(Boolean).join(' ')

  it('with nothing on file names the page that fills it', () => {
    const w = agreementsEmptyWords({ kind: 'all', state: 'live', typed: '' })
    expect(read(w)).toBe('No agreements yet. Pipeline is where a contract is sent to sign.')
    expect(w.next).toBe(AGREEMENTS_EMPTY_PAGE.label)
    expect(AGREEMENTS_EMPTY_PAGE.to).toBe('/jobs?tab=stages')
  })

  it('with a search that finds nothing quotes it and offers to clear it', () => {
    expect(read(agreementsEmptyWords({ kind: 'all', state: 'live', typed: ' harbor ' }))).toBe('No agreements match ‘harbor’. Clear the search')
  })

  it('with only chips pressed offers to clear the filters', () => {
    expect(read(agreementsEmptyWords({ kind: 'partners', state: 'live', typed: '' }))).toBe('No agreements match the filters. Clear the filters')
    expect(read(agreementsEmptyWords({ kind: 'all', state: 'ended', typed: 'c' }))).toBe('No agreements match the filters. Clear the filters')
  })

  it('reads in plain words', () => {
    for (const q of [
      { kind: 'all', state: 'live', typed: '' },
      { kind: 'all', state: 'live', typed: 'Ridgeway' },
      { kind: 'orders', state: 'waiting', typed: '' },
    ] as const) {
      expect(plainWordsFailures(read(agreementsEmptyWords(q))), read(agreementsEmptyWords(q))).toEqual([])
    }
  })

  it('counts in words', () => {
    expect(agreementCountWords(1)).toBe('1 agreement')
    expect(agreementCountWords(13)).toBe('13 agreements')
    expect(agreementCountWords(0)).toBe('0 agreements')
  })
})

describe('a line', () => {
  it('tags each kind in a word or two', () => {
    expect(agreementTag(row({ kind: 'job_contract' }))).toEqual({ words: 'Contract', group: 'jobs' })
    expect(agreementTag(row({ kind: 'job_warranty' }))).toEqual({ words: 'Warranty', group: 'warranty' })
    expect(agreementTag(row({ kind: 'their_paper' }))).toEqual({ words: 'Their paper', group: 'jobs' })
    expect(agreementTag(row({ kind: 'person_agreement', person_kind: 'sub' }))).toEqual({ words: 'Sub', group: 'people' })
    expect(agreementTag(row({ kind: 'person_agreement', person_kind: 'helper' }))).toEqual({ words: 'Staff', group: 'people' })
    expect(agreementTag(row({ kind: 'person_agreement', person_kind: null }))).toEqual({ words: 'Staff', group: 'people' })
    expect(agreementTag(row({ kind: 'partner_agreement' }))).toEqual({ words: 'Partner', group: 'partners' })
    expect(agreementTag(row({ kind: 'work_order' }))).toEqual({ words: 'Work order', group: 'orders' })
    expect(agreementTag(row({ kind: 'something_new' }))).toEqual({ words: 'Agreement', group: 'jobs' })
  })

  it('is named by the paper, and a filed paper with no name says how it is kept', () => {
    expect(agreementName(row({}))).toBe('Residential plumbing contract')
    expect(agreementName(row({ paper_name: '  ', facts: { signer_mode: 'paper', signed_document_url: 'https://docs.google.com/document/d/abc' } }))).toBe('Signed paper · Google Doc')
    expect(agreementName(row({ paper_name: '', facts: { signer_mode: 'paper', signed_document_url: 'https://files.example.com/paper.pdf' } }))).toBe('Signed paper · link')
    expect(agreementName(row({ paper_name: '', facts: { signer_mode: 'paper', has_upload: true } }))).toBe('Signed paper · scan')
    expect(agreementName(row({ paper_name: '', facts: { co_signer_mode: 'paper' } }))).toBe('Signed paper')
  })

  it('with no name and no filed paper falls back to its kind', () => {
    expect(agreementName(row({ paper_name: '', facts: { signer_mode: 'type' } }))).toBe('Contract')
    expect(agreementName(row({ kind: 'job_warranty', paper_name: '', facts: null }))).toBe('Warranty')
    expect(agreementName(row({ kind: 'their_paper', paper_name: '', facts: { signer_mode: 'paper' } }))).toBe('Their paper')
    expect(agreementName(row({ kind: 'work_order', paper_name: '', facts: null }))).toBe('Work order')
    expect(agreementName(row({ kind: 'person_agreement', paper_name: '', facts: null }))).toBe('Agreement')
  })

  it('names the job by its number and name', () => {
    expect(agreementJobTitle(row({}))).toBe('J2418 · Pierce kitchen repipe')
    expect(agreementJobTitle(row({ job_hcp_number: ' ', job_click_number: '77' }))).toBe('J77 · Pierce kitchen repipe')
    expect(agreementJobTitle(row({ job_name: '' }))).toBe('J2418')
    expect(agreementJobTitle(row({ job_hcp_number: null, job_click_number: null }))).toBe('Pierce kitchen repipe')
    expect(agreementJobTitle(row({ job_id: null, job_hcp_number: null, job_click_number: null, job_name: null }))).toBeNull()
  })

  it('follows the job with its address, or with how many more jobs the paper covers', () => {
    expect(agreementJobTail(row({}))).toBe('410 Maple St')
    expect(agreementJobTail(row({ more_jobs: 1 }))).toBe('and 1 more job')
    expect(agreementJobTail(row({ more_jobs: 2 }))).toBe('and 2 more jobs')
    expect(agreementJobTail(row({ job_address: null }))).toBe('')
  })
})

describe('the state chip says what the kind’s own window says', () => {
  it('a job contract out to be signed', () => {
    const facts = { status: 'sent', voided_at: null, signer_mode: null, send_count: 2, view_count: 3, sent_channel: 'link' }
    const chip = agreementStateChip(row({ state: 'waiting', facts }), TODAY)
    expect(chip).toEqual({ words: jobContractChips(facts)[0]?.label, tone: 'waiting' })
    expect(chip.words).toBe('sent ×2 · opened 3×')
  })

  it('a job contract handed over, and one emailed as a PDF', () => {
    const handed = { status: 'sent', voided_at: null, signer_mode: null, send_count: 1, view_count: 0, sent_channel: 'handed' }
    expect(agreementStateChip(row({ state: 'waiting', facts: handed }), TODAY).words).toBe('handed over · awaiting signature')
    const pdf = { ...handed, sent_channel: 'pdf_email', send_count: 2 }
    expect(agreementStateChip(row({ state: 'waiting', facts: pdf }), TODAY).words).toBe(jobContractChips(pdf)[0]?.label)
  })

  it('a two-signer contract with one frame filled says so', () => {
    const facts = {
      status: 'sent',
      voided_at: null,
      signer_mode: 'type',
      send_count: 1,
      view_count: 1,
      sent_channel: 'link',
      recipient_name: 'Harlan Pierce',
      signer_printed_name: 'Harlan Pierce',
      signer_consented_at: '2026-11-15T15:00:00Z',
      signed_at: null,
      co_signer_name: 'Mara Pierce',
      co_signer_email: 'mara@example.com',
      co_signed_at: null,
    }
    expect(agreementStateChip(row({ state: 'waiting', facts }), TODAY).words).toBe(jobContractChips(facts)[0]?.label)
  })

  it('a signed contract, a warranty and a filed paper', () => {
    expect(agreementStateChip(row({ facts: { status: 'signed', signer_mode: 'type' } }), TODAY)).toEqual({ words: 'signed ✓', tone: 'signed' })
    expect(agreementStateChip(row({ kind: 'job_warranty', facts: { status: 'signed', signer_mode: 'draw' } }), TODAY)).toEqual({ words: 'signed ✓', tone: 'signed' })
    expect(agreementStateChip(row({ facts: { status: 'signed', signer_mode: 'paper' } }), TODAY)).toEqual({ words: 'on file · paper', tone: 'signed' })
  })

  it('a voided contract, by its stamp or by its status', () => {
    expect(agreementStateChip(row({ state: 'ended', facts: { status: 'signed', voided_at: '2026-10-15T12:00:00Z' } }), TODAY)).toEqual({ words: 'voided', tone: 'ended' })
    expect(agreementStateChip(row({ state: 'ended', facts: { status: 'voided' } }), TODAY)).toEqual({ words: 'voided', tone: 'ended' })
  })

  it('their paper, without repeating the tag', () => {
    const usOnly = { status: 'signed', our_signer_name: 'Dana Whitlock', our_signed_on: '2026-11-10', relied_on_on: '2026-11-12', relied_on_what: 'their notice to proceed' }
    const line = theirPaperLine(theirPaperFromRow({ ...usOnly, id: 'c1', job_id: 'j1' }))
    expect(line).toBe('Their paper · signed by us only · they rely on it')
    expect(agreementStateChip(row({ kind: 'their_paper', facts: usOnly }), TODAY)).toEqual({ words: 'signed by us only · they rely on it', tone: 'signed' })
    expect(agreementStateChip(row({ kind: 'their_paper', facts: { status: 'signed', our_signed_on: '2026-11-10' } }), TODAY).words).toBe('signed by us only · not relied on yet')
    expect(agreementStateChip(row({ kind: 'their_paper', facts: { status: 'signed', their_signed_on: '2026-11-11' } }), TODAY).words).toBe('signed by both')
    expect(agreementStateChip(row({ kind: 'their_paper', state: 'ended', facts: { status: 'signed', voided_at: '2026-11-13T12:00:00Z' } }), TODAY)).toEqual({ words: 'voided', tone: 'ended' })
  })

  it('a person’s agreement: signed, opened, never opened, replaced', () => {
    const person = (over: Partial<AgreementRow>) => row({ kind: 'person_agreement', paper_name: 'Employee handbook', job_id: null, ...over })
    expect(agreementStateChip(person({ state: 'signed', facts: { status: 'signed' } }), TODAY)).toEqual({ words: 'signed ✓', tone: 'signed' })
    expect(agreementStateChip(person({ state: 'waiting', facts: { status: 'sent', signer_last_viewed_at: '2026-11-13T15:00:00Z' } }), TODAY)).toEqual({ words: 'viewed, not signed', tone: 'waiting' })
    expect(agreementStateChip(person({ state: 'waiting', facts: { status: 'sent', signer_last_viewed_at: null } }), TODAY)).toEqual({ words: 'never opened', tone: 'waiting' })
    expect(agreementStateChip(person({ state: 'ended', facts: { status: 'signed', replaced: true } }), TODAY)).toEqual({ words: 'replaced by a newer one', tone: 'ended' })
    expect(agreementStateChip(person({ kind: 'partner_agreement', state: 'signed', facts: { status: 'signed' } }), TODAY).words).toBe('signed ✓')
  })

  it('a work order, in the board’s words', () => {
    const base: WorkOrderRowLike = {
      id: '',
      status: 'offered',
      amount: null,
      display_name: '',
      job_id: null,
      labor_job_id: null,
      step_id: null,
      record_id: null,
      offered_at: '2026-11-05T15:00:00Z',
      offer_expires_at: '2026-11-30',
      signed_at: null,
      accepted_at: null,
      declined_at: null,
      decline_reason: null,
      created_at: '',
    }
    const order = (state: string, facts: Record<string, unknown>) => agreementStateChip(row({ kind: 'work_order', state, facts }), TODAY)
    const says = (r: WorkOrderRowLike) => workOrderChipLabel(buildJobWorkOrderCoverage([r], TODAY))

    expect(order('waiting', { status: 'offered', offered_at: base.offered_at, offer_expires_at: '2026-11-30' })).toEqual({ words: says(base), tone: 'waiting' })
    expect(says(base)).toBe('Sent · awaiting signature')
    expect(order('ended', { status: 'offered', offered_at: base.offered_at, offer_expires_at: '2026-11-10' })).toEqual({ words: 'Offer expired', tone: 'ended' })
    for (const status of ['accepted', 'approved', 'settled']) {
      expect(order('signed', { status, signed_at: '2026-11-14T15:00:00Z' }), status).toEqual({ words: says({ ...base, status }), tone: 'signed' })
    }
    expect(order('signed', { status: 'accepted' }).words).toBe('✍ Signed')
    expect(order('ended', { status: 'declined', declined_at: '2026-10-09T15:00:00Z' })).toEqual({ words: 'Declined', tone: 'ended' })
    expect(order('ended', { status: 'cancelled' })).toEqual({ words: 'Cancelled', tone: 'ended' })
  })

  it('a kind it does not know still reads, and a state it does not know reads as ended', () => {
    expect(agreementStateChip(row({ kind: 'something_new', state: 'waiting', facts: null }), TODAY)).toEqual({ words: 'waiting on a signature', tone: 'waiting' })
    expect(agreementStateChip(row({ kind: 'something_new', state: 'signed', facts: null }), TODAY)).toEqual({ words: 'signed ✓', tone: 'signed' })
    expect(agreementStateChip(row({ kind: 'something_new', state: 'odd', facts: null }), TODAY)).toEqual({ words: 'ended', tone: 'ended' })
  })
})

describe('the day', () => {
  it('says what happened on it', () => {
    expect(agreementDayWords(row({ state: 'signed', at_day: '2026-11-14' }), TODAY)).toBe('Signed Nov 14')
    expect(agreementDayWords(row({ state: 'waiting', at_day: '2026-11-16', facts: { status: 'sent' } }), TODAY)).toBe('Sent Nov 16')
    expect(agreementDayWords(row({ state: 'ended', at_day: '2026-10-15', facts: { status: 'signed', voided_at: '2026-10-15T12:00:00Z' } }), TODAY)).toBe('Voided Oct 15')
    expect(agreementDayWords(row({ kind: 'work_order', state: 'ended', at_day: '2026-10-09', facts: { status: 'declined' } }), TODAY)).toBe('Declined Oct 9')
    expect(agreementDayWords(row({ kind: 'work_order', state: 'ended', at_day: '2026-10-09', facts: { status: 'cancelled' } }), TODAY)).toBe('Cancelled Oct 9')
    expect(agreementDayWords(row({ kind: 'work_order', state: 'ended', at_day: '2026-11-10', facts: { status: 'offered' } }), TODAY)).toBe('Expired Nov 10')
    expect(agreementDayWords(row({ kind: 'person_agreement', state: 'ended', at_day: '2026-03-02', facts: { status: 'signed', replaced: true } }), TODAY)).toBe('Signed Mar 2')
  })

  it('carries the year once it is not this one, and says nothing with no day', () => {
    expect(agreementDayWords(row({ at_day: '2025-12-30' }), TODAY)).toBe('Signed Dec 30, 2025')
    expect(agreementDayWords(row({ at_day: null }), TODAY)).toBe('')
    expect(agreementDayWords(row({ at_day: 'soon' }), TODAY)).toBe('')
  })
})

describe('the list', () => {
  it('bands the rows by month in the order given', () => {
    const groups = agreementMonthGroups([{ at_day: '2026-11-16' }, { at_day: '2026-11-05' }, { at_day: '2026-10-30' }, { at_day: '2025-12-02' }, { at_day: null }])
    expect(groups.map((g) => [g.ym, g.label, g.rows.length])).toEqual([
      ['2026-11', 'November 2026', 2],
      ['2026-10', 'October 2026', 1],
      ['2025-12', 'December 2025', 1],
      ['', 'No date', 1],
    ])
  })

  it('reads a day that is not a day as no date', () => {
    expect(agreementMonthGroups([{ at_day: '2026-13-01' }, { at_day: 'x' }]).map((g) => g.label)).toEqual(['No date'])
    expect(agreementMonthGroups([])).toEqual([])
  })

  it('asks for the columns a line reads, a hundred at a time', () => {
    expect(AGREEMENTS_PAGE).toBe(100)
    for (const col of ['id', 'kind', 'source_id', 'state', 'paper_name', 'with_name', 'job_id', 'more_jobs', 'person_kind', 'at', 'at_day', 'facts']) {
      expect(AGREEMENTS_SELECT.split(', ')).toContain(col)
    }
    expect(AGREEMENTS_SELECT).not.toContain('find_text')
  })
})

describe('what a press opens', () => {
  it('a job’s paper opens the Contract window on its record, signed or not', () => {
    expect(agreementDoor(row({}))).toEqual({ kind: 'contract', jobId: 'j1', recordId: 'c1', signed: true })
    expect(agreementDoor(row({ state: 'waiting', facts: { status: 'sent', signed_at: null } }))).toEqual({ kind: 'contract', jobId: 'j1', recordId: 'c1', signed: false })
    expect(agreementDoor(row({ kind: 'their_paper', source_id: 'c9' })).kind).toBe('contract')
    expect(agreementDoor(row({ kind: 'job_warranty', job_id: null }))).toEqual({ kind: 'none' })
  })

  it('a person’s signed agreement opens its record, and one still waiting opens People → Contracts on it', () => {
    expect(agreementDoor(row({ kind: 'person_agreement', source_id: 'd1', job_id: null, facts: { status: 'signed' } }))).toEqual({ kind: 'person-signed', documentId: 'd1' })
    expect(agreementDoor(row({ kind: 'partner_agreement', source_id: 'd 2', state: 'waiting', job_id: null, facts: { status: 'sent' } }))).toEqual({ kind: 'people-contracts', to: '/people?tab=contracts&doc=d%202' })
  })

  it('a work order opens its window on the job, and has no door without one', () => {
    expect(agreementDoor(row({ kind: 'work_order', source_id: 'w1', facts: { status: 'offered' } }))).toEqual({ kind: 'work-order', jobId: 'j1', commitmentId: 'w1' })
    expect(agreementDoor(row({ kind: 'work_order', source_id: 'w1', job_id: null }))).toEqual({ kind: 'none' })
    expect(agreementDoor(row({ kind: 'something_new' }))).toEqual({ kind: 'none' })
  })
})
