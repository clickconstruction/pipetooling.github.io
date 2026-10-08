import { useEffect, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { partnerWork } from '../../lib/gc/companyFile'
import { companyPeople, mailGroupName } from '../../lib/gc/companyPeople'
import { declineReasonWords, partnerDeclines } from '../../lib/gc/decline'
import { telHref } from '../../lib/gc/followUpSheet'
import type { PortalLang } from '../../lib/gc/portalI18n'
import { insuranceRenewalWords, insuranceRenewals } from '../../lib/gc/promises'
import { answerRecord, type AnswerRecord } from '../../lib/gc/reliability'
import type { GcState, Partner } from '../../lib/gc/types'
import { vettingOf } from '../../lib/gc/vetting'
import { money, shortDate } from '../../lib/gc/words'
import { Chip, Stat, type Tone } from './gcUi'
import { VettingChip } from './GcTradePartners'

/**
 * GC mode, the real build (the Board's B3-c): a trade company's window, from the design spike's
 * `GcCompanyWindow.tsx`. About is what decides whether to ask or award them: how they answer, their
 * vetting and insurance, who at the company gets which emails, their work with us and the times they
 * passed. The office sets the company's language here. Activity, Documents and Their portal come as
 * their kernels land, so this window is About alone for now.
 */

const RECORD: Record<AnswerRecord, { tone: Tone; word: string }> = {
  new: { tone: 'grey', word: 'new to us' },
  reliable: { tone: 'green', word: 'answers' },
  mixed: { tone: 'amber', word: 'hit or miss' },
  silent: { tone: 'red', word: 'often silent' },
}

const link = { background: 'none', border: 'none', padding: 0, font: 'inherit', color: 'var(--text-link)', cursor: 'pointer', textDecoration: 'underline', textUnderlineOffset: 3 } as const

function Heading({ children }: { children: ReactNode }) {
  return <h3 style={{ margin: '0 0 0.4rem', fontSize: '0.95rem' }}>{children}</h3>
}

export function GcCompanyWindow({
  state,
  partner,
  lang,
  onLanguage,
  onClose,
  onOpenProject,
}: {
  state: GcState
  partner: Partner
  /** The language the company chose. */
  lang: PortalLang
  /** Set the company's language: its portal opens in it and its emails go out in it. */
  onLanguage: (lang: PortalLang) => Promise<void>
  onClose: () => void
  onOpenProject: (projectId: string) => void
}) {
  const [problem, setProblem] = useState<string | null>(null)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])
  const record = RECORD[answerRecord(partner)]
  return createPortal(
    <div
      onClick={onClose}
      style={{ position: 'fixed', inset: 0, background: 'rgba(15, 23, 42, 0.55)', zIndex: 1200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 'calc(0.75rem + var(--app-top-chrome, 0px)) 0.75rem 0.75rem' }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={partner.company}
        onClick={(e) => e.stopPropagation()}
        style={{ background: 'var(--surface)', color: 'var(--text-base)', borderRadius: 10, width: 'min(760px, 100%)', maxHeight: 'min(92vh, 100%)', display: 'flex', flexDirection: 'column', overflow: 'hidden', border: '1px solid var(--border-strong)' }}
      >
        <div style={{ padding: '0.8rem 1rem', borderBottom: '1px solid var(--border)', display: 'grid', gap: '0.3rem' }}>
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
            <strong style={{ fontSize: '1.1rem' }}>{partner.company}</strong>
            <VettingChip partner={partner} />
            <Chip tone={record.tone}>{record.word}</Chip>
            <span style={{ flex: 1 }} />
            <button type="button" onClick={onClose} aria-label="Close" style={{ border: 'none', background: 'transparent', fontSize: '1.3rem', lineHeight: 1, cursor: 'pointer', color: 'var(--text-muted)', padding: '0.2rem 0.4rem' }}>
              ×
            </button>
          </div>
          <div style={{ color: 'var(--text-muted)', fontSize: '0.875rem', display: 'flex', gap: '0.3rem 0.6rem', flexWrap: 'wrap', alignItems: 'center' }}>
            <span>{partner.trades.join(', ')}</span>
            <span>{partner.contact || 'no contact yet'}</span>
            {partner.phone && (
              <a href={telHref(partner.phone)} style={{ color: 'var(--text-link)' }}>
                {partner.phone}
              </a>
            )}
            {partner.email ? (
              <a href={`mailto:${partner.email}`} style={{ color: 'var(--text-link)', overflowWrap: 'anywhere' }}>
                {partner.email}
              </a>
            ) : (
              <Chip tone="red">no email on file</Chip>
            )}
            <label style={{ display: 'inline-flex', gap: '0.3rem', alignItems: 'center', color: 'var(--text-600)' }} title="Their portal opens in it, and our emails to them go out in it.">
              Language
              <select
                value={lang}
                onChange={(e) => {
                  setProblem(null)
                  onLanguage(e.target.value === 'es' ? 'es' : 'en').catch((err: unknown) => setProblem(err instanceof Error ? err.message : 'That did not save.'))
                }}
                aria-label={`Language for ${partner.company}`}
                style={{ fontSize: '0.85rem', padding: '0.05rem 0.2rem', border: '1px solid var(--border)', borderRadius: 4, background: 'var(--surface)', color: 'inherit' }}
              >
                <option value="en">English</option>
                <option value="es">Español</option>
              </select>
            </label>
          </div>
          {problem && <div style={{ color: 'var(--text-red-700)', fontSize: '0.85rem' }}>{problem}</div>}
        </div>
        <div style={{ padding: '1rem', overflowY: 'auto', minHeight: 0 }}>
          <About state={state} partner={partner} onOpenProject={onOpenProject} />
        </div>
      </div>
    </div>,
    document.body,
  )
}

/** What decides whether to ask them or award them: their record, their papers, and their money with us. */
function About({ state, partner, onOpenProject }: { state: GcState; partner: Partner; onOpenProject: (projectId: string) => void }) {
  const work = partnerWork(state, partner)
  const declines = partnerDeclines(state, partner.id)
  const renewal = insuranceRenewals(state).find((r) => r.partner.id === partner.id)
  const vetting = vettingOf(partner)
  const lines: { label: string; text: string }[] = [
    { label: 'Quotes', text: partner.invited === 0 ? 'never asked yet' : `quoted ${partner.bids} of ${partner.invited} asks` },
    {
      label: 'Vetting',
      text:
        vetting.status === 'approved'
          ? vetting.decidedBy
            ? `approved by ${vetting.decidedBy}${vetting.decidedOn ? ` ${shortDate(vetting.decidedOn)}` : ''}${vetting.limit ? `, up to ${money(vetting.limit)} on one award` : ''}`
            : 'a company we know'
          : vetting.status === 'declined'
            ? `declined${vetting.note ? `: ${vetting.note}` : ''}`
            : `not vetted yet${vetting.form ? '. Their form is in.' : '. Their form is not in yet.'}`,
    },
    {
      label: 'Drives from',
      text: partner.address || partner.base ? `${partner.address || partner.base}${partner.maxMiles === null ? '' : `, up to ${partner.maxMiles} mi`}` : 'address not set',
    },
    ...(renewal ? [{ label: 'Insurance', text: insuranceRenewalWords(renewal) }] : []),
  ]
  return (
    <div style={{ display: 'grid', gap: '1rem' }}>
      {work.jobs.length > 0 && (
        <div style={{ display: 'flex', gap: '2rem', flexWrap: 'wrap' }}>
          <Stat label="Jobs with us" value={work.jobs.length} />
          <Stat label="Under contract" value={money(work.underContract)} />
          <Stat label="Paid to them" value={money(work.paid)} />
          {work.approved > 0 && <Stat label="Approved, not paid" value={money(work.approved)} />}
          <Stat label="We are holding" value={money(work.held)} />
        </div>
      )}
      <dl style={{ margin: 0, display: 'grid', gridTemplateColumns: 'minmax(7rem, auto) minmax(0, 1fr)', gap: '0.4rem 1rem', fontSize: '0.9rem' }}>
        {lines.map((l) => (
          <div key={l.label} style={{ display: 'contents' }}>
            <dt style={{ color: 'var(--text-muted)' }}>{l.label}</dt>
            <dd style={{ margin: 0 }}>{l.text}</dd>
          </div>
        ))}
      </dl>
      <People partner={partner} />
      {work.jobs.length > 0 && (
        <section>
          <Heading>Their work with us</Heading>
          <div style={{ display: 'grid', gap: '0.3rem', fontSize: '0.9rem' }}>
            {work.jobs.map((j) => (
              <div key={j.pkg.id}>
                <button type="button" onClick={() => onOpenProject(j.project.id)} style={link}>
                  {j.project.name}
                </button>{' '}
                · {j.pkg.trade} · {money(j.price)} · {j.signed ? 'statement of work signed' : 'statement of work not signed'}
              </div>
            ))}
          </div>
        </section>
      )}
      {declines.length > 0 && (
        <section>
          <Heading>Times they passed</Heading>
          <div style={{ display: 'grid', gap: '0.3rem', fontSize: '0.9rem' }}>
            {declines.map((d) => (
              <div key={d.invite.id}>
                <span style={{ color: 'var(--text-muted)' }}>
                  {shortDate(d.invite.declineReason?.on ?? null)} · {d.project.name} · {d.pkg.trade}:
                </span>{' '}
                {d.invite.declineReason ? declineReasonWords(d.invite.declineReason) : 'passed'}
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  )
}

/** Who gets our emails: the main contact first, then everyone the company named in its portal. */
function People({ partner }: { partner: Partner }) {
  const people = companyPeople(partner)
  return (
    <section data-gc-company-people={partner.id}>
      <Heading>Who gets our emails</Heading>
      <div style={{ display: 'grid', gap: '0.4rem', fontSize: '0.9rem' }}>
        {people.map((p) => (
          <div key={`${p.main ? 'main' : 'p'}:${p.name}`} style={{ display: 'flex', gap: '0.15rem 0.5rem', flexWrap: 'wrap', alignItems: 'baseline' }}>
            <strong style={{ fontWeight: 600 }}>{p.name}</strong>
            {p.role && <span style={{ color: 'var(--text-muted)' }}>{p.role}</span>}
            {/* Never the prototype's made-up address: a contact with none says so. */}
            {p.madeUp ? (
              <Chip tone="red">no email on file</Chip>
            ) : (
              <a href={`mailto:${p.email}`} style={{ color: 'var(--text-link)', overflowWrap: 'anywhere' }}>
                {p.email}
              </a>
            )}
            <span style={{ display: 'flex', gap: '0.3rem', flexWrap: 'wrap' }}>
              {p.gets.length === 0 ? (
                <Chip tone="grey">no emails</Chip>
              ) : (
                p.gets.map((g) => (
                  <Chip key={g} tone="grey">
                    {mailGroupName(g)}
                  </Chip>
                ))
              )}
            </span>
          </div>
        ))}
      </div>
      <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem', marginTop: '0.3rem' }}>
        {people.length === 1 ? 'They can name others in their portal, like a bookkeeper for pay.' : 'They set this in their portal.'}
      </div>
    </section>
  )
}
