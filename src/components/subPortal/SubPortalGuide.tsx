/**
 * The sub portal's help guide (v2.2922): a copper-edged card at the very
 * bottom of the statement — "How do I get paid?" — that opens a bottom sheet
 * on phones and a dialog on desktop. Bottom line first, then the four steps
 * with the same dots the job cards use (a walking dot cycles through them),
 * the one button, new work offers, documents, deductions and what's coming.
 * Light by construction, like the page; no data, no writes.
 */
import { useEffect, useState } from 'react'
import { CARD, COPPER, FAINT, HAIR, INK, MUTED, NOTE_BAND, PAPER, PAPER_GREEN } from '../../lib/portal/portalTheme'
import { subPortalGuide } from '../../lib/subPortal/subPortalGuideStrings'
import { subPortalT, type SubPortalLang } from '../../lib/subPortal/subPortalI18n'

const BLUE = '#1d4e89'
const BLUE_TINT = '#e7effa'
const COPPER_TINT = '#f6e6d8'

/** The pill a job card wears when its job (or its bid) has plans online. */
export function PlansPill({ href, label }: { href: string; label: string }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      onClick={(e) => e.stopPropagation()}
      style={{ display: 'inline-flex', alignItems: 'center', gap: 5, border: `1px solid ${HAIR}`, background: CARD, color: BLUE, borderRadius: 999, padding: '2px 9px', fontSize: 11, fontWeight: 700, textDecoration: 'none', whiteSpace: 'nowrap' }}
    >
      <span aria-hidden>📐</span>
      {label}
    </a>
  )
}

export function SubPortalGuideButton({ lang, onOpen }: { lang: SubPortalLang; onOpen: () => void }) {
  const g = subPortalGuide(lang)
  return (
    <button
      type="button"
      data-screen-only
      onClick={onOpen}
      style={{ width: '100%', marginTop: 26, background: CARD, border: `1.5px solid ${COPPER}`, borderRadius: 10, padding: '0.8rem 0.9rem', display: 'grid', gridTemplateColumns: '38px 1fr auto', gap: 12, alignItems: 'center', textAlign: 'left', cursor: 'pointer', color: INK, font: 'inherit' }}
    >
      <span aria-hidden style={{ width: 38, height: 38, borderRadius: '50%', background: COPPER, color: '#fff', display: 'grid', placeItems: 'center', fontWeight: 900, fontSize: 21, fontFamily: 'Georgia, serif' }}>?</span>
      <span>
        <b style={{ display: 'block', fontSize: 15 }}>{g.button.title}</b>
        <span style={{ fontSize: 12.5, color: MUTED }}>{g.button.sub}</span>
      </span>
      <span aria-hidden style={{ color: COPPER, fontSize: 20 }}>›</span>
    </button>
  )
}

export function SubPortalGuideSheet({ lang, open, onClose, phone }: { lang: SubPortalLang; open: boolean; onClose: () => void; phone: string | null }) {
  const g = subPortalGuide(lang)
  const t = (k: Parameters<typeof subPortalT>[1]) => subPortalT(lang, k)
  const [step, setStep] = useState(0)

  // The walking dot: one step every 2.4 s while the sheet is open.
  useEffect(() => {
    if (!open) return
    setStep(0)
    const reduced = typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (reduced) return
    const id = window.setInterval(() => setStep((s) => (s + 1) % 4), 2400)
    return () => window.clearInterval(id)
  }, [open])
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = prev
    }
  }, [open, onClose])

  if (!open) return null
  const railLabels = [t('railWork'), t('railWalk'), t('railCustomer'), t('railPaid')]
  const lbl = (s: string) => <div style={{ fontSize: 10.5, textTransform: 'uppercase', letterSpacing: '0.08em', color: FAINT, fontWeight: 700, marginTop: 6 }}>{s}</div>
  const h3 = (title: string, sub: string) => (
    <div>
      <h3 style={{ margin: 0, fontFamily: 'Georgia, serif', fontSize: 19, lineHeight: 1.15 }}>{title}</h3>
      <div style={{ fontSize: 12.5, color: MUTED, marginTop: 3 }}>{sub}</div>
    </div>
  )
  const section = (title: string, sub: string, body: React.ReactNode) => (
    <div className="spg-sec">
      {h3(title, sub)}
      <div>{body}</div>
    </div>
  )

  return (
    <div role="presentation" onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 50, background: 'rgba(22,40,60,0.45)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }} data-screen-only>
      <style>{`
        .spg{background:${PAPER};color:${INK};width:100%;max-height:92vh;border-radius:22px 22px 0 0;display:flex;flex-direction:column;overflow:hidden;box-shadow:0 -12px 40px rgba(0,0,0,0.25)}
        @media (min-width:760px){.spg-wrap{align-items:center !important;padding:20px}.spg{max-width:780px;border-radius:16px;max-height:90vh}}
        .spg-body{overflow-y:auto;padding:18px 18px 22px;display:grid;gap:22px}
        .spg-sec{display:grid;grid-template-columns:200px 1fr;gap:16px;align-items:start;padding-top:18px;border-top:1px solid ${HAIR}}
        @media (max-width:640px){.spg-sec{grid-template-columns:1fr}}
        .spg-hero{display:grid;grid-template-columns:1.2fr 1fr;gap:20px;align-items:center}
        @media (max-width:700px){.spg-hero{grid-template-columns:1fr}}
        .spg-cards{display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:12px}
        .spg-rail{display:grid;grid-template-columns:repeat(4,1fr);position:relative;margin:10px 0 4px;z-index:0}
        .spg-rail::before{content:'';position:absolute;left:12.5%;right:12.5%;top:8px;height:2px;background:${HAIR}}
        .spg-st{position:relative;text-align:center;font-size:11px;color:${FAINT};line-height:1.15;padding:0 2px}
        .spg-st i{display:block;width:16px;height:16px;border-radius:50%;background:${CARD};border:2px solid ${HAIR};margin:0 auto 5px;box-sizing:border-box;transition:background .4s,border-color .4s,box-shadow .4s}
        .spg-st.done{color:${PAPER_GREEN}}.spg-st.done i{background:${PAPER_GREEN};border-color:${PAPER_GREEN}}
        .spg-st.now{color:${COPPER};font-weight:700}.spg-st.now i{background:${COPPER};border-color:${COPPER};box-shadow:0 0 0 4px ${COPPER_TINT}}
        .spg-pulse{animation:spg-pulse 2.4s infinite}
        @keyframes spg-pulse{0%,100%{box-shadow:0 0 0 0 rgba(31,122,58,0.5)}50%{box-shadow:0 0 0 8px rgba(31,122,58,0)}}
        @media (prefers-reduced-motion:reduce){.spg-pulse{animation:none}.spg-st i{transition:none}}
      `}</style>
      <div className="spg-wrap" style={{ display: 'flex', width: '100%', justifyContent: 'center', alignItems: 'flex-end', maxHeight: '100vh' }} onClick={onClose}>
        <div className="spg" role="dialog" aria-modal="true" aria-label={g.header} onClick={(e) => e.stopPropagation()}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 18px', borderBottom: `1px solid ${HAIR}`, background: CARD }}>
            <span aria-hidden style={{ fontFamily: 'Georgia, serif', fontWeight: 700, color: COPPER, fontSize: 18 }}>?</span>
            <b style={{ fontSize: 14 }}>{g.header}</b>
            <button type="button" onClick={onClose} aria-label={g.close} style={{ marginLeft: 'auto', background: 'none', border: 'none', fontSize: 20, color: MUTED, cursor: 'pointer' }}>✕</button>
          </div>
          <div className="spg-body">
            <div className="spg-hero">
              <div>
                <div style={{ fontFamily: 'Georgia, serif', fontSize: 30, lineHeight: 1.1, marginBottom: 8 }}>{g.bluf}</div>
                <p style={{ margin: 0, fontSize: 15.5, lineHeight: 1.5 }}>{g.answer}</p>
                <p style={{ margin: '8px 0 0', fontSize: 12.5, color: MUTED }}>{g.answerNote}</p>
              </div>
              <div style={{ background: CARD, border: `1px solid ${HAIR}`, borderRadius: 12, padding: 14 }}>
                <div className="spg-rail" role="list" aria-label={railLabels.join(' → ')}>
                  {railLabels.map((label, i) => (
                    <div key={label} role="listitem" className={`spg-st${i < step ? ' done' : i === step ? ' now' : ''}`}>
                      <i aria-hidden />
                      {label}
                    </div>
                  ))}
                </div>
                <div style={{ fontSize: 12.5, color: MUTED, textAlign: 'center', marginTop: 8, minHeight: 36 }} aria-live="polite">{g.steps[step]!.caption}</div>
              </div>
            </div>

            <div className="spg-cards">
              {g.steps.map((s, i) => (
                <div key={s.title} style={{ background: CARD, border: `1px solid ${HAIR}`, borderRadius: 12, padding: '12px 14px', fontSize: 13, display: 'grid', gap: 4, alignContent: 'start' }}>
                  <span style={{ width: 26, height: 26, borderRadius: '50%', display: 'grid', placeItems: 'center', fontWeight: 700, fontSize: 12, background: COPPER_TINT, color: COPPER }}>{i + 1}</span>
                  <b style={{ fontSize: 15 }}>{s.title}</b>
                  <div style={{ fontStyle: 'italic', color: MUTED, fontSize: 12, borderLeft: `2px solid ${HAIR}`, paddingLeft: 8 }}>“{s.quote}”</div>
                  {s.facts.map((f) => (
                    <div key={f.who}>
                      {lbl(f.who)}
                      <div>
                        {f.text}
                        {i === 0 && f.who === g.steps[0].facts[0]!.who ? (
                          <>
                            {' '}
                            <PlansPill href="#" label={g.plansPill} />
                          </>
                        ) : null}
                      </div>
                    </div>
                  ))}
                  {s.time ? <div style={{ fontSize: 12, color: PAPER_GREEN, fontWeight: 700, marginTop: 4 }}>{s.time}</div> : null}
                </div>
              ))}
            </div>

            {section(
              g.oneButton.title,
              g.oneButton.sub,
              <>
                <p style={{ margin: 0, fontSize: 14 }}>{g.oneButton.body}</p>
                <div style={{ background: CARD, border: `1px solid ${HAIR}`, borderRadius: 10, padding: '12px 14px', marginTop: 10, fontSize: 13 }}>
                  <span className="spg-pulse" style={{ display: 'inline-block', background: PAPER_GREEN, color: '#fff', borderRadius: 6, padding: '6px 12px', fontWeight: 700, fontSize: 13 }}>{t('workDoneButton')}</span>
                  <div style={{ marginTop: 8, color: MUTED, fontSize: 12.5 }}>→ “{g.oneButton.demoTitle}” · <b style={{ color: PAPER_GREEN }}>{g.oneButton.demoConfirm}</b></div>
                </div>
                <p style={{ margin: '8px 0 0', fontSize: 12.5, color: MUTED }}>{g.oneButton.note}</p>
              </>,
            )}

            {section(g.offers.title, g.offers.sub, <p style={{ margin: 0, fontSize: 14 }}>{g.offers.body}</p>)}

            {section(
              g.documents.title,
              g.documents.sub,
              <>
                <p style={{ margin: 0, fontSize: 14 }}>{g.documents.body}</p>
                <div style={{ display: 'grid', gap: 8, marginTop: 10 }}>
                  <div style={{ background: CARD, border: `1px solid ${HAIR}`, borderRadius: 10, padding: '10px 12px', display: 'grid', gridTemplateColumns: '1fr auto', gap: 10, alignItems: 'center', fontSize: 13 }}>
                    <div><b>{g.documents.currentTitle}</b> <span style={{ color: PAPER_GREEN, fontWeight: 700 }}>✓</span><div style={{ fontSize: 12, color: MUTED }}>{g.documents.currentBody}</div></div>
                  </div>
                  <div style={{ background: CARD, border: `1px solid ${COPPER}`, borderRadius: 10, padding: '10px 12px', display: 'grid', gridTemplateColumns: '1fr auto', gap: 10, alignItems: 'center', fontSize: 13 }}>
                    <div><b>{g.documents.lapsedTitle}</b><div style={{ fontSize: 12, color: MUTED }}>{g.documents.lapsedBody}</div></div>
                    <span style={{ background: COPPER, color: '#fff', borderRadius: 6, padding: '5px 10px', fontWeight: 700, fontSize: 12 }}>{g.documents.lapsedButton}</span>
                  </div>
                </div>
              </>,
            )}

            {section(g.deductions.title, g.deductions.sub, <p style={{ margin: 0, fontSize: 14 }}>{g.deductions.body}</p>)}

            {section(
              g.comingSoon.title,
              g.comingSoon.sub,
              <div style={{ display: 'grid', gap: 8 }}>
                {g.comingSoon.items.map((it) => (
                  <div key={it.title} style={{ background: NOTE_BAND, borderRadius: 8, padding: '8px 12px', fontSize: 13 }}>
                    <b>{it.title}</b> <span style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', background: BLUE_TINT, color: BLUE, borderRadius: 999, padding: '2px 8px', verticalAlign: 'middle' }}>{g.comingSoon.tag}</span>
                    <br />
                    {it.body}
                  </div>
                ))}
              </div>,
            )}
          </div>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center', padding: '12px 18px', borderTop: `1px solid ${HAIR}`, background: CARD, fontSize: 13 }}>
            <span style={{ fontWeight: 700 }}>{g.footerCall}{phone ? ` · ${phone}` : ''}</span>
            <button type="button" onClick={onClose} style={{ marginLeft: 'auto', background: INK, color: '#fff', border: 'none', borderRadius: 6, padding: '0.4rem 0.9rem', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>{g.close}</button>
          </div>
        </div>
      </div>
    </div>
  )
}
