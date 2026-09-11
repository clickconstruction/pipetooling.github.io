/**
 * Printable account packet (Legal desk PR 1): the five sections and the gap
 * list as one light-themed HTML document for openHtmlPrintWindow. Customer /
 * print surfaces pin light — every color is literal on purpose.
 */
import { formatLegalMoney, type LegalPacket } from './legalPacket'

function esc(s: string | null | undefined): string {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function row(cells: string[], opts: { num?: boolean[] } = {}): string {
  return `<tr>${cells.map((c, i) => `<td${opts.num?.[i] ? ' class="num"' : ''}>${c}</td>`).join('')}</tr>`
}

function table(head: string[], rows: string[], empty: string): string {
  if (rows.length === 0) return `<p class="muted">${esc(empty)}</p>`
  return `<table><thead><tr>${head.map((h) => `<th>${esc(h)}</th>`).join('')}</tr></thead><tbody>${rows.join('')}</tbody></table>`
}

export function buildLegalPacketPrintHtml(packet: LegalPacket, opts: { preparedOn: string; companyName: string }): string {
  const a = packet.account
  const jobsRows = a.jobs.map((j) =>
    row(
      [esc(j.label), esc(j.name), esc(j.address), j.agingDays == null ? '—' : `${j.agingDays}d`, j.contract.kind === 'signed' ? 'signed' : j.contract.kind === 'sent' ? 'sent, unsigned' : 'none', formatLegalMoney(j.balance)],
      { num: [false, false, false, true, false, true] },
    ),
  )
  const ledgerRows = a.ledger.map((e) => row([esc(e.ymd ?? '—'), esc(e.text), formatLegalMoney(e.amount)], { num: [false, false, true] }))
  const demandRows = packet.paper.demandLetters.map((d) =>
    row([esc(d.jobLabel), esc(d.sentYmd ?? 'not sent'), esc(d.method), esc(d.tracking || '—'), `${esc(d.deadlineYmd ?? '—')}${d.deadlinePassed ? ' (passed)' : ''}`, formatLegalMoney(d.amount)], { num: [false, false, false, false, false, true] }),
  )
  const filingRows = packet.paper.lienFilings.map((f) =>
    row([esc(f.jobLabel), esc(f.kind), esc(f.monthsCovered.join(', ') || '—'), esc(f.filedYmd ?? '—'), esc(f.servedYmd ?? '—'), esc(f.county || '—'), esc(f.recordingNumber || '—')]),
  )
  const agreementRows = packet.paper.agreements.map((g) => {
    const c = g.coverage
    const text =
      c.kind === 'signed'
        ? `Signed${c.signedAt ? ` ${c.signedAt.slice(0, 10)}` : ''}${c.signerName ? ` by ${c.signerName}` : ''} · ${c.source}`
        : c.kind === 'sent'
          ? `Sent ${c.sentAt.slice(0, 10)} · viewed ${c.viewCount}× · never signed`
          : 'Draft'
    return row([esc(g.jobLabel), esc(text)])
  })
  const promiseRows = packet.theirWord.promises.map((p) =>
    row([esc(p.createdAt.slice(0, 10)), esc(p.jobLabel), esc(p.promisedYmd), esc(p.saidBy ?? (p.source === 'customer' ? 'the customer (portal)' : '—')), esc(p.channel ?? '—'), esc(p.state)]),
  )
  const touchRows = packet.theirWord.touches.map((t) => row([esc(t.createdAt.slice(0, 10)), esc(t.jobLabel ?? 'account'), esc(t.outcome), esc(t.note ?? '—'), esc(t.by)]))
  const evidenceRows = packet.evidence.map((e) =>
    row([esc(e.jobLabel), `${e.reports} (${e.reportsWithGps} with GPS)`, `${e.sessions} (${e.approvedSessions} approved, ${e.sessionsWithGps} with GPS)`, `${e.hours}h`, `${esc(e.firstWorkYmd ?? '—')} → ${esc(e.lastWorkYmd ?? '—')}`, String(e.threadNotes)]),
  )
  const propertyRows = a.properties.map((p) => row([esc(p.address), esc(p.county || '—'), esc(p.owner || '—'), esc(p.legalDescription || '—'), esc(p.parcelId || '—'), p.gaps.length ? `missing ${esc(p.gaps.join(', '))}` : 'complete']))
  const stepRows = packet.feesAndSteps.steps.map((s) => row([esc(s.ymd ?? '—'), esc(s.jobLabel ?? ''), esc(s.kind), esc(s.text)]))
  const gapItems = packet.gaps.map((g) => `<li class="${g.severity}"><b>${esc(g.label)}</b> — ${esc(g.detail)}</li>`).join('')
  const exhibitItems = packet.exhibits.map((x) => `<li><b>${x.letter}</b> ${esc(x.title)} <span class="muted">(${x.count})</span></li>`).join('')

  return `<!doctype html><html><head><meta charset="utf-8"><title>Account packet · ${esc(a.payer.name)}</title>
<style>
  @page { margin: 0.6in; }
  body { font: 12px/1.45 -apple-system, 'Segoe UI', Roboto, sans-serif; color: #16283c; background: #fff; margin: 0; padding: 24px; }
  h1 { font-size: 20px; margin: 0 0 2px; }
  h2 { font-size: 13px; letter-spacing: .06em; text-transform: uppercase; color: #5a6b7e; border-bottom: 2px solid #b0662f; padding-bottom: 4px; margin: 22px 0 8px; page-break-after: avoid; }
  h3 { font-size: 12px; margin: 12px 0 4px; color: #16283c; }
  .head { display: flex; justify-content: space-between; align-items: flex-end; border-bottom: 1px solid #ddd6c8; padding-bottom: 8px; }
  .head .co { font-weight: 700; }
  .muted { color: #8a97a6; }
  .totals { display: flex; gap: 24px; margin: 10px 0; }
  .totals div b { display: block; font-size: 16px; }
  table { width: 100%; border-collapse: collapse; font-size: 11px; margin: 4px 0 8px; page-break-inside: auto; }
  th { text-align: left; font-size: 10px; letter-spacing: .05em; text-transform: uppercase; color: #8a97a6; border-bottom: 1px solid #ddd6c8; padding: 4px 6px; }
  td { padding: 4px 6px; border-bottom: 1px solid #eee8dc; vertical-align: top; }
  td.num { text-align: right; font-variant-numeric: tabular-nums; white-space: nowrap; }
  ul { padding-left: 18px; margin: 4px 0; }
  li.stop { color: #b42318; }
  li.warn { color: #7a5a00; }
  .note { background: #f1ece2; padding: 6px 8px; border-radius: 3px; font-style: italic; }
</style></head><body>
<div class="head">
  <div><div class="co">${esc(opts.companyName)}</div><div class="muted">Account packet · prepared ${esc(opts.preparedOn)} · for review before release to counsel</div></div>
  <div style="text-align:right"><h1>${esc(a.payer.name)}</h1><div class="muted">${esc(a.customerAddress || a.jobs[0]?.address || '')}</div></div>
</div>
<div class="totals">
  <div><span class="muted">Balance</span><b>${formatLegalMoney(a.totals.balance)}</b></div>
  <div><span class="muted">Billed</span><b>${formatLegalMoney(a.totals.billed)}</b></div>
  <div><span class="muted">Paid</span><b>${formatLegalMoney(a.totals.paid)}</b></div>
  <div><span class="muted">Oldest</span><b>${a.totals.oldestDays == null ? '—' : `${a.totals.oldestDays}d`}</b></div>
  <div><span class="muted">Terms</span><b style="font-size:12px">${esc(a.paymentTerms)}</b></div>
</div>

<h2>Before release · ${esc(packet.readiness.label)}</h2>
${packet.gaps.length ? `<ul>${gapItems}</ul>` : '<p class="muted">No gaps found.</p>'}

<h2>Exhibits</h2>
${packet.exhibits.length ? `<ul>${exhibitItems}</ul>` : '<p class="muted">Nothing to letter yet.</p>'}

<h2>Account</h2>
<h3>Who owes</h3>
<p>${esc(a.payer.name)}${a.payer.viaGc ? ' (general contractor on the job)' : ''}${a.customerAddress ? ` · ${esc(a.customerAddress)}` : ''}<br>
Emails: ${a.emails.length ? esc(a.emails.join(', ')) : '<span class="muted">none on file</span>'} · Phones: ${a.phones.length ? esc(a.phones.join(', ')) : '<span class="muted">none on file</span>'}</p>
${a.contacts.length ? table(['Contact', 'Email', 'Phone', 'Note'], a.contacts.map((c) => row([esc(c.name), esc(c.email ?? '—'), esc(c.phone ?? '—'), esc(c.note ?? '')])), '') : ''}
<h3>Jobs in this account</h3>
${table(['Job', 'Name', 'Address', 'Age', 'Agreement', 'Balance'], jobsRows, 'No jobs.')}
<h3>Invoices and payments</h3>
${table(['Date', 'Entry', 'Amount'], ledgerRows, 'No billed lines or payments recorded.')}
<h3>Property record</h3>
${table(['Address', 'County', 'Owner of record', 'Legal description', 'Parcel', 'Status'], propertyRows, 'No property record on the customer.')}

<h2>Paper</h2>
<h3>Agreements</h3>
${table(['Job', 'Status'], agreementRows, 'No agreement on file for any job in this account.')}
<h3>Final demand letters</h3>
${table(['Job', 'Sent', 'Method', 'Tracking', 'Deadline', 'Amount'], demandRows, 'No demand letter recorded.')}
<h3>Lien notices and filings</h3>
${table(['Job', 'Instrument', 'Months', 'Filed', 'Served', 'County', 'Recording no.'], filingRows, 'No lien instrument recorded.')}

<h2>Their word</h2>
${packet.theirWord.collectionsNotes.map((n) => `<p class="note">${esc(n.jobLabel)} · ${esc(n.note)}${n.by ? ` — ${esc(n.by)}` : ''}${n.ymd ? `, ${esc(n.ymd)}` : ''}</p>`).join('')}
<p>Promises: ${packet.theirWord.decided ? `kept ${packet.theirWord.kept} of ${packet.theirWord.decided}` : 'none decided yet'}${packet.theirWord.broken ? ` · ${packet.theirWord.broken} broken` : ''}</p>
${table(['Recorded', 'Job', 'Promised by', 'Who said it', 'How', 'Outcome'], promiseRows, 'No payment promise on record.')}
<h3>Collection calls</h3>
${table(['Date', 'Job', 'Outcome', 'Note', 'By'], touchRows, 'No collection call logged.')}

<h2>Evidence</h2>
${table(['Job', 'Field reports', 'Clock sessions', 'Hours', 'Worked', 'Thread notes'], evidenceRows, 'No jobs.')}

<h2>Fees &amp; steps</h2>
<p class="muted">No attorney fees or costs yet — a firm has not been assigned.</p>
${table(['Date', 'Job', 'Step', 'What happened'], stepRows, 'No steps recorded.')}
</body></html>`
}
