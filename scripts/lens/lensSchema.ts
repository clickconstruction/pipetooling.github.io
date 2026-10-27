/**
 * Reads the lens's schema map out of src/types/database.ts (punch list #194): every public table's
 * and view's columns and foreign keys, and what each RPC returns. The `virtual:lens-schema` plugin
 * in vite.config.ts serves the result to the lens's world, which ships in its own chunk, so the map
 * is always the types' own and never a committed copy that drifts.
 */
import ts from 'typescript'
import type { LensRelation, LensRpcKind, LensSchema, LensTableShape } from '../../src/lib/lens/answer/lensSchemaTypes'

export function lensSchemaFromDatabaseTs(text: string): LensSchema {
  const source = ts.createSourceFile('database.ts', text, ts.ScriptTarget.ES2022, true)
  const nameOf = (m: ts.PropertySignature) => m.name.getText(source).replace(/^["']|["']$/g, '')
  const members = (node: ts.Node | undefined): ts.PropertySignature[] =>
    node && ts.isTypeLiteralNode(node) ? node.members.filter(ts.isPropertySignature) : []
  const child = (node: ts.Node | undefined, name: string): ts.TypeNode | undefined => members(node).find((m) => nameOf(m) === name)?.type

  let database: ts.TypeNode | undefined
  source.forEachChild((node) => {
    if (ts.isTypeAliasDeclaration(node) && node.name.text === 'Database') database = node.type
  })
  if (!database) throw new Error('database.ts: no "export type Database"')
  const pub = child(database, 'public')
  if (!pub) throw new Error('database.ts: Database has no "public" schema')

  const literal = (node: ts.Node | undefined): string | boolean | null => {
    if (!node || !ts.isLiteralTypeNode(node)) return null
    const l = node.literal
    if (ts.isStringLiteral(l)) return l.text
    if (l.kind === ts.SyntaxKind.TrueKeyword) return true
    if (l.kind === ts.SyntaxKind.FalseKeyword) return false
    return null
  }
  const strings = (node: ts.Node | undefined): string[] =>
    node && ts.isTupleTypeNode(node)
      ? node.elements.map((e) => literal(e)).filter((v): v is string => typeof v === 'string')
      : []
  const relationsOf = (t: ts.Node | undefined): LensRelation[] => {
    const rels = child(t, 'Relationships')
    if (!rels || !ts.isTupleTypeNode(rels)) return []
    const out: LensRelation[] = []
    for (const e of rels.elements) {
      if (!ts.isTypeLiteralNode(e)) continue
      const fk = literal(child(e, 'foreignKeyName'))
      const ref = literal(child(e, 'referencedRelation'))
      if (typeof fk !== 'string' || typeof ref !== 'string') continue
      out.push({ fk, columns: strings(child(e, 'columns')), ref, refColumns: strings(child(e, 'referencedColumns')), one: literal(child(e, 'isOneToOne')) === true })
    }
    return out
  }

  const tables: Record<string, LensTableShape> = {}
  for (const [group, view] of [['Tables', false], ['Views', true]] as const) {
    for (const t of members(child(pub, group))) {
      const shape: LensTableShape = { columns: members(child(t.type, 'Row')).map(nameOf), rel: relationsOf(t.type) }
      if (view) shape.view = true
      tables[nameOf(t)] = shape
    }
  }

  const rpcs: Record<string, LensRpcKind> = {}
  for (const f of members(child(pub, 'Functions'))) {
    // An overloaded function is a union of { Args; Returns } literals.
    const shapes = f.type && ts.isUnionTypeNode(f.type) ? [...f.type.types] : [f.type]
    const kinds = shapes.map((shape) => kindOf(child(shape, 'Returns')))
    rpcs[nameOf(f)] = kinds.includes('set') ? 'set' : (kinds[0] ?? 'json')
  }
  return { tables, rpcs }
}

const SCALAR_KEYWORDS = new Set([ts.SyntaxKind.StringKeyword, ts.SyntaxKind.NumberKeyword, ts.SyntaxKind.BooleanKeyword])

function isNull(node: ts.TypeNode): boolean {
  return ts.isLiteralTypeNode(node) && node.literal.kind === ts.SyntaxKind.NullKeyword
}

export function kindOf(node: ts.TypeNode | undefined): LensRpcKind {
  if (!node) return 'json'
  if (ts.isArrayTypeNode(node)) return 'set'
  if (node.kind === ts.SyntaxKind.UndefinedKeyword || node.kind === ts.SyntaxKind.VoidKeyword) return 'void'
  if (SCALAR_KEYWORDS.has(node.kind) || ts.isLiteralTypeNode(node)) return 'scalar'
  if (ts.isUnionTypeNode(node)) {
    const kinds = node.types.filter((t) => !isNull(t)).map(kindOf)
    if (kinds.includes('set')) return 'set'
    return kinds.length > 0 && kinds.every((k) => k === 'scalar') ? 'scalar' : 'json'
  }
  // Json, a composite row's type literal, or anything else: an object a caller reads fields from.
  return 'json'
}

/** The virtual module's source: the map as one JSON default export. */
export function lensSchemaModule(schema: LensSchema): string {
  return `export default ${JSON.stringify(schema)}\n`
}
