import * as React from "react";
import { usePromptBlocks } from "../hooks/usePromptBlocks.js";
import { usePromptTemplates } from "../hooks/usePromptTemplates.js";
import { useComposePrompt } from "../hooks/useComposePrompt.js";
import type { PromptBlockPublic } from "../schemas.js";

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
  composing: string;
  composingError: string;
  dynamicFor: string;
  dynamicPlaceholder: string;
  missingDynamic: string;
  noDynamic: string;
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
  composing: "Composing…",
  composingError: "Could not compose template.",
  dynamicFor: "Dynamic content for",
  dynamicPlaceholder: "Replacement value",
  missingDynamic: "Enter every dynamic replacement value.",
  noDynamic: "This template has no dynamic blocks."
};

type DraftState = {
  id?: number;
  name: string;
  description: string;
  is_public: boolean;
};

const EMPTY_DRAFT: DraftState = { name: "", description: "", is_public: false };

export interface PromptTemplateEditorProps {
  labels?: Partial<PromptTemplateEditorLabels>;
}

export function PromptTemplateEditor({ labels }: PromptTemplateEditorProps) {
  const t: PromptTemplateEditorLabels = { ...DEFAULT_LABELS, ...labels };
  const templates = usePromptTemplates();
  const blocks = usePromptBlocks();

  const [draft, setDraft] = React.useState<DraftState | null>(null);
  const [expandedId, setExpandedId] = React.useState<number | null>(null);
  const [composeError, setComposeError] = React.useState<string | null>(null);
  const [composerId, setComposerId] = React.useState<number | null>(null);
  const [composerDynamic, setComposerDynamic] = React.useState<Record<number, string>>({});

  const { compose, composeMutation } = useComposePrompt();

  React.useEffect(() => {
    void templates.refresh();
    void blocks.refresh();
  }, [templates.refresh, blocks.refresh]);

  const selectedTemplate =
    templates.data?.data.find((tpl) => tpl.id === expandedId) ?? null;

  const startCreate = () => {
    setDraft({ ...EMPTY_DRAFT });
  };

  const startEdit = (template: { id: number; name: string; description: string | null; is_public: boolean }) => {
    setDraft({
      id: template.id,
      name: template.name,
      description: template.description ?? "",
      is_public: template.is_public
    });
    setExpandedId(template.id);
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
        <button
          type="button"
          className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
          onClick={startCreate}
        >
          {t.create}
        </button>
      </div>

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
              className="w-full rounded-md border bg-background px-3 py-2"
              value={draft.name}
              onChange={(e) => setDraft({ ...draft, name: e.target.value })}
              required
            />
          </label>
          <label className="block space-y-1 text-sm">
            <span className="font-medium">{t.description}</span>
            <input
              className="w-full rounded-md border bg-background px-3 py-2"
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
                          return;
                        }
                        try {
                          await compose(
                            tpl.id,
                            dynamicBlocks.map((block) => ({
                                id: block.block_id,
                                content: composerDynamic[block.block_id] ?? ""
                              }))
                          );
                        } catch {
                          setComposeError(t.composingError);
                        }
                      }}
                      composeResult={composerId === tpl.id ? composeMutation.data?.content ?? null : null}
                      error={composerId === tpl.id ? composeError : null}
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
          <label key={b.block_id} className="block space-y-1 text-sm">
            <span className="font-medium">
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
        <pre className="whitespace-pre-wrap rounded-md border bg-muted/30 p-3 text-xs">
          {composeResult}
        </pre>
      ) : null}
    </div>
  );
}
