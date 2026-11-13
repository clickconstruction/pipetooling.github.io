#!/usr/bin/env node
/**
 * Farm Mode → Task Mode (v2.7050). The mode's name in the code and the living docs, in one pass.
 *
 *   node scripts/codemods/farm-mode-to-task-mode.mjs          rename the four files and rewrite the words
 *   node scripts/codemods/farm-mode-to-task-mode.mjs --check  exit 1 when a file in scope still says the old name
 *
 * On a rebase conflict take main's side of every file below and run this again: the script is the
 * source of truth, never a hand-resolved marker. The words written by hand ride in files this pass
 * renames or does not conflict on: the tip and the header note in `taskModeToggle.ts`, the strip's
 * mark in `TaskModeChip.tsx`, the guide `task-mode.md` and the glossary's entry.
 *
 * What it leaves alone, on purpose:
 * - a line that names v2.7050: the few that say the mode was Farm Mode until then;
 * - the three stored names in `taskModeToggle.ts` — the saved key `farm_mode_<user>`, the event
 *   `farm_mode_changed` and the usage ledger's control `farm_mode_exit` — so a device that has the
 *   mode on keeps it on, and the old rows still count;
 * - the farm itself: the partner ledger's farm rate and farm job, a roadmap named Farm 1, the Farm
 *   crew tag, a customer's name;
 * - history: release notes, `docs/recent-features/`, the frozen aggregators.
 */
import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'

const RENAMES = [
  ['src/lib/farmModeToggle.ts', 'src/lib/taskModeToggle.ts'],
  ['src/lib/farmModeToggle.test.ts', 'src/lib/taskModeToggle.test.ts'],
  ['src/hooks/useFarmModeEnabled.ts', 'src/hooks/useTaskModeEnabled.ts'],
  ['src/components/FarmModeChip.tsx', 'src/components/TaskModeChip.tsx'],
]

/** Every file that names the mode. A list, not a glob: the farm's own files are not in it. */
const FILES = [
  'src/lib/taskModeToggle.ts',
  'src/lib/taskModeToggle.test.ts',
  'src/hooks/useTaskModeEnabled.ts',
  'src/components/TaskModeChip.tsx',
  'src/components/Layout.tsx',
  'src/components/HeaderGlobalSearch.tsx',
  'src/components/personDesk/PersonQuickSheet.tsx',
  'src/hooks/usePinModeEnabled.ts',
  'src/hooks/useRoadmapNeedsNameNudges.ts',
  'src/lib/pinModeToggle.ts',
  'src/lib/assistantDispatchLanding.ts',
  'src/lib/dashboardNeedsYou.ts',
  'src/lib/fieldJobLookup.ts',
  'src/lib/fieldJobLookup.test.ts',
  'src/lib/headerTaskDispatchEstimatorEligible.ts',
  'src/lib/headerTaskDispatchEstimatorEligible.test.ts',
  'src/lib/people/personDeskGates.ts',
  'src/lib/people/personDeskGates.test.ts',
  'src/lib/roadmapVisibility.ts',
  'src/lib/roadmapVisibility.test.ts',
  'src/lib/search/doors.ts',
  'src/lib/search/doors.test.ts',
  'src/pages/Bids.tsx',
  'src/pages/Checklist.tsx',
  'src/pages/Roadmap.tsx',
  'src/content/help/plan-the-roadmap.md',
  'src/content/help/find-a-job-address-from-the-field.md',
  'src/content/help/pin-mode.md',
  'docs/ACCESS_CONTROL.md',
  'docs/APP_SHELL_ARCHITECTURE.md',
  'docs/CHECKLIST_TABS_ARCHITECTURE.md',
  'docs/DASHBOARD_SECTIONS_ARCHITECTURE.md',
  'docs/DOCUMENTS_PAGE_ARCHITECTURE.md',
  'docs/GLOSSARY.md',
  'docs/twins/APP_DIRECTORY.md',
]

/** Longest first, so a shorter rule never eats a longer name. */
const WORDS = [
  [/useFarmModeEnabled/g, 'useTaskModeEnabled'],
  [/FarmModeChip/g, 'TaskModeChip'],
  [/farmModeToggle/g, 'taskModeToggle'],
  [/FARM_MODE_/g, 'TASK_MODE_'],
  [/farmMode/g, 'taskMode'],
  [/FarmMode/g, 'TaskMode'],
  [/\bnotFarm\b/g, 'notTaskMode'],
  [/Farm Mode/g, 'Task Mode'],
  [/Farm-Mode/g, 'Task-Mode'],
]

/** The shell's map and its neighbours write the mode in shorthand. Docs only: in code the same words can mean the farm. */
const DOC_WORDS = [
  [/Farm · Pin/g, 'Task · Pin'],
  [/PO tab, Farm, Pin/g, 'PO tab, Task, Pin'],
  [/Farm > Dispatch/g, 'Task > Dispatch'],
  [/Job\/Farm\/Pin/g, 'Job/Task/Pin'],
  [/[Ff]arm bounce/g, 'Task Mode bounce'],
  [/role, farm, partner/g, 'role, Task Mode, partner'],
  [/Not farm-gated/g, 'Not gated by Task Mode'],
  [/navigation\. Farm `\[/g, 'navigation. Task Mode `['],
  [/branches: Farm \(/g, 'branches: Task Mode ('],
  [/lime Farm/g, 'lime Task'],
  [/hidden in farm mode/g, 'hidden in Task Mode'],
]

/** The shell's three lines the name alone does not carry: the phone dock row's key, the tip's kernel and its import. */
const LAYOUT_WORDS = [
  ["{ key: 'farm', label: 'Task Mode'", "{ key: 'task', label: 'Task Mode'"],
  ["title={taskModeEnabled ? 'Turn Task Mode off' : 'Turn Task Mode on — checklist only'}", 'title={taskModeToggleTip(taskModeEnabled)}'],
  ["import { TASK_MODE_EXIT_CONTROL, taskModeBounceTarget } from '../lib/taskModeToggle'", "import { TASK_MODE_EXIT_CONTROL, taskModeBounceTarget, taskModeToggleTip } from '../lib/taskModeToggle'"],
]

/** A line that tells the history names this version, and keeps the old name it is telling. */
const HISTORY = /v2\.7050/

/** What must be gone from a file in scope once the pass has run. */
const OLD = /farmMode|FarmMode|FARM_MODE_|Farm[ -]Mode|\bnotFarm\b/
const OLD_DOC = /Farm · Pin|PO tab, Farm|Farm > Dispatch|Job\/Farm|[Ff]arm bounce|role, farm,|farm-gated|navigation\. Farm|branches: Farm|lime Farm|farm mode/

const check = process.argv.includes('--check')

if (!check) {
  for (const [from, to] of RENAMES) {
    if (existsSync(from) && !existsSync(to)) execFileSync('git', ['mv', from, to], { stdio: 'inherit' })
  }
}

let changed = 0
const left = []
for (const file of FILES) {
  if (!existsSync(file)) {
    left.push(`${file}: not found`)
    continue
  }
  const before = readFileSync(file, 'utf8')
  if (check) {
    const doc = file.startsWith('docs/')
    const hit = before.split('\n').findIndex((line) => !HISTORY.test(line) && (OLD.test(line) || (doc && OLD_DOC.test(line))))
    if (hit >= 0) left.push(`${file}:${hit + 1}`)
    continue
  }
  const doc = file.startsWith('docs/')
  const after = before
    .split('\n')
    .map((line) => {
      if (HISTORY.test(line)) return line
      let next = line
      for (const [from, to] of WORDS) next = next.replace(from, to)
      if (doc) for (const [from, to] of DOC_WORDS) next = next.replace(from, to)
      if (file === 'src/components/Layout.tsx') for (const [from, to] of LAYOUT_WORDS) next = next.replace(from, to)
      return next
    })
    .join('\n')
  if (after !== before) {
    writeFileSync(file, after)
    changed += 1
  }
}

if (left.length > 0) {
  console.error(`farm-mode-to-task-mode: ${left.length} still to do\n  ${left.join('\n  ')}`)
  process.exit(1)
}
console.log(check ? `farm-mode-to-task-mode: clean, ${FILES.length} files hold the new name` : `farm-mode-to-task-mode: rewrote ${changed} of ${FILES.length} files`)
