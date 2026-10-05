import { useState } from 'react'
import { GC_COMPANY, portalLink, portalMessages, pWeekday, type GcState, type Partner, type PortalMessage } from '../../lib/gcMode/gcModel'
import { Btn } from './gcUi'
import { usePortalLang } from './gcPortalLang'

/**
 * GC mode design spike: how a company arrives. What we sent it, as it lands in its inbox: the
 * invitation (an email and the same news by text), reminders, new plan sets, bid tabs. Every one
 * carries the same link, and the link opens the company's home. Newest first; the newest is open.
 */

const RULE = '#d9d2c3'

export function GcPortalMessages({ state, partner, onOpenPortal }: { state: GcState; partner: Partner; onOpenPortal: () => void }) {
  const { lang, t } = usePortalLang()
  const messages = portalMessages(state, partner.id, lang)
  const [openKey, setOpenKey] = useState<string | null>(messages[0]?.key ?? null)

  return (
    <div style={{ display: 'grid', gap: '0.6rem' }}>
      <div style={{ fontSize: '0.85rem', opacity: 0.8 }}>
        {t('messagesIntro', { gc: GC_COMPANY.name, company: partner.company })}
      </div>
      {messages.length === 0 && <div style={{ fontSize: '0.9rem' }}>{t('nothingSent')}</div>}
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
              {GC_COMPANY.name} · {pWeekday(lang, m.on)}
            </span>
            <span style={{ fontWeight: 600 }}>{m.subject}</span>
          </button>
        ),
      )}
    </div>
  )
}

function Message({ m, partner, onOpenPortal }: { m: PortalMessage; partner: Partner; onOpenPortal: () => void }) {
  const { lang, t } = usePortalLang()
  return (
    <div style={{ display: 'grid', gap: '0.5rem' }}>
      <article style={{ background: 'var(--surface)', border: `1px solid ${RULE}`, borderRadius: 8, overflow: 'hidden' }}>
        <div style={{ padding: '0.55rem 0.75rem', borderBottom: `1px solid ${RULE}`, fontSize: '0.78rem', display: 'grid', gap: '0.1rem' }}>
          <span>
            <strong>{GC_COMPANY.name}</strong> <span style={{ opacity: 0.7 }}>· {pWeekday(lang, m.on)}</span>
          </span>
          <span style={{ opacity: 0.7 }}>{t('toLine', { contact: (m.to ?? [partner.contact]).join(', '), company: partner.company })}</span>
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
          {m.leavesOut && (
            <>
              <div>{t('mInviteLeavesOut')}</div>
              <ul style={{ margin: 0, paddingLeft: '1.2rem', display: 'grid', gap: '0.15rem' }}>
                {m.leavesOut.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </>
          )}
          <div style={{ display: 'grid', gap: '0.25rem', justifyItems: 'start', marginTop: '0.2rem' }}>
            <Btn kind="primary" onClick={onOpenPortal}>
              {t('openPortal')}
            </Btn>
            <span style={{ fontSize: '0.75rem', opacity: 0.65 }}>{portalLink(partner.id)}</span>
          </div>
          <div style={{ fontSize: '0.8rem', opacity: 0.75 }}>
            {t('linkYours')}
          </div>
          <div>
            {t('thanks')}
            <br />
            {GC_COMPANY.name}
          </div>
        </div>
      </article>
    </div>
  )
}
