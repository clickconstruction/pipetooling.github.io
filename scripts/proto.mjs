#!/usr/bin/env node
/**
 * Jump into one of punch list #217's prototypes (Show it, don't say it) on your own machine.
 *
 *   npm run proto                    → the list: id, PR, state, version, port, door
 *   npm run proto -- outside-2       → fetch its PR branch into .claude/worktrees/proto-outside-2, start Vite there on
 *                                      its own port, open the door with today's look above the shape (?sbs=1)
 *   npm run proto -- 6574            → the same, by PR number
 *   flags: --no-open (print the link only), --port 5555, --fresh (recreate the worktree)
 *
 * The list is to-dos/show-not-tell/prototypes.json, the same file the mock-up page draws its bars from. A door that
 * signs in as the dev goes through /dev-login, which needs VITE_DEV_LOGIN_SECRET in .env.local (the main checkout's
 * copy is symlinked into the worktree, with node_modules); the portal and sample pages need no sign-in. A shipped one
 * is on main already, so this serves the checkout you are in. Ctrl-C stops the server; the worktree stays for next
 * time (--fresh rebuilds it; `git worktree remove .claude/worktrees/proto-<id>` drops it).
 */
import { spawn, execFileSync } from 'node:child_process'
import { existsSync, readFileSync, symlinkSync, rmSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import http from 'node:http'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const MANIFEST = join(ROOT, 'to-dos', 'show-not-tell', 'prototypes.json')
const PR_URL = 'https://github.com/clickconstruction/pipetooling.github.io/pull/'

const args = process.argv.slice(2)
const flag = (name) => args.includes(name)
const flagValue = (name) => {
  const i = args.indexOf(name)
  return i >= 0 ? args[i + 1] : undefined
}
const want = args.find((a) => !a.startsWith('--') && a !== flagValue('--port'))

const list = JSON.parse(readFileSync(MANIFEST, 'utf8')).prototypes

function doorUrl(p, port) {
  const base = `http://localhost:${port}`
  return p.as === 'dev' ? `${base}/dev-login?as=1&to=${encodeURIComponent(p.door)}` : base + p.door
}

function printList() {
  console.log(`Punch list #217's prototypes and builds, ${list.length} places (to-dos/show-not-tell/prototypes.json):\n`)
  const w = Math.max(...list.map((p) => p.id.length))
  for (const p of list) {
    const state = p.kind === 'shipped' ? 'shipped' : p.kind === 'build' ? 'built  ' : 'proto  '
    console.log(`  ${p.id.padEnd(w)}  #${p.pr}  ${state}  ${p.ver}  :${p.port}  ${p.door}${p.note ? `  (${p.note})` : ''}`)
  }
  console.log('\n  npm run proto -- <id or PR number>   starts one and opens its door · --no-open · --port N · --fresh')
}

if (!want || flag('--list')) {
  printList()
  process.exit(0)
}

const p = list.find((x) => x.id === want || String(x.pr) === want.replace(/^#/, ''))
if (!p) {
  console.error(`Nothing is called "${want}". The ids:\n  ${list.map((x) => x.id).join('\n  ')}`)
  process.exit(1)
}

function git(cwd, ...a) {
  return execFileSync('git', a, { cwd, stdio: ['ignore', 'pipe', 'inherit'] }).toString().trim()
}

let dir = ROOT
if (p.kind === 'shipped') {
  console.log(`${p.id} shipped as ${p.ver} (PR #${p.pr}) and is on main, so this serves the checkout you are in.`)
} else {
  console.log(`${p.id} · PR #${p.pr} (${p.ver}) · ${PR_URL}${p.pr}\nfetching ${p.branch}…`)
  try {
    git(ROOT, 'fetch', '-q', 'origin', p.branch)
  } catch {
    console.error(
      `\nThe branch ${p.branch} is not on origin any more. If the PR merged, the shape is on main (npm run dev, then ${p.door}); if it was closed, the PR page says why: ${PR_URL}${p.pr}`,
    )
    process.exit(1)
  }
  dir = join(ROOT, '.claude', 'worktrees', `proto-${p.id}`)
  if (flag('--fresh') && existsSync(dir)) {
    try {
      git(ROOT, 'worktree', 'remove', '--force', dir)
    } catch {
      rmSync(dir, { recursive: true, force: true })
    }
  }
  if (!existsSync(dir)) git(ROOT, 'worktree', 'add', '--detach', dir, `origin/${p.branch}`)
  else git(dir, 'checkout', '-q', '--detach', `origin/${p.branch}`)
  for (const name of ['node_modules', '.env.local']) {
    const src = join(ROOT, name)
    const dst = join(dir, name)
    if (existsSync(src) && !existsSync(dst)) symlinkSync(src, dst)
  }
  console.log(`worktree ${dir} at ${git(dir, 'rev-parse', '--short', 'HEAD')}`)
}
if (p.as === 'dev' && !existsSync(join(dir, '.env.local'))) {
  console.warn(
    "\nThis door signs in as the dev through /dev-login, which needs VITE_DEV_LOGIN_SECRET in .env.local; put the main checkout's copy beside package.json and run this again.",
  )
}

const port = Number(flagValue('--port') || p.port)
const url = doorUrl(p, port)

function ping(cb) {
  const req = http.get({ host: 'localhost', port, path: '/', timeout: 1500 }, (res) => {
    res.resume()
    cb(true)
  })
  req.on('error', () => cb(false))
  req.on('timeout', () => {
    req.destroy()
    cb(false)
  })
}

function open(u) {
  if (flag('--no-open')) return
  const cmd =
    process.platform === 'darwin' ? ['open', [u]] : process.platform === 'win32' ? ['cmd', ['/c', 'start', '', u]] : ['xdg-open', [u]]
  try {
    spawn(cmd[0], cmd[1], { stdio: 'ignore', detached: true }).unref()
  } catch {
    /* the link is printed either way */
  }
}

ping((up) => {
  if (up) {
    console.log(`\nSomething already answers on :${port}; opening the door there.\n  ${url}\n`)
    open(url)
    return
  }
  console.log(`\nstarting vite on :${port} in ${dir === ROOT ? 'this checkout' : dir} (Ctrl-C stops it)`)
  const vite = spawn('npx', ['vite', '--port', String(port), '--strictPort'], {
    cwd: dir,
    stdio: 'inherit',
    shell: process.platform === 'win32',
  })
  vite.on('exit', (code) => process.exit(code ?? 0))
  const stop = () => vite.kill('SIGINT')
  process.on('SIGINT', stop)
  process.on('SIGTERM', stop)
  let tries = 0
  const wait = () =>
    ping((ok) => {
      if (ok) {
        console.log(`\n  ${url}\n`)
        open(url)
        return
      }
      if (++tries > 60) {
        console.error('\nvite did not answer within a minute; once it does, the door is the link above.')
        return
      }
      setTimeout(wait, 1000)
    })
  setTimeout(wait, 1500)
})
