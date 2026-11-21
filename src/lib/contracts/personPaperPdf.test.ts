/**
 * The PDF of a signed paper of plain words or clauses (punch list #376). The shared file takes pdf-lib as a parameter,
 * so here it runs on node_modules' copy, as the job contract's does. Every name is made up.
 */
import { describe, expect, it } from 'vitest'
import * as pdfLib from 'pdf-lib'
import type { PdfLibLike } from '../../../supabase/functions/_shared/jobContractPdf'
import { buildPersonPaperPdf, PAPER_PDF_REFUSALS, paperAuditLine, paperMakesAPdf, paperParagraphs, paperPdfOpener, paperPdfPath, paperPdfRefusal, paperPdfSafe } from '../../../supabase/functions/_shared/personPaperPdf'

const lib = pdfLib as unknown as PdfLibLike
const signature = { printedName: 'Dana Whitfield', signedLabel: 'Nov 20, 2026', auditLine: paperAuditLine({ drawn: false, consentedLabel: 'Nov 20, 2026, 9:14 AM CT', ip: '203.0.113.7' }) }

describe('the paper’s words', () => {
  it('reads a body of plain words as paragraphs', () => {
    expect(paperParagraphs({ signing_body_html: 'First.\n\nSecond line one\nSecond line two', signing_body_format: 'plain' })).toEqual(['First.', 'Second line one', 'Second line two'])
  })

  it('reads an HTML body without its tags, a list as bullets', () => {
    const html = '<h2>Scope</h2><p>The sub does the work.</p><ul><li>On time</li><li>To code</li></ul>'
    expect(paperParagraphs({ signing_body_html: html, signing_body_format: 'html' })).toEqual(['Scope', 'The sub does the work.', '• On time', '• To code'])
  })

  it('reads a paper signed as clauses from what the signing kept, never from the body', () => {
    const kept = {
      title: 'Subcontract',
      lang: 'en',
      between: 'Click Construction and Hillside Excavation',
      clauses: [
        { id: 'a', v: 1, n: 1, text: 'The work is done to code.' },
        { id: 'b', v: 2, n: 2, text: 'Pay is net 30.' },
      ],
      exhibit: [{ id: 'c', v: 1, n: 3, text: 'Sitework includes erosion control.' }],
      exhibitFor: ['Sitework'],
    }
    expect(paperParagraphs({ signing_body_html: 'An older body', signing_body_format: 'plain', clause_versions: kept })).toEqual([
      'Click Construction and Hillside Excavation',
      '1. The work is done to code.',
      '2. Pay is net 30.',
      'Exhibit for Sitework',
      '3. Sitework includes erosion control.',
    ])
    expect(paperParagraphs({ clause_versions: { ...kept, lang: 'es' } })[3]).toBe('Anexo de Sitework')
  })

  it('reads the body when nothing was kept as clauses, and nothing when there are no words', () => {
    expect(paperParagraphs({ signing_body_html: 'Words.', signing_body_format: 'plain', clause_versions: { clauses: [], exhibit: [] } })).toEqual(['Words.'])
    expect(paperParagraphs({ signing_body_html: '  ', signing_body_format: 'plain' })).toEqual([])
    expect(paperParagraphs({})).toEqual([])
  })
})

describe('which paper makes a PDF', () => {
  it('is a signed paper with words of its own', () => {
    expect(paperMakesAPdf({ status: 'signed', signing_body_html: 'Words.', signing_body_format: 'plain' })).toBe(true)
  })

  it('is never one that waits, a form, or a paper that is only a link', () => {
    expect(paperMakesAPdf({ status: 'sent', signing_body_html: 'Words.', signing_body_format: 'plain' })).toBe(false)
    expect(paperMakesAPdf({ status: 'signed', form_template_id: 't1', signing_body_html: 'Words.', signing_body_format: 'plain' })).toBe(false)
    expect(paperMakesAPdf({ status: 'signed', signing_body_html: null })).toBe(false)
  })

  it('is kept beside a form’s PDF, under the paper’s own id', () => {
    expect(paperPdfPath('d1')).toBe('d1/signed-paper.pdf')
  })
})

describe('the audit line', () => {
  it('says how, when and from where', () => {
    expect(paperAuditLine({ drawn: true, consentedLabel: 'Nov 20, 2026, 9:14 AM CT', ip: '203.0.113.7' })).toBe(
      'Signed electronically with a drawn signature on Nov 20, 2026, 9:14 AM CT · IP 203.0.113.7. The signer agreed to sign electronically before signing.',
    )
    expect(paperAuditLine({ drawn: false, consentedLabel: null, ip: null })).toBe('Signed electronically with a typed name. The signer agreed to sign electronically before signing.')
  })
})

describe('the PDF', () => {
  it('drops what the standard fonts cannot draw, so a stray mark never stops the paper', () => {
    expect(paperPdfSafe('Total − 5 → done ✓ “ok” é')).toBe('Total - 5  done  “ok” é')
  })

  it('draws a one-page paper with its title', async () => {
    const bytes = await buildPersonPaperPdf(lib, {
      title: 'Employee handbook acknowledgment',
      company: 'Click Plumbing and Electrical',
      companyLine: '100 Example Rd, Anytown TX · 555-0100',
      forWords: 'Dana Whitfield',
      paragraphs: ['I have read the handbook.', 'I will follow it → always ✓.'],
      signature,
    })
    const doc = await pdfLib.PDFDocument.load(bytes)
    expect(doc.getPageCount()).toBe(1)
    expect(doc.getTitle()).toBe('Employee handbook acknowledgment')
  })

  it('runs a long paper over pages and keeps the signature block whole', async () => {
    const paragraphs = Array.from({ length: 60 }, (_, i) => `${i + 1}. ` + 'The parties agree to the words of this clause as written here. '.repeat(4))
    const bytes = await buildPersonPaperPdf(lib, {
      title: 'Subcontractor agreement',
      company: 'Click Plumbing and Electrical',
      forWords: 'Hillside Excavation, signed by Rory Blake',
      paragraphs,
      signature: { ...signature, printedName: 'Rory Blake', capacity: 'Owner, for Hillside Excavation', recordId: 'P-1B0C4D' },
    })
    const doc = await pdfLib.PDFDocument.load(bytes)
    expect(doc.getPageCount()).toBeGreaterThan(2)
  })

  it('falls back to the typed name when the drawn signature is not a PNG', async () => {
    const bytes = await buildPersonPaperPdf(lib, {
      title: 'Agreement',
      company: 'Click Plumbing and Electrical',
      forWords: 'Dana Whitfield',
      paragraphs: ['Words.'],
      signature: { ...signature, png: new Uint8Array([1, 2, 3]) },
    })
    expect((await pdfLib.PDFDocument.load(bytes)).getPageCount()).toBe(1)
  })
})

describe('who opens a signed paper’s PDF', () => {
  it('opens for each of the four roles that send a paper, whatever the paper', () => {
    for (const role of ['dev', 'master_technician', 'assistant', 'controller']) {
      expect(paperPdfOpener({ role }), role).toBe('office')
      expect(paperPdfRefusal({ role }, {}), role).toBeNull()
    }
  })

  it('opens for an estimator only on a paper the database says is an outside company’s', () => {
    expect(paperPdfOpener({ role: 'estimator' })).toBe('estimator')
    expect(paperPdfRefusal({ role: 'estimator' }, { estimatorReads: true })).toBeNull()
    expect(paperPdfRefusal({ role: 'estimator' }, { estimatorReads: false })).toBe(PAPER_PDF_REFUSALS.estimator)
    // No answer from the database is a refusal.
    expect(paperPdfRefusal({ role: 'estimator' }, {})).toBe(PAPER_PDF_REFUSALS.estimator)
  })

  it('refuses a digital twin, which reads as an estimator, even on an outside company’s paper', () => {
    const twin = { role: 'estimator', is_digital_twin: true }
    expect(paperPdfOpener(twin)).toBe('none')
    expect(paperPdfRefusal(twin, { estimatorReads: true })).toBe(PAPER_PDF_REFUSALS.twin)
  })

  it('refuses every other role and an account with no row', () => {
    for (const role of ['subcontractor', 'helper', 'superintendent', 'primary', '']) {
      expect(paperPdfRefusal({ role }, { estimatorReads: true }), role).toBe(PAPER_PDF_REFUSALS.role)
    }
    expect(paperPdfRefusal(null, { estimatorReads: true })).toBe(PAPER_PDF_REFUSALS.role)
  })
})
