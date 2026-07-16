import * as React from "react";
import { usePromptBlocks } from "../hooks/usePromptBlocks.js";
import { usePromptTemplates } from "../hooks/usePromptTemplates.js";
import { useComposePrompt } from "../hooks/useComposePrompt.js";
import { usePromptTransfer } from "../hooks/usePromptTransfer.js";
import { copyTextToClipboard, type ClipboardCopyState } from "./clipboard.js";
import { downloadPromptExport, readPromptExportFile } from "./transfer-file.js";
import { promptExportFilename, type PromptBlockPublic } from "../schemas.js";

export interface PromptTemplateEditorLabels {
  title: string;
  subtitle: string;
  create: string;
  name: string;
  description: string;
  publicLabel: string;
  save: string;
  cancel: string;
  loading: string;
  empty: string;
  error: string;
  edit: string;
  deleteLabel: string;
  confirmDelete: string;
  blocks: string;
  addBlock: string;
  noBlocksAvailable: string;
  removeBlock: string;
  moveUp: string;
  moveDown: string;
  compose: string;
  composeLabel: string;
  composed: string;
  copyComposed: string;
  copied: string;
  copyError: string;
  composing: string;
  composingError: string;
  dynamicFor: string;
  dynamicPlaceholder: string;
  missingDynamic: string;
  noDynamic: string;
  exportLabel: string;
  importLabel: string;
  importError: string;
}

const DEFAULT_LABELS: PromptTemplateEditorLabels = {
  title: "Prompt templates",
  subtitle: "Compose reusable templates from prompt blocks.",
  create: "New template",
  name: "Name",
  description: "Description",
  publicLabel: "Public",
  save: "Save",
  cancel: "Cancel",
  loading: "Loading…",
  empty: "No templates yet.",
  error: "Could not load templates.",
  edit: "Edit",
  deleteLabel: "Delete",
  confirmDelete: "Delete this template and its blocks?",
  blocks: "Blocks",
  addBlock: "Add block",
  noBlocksAvailable: "All blocks already attached, or no blocks exist.",
  removeBlock: "Remove",
  moveUp: "Up",
  moveDown: "Down",
  compose: "Compose",
  composeLabel: "Compose this template",
  composed: "Composed prompt",
  copyComposed: "Copy",
  copied: "Copied",
  copyError: "Could not copy",
  composing: "Composing…",
  composingError: "Could not compose template.",
  dynamicFor: "Dynamic content for",
  dynamicPlaceholder: "Replacement value",
  missingDynamic: "Enter every dynamic replacement value.",
  noDynamic: "This template has no dynamic blocks.",
  exportLabel: "Export",
  importLabel: "Import",
  importError: "Could not import file."
};

type DraftState = {
  id?: number;
  name: string;
  description: string;
  is_public: boolean;
};

const EMPTY_DRAFT: DraftState = { name: "", description: "", is_public: false };

type ComposableBlock = {
  block_id: number;
  content: string;
  is_dynamic: boolean;
};

function renderComposedPrompt(
  blocks: ComposableBlock[],
  dynamicFields: Record<number, string>,
  fallbackContent: string
): string {
  const content = blocks
    .map((block) => {
      if (!block.is_dynamic) {
        return block.content;
      }
      const replacement = dynamicFields[block.block_id] ?? "";
      return block.content.includes("{{dynamic_content}}")
        ? block.content.split("{{dynamic_content}}").join(replacement)
        : replacement;
    })
    .filter((part) => part.trim() !== "")
    .join("");

  return content || fallbackContent.trim();
}

export interface PromptTemplateEditorProps {
  labels?: Partial<PromptTemplateEditorLabels>;
}

export function PromptTemplateEditor({ labels }: PromptTemplateEditorProps) {
  const t: PromptTemplateEditorLabels = { ...DEFAULT_LABELS, ...labels };
  const templates = usePromptTemplates();
  const blocks = usePromptBlocks();
  const { exportTemplateMutation, importMutation } = usePromptTransfer();

  const [transferStatus, setTransferStatus] = React.useState<string | null>(null);
  const fileInputRef = React.useRef<HTMLInputElement | null>(null);
  const [draft, setDraft] = React.useState<DraftState | null>(null);
  const [expandedId, setExpandedId] = React.useState<number | null>(null);
  const [composeError, setComposeError] = React.useState<string | null>(null);
  const [composerId, setComposerId] = React.useState<number | null>(null);
  const [composerDynamic, setComposerDynamic] = React.useState<Record<number, string>>({});
  const [composerResult, setComposerResult] = React.useState<string | null>(null);
  const [copyState, setCopyState] = React.useState<ClipboardCopyState>("idle");

  const { compose, composeMutation } = useComposePrompt();

  const { refresh: refreshTemplates } = templates;
  const { refresh: refreshBlocks } = blocks;

  React.useEffect(() => {
    void refreshTemplates();
    void refreshBlocks();
  }, [refreshTemplates, refreshBlocks]);

  const startCreate = () => {
    setDraft({ ...EMPTY_DRAFT });
  };

  const save = async () => {
    if (!draft) return;
    const body = {
      name: draft.name,
      description: draft.description || null,
      is_public: draft.is_public
    };
    if (draft.id !== undefined) {
      await templates.updateMutation.mutateAsync({ templateId: draft.id, body });
    } else {
      await templates.createMutation.mutateAsync(body);
    }
    setDraft(null);
  };

  const remove = async (id: number) => {
    if (!window.confirm(t.confirmDelete)) return;
    await templates.deleteMutation.mutateAsync(id);
    if (expandedId === id) setExpandedId(null);
  };

  const exportTemplate = async (id: number, slug: string) => {
    setTransferStatus(null);
    const payload = await exportTemplateMutation.mutateAsync(id);
    downloadPromptExport(payload, promptExportFilename("template", slug));
  };

  const onImportFile = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    setTransferStatus(null);
    try {
      const parsed = await readPromptExportFile(file);
      const result = await importMutation.mutateAsync(parsed);
      const created = result.templates.created.length;
      const skipped = result.templates.skipped.length;
      setTransferStatus(`Imported ${created} template(s), ${skipped} skipped (already exist).`);
    } catch {
      setTransferStatus(t.importError);
    }
  };

  const availableToAdd = (templateId: number): PromptBlockPublic[] => {
    const tpl = templates.data?.data.find((item) => item.id === templateId);
    const used = new Set((tpl?.blocks ?? []).map((b) => b.block_id));
    return (blocks.data?.data ?? []).filter((b) => !used.has(b.id));
  };

  return (
    <section className="not-content space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div className="space-y-1">
          <h2 className="text-xl font-semibold tracking-tight">{t.title}</h2>
          <p className="text-sm text-muted-foreground">{t.subtitle}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className="rounded-md border px-4 py-2 text-sm font-medium disabled:opacity-50"
            disabled={importMutation.isPending}
            onClick={() => fileInputRef.current?.click()}
          >
            {t.importLabel}
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="application/json,.json"
            className="hidden"
            onChange={onImportFile}
          />
          <button
            type="button"
            className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
            onClick={startCreate}
          >
            {t.create}
          </button>
        </div>
      </div>

      {transferStatus ? (
        <p role="status" className="text-sm text-muted-foreground">
          {transferStatus}
        </p>
      ) : null}

      {draft ? (
        <form
          className="space-y-3 rounded-md border bg-card p-4"
          onSubmit={(e) => {
            e.preventDefault();
            void save();
          }}
        >
          <label className="block space-y-1 text-sm">
            <span className="font-medium">{t.name}</span>
            <input
              className="w-full rounded-md border bg-background px-3 py-3"
              value={draft.name}
              onChange={(e) => setDraft({ ...draft, name: e.target.value })}
              required
            />
          </label>
          <label className="block space-y-1 text-sm">
            <span className="font-medium">{t.description}</span>
            <input
              className="w-full rounded-md border bg-background px-3 py-3"
              value={draft.description}
              onChange={(e) => setDraft({ ...draft, description: e.target.value })}
            />
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={draft.is_public}
              onChange={(e) => setDraft({ ...draft, is_public: e.target.checked })}
            />
            <span className="font-medium">{t.publicLabel}</span>
          </label>
          <div className="flex gap-2">
            <button
              type="submit"
              className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50"
              disabled={templates.createMutation.isPending || templates.updateMutation.isPending}
            >
              {t.save}
            </button>
            <button
              type="button"
              className="rounded-md border px-4 py-2 text-sm font-medium"
              onClick={() => setDraft(null)}
            >
              {t.cancel}
            </button>
          </div>
        </form>
      ) : null}

      {templates.loading && !templates.data ? (
        <p className="text-sm">{t.loading}</p>
      ) : null}
      {templates.error && !templates.data ? (
        <p role="alert" className="text-sm text-destructive">
          {t.error}
        </p>
      ) : null}

      <ul className="divide-y rounded-md border">
        {(templates.data?.data ?? []).map((tpl) => {
          const open = expandedId === tpl.id;
          const canAdd = availableToAdd(tpl.id);
          return (
            <li key={tpl.id} className="p-4">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <div className="space-y-0.5">
                  <h3 className="text-sm font-semibold">{tpl.name}</h3>
                  <p className="text-xs text-muted-foreground">
                    {tpl.blocks.length} · {tpl.is_public ? t.publicLabel : ""}
                  </p>
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    className="rounded-md border px-3 py-1 text-xs font-medium disabled:opacity-50"
                    disabled={exportTemplateMutation.isPending}
                    onClick={() => void exportTemplate(tpl.id, tpl.slug)}
                  >
                    {t.exportLabel}
                  </button>
                  <button
                    type="button"
                    className="rounded-md border px-3 py-1 text-xs font-medium"
                    onClick={() => setExpandedId(open ? null : tpl.id)}
                  >
                    {t.edit}
                  </button>
                  <button
                    type="button"
                    className="rounded-md border px-3 py-1 text-xs font-medium text-destructive"
                    disabled={templates.deleteMutation.isPending}
                    onClick={() => void remove(tpl.id)}
                  >
                    {t.deleteLabel}
                  </button>
                </div>
              </div>

              {open ? (
                <div className="mt-4 space-y-4">
                  {tpl.blocks.length > 0 ? (
                    <ol className="space-y-2">
                      {tpl.blocks.map((block, index) => (
                        <li key={block.id} className="flex items-start gap-2 rounded-md border p-2">
                          <div className="flex flex-col gap-1">
                            <button
                              type="button"
                              className="rounded border px-2 py-0.5 text-xs disabled:opacity-50"
                              disabled={index === 0 || templates.setPositionMutation.isPending}
                              onClick={() =>
                                templates.setPositionMutation.mutate({
                                  templateId: tpl.id,
                                  blockId: block.block_id,
                                  position: block.position - 1
                                })
                              }
                            >
                              {t.moveUp}
                            </button>
                            <button
                              type="button"
                              className="rounded border px-2 py-0.5 text-xs disabled:opacity-50"
                              disabled={
                                index === tpl.blocks.length - 1 ||
                                templates.setPositionMutation.isPending
                              }
                              onClick={() =>
                                templates.setPositionMutation.mutate({
                                  templateId: tpl.id,
                                  blockId: block.block_id,
                                  position: block.position + 1
                                })
                              }
                            >
                              {t.moveDown}
                            </button>
                          </div>
                          <div className="flex-1 space-y-0.5">
                            <p className="text-sm font-medium">{block.name}</p>
                            <p className="text-xs text-muted-foreground">
                              {block.type} · position {block.position}
                            </p>
                            <pre className="whitespace-pre-wrap text-xs text-muted-foreground">
                              {block.content}
                            </pre>
                          </div>
                          <button
                            type="button"
                            className="rounded-md border px-2 py-1 text-xs font-medium text-destructive disabled:opacity-50"
                            disabled={templates.removeBlockMutation.isPending}
                            onClick={() =>
                              templates.removeBlockMutation.mutate({
                                templateId: tpl.id,
                                blockId: block.block_id
                              })
                            }
                          >
                            {t.removeBlock}
                          </button>
                        </li>
                      ))}
                    </ol>
                  ) : (
                    <p className="text-xs text-muted-foreground">{t.noBlocksAvailable}</p>
                  )}

                  <div className="space-y-2">
                    <h4 className="text-sm font-medium">{t.addBlock}</h4>
                    {canAdd.length ? (
                      <ul className="flex flex-wrap gap-2">
                        {canAdd.map((block) => (
                          <li key={block.id}>
                            <button
                              type="button"
                              className="rounded-md border px-3 py-1 text-xs font-medium disabled:opacity-50"
                              disabled={templates.addBlockMutation.isPending}
                              onClick={() =>
                                templates.addBlockMutation.mutate({
                                  templateId: tpl.id,
                                  blockId: block.id,
                                  position: 0
                                })
                              }
                            >
                              + {block.name}
                            </button>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="text-xs text-muted-foreground">{t.noBlocksAvailable}</p>
                    )}
                  </div>

                  <div className="space-y-2 border-t pt-3">
                    <h4 className="text-sm font-medium">{t.composeLabel}</h4>
                    <ComposeInline
                      templateId={tpl.id}
                      blocks={tpl.blocks}
                      t={t}
                      composing={composerId === tpl.id}
                      onStart={() => {
                        setComposerId(tpl.id);
                        setComposeError(null);
                        setComposerDynamic({});
                        setComposerResult(null);
                        setCopyState("idle");
                      }}
                      onField={(blockId, value) =>
                        setComposerDynamic((current) => ({ ...current, [blockId]: value }))
                      }
                      fields={composerDynamic}
                      onCompose={async () => {
                        const dynamicBlocks = tpl.blocks.filter((block) => block.is_dynamic);
                        const missing = dynamicBlocks.some(
                          (block) => (composerDynamic[block.block_id] ?? "").trim() === ""
                        );
                        if (missing) {
                          setComposeError(t.missingDynamic);
                          setComposerResult(null);
                          return;
                        }
                        try {
                          setCopyState("idle");
                          const result = await compose(
                            tpl.id,
                            dynamicBlocks.map((block) => ({
                                id: block.block_id,
                                content: composerDynamic[block.block_id] ?? ""
                              }))
                          );
                          setComposerResult(renderComposedPrompt(tpl.blocks, composerDynamic, result.content));
                        } catch {
                          setComposerResult(null);
                          setComposeError(t.composingError);
                        }
                      }}
                      composeResult={composerId === tpl.id ? composerResult : null}
                      error={composerId === tpl.id ? composeError : null}
                      copyState={copyState}
                      onCopy={(content) =>
                        copyTextToClipboard(content).then((copied) =>
                          setCopyState(copied ? "copied" : "error")
                        )
                      }
                      onResultChange={setComposerResult}
                      busy={composerId === tpl.id && composeMutation.isPending}
                    />
                  </div>
                </div>
              ) : null}
            </li>
          );
        })}
        {(templates.data?.data ?? []).length === 0 && !templates.loading && !templates.error ? (
          <li className="p-6 text-center text-sm text-muted-foreground">{t.empty}</li>
        ) : null}
      </ul>
    </section>
  );
}

type InlineBlock = {
  block_id: number;
  is_dynamic: boolean;
  name: string;
  content: string;
};

function ComposeInline({
  templateId,
  blocks,
  t,
  composing,
  onStart,
  onField,
  fields,
  onCompose,
  composeResult,
  error,
  copyState,
  onCopy,
  onResultChange,
  busy
}: {
  templateId: number;
  blocks: InlineBlock[];
  t: PromptTemplateEditorLabels;
  composing: boolean;
  onStart: () => void;
  onField: (blockId: number, value: string) => void;
  fields: Record<number, string>;
  onCompose: () => void;
  composeResult: string | null;
  error: string | null;
  copyState: ClipboardCopyState;
  onCopy: (content: string) => Promise<void>;
  onResultChange: (content: string) => void;
  busy: boolean;
}) {
  const dynamic = blocks.filter((b) => b.is_dynamic);
  void templateId;
  if (!composing) {
    return (
      <button
        type="button"
        className="rounded-md bg-primary px-3 py-1 text-sm font-medium text-primary-foreground"
        onClick={onStart}
      >
        {t.compose}
      </button>
    );
  }
  return (
    <div className="space-y-3">
      {dynamic.length === 0 ? (
        <p className="text-xs text-muted-foreground">{t.noDynamic}</p>
      ) : (
        dynamic.map((b) => (
          <label key={b.block_id} className="mb-3 block space-y-1 text-sm">
            <span className="block py-2 font-medium">
              {t.dynamicFor}: {b.name}
            </span>
            <textarea
              className="w-full rounded-md border bg-background px-3 py-2"
              rows={2}
              value={fields[b.block_id] ?? ""}
              placeholder={t.dynamicPlaceholder}
              onChange={(e) => onField(b.block_id, e.target.value)}
            />
            <pre className="whitespace-pre-wrap rounded-md border bg-muted/30 p-3 text-xs text-muted-foreground">
              {b.content}
            </pre>
          </label>
        ))
      )}
      <button
        type="button"
        className="rounded-md bg-primary px-3 py-1 text-sm font-medium text-primary-foreground disabled:opacity-50"
        disabled={busy}
        onClick={onCompose}
      >
        {busy ? t.composing : t.compose}
      </button>
      {error ? (
        <p role="alert" className="text-xs text-destructive">
          {error}
        </p>
      ) : null}
      {composeResult ? (
        <div className="space-y-1">
          <div className="flex flex-wrap items-center justify-between gap-2 py-2">
            <p className="text-xs font-medium">{t.composed}</p>
            <div className="flex items-center gap-2">
              <button
                type="button"
                className="rounded-md border px-2 py-1 text-xs font-medium"
                onClick={() => void onCopy(composeResult)}
              >
                {t.copyComposed}
              </button>
              {copyState !== "idle" ? (
                <span
                  role={copyState === "error" ? "alert" : "status"}
                  className={
                    copyState === "error"
                      ? "text-xs text-destructive"
                      : "text-xs text-muted-foreground"
                  }
                >
                  {copyState === "copied" ? t.copied : t.copyError}
                </span>
              ) : null}
            </div>
          </div>
          <textarea
            className="min-h-32 w-full rounded-md border bg-background p-3 text-xs"
            value={composeResult}
            onChange={(event) => onResultChange(event.target.value)}
          />
        </div>
      ) : null}
    </div>
  );
}
