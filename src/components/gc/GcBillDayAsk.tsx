import { useState } from 'react'
import { useMatchMedia } from '../../hooks/useMatchMedia'
import { smsHref } from '../../lib/gc/followUpSheet'
import { Btn } from './gcUi'

/**
 * Messages, cut 9 (wave 2, helper 7): Bill day's asks, each its own text. The words are `asks.ts`'s. Until the phone link
 * (cut 5), a text goes from your own phone: on a phone **Draft text** opens Messages with it filled in, and on a desk
 * **Copy** takes it. Cut 5 puts the company number's send behind the same press.
 */
export interface BillDayAskText {
  key: string
  /** Who it goes to, as the row names them. */
  to: string
  /** Their mobile on file. Null: none, so it can only be copied. */
  phone: string | null
  text: string
  /** Why it cannot go yet, when it cannot. */
  held?: string
}

export function GcBillDayAsk({ title, texts, onClose }: { title: string; texts: BillDayAskText[]; onClose: () => void }) {
  const phone = useMatchMedia('(max-width: 760px)')
  const [copied, setCopied] = useState<string | null>(null)
  const copy = (t: BillDayAskText) => {
    void navigator.clipboard?.writeText(t.text).then(
      () => setCopied(t.key),
      () => setCopied(null),
    )
  }
  return (
    <section aria-label={title} data-bill-day-ask style={{ border: '1px solid var(--border)', borderRadius: 8, padding: '0.6rem 0.75rem', display: 'grid', gap: '0.6rem', background: 'var(--bg-subtle)' }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.5rem', flexWrap: 'wrap' }}>
        <strong style={{ fontSize: '0.9rem' }}>{title}</strong>
        <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>Each is its own text. It goes from your phone until the company number is linked.</span>
        <span style={{ flex: 1 }} />
        <Btn kind="quiet" onClick={onClose}>
          Close
        </Btn>
      </div>
      {texts.map((t) => (
        <div key={t.key} data-bill-day-text={t.key} style={{ display: 'grid', gap: '0.3rem' }}>
          <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
            To {t.to}
            {t.phone ? ` · ${t.phone}` : ' · no mobile on file'}
          </div>
          <div style={{ whiteSpace: 'pre-wrap', fontSize: '0.875rem', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 6, padding: '0.45rem 0.6rem' }}>{t.text}</div>
          {t.held ? (
            <div style={{ fontSize: '0.8rem', color: 'var(--text-amber-800)' }}>{t.held}</div>
          ) : (
            <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center', flexWrap: 'wrap' }}>
              {phone && t.phone && (
                <a href={smsHref(t.phone, t.text)} style={{ fontSize: '0.875rem', fontWeight: 600 }}>
                  Draft text
                </a>
              )}
              <Btn kind="quiet" onClick={() => copy(t)}>
                {copied === t.key ? 'Copied' : 'Copy'}
              </Btn>
            </div>
          )}
        </div>
      ))}
    </section>
  )
}
