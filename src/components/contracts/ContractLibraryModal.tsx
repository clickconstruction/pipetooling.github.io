import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { withSupabaseRetry } from '@/utils/errorHandling'
import { effectiveBookVersionLabel } from '../../lib/contractBookVersionDate'
import { listQuickAddBookDocuments, type QuickSendPersonRow } from '../../lib/contractsQuickSend'
import {
  packetSaveConsequence,
  packetStats,
  personContractDocumentHasStaffData,
} from '../../lib/contractPackets'
import {
  ContractBookModal,
  type ContractBookTemplate,
  type ContractBookTemplateDocument,
} from './ContractBookModal'
import { ContractScopeLibraryTab } from './ContractScopeLibraryTab'
import { FormStudio } from './formStudio/FormStudio'

/**
 * Contract library (v2.1411): one modal for the whole contracts library —
 * merges the old Contract Book and Manage templates modals behind two tabs.
 *
 * - Documents: the Contract Book (embedded), plus per-document sent counts,
 *   quick "Send to…", and a section for ad-hoc documents that only exist as
 *   personal copies.
 * - Packets: master-detail management of `contract_templates` ("packet" is
 *   the UI name — a bundle of library documents assigned to people as a
 *   set). Documents attach via a checkbox list of the library; saving shows
 *   its consequences first (who gets an unsent copy).
 */

type LibraryPersonDoc = QuickSendPersonRow & { note: string | null }
type PacketAssignmentRow = { id: string; person_name: string; template_id: string }

export function ContractLibraryModal({
  open,
  onClose,
  initialTab = 'documents',
  templates,
  templateDocuments,
  assignments,
  personDocuments,
  canDeletePeopleContracts,
  onSaved,
  onQuickSend,
  isDev = false,
}: {
  open: boolean
  onClose: () => void
  initialTab?: 'documents' | 'packets' | 'scope' | 'forms'
  templates: ContractBookTemplate[]
  templateDocuments: ContractBookTemplateDocument[]
  assignments: PacketAssignmentRow[]
  personDocuments: LibraryPersonDoc[]
  canDeletePeopleContracts: boolean
  onSaved: () => void
  onQuickSend: (documentName: string) => void
  /** Contract Forms (v2.2794): devs see the Forms tab (the Form Studio). */
  isDev?: boolean
}) {
  const [tab, setTab] = useState<'documents' | 'packets' | 'scope' | 'forms'>(initialTab)
  const [selectedPacketId, setSelectedPacketId] = useState<string | null>(null)
  const [packetMode, setPacketMode] = useState<'view' | 'new'>('view')
  const [packetName, setPacketName] = useState('')
  const [packetCheckedDocNames, setPacketCheckedDocNames] = useState<Set<string>>(new Set())
  const [packetSaving, setPacketSaving] = useState(false)
  const [packetDeleteConfirmOpen, setPacketDeleteConfirmOpen] = useState(false)
  const [packetDeleting, setPacketDeleting] = useState(false)
  const [packetError, setPacketError] = useState<string | null>(null)

  const sortedPackets = useMemo(
    () =>
      [...templates].sort((a, b) => a.sequence_order - b.sequence_order || a.name.localeCompare(b.name)),
    [templates],
  )

  /** One row per library document name (newest effective copy) — the attach checklist. */
  const libraryDocs = useMemo(() => listQuickAddBookDocuments(templateDocuments), [templateDocuments])

  /** Document name → count of people with any copy (Documents tab meta + ad-hoc section). */
  const sentCountByDocName = useMemo(() => {
    const byDoc = new Map<string, Set<string>>()
    for (const pd of personDocuments) {
      const set = byDoc.get(pd.document_name) ?? new Set<string>()
      set.add(pd.person_name)
      byDoc.set(pd.document_name, set)
    }
    const out = new Map<string, number>()
    for (const [name, people] of byDoc) out.set(name, people.size)
    return out
  }, [personDocuments])

  /** Documents that only exist as personal copies — not in the book at all. */
  const adHocDocNames = useMemo(() => {
    const bookNames = new Set(templateDocuments.map((d) => d.document_name))
    const names = new Set<string>()
    for (const pd of personDocuments) {
      if (!bookNames.has(pd.document_name)) names.add(pd.document_name)
    }
    return [...names].sort((a, b) => a.localeCompare(b))
  }, [templateDocuments, personDocuments])

  const selectedPacket = useMemo(
    () => (selectedPacketId ? sortedPackets.find((t) => t.id === selectedPacketId) ?? null : null),
    [selectedPacketId, sortedPackets],
  )

  const selectedPacketDocNames = useMemo(() => {
    if (!selectedPacket) return []
    return templateDocuments
      .filter((d) => d.template_id === selectedPacket.id)
      .sort((a, b) => a.sequence_order - b.sequence_order)
      .map((d) => d.document_name)
  }, [selectedPacket, templateDocuments])

  const selectedPacketAssignees = useMemo(() => {
    if (!selectedPacket) return []
    return [...new Set(assignments.filter((a) => a.template_id === selectedPacket.id).map((a) => a.person_name))].sort(
      (a, b) => a.localeCompare(b),
    )
  }, [selectedPacket, assignments])

  function loadPacketIntoForm(packetId: string | null) {
    setPacketError(null)
    setPacketDeleteConfirmOpen(false)
    if (packetId === null) {
      setPacketMode('new')
      setSelectedPacketId(null)
      setPacketName('')
      setPacketCheckedDocNames(new Set())
      return
    }
    const packet = sortedPackets.find((t) => t.id === packetId)
    setPacketMode('view')
    setSelectedPacketId(packetId)
    setPacketName(packet?.name ?? '')
    setPacketCheckedDocNames(
      new Set(templateDocuments.filter((d) => d.template_id === packetId).map((d) => d.document_name)),
    )
  }

  useEffect(() => {
    if (!open) {
      setTab(initialTab)
      setSelectedPacketId(null)
      setPacketMode('view')
      setPacketName('')
      setPacketCheckedDocNames(new Set())
      setPacketError(null)
      setPacketSaving(false)
      setPacketDeleteConfirmOpen(false)
      setPacketDeleting(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reset-on-close only
  }, [open])

  // First open of the Packets tab: select the first packet.
  useEffect(() => {
    if (!open || tab !== 'packets') return
    if (selectedPacketId === null && packetMode === 'view' && sortedPackets.length > 0) {
      loadPacketIntoForm(sortedPackets[0]!.id)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- initial selection only
  }, [open, tab, sortedPackets.length])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      if (packetDeleteConfirmOpen) {
        e.preventDefault()
        setPacketDeleteConfirmOpen(false)
        return
      }
      if (!packetSaving && !packetDeleting) onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose, packetSaving, packetDeleting, packetDeleteConfirmOpen])

  const consequence = useMemo(
    () =>
      packetSaveConsequence({
        templateId: packetMode === 'new' ? null : selectedPacketId,
        checkedDocNames: [...packetCheckedDocNames],
        currentDocNames: packetMode === 'new' ? [] : selectedPacketDocNames,
        assignments,
        personDocuments,
      }),
    [packetMode, selectedPacketId, packetCheckedDocNames, selectedPacketDocNames, assignments, personDocuments],
  )

  const packetDirty =
    packetMode === 'new'
      ? packetName.trim().length > 0 || packetCheckedDocNames.size > 0
      : packetName.trim() !== (selectedPacket?.name ?? '') ||
        consequence.addedDocs.length > 0 ||
        consequence.removedDocs.length > 0

  async function savePacket() {
    const name = packetName.trim()
    if (!name) {
      setPacketError('Packet name is required.')
      return
    }
    if (!canDeletePeopleContracts && consequence.removedDocs.length > 0) {
      setPacketError('Removing documents from a packet requires a Dev or Master Technician.')
      return
    }
    setPacketSaving(true)
    setPacketError(null)
    try {
      let templateId = packetMode === 'new' ? null : selectedPacketId
      if (templateId === null) {
        const inserted = await withSupabaseRetry<{ id: string } | null>(
          async () =>
            supabase
              .from('contract_templates')
              .insert({ name, sequence_order: templates.length })
              .select('id')
              .single(),
          'create contract packet',
        )
        if (!inserted?.id) {
          setPacketError('Could not create the packet.')
          return
        }
        templateId = inserted.id
      } else if (name !== selectedPacket?.name) {
        await withSupabaseRetry(
          async () => supabase.from('contract_templates').update({ name }).eq('id', templateId!),
          'rename contract packet',
        )
      }
      const tid = templateId

      // Removals first: drop the packet's copy, then clean empty person placeholders.
      const assignees = assignments.filter((a) => a.template_id === tid).map((a) => a.person_name)
      for (const documentName of consequence.removedDocs) {
        const rows = templateDocuments.filter((d) => d.template_id === tid && d.document_name === documentName)
        for (const row of rows) {
          await withSupabaseRetry(
            async () => supabase.from('contract_template_documents').delete().eq('id', row.id),
            'remove packet document',
          )
        }
        for (const personName of assignees) {
          const pcds = personDocuments.filter(
            (d) => d.person_name === personName && d.document_name === documentName,
          )
          for (const pcd of pcds) {
            if (!personContractDocumentHasStaffData(pcd)) {
              await withSupabaseRetry(
                async () => supabase.from('person_contract_documents').delete().eq('id', pcd.id),
                'remove empty person contract document',
              )
            }
          }
        }
      }

      // Additions: copy the newest library version of the name into this packet,
      // then make sure every assignee has a copy (same rules as assigning a packet).
      const sourceByName = new Map(libraryDocs.map((d) => [d.documentName, d.row]))
      let nextSeq = templateDocuments.filter((d) => d.template_id === tid).length
      for (const { documentName } of consequence.addedDocs) {
        const sourceRow = sourceByName.get(documentName)
        if (!sourceRow) continue
        const insertedDoc = await withSupabaseRetry<{ id: string } | null>(
          async () =>
            supabase
              .from('contract_template_documents')
              .insert({
                template_id: tid,
                document_name: documentName,
                sequence_order: nextSeq++,
                book_body_html: sourceRow.book_body_html,
                book_body_format: sourceRow.book_body_format,
                tags: sourceRow.tags ?? [],
                canonical_document_url: sourceRow.canonical_document_url?.trim() || null,
              })
              .select('id')
              .single(),
          'add packet document',
        )
        if (!insertedDoc?.id) continue
        for (const personName of assignees) {
          const candidates = personDocuments.filter(
            (d) => d.person_name === personName && d.document_name === documentName,
          )
          const existing =
            candidates.length === 0
              ? undefined
              : [...candidates].sort((a, b) => b.lineage_version - a.lineage_version)[0]
          const fillSigningFromBook = !existing?.signing_body_html?.trim()
          if (existing) {
            const updatePayload = fillSigningFromBook
              ? {
                  canonical_document_url: sourceRow.canonical_document_url?.trim() || null,
                  signing_body_html: sourceRow.book_body_html ?? null,
                  signing_body_format: sourceRow.book_body_format,
                  applied_contract_template_document_id: insertedDoc.id,
                }
              : {
                  canonical_document_url: sourceRow.canonical_document_url?.trim() || null,
                  applied_contract_template_document_id: insertedDoc.id,
                }
            await withSupabaseRetry(
              async () =>
                supabase.from('person_contract_documents').update(updatePayload).eq('id', existing.id),
              'update person contract document',
            )
          } else {
            await withSupabaseRetry(
              async () =>
                supabase.from('person_contract_documents').insert({
                  person_name: personName,
                  document_name: documentName,
                  contract_lineage_id: globalThis.crypto.randomUUID(),
                  lineage_version: 1,
                  supersedes_person_contract_document_id: null,
                  status: 'unsent',
                  canonical_document_url: sourceRow.canonical_document_url?.trim() || null,
                  signing_body_html: sourceRow.book_body_html ?? null,
                  signing_body_format: sourceRow.book_body_format,
                  applied_contract_template_document_id: insertedDoc.id,
                }),
              'create person contract document',
            )
          }
        }
      }
      onSaved()
      if (packetMode === 'new') {
        setPacketMode('view')
        setSelectedPacketId(tid)
      }
      setPacketError(null)
    } catch (e) {
      setPacketError(e instanceof Error ? e.message : 'Failed to save packet')
    } finally {
      setPacketSaving(false)
    }
  }

  async function deletePacket() {
    if (!canDeletePeopleContracts || !selectedPacketId) return
    setPacketDeleting(true)
    setPacketError(null)
    try {
      await withSupabaseRetry(
        async () => supabase.from('contract_templates').delete().eq('id', selectedPacketId),
        'delete contract packet',
      )
      setPacketDeleteConfirmOpen(false)
      setSelectedPacketId(null)
      setPacketMode('view')
      setPacketName('')
      setPacketCheckedDocNames(new Set())
      onSaved()
    } catch (e) {
      setPacketError(e instanceof Error ? e.message : 'Failed to delete packet')
    } finally {
      setPacketDeleting(false)
    }
  }

  if (!open) return null

  const tabButton = (key: 'documents' | 'packets' | 'scope' | 'forms', label: string, count: number | null) => (
    <button
      type="button"
      role="tab"
      aria-selected={tab === key}
      onClick={() => setTab(key)}
      style={{
        padding: '0.5rem 1rem',
        fontSize: '0.9rem',
        fontWeight: 600,
        border: 'none',
        borderBottom: `2.5px solid ${tab === key ? 'var(--border-blue)' : 'transparent'}`,
        background: 'none',
        color: tab === key ? 'var(--text-blue-700)' : 'var(--text-muted)',
        cursor: 'pointer',
      }}
    >
      {label}{count == null ? null : <> <span style={{ fontWeight: 500, color: 'var(--text-faint)' }}>{count}</span></>}
    </button>
  )

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.4)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 12,
        padding: 'calc(1rem + env(safe-area-inset-top, 0px)) 1rem calc(1rem + env(safe-area-inset-bottom, 0px))',
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="contract-library-title"
        style={{
          background: 'var(--surface)',
          padding: '1.25rem',
          borderRadius: 8,
          minWidth: 320,
          // The Form Studio places boxes on a rendered Letter page — give it the room (v2.2794).
          maxWidth: tab === 'forms' ? 'min(98vw, 1400px)' : 'min(96vw, 780px)',
          maxHeight: 'min(90vh, 100%)',
          overflow: 'auto',
          width: '100%',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem', marginBottom: '0.5rem' }}>
          <h3 id="contract-library-title" style={{ margin: 0, fontSize: '1.125rem' }}>
            Contract library
          </h3>
          <button
            type="button"
            onClick={onClose}
            disabled={packetSaving || packetDeleting}
            style={{
              padding: '0.35rem 0.65rem',
              fontSize: '0.875rem',
              border: '1px solid var(--border-strong)',
              borderRadius: 6,
              background: 'var(--surface)',
              cursor: packetSaving || packetDeleting ? 'not-allowed' : 'pointer',
            }}
          >
            Close
          </button>
        </div>
        <div role="tablist" aria-label="Contract library sections" style={{ display: 'flex', gap: '0.25rem', borderBottom: '1px solid var(--border)', marginBottom: '1rem' }}>
          {tabButton('documents', 'Documents', libraryDocs.length + adHocDocNames.length)}
          {tabButton('packets', 'Packets', sortedPackets.length)}
          {tabButton('scope', 'Scope', null)}
          {isDev ? tabButton('forms', 'Forms', templateDocuments.filter((d) => d.form_template_id).length) : null}
        </div>

        {tab === 'forms' && isDev ? <FormStudio packets={templates} bookEntries={templateDocuments} onSaved={onSaved} /> : null}

        {tab === 'documents' ? (
          <div role="tabpanel">
            <ContractBookModal
              open
              embedded
              onClose={onClose}
              templates={templates}
              templateDocuments={templateDocuments}
              onSaved={onSaved}
              canDeleteLibraryEntries={canDeletePeopleContracts}
              sentCountByDocName={sentCountByDocName}
              onQuickSend={onQuickSend}
            />
            {adHocDocNames.length > 0 ? (
              <div style={{ marginTop: '1.25rem', borderTop: '1px dashed var(--border-strong)', paddingTop: '0.85rem' }}>
                <p style={{ margin: '0 0 0.2rem', fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text-strong)' }}>
                  Outside the library · {adHocDocNames.length}
                </p>
                <p style={{ margin: '0 0 0.6rem', fontSize: '0.75rem', color: 'var(--text-muted)', lineHeight: 1.45 }}>
                  These documents only exist as personal copies (created ad-hoc on people) — sending one uses the
                  most recent copy&rsquo;s text. Add them above to give them an official library version.
                </p>
                <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                  {adHocDocNames.map((documentName) => {
                    const count = sentCountByDocName.get(documentName) ?? 0
                    return (
                      <li
                        key={documentName}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.6rem',
                          border: '1px solid var(--border)',
                          borderRadius: 6,
                          padding: '0.5rem 0.7rem',
                          fontSize: '0.875rem',
                        }}
                      >
                        <span style={{ flex: 1, minWidth: 0, fontWeight: 600, overflowWrap: 'anywhere' }}>{documentName}</span>
                        <span style={{ flexShrink: 0, fontSize: '0.72rem', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                          sent to {count} {count === 1 ? 'person' : 'people'}
                        </span>
                        <button
                          type="button"
                          onClick={() => onQuickSend(documentName)}
                          style={{
                            flexShrink: 0,
                            padding: '0.25rem 0.55rem',
                            fontSize: '0.8125rem',
                            fontWeight: 600,
                            border: 'none',
                            borderRadius: 6,
                            background: '#0ea5e9',
                            color: '#fff',
                            cursor: 'pointer',
                          }}
                        >
                          Send to…
                        </button>
                      </li>
                    )
                  })}
                </ul>
              </div>
            ) : null}
          </div>
        ) : tab === 'scope' ? (
          <ContractScopeLibraryTab onQuickSend={onQuickSend} canEdit />
        ) : tab === 'forms' ? null : (
          <div role="tabpanel" style={{ display: 'grid', gridTemplateColumns: 'minmax(180px, 240px) minmax(0, 1fr)', gap: '1rem' }}>
            <div>
              <button
                type="button"
                onClick={() => loadPacketIntoForm(null)}
                disabled={packetSaving || packetDeleting}
                style={{
                  width: '100%',
                  padding: '0.45rem 0.75rem',
                  fontSize: '0.8125rem',
                  fontWeight: 600,
                  border: 'none',
                  borderRadius: 6,
                  background: '#3b82f6',
                  color: '#fff',
                  cursor: 'pointer',
                  marginBottom: '0.6rem',
                }}
              >
                + New packet
              </button>
              {sortedPackets.length === 0 ? (
                <p style={{ margin: 0, fontSize: '0.8125rem', color: 'var(--text-muted)' }}>No packets yet.</p>
              ) : null}
              {sortedPackets.map((t) => {
                const stats = packetStats({ templateId: t.id, templateDocuments, assignments })
                const active = packetMode === 'view' && selectedPacketId === t.id
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => loadPacketIntoForm(t.id)}
                    disabled={packetSaving || packetDeleting}
                    style={{
                      display: 'block',
                      width: '100%',
                      textAlign: 'left',
                      font: 'inherit',
                      padding: '0.55rem 0.7rem',
                      border: active ? '1.5px solid var(--border-blue)' : '1px solid var(--border)',
                      borderRadius: 8,
                      background: active ? 'var(--bg-blue-tint)' : 'var(--surface)',
                      cursor: 'pointer',
                      marginBottom: '0.45rem',
                      color: 'var(--text-strong)',
                    }}
                  >
                    <span style={{ display: 'block', fontWeight: 700, fontSize: '0.875rem', overflowWrap: 'anywhere' }}>{t.name}</span>
                    <span
                      style={{
                        display: 'block',
                        marginTop: '0.1rem',
                        fontSize: '0.72rem',
                        color: stats.peopleCount === 0 ? 'var(--text-amber-700)' : 'var(--text-muted)',
                      }}
                    >
                      {stats.docCount} {stats.docCount === 1 ? 'document' : 'documents'} · {stats.peopleCount}{' '}
                      {stats.peopleCount === 1 ? 'person' : 'people'}
                    </span>
                  </button>
                )
              })}
            </div>
            <div style={{ border: '1px solid var(--border)', borderRadius: 10, padding: '0.85rem 1rem', minWidth: 0 }}>
              {packetMode === 'view' && !selectedPacket ? (
                <p style={{ margin: 0, fontSize: '0.875rem', color: 'var(--text-muted)' }}>
                  Pick a packet on the left, or create one.
                </p>
              ) : (
                <>
                  {packetError ? (
                    <p style={{ color: 'var(--text-red-700)', fontSize: '0.875rem', margin: '0 0 0.6rem' }}>{packetError}</p>
                  ) : null}
                  <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, marginBottom: '0.25rem' }}>
                    Packet name
                  </label>
                  <input
                    type="text"
                    value={packetName}
                    onChange={(e) => setPacketName(e.target.value)}
                    placeholder="e.g. All Teammates"
                    disabled={packetSaving || packetDeleting}
                    style={{
                      width: '100%',
                      boxSizing: 'border-box',
                      padding: '0.5rem',
                      border: '1px solid var(--border-strong)',
                      borderRadius: 4,
                      marginBottom: '0.75rem',
                    }}
                  />
                  <p style={{ margin: '0 0 0.3rem', fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-600)' }}>
                    Documents in this packet
                  </p>
                  {libraryDocs.length === 0 ? (
                    <p style={{ margin: 0, fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
                      The library is empty — add documents on the <strong>Documents</strong> tab first.
                    </p>
                  ) : (
                    libraryDocs.map(({ documentName, row }) => {
                      const checked = packetCheckedDocNames.has(documentName)
                      const versionLabel = effectiveBookVersionLabel(row)
                      return (
                        <label
                          key={documentName}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.5rem',
                            padding: '0.35rem 0.45rem',
                            borderRadius: 6,
                            fontSize: '0.875rem',
                            cursor: packetSaving ? 'wait' : 'pointer',
                          }}
                        >
                          <input
                            type="checkbox"
                            checked={checked}
                            disabled={packetSaving || packetDeleting}
                            onChange={(e) => {
                              setPacketCheckedDocNames((prev) => {
                                const next = new Set(prev)
                                if (e.target.checked) next.add(documentName)
                                else next.delete(documentName)
                                return next
                              })
                            }}
                          />
                          <span style={{ flex: 1, minWidth: 0, overflowWrap: 'anywhere' }}>{documentName}</span>
                          {versionLabel ? (
                            <span style={{ flexShrink: 0, fontSize: '0.7rem', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                              {versionLabel}
                            </span>
                          ) : null}
                        </label>
                      )
                    })
                  )}
                  {consequence.addedDocs.length > 0 || consequence.removedDocs.length > 0 ? (
                    <div
                      style={{
                        marginTop: '0.6rem',
                        borderRadius: 8,
                        background: 'var(--bg-amber-100)',
                        color: 'var(--text-amber-800)',
                        fontSize: '0.78rem',
                        lineHeight: 1.45,
                        padding: '0.5rem 0.7rem',
                      }}
                    >
                      {consequence.addedDocs.map(({ documentName, peopleNeedingCopy }) => (
                        <div key={`add-${documentName}`}>
                          On Save: <strong>{documentName}</strong> is added
                          {packetMode === 'new' || consequence.assigneeCount === 0
                            ? ' (nobody is assigned this packet yet).'
                            : peopleNeedingCopy === 0
                              ? ` — all ${consequence.assigneeCount} assigned people already have a copy.`
                              : ` for the ${peopleNeedingCopy} assigned ${peopleNeedingCopy === 1 ? 'person' : 'people'} without it (created as unsent).`}
                        </div>
                      ))}
                      {consequence.removedDocs.map((documentName) => (
                        <div key={`rm-${documentName}`}>
                          On Save: <strong>{documentName}</strong> leaves the packet — empty unsent copies are removed;
                          signed or in-progress documents stay on file.
                        </div>
                      ))}
                    </div>
                  ) : null}
                  {packetMode === 'view' && selectedPacketAssignees.length > 0 ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', flexWrap: 'wrap', marginTop: '0.75rem' }}>
                      <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-600)' }}>Assigned people:</span>
                      {selectedPacketAssignees.map((name) => (
                        <span
                          key={name}
                          style={{
                            fontSize: '0.72rem',
                            fontWeight: 500,
                            padding: '0.12rem 0.5rem',
                            borderRadius: 999,
                            background: 'var(--bg-subtle)',
                            border: '1px solid var(--border)',
                            color: 'var(--text-600)',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          {name}
                        </span>
                      ))}
                    </div>
                  ) : null}
                  <div
                    style={{
                      display: 'flex',
                      gap: '0.5rem',
                      alignItems: 'center',
                      marginTop: '1rem',
                      paddingTop: '0.8rem',
                      borderTop: '1px solid var(--border)',
                      flexWrap: 'wrap',
                    }}
                  >
                    {packetMode === 'view' && selectedPacket && canDeletePeopleContracts ? (
                      <button
                        type="button"
                        onClick={() => setPacketDeleteConfirmOpen(true)}
                        disabled={packetSaving || packetDeleting}
                        style={{
                          padding: '0.4rem 0.8rem',
                          fontSize: '0.8125rem',
                          border: '1px solid #fecaca',
                          borderRadius: 6,
                          background: 'var(--bg-red-tint)',
                          color: 'var(--text-red-700)',
                          cursor: packetSaving || packetDeleting ? 'not-allowed' : 'pointer',
                        }}
                      >
                        Delete packet
                      </button>
                    ) : null}
                    <span style={{ flex: 1 }} />
                    <button
                      type="button"
                      onClick={() => {
                        if (packetMode === 'new') loadPacketIntoForm(sortedPackets[0]?.id ?? null)
                        else if (selectedPacketId) loadPacketIntoForm(selectedPacketId)
                      }}
                      disabled={packetSaving || packetDeleting || (packetMode === 'view' && !packetDirty)}
                      style={{
                        padding: '0.4rem 0.8rem',
                        fontSize: '0.8125rem',
                        border: '1px solid var(--border-strong)',
                        borderRadius: 6,
                        background: 'var(--surface)',
                        cursor: 'pointer',
                        opacity: packetMode === 'view' && !packetDirty ? 0.55 : 1,
                      }}
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={() => void savePacket()}
                      disabled={packetSaving || packetDeleting || !packetDirty}
                      style={{
                        padding: '0.4rem 0.9rem',
                        fontSize: '0.8125rem',
                        fontWeight: 600,
                        border: 'none',
                        borderRadius: 6,
                        background: '#3b82f6',
                        color: '#fff',
                        cursor: packetSaving || !packetDirty ? 'not-allowed' : 'pointer',
                        opacity: packetDirty ? 1 : 0.55,
                      }}
                    >
                      {packetSaving ? 'Saving…' : 'Save'}
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        )}
      </div>

      {packetDeleteConfirmOpen && selectedPacket && canDeletePeopleContracts ? (
        <div
          role="presentation"
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 13,
            background: 'rgba(0,0,0,0.45)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '1rem',
          }}
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setPacketDeleteConfirmOpen(false)
          }}
        >
          <div
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="packet-delete-title"
            style={{
              background: 'var(--surface)',
              padding: '1.25rem',
              borderRadius: 8,
              maxWidth: 420,
              width: '100%',
              boxShadow: '0 8px 32px rgba(0,0,0,0.2)',
            }}
            onMouseDown={(e) => e.stopPropagation()}
          >
            <h4 id="packet-delete-title" style={{ margin: '0 0 0.75rem', fontSize: '1rem' }}>
              Delete packet?
            </h4>
            <p style={{ margin: '0 0 1rem', fontSize: '0.875rem', color: 'var(--text-700)', lineHeight: 1.45 }}>
              Delete <strong>{selectedPacket.name}</strong>? This removes the packet and its document list —
              people&rsquo;s existing document copies stay on file. This cannot be undone.
            </p>
            <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end', flexWrap: 'wrap' }}>
              <button
                type="button"
                onClick={() => setPacketDeleteConfirmOpen(false)}
                disabled={packetDeleting}
                style={{
                  padding: '0.4rem 0.85rem',
                  border: '1px solid var(--border-strong)',
                  borderRadius: 6,
                  background: 'var(--surface)',
                  cursor: packetDeleting ? 'not-allowed' : 'pointer',
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void deletePacket()}
                disabled={packetDeleting}
                style={{
                  padding: '0.4rem 0.85rem',
                  fontWeight: 600,
                  border: 'none',
                  borderRadius: 6,
                  background: packetDeleting ? 'var(--bg-400)' : '#dc2626',
                  color: '#fff',
                  cursor: packetDeleting ? 'not-allowed' : 'pointer',
                }}
              >
                {packetDeleting ? 'Deleting…' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}
