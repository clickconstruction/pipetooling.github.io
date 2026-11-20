/**
 * Who may open a signed form's PDF (`open-contract-form-pdf`). The file is the one place a form's whole answers live, a
 * tax number among them. The kernel is `formPdfRefusal`; the second block holds the handler to asking it before it
 * reads the paper, to asking the database's own rule for an estimator, and to handing a link over only once the open is
 * written down. Punch list #403, the owner's calls 10 and 11 of 2026-11-20.
 */
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { FORM_PDF_REFUSALS, formPdfOpener, formPdfRefusal } from '../../supabase/functions/_shared/contractFormPdfGate'

const refused = (error: string) => ({ status: 403, error, code: 'forbidden' })
/** Every fact said yes: the most a caller could be handed. */
const EVERY_YES = { payApprovedMaster: true, estimatorReads: true }

describe('formPdfOpener', () => {
  it('says what each role is to the gate', () => {
    expect(formPdfOpener({ role: 'dev' })).toBe('always')
    expect(formPdfOpener({ role: 'controller' })).toBe('always')
    expect(formPdfOpener({ role: 'master_technician' })).toBe('master')
    expect(formPdfOpener({ role: 'estimator' })).toBe('estimator')
    expect(formPdfOpener({ role: 'estimator', is_digital_twin: false })).toBe('estimator')
  })

  it.each(['assistant', 'primary', 'superintendent', 'helpers', 'subcontractor', '', 'ESTIMATOR'])('is none for the role %j', (role) => {
    expect(formPdfOpener({ role })).toBe('none')
  })

  it('is none for a digital twin who is an estimator, and for no account row', () => {
    expect(formPdfOpener({ role: 'estimator', is_digital_twin: true })).toBe('none')
    expect(formPdfOpener(null)).toBe('none')
    expect(formPdfOpener(undefined)).toBe('none')
    expect(formPdfOpener({})).toBe('none')
  })
})

describe('formPdfRefusal', () => {
  it('opens every signed form for a dev and the controller, a signed hours statement among them', () => {
    for (const role of ['dev', 'controller']) {
      expect(formPdfRefusal({ role }, {})).toBeNull()
      expect(formPdfRefusal({ role }, { hoursStatement: true })).toBeNull()
    }
  })

  it('opens for a leader only once they are pay-approved, and never a signed hours statement', () => {
    expect(formPdfRefusal({ role: 'master_technician' }, {})).toEqual(refused(FORM_PDF_REFUSALS.role))
    expect(formPdfRefusal({ role: 'master_technician' }, { payApprovedMaster: false, estimatorReads: true })).toEqual(refused(FORM_PDF_REFUSALS.role))
    expect(formPdfRefusal({ role: 'master_technician' }, { payApprovedMaster: true })).toBeNull()
    expect(formPdfRefusal({ role: 'master_technician' }, { payApprovedMaster: true, hoursStatement: true })).toEqual(refused(FORM_PDF_REFUSALS.hoursStatement))
  })

  it('opens for an estimator only when the database says the paper is an outside company’s', () => {
    expect(formPdfRefusal({ role: 'estimator' }, { estimatorReads: true })).toBeNull()
    expect(formPdfRefusal({ role: 'estimator' }, { estimatorReads: false })).toEqual(refused(FORM_PDF_REFUSALS.estimator))
    expect(formPdfRefusal({ role: 'estimator' }, {})).toEqual(refused(FORM_PDF_REFUSALS.estimator))
    // Being pay-approved is a leader's fact and opens nothing for an estimator.
    expect(formPdfRefusal({ role: 'estimator' }, { payApprovedMaster: true })).toEqual(refused(FORM_PDF_REFUSALS.estimator))
  })

  it('never opens a signed hours statement for an estimator, and names no paper they cannot read', () => {
    expect(formPdfRefusal({ role: 'estimator' }, { estimatorReads: true, hoursStatement: true })).toEqual(refused(FORM_PDF_REFUSALS.hoursStatement))
    expect(formPdfRefusal({ role: 'estimator' }, { estimatorReads: false, hoursStatement: true })).toEqual(refused(FORM_PDF_REFUSALS.estimator))
  })

  it('refuses a digital twin who is an estimator, whatever the facts say', () => {
    expect(formPdfRefusal({ role: 'estimator', is_digital_twin: true }, EVERY_YES)).toEqual(refused(FORM_PDF_REFUSALS.twin))
  })

  it.each(['assistant', 'primary', 'superintendent', 'helpers', 'subcontractor', ''])('refuses the role %j whatever the facts say', (role) => {
    expect(formPdfRefusal({ role }, EVERY_YES)).toEqual(refused(FORM_PDF_REFUSALS.role))
  })

  it('refuses a caller with no account row', () => {
    expect(formPdfRefusal(null, EVERY_YES)).toEqual(refused(FORM_PDF_REFUSALS.role))
    expect(formPdfRefusal(undefined, EVERY_YES)).toEqual(refused(FORM_PDF_REFUSALS.role))
  })
})

describe('open-contract-form-pdf, the handler', () => {
  const source = readFileSync(resolve(__dirname, '../../supabase/functions/open-contract-form-pdf/index.ts'), 'utf8')
  const at = (needle: string) => {
    const i = source.indexOf(needle)
    expect(i, `the handler holds ${needle}`).toBeGreaterThan(-1)
    return i
  }

  it('asks the gate before it reads the paper or mints a link', () => {
    const gate = at('formPdfRefusal(caller, facts)')
    expect(gate).toBeLessThan(at(".from('person_contract_documents')"))
    expect(gate).toBeLessThan(at('createSignedUrl('))
  })

  it('refuses an archived caller before the gate', () => {
    expect(at('refuseArchivedCaller(')).toBeLessThan(at('formPdfRefusal(caller, facts)'))
  })

  it('reads the caller with the service role, by the id the token named, a twin’s mark among the columns', () => {
    expect(source).toMatch(/admin\.from\('users'\)\.select\('role, is_digital_twin'\)\.eq\('id', user\.id\)/)
  })

  it('asks the database’s own rule for an estimator, as the caller, and takes only a plain yes', () => {
    expect(source).toMatch(/userClient\.rpc\('estimator_reads_paper', \{ p_paper_id: docId \}\)/)
    expect(source).toContain('facts.estimatorReads = reads === true')
    expect(source).not.toMatch(/admin\.rpc\('estimator_reads_paper'/)
  })

  it('looks for a signed hours statement for a leader and for an estimator who got that far', () => {
    expect(source).toContain("(opener === 'master' && facts.payApprovedMaster) || (opener === 'estimator' && facts.estimatorReads)")
  })

  it('hands the link over only once the open is written down', () => {
    const log = at(".from('contract_form_pdf_opens').insert({ person_contract_document_id: r.id, opened_by: user.id })")
    const answer = at('return json({ ok: true, url: signed.signedUrl')
    expect(log).toBeLessThan(answer)
    const between = source.slice(log, answer)
    expect(between).toMatch(/if \(logErr\) \{[\s\S]*return json\(\{ error: 'Could not open the PDF right now\.' \}, 500\)/)
  })

  it('mints a link that lasts five minutes, from the private bucket', () => {
    expect(source).toContain('const LINK_SECONDS = 300')
    expect(source).toContain("const FORM_PDFS_BUCKET = 'contract-form-pdfs'")
  })
})
