// Tag forest helpers live in @gembala/shared so the API's authorization uses
// the exact same subtree semantics. Re-exported here to keep imports short.
export {
  buildForest,
  childrenOf,
  descendantsOf,
  expandWithDescendants,
  rootTags,
} from "@gembala/shared"
export type { TagDef, TagNode } from "@gembala/shared"
