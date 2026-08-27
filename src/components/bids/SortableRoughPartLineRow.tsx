import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { MoneyDecimalAmountInput } from '../MoneyDecimalAmountInput'
import { TakeoffPartEditIcon } from '../icons/TakeoffPartEditIcon'
import type { Database } from '../../types/database'
import type { BidCountRow } from '../../types/bids'
import type { BundlePartLine } from '../../lib/bids/assemblyBundleBreakdown'
import type { MaterialTemplateWithAssemblyType, TakeoffRoughPartLineRow } from '../../lib/bids/bidPricingEngineTypes'
import { formatCurrency } from '../../lib/format'
import { catalogUnitPricesEffectivelyEqual } from '../../lib/materialPartCatalogPrice'
import { roughCountMultiplier, takeoffFixtureCountLabel } from '../../lib/bids/bidTakeoffHelpers'
import { takeoffRowDomId } from '../../lib/bids/bidTabRowJump'

type MaterialPart = Database['public']['Tables']['material_parts']['Row']

export interface PartType {
  id: string
  service_type_id: string
  name: string
  category: string | null
  sequence_order: number
  created_at: string
  updated_at: string
}

export type RoughTakeoffMaterialPart = MaterialPart & { part_types?: PartType | null }

/**
 * One sortable line row of the Rough ("Combined") part-line sheet — verbatim
 * module move out of BidsTakeoffTab.tsx (T3 of the Takeoff decomposition;
 * see BIDS_TAKEOFF_TAB_ARCHITECTURE.md). PartType / RoughTakeoffMaterialPart
 * moved with it; the tab imports them back.
 */
export function SortableRoughPartLineRow({
  line,
  lineIdx,
  row,
  jumpFlash,
  showSaveAsAssembly,
  onSaveAsAssembly,
  takeoffAddTemplateParts,
  takeoffRoughPartPickerLineId,
  setTakeoffRoughPartPickerLineId,
  takeoffRoughPartSearchQuery,
  setTakeoffRoughPartSearchQuery,
  takeoffRoughCatalogLowestByPartId,
  setRoughPartLinePartAndCatalogPrice,
  updateTakeoffRoughPartLine,
  resetRoughLineToCatalogPrice,
  setPartPricesModal,
  onRequestRemoveRoughLine,
  onOpenBundleBreakdown,
  bundlePartLines,
  bundleCollapsed,
  onToggleBundleCollapsed,
  openBidsPartFormForCreate,
  onOpenEditTakeoffPart,
  materialTemplates,
  filterPartsByQuery,
  partAssemblyCount,
  onShowAssembliesForPart,
  roughQtyNumpadLineId,
  roughQtyNumpadDraft,
  onRoughQtyFocus,
  onRoughQtyBlur,
  onRoughQtyInputChange,
  onRoughQtyPadEscape,
}: {
  line: TakeoffRoughPartLineRow
  lineIdx: number
  row: BidCountRow
  /** Breakdown jump (v2.2400): tint this row while its fixture's landing flash is on. */
  jumpFlash?: boolean
  showSaveAsAssembly: boolean
  onSaveAsAssembly: () => void
  takeoffAddTemplateParts: RoughTakeoffMaterialPart[]
  takeoffRoughPartPickerLineId: string | null
  setTakeoffRoughPartPickerLineId: (id: string | null) => void
  takeoffRoughPartSearchQuery: string
  setTakeoffRoughPartSearchQuery: (q: string) => void
  takeoffRoughCatalogLowestByPartId: Record<string, { price: number; supplyHouseName: string }>
  setRoughPartLinePartAndCatalogPrice: (lineId: string, partId: string) => void | Promise<void>
  updateTakeoffRoughPartLine: (
    lineId: string,
    updates: Partial<
      Pick<
        TakeoffRoughPartLineRow,
        'partId' | 'quantity' | 'unitPrice' | 'sequenceOrder' | 'sourceMaterialPartPriceId' | 'sourceTemplateId'
      >
    >
  ) => void
  resetRoughLineToCatalogPrice: (lineId: string) => void | Promise<void>
  setPartPricesModal: (v: { partId: string; partName: string; defaultAddPrice?: string; lineId?: string } | null) => void
  onRequestRemoveRoughLine: (lineId: string) => void
  onOpenBundleBreakdown: (templateId: string, lineId: string, assemblyName: string) => void
  bundlePartLines: BundlePartLine[] | undefined
  bundleCollapsed: boolean
  onToggleBundleCollapsed: () => void
  openBidsPartFormForCreate: (initialName: string, roughLineId?: string) => void
  onOpenEditTakeoffPart: (partId: string) => void
  materialTemplates: MaterialTemplateWithAssemblyType[]
  filterPartsByQuery: (parts: RoughTakeoffMaterialPart[], query: string, limit?: number) => RoughTakeoffMaterialPart[]
  partAssemblyCount: number
  onShowAssembliesForPart: (partId: string) => void
  roughQtyNumpadLineId: string | null
  roughQtyNumpadDraft: string
  onRoughQtyFocus: (lineId: string, input: HTMLInputElement) => void
  onRoughQtyBlur: (lineId: string) => void
  onRoughQtyInputChange: (lineId: string, raw: string) => void
  onRoughQtyPadEscape: () => void
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: line.id })
  const roughQtyPadActive = roughQtyNumpadLineId === line.id
  const lineTotal = Number(line.quantity) * Number(line.unitPrice) * roughCountMultiplier(row.count)
  // Assembly bundle line: one opaque line priced from material_template_prices (no individual part).
  const isBundle = line.partId == null && line.sourceTemplateId != null
  const bundleName = isBundle
    ? (materialTemplates.find((t) => t.id === line.sourceTemplateId)?.name ?? 'Assembly')
    : ''
  const partName = line.partId ? (takeoffAddTemplateParts.find((p) => p.id === line.partId)?.name ?? '') : ''
  const roughCatalogLow = line.partId ? takeoffRoughCatalogLowestByPartId[line.partId] : undefined
  const roughMatchesLowest =
    roughCatalogLow != null && catalogUnitPricesEffectivelyEqual(line.unitPrice, roughCatalogLow.price)
  const roughUnitPriceStatus =
    roughMatchesLowest && roughCatalogLow ? (
      <span
        title={`lowest: ${roughCatalogLow.supplyHouseName}`}
        style={{
          fontSize: '0.7rem',
          color: 'var(--text-green-600)',
          maxWidth: '100%',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
          textAlign: 'left',
        }}
      >
        lowest: {roughCatalogLow.supplyHouseName}
      </span>
    ) : !roughCatalogLow ? (
      <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textAlign: 'left' }}>No catalog price</span>
    ) : (
      <span style={{ fontSize: '0.7rem', color: 'var(--text-amber-800)', textAlign: 'left' }}>Bid override</span>
    )
  const bundleRows = isBundle ? (bundlePartLines ?? []) : []
  const showBundleRows = isBundle && !bundleCollapsed && bundleRows.length > 0
  const rowTransformStyle = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.5 : 1 }
  return (
    <>
    <tr
      ref={setNodeRef}
      // Breakdown jump landing (v2.2400): the fixture's first line row carries the
      // jump id; jumpFlash tints the whole fixture cluster for the flash window.
      id={lineIdx === 0 ? takeoffRowDomId(row.id) : undefined}
      style={{
        borderBottom: showBundleRows ? 'none' : '1px solid var(--border)',
        ...(jumpFlash ? { background: 'var(--bg-blue-tint)', transition: 'background 400ms ease' } : {}),
        ...rowTransformStyle,
      }}
    >
      <td style={{ padding: '0.75rem', verticalAlign: 'top' }}>
        {lineIdx === 0 ? (
          <div>
            <div>{takeoffFixtureCountLabel(row)}</div>
            {showSaveAsAssembly ? (
              <span
                role="button"
                tabIndex={0}
                onClick={onSaveAsAssembly}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault()
                    onSaveAsAssembly()
                  }
                }}
                style={{
                  display: 'inline-block',
                  marginTop: '0.35rem',
                  marginLeft: '1.5rem',
                  fontSize: '0.75rem',
                  color: 'var(--text-600)',
                  cursor: 'pointer',
                  textDecoration: 'underline',
                  textUnderlineOffset: '2px',
                }}
              >
                Save as Assembly
              </span>
            ) : null}
          </div>
        ) : null}
      </td>
      <td style={{ padding: '0.75rem', minWidth: 200 }}>
        {isBundle ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
            <span style={{ fontWeight: 500 }}>{bundleName}</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
            <button
              type="button"
              title="View parts and compare prices"
              onClick={() => {
                if (line.sourceTemplateId) onOpenBundleBreakdown(line.sourceTemplateId, line.id, bundleName)
              }}
              style={{
                alignSelf: 'flex-start',
                fontSize: '0.7rem',
                fontWeight: 600,
                textTransform: 'uppercase',
                letterSpacing: '0.03em',
                color: 'var(--text-blue-700)',
                background: 'var(--bg-blue-tint)',
                border: '1px solid var(--border-blue)',
                borderRadius: 4,
                padding: '0.05rem 0.35rem',
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.25rem',
              }}
            >
              Assembly bundle
              <span aria-hidden style={{ fontSize: '0.65rem' }}>▸</span>
            </button>
            {bundleRows.length > 0 && (
              <button
                type="button"
                onClick={onToggleBundleCollapsed}
                aria-expanded={!bundleCollapsed}
                title={bundleCollapsed ? 'Show parts' : 'Hide parts'}
                style={{
                  alignSelf: 'flex-start',
                  fontSize: '0.7rem',
                  color: 'var(--text-muted)',
                  background: 'none',
                  border: 'none',
                  padding: 0,
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.25rem',
                }}
              >
                <span aria-hidden>{bundleCollapsed ? '▸' : '▾'}</span>
                {bundleRows.length} {bundleRows.length === 1 ? 'part' : 'parts'}
              </button>
            )}
            </div>
          </div>
        ) : (
        <div style={{ position: 'relative' }}>
          <div style={{ display: 'flex', gap: '0.25rem', alignItems: 'center' }}>
            <input
              type="text"
              value={takeoffRoughPartPickerLineId === line.id ? takeoffRoughPartSearchQuery : partName}
              onChange={(e) => setTakeoffRoughPartSearchQuery(e.target.value)}
              onFocus={() => {
                setTakeoffRoughPartPickerLineId(line.id)
                setTakeoffRoughPartSearchQuery('')
              }}
              onBlur={() => setTimeout(() => setTakeoffRoughPartPickerLineId(null), 150)}
              onKeyDown={(e) => {
                if (e.key === 'Escape') setTakeoffRoughPartPickerLineId(null)
              }}
              readOnly={takeoffRoughPartPickerLineId !== line.id && !!line.partId}
              placeholder="Search parts…"
              style={{
                flex: 1,
                padding: '0.5rem',
                border: '1px solid var(--border-strong)',
                borderRadius: 4,
                background: takeoffRoughPartPickerLineId !== line.id && line.partId ? 'var(--bg-muted)' : undefined,
              }}
            />
          </div>
          {takeoffRoughPartPickerLineId === line.id && (
            <ul
              style={{
                position: 'absolute',
                left: 0,
                right: 0,
                top: '100%',
                margin: 0,
                marginTop: 2,
                padding: 0,
                listStyle: 'none',
                maxHeight: 220,
                overflowY: 'auto',
                border: '1px solid var(--border-strong)',
                borderRadius: 4,
                background: 'var(--surface)',
                zIndex: 50,
                boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
              }}
            >
              {takeoffAddTemplateParts.length === 0 ? (
                <li style={{ padding: '0.75rem', color: 'var(--text-muted)' }}>Loading parts…</li>
              ) : filterPartsByQuery(takeoffAddTemplateParts, takeoffRoughPartSearchQuery).length === 0 ? (
                <li style={{ padding: '0.75rem', color: 'var(--text-muted)' }}>
                  No parts match.{' '}
                  <button
                    type="button"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => {
                      // Pass the line id explicitly (v2.1395): the picker state
                      // set below is nulled by this input's onBlur as soon as
                      // the form takes focus, so it can't be trusted at save.
                      openBidsPartFormForCreate(takeoffRoughPartSearchQuery.trim(), line.id)
                      setTakeoffRoughPartPickerLineId(line.id)
                    }}
                    style={{
                      marginLeft: '0.25rem',
                      padding: '0.25rem 0.5rem',
                      background: '#3b82f6',
                      color: 'white',
                      border: 'none',
                      borderRadius: 4,
                      cursor: 'pointer',
                      fontWeight: 500,
                    }}
                  >
                    Add Part
                  </button>
                </li>
              ) : (
                filterPartsByQuery(takeoffAddTemplateParts, takeoffRoughPartSearchQuery).map((p) => (
                  <li
                    key={p.id}
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => {
                      void setRoughPartLinePartAndCatalogPrice(line.id, p.id)
                      setTakeoffRoughPartPickerLineId(null)
                      setTakeoffRoughPartSearchQuery('')
                    }}
                    style={{ padding: '0.5rem 0.75rem', cursor: 'pointer', borderBottom: '1px solid var(--border)' }}
                  >
                    <div style={{ fontWeight: 500 }}>{p.name}</div>
                    {(p.manufacturer || p.part_types?.name) && (
                      <div style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>
                        {[p.manufacturer, p.part_types?.name].filter(Boolean).join(' · ')}
                      </div>
                    )}
                  </li>
                ))
              )}
            </ul>
          )}
          {line.partId && takeoffRoughPartPickerLineId !== line.id ? (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '0.35rem',
                marginTop: '0.2rem',
                minWidth: 0,
              }}
            >
              <span
                style={{
                  fontSize: '0.7rem',
                  color: 'var(--text-muted)',
                  textAlign: 'left',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                  minWidth: 0,
                  flex: 1,
                }}
              >
                {(() => {
                  const partTypeName =
                    takeoffAddTemplateParts.find((p) => p.id === line.partId)?.part_types?.name ?? '—'
                  let s = `Part · ${partTypeName}`
                  if (line.sourceTemplateId) {
                    const asmName = materialTemplates.find((t) => t.id === line.sourceTemplateId)?.name
                    s += asmName ? ` · ${asmName}` : ' · —'
                  }
                  return s
                })()}
              </span>
              {partAssemblyCount > 0 ? (
                <button
                  type="button"
                  title="Show assemblies that include this part"
                  onClick={(e) => {
                    e.stopPropagation()
                    if (line.partId) onShowAssembliesForPart(line.partId)
                  }}
                  style={{
                    flexShrink: 0,
                    padding: 0,
                    background: 'none',
                    border: 'none',
                    fontSize: '0.7rem',
                    color: 'var(--text-blue-700)',
                    textDecoration: 'underline',
                    textUnderlineOffset: '2px',
                    cursor: 'pointer',
                    whiteSpace: 'nowrap',
                  }}
                >
                  In {partAssemblyCount} {partAssemblyCount === 1 ? 'assembly' : 'assemblies'}
                </button>
              ) : null}
              <button
                type="button"
                aria-label="Edit part"
                title="Edit part"
                onClick={(e) => {
                  e.stopPropagation()
                  onOpenEditTakeoffPart(line.partId ?? '')
                }}
                style={{
                  flexShrink: 0,
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  minWidth: 28,
                  minHeight: 28,
                  padding: '0.2rem',
                  background: 'none',
                  border: 'none',
                  borderRadius: 4,
                  cursor: 'pointer',
                  color: 'var(--text-muted)',
                }}
              >
                <TakeoffPartEditIcon />
              </button>
            </div>
          ) : null}
        </div>
        )}
      </td>
      <td style={{ padding: '0.75rem 0.25rem 0.75rem 0.75rem', textAlign: 'left', verticalAlign: 'top' }}>
        {!line.partId ? (
          <MoneyDecimalAmountInput
            value={Math.max(0, Number(line.unitPrice) || 0)}
            onChange={(n) =>
              updateTakeoffRoughPartLine(line.id, {
                unitPrice: Math.max(0, n),
                sourceMaterialPartPriceId: null,
              })
            }
            aria-label="Unit price"
            style={{ width: 96, minWidth: 88, padding: '0.5rem', border: '1px solid var(--border-strong)', borderRadius: 4, textAlign: 'center' }}
          />
        ) : (
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'flex-start',
              gap: '0.25rem',
              maxWidth: '100%',
              paddingLeft: '0.35rem',
            }}
          >
            <div
              style={{
                display: 'flex',
                flexDirection: 'row',
                flexWrap: 'wrap',
                alignItems: 'flex-start',
                justifyContent: 'flex-start',
                gap: '0.35rem',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'flex-start',
                  gap: '0.2rem',
                }}
              >
                <MoneyDecimalAmountInput
                  value={Math.max(0, Number(line.unitPrice) || 0)}
                  onChange={(n) =>
                    updateTakeoffRoughPartLine(line.id, {
                      unitPrice: Math.max(0, n),
                      sourceMaterialPartPriceId: null,
                    })
                  }
                  aria-label="Unit price"
                  style={{ width: 96, minWidth: 88, padding: '0.5rem', border: '1px solid var(--border-strong)', borderRadius: 4, textAlign: 'center' }}
                />
                {roughUnitPriceStatus}
              </div>
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'flex-start',
                  gap: '0.25rem',
                }}
              >
                <span
                  role="button"
                  tabIndex={0}
                  onClick={() => void resetRoughLineToCatalogPrice(line.id)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault()
                      void resetRoughLineToCatalogPrice(line.id)
                    }
                  }}
                  style={{
                    fontSize: '0.7rem',
                    color: 'var(--text-600)',
                    cursor: 'pointer',
                    textDecoration: 'underline',
                    textUnderlineOffset: '2px',
                    textAlign: 'left',
                  }}
                >
                  Reset to catalog
                </span>
                <span
                  role="button"
                  tabIndex={0}
                  onClick={() =>
                    setPartPricesModal({
                      partId: line.partId ?? '',
                      partName: takeoffAddTemplateParts.find((p) => p.id === line.partId)?.name ?? 'Part',
                      defaultAddPrice: Number(line.unitPrice) > 0 ? String(line.unitPrice) : '',
                      lineId: line.id,
                    })
                  }
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault()
                      setPartPricesModal({
                        partId: line.partId ?? '',
                        partName: takeoffAddTemplateParts.find((p) => p.id === line.partId)?.name ?? 'Part',
                        defaultAddPrice: Number(line.unitPrice) > 0 ? String(line.unitPrice) : '',
                        lineId: line.id,
                      })
                    }
                  }}
                  style={{
                    fontSize: '0.7rem',
                    color: 'var(--text-blue-700)',
                    cursor: 'pointer',
                    textDecoration: 'underline',
                    textUnderlineOffset: '2px',
                    textAlign: 'left',
                  }}
                >
                  Catalog prices
                </span>
              </div>
            </div>
          </div>
        )}
      </td>
      <td style={{ padding: '0.35rem 0.05rem 0.35rem 0.125rem', textAlign: 'center', verticalAlign: 'middle' }}>
        <input
          type={roughQtyPadActive ? 'text' : 'number'}
          inputMode={roughQtyPadActive ? 'decimal' : undefined}
          className="no-spinner rough-takeoff-qty-input"
          min={roughQtyPadActive ? undefined : 0.0001}
          step={roughQtyPadActive ? undefined : 'any'}
          value={roughQtyPadActive ? roughQtyNumpadDraft : line.quantity}
          // Clear-on-focus (v2.1329): while the draft is blank the old quantity
          // shows as placeholder; leaving without typing restores it.
          placeholder={roughQtyPadActive ? String(line.quantity) : undefined}
          onFocus={(e) => onRoughQtyFocus(line.id, e.currentTarget)}
          onBlur={() => onRoughQtyBlur(line.id)}
          onKeyDown={(e) => {
            if (e.key === 'Escape' && roughQtyPadActive) {
              e.preventDefault()
              onRoughQtyPadEscape()
            }
          }}
          onChange={(e) => onRoughQtyInputChange(line.id, e.target.value)}
          onWheel={roughQtyPadActive ? undefined : (ev) => ev.currentTarget.blur()}
          style={{ width: 56, maxWidth: '100%' }}
        />
      </td>
      <td
        style={{
          padding: '0.35rem 0.5rem 0.35rem 0.05rem',
          textAlign: 'right',
          fontSize: '0.875rem',
          verticalAlign: 'middle',
          whiteSpace: 'nowrap',
        }}
      >
        ${formatCurrency(lineTotal)}
      </td>
      <td style={{ padding: '0.75rem', textAlign: 'center', verticalAlign: 'middle' }}>
        <div style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '0.35rem', flexWrap: 'wrap' }}>
          <button
            type="button"
            {...attributes}
            {...listeners}
            title="Drag to reorder"
            aria-label="Drag to reorder"
            style={{
              padding: '0.35rem',
              cursor: 'grab',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: 'var(--surface)',
              border: '1px solid var(--border)',
              borderRadius: 4,
              color: 'var(--text-muted)',
              lineHeight: 0,
            }}
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640" width={18} height={18} fill="currentColor" aria-hidden>
              <path d="M342.6 41.4C330.1 28.9 309.8 28.9 297.3 41.4L201.3 137.4C188.8 149.9 188.8 170.2 201.3 182.7C213.8 195.2 234.1 195.2 246.6 182.7L288 141.3L288 498.7L246.6 457.4C234.1 444.9 213.8 444.9 201.3 457.4C188.8 469.9 188.8 490.2 201.3 502.7L297.3 598.7C303.3 604.7 311.4 608.1 319.9 608.1C328.4 608.1 336.5 604.7 342.5 598.7L438.5 502.7C451 490.2 451 469.9 438.5 457.4C426 444.9 405.7 444.9 393.2 457.4L351.8 498.8L351.8 141.3L393.2 182.7C405.7 195.2 426 195.2 438.5 182.7C451 170.2 451 149.9 438.5 137.4L342.5 41.4z" />
            </svg>
          </button>
          <button
            type="button"
            title="Remove"
            aria-label="Remove part line"
            onClick={() => onRequestRemoveRoughLine(line.id)}
            style={{
              padding: '0.35rem',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: 'var(--bg-red-tint)',
              color: 'var(--text-red-700)',
              border: '1px solid #fecaca',
              borderRadius: 4,
              cursor: 'pointer',
              lineHeight: 0,
            }}
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640" width={18} height={18} fill="currentColor" aria-hidden>
              <path d="M232.7 69.9L224 96L128 96C110.3 96 96 110.3 96 128C96 145.7 110.3 160 128 160L512 160C529.7 160 544 145.7 544 128C544 110.3 529.7 96 512 96L416 96L407.3 69.9C402.9 56.8 390.7 48 376.9 48L263.1 48C249.3 48 237.1 56.8 232.7 69.9zM512 208L128 208L149.1 531.1C150.7 556.4 171.7 576 197 576L443 576C468.3 576 489.3 556.4 490.9 531.1L512 208z" />
            </svg>
          </button>
        </div>
      </td>
    </tr>
    {/* Grayed, display-only breakdown of the bundle's parts. These rows are NOT in
        takeoffRoughPartLines, so they are never persisted and never counted toward any
        total — only the bundle line's unit price above contributes. */}
    {showBundleRows &&
      bundleRows.map((bp, i) => (
        <tr
          key={`${line.id}-bp-${bp.partId}`}
          style={{
            borderBottom: i === bundleRows.length - 1 ? '1px solid var(--border)' : '1px solid var(--border)',
            background: 'var(--bg-page)',
            color: 'var(--text-faint)',
            ...rowTransformStyle,
          }}
        >
          <td style={{ padding: '0.4rem 0.75rem' }} />
          <td style={{ padding: '0.4rem 0.75rem 0.4rem 1.75rem', fontSize: '0.8125rem' }}>
            {bp.name}
          </td>
          <td style={{ padding: '0.4rem 0.25rem 0.4rem 0.75rem', textAlign: 'left' }}>
            {bp.hasPrice ? (
              <input
                type="text"
                readOnly
                disabled
                value={`$${formatCurrency(bp.unitPrice)}`}
                title={bp.supplyHouseName ? `lowest: ${bp.supplyHouseName}` : undefined}
                aria-label={`${bp.name} catalog unit price (not counted)`}
                style={{
                  width: 96,
                  minWidth: 88,
                  padding: '0.4rem',
                  border: '1px solid var(--border)',
                  borderRadius: 4,
                  textAlign: 'center',
                  background: 'var(--bg-muted)',
                  color: 'var(--text-faint)',
                  cursor: 'not-allowed',
                }}
              />
            ) : (
              <span style={{ fontSize: '0.75rem' }}>— no catalog price</span>
            )}
          </td>
          <td style={{ padding: '0.4rem 0.25rem', textAlign: 'center', fontSize: '0.8125rem' }}>{bp.quantity}</td>
          <td style={{ padding: '0.4rem 0.5rem', textAlign: 'right', fontSize: '0.7rem' }}>
            <div style={{ fontStyle: 'italic' }}>not counted</div>
            {bp.supplyHouseName ? (
              <div style={{ color: 'var(--text-faint)', fontStyle: 'normal' }}>{bp.supplyHouseName}</div>
            ) : null}
          </td>
          <td style={{ padding: '0.4rem 0.75rem' }} />
        </tr>
      ))}
    </>
  )
}
