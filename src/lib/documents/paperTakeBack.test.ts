import { describe, expect, it } from 'vitest'
import { plainWordsFailures } from '../plainWords'
import { PARTY_AGREEMENT_KINDS } from '../contracts/paperParty'
import type { AgreementRow } from './agreementsLedger'
import {
  COMPANY_AGREEMENT_KIND,
  TAKE_BACK_LABEL,
  TAKE_BACK_STATUSES,
  agreementCanBeTakenBack,
  canTakeBackPapers,
  companyPaperCanBeTakenBack,
  companyPaperTakeBackRow,
  companyTakeBackOutcome,
  takeBackConfirm,
  takeBackHolder,
  takeBackOutcome,
  takeBackOutcomeWords,
  takeBackVerdict,
} from './paperTakeBack'

/** A supply house's paper that is out and not signed. Every name here is made up. */
function row(over: Partial<AgreementRow> = {}): AgreementRow {
  return {
    id: 'supply_house_agreement:d1',
    kind: 'supply_house_agreement',
    source_id: 'd1',
    state: 'waiting',
    paper_name: 'Mutual NDA',
    with_name: 'Tallgrass Supply Co',
    job_id: null,
    job_hcp_number: null,
    job_click_number: null,
    job_name: null,
    job_address: null,
    more_jobs: 0,
    person_id: null,
    person_kind: null,
    at: '2026-11-20T15:00:00Z',
    at_day: '2026-11-20',
    facts: { status: 'sent', sent_at: '2026-11-20T15:00:00Z', signer_name: 'Lena Park', party_kind: 'supply_house', party_contact_id: 'c1' },
    ...over,
  }
}

describe('canTakeBackPapers: who has the press', () => {
  it('the leader and a dev, the two roles that delete a paper anywhere in the app', () => {
    expect(canTakeBackPapers('dev')).toBe(true)
    expect(canTakeBackPapers('master_technician')).toBe(true)
  })

  it('nobody else: the app’s own rule for deleting a paper, which is narrower than the database’s', () => {
    for (const role of ['assistant', 'controller', 'estimator', 'subcontractor', 'helpers', 'primary', 'superintendent', '', null, undefined]) {
      expect(canTakeBackPapers(role)).toBe(false)
    }
  })
})

describe('takeBackVerdict: which papers can be taken back', () => {
  it('a party’s paper that is out and not signed can be, and a link is out', () => {
    expect(takeBackVerdict(row())).toEqual({ ok: true, sent: true })
    expect(agreementCanBeTakenBack(row())).toBe(true)
  })

  it('every kind of outside party can be: a customer, a supply house, a trade company and someone on no list', () => {
    for (const kind of PARTY_AGREEMENT_KINDS) expect(takeBackVerdict(row({ kind }))).toEqual({ ok: true, sent: true })
  })

  it('a paper that was made and never sent can be, and no link is out', () => {
    expect(takeBackVerdict(row({ state: 'not_sent', facts: { status: 'unsent', party_kind: 'supply_house' } }))).toEqual({ ok: true, sent: false })
  })

  it('an unsent paper the list still calls waiting can be: the status decides, not the state', () => {
    expect(takeBackVerdict(row({ state: 'waiting', facts: { status: 'unsent' } }))).toEqual({ ok: true, sent: false })
  })

  it('a signed paper is kept', () => {
    expect(takeBackVerdict(row({ state: 'signed', facts: { status: 'signed', signed_at: '2026-11-21' } }))).toEqual({ ok: false, why: 'signed' })
  })

  it('a certificate that was received is kept, as a signed paper is', () => {
    expect(takeBackVerdict(row({ state: 'signed', facts: { status: 'received' } }))).toEqual({ ok: false, why: 'signed' })
  })

  it('a row whose state says signed is kept whatever its facts say', () => {
    expect(takeBackVerdict(row({ state: 'signed', facts: { status: 'sent' } }))).toEqual({ ok: false, why: 'signed' })
    expect(takeBackVerdict(row({ state: 'signed', facts: null }))).toEqual({ ok: false, why: 'signed' })
  })

  it('a signed paper a newer one replaced is kept, and the reason is that it is signed', () => {
    expect(takeBackVerdict(row({ state: 'ended', facts: { status: 'signed', replaced: true } }))).toEqual({ ok: false, why: 'signed' })
  })

  it('an unsigned paper a newer one replaced is left alone', () => {
    expect(takeBackVerdict(row({ state: 'ended', facts: { status: 'sent', replaced: true } }))).toEqual({ ok: false, why: 'replaced' })
    expect(takeBackVerdict(row({ state: 'ended', facts: { status: 'sent' } }))).toEqual({ ok: false, why: 'replaced' })
  })

  it('a paper a job requires comes off on the job, not here', () => {
    expect(takeBackVerdict(row({ job_id: 'j1' }))).toEqual({ ok: false, why: 'job-paper' })
  })

  it('a trade company’s own paper that is out can be, by the same rules as a party’s', () => {
    const own = (over: Partial<AgreementRow> = {}) => row({ id: 'company_agreement:g1', kind: COMPANY_AGREEMENT_KIND, source_id: 'g1', with_name: 'Juniper Mechanical LLC', facts: { status: 'sent', signer_name: 'Pat Sample' }, ...over })
    expect(takeBackVerdict(own())).toEqual({ ok: true, sent: true })
    expect(takeBackVerdict(own({ state: 'signed', facts: { status: 'signed' } }))).toEqual({ ok: false, why: 'signed' })
    expect(takeBackVerdict(own({ state: 'ended', facts: { status: 'sent', replaced: true } }))).toEqual({ ok: false, why: 'replaced' })
    expect(takeBackVerdict(own({ job_id: 'j1' }))).toEqual({ ok: false, why: 'job-paper' })
  })

  it('each paper takes its own door: a party’s the plain delete, a trade company’s own its function', () => {
    for (const kind of PARTY_AGREEMENT_KINDS) expect(takeBackHolder(kind)).toBe('party')
    expect(takeBackHolder('company_agreement')).toBe('company')
    for (const kind of ['person_agreement', 'partner_agreement', 'job_contract', 'work_order', 'sow', '', null, undefined]) expect(takeBackHolder(kind)).toBeNull()
  })

  it('a paper that is not an outside party’s or a trade company’s own carries no Take back', () => {
    for (const kind of ['person_agreement', 'partner_agreement', 'job_contract', 'job_warranty', 'their_paper', 'work_order', 'owner_contract', 'sow', 'something_new']) {
      expect(takeBackVerdict(row({ kind }))).toEqual({ ok: false, why: 'not-a-party' })
      expect(agreementCanBeTakenBack(row({ kind }))).toBe(false)
    }
  })

  it('a status the kernel does not know deletes nothing', () => {
    expect(takeBackVerdict(row({ facts: { status: 'archived' } }))).toEqual({ ok: false, why: 'not-out' })
    expect(takeBackVerdict(row({ facts: null }))).toEqual({ ok: false, why: 'not-out' })
    expect(takeBackVerdict(row({ facts: {} }))).toEqual({ ok: false, why: 'not-out' })
  })
})

describe('the delete asks for an unsigned paper only', () => {
  it('names unsent and sent, and never signed or received', () => {
    expect([...TAKE_BACK_STATUSES]).toEqual(['unsent', 'sent'])
    expect(TAKE_BACK_STATUSES as ReadonlyArray<string>).not.toContain('signed')
    expect(TAKE_BACK_STATUSES as ReadonlyArray<string>).not.toContain('received')
  })
})

describe('takeBackConfirm: what the office reads before the delete', () => {
  it('a paper that is out: what goes, whose link stops, that nobody is told, and that it cannot be undone', () => {
    expect(takeBackConfirm(row(), true)).toEqual({
      title: 'Take back: Mutual NDA',
      message: 'This deletes the copy of Mutual NDA that is with Tallgrass Supply Co. The signing link sent to Lena Park stops working. Nobody is emailed. It cannot be undone.',
      confirmLabel: 'Take back the paper',
      danger: true,
    })
  })

  it('a paper that kept no signer names the party as who holds the link', () => {
    expect(takeBackConfirm(row({ facts: { status: 'sent' } }), true).message).toContain('The signing link sent to Tallgrass Supply Co stops working.')
  })

  it('a paper that was never sent says nobody holds a link', () => {
    expect(takeBackConfirm(row({ paper_name: 'W-9', facts: { status: 'unsent' } }), false).message).toBe(
      'This deletes the copy of W-9 made for Tallgrass Supply Co. It was never sent, so nobody holds a link. It cannot be undone.',
    )
  })

  it('a party whose name ends in a full stop does not get two', () => {
    const r = row({ with_name: 'Tallgrass Supply Co.' })
    expect(takeBackConfirm(r, true).message).toContain('that is with Tallgrass Supply Co. The signing link')
    expect(takeBackConfirm(r, false).message).toContain('made for Tallgrass Supply Co. It was never sent')
    expect(takeBackOutcomeWords({ kind: 'taken' }, r, true).words).toBe('Mutual NDA was taken back from Tallgrass Supply Co. Its signing link no longer works.')
  })

  it('a line with no names still reads as a sentence', () => {
    const c = takeBackConfirm(row({ paper_name: '', with_name: '', facts: { status: 'sent' } }), true)
    expect(c.title).toBe('Take back: this paper')
    expect(c.message).toBe('This deletes the copy of this paper that is with this party. The signing link sent to this party stops working. Nobody is emailed. It cannot be undone.')
  })

  it('the button names the act, never OK', () => {
    expect(takeBackConfirm(row(), true).confirmLabel).toMatch(/^Take back/)
    expect(TAKE_BACK_LABEL).toBe('Take back')
  })

  it('the words pass the plain-words rules', () => {
    for (const sent of [true, false]) expect(plainWordsFailures(takeBackConfirm(row(), sent).message)).toEqual([])
  })
})

describe('takeBackOutcome: what the database’s answer means', () => {
  it('a row removed is taken back', () => {
    expect(takeBackOutcome(1, null)).toEqual({ kind: 'taken' })
  })

  it('nothing removed and the paper is signed now: it was signed since', () => {
    expect(takeBackOutcome(0, 'signed')).toEqual({ kind: 'signed-since' })
    expect(takeBackOutcome(0, 'received')).toEqual({ kind: 'signed-since' })
  })

  it('nothing removed and the paper is not there: it was gone already', () => {
    expect(takeBackOutcome(0, null)).toEqual({ kind: 'gone' })
  })

  it('nothing removed and the paper is still out: the account may not delete it', () => {
    expect(takeBackOutcome(0, 'sent')).toEqual({ kind: 'refused' })
    expect(takeBackOutcome(0, 'unsent')).toEqual({ kind: 'refused' })
  })
})

describe('a trade company’s own paper: the function’s answer, and the words on People → Contracts', () => {
  it('reads the function’s three answers, and takes nothing else for a paper taken back', () => {
    expect(companyTakeBackOutcome('taken')).toEqual({ kind: 'taken' })
    expect(companyTakeBackOutcome('signed')).toEqual({ kind: 'signed-since' })
    expect(companyTakeBackOutcome('gone')).toEqual({ kind: 'gone' })
    for (const answer of [null, undefined, '', 'ok', true, 1, { taken: true }]) expect(companyTakeBackOutcome(answer)).toBeNull()
  })

  it('a paper that is out or was never sent carries the press, and a signed or received one does not', () => {
    expect(companyPaperCanBeTakenBack('sent')).toBe(true)
    expect(companyPaperCanBeTakenBack('unsent')).toBe(true)
    for (const status of ['signed', 'received', 'archived', '']) expect(companyPaperCanBeTakenBack(status)).toBe(false)
  })

  it('the confirm names the paper, the company and who holds the link', () => {
    const paper = companyPaperTakeBackRow({ document_name: 'W-9', signer_name: 'Pat Sample' }, 'Juniper Mechanical LLC')
    expect(takeBackConfirm(paper, true).message).toBe('This deletes the copy of W-9 that is with Juniper Mechanical LLC. The signing link sent to Pat Sample stops working. Nobody is emailed. It cannot be undone.')
    // A paper that kept no signer names the company as who holds the link.
    const bare = companyPaperTakeBackRow({ document_name: 'W-9', signer_name: null }, 'Juniper Mechanical LLC')
    expect(takeBackConfirm(bare, true).message).toContain('The signing link sent to Juniper Mechanical LLC stops working.')
    expect(takeBackOutcomeWords({ kind: 'taken' }, paper, true).words).toBe('W-9 was taken back from Juniper Mechanical LLC. Its signing link no longer works.')
  })
})

describe('takeBackOutcomeWords: what the office is told', () => {
  it('taken back while out: the party, and that the link no longer works', () => {
    expect(takeBackOutcomeWords({ kind: 'taken' }, row(), true)).toEqual({ words: 'Mutual NDA was taken back from Tallgrass Supply Co. Its signing link no longer works.', tone: 'success' })
  })

  it('taken back before it was sent', () => {
    expect(takeBackOutcomeWords({ kind: 'taken' }, row({ paper_name: 'W-9' }), false)).toEqual({ words: 'W-9 was taken back. It was never sent.', tone: 'success' })
  })

  it('signed since: the reason it is kept', () => {
    expect(takeBackOutcomeWords({ kind: 'signed-since' }, row(), true)).toEqual({ words: 'Mutual NDA was signed before it could be taken back. A signed paper is kept.', tone: 'error' })
  })

  it('gone already is said quietly', () => {
    expect(takeBackOutcomeWords({ kind: 'gone' }, row(), true)).toEqual({ words: 'Mutual NDA was already taken back.', tone: 'info' })
  })

  it('refused names the reason', () => {
    expect(takeBackOutcomeWords({ kind: 'refused' }, row(), true)).toEqual({ words: 'Mutual NDA was not taken back. Your account cannot delete a paper.', tone: 'error' })
  })

  it('every outcome’s words pass the plain-words rules', () => {
    for (const kind of ['taken', 'signed-since', 'gone', 'refused'] as const) {
      for (const sent of [true, false]) expect(plainWordsFailures(takeBackOutcomeWords({ kind }, row(), sent).words)).toEqual([])
    }
  })
})
