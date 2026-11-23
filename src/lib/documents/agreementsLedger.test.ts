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
  AGREEMENTS_READER_DOORS,
  AGREEMENT_KIND_CHIPS,
  ESTIMATOR_GROUP_KINDS,
  AGREEMENT_STATE_CHIPS,
  AGREEMENT_STATE_COLORS,
  agreementCountWords,
  agreementDayWords,
  agreementDoor,
  agreementNeedsAList,
  agreementPaperKindWords,
  agreementStateChips,
  agreementSignerWords,
  agreementSigningForWords,
  agreementFindWords,
  agreementGroup,
  agreementJobTail,
  agreementJobTitle,
  agreementMonthGroups,
  agreementName,
  agreementStateChip,
  agreementTag,
  agreementKindChips,
  agreementsEmptyWords,
  agreementsReader,
  canActOnAgreements,
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
  it('is the four office roles and the estimator (punch list #403, call 8)', () => {
    for (const r of ['dev', 'master_technician', 'assistant', 'controller', 'estimator']) expect(canSeeAgreements(r), r).toBe(true)
    for (const r of ['primary', 'superintendent', 'subcontractor', 'helpers', '', null, undefined]) expect(canSeeAgreements(r), String(r)).toBe(false)
  })

  it('keeps every act with the four roles: an estimator reads and acts on nothing', () => {
    for (const r of ['dev', 'master_technician', 'assistant', 'controller']) expect(canActOnAgreements(r), r).toBe(true)
    for (const r of ['estimator', 'primary', 'superintendent', 'subcontractor', 'helpers', '', null, undefined]) expect(canActOnAgreements(r), String(r)).toBe(false)
  })

  it('reads an estimator as a reader, and everyone else with the tab as the office', () => {
    expect(agreementsReader('estimator')).toBe('estimator')
    for (const r of ['dev', 'master_technician', 'assistant', 'controller']) expect(agreementsReader(r), r).toBe('office')
  })
})

describe('an estimator’s chips', () => {
  it('leaves out the chips for kinds they cannot read', () => {
    expect(agreementKindChips('estimator').map((c) => c.label)).toEqual(['All', 'Outside companies', 'Work orders'])
    expect(agreementKindChips('office')).toBe(AGREEMENT_KIND_CHIPS)
    expect(agreementKindChips()).toBe(AGREEMENT_KIND_CHIPS)
  })

  it('asks Outside companies for every outside company’s agreement, a trade company’s among them', () => {
    expect(kindsOfPick('outside', 'estimator')).toEqual(['customer_agreement', 'supply_house_agreement', 'trade_agreement', 'company_agreement'])
    expect(kindsOfPick('orders', 'estimator')).toEqual(['work_order'])
    expect(kindsOfPick('all', 'estimator')).toBeNull()
  })

  it('asks for no kind at all under a chip an estimator does not have', () => {
    for (const pick of ['jobs', 'warranty', 'people', 'partners', 'gc'] as const) expect(kindsOfPick(pick, 'estimator'), pick).toEqual([])
  })

  it('never asks for a person’s paper, a job contract or a party on no list', () => {
    const asked = Object.values(ESTIMATOR_GROUP_KINDS).flat()
    for (const kind of ['person_agreement', 'partner_agreement', 'job_contract', 'job_warranty', 'their_paper', 'owner_contract', 'sow', 'outside_agreement']) expect(asked, kind).not.toContain(kind)
  })

  it('tells an estimator with nothing on file that the office sends, with no press', () => {
    const w = agreementsEmptyWords({ kind: 'all', state: 'live', typed: '' }, 'estimator')
    expect(w).toEqual({ main: 'No agreements yet.', next: '', tail: 'The office sends a paper to an outside company from this tab.' })
    expect(plainWordsFailures(`${w.main} ${w.tail}`)).toEqual([])
    expect(plainWordsFailures(AGREEMENTS_READER_DOORS)).toEqual([])
  })

  it('offers an estimator the same way out of a search or a chip as the office', () => {
    expect(agreementsEmptyWords({ kind: 'outside', state: 'live', typed: '' }, 'estimator')).toEqual(agreementsEmptyWords({ kind: 'outside', state: 'live', typed: '' }))
    expect(agreementsEmptyWords({ kind: 'all', state: 'live', typed: 'tallgrass' }, 'estimator').next).toBe('Clear the search')
  })
})

describe('the chips', () => {
  it('opens on every kind and on sent and signed', () => {
    expect(AGREEMENT_KIND_CHIPS.map((c) => c.label)).toEqual(['All', 'Job contracts', 'Warranties', 'Staff and subs', 'Outside companies', 'Partners', 'Work orders', 'GC projects'])
    expect(AGREEMENT_STATE_CHIPS.map((c) => c.label)).toEqual(['Sent and signed', 'Waiting on a signature', 'Signed', 'Not sent', 'Voided or ended'])
    expect(AGREEMENT_KIND_CHIPS[0]?.key).toBe('all')
    expect(AGREEMENT_STATE_CHIPS[0]?.key).toBe('live')
  })

  it('a kind chip asks for its kinds, and All for every kind', () => {
    expect(kindsOfPick('all')).toBeNull()
    expect(kindsOfPick('jobs')).toEqual(['job_contract', 'their_paper'])
    expect(kindsOfPick('warranty')).toEqual(['job_warranty'])
    // A trade company that is a party sits with the subs; a customer, a supply house and a party on no list are outside.
    expect(kindsOfPick('people')).toEqual(['person_agreement', 'trade_agreement'])
    expect(kindsOfPick('outside')).toEqual(['customer_agreement', 'supply_house_agreement', 'outside_agreement'])
    expect(kindsOfPick('partners')).toEqual(['partner_agreement'])
    expect(kindsOfPick('orders')).toEqual(['work_order'])
    expect(kindsOfPick('gc')).toEqual(['owner_contract', 'sow', 'company_agreement'])
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
    // A paper that was made and never sent is asked for by its own chip, and is not in the default.
    expect(statesOfPick('not_sent')).toEqual(['not_sent'])
    expect(statesOfPick('live')).not.toContain('not_sent')
    // Under the Search tab every state is asked for, so a voided paper is found too.
    expect(statesOfPick('any')).toBeNull()
  })

  it('groups a kind for its colours, an unknown kind with the job contracts', () => {
    expect(agreementGroup('job_contract')).toBe('jobs')
    expect(agreementGroup('their_paper')).toBe('jobs')
    expect(agreementGroup('job_warranty')).toBe('warranty')
    expect(agreementGroup('person_agreement')).toBe('people')
    expect(agreementGroup('partner_agreement')).toBe('partners')
    expect(agreementGroup('work_order')).toBe('orders')
    for (const kind of ['owner_contract', 'sow', 'company_agreement']) expect(agreementGroup(kind), kind).toBe('gc')
    expect(agreementGroup('something_new')).toBe('jobs')
  })

  it('colours with theme tokens only', () => {
    for (const pair of [...Object.values(AGREEMENT_GROUP_COLORS), ...Object.values(AGREEMENT_STATE_COLORS)]) {
      expect(pair.background).toMatch(/^var\(--[a-z0-9-]+\)$/)
      expect(pair.color).toMatch(/^var\(--[a-z0-9-]+\)$/)
    }
  })

  it('the Not sent chip is drawn only while a paper is not sent, or while it is the chip picked', () => {
    const labels = (notSent: number | null, picked: Parameters<typeof agreementStateChips>[1]) => agreementStateChips(notSent, picked).map((c) => c.label)
    expect(labels(0, 'live')).toEqual(['Sent and signed', 'Waiting on a signature', 'Signed', 'Voided or ended'])
    expect(labels(2, 'live')).toEqual(['Sent and signed', 'Waiting on a signature', 'Signed', 'Not sent', 'Voided or ended'])
    // The last unsent paper was sent while its chip is pressed: the chip stays, so the list is not left on a chip that is gone.
    expect(labels(0, 'not_sent')).toContain('Not sent')
    // A count that could not be read hides it, as none does.
    expect(labels(null, 'waiting')).not.toContain('Not sent')
    expect(labels(null, 'not_sent')).toContain('Not sent')
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
    expect(agreementsNarrowed({ kind: 'all', state: 'any', typed: 'cedar' })).toBe(true)
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
    expect(agreementTag(row({ kind: 'owner_contract' }))).toEqual({ words: 'Owner contract', group: 'gc' })
    expect(agreementTag(row({ kind: 'sow' }))).toEqual({ words: 'Statement of work', group: 'gc' })
    expect(agreementTag(row({ kind: 'company_agreement' }))).toEqual({ words: 'Trade company', group: 'gc' })
    expect(agreementTag(row({ kind: 'something_new' }))).toEqual({ words: 'Agreement', group: 'jobs' })
  })

  it('tags an outside party’s paper by what the party is, and a party on no list with an outline', () => {
    expect(agreementTag(row({ kind: 'customer_agreement', facts: { party_kind: 'customer' } }))).toEqual({ words: 'Customer', group: 'outside' })
    expect(agreementTag(row({ kind: 'supply_house_agreement', facts: { party_kind: 'supply_house' } }))).toEqual({ words: 'Supply house', group: 'outside' })
    expect(agreementTag(row({ kind: 'trade_agreement', facts: { party_kind: 'trade' } }))).toEqual({ words: 'Trade company', group: 'people' })
    expect(agreementTag(row({ kind: 'outside_agreement', facts: { party_kind: 'none' } }))).toEqual({ words: 'Not on a list', group: 'outside', plain: true })
    expect(agreementTag(row({ kind: 'outside_agreement', facts: { party_kind: 'person' } }))).toEqual({ words: 'On the roster', group: 'outside', plain: true })
    // A row whose facts carry no party still tags by its kind.
    expect(agreementTag(row({ kind: 'supply_house_agreement', facts: null }))).toEqual({ words: 'Supply house', group: 'outside' })
  })

  it('says who signs after the party, and never the same name twice', () => {
    const waiting = { state: 'waiting', with_name: 'Tallgrass Supply Co.', facts: { status: 'sent', signer_name: 'Lena Park', signer_title: 'Branch manager' } }
    expect(agreementSignerWords(row({ kind: 'supply_house_agreement', ...waiting }))).toBe('Lena Park signs, Branch manager')
    const signed = { state: 'signed', with_name: 'Ridgeway Builders', facts: { status: 'signed', signer_name: 'Dana Ruiz', signer_title: 'Project manager', signer_printed_name: 'Dana M. Ruiz' } }
    expect(agreementSignerWords(row({ kind: 'customer_agreement', ...signed }))).toBe('signed by Dana M. Ruiz, Project manager')
    // A person's own paper: the signer is the person named beside it.
    expect(agreementSignerWords(row({ kind: 'person_agreement', state: 'waiting', with_name: 'Priya Nair', facts: { status: 'sent', signer_name: 'priya nair' } }))).toBe('')
    // The owner of a sub that is on the roster by its business name.
    expect(agreementSignerWords(row({ kind: 'person_agreement', state: 'waiting', with_name: 'Ortega Mechanical', facts: { status: 'sent', signer_name: 'Luis Ortega' } }))).toBe('Luis Ortega signs')
    // A job's contract keeps who signed in its own facts and says so in its own window: its line is left as it was.
    expect(agreementSignerWords(row({ kind: 'job_contract', state: 'signed', with_name: 'Harlan Pierce', facts: { status: 'signed', signer_printed_name: 'H. Pierce, by phone' } }))).toBe('')
    expect(agreementSignerWords(row({ kind: 'work_order', state: 'signed', with_name: 'Ortega Mechanical', facts: { status: 'accepted', signer_printed_name: 'Luis Ortega' } }))).toBe('')
    // A trade company's own paper says who signed for it.
    expect(agreementSignerWords(row({ kind: 'company_agreement', state: 'signed', with_name: 'Juniper Mechanical LLC', facts: { status: 'signed', signer_printed_name: 'Marco Ibarra' } }))).toBe('signed by Marco Ibarra')
    // A paper that kept no signer says nothing, and one that only has what was typed at signing says so once signed.
    expect(agreementSignerWords(row({ kind: 'person_agreement', state: 'waiting', with_name: 'Priya Nair', facts: { status: 'sent' } }))).toBe('')
    expect(agreementSignerWords(row({ kind: 'customer_agreement', state: 'signed', with_name: 'Ridgeway Builders', facts: { status: 'signed', signer_printed_name: 'Dana Ruiz' } }))).toBe('signed by Dana Ruiz')
  })

  it('says what kind of paper a party’s line is when it is not an agreement', () => {
    const party = (doc_type: unknown) => row({ kind: 'supply_house_agreement', facts: { status: 'unsent', doc_type } })
    expect(agreementPaperKindWords(party('w9'))).toBe('W-9')
    expect(agreementPaperKindWords(party('coi'))).toBe('Insurance certificate')
    expect(agreementPaperKindWords(party('license'))).toBe('License')
    expect(agreementPaperKindWords(party('other'))).toBe('Paper')
    // An agreement needs no second tag, and neither does a row that says no kind: the view before its restatement.
    expect(agreementPaperKindWords(party('agreement'))).toBe('')
    expect(agreementPaperKindWords(party(undefined))).toBe('')
    expect(agreementPaperKindWords(row({ kind: 'supply_house_agreement', facts: null }))).toBe('')
    // Only a party's line: every other kind on the tab is an agreement.
    expect(agreementPaperKindWords(row({ kind: 'person_agreement', facts: { doc_type: 'w9' } }))).toBe('')
    expect(agreementPaperKindWords(row({ kind: 'company_agreement', facts: { doc_type: 'coi' } }))).toBe('')
  })

  it('offers Add to a list only on a party with no record, signed or not', () => {
    expect(agreementNeedsAList(row({ kind: 'outside_agreement', state: 'waiting', facts: { status: 'sent', party_kind: 'none' } }))).toBe(true)
    expect(agreementNeedsAList(row({ kind: 'outside_agreement', state: 'signed', facts: { status: 'signed', party_kind: 'none' } }))).toBe(true)
    expect(agreementNeedsAList(row({ kind: 'outside_agreement', facts: { party_kind: 'person' } }))).toBe(false)
    expect(agreementNeedsAList(row({ kind: 'customer_agreement', facts: { party_kind: 'customer' } }))).toBe(false)
    expect(agreementNeedsAList(row({ kind: 'person_agreement', facts: { status: 'sent' } }))).toBe(false)
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
    expect(agreementName(row({ kind: 'owner_contract', paper_name: '', facts: null }))).toBe('Our contract with the owner')
    expect(agreementName(row({ kind: 'sow', paper_name: '', facts: null }))).toBe('Statement of work')
    expect(agreementName(row({ kind: 'sow', paper_name: 'Statement of work · Electrical', facts: null }))).toBe('Statement of work · Electrical')
    expect(agreementName(row({ kind: 'person_agreement', paper_name: '', facts: null }))).toBe('Agreement')
  })

  it('names the job by its number and name', () => {
    expect(agreementJobTitle(row({}))).toBe('J2418 · Pierce kitchen repipe')
    expect(agreementJobTitle(row({ job_hcp_number: ' ', job_click_number: '77' }))).toBe('J77 · Pierce kitchen repipe')
    expect(agreementJobTitle(row({ job_name: '' }))).toBe('J2418')
    expect(agreementJobTitle(row({ job_hcp_number: null, job_click_number: null }))).toBe('Pierce kitchen repipe')
    // A GC project's paper has no job: its project's name rides where the job's would.
    expect(agreementJobTitle(row({ kind: 'sow', job_id: null, job_hcp_number: null, job_click_number: null, job_name: 'Westfield Clinic' }))).toBe('Westfield Clinic')
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

  it('GC mode’s papers, in GC mode’s words', () => {
    const owner = (state: string, facts: Record<string, unknown>) => agreementStateChip(row({ kind: 'owner_contract', state, facts }), TODAY)
    expect(owner('signed', { sent_on: '2026-09-25', sign_by: '2026-10-02', signed_on: '2026-09-30' })).toEqual({ words: 'signed ✓', tone: 'signed' })
    expect(owner('waiting', { sent_on: '2026-11-14', sign_by: '2026-11-21' })).toEqual({ words: 'waiting on their signature', tone: 'waiting' })
    // Asked to sign by today is not late yet; the day after, it is.
    expect(owner('waiting', { sent_on: '2026-11-10', sign_by: TODAY }).words).toBe('waiting on their signature')
    expect(owner('waiting', { sent_on: '2026-10-30', sign_by: '2026-11-06' })).toEqual({ words: 'late, asked to sign by Fri Nov 6', tone: 'waiting' })
    const sow = (state: string, status: string) => agreementStateChip(row({ kind: 'sow', state, facts: { status } }), TODAY)
    expect(sow('waiting', 'sent')).toEqual({ words: 'waiting on their signature', tone: 'waiting' })
    expect(sow('signed', 'signed')).toEqual({ words: 'signed ✓', tone: 'signed' })
    expect(sow('ended', 'cancelled')).toEqual({ words: 'cancelled', tone: 'ended' })
    // A trade company's agreement is a person's paper filed for a company: the same words.
    const company = (state: string, facts: Record<string, unknown>) => agreementStateChip(row({ kind: 'company_agreement', state, facts }), TODAY)
    expect(company('signed', { status: 'signed' }).words).toBe('signed ✓')
    expect(company('waiting', { status: 'sent' }).words).toBe('never opened')
    expect(company('ended', { status: 'signed', replaced: true }).words).toBe('replaced by a newer one')
  })

  it('an outside party’s paper that was made and never sent reads not sent, in the quiet pair', () => {
    for (const kind of ['customer_agreement', 'supply_house_agreement', 'trade_agreement', 'outside_agreement']) {
      expect(agreementStateChip(row({ kind, state: 'not_sent', facts: { status: 'unsent' } }), TODAY), kind).toEqual({ words: 'not sent', tone: 'not_sent' })
    }
    expect(AGREEMENT_STATE_COLORS.not_sent).toEqual({ background: 'var(--bg-muted)', color: 'var(--text-muted)' })
    // A kind the kernel does not know reads the state too, and never as ended.
    expect(agreementStateChip(row({ kind: 'something_new', state: 'not_sent', facts: null }), TODAY)).toEqual({ words: 'not sent', tone: 'not_sent' })
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
    // A cancelled statement of work keeps no cancel day, so its line shows the day it was sent.
    expect(agreementDayWords(row({ kind: 'sow', state: 'ended', at_day: '2026-09-24', facts: { status: 'cancelled' } }), TODAY)).toBe('Sent Sep 24')
    expect(agreementDayWords(row({ kind: 'owner_contract', state: 'waiting', at_day: '2026-09-25', facts: { sign_by: '2026-10-02' } }), TODAY)).toBe('Sent Sep 25')
  })

  it('a paper that was never sent shows the day it was made', () => {
    expect(agreementDayWords(row({ kind: 'supply_house_agreement', state: 'not_sent', at_day: '2026-11-12', facts: { status: 'unsent' } }), TODAY)).toBe('Made Nov 12')
    expect(agreementDayWords(row({ kind: 'supply_house_agreement', state: 'not_sent', at_day: '2025-12-30', facts: { status: 'unsent' } }), TODAY)).toBe('Made Dec 30, 2025')
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

  it('a GC project’s paper opens GC mode, and a trade company’s signed agreement opens its record', () => {
    expect(agreementDoor(row({ kind: 'owner_contract', source_id: 'o1', job_id: null, facts: {} }))).toEqual({ kind: 'gc', to: '/gc' })
    expect(agreementDoor(row({ kind: 'sow', source_id: 's1', job_id: null, facts: { status: 'sent' } }))).toEqual({ kind: 'gc', to: '/gc' })
    expect(agreementDoor(row({ kind: 'company_agreement', source_id: 'm1', job_id: null, facts: { status: 'signed' } }))).toEqual({ kind: 'person-signed', documentId: 'm1' })
    expect(agreementDoor(row({ kind: 'company_agreement', source_id: 'm2', state: 'waiting', job_id: null, facts: { status: 'sent' } }))).toEqual({ kind: 'gc', to: '/gc' })
  })

  it('a paper that was never sent opens nothing: its acts are on its line', () => {
    expect(agreementDoor(row({ kind: 'supply_house_agreement', source_id: 'p7', state: 'not_sent', job_id: null, facts: { status: 'unsent' } }))).toEqual({ kind: 'none' })
  })

  it('an outside party’s paper opens its signed record, and waits with its acts on the line', () => {
    for (const kind of ['customer_agreement', 'supply_house_agreement', 'trade_agreement', 'outside_agreement']) {
      expect(agreementDoor(row({ kind, source_id: 'p1', job_id: null, facts: { status: 'signed' } })), kind).toEqual({ kind: 'person-signed', documentId: 'p1' })
      expect(agreementDoor(row({ kind, source_id: 'p1', state: 'waiting', job_id: null, facts: { status: 'sent' } })), kind).toEqual({ kind: 'none' })
    }
  })
})

describe('the business a paper names, on its line', () => {
  const party = (over: Partial<AgreementRow>): AgreementRow =>
    row({ id: 'customer_agreement:d9', kind: 'customer_agreement', source_id: 'd9', state: 'waiting', paper_name: 'Mutual secrecy agreement', with_name: 'Ridgeway Builders', job_id: null, job_hcp_number: null, job_name: null, job_address: null, ...over })

  it('says signing for the business when the line names another party: someone added to a list under a second company', () => {
    expect(agreementSigningForWords(party({ facts: { status: 'sent', party_kind: 'customer', signer_name: 'Noor Haddad', signing_for: 'Haddad Engineering' } }))).toBe('signing for Haddad Engineering')
  })

  it('says nothing when the line’s party is the business the paper names', () => {
    expect(agreementSigningForWords(party({ facts: { status: 'sent', party_kind: 'customer', signer_name: 'Dana Ruiz', signing_for: 'Ridgeway Builders' } }))).toBe('')
    expect(agreementSigningForWords(party({ with_name: 'ridgeway builders', facts: { status: 'sent', signer_name: 'Dana Ruiz', signing_for: 'Ridgeway Builders' } }))).toBe('')
  })

  it('says nothing for a paper that kept no business, and for someone who signs for themselves', () => {
    expect(agreementSigningForWords(party({ facts: { status: 'sent', signer_name: 'Dana Ruiz' } }))).toBe('')
    expect(agreementSigningForWords(party({ with_name: 'A customer', facts: { status: 'signed', signer_name: 'Pat Tallman', signer_printed_name: 'Pat Tallman', signing_for: 'Pat Tallman' } }))).toBe('')
  })

  it('says it on a person’s own paper that names their company, and never on a kind that keeps no signer', () => {
    expect(agreementSigningForWords(row({ kind: 'person_agreement', with_name: 'Marco Ibarra', facts: { status: 'signed', signer_name: 'Marco Ibarra', signing_for: 'Juniper Mechanical LLC' } }))).toBe('signing for Juniper Mechanical LLC')
    expect(agreementSigningForWords(row({ kind: 'job_contract', facts: { status: 'signed', signing_for: 'Juniper Mechanical LLC' } }))).toBe('')
    expect(agreementSigningForWords(row({ kind: 'work_order', facts: { status: 'accepted', signing_for: 'Juniper Mechanical LLC' } }))).toBe('')
  })
})
