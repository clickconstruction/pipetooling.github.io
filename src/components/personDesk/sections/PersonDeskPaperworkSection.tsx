import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../../../lib/supabase'
import { officeSectionPending, twoPartyTemplateIdSet } from '../../../lib/forms/formParties'
import type { FormSchema } from '../../../lib/forms/formSchema'
import { useToastContext } from '../../../contexts/ToastContext'
import { useConfirmDialog } from '../../../contexts/ConfirmDialogContext'
import type { PersonDeskViewer } from '../../../lib/people/personDeskGates'
import { buildPaperworkLines, summarizePaperwork, type PaperworkDocInput, type PaperworkState } from '../../../lib/people/paperworkRollup'
import { materializePacketForPerson, type PacketPersonDoc, type PacketTemplateDoc } from '../../../lib/people/materializePacket'
import { denverCalendarDayKey } from '../../../utils/dateUtils'
import { BTN, BTN_BLUE, BTN_QUIET, Chip, DeskEmpty, DeskRow, DeskSection, LockTag, deskBtn } from '../personDeskShared'
import { SubDocumentAddForm } from '../../people/SubDocumentAddForm'

const TONE: Record<PaperworkState, 'red' | 'amber' | 'green' | 'blue' | 'gray'> = { unsent: 'red', sent: 'blue', signed: 'green', expiring: 'amber', expired: 'red' }

type DocRow = PaperworkDocInput & { person_name: string | null; person_id: string | null; signing_body_html: string | null }

/**
 * Paperwork (PR 3): every document lineage on file for the person, the packet
 * assignment, the clock-in nag, and the doors to Contracts for send / upload.
 * Name-keyed like the tab (docs also carry person_id since v2.2667).
 * "Add document" (journey-map Tier-2 #33) files a COI / W-9 / license / paper-
 * signed agreement right here, typed from birth — the same SubDocumentAddForm
 * the Subs row expander mounts. Nothing is written until Save.
 */
export function PersonDeskPaperworkSection({ payName, personId, viewer, changeKey, onChanged }: { payName: string | null; personId: string | null; viewer: PersonDeskViewer; changeKey: number; onChanged: () => void }) {
  const { showToast } = useToastContext()
  const confirmDialog = useConfirmDialog()
  const [docs, setDocs] = useState<DocRow[] | null>(null)
  const [templates, setTemplates] = useState<Array<{ id: string; name: string }>>([])
  const [templateDocs, setTemplateDocs] = useState<PacketTemplateDoc[]>([])
  const [assigned, setAssigned] = useState<string[]>([])
  const [pick, setPick] = useState('')
  const [busy, setBusy] = useState<string | null>(null)
  const [addingDoc, setAddingDoc] = useState(false)
  const todayYmd = denverCalendarDayKey(Date.now())
  const canEdit = viewer.canAccessContracts && !viewer.readOnly

  useEffect(() => {
    if (!viewer.canAccessContracts || (!payName && !personId)) return
    let cancelled = false
    void (async () => {
      const orParts: string[] = []
      if (payName && !payName.includes('"') && !payName.includes(',')) orParts.push(`person_name.eq."${payName}"`)
      if (personId) orParts.push(`person_id.eq.${personId}`)
      const [d, t, td, a] = await Promise.all([
        supabase
          .from('person_contract_documents')
          .select('id, person_name, person_id, document_name, status, signed_at, sent_at, expires_at, dashboard_prompt_after_clock_in, contract_lineage_id, lineage_version, signing_body_html, doc_type, form_template_id, office_completed_at')
          .or(orParts.join(',')),
        supabase.from('contract_templates').select('id, name').order('sequence_order'),
        supabase.from('contract_template_documents').select('id, template_id, document_name, book_body_html, book_body_format, canonical_document_url'),
        payName ? supabase.from('person_contract_assignments').select('template_id').eq('person_name', payName) : Promise.resolve({ data: [] }),
      ])
      if (cancelled) return
      const mine = ((d.data ?? []) as unknown as DocRow[]).filter((r) => !payName || r.person_name === payName || r.person_id === personId)
      // Two-party forms (v2.2803): which of these still wait on the office.
      const formIds = [...new Set(mine.map((r) => r.form_template_id).filter((x): x is string => !!x))]
      let twoParty = new Set<string>()
      if (formIds.length > 0) {
        const { data: tpls } = await supabase.from('contract_form_templates' as never).select('id, schema').in('id', formIds)
        twoParty = twoPartyTemplateIdSet((tpls ?? []) as unknown as Array<{ id: string; schema: FormSchema | null }>)
      }
      if (cancelled) return
      setDocs(mine.map((r) => ({ ...r, office_pending: officeSectionPending({ ...r, person_name: r.person_name ?? '' }, twoParty) })))
      setTemplates((t.data ?? []) as Array<{ id: string; name: string }>)
      setTemplateDocs((td.data ?? []) as PacketTemplateDoc[])
      setAssigned((((a as { data: Array<{ template_id: string }> | null }).data) ?? []).map((r) => r.template_id))
    })()
    return () => {
      cancelled = true
    }
  }, [payName, personId, viewer.canAccessContracts, changeKey])

  const lines = useMemo(() => buildPaperworkLines(docs ?? [], todayYmd), [docs, todayYmd])
  const summary = useMemo(() => summarizePaperwork(lines), [lines])

  if (!viewer.canAccessContracts) return null

  async function assignPacket() {
    if (!payName || !pick) return
    const name = templates.find((t) => t.id === pick)?.name ?? 'packet'
    const ok = await confirmDialog({ message: `Assign the ${name} packet to ${payName}? Its documents appear as unsent until you send them.`, confirmLabel: 'Assign' })
    if (!ok) return
    setBusy('assign')
    try {
      const personDocs: PacketPersonDoc[] = (docs ?? []).filter((d): d is DocRow & { person_name: string } => Boolean(d.person_name)).map((d) => ({ id: d.id, person_name: d.person_name, document_name: d.document_name, signing_body_html: d.signing_body_html, lineage_version: d.lineage_version ?? 1 }))
      await materializePacketForPerson({ personName: payName, templateId: pick, templateDocs, personDocs })
      showToast(`${name} assigned — send each document from Contracts`, 'success')
      setPick('')
      onChanged()
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'That did not save', 'error')
    } finally {
      setBusy(null)
    }
  }

  async function toggleNag(id: string, next: boolean) {
    setBusy(`nag-${id}`)
    const { error } = await supabase.from('person_contract_documents').update({ dashboard_prompt_after_clock_in: next }).eq('id', id)
    setBusy(null)
    if (error) showToast(error.message, 'error')
    else onChanged()
  }

  const contractsHref = '/people?tab=contracts'
  const unassigned = templates.filter((t) => !assigned.includes(t.id))

  return (
    <DeskSection id="paperwork" title="Paperwork" who={canEdit ? undefined : 'contracts roles'}>
      {!payName && !personId ? (
        <DeskEmpty>Paperwork keys on the pay name — an account or roster row gives them one.</DeskEmpty>
      ) : (
        <>
          <DeskRow
            label="On file"
            actions={
              <>
                {canEdit && payName && !addingDoc ? (
                  <button type="button" style={deskBtn(BTN)} onClick={() => setAddingDoc(true)} title="File a COI, W-9, license, or a paper-signed agreement — typed from the start">
                    Add document
                  </button>
                ) : null}
                {summary.unsent > 0 || summary.sent > 0 ? (
                  <a href={contractsHref} style={{ ...BTN_BLUE, textDecoration: 'none' }}>
                    Send on Contracts
                  </a>
                ) : null}
                <a href={contractsHref} style={{ ...BTN_QUIET, textDecoration: 'none' }}>
                  Upload signed
                </a>
              </>
            }
          >
            {docs == null ? (
              <span style={{ color: 'var(--text-muted)' }}>Loading…</span>
            ) : lines.length === 0 ? (
              <span style={{ color: 'var(--text-muted)' }}>No documents yet — assign a packet below</span>
            ) : (
              lines.map((l) => (
                <Chip key={l.id} tone={TONE[l.state]} title={l.detail}>
                  {l.name}
                  {l.state === 'signed' ? '' : ` · ${l.state === 'unsent' ? 'unsent' : l.state === 'sent' ? 'sent' : l.state}`}
                </Chip>
              ))
            )}
          </DeskRow>
          {canEdit && payName && addingDoc ? (
            <DeskRow label="Add document">
              <div style={{ flexBasis: '100%' }}>
                <SubDocumentAddForm
                  personId={personId}
                  personName={payName}
                  onCancel={() => setAddingDoc(false)}
                  onSaved={() => {
                    setAddingDoc(false)
                    showToast('Filed — the compliance badge updates now', 'success')
                    onChanged()
                  }}
                />
              </div>
            </DeskRow>
          ) : null}
          <DeskRow label="Clock-in nag" actions={canEdit ? null : <LockTag label="contracts roles" />}>
            {lines.filter((l) => l.state !== 'signed').length === 0 ? (
              <span style={{ color: 'var(--text-muted)' }}>Nothing unsigned to nag about</span>
            ) : (
              lines
                .filter((l) => l.state !== 'signed')
                .map((l) => (
                  <label key={l.id} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem', cursor: canEdit ? 'pointer' : 'default' }} title="Ask them to sign at clock-in until it's signed">
                    <input type="checkbox" checked={l.nag} disabled={!canEdit || busy === `nag-${l.id}`} onChange={(e) => void toggleNag(l.id, e.target.checked)} />
                    {l.name}
                  </label>
                ))
            )}
          </DeskRow>
          <DeskRow
            label="Packet"
            actions={
              canEdit && payName && unassigned.length > 0 ? (
                <button type="button" style={deskBtn(BTN, !pick || busy === 'assign')} disabled={!pick || busy === 'assign'} onClick={() => void assignPacket()}>
                  {busy === 'assign' ? 'Assigning…' : 'Assign'}
                </button>
              ) : null
            }
          >
            {assigned.length > 0 ? assigned.map((id) => <Chip key={id} tone="gray">{templates.find((t) => t.id === id)?.name ?? 'packet'}</Chip>) : <span style={{ color: 'var(--text-muted)' }}>None assigned</span>}
            {canEdit && payName && unassigned.length > 0 ? (
              <select value={pick} onChange={(e) => setPick(e.target.value)} style={{ fontSize: '0.8125rem', padding: '0.1rem 0.3rem' }} aria-label="Packet to assign">
                <option value="">Add a packet…</option>
                {unassigned.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
            ) : null}
          </DeskRow>
        </>
      )}
    </DeskSection>
  )
}
