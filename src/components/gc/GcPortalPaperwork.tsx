import { useState, type Dispatch, type ReactNode } from 'react'
import { aYearFrom, GC_COMPANY, portalInsurance, shortDate, type GcAction, type Partner } from '../../lib/gcMode/gcModel'
import { Btn, Chip, input } from './gcUi'
import { GcPortalAgreement } from './GcPortalAgreement'
import { PortalBlock, PortalNote } from './GcPortalUi'

/**
 * GC mode design spike: a company's paperwork with us, in its portal. The master agreement once,
 * then insurance and a W-9 kept current. Each line is done here by the company, never by the
 * office for them: Get started waits on all three.
 */

export function GcPortalPaperwork({ partner, today, dispatch }: { partner: Partner; today: string; dispatch: Dispatch<GcAction> }) {
  const [open, setOpen] = useState<'msa' | 'coi' | 'w9' | null>(null)
  const coi = portalInsurance(partner, today)
  const gc = GC_COMPANY.shortName

  return (
    <PortalBlock title={`Your paperwork with ${gc}`}>
      <div style={{ display: 'grid', gap: '0.5rem', fontSize: '0.9rem' }}>
        <Line label="Master agreement">
          {partner.msa === 'signed' && <Chip tone="green">signed {shortDate(partner.msaSignedOn)}</Chip>}
          {partner.msa === 'sent' && (
            <Btn kind="primary" onClick={() => setOpen('msa')}>
              Read and sign
            </Btn>
          )}
          {partner.msa === 'none' && <Chip tone="grey">{gc} sends it when they pick your number</Chip>}
        </Line>

        <Line label="Insurance certificate">
          <Chip tone={coi.done ? 'green' : 'red'}>{coi.words}</Chip>
          {open !== 'coi' && (
            <Btn kind={coi.done ? 'quiet' : 'primary'} onClick={() => setOpen('coi')}>
              {coi.done ? 'Send a newer one' : 'Send your certificate'}
            </Btn>
          )}
        </Line>
        {open === 'coi' && <CoiForm partner={partner} today={today} dispatch={dispatch} onDone={() => setOpen(null)} />}

        <Line label="W-9">
          <Chip tone={partner.w9 ? 'green' : 'red'}>{partner.w9 ? 'on file' : 'none on file'}</Chip>
          {!partner.w9 && open !== 'w9' && (
            <Btn kind="primary" onClick={() => setOpen('w9')}>
              Fill in your W-9
            </Btn>
          )}
        </Line>
        {open === 'w9' && <W9Form partner={partner} dispatch={dispatch} onDone={() => setOpen(null)} />}

        <div style={{ fontSize: '0.8rem', opacity: 0.75 }}>
          You sign the master agreement once. Each job after that is a short statement of work.
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
  const [file, setFile] = useState('')
  const [expires, setExpires] = useState(aYearFrom(today))
  const ok = expires > today
  return (
    <PortalNote tone="paper">
      <label style={{ display: 'grid', gap: '0.2rem' }}>
        A photo or PDF of the certificate
        <input type="file" accept="image/*,application/pdf" onChange={(e) => setFile(e.target.files?.[0]?.name ?? '')} />
      </label>
      <label style={{ display: 'grid', gap: '0.2rem' }}>
        The day the policy runs out
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
          Send it to {GC_COMPANY.shortName}
        </Btn>
        <Btn kind="quiet" onClick={onDone}>Not now</Btn>
        {file === '' && <span style={{ fontSize: '0.78rem', opacity: 0.7 }}>Prototype: sending works without a file.</span>}
      </div>
    </PortalNote>
  )
}

const TAX_CLASSES = ['LLC', 'Corporation', 'Sole owner', 'Partnership']

function W9Form({ partner, dispatch, onDone }: { partner: Partner; dispatch: Dispatch<GcAction>; onDone: () => void }) {
  const [name, setName] = useState(partner.company)
  const [taxClass, setTaxClass] = useState(TAX_CLASSES[0] ?? '')
  const [taxId, setTaxId] = useState('')
  const [certify, setCertify] = useState(false)
  const ready = name.trim() !== '' && taxId.replace(/\D/g, '').length === 9 && certify
  return (
    <PortalNote tone="paper">
      <label style={{ display: 'grid', gap: '0.2rem' }}>
        Business name, as on your taxes
        <input style={input} value={name} onChange={(e) => setName(e.target.value)} />
      </label>
      <label style={{ display: 'grid', gap: '0.2rem' }}>
        What kind of business
        <select style={input} value={taxClass} onChange={(e) => setTaxClass(e.target.value)}>
          {TAX_CLASSES.map((c) => (
            <option key={c}>{c}</option>
          ))}
        </select>
      </label>
      <label style={{ display: 'grid', gap: '0.2rem' }}>
        Tax ID number, nine digits
        <input style={{ ...input, width: '11rem' }} inputMode="numeric" placeholder="12-3456789" value={taxId} onChange={(e) => setTaxId(e.target.value)} />
      </label>
      <label style={{ display: 'flex', gap: '0.45rem', alignItems: 'center' }}>
        <input type="checkbox" checked={certify} onChange={(e) => setCertify(e.target.checked)} />
        I certify this W-9 is true.
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
          Sign the W-9
        </Btn>
        <Btn kind="quiet" onClick={onDone}>Not now</Btn>
      </div>
    </PortalNote>
  )
}
