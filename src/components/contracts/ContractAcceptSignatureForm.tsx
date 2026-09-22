import { useId, useRef, useState, type CSSProperties } from 'react'
import type { EstimateAcceptSubmitPayload } from '../estimates/EstimateAcceptBody'
import { EsignConsentLine } from '../EsignConsentLine'
import { esignConsentPayload, type EsignConsentText } from '../../lib/esignConsent'
import {
  SignatureTypeOrDrawInput,
  type SignatureMode,
  type SignatureTypeOrDrawHandle,
} from './SignatureTypeOrDrawInput'

import { signatureFormStrings, type SignatureFormLang } from '../../lib/signatureFormStrings'
import { SignerNameInput } from './SignerNameInput'
import { resolveSignerName } from '../../lib/signerNameField'

const SIGNATURE_DISCLOSURE = 'By signing, you acknowledge that you have read and agree to this contract.'

export type ContractAcceptSignatureFormProps = {
  printedName: string
  agreed: boolean
  onPrintedNameChange: (value: string) => void
  onAgreedChange: (value: boolean) => void
  formError: string | null
  submitting: boolean
  onSubmit: (payload: EstimateAcceptSubmitPayload) => void
  /** Section heading (default "Accept document") — e.g. "Sign release" on the lien surface (v2.2619). */
  heading?: string
  /** Disclosure paragraph above the agree checkbox (default: the contract wording). */
  disclosure?: string
  /**
   * v2.3100: the ESIGN / Texas UETA consent — the one-line sentence with its
   * "How electronic signing works" dropdown and the "I agree to sign
   * electronically" checkbox, rendered after the disclosure. Required before
   * Submit; the words go up with the signature. Omit on the office's own
   * signatures (lien releases), where the signer is us.
   */
  consent?: EsignConsentText | null
  /** Agree-checkbox label (default "I have read and agree to this contract."). */
  agreeLabel?: string
  /** Submit button label (default "Submit signature"). */
  submitLabel?: string
  /** v2.3636: the language of the form's own words (name label, Type / Draw, hints). Defaults to the consent's language, else English. */
  lang?: SignatureFormLang
}

export function ContractAcceptSignatureForm({
  printedName,
  agreed,
  onPrintedNameChange,
  onAgreedChange,
  formError,
  submitting,
  onSubmit,
  heading = 'Accept document',
  disclosure = SIGNATURE_DISCLOSURE,
  consent = null,
  agreeLabel = 'I have read and agree to this contract.',
  submitLabel = 'Submit signature',
  lang,
}: ContractAcceptSignatureFormProps) {
  const s = signatureFormStrings(lang ?? consent?.lang)
  const [acceptMode, setAcceptMode] = useState<SignatureMode>('type')
  const [fieldHint, setFieldHint] = useState<string | null>(null)
  const [consented, setConsented] = useState(false)
  // v2.3159: the Type / Draw input is shared with the Bid Room; the pad is read at submit.
  const padRef = useRef<SignatureTypeOrDrawHandle>(null)
  // v2.3739: the box is read at submit — AutoFill can fill it without telling React.
  const nameInputRef = useRef<HTMLInputElement>(null)
  const headingId = useId()

  function handleSubmit() {
    setFieldHint(null)
    const nameRead = resolveSignerName(printedName, nameInputRef.current?.value)
    if (nameRead.drifted) onPrintedNameChange(nameInputRef.current?.value ?? '')
    const trimmed = nameRead.name
    if (!trimmed) {
      setFieldHint(s.hintName)
      return
    }
    if (consent && !consented) {
      setFieldHint(s.hintConsent)
      return
    }
    if (!agreed) {
      setFieldHint(s.hintAgree)
      return
    }
    const consentPayload = consent ? { consent: esignConsentPayload(consent) } : {}
    if (acceptMode === 'type') {
      onSubmit({ mode: 'type', printedName: trimmed, ...consentPayload })
      return
    }
    const png = padRef.current?.toDataURL() ?? null
    if (!png) {
      setFieldHint(s.hintDraw)
      return
    }
    onSubmit({
      mode: 'draw',
      printedName: trimmed,
      signaturePngBase64: png,
      ...consentPayload,
    })
  }

  const primaryBtnStyle: CSSProperties = {
    marginTop: '1rem',
    marginLeft: 'auto',
    marginRight: 'auto',
    display: 'block',
    padding: '0.5rem 1.25rem',
    fontWeight: 600,
    background: '#ea580c',
    color: 'white',
    border: 'none',
    borderRadius: 6,
    cursor: submitting ? 'wait' : 'pointer',
  }

  return (
    <section
      aria-labelledby={headingId}
      style={{
        marginTop: '2rem',
        paddingTop: '1.5rem',
        borderTop: '1px solid var(--border)',
      }}
    >
      <h2
        id={headingId}
        style={{ fontSize: '1.15rem', fontWeight: 700, margin: '0 0 1rem', textAlign: 'center' }}
      >
        {heading}
      </h2>

      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          width: '100%',
        }}
      >
      <label
        style={{
          display: 'block',
          marginTop: '0.75rem',
          width: '100%',
          maxWidth: 400,
          textAlign: 'center',
        }}
      >
        <span style={{ display: 'block', fontWeight: 500, marginBottom: '0.35rem' }}>
          {s.yourName}
          <span aria-hidden="true"> *</span>
        </span>
        <SignerNameInput
          ref={nameInputRef}
          value={printedName}
          onValueChange={onPrintedNameChange}
          disabled={submitting}
          required
          placeholder={s.namePlaceholder}
          style={{
            width: '100%',
            maxWidth: 400,
            padding: '0.5rem',
            boxSizing: 'border-box',
            textAlign: 'center',
          }}
        />
      </label>

      <SignatureTypeOrDrawInput
        ref={padRef}
        mode={acceptMode}
        onModeChange={(m) => {
          setAcceptMode(m)
          setFieldHint(null)
        }}
        printedName={printedName}
        placeholderName={s.namePlaceholder}
        disabled={submitting}
        lang={lang ?? (consent?.lang === 'es' ? 'es' : 'en')}
        align="center"
      />
      </div>

      {consent ? (
        <EsignConsentLine
          text={consent}
          lead={disclosure}
          disabled={submitting}
          checkbox={{ checked: consented, onChange: (v) => { setConsented(v); setFieldHint(null) } }}
        />
      ) : (
        <p
          style={{
            fontSize: '0.8rem',
            color: 'var(--text-muted)',
            lineHeight: 1.45,
            marginTop: '1rem',
            marginBottom: '0.5rem',
          }}
        >
          {disclosure}
        </p>
      )}
      <div
        style={{
          display: 'flex',
          justifyContent: 'center',
          width: '100%',
        }}
      >
        <label
          style={{
            display: 'flex',
            gap: '0.5rem',
            alignItems: 'flex-start',
            marginTop: 0,
            textAlign: 'left',
          }}
        >
          <input
            type="checkbox"
            checked={agreed}
            onChange={(e) => onAgreedChange(e.target.checked)}
            disabled={submitting}
          />
          <span>{agreeLabel}</span>
        </label>
      </div>

      {(formError || fieldHint) ? (
        <p style={{ color: 'var(--text-red-700)', marginTop: '0.75rem', textAlign: 'center' }}>{formError || fieldHint}</p>
      ) : null}

      <button
        type="button"
        onClick={() => void handleSubmit()}
        disabled={submitting}
        style={primaryBtnStyle}
      >
        {submitting ? s.submitting : submitLabel}
      </button>
    </section>
  )
}
