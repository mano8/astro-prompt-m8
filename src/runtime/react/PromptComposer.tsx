import * as React from "react";
import { usePromptBlocks } from "../hooks/usePromptBlocks.js";
import { useComposePrompt } from "../hooks/useComposePrompt.js";
import { usePromptTemplate } from "../hooks/usePromptTemplate.js";
import { usePromptTemplateBlocks } from "../hooks/usePromptTemplate.js";
import { usePromptTemplates } from "../hooks/usePromptTemplates.js";
import type {
  PromptBlockPublic,
  PromptTemplatePublic,
  TemplateBlockPublic
} from "../schemas.js";

export interface PromptComposerLabels {
  title: string;
  subtitle: string;
  pickTemplate: string;
  noTemplate: string;
  composed: string;
  compose: string;
  composing: string;
  composingError: string;
  dynamicFor: string;
  dynamicPlaceholder: string;
  missingDynamic: string;
  empty: string;
  error: string;
  noBlocks: string;
}

const DEFAULT_LABELS: PromptComposerLabels = {
  title: "Compose prompt",
  subtitle: "Render a template with dynamic block content.",
  pickTemplate: "Template",
  noTemplate: "Select a template to compose",
  composed: "Composed prompt",
  compose: "Compose",
  composing: "Composing…",
  composingError: "Could not compose prompt.",
  dynamicFor: "Dynamic content for",
  dynamicPlaceholder: "Replacement value",
  missingDynamic: "Enter every dynamic replacement value.",
  empty: "No dynamic blocks.",
  error: "Could not load templates.",
  noBlocks: "This template has no blocks yet."
};

export interface PromptComposerProps {
  templateId?: number;
  labels?: Partial<PromptComposerLabels>;
}

export function PromptComposer({ templateId: initialTemplateId, labels }: PromptComposerProps) {
  const t = { ...DEFAULT_LABELS, ...labels };
  const templates = usePromptTemplates();
  const [selectedId, setSelectedId] = React.useState<number | undefined>(initialTemplateId);
  const template = usePromptTemplate({ templateId: selectedId });
  const templateBlocks = usePromptTemplateBlocks(selectedId);
  const { compose, composeMutation } = useComposePrompt();
  const [dynamic, setDynamic] = React.useState<Record<number, string>>({});
  const [dynamicError, setDynamicError] = React.useState<string | null>(null);

  const selected = template.data ?? null;
  const blocks = templateBlocks.blocks ?? [];

  React.useEffect(() => {
    if (selectedId !== undefined) {
      setDynamic({});
      setDynamicError(null);
    }
  }, [selectedId]);

  const dynamicBlocks = blocks.filter((b) => b.is_dynamic);

  return (
    <section className="not-content space-y-6">
      <div className="space-y-1">
        <h2 className="text-xl font-semibold tracking-tight">{t.title}</h2>
        <p className="text-sm text-muted-foreground">{t.subtitle}</p>
      </div>

      <div className="space-y-2">
        <label className="text-sm font-medium" htmlFor="prompt-composer-template">
          {t.pickTemplate}
        </label>
        <select
          id="prompt-composer-template"
          className="w-full rounded-md border bg-background px-3 py-2 text-sm"
          value={selectedId ?? ""}
          onChange={(e) => setSelectedId(Number(e.target.value) || undefined)}
        >
          <option value="">{t.noTemplate}</option>
          {(templates.data?.data ?? []).map((tpl) => (
            <option key={tpl.id} value={tpl.id}>
              {tpl.name}
            </option>
          ))}
        </select>
        {templates.error && !templates.data ? (
          <p role="alert" className="text-sm text-destructive">
            {t.error}
          </p>
        ) : null}
      </div>

      {selected ? (
        <div className="space-y-4">
          {blocks.length === 0 ? (
            <p className="rounded-md border border-dashed p-4 text-sm text-muted-foreground">
              {t.noBlocks}
            </p>
          ) : dynamicBlocks.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t.empty}</p>
          ) : (
            dynamicBlocks.map((block) => (
              <div key={block.id} className="space-y-1">
                <label className="text-sm font-medium" htmlFor={`prompt-dynamic-${block.id}`}>
                  {t.dynamicFor}: {block.name}
                </label>
                <textarea
                  id={`prompt-dynamic-${block.id}`}
                  className="w-full rounded-md border bg-background px-3 py-2 text-sm"
                  rows={3}
                  placeholder={t.dynamicPlaceholder}
                  value={dynamic[block.block_id] ?? ""}
                  onChange={(e) =>
                    setDynamic((current) => ({
                      ...current,
                      [block.block_id]: e.target.value
                    }))
                  }
                />
                <pre className="whitespace-pre-wrap rounded-md border bg-muted/30 p-3 text-xs text-muted-foreground">
                  {block.content}
                </pre>
              </div>
            ))
          )}
          {dynamicError ? (
            <p role="alert" className="text-sm text-destructive">
              {dynamicError}
            </p>
          ) : null}

          <button
            type="button"
            className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50"
            disabled={composeMutation.isPending || !selectedId}
            onClick={() => {
              if (selectedId === undefined) return;
              const missing = dynamicBlocks.some(
                (block) => (dynamic[block.block_id] ?? "").trim() === ""
              );
              if (missing) {
                setDynamicError(t.missingDynamic);
                return;
              }
              setDynamicError(null);
              void compose(
                selectedId,
                dynamicBlocks.map((block) => ({
                  id: block.block_id,
                  content: dynamic[block.block_id] ?? ""
                }))
              );
            }}
          >
            {composeMutation.isPending ? t.composing : t.compose}
          </button>

          {composeMutation.error ? (
            <p role="alert" className="text-sm text-destructive">
              {t.composingError}
            </p>
          ) : null}

          {composeMutation.data ? (
            <div className="space-y-1">
              <h3 className="text-sm font-medium">{t.composed}</h3>
              <pre className="whitespace-pre-wrap rounded-md border bg-muted/30 p-4 text-sm">
                {composeMutation.data.content}
              </pre>
            </div>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}

export type { PromptBlockPublic, PromptTemplatePublic, TemplateBlockPublic };
