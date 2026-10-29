/**
 * Materials on site (punch list #209): a box as a door in Go anywhere. Type a stencil ("A1"), a part that
 * is in it ("3/4 copper") or its place ("level 2"), and the header's box lists the box with its job and
 * opens it: the office lands on the job's materials page, with the phone screen a second press away; a
 * crew lands on the box itself. Pure: the screens hand in what the store holds.
 */
import type { Door } from '../search/doors'
import { containerWords, linesOf, placeName, type Container, type ContainerLine, type Place } from './onSite'

export type BoxSearchJob = { id: string; label: string }

export function boxOnSiteLink(jobId: string, containerId: string): string {
  return `/tally?tab=on-site&job=${jobId}&container=${containerId}`
}

export function boxDeskLink(jobId: string): string {
  return `/jobs?tab=materials&job=${jobId}`
}

export const BOX_PHONE_SCREEN_WORDS = 'Open on the phone screen'

/** One door per live box, in the order given; a job with no name reads by its id's start. */
export function boxDoors(input: { jobs: ReadonlyArray<BoxSearchJob>; containers: ReadonlyArray<Container>; lines: ReadonlyArray<ContainerLine>; places: ReadonlyArray<Place>; forField: boolean }): Door[] {
  const jobLabel = new Map(input.jobs.map((j) => [j.id, j.label] as const))
  return input.containers
    .filter((c) => !c.retiredAt)
    .map((c) => {
      const job = jobLabel.get(c.jobId) ?? `job ${c.jobId.slice(0, 8)}`
      const place = c.locationId ? placeName(input.places, c.locationId) : ''
      const parts = linesOf(input.lines, c.id).filter((l) => l.onHand > 0)
      const words = new Set<string>([c.label.toLowerCase(), c.kind, job.toLowerCase()])
      if (place) words.add(place.toLowerCase())
      if (c.where) words.add(c.where.toLowerCase())
      for (const l of parts) {
        words.add(l.partName.toLowerCase())
        if (l.manufacturer) words.add(l.manufacturer.toLowerCase())
      }
      const phone = boxOnSiteLink(c.jobId, c.id)
      return {
        id: `box:${c.id}`,
        kind: 'box',
        label: containerWords(c),
        where: [job, place, c.where].filter(Boolean).join(' · '),
        words: [...words],
        to: input.forField ? phone : boxDeskLink(c.jobId),
        gate: () => true,
        ...(input.forField ? {} : { also: { label: BOX_PHONE_SCREEN_WORDS, to: phone } }),
      } satisfies Door
    })
}
