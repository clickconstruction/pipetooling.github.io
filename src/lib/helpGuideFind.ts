/**
 * Finding words inside one rendered guide (v2.4655 — the § Rules window on the Lien desk):
 * every match wrapped in a `<mark data-find>` so it reads on the page, and the guide narrowed
 * to the sections that hold one. Works on the DOM the guide was drawn into, so the words it
 * marks are exactly the words the reader sees; the HTML string is never touched. A heading's
 * section runs to the next heading of its own rank or higher: an `h3` rule under an `h2`
 * group, the group's own lead paragraphs above its first rule.
 */

/** Undo `markFindMatches`: every mark becomes its text again, split text nodes rejoined. */
export function clearFindMarks(root: ParentNode): void {
  for (const m of Array.from(root.querySelectorAll('mark[data-find]'))) {
    const parent = m.parentNode
    if (!parent) continue
    parent.replaceChild(m.ownerDocument.createTextNode(m.textContent ?? ''), m)
    parent.normalize()
  }
}

const SKIP = new Set(['SCRIPT', 'STYLE', 'MARK'])

/** Wrap every case-insensitive match of `query` in the root's text in `<mark data-find>`; returns how many. Empty or one-letter queries mark nothing. */
export function markFindMatches(root: ParentNode, query: string): number {
  const q = query.trim().toLowerCase()
  if (q.length < 2) return 0
  const doc = (root as Node).ownerDocument ?? (root as Document)
  const walker = doc.createTreeWalker(root as Node, 4 /* NodeFilter.SHOW_TEXT */)
  const texts: Text[] = []
  for (let n = walker.nextNode(); n; n = walker.nextNode()) {
    const el = n.parentElement
    if (!el || SKIP.has(el.tagName)) continue
    if ((n.textContent ?? '').toLowerCase().includes(q)) texts.push(n as Text)
  }
  let count = 0
  for (const t of texts) {
    const text = t.textContent ?? ''
    const lower = text.toLowerCase()
    const frag = doc.createDocumentFragment()
    let at = 0
    for (let i = lower.indexOf(q); i >= 0; i = lower.indexOf(q, i + q.length)) {
      if (i > at) frag.appendChild(doc.createTextNode(text.slice(at, i)))
      const m = doc.createElement('mark')
      m.setAttribute('data-find', '')
      m.textContent = text.slice(i, i + q.length)
      frag.appendChild(m)
      at = i + q.length
      count += 1
    }
    if (at < text.length) frag.appendChild(doc.createTextNode(text.slice(at)))
    t.parentNode?.replaceChild(frag, t)
  }
  return count
}

const RANK: Record<string, number> = { H1: 1, H2: 2, H3: 3, H4: 4 }

/**
 * Hide every section with no mark in it (and show the rest) when `narrow` is on; show
 * everything when it is off. Returns how many headed sections stay visible. A section is a
 * heading and what follows it up to the next heading of its rank or higher; an element
 * before the first heading is shown when anything is.
 */
export function narrowToMarked(root: ParentNode, narrow: boolean): number {
  const children = Array.from(root.children) as HTMLElement[]
  if (!narrow) {
    for (const el of children) el.hidden = false
    return children.filter((el) => RANK[el.tagName]).length
  }
  const hasMark = (el: Element) => el.matches('mark[data-find]') || !!el.querySelector('mark[data-find]')
  // Each element's innermost section: the index of the heading it sits under per rank.
  type Section = { head: number; rank: number; members: number[]; hit: boolean }
  const sections: Section[] = []
  const open: Section[] = []
  for (let i = 0; i < children.length; i++) {
    const el = children[i]!
    const rank = RANK[el.tagName]
    if (rank) {
      while (open.length && open[open.length - 1]!.rank >= rank) open.pop()
      const s: Section = { head: i, rank, members: [i], hit: hasMark(el) }
      sections.push(s)
      open.push(s)
    } else {
      const s = open[open.length - 1]
      if (s) {
        s.members.push(i)
        if (hasMark(el)) s.hit = true
      }
    }
  }
  // A group is visible when it or any section nested under it hits.
  const visible = new Array<boolean>(children.length).fill(false)
  let shown = 0
  for (let a = 0; a < sections.length; a++) {
    const s = sections[a]!
    let hit = s.hit
    for (let b = a + 1; b < sections.length && sections[b]!.rank > s.rank; b++) if (sections[b]!.hit) hit = true
    if (!hit) continue
    shown += 1
    visible[s.head] = true
    // Its own members show only when the section itself hits; a nested section decides for its own.
    if (s.hit) for (const i of s.members) visible[i] = true
  }
  for (let i = 0; i < children.length; i++) {
    const el = children[i]!
    const beforeFirst = !sections.length || i < sections[0]!.head
    el.hidden = !(visible[i] || (beforeFirst && hasMark(el)))
  }
  return shown
}
