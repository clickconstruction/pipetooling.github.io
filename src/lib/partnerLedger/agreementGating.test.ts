import { describe, expect, it } from 'vitest'
import { agreementGating, partitionAgreementDocs } from './agreementGating'

const P = 'partnership-1'
const TODAY = '2026-08-21'

describe('partitionAgreementDocs', () => {
  it('splits linked docs from the rest (null and other-partnership alike)', () => {
    const docs = [
      { id: 'a', partnership_id: P },
      { id: 'b', partnership_id: null },
      { id: 'c', partnership_id: 'partnership-2' },
    ]
    const { linked, others } = partitionAgreementDocs(docs, P)
    expect(linked.map((d) => d.id)).toEqual(['a'])
    expect(others.map((d) => d.id)).toEqual(['b', 'c'])
  })
})

describe('agreementGating', () => {
  it('old signed handbook docs (unlinked) do NOT satisfy the deal', () => {
    const out = agreementGating(
      [
        { status: 'signed', sign_by: null, partnership_id: null },
        { status: 'signed', sign_by: null, partnership_id: null },
      ],
      P,
      TODAY,
    )
    expect(out).toEqual({ dealSigned: false, lapsed: false })
  })

  it('a signed linked doc satisfies the deal', () => {
    const out = agreementGating([{ status: 'signed', sign_by: null, partnership_id: P }], P, TODAY)
    expect(out.dealSigned).toBe(true)
    expect(out.lapsed).toBe(false)
  })

  it('a linked unsigned doc past its sign-by lapses the deal', () => {
    const out = agreementGating([{ status: 'sent', sign_by: '2026-08-20', partnership_id: P }], P, TODAY)
    expect(out).toEqual({ dealSigned: false, lapsed: true })
  })

  it('signing any linked version moots the lapse', () => {
    const out = agreementGating(
      [
        { status: 'sent', sign_by: '2026-08-01', partnership_id: P },
        { status: 'signed', sign_by: null, partnership_id: P },
      ],
      P,
      TODAY,
    )
    expect(out).toEqual({ dealSigned: true, lapsed: false })
  })

  it('a sign-by of today is not yet lapsed; an unlinked lapse does not count', () => {
    expect(agreementGating([{ status: 'sent', sign_by: TODAY, partnership_id: P }], P, TODAY).lapsed).toBe(false)
    expect(agreementGating([{ status: 'sent', sign_by: '2026-08-01', partnership_id: null }], P, TODAY).lapsed).toBe(false)
  })
})
