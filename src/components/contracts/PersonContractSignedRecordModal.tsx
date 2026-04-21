import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { formatErrorMessage, withSupabaseRetry } from '../../utils/errorHandling'
import { contractBodyHasRenderableDisplay } from '../../lib/contractBodyFormat'
import { ContractBodyDisplay } from './ContractBodyDisplay'
import { EstimateAcceptTypedSignatureLine } from '../estimates/EstimateAcceptTypedSignatureLine'
import type { Tables } from '../../types/database'

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
>

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

  useEffect(() => {
    if (!open) {
      setRow(null)
      setError(null)
      setLoading(false)
      setSignatureSignedUrl(null)
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
                'id, document_name, person_name, signing_body_html, signing_body_format, canonical_document_url, url, status, signed_at, signer_printed_name, signer_consented_at, signer_signature_storage_path',
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
          background: 'white',
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
            borderBottom: '1px solid #e5e7eb',
            position: 'sticky',
            top: 0,
            background: 'white',
            zIndex: 1,
          }}
        >
          <div style={{ minWidth: 0 }}>
            <h2 id="person-contract-signed-record-title" style={{ margin: 0, fontSize: '1.1rem' }}>
              Signed contract
            </h2>
            {row && row.status === 'signed' ? (
              <p style={{ margin: '0.35rem 0 0', fontSize: '0.85rem', color: '#6b7280' }}>
                {row.signer_printed_name?.trim() ? (
                  <>
                    <strong>Signed as:</strong> {row.signer_printed_name.trim()}
                    {row.signer_consented_at ? (
                      <>
                        {' '}
                        · <strong>Signed:</strong> {new Date(row.signer_consented_at).toLocaleString()}
                      </>
                    ) : row.signed_at ? (
                      <>
                        {' '}
                        · <strong>Recorded:</strong> {new Date(row.signed_at).toLocaleString()}
                      </>
                    ) : null}
                  </>
                ) : row.signer_consented_at ? (
                  <>
                    <strong>Signed:</strong> {new Date(row.signer_consented_at).toLocaleString()}
                  </>
                ) : row.signed_at ? (
                  <>
                    <strong>Recorded:</strong> {new Date(row.signed_at).toLocaleString()}
                  </>
                ) : null}
              </p>
            ) : null}
          </div>
          <button type="button" onClick={onClose} style={{ padding: '0.4rem 0.85rem' }}>
            Close
          </button>
        </div>

        <div style={{ padding: '1rem 1.25rem 1.5rem' }}>
          {loading ? <p style={{ margin: 0, color: '#6b7280' }}>Loading…</p> : null}
          {error ? (
            <p style={{ margin: 0, color: '#b91c1c' }} role="alert">
              {error}
            </p>
          ) : null}
          {!loading && !error && row && row.status === 'signed' ? (
            <div
              style={{
                fontFamily: 'system-ui, sans-serif',
                border: '1px solid #e5e7eb',
                borderRadius: 8,
                padding: '1rem',
                background: '#fafafa',
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
                  color: '#374151',
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
                    style={{ color: '#2563eb', fontWeight: 600 }}
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
                    style={{ color: '#2563eb', fontWeight: 600 }}
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
                    border: '1px solid #e5e7eb',
                    borderRadius: 8,
                    padding: '1rem',
                    background: '#f9fafb',
                    fontSize: '0.9rem',
                    marginBottom: '0.75rem',
                  }}
                >
                  <ContractBodyDisplay format={row.signing_body_format} bodyHtml={row.signing_body_html} />
                </div>
              ) : null}

              {!hasRenderableSigningBody && !canonical && !refUrl ? (
                <p style={{ color: '#6b7280', marginBottom: '0.75rem' }}>
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
                        border: '1px solid #e5e7eb',
                        borderRadius: 6,
                      }}
                    />
                  ) : (
                    <p style={{ fontSize: '0.9rem', color: '#6b7280', margin: 0 }}>
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
                  <p style={{ fontSize: '0.9rem', color: '#6b7280', margin: 0 }}>
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
