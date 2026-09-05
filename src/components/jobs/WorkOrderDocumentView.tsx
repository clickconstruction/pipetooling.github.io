import type { CSSProperties } from 'react'
import type { WorkOrderDocument } from '../../lib/subWorkOrders/workOrderDocument'

/**
 * The assembled work order as the office sees it (Work Orders tab, PR 2 —
 * v2.2819): the same numbered document the print / PDF copy and the portal
 * record render, drawn from the model so the live preview updates as the
 * assembler ticks. Light paper by design (it is a document, like the
 * customer contract preview), pinned via data-theme="light".
 */
const paper: CSSProperties = {
  background: '#fbf9f4',
  color: '#1b1b1b',
  border: '1px solid var(--border)',
  borderRadius: 6,
  padding: '18px 20px',
  fontFamily: 'Georgia, "Times New Roman", serif',
  fontSize: 12.5,
  lineHeight: 1.45,
}
const sans = '-apple-system, "Segoe UI", Roboto, sans-serif'
const label: CSSProperties = { font: `600 9.5px/1.3 ${sans}`, letterSpacing: '.08em', textTransform: 'uppercase', color: '#555' }
const h3: CSSProperties = { font: `600 10px/1.3 ${sans}`, letterSpacing: '.1em', textTransform: 'uppercase', color: '#1e3b6b', margin: '14px 0 4px' }

export function WorkOrderDocumentView({ doc, style }: { doc: WorkOrderDocument; style?: CSSProperties }) {
  const party = (title: string, name: string, lines: string[]) => (
    <div>
      <div style={label}>{title}</div>
      <div style={{ fontWeight: 600 }}>{name}</div>
      {lines.map((l, i) => (
        <div key={i}>{l}</div>
      ))}
    </div>
  )
  const sig = (title: string, name: string | null, sub: string | null, on: string | null) => (
    <div>
      <div style={{ borderBottom: '1px solid #1b1b1b', height: 34, position: 'relative' }}>
        {name ? <span style={{ position: 'absolute', left: 4, bottom: 2, fontFamily: '"Great Vibes", cursive', fontSize: 24, color: '#1e3b6b' }}>{name}</span> : null}
      </div>
      <div style={{ fontSize: 11, marginTop: 3 }}>
        {title}
        {name ? ` · ${name}` : ''}
        {sub ? ` · ${sub}` : ''}
        {on ? ` · ${on}` : ''}
      </div>
    </div>
  )
  return (
    <div data-theme="light" style={{ ...paper, ...style }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '2px solid #1e3b6b', paddingBottom: 8, marginBottom: 12 }}>
        <div style={{ font: `700 14px/1.2 ${sans}`, letterSpacing: '.04em' }}>
          {doc.companyName}
          {doc.companyLine ? <div style={{ fontWeight: 400, fontSize: 10, color: '#555', letterSpacing: 0 }}>{doc.companyLine}</div> : null}
        </div>
        <div style={{ textAlign: 'right', font: `11px/1.3 ${sans}` }}>
          WORK ORDER
          <div style={{ fontSize: 14, fontWeight: 700 }}>{doc.recordId}</div>
          {doc.issuedOn ?? ''}
        </div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px 16px', fontSize: 11.5 }}>
        {party('Contractor', doc.contractor.name, doc.contractor.lines)}
        {party('Subcontractor', doc.subcontractor.name, doc.subcontractor.lines)}
        {party('Project', doc.project.name, doc.project.lines)}
        <div>
          <div style={label}>Subcontract amount</div>
          <div style={{ font: `700 15px/1.3 ${sans}` }}>{doc.amountLabel}</div>
          <div>{[doc.retainageLabel, doc.windowLabel ? `window ${doc.windowLabel}` : null].filter(Boolean).join(' · ')}</div>
        </div>
      </div>
      {doc.sections.map((sec, i) => (
        <div key={sec.key}>
          <h3 style={h3}>
            {i + 1}. {sec.title}
          </h3>
          <ol style={{ margin: 0, paddingLeft: 20 }}>
            {sec.items.map((item, j) => (
              <li key={j} style={{ margin: '0 0 3px' }}>
                {sec.key === 'acknowledgements' ? '☐ ' : ''}
                {item}
              </li>
            ))}
          </ol>
        </div>
      ))}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginTop: 22 }}>
        {sig(doc.contractor.name, doc.signatures.issuer.name, doc.signatures.issuer.title, doc.signatures.issuer.on)}
        {sig(doc.subcontractor.name, doc.signatures.sub.name, doc.signatures.sub.company, doc.signatures.sub.on)}
      </div>
      <div style={{ font: `10px/1.4 ${sans}`, color: '#555', marginTop: 4 }}>{doc.signatures.sub.via ?? 'The Subcontractor signs on their portal.'}</div>
      <div style={{ font: `9.5px/1.4 ${sans}`, color: '#666', marginTop: 14, borderTop: '1px solid #ddd', paddingTop: 6 }}>{doc.footer}</div>
    </div>
  )
}

export default WorkOrderDocumentView
