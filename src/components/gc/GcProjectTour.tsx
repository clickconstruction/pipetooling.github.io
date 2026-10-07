/**
 * GC mode design spike: *Walk me through this job* (the tour's round five; mock-up
 * `to-dos/gc-mode/mockups/tour-round-five.md`). The walk for the job's stage (`projectTourSteps`).
 * Each stop opens the tab its anchor is on just before it shows, so the stop and its tab draw
 * together. Done or Skip tour puts back the tab the walk started from.
 */
import { useCallback, useMemo, useRef } from 'react'
import { SpotlightTour } from '../SpotlightTour'
import { projectTourSteps, type GcTourTab } from '../../lib/gcMode/gcTour'
import type { GcStage } from '../../lib/gcMode/gcTypes'

export function GcProjectTour<T extends string>({ stage, from, onTab, onClose }: { stage: GcStage; from: T; onTab: (tab: T | GcTourTab) => void; onClose: () => void }) {
  const steps = useMemo(() => projectTourSteps(stage), [stage])
  // The tab the walk started from, kept once: Done or Skip tour puts it back.
  const start = useRef(from)
  const onStep = useCallback(
    (index: number) => {
      const tab = steps[index]?.tab
      if (tab) onTab(tab)
    },
    [steps, onTab],
  )
  return (
    <SpotlightTour
      steps={steps}
      onStep={onStep}
      onClose={() => {
        onTab(start.current)
        onClose()
      }}
    />
  )
}
