import { useState, type CSSProperties } from 'react'
import { createPortal } from 'react-dom'
import { courtesyEmailText, courtesyGreeting, courtesyOwnerSubject, courtesySendButton, courtesySubject, courtesyTextBody, type CourtesyFacts } from '../../lib/jobs/lienCourtesyNotice'
import type { CourtesyRecipient } from '../../lib/jobs/lienCourtesyIo'
import { formatYmdMonthDay } from '../../lib/jobs/billedExpectedPay'

/**
 * The courtesy notice's send window (punch list #231, PR 2), over the Lien desk's sent footer: who
 * gets it and by which channel, each held one with its reason; the words as the GC gets them, with
 * the greeting as the one line the office may change; the text and the owner's copy folded under;
 * one counted button that says what it will do. Nothing is sent until it is pressed. The words
 * are the kernel's (`lienCourtesyNotice.ts`), so the preview is the send.
 */

const lab: CSSProperties = { fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase' }
const input: CSSProperties = { font: 'inherit', padding: '4px 8px', border: '1px solid var(--border-strong)', borderRadius: 6, background: 'var(--surface)', color: 'inherit', fontSize: '0.8125rem' }
const btn = (kind: 'primary' | 'plain', disabled = false): CSSProperties => ({ padding: '5px 12px', borderRadius: 7, border: `1px solid ${kind === 'plain' ? 'var(--border-strong)' : 'transparent'}`, background: kind === 'primary' ? (disabled ? 'var(--surface)' : '#2563eb') : 'var(--surface)', color: kind === 'primary' ? (disabled ? 'var(--text-muted)' : '#fff') : 'var(--text-700)', fontSize: '0.8125rem', fontWeight: 600, cursor: disabled ? 'default' : 'pointer', opacity: disabled ? 0.7 : 1 })
const chip = (tone: 'green' | 'grey'): CSSProperties => ({ display: 'inline-block', padding: '0 7px', borderRadius: 5, fontSize: '0.72rem', fontWeight: 700, lineHeight: '18px', border: '1px solid', background: tone === 'green' ? 'var(--bg-green-tint)' : 'var(--bg-subtle)', color: tone === 'green' ? 'var(--text-green-800)' : 'var(--text-muted)', borderColor: tone === 'green' ? 'var(--text-green-800)' : 'var(--border-strong)' })
const pre: CSSProperties = { whiteSpace: 'pre-wrap', fontFamily: 'inherit', fontSize: '0.8125rem', lineHeight: 1.5, margin: 0, padding: '0.6rem 0.8rem', border: '1px solid var(--border)', borderRadius: 8, background: 'var(--surface)', color: 'var(--text-700)' }

const WHO: Record<CourtesyRecipient['who'], string> = { original_contractor: 'the GC', owner: 'the owner of record · a copy' }

export default function LienCourtesyWindow({ jobLabel, facts, recipients, busy, onSend, onClose }: { jobLabel: string; facts: CourtesyFacts; /** Null while the addresses are being found. */ recipients: CourtesyRecipient[] | null; busy: boolean; onSend: (greeting: string) => void; onClose: () => void }) {
  const [greeting, setGreeting] = useState(() => courtesyGreeting(recipients?.find((r) => r.who === 'original_contractor')?.name || facts.gcName))
  const [showText, setShowText] = useState(false)
  const [showOwner, setShowOwner] = useState(false)
  const plans = recipients ?? []
  const button = courtesySendButton(plans)
  const dead = busy || recipients === null || button.dead
  const emailText = courtesyEmailText(facts, 'original_contractor', greeting)

  // Over the desk's own backdrop (the portal keeps React's parent): a click outside closes this window only (v2.4352's rule).
  return createPortal(
    <div className="lienMonthDialogScrim" onClick={(e) => { e.stopPropagation(); onClose() }}>
      <div role="dialog" aria-modal="true" aria-label={`Courtesy notice · ${jobLabel}`} className="lienMonthDialog" style={{ maxWidth: 720, width: 'calc(100vw - 2rem)', maxHeight: 'min(calc(100vh - 2rem), 100%)', overflowY: 'auto', padding: 0 }} onClick={(e) => e.stopPropagation()} data-lien-courtesy-window>
        <div className="lienMonthDialogHead" style={{ margin: 0, padding: '0.7rem 1rem 0.5rem', borderBottom: '1px solid var(--border)', position: 'sticky', top: 0, background: 'var(--surface)', zIndex: 1 }}>
          <div>
            <div style={{ fontWeight: 700 }}>Courtesy notice · {jobLabel}</div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Nothing is sent until you press the button at the foot. The lien's day is {formatYmdMonthDay(facts.lienDay)}, from the affidavit's own clock.</div>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="lienMonthDialogClose">×</button>
        </div>
        <div style={{ display: 'grid', gap: '0.9rem', padding: '0.8rem 1rem 1rem' }}>
          <div>
            <div style={lab}>Who gets it</div>
            {recipients === null ? (
              <div style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', marginTop: 4 }} data-lien-courtesy-finding>Finding their addresses…</div>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8125rem', marginTop: 4 }}>
                <thead>
                  <tr style={{ color: 'var(--text-muted)', fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    <th style={{ textAlign: 'left', padding: '2px 6px', borderBottom: '1px solid var(--border)' }}>Who</th>
                    <th style={{ textAlign: 'left', padding: '2px 6px', borderBottom: '1px solid var(--border)' }}>Email</th>
                    <th style={{ textAlign: 'left', padding: '2px 6px', borderBottom: '1px solid var(--border)' }}>Text</th>
                  </tr>
                </thead>
                <tbody>
                  {recipients.map((r) => (
                    <tr key={r.who} data-lien-courtesy-recipient={r.who}>
                      <td style={{ padding: '6px', borderBottom: '1px dotted var(--border)', verticalAlign: 'top' }}><strong>{r.name || WHO[r.who]}</strong><div style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>{WHO[r.who]}</div></td>
                      <td style={{ padding: '6px', borderBottom: '1px dotted var(--border)', verticalAlign: 'top' }}>{r.email.goes ? <><span style={chip('green')}>goes</span> <span>{r.email.address}</span></> : <><span style={chip('grey')}>no</span> <span style={{ color: 'var(--text-muted)' }}>{r.email.reason}</span></>}</td>
                      <td style={{ padding: '6px', borderBottom: '1px dotted var(--border)', verticalAlign: 'top' }}>{r.text.goes ? <><span style={chip('green')}>goes</span> <span>{r.text.address}</span></> : <><span style={chip('grey')}>no</span> <span style={{ color: 'var(--text-muted)' }}>{r.text.reason}</span></>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
          <div>
            <div style={lab}>The words, as the GC gets them</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, margin: '4px 0 6px', fontSize: '0.8125rem' }}>
              <label htmlFor="lien-courtesy-greeting" style={{ color: 'var(--text-muted)' }}>Greeting, the one line you may change:</label>
              <input id="lien-courtesy-greeting" value={greeting} onChange={(e) => setGreeting(e.target.value)} style={{ ...input, flex: '1 1 160px' }} data-lien-courtesy-greeting />
            </div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: 4 }}>Subject: <strong style={{ color: 'var(--text-700)' }}>{courtesySubject(facts)}</strong></div>
            <pre style={pre} data-lien-courtesy-email-text>{emailText}</pre>
          </div>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', fontSize: '0.8125rem' }}>
            <button type="button" className="lienFootLink" onClick={() => setShowText((o) => !o)} aria-expanded={showText} data-lien-courtesy-show-text>{showText ? 'Hide the text' : 'The text, as it goes ›'}</button>
            <button type="button" className="lienFootLink" onClick={() => setShowOwner((o) => !o)} aria-expanded={showOwner} data-lien-courtesy-show-owner>{showOwner ? "Hide the owner's copy" : "The owner's copy ›"}</button>
          </div>
          {showText ? <pre style={pre} data-lien-courtesy-text-body>{courtesyTextBody(facts, 'original_contractor')}</pre> : null}
          {showOwner ? (
            <div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: 4 }}>Subject: <strong style={{ color: 'var(--text-700)' }}>{courtesyOwnerSubject(facts)}</strong></div>
              <pre style={pre} data-lien-courtesy-owner-text>{courtesyEmailText(facts, 'owner', '')}</pre>
            </div>
          ) : null}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', padding: '0.6rem 1rem 0.8rem', borderTop: '1px solid var(--border)', background: 'var(--bg-subtle)', position: 'sticky', bottom: 0 }}>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', flex: '1 1 240px' }} data-lien-courtesy-detail>{recipients === null ? 'Finding their addresses…' : button.detail}. The record names who pressed, each address and the lien day it carried. Replies go to the office.</span>
          <button type="button" onClick={onClose} style={btn('plain')} disabled={busy}>Cancel</button>
          <button type="button" onClick={() => onSend(greeting)} disabled={dead} style={btn('primary', dead)} data-lien-courtesy-send>{busy ? 'Sending…' : `${button.label} ▸`}</button>
        </div>
      </div>
    </div>,
    document.body,
  )
}
