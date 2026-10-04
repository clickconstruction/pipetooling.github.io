import { useState, type Dispatch, type ReactNode } from 'react'
import { aYearFrom, GC_COMPANY, pDate, portalInsurance, type GcAction, type Partner, type PortalKey } from '../../lib/gcMode/gcModel'
import { Btn, Chip, input } from './gcUi'
import { GcPortalAgreement } from './GcPortalAgreement'
import { PortalBlock, PortalNote } from './GcPortalUi'
import { usePortalLang } from './gcPortalLang'

/**
 * GC mode design spike: a company's paperwork with us, in its portal. The master agreement once,
 * then insurance and a W-9 kept current. Each line is done here by the company, never by the
 * office for them: Get started waits on all three.
 */

export type PaperworkLine = 'msa' | 'coi' | 'w9'

export function GcPortalPaperwork({
  partner,
  today,
  dispatch,
  startOpen = null,
}: {
  partner: Partner
  today: string
  dispatch: Dispatch<GcAction>
  /** Open on one line's form or agreement, when the company came here from "Needs you". */
  startOpen?: PaperworkLine | null
}) {
  const { lang, t } = usePortalLang()
  const [open, setOpen] = useState<PaperworkLine | null>(startOpen)
  const coi = portalInsurance(partner, today, lang)
  const gc = GC_COMPANY.shortName

  return (
    <PortalBlock title={t('paperTitle', { gc })}>
      <div style={{ display: 'grid', gap: '0.5rem', fontSize: '0.9rem' }}>
        <Line label={t('masterAgreement')}>
          {partner.msa === 'signed' && <Chip tone="green">{t('signedOn', { date: pDate(lang, partner.msaSignedOn) })}</Chip>}
          {partner.msa === 'sent' && (
            <Btn kind="primary" onClick={() => setOpen('msa')}>
              {t('readSign')}
            </Btn>
          )}
          {partner.msa === 'none' && <Chip tone="grey">{t('msaWhenPicked', { gc })}</Chip>}
        </Line>

        <Line label={t('insuranceCert')}>
          <Chip tone={coi.soon ? 'amber' : coi.done ? 'green' : 'red'}>{coi.words}</Chip>
          {open !== 'coi' && (
            <Btn kind={coi.done && !coi.soon ? 'quiet' : 'primary'} onClick={() => setOpen('coi')}>
              {t(coi.done ? 'sendNewer' : 'sendCert')}
            </Btn>
          )}
        </Line>
        {open === 'coi' && <CoiForm partner={partner} today={today} dispatch={dispatch} onDone={() => setOpen(null)} />}

        <Line label={t('w9')}>
          <Chip tone={partner.w9 ? 'green' : 'red'}>{t(partner.w9 ? 'onFile' : 'noneOnFile')}</Chip>
          {!partner.w9 && open !== 'w9' && (
            <Btn kind="primary" onClick={() => setOpen('w9')}>
              {t('fillW9')}
            </Btn>
          )}
        </Line>
        {open === 'w9' && <W9Form partner={partner} dispatch={dispatch} onDone={() => setOpen(null)} />}

        <div style={{ fontSize: '0.8rem', opacity: 0.75 }}>
          {t('msaOnce')}
        </div>
      </div>
      {open === 'msa' && <GcPortalAgreement partner={partner} onClose={() => setOpen(null)} dispatch={dispatch} />}
    </PortalBlock>
  )
}

function Line({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
      <span style={{ minWidth: '9.5rem' }}>{label}</span>
      {children}
    </div>
  )
}

function CoiForm({ partner, today, dispatch, onDone }: { partner: Partner; today: string; dispatch: Dispatch<GcAction>; onDone: () => void }) {
  const { t } = usePortalLang()
  const [file, setFile] = useState('')
  const [expires, setExpires] = useState(aYearFrom(today))
  const ok = expires > today
  return (
    <PortalNote tone="paper">
      <label style={{ display: 'grid', gap: '0.2rem' }}>
        {t('certFile')}
        {/* A bare file input will not shrink below about 300px, wider than a phone's form. */}
        <input
          type="file"
          accept="image/*,application/pdf"
          onChange={(e) => setFile(e.target.files?.[0]?.name ?? '')}
          style={{ width: '100%', minWidth: 0, fontSize: '0.85rem' }}
        />
      </label>
      <label style={{ display: 'grid', gap: '0.2rem' }}>
        {t('certExpires')}
        <input type="date" min={today} value={expires} onChange={(e) => setExpires(e.target.value)} style={{ ...input, width: '11rem' }} />
      </label>
      <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
        <Btn
          kind="primary"
          disabled={!ok}
          onClick={() => {
            dispatch({ type: 'tradeUploadCoi', partnerId: partner.id, expires })
            onDone()
          }}
        >
          {t('sendTo', { gc: GC_COMPANY.shortName })}
        </Btn>
        <Btn kind="quiet" onClick={onDone}>{t('notNow')}</Btn>
        {file === '' && <span style={{ fontSize: '0.78rem', opacity: 0.7 }}>{t('protoNoFile')}</span>}
      </div>
    </PortalNote>
  )
}

const TAX_CLASSES: PortalKey[] = ['taxLlc', 'taxCorp', 'taxSole', 'taxPartner']

function W9Form({ partner, dispatch, onDone }: { partner: Partner; dispatch: Dispatch<GcAction>; onDone: () => void }) {
  const { t } = usePortalLang()
  const [name, setName] = useState(partner.company)
  const [taxClass, setTaxClass] = useState<PortalKey>('taxLlc')
  const [taxId, setTaxId] = useState('')
  const [certify, setCertify] = useState(false)
  const ready = name.trim() !== '' && taxId.replace(/\D/g, '').length === 9 && certify
  return (
    <PortalNote tone="paper">
      <label style={{ display: 'grid', gap: '0.2rem' }}>
        {t('w9Name')}
        <input style={input} value={name} onChange={(e) => setName(e.target.value)} />
      </label>
      <label style={{ display: 'grid', gap: '0.2rem' }}>
        {t('w9Kind')}
        <select style={input} value={taxClass} onChange={(e) => setTaxClass(e.target.value as PortalKey)}>
          {TAX_CLASSES.map((c) => (
            <option key={c} value={c}>
              {t(c)}
            </option>
          ))}
        </select>
      </label>
      <label style={{ display: 'grid', gap: '0.2rem' }}>
        {t('w9Tax')}
        <input style={{ ...input, width: '11rem' }} inputMode="numeric" placeholder="12-3456789" value={taxId} onChange={(e) => setTaxId(e.target.value)} />
      </label>
      <label style={{ display: 'flex', gap: '0.45rem', alignItems: 'center' }}>
        <input type="checkbox" checked={certify} onChange={(e) => setCertify(e.target.checked)} />
        {t('w9Certify')}
      </label>
      <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
        <Btn
          kind="primary"
          disabled={!ready}
          onClick={() => {
            dispatch({ type: 'tradeSignW9', partnerId: partner.id })
            onDone()
          }}
        >
          {t('signW9')}
        </Btn>
        <Btn kind="quiet" onClick={onDone}>{t('notNow')}</Btn>
      </div>
    </PortalNote>
  )
}
