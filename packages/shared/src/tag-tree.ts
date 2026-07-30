// Tag forest helpers shared by the web UI and the API's ScopeService so both
// sides agree byte-for-byte on subtree-expansion semantics.

export type TagDef = {
  name: string
  parent: string | null
  description?: string
}

export type TagNode = TagDef & { children: TagNode[]; depth: number }

export function rootTags<T extends TagDef>(defs: T[]): T[] {
  return defs.filter((d) => d.parent === null)
}

export function childrenOf<T extends TagDef>(defs: T[], name: string): T[] {
  return defs.filter((d) => d.parent === name)
}

// All descendant tag names below `name` (not including `name` itself).
export function descendantsOf(defs: TagDef[], name: string): string[] {
  const out: string[] = []
  const stack = [...childrenOf(defs, name)]
  while (stack.length) {
    const t = stack.pop()!
    out.push(t.name)
    stack.push(...childrenOf(defs, t.name))
  }
  return out
}

// Expand a set of tags to include every descendant — this is what makes a
// parent scope (e.g. #youth) also grant access to its children (#teen, #college).
export function expandWithDescendants(defs: TagDef[], names: string[]): Set<string> {
  const set = new Set<string>()
  for (const n of names) {
    set.add(n)
    for (const d of descendantsOf(defs, n)) set.add(d)
  }
  return set
}

// Build the forest as nested nodes, sorted with roots first.
export function buildForest(defs: TagDef[]): TagNode[] {
  const build = (name: string, depth: number): TagNode => {
    const def = defs.find((d) => d.name === name)!
    return {
      ...def,
      depth,
      children: childrenOf(defs, name).map((c) => build(c.name, depth + 1)),
    }
  }
  return rootTags(defs).map((r) => build(r.name, 0))
}
