/**
 * The four Texas statutory lien waivers — Tex. Prop. Code § 53.284(b)–(e) —
 * as forms a SUBCONTRACTOR signs for Click. The statute's text is reproduced
 * verbatim (a waiver "is unenforceable unless it substantially complies with
 * the applicable form"); each blank in the statute is a box. On the
 * unconditional forms the statutory notice is printed in bold at the largest
 * type size on the page, as § 53.284(c)(1) / (e)(1) require, so nothing on
 * those pages is set larger than the notice.
 *
 * Click is the maker of the check and the person the signer contracted with,
 * so those blanks are constants; the sub is the payee (prefilled from the
 * roster) and fills project, job, owner, location, amount, and signs.
 *
 * Source text: Texas Property Code § 53.284 (added by Acts 2011, 82nd Leg.,
 * R.S., Ch. 271 (H.B. 1456), Sec. 3, eff. January 1, 2012). Verify against the current
 * statute before relying on a generated waiver.
 */
import type { PDFFont } from 'pdf-lib'
import type { FormBox } from '../../../supabase/functions/_shared/formSchema'
import { AuthoredPage, INK, MARGIN, MUTED, PAGE, newAuthoredDoc, writeAuthored } from './lib'
import { COMPANY, COMPANY_ADDRESS, OUT_DIR } from './company'

type Blank = { key: string; w: number; label: string; labelEs?: string; sub?: string } & Partial<Omit<FormBox, 'key' | 'label' | 'labelEs' | 'page' | 'rect' | 'order' | 'type'>> & { type?: FormBox['type']; text?: string }
type Seg = string | Blank

const NOTICE =
  'This document waives rights unconditionally and states that you have been paid for giving up those rights. It is prohibited for a person to require you to sign this document if you have not been paid the payment amount set forth below. If you have not been paid, use a conditional release form.'

const RELEASE_LIST =
  'any mechanic’s lien right, any right arising from a payment bond that complies with a state or federal statute, any common law payment bond right, any claim for payment, and any rights under any similar ordinance, rule, or statute related to claim or payment rights for persons in the signer’s position'

const WARRANTY_PROGRESS =
  'The signer warrants that the signer has already paid or will use the funds received from this progress payment to promptly pay in full all of the signer’s laborers, subcontractors, materialmen, and suppliers for all work, materials, equipment, or services provided for or to the above referenced project in regard to the attached statement(s) or progress payment request(s).'

const WARRANTY_FINAL =
  'The signer warrants that the signer has already paid or will use the funds received from this final payment to promptly pay in full all of the signer’s laborers, subcontractors, materialmen, and suppliers for all work, materials, equipment, or services provided for or to the above referenced project up to the date of this waiver and release.'

const VERIFY = 'Before any recipient of this document relies on this document, the recipient should verify evidence of payment to the signer.'

// ── the blanks ────────────────────────────────────────────────────────────────
const maker: Blank = { key: 'maker_of_check', w: 150, label: '', type: 'constant', text: COMPANY, sub: '(maker of check)' }
const contracted = (n: number): Blank => ({ key: n === 1 ? 'contracted_with' : `contracted_with_${n}`, w: 150, label: '', type: 'constant', text: COMPANY, sub: '(person with whom signer contracted)' })
const sum = (progress: boolean): Blank => ({ key: 'amount', w: 82, label: progress ? 'Amount of this progress payment ($)' : 'Amount of the final payment ($)', labelEs: progress ? 'Monto de este pago parcial ($)' : 'Monto del pago final ($)', required: true, help: 'Dollars and cents, as on the check.', helpEs: 'Dólares y centavos, como en el cheque.', sample: '4,250.00', sub: '$' })
const payee: Blank = { key: 'payee', w: 160, label: 'Payee (your company, as on the check)', labelEs: 'Beneficiario (su empresa, como en el cheque)', required: true, prefill: 'person_name', sample: 'Misses Taunya TESTING', sub: '(payee or payees of check)' }
const owner: Blank = { key: 'owner', w: 150, label: 'Property owner', labelEs: 'Propietario', required: true, help: 'The owner of the property you worked on, as shown on your work order.', helpEs: 'El propietario de la propiedad donde trabajó, como en su orden de trabajo.', sample: 'Cowboy Creek Builders LLC', sub: '(owner)' }
const location: Blank = { key: 'location', w: 200, label: 'Property address', labelEs: 'Dirección de la propiedad', required: true, sample: '1408 Cedar Bend, Kyle, TX 78640', sub: '(location)' }
const jobDesc: Blank = { key: 'job_description', w: 200, label: 'Job description (the extent of this release)', labelEs: 'Descripción del trabajo (alcance de esta liberación)', required: true, help: 'What this payment covers, e.g. "rough-in plumbing, building 2".', helpEs: 'Lo que cubre este pago, p. ej. "plomería preliminar, edificio 2".', sample: 'Rough-in plumbing, building 2', sub: '(job description)' }

export async function buildLienWaivers() {
  await buildOne('conditional-progress', 'Conditional Waiver and Release on Progress Payment', false, [
    ['On receipt by the signer of this document of a check from ', maker, ' in the sum of ', sum(true), ' payable to ', payee, ' and when the check has been properly endorsed and has been paid by the bank on which it is drawn, this document becomes effective to release ', RELEASE_LIST, ' that the signer has on the property of ', owner, ' located at ', location, ' to the following extent: ', jobDesc, '.'],
    ['This release covers a progress payment for all labor, services, equipment, or materials furnished to the property or to ', contracted(1), ' as indicated in the attached statement(s) or progress payment request(s), except for unpaid retention, pending modifications and changes, or other items furnished.'],
    [VERIFY],
    [WARRANTY_PROGRESS],
  ])
  await buildOne('unconditional-progress', 'Unconditional Waiver and Release on Progress Payment', true, [
    ['The signer of this document has been paid and has received a progress payment in the sum of ', sum(true), ' for all labor, services, equipment, or materials furnished to the property or to ', contracted(1), ' on the property of ', owner, ' located at ', location, ' to the following extent: ', jobDesc, '. The signer therefore waives and releases ', RELEASE_LIST, ' that the signer has on the above referenced project to the following extent:'],
    ['This release covers a progress payment for all labor, services, equipment, or materials furnished to the property or to ', contracted(2), ' as indicated in the attached statement(s) or progress payment request(s), except for unpaid retention, pending modifications and changes, or other items furnished.'],
    [WARRANTY_PROGRESS],
  ])
  await buildOne('conditional-final', 'Conditional Waiver and Release on Final Payment', false, [
    ['On receipt by the signer of this document of a check from ', maker, ' in the sum of ', sum(false), ' payable to ', payee, ' and when the check has been properly endorsed and has been paid by the bank on which it is drawn, this document becomes effective to release ', RELEASE_LIST, ' that the signer has on the property of ', owner, ' located at ', location, ' to the following extent: ', jobDesc, '.'],
    ['This release covers the final payment to the signer for all labor, services, equipment, or materials furnished to the property or to ', contracted(1), '.'],
    [VERIFY],
    [WARRANTY_FINAL],
  ])
  await buildOne('unconditional-final', 'Unconditional Waiver and Release on Final Payment', true, [
    ['The signer of this document has been paid in full for all labor, services, equipment, or materials furnished to the property or to ', contracted(1), ' on the property of ', owner, ' located at ', location, ' to the following extent: ', jobDesc, '. The signer therefore waives and releases ', RELEASE_LIST, '.'],
    [WARRANTY_FINAL],
  ])
}

async function buildOne(slug: string, title: string, unconditional: boolean, paragraphs: Seg[][]) {
  const { doc, addPage } = await newAuthoredDoc()
  const p = addPage(1)
  // § 53.284(c)(1)/(e)(1): the notice must be at least as large as the largest type on the page.
  // On unconditional forms nothing is set above 11 pt; the notice is 11 pt bold.
  const big = unconditional ? 11 : 15
  p.page.drawText(COMPANY, { x: MARGIN, y: p.y - 12, size: unconditional ? 10 : 12, font: p.fonts.bold, color: INK })
  const addrW = p.fonts.body.widthOfTextAtSize(COMPANY_ADDRESS, 8)
  p.page.drawText(COMPANY_ADDRESS, { x: PAGE.width - MARGIN - addrW, y: p.y - 12, size: 8, font: p.fonts.body, color: MUTED })
  p.y -= 22
  p.page.drawLine({ start: { x: MARGIN, y: p.y }, end: { x: PAGE.width - MARGIN, y: p.y }, thickness: 1.2, color: INK })
  p.y -= 16
  if (unconditional) {
    p.paragraph(NOTICE, { size: 11, bold: true, gapAfter: 10 })
  }
  p.title(title, big)
  p.subtitle(`Texas Property Code § 53.284${unconditional ? (slug.endsWith('final') ? '(e)' : '(c)') : slug.endsWith('final') ? '(d)' : '(b)'} · statutory form · signed by the subcontractor`)

  p.fieldRow(
    [
      { box: { key: 'project', type: 'text', label: 'Project', labelEs: 'Proyecto', required: true, help: 'The job or project name, as on your work order.', helpEs: 'El nombre del trabajo o proyecto, como en su orden de trabajo.', sample: 'Cedar Bend Phase 2' }, label: 'Project', frac: 0.62 },
      { box: { key: 'job_no', type: 'text', label: 'Job No.', labelEs: 'Núm. de trabajo', required: true, help: 'Click’s job number, e.g. J1042.', helpEs: 'El número de trabajo de Click, p. ej. J1042.', sample: 'J1042' }, label: 'Job No.', frac: 0.38 },
    ],
    { gapAfter: 6 },
  )

  for (const segs of paragraphs) paragraphWithBlanks(p, segs)

  p.y -= 6
  p.signatureBlock(
    { signature: 'signature', date: 'date', printedName: 'company_name', title: 'title' },
    { signature: 'By (Signature)', date: 'Date', printedName: 'Company name', title: 'Title' },
    undefined,
    { signature: 'Firma', date: 'Fecha', printedName: 'Nombre de la empresa', title: 'Cargo' },
  )
  // The company-name box prefills from the roster; the title is typed.
  const cn = p.boxes.find((b) => b.key === 'company_name')
  if (cn) Object.assign(cn, { required: true, prefill: 'person_name', sample: 'Misses Taunya TESTING', label: 'Company name (the signer’s business)', labelEs: 'Nombre de la empresa (el negocio del firmante)' })
  const tt = p.boxes.find((b) => b.key === 'title')
  if (tt) Object.assign(tt, { required: true, label: 'Your title', labelEs: 'Su cargo', sample: 'Owner' })

  p.footer(`${COMPANY} · ${title} · Tex. Prop. Code § 53.284 · v1 (2026-09)`)
  await writeAuthored(doc, p.schema(1), `${OUT_DIR}/lien-waiver-${slug}`, title)
}

/**
 * A statutory paragraph with inline blanks. Text wraps word by word; a blank is
 * an unbreakable gap of `w` points drawn as an underline with its statutory
 * caption beneath, and recorded as a box. Constants (Click) are printed in the
 * gap by the fill, not here.
 */
function paragraphWithBlanks(p: AuthoredPage, segs: Seg[]) {
  const size = 9.5
  // Tall enough for a blank's statutory caption ("(owner)") to sit under the underline without touching the next line.
  const lineH = size * 1.9
  const maxX = PAGE.width - MARGIN
  const font: PDFFont = p.fonts.body
  let x = MARGIN
  p.y -= lineH
  const newline = () => {
    x = MARGIN
    p.y -= lineH
  }
  for (const seg of segs) {
    if (typeof seg === 'string') {
      for (const word of seg.split(/(\s+)/)) {
        if (!word) continue
        const w = font.widthOfTextAtSize(word, size)
        if (/^\s+$/.test(word)) {
          if (x > MARGIN) x += w
          continue
        }
        // Short punctuation right after a blank may overhang the margin a hair rather than start a line.
        if (x + w > maxX && !(word.length <= 2 && x + w <= maxX + 8)) newline()
        p.page.drawText(word, { x, y: p.y, size, font, color: INK })
        x += w
      }
      continue
    }
    if (x + seg.w > maxX) newline()
    p.page.drawLine({ start: { x, y: p.y - 2 }, end: { x: x + seg.w, y: p.y - 2 }, thickness: 0.6, color: INK })
    if (seg.sub) p.page.drawText(seg.sub, { x, y: p.y - 8.5, size: 6, font: p.fonts.body, color: MUTED })
    const { w, sub: _sub, ...rest } = seg
    void _sub
    p.boxes.push({ ...rest, type: rest.type ?? 'text', page: p.pageNo, rect: { x: r2(x), y: r2(p.y - 1), w: r2(w), h: 12 }, order: p.nextOrder(), fontSize: 9, ...(rest.type === 'constant' ? {} : {}) } as FormBox)
    x += seg.w + 2
  }
  p.y -= 12
}

function r2(n: number): number {
  return Math.round(n * 100) / 100
}
