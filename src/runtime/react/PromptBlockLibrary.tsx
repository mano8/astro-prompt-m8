import * as React from "react";
import { usePromptBlocks } from "../hooks/usePromptBlocks.js";
import {
  hasDynamicContentPlaceholder,
  insertDynamicContentPlaceholder,
  type PromptBlockPublic
} from "../schemas.js";

export interface PromptBlockLibraryLabels {
  title: string;
  subtitle: string;
  empty: string;
  error: string;
  loading: string;
  create: string;
  name: string;
  type: string;
  content: string;
  actions: string;
  edit: string;
  deleteLabel: string;
  save: string;
  cancel: string;
  confirmDelete: string;
  dynamicYes: string;
  dynamicNo: string;
  publicYes: string;
  publicNo: string;
  dynamicLabel: string;
  publicLabel: string;
  insertPlaceholder: string;
  placeholderRequired: string;
  description: string;
  blockTypeRole: string;
  blockTypeTask: string;
  blockTypeContext: string;
  blockTypeInstruction: string;
  blockTypeExample: string;
  blockTypeFormat: string;
}

const DEFAULT_LABELS: PromptBlockLibraryLabels = {
  title: "Prompt blocks",
  subtitle: "Reusable building blocks for prompt templates.",
  empty: "No prompt blocks yet.",
  error: "Could not load prompt blocks.",
  loading: "Loading…",
  create: "New block",
  name: "Name",
  type: "Type",
  content: "Content",
  actions: "Actions",
  edit: "Edit",
  deleteLabel: "Delete",
  save: "Save",
  cancel: "Cancel",
  confirmDelete: "Delete this block?",
  dynamicYes: "Dynamic",
  dynamicNo: "Static",
  publicYes: "Public",
  publicNo: "Private",
  dynamicLabel: "Dynamic",
  publicLabel: "Public",
  insertPlaceholder: "Insert placeholder",
  placeholderRequired: "Dynamic blocks should include {{dynamic_content}}.",
  description: "Description",
  blockTypeRole: "Role",
  blockTypeTask: "Task",
  blockTypeContext: "Context",
  blockTypeInstruction: "Instruction",
  blockTypeExample: "Example",
  blockTypeFormat: "Format"
};

type PromptBlockTypeExtension = "role" | "task" | "context" | "instruction" | "example" | "format";

const TYPES: readonly PromptBlockTypeExtension[] = [
  "role",
  "task",
  "context",
  "instruction",
  "example",
  "format"
];

export interface PromptBlockLibraryProps {
  labels?: Partial<PromptBlockLibraryLabels>;
}

function typeLabel(t: PromptBlockLibraryLabels, type: PromptBlockTypeExtension): string {
  switch (type) {
    case "role":
      return t.blockTypeRole;
    case "task":
      return t.blockTypeTask;
    case "context":
      return t.blockTypeContext;
    case "instruction":
      return t.blockTypeInstruction;
    case "example":
      return t.blockTypeExample;
    case "format":
      return t.blockTypeFormat;
  }
}

type DraftState = {
  id?: number;
  name: string;
  description: string;
  content: string;
  type: PromptBlockTypeExtension;
  is_dynamic: boolean;
  is_public: boolean;
};

const EMPTY_DRAFT: DraftState = {
  name: "",
  description: "",
  content: "",
  type: "role",
  is_dynamic: false,
  is_public: false
};

export function PromptBlockLibrary({ labels }: PromptBlockLibraryProps) {
  const t: PromptBlockLibraryLabels = { ...DEFAULT_LABELS, ...labels };
  const { data, loading, error, createMutation, updateMutation, deleteMutation, refresh } =
    usePromptBlocks();
  const [draft, setDraft] = React.useState<DraftState | null>(null);
  const [editingId, setEditingId] = React.useState<number | null>(null);
  const [draftError, setDraftError] = React.useState<string | null>(null);
  const contentRef = React.useRef<HTMLTextAreaElement | null>(null);

  React.useEffect(() => {
    void refresh();
  }, [refresh]);

  const startEdit = (block: PromptBlockPublic) => {
    setEditingId(block.id);
    setDraftError(null);
    setDraft({
      id: block.id,
      name: block.name,
      description: block.description ?? "",
      content: block.content,
      type: block.type,
      is_dynamic: block.is_dynamic,
      is_public: block.is_public
    });
  };

  const saveDraft = async () => {
    if (!draft) return;
    if (draft.is_dynamic && !hasDynamicContentPlaceholder(draft.content)) {
      setDraftError(t.placeholderRequired);
      return;
    }
    const body = {
      name: draft.name,
      description: draft.description || null,
      content: draft.content,
      type: draft.type,
      is_dynamic: draft.is_dynamic,
      is_public: draft.is_public
    };
    if (draft.id !== undefined) {
      await updateMutation.mutateAsync({ blockId: draft.id, body });
    } else {
      await createMutation.mutateAsync(body);
    }
    setDraft(null);
    setDraftError(null);
    setEditingId(null);
  };

  const insertPlaceholder = () => {
    if (!draft) return;
    const textarea = contentRef.current;
    const content = insertDynamicContentPlaceholder(
      draft.content,
      textarea?.selectionStart,
      textarea?.selectionEnd
    );
    setDraft({ ...draft, content });
    setDraftError(null);
    requestAnimationFrame(() => textarea?.focus());
  };

  const removeBlock = async (id: number) => {
    if (!window.confirm(t.confirmDelete)) return;
    await deleteMutation.mutateAsync(id);
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
          onClick={() => {
            setEditingId(null);
            setDraftError(null);
            setDraft({ ...EMPTY_DRAFT });
          }}
        >
          {t.create}
        </button>
      </div>

      {loading && !data ? <p className="text-sm">{t.loading}</p> : null}
      {error && !data ? (
        <p role="alert" className="text-sm text-destructive">
          {t.error}
        </p>
      ) : null}

      {draft ? (
        <form
          className="space-y-3 rounded-md border bg-card p-4"
          onSubmit={(e) => {
            e.preventDefault();
            void saveDraft();
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
          <label className="block space-y-1 text-sm">
            <span className="font-medium">{t.content}</span>
            <textarea
              ref={contentRef}
              className="w-full rounded-md border bg-background px-3 py-2"
              rows={4}
              value={draft.content}
              onChange={(e) => setDraft({ ...draft, content: e.target.value })}
              required
            />
          </label>
          {draft.is_dynamic ? (
            <div className="space-y-1">
              <button
                type="button"
                className="rounded-md border px-3 py-1 text-xs font-medium"
                onClick={insertPlaceholder}
              >
                {t.insertPlaceholder}
              </button>
              {draftError ? (
                <p role="alert" className="text-xs text-destructive">
                  {draftError}
                </p>
              ) : null}
            </div>
          ) : null}
          <div className="flex flex-wrap gap-4">
            <label className="block space-y-1 text-sm">
              <span className="font-medium">{t.type}</span>
              <select
                className="rounded-md border bg-background px-3 py-2"
                value={draft.type}
                onChange={(e) =>
                  setDraft({ ...draft, type: e.target.value as PromptBlockTypeExtension })
                }
              >
                {TYPES.map((type) => (
                  <option key={type} value={type}>
                    {typeLabel(t, type)}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex items-center gap-2 self-end pb-1 text-sm">
              <input
                type="checkbox"
                checked={draft.is_dynamic}
                onChange={(e) => {
                  setDraft({ ...draft, is_dynamic: e.target.checked });
                  setDraftError(null);
                }}
              />
              <span className="font-medium">{t.dynamicLabel}</span>
            </label>
            <label className="flex items-center gap-2 self-end pb-1 text-sm">
              <input
                type="checkbox"
                checked={draft.is_public}
                onChange={(e) => setDraft({ ...draft, is_public: e.target.checked })}
              />
              <span className="font-medium">{t.publicLabel}</span>
            </label>
          </div>
          <div className="flex gap-2">
            <button
              type="submit"
              className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50"
              disabled={createMutation.isPending || updateMutation.isPending}
            >
              {t.save}
            </button>
            <button
              type="button"
              className="rounded-md border px-4 py-2 text-sm font-medium"
              onClick={() => {
                setDraft(null);
                setDraftError(null);
                setEditingId(null);
              }}
            >
              {t.cancel}
            </button>
          </div>
        </form>
      ) : null}

      <ul className="divide-y rounded-md border">
        {(data?.data ?? []).map((block) => (
          <li key={block.id} className="flex flex-col gap-2 p-4">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <div className="space-y-0.5">
                <h3 className="text-sm font-semibold">{block.name}</h3>
                <p className="text-xs text-muted-foreground">
                  {typeLabel(t, block.type)} ·{" "}
                  {block.is_dynamic ? t.dynamicYes : t.dynamicNo} ·{" "}
                  {block.is_public ? t.publicYes : t.publicNo}
                </p>
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  className="rounded-md border px-3 py-1 text-xs font-medium"
                  disabled={editingId === block.id}
                  onClick={() => startEdit(block)}
                >
                  {t.edit}
                </button>
                <button
                  type="button"
                  className="rounded-md border px-3 py-1 text-xs font-medium text-destructive"
                  disabled={deleteMutation.isPending}
                  onClick={() => void removeBlock(block.id)}
                >
                  {t.deleteLabel}
                </button>
              </div>
            </div>
            <pre className="whitespace-pre-wrap text-xs text-muted-foreground">
              {block.content}
            </pre>
          </li>
        ))}
        {(data?.data ?? []).length === 0 && !loading && !error ? (
          <li className="p-6 text-center text-sm text-muted-foreground">{t.empty}</li>
        ) : null}
      </ul>
    </section>
  );
}
