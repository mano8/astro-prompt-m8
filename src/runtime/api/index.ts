import * as blocksApi from "./blocks.js";
import * as templatesApi from "./templates.js";
import * as categoriesApi from "./categories.js";
import * as dashboardApi from "./dashboard.js";
import * as adminApi from "./admin.js";
import * as transferApi from "./transfer.js";
import * as metaApi from "./meta.js";

// Flat named exports (tree-shakeable direct imports).
export * from "./blocks.js";
export * from "./templates.js";
export * from "./categories.js";
export * from "./dashboard.js";
export * from "./admin.js";
export * from "./transfer.js";
export * from "./meta.js";

// Grouped namespaces (`blocks.list`, `templates.compose`, ...).
export const blocks = {
  list: blocksApi.listBlocks,
  export: blocksApi.exportBlocks,
  get: blocksApi.getBlock,
  getBySlug: blocksApi.getBlockBySlug,
  create: blocksApi.createBlock,
  update: blocksApi.updateBlock,
  delete: blocksApi.deleteBlock
} as const;

export const templates = {
  list: templatesApi.listTemplates,
  export: templatesApi.exportTemplates,
  get: templatesApi.getTemplate,
  getBySlug: templatesApi.getTemplateBySlug,
  getBlocks: templatesApi.getTemplateBlocks,
  compose: templatesApi.composeTemplate,
  create: templatesApi.createTemplate,
  update: templatesApi.updateTemplate,
  delete: templatesApi.deleteTemplate,
  addBlock: templatesApi.addTemplateBlock,
  setBlockPosition: templatesApi.setTemplateBlockPosition,
  removeBlock: templatesApi.removeTemplateBlock
} as const;

export const categories = {
  list: categoriesApi.listCategories,
  get: categoriesApi.getCategory,
  create: categoriesApi.createCategory,
  update: categoriesApi.updateCategory,
  delete: categoriesApi.deleteCategory
} as const;

export const dashboard = {
  activityAll: dashboardApi.getActivityAll,
  activityCurrent: dashboardApi.getActivityCurrent
} as const;

export const admin = {
  overview: adminApi.getAdminOverview
} as const;

export const transfer = {
  exportBlock: transferApi.exportBlockById,
  exportTemplate: transferApi.exportTemplateById,
  exportFilteredBlocks: transferApi.exportFilteredBlocks,
  exportFilteredTemplates: transferApi.exportFilteredTemplates,
  import: transferApi.importPromptExport
} as const;

export const meta = {
  get: metaApi.getServiceMeta,
  preflight: metaApi.runPromptEngineM8Preflight,
  resetPreflight: metaApi.resetPromptEngineM8Preflight
} as const;