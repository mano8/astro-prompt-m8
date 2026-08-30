import { exportBlocks, getBlock, createBlock, getBlockBySlug } from "./blocks.js";
import {
  exportTemplates,
  getTemplate,
  createTemplate,
  getTemplateBySlug,
  addTemplateBlock
} from "./templates.js";
import {
  buildPromptExport,
  parsePromptExport,
  toPortableBlock,
  toPortableTemplate,
  type PortableBlock,
  type PromptBlockListParams,
  type PromptExport,
  type PromptTemplateListParams
} from "../schemas.js";

/** Result of a bulk, filter-scoped export (`A-C8`). */
export type FilteredExportResult = {
  payload: PromptExport;
  /** Rows actually in `payload` — equals `totalCount` unless `truncated`. */
  exportedCount: number;
  /** The filtered set's true size, per the service's `count`. */
  totalCount: number;
  /** `true` when the filtered set exceeded the service's export cap. */
  truncated: boolean;
};

/** A block/template touched by an import, identified without server ids. */
export type TransferItem = { slug: string | null; name: string };

/** Summary returned by {@link importPromptExport}. */
export type ImportResult = {
  blocks: { created: TransferItem[]; reused: TransferItem[] };
  templates: { created: TransferItem[]; skipped: TransferItem[] };
};

/** Build a user-agnostic export payload for a single block. */
export async function exportBlockById(blockId: number): Promise<PromptExport> {
  const block = await getBlock(blockId);
  return buildPromptExport({ blocks: [toPortableBlock(block)] });
}

/**
 * Build a user-agnostic export payload for a template. The template's blocks
 * are embedded in full so the payload is self-contained.
 */
export async function exportTemplateById(templateId: number): Promise<PromptExport> {
  const template = await getTemplate(templateId);
  return buildPromptExport({ templates: [toPortableTemplate(template)] });
}

/**
 * Build a user-agnostic export payload for every block in the filtered set
 * (`A-C8`), not the one page a server-driven table happens to be showing.
 * `params` carries the same filter vocabulary the block table sends, minus
 * paging — `exportBlocks` accepts none of that, by design.
 */
export async function exportFilteredBlocks(
  params: Omit<PromptBlockListParams, "skip" | "limit" | "page" | "pageSize"> = {}
): Promise<FilteredExportResult> {
  const result = await exportBlocks(params);
  return {
    payload: buildPromptExport({ blocks: result.data.map(toPortableBlock) }),
    exportedCount: result.data.length,
    totalCount: result.count,
    truncated: result.truncated
  };
}

/**
 * Build a user-agnostic export payload for every template in the filtered
 * set (`A-C8`). Each template's blocks are embedded in full, same as
 * {@link exportTemplateById}, so the payload stays self-contained.
 */
export async function exportFilteredTemplates(
  params: Omit<PromptTemplateListParams, "skip" | "limit" | "page" | "pageSize"> = {}
): Promise<FilteredExportResult> {
  const result = await exportTemplates(params);
  return {
    payload: buildPromptExport({ templates: result.data.map(toPortableTemplate) }),
    exportedCount: result.data.length,
    totalCount: result.count,
    truncated: result.truncated
  };
}

/**
 * Ensure a block exists on the current account, deduping by slug: an existing
 * block is reused (its id returned), otherwise a fresh one is created. Records
 * the outcome on `into`.
 */
async function ensureBlock(
  block: PortableBlock,
  into: ImportResult["blocks"]
): Promise<number> {
  const item: TransferItem = { slug: block.slug ?? null, name: block.name };
  if (block.slug) {
    const existing = await getBlockBySlug(block.slug);
    if (existing) {
      into.reused.push(item);
      return existing.id;
    }
  }
  const created = await createBlock({
    name: block.name,
    description: block.description ?? null,
    content: block.content,
    type: block.type,
    is_dynamic: block.is_dynamic,
    is_public: block.is_public
  });
  into.created.push(item);
  return created.id;
}

/**
 * Import a portable payload into the current account. Blocks are deduped by
 * slug and reused when present; a template whose slug already exists is skipped
 * whole (its embedded blocks are not created). Nothing carries the exporter's
 * ownership — the importing user owns everything created here.
 */
export async function importPromptExport(input: unknown): Promise<ImportResult> {
  const payload = parsePromptExport(input);
  const result: ImportResult = {
    blocks: { created: [], reused: [] },
    templates: { created: [], skipped: [] }
  };

  for (const block of payload.blocks) {
    await ensureBlock(block, result.blocks);
  }

  for (const template of payload.templates) {
    const item: TransferItem = { slug: template.slug ?? null, name: template.name };
    if (template.slug) {
      const existing = await getTemplateBySlug(template.slug);
      if (existing) {
        result.templates.skipped.push(item);
        continue;
      }
    }

    // Resolve every block id first so a template is only created once its
    // blocks are in place.
    const links: { blockId: number; position: number }[] = [];
    for (const entry of template.blocks) {
      const blockId = await ensureBlock(entry.block, result.blocks);
      links.push({ blockId, position: entry.position });
    }

    const created = await createTemplate({
      name: template.name,
      description: template.description ?? null,
      is_public: template.is_public
    });
    for (const link of links) {
      await addTemplateBlock(created.id, link.blockId, link.position);
    }
    result.templates.created.push(item);
  }

  return result;
}
