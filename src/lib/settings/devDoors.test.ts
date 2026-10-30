import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { appRoutePathsFromSource, pathMatchesRoute } from '../twins/appDirectoryCheck'
import { plainWordsFailures } from '../plainWords'
import { DEV_DOOR_AREAS, DEV_DOOR_WHO_LABEL, DEV_DOORS, devDoorCounts, devDoorPath, devDoorsByArea, devDoorsHeadLine, type DevDoor } from './devDoors'

const root = resolve(__dirname, '../../..')
const routes = appRoutePathsFromSource(readFileSync(resolve(root, 'src/App.tsx'), 'utf8'))

describe('devDoors — the helpers', () => {
  it('reads the route part of a link', () => {
    expect(devDoorPath('/jobs?tab=stages&stagesMoney=1')).toBe('/jobs')
    expect(devDoorPath('/settings#settings-recently-deleted')).toBe('/settings')
    expect(devDoorPath('/gc')).toBe('/gc')
  })
  it('groups by area in the areas’ order and counts by who', () => {
    const doors: DevDoor[] = [
      { id: 'a', label: 'A', area: 'Jobs and the Pipeline', to: '/jobs', who: 'dev', what: 'A door.', gate: { file: 'src/App.tsx', text: 'Route' } },
      { id: 'b', label: 'B', area: 'Settings', to: '/settings', who: 'dev and controller', what: 'B door.', gate: { file: 'src/App.tsx', text: 'Route' } },
      { id: 'c', label: 'C', area: 'Jobs and the Pipeline', to: '/jobs', who: 'owner or dev', what: 'C door.', gate: { file: 'src/App.tsx', text: 'Route' } },
    ]
    expect(devDoorsByArea(doors).map((g) => [g.area, g.doors.map((d) => d.id)])).toEqual([
      ['Settings', ['b']],
      ['Jobs and the Pipeline', ['a', 'c']],
    ])
    const counts = devDoorCounts(doors)
    expect(counts).toEqual({ dev: 1, 'dev and controller': 1, 'owner or dev': 1, controller: 0 })
    expect(devDoorsHeadLine(counts)).toBe('3 doors today: 1 for a dev alone, 1 for a dev and the controller, 1 for the owner or a dev.')
  })
})

describe('DEV_DOORS agrees with the app — a row cannot rot silently', () => {
  it('has rows, unique ids, a who the card can print, and an area the order knows', () => {
    expect(DEV_DOORS.length).toBeGreaterThan(20)
    const ids = DEV_DOORS.map((d) => d.id)
    expect(new Set(ids).size).toBe(ids.length)
    for (const d of DEV_DOORS) {
      expect(DEV_DOOR_WHO_LABEL[d.who], d.id).toBeTruthy()
      expect(DEV_DOOR_AREAS, d.id).toContain(d.area)
      expect(d.label.trim(), d.id).not.toBe('')
    }
  })
  it('every link’s path is a route src/App.tsx serves', () => {
    const drift = DEV_DOORS.filter((d) => !routes.some((r) => pathMatchesRoute(devDoorPath(d.to), r))).map((d) => `${d.id}: ${d.to}`)
    expect(drift).toEqual([])
  })
  it('every link into a course names a course the bundle holds', () => {
    const courseDoors = DEV_DOORS.filter((d) => devDoorPath(d.to).startsWith('/training/'))
    expect(courseDoors.length).toBeGreaterThan(0)
    const drift = courseDoors.filter((d) => !existsSync(resolve(root, 'src/content/training', devDoorPath(d.to).slice('/training/'.length), 'course.md'))).map((d) => `${d.id}: ${d.to}`)
    expect(drift).toEqual([])
  })
  it('every row names a gate that is still in the code: the file exists and holds the text', () => {
    const drift: string[] = []
    for (const d of DEV_DOORS) {
      const path = resolve(root, d.gate.file)
      if (!existsSync(path)) {
        drift.push(`${d.id}: ${d.gate.file} is not in the repo`)
        continue
      }
      if (!readFileSync(path, 'utf8').includes(d.gate.text)) drift.push(`${d.id}: ${d.gate.file} no longer holds "${d.gate.text}"`)
    }
    expect(drift).toEqual([])
  })
  it('every what line is plain words', () => {
    const failures = DEV_DOORS.flatMap((d) => plainWordsFailures(d.what).map((f) => `${d.id}: ${f}`))
    expect(failures).toEqual([])
  })
})
