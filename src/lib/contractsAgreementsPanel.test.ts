import { describe, expect, it } from 'vitest'
import {
  AGREEMENTS_NOTHING_LIVE_MAIN,
  AGREEMENTS_NOTHING_LIVE_TAIL,
  agreementComplianceState,
  agreementIsIdle,
  bestPersonDocRow,
  buildAgreementSummaries,
  formatAgreementShortDate,
  idleAgreementsFoldLabel,
  splitAgreementSummaries,
  type AgreementSummary,
} from './contractsAgreementsPanel'
import { plainWordsFailures } from './plainWords'

const doc = (over: Record<string, unknown> = {}) => ({
  person_name: 'Darren',
  document_name: 'Handbook',
  status: 'unsent',
  lineage_version: 1,
  sent_at: null,
  signer_last_viewed_at: null,
  signed_at: null,
  ...over,
})

describe('bestPersonDocRow', () => {
  it('prefers better status over newer version', () => {
    const rows = [doc({ status: 'signed', lineage_version: 1 }), doc({ status: 'unsent', lineage_version: 3 })]
    expect(bestPersonDocRow(rows)?.status).toBe('signed')
  })
  it('breaks status ties by newest lineage version', () => {
    const rows = [doc({ status: 'sent', lineage_version: 1, sent_at: 'a' }), doc({ status: 'sent', lineage_version: 2, sent_at: 'b' })]
    expect(bestPersonDocRow(rows)?.sent_at).toBe('b')
  })
  it('returns null for no rows', () => {
    expect(bestPersonDocRow([])).toBeNull()
  })
})

describe('agreementComplianceState', () => {
  it('maps the four states', () => {
    expect(agreementComplianceState(null)).toBe('unsent')
    expect(agreementComplianceState(doc({ status: 'signed' }))).toBe('signed')
    expect(agreementComplianceState(doc({ status: 'sent' }))).toBe('never_opened')
    expect(agreementComplianceState(doc({ status: 'sent', signer_last_viewed_at: '2026-08-05T10:00:00Z' }))).toBe(
      'viewed_not_signed',
    )
  })
})

describe('buildAgreementSummaries', () => {
  const templates = [{ id: 't-subs', name: 'Subcontractors' }]
  const templateDocuments = [{ template_id: 't-subs', document_name: 'Handbook' }]
  const assignments = [
    { person_name: 'Darren', template_id: 't-subs' },
    { person_name: 'Wendi', template_id: 't-subs' },
  ]

  it('counts assigned via template plus ad-hoc copies, and signed from best rows', () => {
    const personDocuments = [
      doc({ person_name: 'Wendi', status: 'signed', signed_at: '2026-07-13' }),
      doc({ person_name: 'Paige', status: 'sent', sent_at: '2026-08-01T09:00:00Z', signer_last_viewed_at: '2026-08-04T12:00:00Z' }),
    ]
    const [summary] = buildAgreementSummaries({ templates, templateDocuments, assignments, personDocuments })
    expect(summary!.documentName).toBe('Handbook')
    expect(summary!.assignedCount).toBe(3)
    expect(summary!.signedCount).toBe(1)
    expect(summary!.templateNames).toEqual(['Subcontractors'])
    expect(summary!.rows.map((r) => `${r.personName}:${r.state}`)).toEqual([
      'Paige:viewed_not_signed',
      'Darren:unsent',
      'Wendi:signed',
    ])
  })

  it('sorts incomplete agreements first and fully signed last', () => {
    const summaries = buildAgreementSummaries({
      templates,
      templateDocuments: [
        { template_id: 't-subs', document_name: 'Handbook' },
        { template_id: 't-subs', document_name: 'All Done' },
      ],
      assignments: [{ person_name: 'Wendi', template_id: 't-subs' }],
      personDocuments: [
        doc({ person_name: 'Wendi', document_name: 'All Done', status: 'signed', signed_at: '2026-07-01' }),
      ],
    })
    expect(summaries.map((s) => s.documentName)).toEqual(['Handbook', 'All Done'])
  })
})

describe('formatAgreementShortDate', () => {
  it('drops the year for the current year and keeps it otherwise', () => {
    expect(formatAgreementShortDate('2026-07-12', 2026)).toBe('Jul 12')
    expect(formatAgreementShortDate('2025-07-12', 2026)).toBe('Jul 12, 2025')
  })
  it('converts timestamps to the app-timezone day', () => {
    expect(formatAgreementShortDate('2026-08-05T03:30:00Z', 2026)).toBe('Aug 4')
  })
  it('returns null for empty or junk', () => {
    expect(formatAgreementShortDate(null)).toBeNull()
    expect(formatAgreementShortDate('junk')).toBeNull()
  })
})

describe('splitAgreementSummaries', () => {
  const summary = (documentName: string, assignedCount: number, signedCount: number): AgreementSummary => ({
    documentName,
    templateNames: [],
    assignedCount,
    signedCount,
    rows: [],
  })

  it('keeps what is assigned or signed open and puts every Book entry nobody holds behind the fold, each in its own order', () => {
    const summaries = [
      summary('Conditional Waiver', 0, 0),
      summary('Handbook', 16, 9),
      summary('Service agreement', 0, 0),
      summary('W-9', 1, 1),
    ]
    const split = splitAgreementSummaries(summaries)
    expect(split.live.map((s) => s.documentName)).toEqual(['Handbook', 'W-9'])
    expect(split.idle.map((s) => s.documentName)).toEqual(['Conditional Waiver', 'Service agreement'])
  })

  it('a Book entry is idle when nobody is assigned; a signed copy always counts as assigned', () => {
    expect(agreementIsIdle(summary('x', 0, 0))).toBe(true)
    expect(agreementIsIdle(summary('x', 1, 0))).toBe(false)
    expect(agreementIsIdle(summary('x', 1, 1))).toBe(false)
  })

  it('lives through the real pivot: an ad-hoc signed copy with no template makes its document live', () => {
    const summaries = buildAgreementSummaries({
      templates: [{ id: 't-subs', name: 'Subcontractors' }],
      templateDocuments: [
        { template_id: 't-subs', document_name: 'Handbook' },
        { template_id: 't-subs', document_name: 'Lien Waiver' },
      ],
      assignments: [{ person_name: 'Wendi', template_id: 't-subs' }],
      personDocuments: [doc({ person_name: 'Paige', document_name: 'DWC-83', status: 'signed', signed_at: '2026-07-01' })],
    })
    const split = splitAgreementSummaries(summaries)
    expect(split.live.map((s) => s.documentName).sort()).toEqual(['DWC-83', 'Handbook', 'Lien Waiver'])
    expect(split.idle).toEqual([])
  })

  it('with nothing at all, both lists are empty', () => {
    expect(splitAgreementSummaries([])).toEqual({ live: [], idle: [] })
  })
})

describe('idleAgreementsFoldLabel', () => {
  it('names the count through countedLabel, Show closed and Hide open, nothing at zero', () => {
    expect(idleAgreementsFoldLabel(9, false)).toBe('Show 9 unassigned documents')
    expect(idleAgreementsFoldLabel(9, true)).toBe('Hide 9 unassigned documents')
    expect(idleAgreementsFoldLabel(1, false)).toBe('Show 1 unassigned document')
    expect(idleAgreementsFoldLabel(0, false)).toBe('')
  })

  it('the empty state around it keeps to plain words', () => {
    expect(plainWordsFailures(AGREEMENTS_NOTHING_LIVE_MAIN)).toEqual([])
    expect(plainWordsFailures(`${AGREEMENTS_NOTHING_LIVE_MAIN} ${idleAgreementsFoldLabel(9, false)} ${AGREEMENTS_NOTHING_LIVE_TAIL}`)).toEqual([])
  })
})
