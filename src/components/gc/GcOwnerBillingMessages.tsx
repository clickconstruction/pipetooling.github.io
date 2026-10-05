import { useState } from 'react'
import { customerMessageParties, customerMessages, weekdayDate, type CustomerMessage, type GcProject, type GcState } from '../../lib/gcMode/gcModel'

/** The portal's paper look: it stays light in both themes, as the customer's portal does. */
const RULE = '#d9d2c3'

/**
 * GC mode design spike: every email the customer gets on this job, as it lands in their inbox
 * (owner's go-ahead 2026-10-04), the way the trade's Their messages shows its own. Newest first; the
 * newest is open. Nothing is sent from the prototype.
 */
export function GcOwnerBillingMessages({ state, project }: { state: GcState; project: GcProject }) {
  const messages = customerMessages(state, project)
  const parties = customerMessageParties(state, project)
  const [openKey, setOpenKey] = useState<string | null>(messages[0]?.key ?? null)

  return (
    <div style={{ display: 'grid', gap: '0.6rem' }}>
      <div style={{ fontSize: '0.85rem', opacity: 0.8 }}>
        Every email {parties.from} sends {project.owner} about {project.name}, as they get it. Nothing goes out from here.
      </div>
      {messages.length === 0 && <div style={{ fontSize: '0.9rem' }}>Nothing has gone to them yet.</div>}
      {messages.map((m) =>
        m.key === openKey ? (
          <Message key={m.key} m={m} from={parties.from} to={parties.to} />
        ) : (
          <button
            key={m.key}
            type="button"
            onClick={() => setOpenKey(m.key)}
            style={{
              display: 'grid',
              gap: '0.15rem',
              textAlign: 'left',
              width: '100%',
              padding: '0.55rem 0.7rem',
              background: 'var(--surface)',
              border: `1px solid ${RULE}`,
              borderRadius: 8,
              color: 'inherit',
              cursor: 'pointer',
              fontSize: '0.88rem',
            }}
          >
            <span style={{ fontSize: '0.75rem', opacity: 0.7 }}>
              {parties.from} · {weekdayDate(m.on)}
            </span>
            <span style={{ fontWeight: 600 }}>{m.subject}</span>
          </button>
        ),
      )}
    </div>
  )
}

function Message({ m, from, to }: { m: CustomerMessage; from: string; to: string }) {
  return (
    <article style={{ background: 'var(--surface)', border: `1px solid ${RULE}`, borderRadius: 8, overflow: 'hidden' }}>
      <div style={{ padding: '0.55rem 0.75rem', borderBottom: `1px solid ${RULE}`, fontSize: '0.78rem', display: 'grid', gap: '0.1rem' }}>
        <span>
          <strong>{from}</strong> <span style={{ opacity: 0.7 }}>· {weekdayDate(m.on)}</span>
        </span>
        <span style={{ opacity: 0.7 }}>To {to}</span>
        <span style={{ fontSize: '0.95rem', fontWeight: 700, marginTop: '0.2rem' }}>{m.subject}</span>
      </div>
      <div style={{ padding: '0.7rem 0.75rem', display: 'grid', gap: '0.5rem', fontSize: '0.9rem', lineHeight: 1.45 }}>
        {m.lines.map((line, i) => (
          <div key={`${i}-${line}`}>{line}</div>
        ))}
      </div>
    </article>
  )
}
