/**
 * The side a walked builder's left column shows, Edit or Share, for whoever keeps it (punch list #416). The Document
 * builder tab keeps it in the address, so it hands it down here and hears each press. A builder drawn with no one
 * keeping it, as a smoke draws it, opens on Edit and keeps the side itself.
 *
 * The rules and the words are `lib/documentBuilder/builderSide.ts`.
 */
import { createContext, useContext, useState, type ReactNode } from 'react'
import type { BuilderSide } from '../../lib/documentBuilder/builderSide'

type Kept = { side: BuilderSide; onSide: (side: BuilderSide) => void }

const BuilderSideContext = createContext<Kept | null>(null)

/** The side as its keeper holds it: the side to show, and where a press on the switch is told. */
export function BuilderSideProvider({ side, onSide, children }: Kept & { children: ReactNode }) {
  return <BuilderSideContext.Provider value={{ side, onSide }}>{children}</BuilderSideContext.Provider>
}

/** The side to show and the press that changes it. With a keeper, the keeper's side wins and hears every press. */
export function useBuilderSide(): { side: BuilderSide; pickSide: (side: BuilderSide) => void } {
  const kept = useContext(BuilderSideContext)
  const [own, setOwn] = useState<BuilderSide>('edit')
  if (kept) return { side: kept.side, pickSide: kept.onSide }
  return { side: own, pickSide: setOwn }
}
