import { useState } from 'react'
import { GC_COMPANY, portalLink, portalMessages, weekdayDate, type GcState, type Partner, type PortalMessage } from '../../lib/gcMode/gcModel'
import { Btn } from './gcUi'

/**
 * GC mode design spike: how a company arrives. What we sent it, as it lands in its inbox: the
 * invitation (an email and the same news by text), reminders, new plan sets, bid tabs. Every one
 * carries the same link, and the link opens the company's home. Newest first; the newest is open.
 */

const RULE = '#d9d2c3'

export function GcPortalMessages({ state, partner, onOpenPortal }: { state: GcState; partner: Partner; onOpenPortal: () => void }) {
  const messages = portalMessages(state, partner.id)
  const [openKey, setOpenKey] = useState<string | null>(messages[0]?.key ?? null)

  return (
    <div style={{ display: 'grid', gap: '0.6rem' }}>
      <div style={{ fontSize: '0.85rem', opacity: 0.8 }}>
        What {GC_COMPANY.name} sent {partner.company}, newest first. Every message carries the same link.
      </div>
      {messages.length === 0 && <div style={{ fontSize: '0.9rem' }}>Nothing sent yet.</div>}
      {messages.map((m) =>
        m.key === openKey ? (
          <Message key={m.key} m={m} partner={partner} onOpenPortal={onOpenPortal} />
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
              {GC_COMPANY.name} · {weekdayDate(m.on)}
            </span>
            <span style={{ fontWeight: 600 }}>{m.subject}</span>
          </button>
        ),
      )}
    </div>
  )
}

function Message({ m, partner, onOpenPortal }: { m: PortalMessage; partner: Partner; onOpenPortal: () => void }) {
  return (
    <div style={{ display: 'grid', gap: '0.5rem' }}>
      <article style={{ background: 'var(--surface)', border: `1px solid ${RULE}`, borderRadius: 8, overflow: 'hidden' }}>
        <div style={{ padding: '0.55rem 0.75rem', borderBottom: `1px solid ${RULE}`, fontSize: '0.78rem', display: 'grid', gap: '0.1rem' }}>
          <span>
            <strong>{GC_COMPANY.name}</strong> <span style={{ opacity: 0.7 }}>· {weekdayDate(m.on)}</span>
          </span>
          <span style={{ opacity: 0.7 }}>To {partner.contact}, {partner.company}</span>
          <span style={{ fontSize: '0.95rem', fontWeight: 700, marginTop: '0.2rem' }}>{m.subject}</span>
        </div>
        <div style={{ padding: '0.7rem 0.75rem', display: 'grid', gap: '0.5rem', fontSize: '0.9rem', lineHeight: 1.45 }}>
          {m.lines.map((line) => (
            <div key={line}>{line}</div>
          ))}
          {m.scope && (
            <ul style={{ margin: 0, paddingLeft: '1.2rem', display: 'grid', gap: '0.15rem' }}>
              {m.scope.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          )}
          <div style={{ display: 'grid', gap: '0.25rem', justifyItems: 'start', marginTop: '0.2rem' }}>
            <Btn kind="primary" onClick={onOpenPortal}>
              Open your portal
            </Btn>
            <span style={{ fontSize: '0.75rem', opacity: 0.65 }}>{portalLink(partner.id)}</span>
          </div>
          <div style={{ fontSize: '0.8rem', opacity: 0.75 }}>
            This link is yours. It holds every job you have with us. There is no password.
          </div>
          <div>Thank you,<br />{GC_COMPANY.name}</div>
        </div>
      </article>

      {m.text && (
        <div style={{ display: 'grid', gap: '0.25rem' }}>
          <div style={{ fontSize: '0.72rem', letterSpacing: '0.06em', textTransform: 'uppercase', opacity: 0.7 }}>The same, by text</div>
          <div
            style={{
              justifySelf: 'start',
              maxWidth: '85%',
              padding: '0.55rem 0.75rem',
              borderRadius: '16px 16px 16px 4px',
              background: 'var(--bg-muted)',
              fontSize: '0.88rem',
              lineHeight: 1.4,
            }}
          >
            {m.text}
          </div>
        </div>
      )}
    </div>
  )
}
