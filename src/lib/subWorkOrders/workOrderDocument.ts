import { parseSubWorkOrderSnapshot, workOrderWindowLabel, type SubWorkOrderSnapshot } from './subWorkOrder'

/**
 * The work order as a document (Work Orders tab, PR 1 — v2.2814). Pure:
 * a snapshot + the commitment's row facts + the issuer become one numbered
 * document model, and one HTML rendering serves the office preview, the
 * print / PDF copy, and (later) the portal's record. Modeled on
 * jobContractDocument.ts; the model is what the assembler edits live.
 */

export type WorkOrderDocumentParty = { name: string; lines: string[] }

export type WorkOrderDocumentSection = {
  key: 'scope' | 'exclusions' | 'terms' | 'references' | 'acknowledgements'
  title: string
  items: string[]
}

export type WorkOrderDocument = {
  recordId: string
  issuedOn: string | null
  companyName: string
  companyLine: string | null
  contractor: WorkOrderDocumentParty
  subcontractor: WorkOrderDocumentParty
  project: WorkOrderDocumentParty
  amountLabel: string
  retainageLabel: string | null
  windowLabel: string | null
  expiresLabel: string | null
  sections: WorkOrderDocumentSection[]
  signatures: {
    issuer: { name: string | null; title: string | null; on: string | null }
    sub: { name: string | null; company: string | null; on: string | null; via: string | null }
  }
  footer: string
}

export type WorkOrderCommitmentFacts = {
  amount: number | null
  retainage_pct: number | null
  proposed_start: string | null
  proposed_end: string | null
  offer_expires_at: string | null
  record_id: string | null
  offered_at: string | null
  signed_at: string | null
  accepted_at: string | null
  signer_printed_name: string | null
  signer_signature_mode?: string | null
  display_name: string
  status: string
}

export type WorkOrderIssuer = {
  companyName: string
  companyLine: string | null
  address: string | null
  phone: string | null
}

/** The letterhead on every work order — the sub portal's company block, kept in step by hand. */
export const WORK_ORDER_ISSUER: WorkOrderIssuer = {
  companyName: 'Click Plumbing and Electrical',
  companyLine: 'Plumbing, Electrical, and HVAC',
  address: null,
  phone: '(512) 360-0599',
}

const money = (n: number) => `$${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

export function fmtDocDate(ymdOrIso: string | null | undefined): string | null {
  if (!ymdOrIso) return null
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(ymdOrIso)
  if (!m) return null
  return new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]))).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' })
}

/** "WO-977-01"; falls back to a draft label until send mints the real id. */
export function workOrderRecordLabel(recordId: string | null | undefined): string {
  return (recordId ?? '').trim() || 'DRAFT'
}

export function buildWorkOrderDocument(input: {
  snapshot: unknown
  commitment: WorkOrderCommitmentFacts
  issuer: WorkOrderIssuer
}): WorkOrderDocument {
  const s: SubWorkOrderSnapshot = parseSubWorkOrderSnapshot(input.snapshot)
  const c = input.commitment
  const f = s.facts
  const amount = c.amount
  const retainage = Number(c.retainage_pct) || 0
  const windowLabel = workOrderWindowLabel(c.proposed_start, c.proposed_end)
  const expires = fmtDocDate(c.offer_expires_at)

  const terms: string[] = []
  terms.push(
    amount != null
      ? `Subcontract amount ${money(amount)}, fixed.${retainage > 0 ? ` ${retainage}% retainage held until the walk-through.` : ''}`
      : 'Subcontract amount to be set before this work order is sent.',
  )
  if (windowLabel) terms.push(`Work window ${windowLabel}.${expires ? ` Offer good through ${expires}.` : ''}`)
  else if (expires) terms.push(`Offer good through ${expires}.`)
  terms.push(s.bond === 'furnished' ? 'A performance and payment bond will be furnished by the Subcontractor.' : 'A performance and payment bond will not be furnished.')
  if (s.specialProvisions) terms.push(`Special provisions: ${s.specialProvisions}`)
  terms.push('Work not listed under Scope of work is not included. Changes are priced and signed before they start.')

  const references = s.references.map((r) => {
    const d = fmtDocDate(r.versionDate)
    if (r.kind === 'compliance') return d ? `${r.name}; expires ${d}` : r.name
    if (r.kind === 'setting') return `${r.name}, as published on the sub portal`
    return d ? `${r.name}, v. ${d}` : r.name
  })
  if (f.msaSignedOn) references.push(`Master Subcontract Agreement, signed ${fmtDocDate(f.msaSignedOn)}`)

  const subLines: string[] = []
  if (f.subCompany) subLines.push(f.subCompany)
  subLines.push(f.msaSignedOn ? `Master Subcontract Agreement signed ${fmtDocDate(f.msaSignedOn)}` : 'Master Subcontract Agreement: not yet on file')

  const projectLines: string[] = []
  if (f.jobAddress) projectLines.push(f.jobAddress)
  const jobBits = [f.jobLabel ? `Job ${f.jobLabel}` : null, f.trade, f.customerName ? `for ${f.customerName}` : null].filter(Boolean) as string[]
  if (jobBits.length) projectLines.push(jobBits.join(' · '))

  const signedOn = c.signed_at ?? c.accepted_at
  const signed = c.status === 'accepted' || c.status === 'approved' || c.status === 'settled'

  return {
    recordId: workOrderRecordLabel(c.record_id ?? f.recordId),
    issuedOn: fmtDocDate(f.issuedOn ?? c.offered_at),
    companyName: input.issuer.companyName,
    companyLine: input.issuer.companyLine,
    contractor: { name: input.issuer.companyName, lines: [input.issuer.address, input.issuer.phone].filter(Boolean) as string[] },
    subcontractor: { name: c.display_name, lines: subLines },
    project: { name: s.sheetLabel ?? f.jobLabel ?? 'Job', lines: projectLines },
    amountLabel: amount != null ? money(amount) : 'Not priced yet',
    retainageLabel: retainage > 0 ? `${retainage}% retainage` : null,
    windowLabel,
    expiresLabel: expires,
    sections: [
      { key: 'scope', title: 'Scope of work', items: s.lines.map((l) => l.label) },
      { key: 'exclusions', title: 'Exclusions', items: s.exclusions },
      { key: 'terms', title: 'Terms', items: terms },
      { key: 'references', title: 'Incorporated by reference', items: references },
      { key: 'acknowledgements', title: 'Confirmed at signing', items: s.acknowledgements },
    ].filter((sec) => sec.items.length > 0) as WorkOrderDocumentSection[],
    signatures: {
      issuer: { name: f.issuerName, title: f.issuerTitle, on: fmtDocDate(f.issuedOn ?? c.offered_at) },
      sub: {
        name: signed ? (c.signer_printed_name ?? c.display_name) : null,
        company: f.subCompany,
        on: signed ? fmtDocDate(signedOn) : null,
        via: signed ? (c.signed_at ? `signed on the sub portal${c.signer_signature_mode === 'draw' ? ' (drawn signature on file)' : ''}` : 'accepted; recorded by the office') : null,
      },
    },
    footer: `Record ${workOrderRecordLabel(c.record_id ?? f.recordId)} · generated from the job, the scope library, and the Contract Book. Edits change this work order only.`,
  }
}

const esc = (v: string) => v.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

/** One HTML rendering for print / PDF / the portal record. Inline styles only; light paper by design. */
export function renderWorkOrderDocumentHtml(doc: WorkOrderDocument): string {
  const party = (label: string, p: WorkOrderDocumentParty) =>
    `<div><div style="font:600 9.5px/1.3 -apple-system,Segoe UI,Roboto,sans-serif;letter-spacing:.08em;text-transform:uppercase;color:#555">${esc(label)}</div><div style="font-weight:600">${esc(p.name)}</div>${p.lines.map((l) => `<div>${esc(l)}</div>`).join('')}</div>`
  const section = (sec: WorkOrderDocumentSection, n: number) =>
    `<h3 style="font:600 10px/1.3 -apple-system,Segoe UI,Roboto,sans-serif;letter-spacing:.1em;text-transform:uppercase;color:#1e3b6b;margin:14px 0 4px">${n}. ${esc(sec.title)}</h3><ol style="margin:0;padding-left:20px">${sec.items.map((i) => `<li style="margin:0 0 3px">${sec.key === 'acknowledgements' ? '&#9744; ' : ''}${esc(i)}</li>`).join('')}</ol>`
  const sig = (title: string, name: string | null, sub: string | null, on: string | null, cursive: boolean) =>
    `<div><div style="border-bottom:1px solid #1b1b1b;height:34px;position:relative">${name && cursive ? `<span style="position:absolute;left:4px;bottom:2px;font-family:'Great Vibes',cursive;font-size:24px;color:#1e3b6b">${esc(name)}</span>` : ''}</div><div style="font-size:11px;margin-top:3px">${esc(title)}${name ? ` · ${esc(name)}` : ''}${sub ? ` · ${esc(sub)}` : ''}${on ? ` · ${esc(on)}` : ''}</div></div>`
  return `<!doctype html><html><head><meta charset="utf-8"><title>${esc(doc.recordId)} · Work order</title>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Great+Vibes&display=swap">
<style>@page{margin:18mm}body{margin:0;background:#fff;color:#1b1b1b;font:12.5px/1.45 Georgia,'Times New Roman',serif}.wrap{max-width:720px;margin:0 auto;padding:24px}@media print{.wrap{padding:0}}</style></head><body><div class="wrap">
<div style="display:flex;justify-content:space-between;align-items:flex-start;border-bottom:2px solid #1e3b6b;padding-bottom:8px;margin-bottom:12px">
  <div style="font:700 14px/1.2 -apple-system,Segoe UI,Roboto,sans-serif;letter-spacing:.04em">${esc(doc.companyName)}${doc.companyLine ? `<div style="font-weight:400;font-size:10px;color:#555;letter-spacing:0">${esc(doc.companyLine)}</div>` : ''}</div>
  <div style="text-align:right;font:11px/1.3 -apple-system,Segoe UI,Roboto,sans-serif">WORK ORDER<div style="font-size:14px;font-weight:700">${esc(doc.recordId)}</div>${doc.issuedOn ? esc(doc.issuedOn) : ''}</div>
</div>
<div style="display:grid;grid-template-columns:1fr 1fr;gap:10px 16px;font-size:11.5px">
  ${party('Contractor', doc.contractor)}
  ${party('Subcontractor', doc.subcontractor)}
  ${party('Project', doc.project)}
  <div><div style="font:600 9.5px/1.3 -apple-system,Segoe UI,Roboto,sans-serif;letter-spacing:.08em;text-transform:uppercase;color:#555">Subcontract amount</div><div style="font:700 15px/1.3 -apple-system,Segoe UI,Roboto,sans-serif">${esc(doc.amountLabel)}</div><div>${[doc.retainageLabel, doc.windowLabel ? `window ${doc.windowLabel}` : null].filter(Boolean).map((x) => esc(x as string)).join(' · ')}</div></div>
</div>
${doc.sections.map((s, i) => section(s, i + 1)).join('')}
<div style="display:grid;grid-template-columns:1fr 1fr;gap:20px;margin-top:22px">
  ${sig(doc.contractor.name, doc.signatures.issuer.name, doc.signatures.issuer.title, doc.signatures.issuer.on, true)}
  ${sig(doc.subcontractor.name, doc.signatures.sub.name, doc.signatures.sub.company, doc.signatures.sub.on, true)}
</div>
${doc.signatures.sub.via ? `<div style="font:10px/1.4 -apple-system,Segoe UI,Roboto,sans-serif;color:#555;margin-top:4px">${esc(doc.signatures.sub.via)}</div>` : `<div style="font:10px/1.4 -apple-system,Segoe UI,Roboto,sans-serif;color:#555;margin-top:4px">The Subcontractor signs on their portal.</div>`}
<div style="font:9.5px/1.4 -apple-system,Segoe UI,Roboto,sans-serif;color:#666;margin-top:14px;border-top:1px solid #ddd;padding-top:6px">${esc(doc.footer)}</div>
</div></body></html>`
}

/** A bid's takeoff, condensed into scope lines per stage ("Rough In · 22 fixtures: 4 WC, 6 Lav, …"). */
export function bidScopeLines(rows: Array<{ fixture: string; count: number; group_tag: string | null }>): Array<{ stage: string; label: string }> {
  const STAGE_LABEL: Record<string, string> = { rough_in: 'Rough In', top_out: 'Top Out', trim_set: 'Trim Set' }
  const byStage = new Map<string, Map<string, number>>()
  for (const r of rows) {
    const tag = (r.group_tag ?? '').trim().toLowerCase().replace(/[\s-]+/g, '_')
    const stage = STAGE_LABEL[tag] ?? ((r.group_tag ?? '').trim() || 'All stages')
    const fixture = r.fixture.trim()
    if (!fixture || !(Number(r.count) > 0)) continue
    const m = byStage.get(stage) ?? new Map<string, number>()
    m.set(fixture, (m.get(fixture) ?? 0) + Number(r.count))
    byStage.set(stage, m)
  }
  const order = ['Rough In', 'Top Out', 'Trim Set']
  return [...byStage.entries()]
    .sort((a, b) => {
      const ia = order.indexOf(a[0])
      const ib = order.indexOf(b[0])
      return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib) || a[0].localeCompare(b[0])
    })
    .map(([stage, fixtures]) => {
      const total = [...fixtures.values()].reduce((s, n) => s + n, 0)
      const parts = [...fixtures.entries()].sort((a, b) => b[1] - a[1]).map(([f, n]) => `${n} ${f}`)
      const shown = parts.slice(0, 8)
      const rest = parts.length - shown.length
      return { stage, label: `${stage} · ${total} fixture${total === 1 ? '' : 's'}: ${shown.join(', ')}${rest > 0 ? `, +${rest} more` : ''}` }
    })
}

/** The bid's sub-labor line per stage and in total, from cost_estimate_subcontractor_rows. */
export function bidSubLaborTotals(rows: Array<{ rough_in: number | null; top_out: number | null; trim_set: number | null }>): { rough_in: number; top_out: number; trim_set: number; total: number } {
  const sum = (k: 'rough_in' | 'top_out' | 'trim_set') => Math.round(rows.reduce((s, r) => s + (Number(r[k]) || 0), 0) * 100) / 100
  const rough_in = sum('rough_in')
  const top_out = sum('top_out')
  const trim_set = sum('trim_set')
  return { rough_in, top_out, trim_set, total: Math.round((rough_in + top_out + trim_set) * 100) / 100 }
}
