import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { formatErrorMessage, withSupabaseRetry } from '../../utils/errorHandling'
import { contractBodyHasRenderableDisplay } from '../../lib/contractBodyFormat'
import { ContractBodyDisplay } from './ContractBodyDisplay'
import { EstimateAcceptTypedSignatureLine } from '../estimates/EstimateAcceptTypedSignatureLine'
import type { Tables } from '../../types/database'
import type { FormSchema, FormValues } from '../../lib/forms/formSchema'
import { FORM_SOURCE_LABEL, formFacts } from '../../lib/forms/formRecord'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string

type PersonContractDocumentRow = Pick<
  Tables<'person_contract_documents'>,
  | 'id'
  | 'document_name'
  | 'person_name'
  | 'signing_body_html'
  | 'signing_body_format'
  | 'canonical_document_url'
  | 'url'
  | 'status'
  | 'signed_at'
  | 'signer_printed_name'
  | 'signer_consented_at'
  | 'signer_signature_storage_path'
> & {
  /** Contract Forms (v2.2798): set when the signer filled a form instead of reading a body. */
  form_template_id?: string | null
  form_values?: FormValues | null
  form_hints?: Record<string, string> | null
  form_source?: string | null
  form_pdf_storage_path?: string | null
}

type PersonContractSignedRecordModalProps = {
  open: boolean
  onClose: () => void
  documentId: string | null
}

export function PersonContractSignedRecordModal({
  open,
  onClose,
  documentId,
}: PersonContractSignedRecordModalProps) {
  const [row, setRow] = useState<PersonContractDocumentRow | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [signatureSignedUrl, setSignatureSignedUrl] = useState<string | null>(null)
  const [formSchema, setFormSchema] = useState<FormSchema | null>(null)
  const [pdfBusy, setPdfBusy] = useState(false)
  const [pdfError, setPdfError] = useState<string | null>(null)

  useEffect(() => {
    if (!open) {
      setRow(null)
      setError(null)
      setLoading(false)
      setSignatureSignedUrl(null)
      setFormSchema(null)
      setPdfError(null)
      return
    }
    if (!documentId?.trim()) {
      setRow(null)
      setError('Missing document.')
      return
    }

    const id = documentId.trim()
    let cancelled = false
    setLoading(true)
    setError(null)
    setRow(null)
    setSignatureSignedUrl(null)

    void (async () => {
      try {
        const doc = await withSupabaseRetry<PersonContractDocumentRow | null>(
          async () =>
            await supabase
              .from('person_contract_documents')
              .select(
                'id, document_name, person_name, signing_body_html, signing_body_format, canonical_document_url, url, status, signed_at, signer_printed_name, signer_consented_at, signer_signature_storage_path, form_template_id, form_values, form_hints, form_source, form_pdf_storage_path',
              )
              .eq('id', id)
              .maybeSingle(),
          'load person contract signed record',
        )
        if (cancelled) return

        if (!doc) {
          setError('Document not found or access denied.')
          return
        }
        if (doc.status !== 'signed') {
          setError('This document is not in signed status.')
          return
        }
        setRow(doc)
        if (doc.form_template_id) {
          const { data: tpl } = await supabase.from('contract_form_templates' as never).select('schema').eq('id', doc.form_template_id).maybeSingle()
          if (!cancelled) setFormSchema(((tpl as unknown as { schema?: FormSchema } | null)?.schema) ?? null)
        }
      } catch (e) {
        if (!cancelled) setError(formatErrorMessage(e, 'Could not load document'))
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()

    return () => {
      cancelled = true
    }
  }, [open, documentId])

  useEffect(() => {
    const path = row?.signer_signature_storage_path?.trim()
    if (!path) {
      setSignatureSignedUrl(null)
      return
    }
    let cancelled = false
    void (async () => {
      try {
        const signed = await withSupabaseRetry(
          async () =>
            await supabase.storage.from('contract-signer-signatures').createSignedUrl(path, 3600),
          'contract signer signature url modal',
        )
        if (cancelled) return
        setSignatureSignedUrl(signed?.signedUrl ?? null)
      } catch {
        if (!cancelled) setSignatureSignedUrl(null)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [row?.signer_signature_storage_path, row?.id])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null

  async function openFormPdf() {
    if (!row) return
    setPdfBusy(true)
    setPdfError(null)
    try {
      const { data: sess } = await supabase.auth.getSession()
      const jwt = sess.session?.access_token
      if (!jwt) throw new Error('Not signed in.')
      const res = await fetch(`${supabaseUrl}/functions/v1/open-contract-form-pdf`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${jwt}`, apikey: anonKey },
        body: JSON.stringify({ person_contract_document_id: row.id }),
      })
      const json = (await res.json()) as { ok?: boolean; url?: string; error?: string }
      if (!res.ok || !json.url) throw new Error(json.error || 'Could not open the PDF.')
      window.open(json.url, '_blank', 'noopener')
    } catch (e) {
      setPdfError(e instanceof Error ? e.message : String(e))
    } finally {
      setPdfBusy(false)
    }
  }

  const isForm = Boolean(row?.form_template_id)
  const facts = row && formSchema ? formFacts(formSchema, row.form_values ?? null, row.form_hints ?? null) : []

  const hasRenderableSigningBody =
    row?.status === 'signed' &&
    contractBodyHasRenderableDisplay(row.signing_body_html, row.signing_body_format)
  const canonical = row?.canonical_document_url?.trim()
  const refUrl = row?.url?.trim()

  return (
    <div
      role="presentation"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 80,
        background: 'rgba(0,0,0,0.45)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '1rem',
        boxSizing: 'border-box',
      }}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="person-contract-signed-record-title"
        style={{
          width: '100%',
          maxWidth: 720,
          maxHeight: 'min(92vh, 900px)',
          overflow: 'auto',
          background: 'var(--surface)',
          borderRadius: 8,
          boxShadow: '0 16px 48px rgba(0,0,0,0.2)',
          display: 'flex',
          flexDirection: 'column',
        }}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'flex-start',
            justifyContent: 'space-between',
            gap: '0.75rem',
            flexWrap: 'wrap',
            padding: '1rem 1.25rem',
            borderBottom: '1px solid var(--border)',
            position: 'sticky',
            top: 0,
            background: 'var(--surface)',
            zIndex: 1,
          }}
        >
          <div style={{ minWidth: 0 }}>
            <h2 id="person-contract-signed-record-title" style={{ margin: 0, fontSize: '1.1rem' }}>
              Signed contract
            </h2>
            {/* Flex-wrap with nowrap segments: each phrase stays whole, so a
                narrow screen breaks between "Signed as" and the timestamp
                instead of orphaning "PM" onto its own line. */}
            {row && row.status === 'signed' ? (
              <p style={{ margin: '0.35rem 0 0', fontSize: '0.85rem', color: 'var(--text-muted)', display: 'flex', flexWrap: 'wrap', columnGap: '0.65rem' }}>
                {row.signer_printed_name?.trim() ? (
                  <span style={{ whiteSpace: 'nowrap' }}>
                    <strong>Signed as:</strong> {row.signer_printed_name.trim()}
                  </span>
                ) : null}
                {row.signer_consented_at ? (
                  <span style={{ whiteSpace: 'nowrap' }}>
                    <strong>Signed:</strong> {new Date(row.signer_consented_at).toLocaleString()}
                  </span>
                ) : row.signed_at ? (
                  <span style={{ whiteSpace: 'nowrap' }}>
                    <strong>Recorded:</strong> {new Date(row.signed_at).toLocaleString()}
                  </span>
                ) : null}
              </p>
            ) : null}
          </div>
          <button type="button" onClick={onClose} style={{ padding: '0.4rem 0.85rem' }}>
            Close
          </button>
        </div>

        <div style={{ padding: '1rem 1.25rem 1.5rem' }}>
          {loading ? <p style={{ margin: 0, color: 'var(--text-muted)' }}>Loading…</p> : null}
          {error ? (
            <p style={{ margin: 0, color: 'var(--text-red-700)' }} role="alert">
              {error}
            </p>
          ) : null}
          {!loading && !error && row && row.status === 'signed' ? (
            <div
              style={{
                fontFamily: 'system-ui, sans-serif',
                border: '1px solid var(--border)',
                borderRadius: 8,
                padding: '1rem',
                background: 'var(--bg-page)',
              }}
            >
              {row.document_name ? (
                <h3 style={{ fontSize: '1.15rem', margin: '0 0 0.75rem', fontWeight: 600 }}>
                  {row.document_name}
                </h3>
              ) : null}
              <p
                style={{
                  fontSize: '0.95rem',
                  color: 'var(--text-700)',
                  marginTop: 0,
                  marginBottom: '1rem',
                }}
              >
                <strong>For:</strong> {row.person_name}
              </p>

              {canonical ? (
                <p style={{ marginBottom: '1rem' }}>
                  <a
                    href={canonical}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ color: 'var(--text-link)', fontWeight: 600 }}
                  >
                    Open full document
                  </a>
                </p>
              ) : null}

              {!canonical && refUrl ? (
                <p style={{ marginBottom: '1rem' }}>
                  <a
                    href={refUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ color: 'var(--text-link)', fontWeight: 600 }}
                  >
                    Reference link
                  </a>
                </p>
              ) : null}

              {hasRenderableSigningBody && row ? (
                <div
                  style={{
                    maxHeight: 'min(50vh, 420px)',
                    overflow: 'auto',
                    border: '1px solid var(--border)',
                    borderRadius: 8,
                    padding: '1rem',
                    background: 'var(--bg-subtle)',
                    fontSize: '0.9rem',
                    marginBottom: '0.75rem',
                  }}
                >
                  <ContractBodyDisplay format={row.signing_body_format} bodyHtml={row.signing_body_html} />
                </div>
              ) : null}

              {isForm ? (
                <div style={{ border: '1px solid var(--border)', borderRadius: 8, padding: '0.85rem 1rem', background: 'var(--bg-subtle)', marginBottom: '0.75rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '0.5rem' }}>
                    <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>
                      Form answers{' '}
                      {row.form_source ? <span style={{ fontWeight: 400, color: 'var(--text-muted)' }}>· {FORM_SOURCE_LABEL[row.form_source] ?? row.form_source}</span> : null}
                    </div>
                    {row.form_pdf_storage_path ? (
                      <button type="button" onClick={() => void openFormPdf()} disabled={pdfBusy} style={{ padding: '0.35rem 0.8rem', fontWeight: 600, fontSize: '0.8125rem' }}>
                        {pdfBusy ? 'Opening…' : 'Open signed PDF'}
                      </button>
                    ) : null}
                  </div>
                  {pdfError ? (
                    <p style={{ margin: '0 0 0.5rem', fontSize: '0.8125rem', color: 'var(--text-red-700)' }} role="alert">
                      {pdfError}
                    </p>
                  ) : null}
                  {facts.length === 0 ? (
                    <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-muted)' }}>{formSchema ? 'No answers were stored on this row.' : 'Loading the form’s layout…'}</p>
                  ) : (
                    <dl style={{ display: 'grid', gridTemplateColumns: 'minmax(120px, max-content) 1fr', gap: '0.25rem 0.9rem', margin: 0, fontSize: '0.875rem' }}>
                      {facts.map((f) => (
                        <div key={f.key} style={{ display: 'contents' }}>
                          <dt style={{ color: 'var(--text-muted)' }}>{f.label}</dt>
                          <dd style={{ margin: 0, color: 'var(--text-strong)', fontVariantNumeric: 'tabular-nums' }}>
                            {f.value}
                            {f.sensitive ? <span style={{ marginLeft: '0.4rem', fontSize: '0.75rem', color: 'var(--text-muted)' }}>in the PDF only</span> : null}
                          </dd>
                        </div>
                      ))}
                    </dl>
                  )}
                  <p style={{ margin: '0.6rem 0 0', fontSize: '0.75rem', color: 'var(--text-muted)', lineHeight: 1.45 }}>
                    Sensitive answers are never stored on the row. Opening the signed PDF is limited to devs, controllers, and pay-approved masters, and each open is logged.
                  </p>
                </div>
              ) : null}

              {!hasRenderableSigningBody && !canonical && !refUrl && !isForm ? (
                <p style={{ color: 'var(--text-muted)', marginBottom: '0.75rem' }}>
                  No document content was stored for this contract.
                </p>
              ) : null}

              <div style={{ marginTop: '1rem' }}>
                <div style={{ fontWeight: 600, marginBottom: '0.35rem', fontSize: '0.9rem' }}>Signature</div>
                {row.signer_signature_storage_path?.trim() ? (
                  signatureSignedUrl ? (
                    <img
                      src={signatureSignedUrl}
                      alt="Signer signature"
                      style={{
                        display: 'block',
                        maxWidth: 400,
                        width: '100%',
                        border: '1px solid var(--border)',
                        borderRadius: 6,
                      }}
                    />
                  ) : (
                    <p style={{ fontSize: '0.9rem', color: 'var(--text-muted)', margin: 0 }}>
                      Loading signature…
                    </p>
                  )
                ) : row.signer_printed_name?.trim() ? (
                  <div style={{ maxWidth: 400 }}>
                    <EstimateAcceptTypedSignatureLine
                      printedName={row.signer_printed_name.trim()}
                      consentAtIso={row.signer_consented_at}
                      ariaHidden
                    />
                  </div>
                ) : (
                  <p style={{ fontSize: '0.9rem', color: 'var(--text-muted)', margin: 0 }}>
                    No signature image or typed name on file.
                  </p>
                )}
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  )
}
