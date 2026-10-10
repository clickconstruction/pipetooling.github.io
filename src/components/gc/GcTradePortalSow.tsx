import { useState } from 'react'
import { ContractAcceptSignatureForm } from '../contracts/ContractAcceptSignatureForm'
import { esignConsentText } from '../../lib/esignConsent'
import { GC_COMPANY } from '../../lib/gc/company'
import { planLabel } from '../../lib/gc/lookups'
import { portalSowExcluded } from '../../lib/gc/portal'
import { pDate } from '../../lib/gc/portalI18n'
import type { GcProject, TradePackage } from '../../lib/gc/types'
import { money } from '../../lib/gc/words'
import { Chip } from './gcUi'
import { usePortalLang } from './gcTradePortalLang'
import { usePortalPress, usePress } from './gcTradePortalPress'
import { PortalBlock } from './GcTradePortalUi'

/**
 * GC mode, the trade partner portal (P2c-ii, to-dos/gc-mode/mockups/portal-p2c.md): the company's statement of work on
 * its own job, the sign part of the design spike's `SowBlock` (`GcTradePortal.tsx`). A draft says the office is writing
 * it. A sent one shows the price, the lines and what it will and will not do, then `/contract/accept`'s form in the
 * company's words, its button Sign the statement of work (`sign_sow`). A signed one reads its day. Until the Board's
 * B6-b-ii reads the papers, the button shows and the verb refuses a company with no signed master agreement in
 * msaFirst's words. The report and the draws on a signed one come with Building's U6 and the Portal's P5c.
 */

const GC = GC_COMPANY.shortName

export function GcTradePortalSow({ project, pkg }: { project: GcProject; pkg: TradePackage }) {
  const { lang, t } = usePortalLang()
  const press = usePortalPress()
  const sow = pkg.sow
  if (!sow) return null
  if (sow.status === 'draft') return <PortalBlock title={t('gotJobTitle', { trade: pkg.trade })}>{t('sowDraft', { gc: GC })}</PortalBlock>
  // The scope lines their awarded quote covers, for "What you will do".
  const awarded = pkg.invites.find((i) => i.id === pkg.awardedInviteId)
  const willDo = pkg.scope.filter((item) => awarded?.bid?.includes[item.id] !== 'no').map((item) => item.label)
  const willNot = portalSowExcluded(sow, lang)
  return (
    // A to-do about signing lands here.
    <div data-portal-anchor={`sow:${pkg.id}`} style={{ scrollMarginTop: '0.5rem' }}>
      <PortalBlock title={t('sowTitle', { trade: pkg.trade })}>
        <div style={{ display: 'grid', gap: '0.35rem', fontSize: '0.9rem' }}>
          <div>
            <strong>{money(sow.price)}</strong> · {t('sowLine', { pct: sow.retainagePct, plans: planLabel(project, sow.basedOnRev) })}
          </div>
          {sow.sov.length > 0 && <div style={{ opacity: 0.8 }}>{sow.sov.map((l) => `${l.label} ${money(l.amount)}`).join(' · ')}</div>}
          {/* What the contract says they will and will not do (owner, 2026-10-04, exclusions by company). */}
          {willNot.length > 0 && (
            <div style={{ display: 'grid', gap: '0.2rem' }}>
              <div>
                <strong>{t('sowWillDo')}</strong> <span style={{ opacity: 0.85 }}>{willDo.join(' · ')}</span>
              </div>
              <strong>{t('sowWillNot')}</strong>
              <ul style={{ margin: 0, paddingLeft: '1.2rem', display: 'grid', gap: '0.1rem' }}>
                {willNot.map((line) => (
                  <li key={line}>{line}</li>
                ))}
              </ul>
            </div>
          )}
          {sow.status === 'signed' ? (
            <div>
              <Chip tone="green">{t('signedOn', { date: pDate(lang, sow.signedOn) })}</Chip>
            </div>
          ) : (
            press && sow.id && <SignSow sowId={sow.id} />
          )}
        </div>
      </PortalBlock>
    </div>
  )
}

/**
 * `/contract/accept`'s form in the company's words: a name, typed or drawn, and the e-sign consent. One press; the page
 * reads the slice again when it went through, and the block then reads signed. A refusal shows under the form.
 */
function SignSow({ sowId }: { sowId: string }) {
  const { lang, t } = usePortalLang()
  const { busy, problem, run } = usePress()
  const [name, setName] = useState('')
  const [agreed, setAgreed] = useState(false)
  return (
    <ContractAcceptSignatureForm
      printedName={name}
      agreed={agreed}
      onPrintedNameChange={setName}
      onAgreedChange={setAgreed}
      formError={problem}
      submitting={busy}
      onSubmit={(p) =>
        void run('sign_sow', {
          sowId,
          printedName: p.printedName,
          ...(p.mode === 'draw' ? { signaturePngBase64: p.signaturePngBase64 } : {}),
          ...(p.consent ? { esignConsent: p.consent } : {}),
        })
      }
      heading={t('readSign')}
      disclosure={t('sowSignLead')}
      consent={esignConsentText({ audience: 'sub', lang, documentNoun: t('sowConsentNoun') })}
      agreeLabel={t('sowSignAgree')}
      submitLabel={t('signSow')}
      lang={lang}
    />
  )
}
