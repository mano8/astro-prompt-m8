"use client";

// Full shadcn prompt-template editor skin. It uses DataTable for templates and
// attached blocks, and validates create/update forms with Zod.
import * as React from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import type { ColumnDef } from "@tanstack/react-table";
import { ArrowDown, ArrowUp, Copy, Download, FileText, Plus, Upload, Wand2 } from "lucide-react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import {
  usePromptBlocks,
  usePromptTemplates,
  useComposePrompt,
  usePromptTransfer,
} from "@mano8/astro-prompt-m8/hooks";
import {
  promptExportFilename,
  type PromptBlockPublic,
  type PromptTemplatePublic,
  type TemplateBlockPublic,
} from "@mano8/astro-prompt-m8/schemas";
import { downloadPromptExport, readPromptExportFile } from "@mano8/astro-prompt-m8/react";

import {
  DataTable,
  type DataTableFilterOptions,
  type DataTableSortDirection,
} from "@/components/m8-ui/data-table";
import { DataTableColumnHeader } from "@/components/m8-ui/data-table-column-header";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

export interface PromptTemplateEditorLabels {
  title: string;
  subtitle: string;
  create: string;
  edit: string;
  deleteLabel: string;
  deleteTitle: string;
  deleteDescription: string;
  save: string;
  cancel: string;
  actions: string;
  name: string;
  type: string;
  description: string;
  publicLabel: string;
  blocks: string;
  block: string;
  addBlock: string;
  removeBlock: string;
  moveUp: string;
  moveDown: string;
  compose: string;
  composeTitle: string;
  composeResult: string;
  copyComposed: string;
  copied: string;
  copyError: string;
  dynamicFor: string;
  dynamicPlaceholder: string;
  missingDynamic: string;
  noDynamic: string;
  loading: string;
  empty: string;
  error: string;
  searchTemplates: string;
  searchBlocks: string;
  allPublic: string;
  allDynamic: string;
  allTypes: string;
  columns: string;
  selected: (selected: number, total: number) => string;
  exportLabel: string;
  importLabel: string;
  importError: string;
}

const DEFAULT_LABELS: PromptTemplateEditorLabels = {
  title: "Prompt templates",
  subtitle: "Search, filter, select columns, and maintain prompt templates.",
  create: "New template",
  edit: "Edit",
  deleteLabel: "Delete",
  deleteTitle: "Delete prompt template?",
  deleteDescription: "This removes the template and detaches all blocks.",
  save: "Save",
  cancel: "Cancel",
  actions: "Actions",
  name: "Name",
  type: "Type",
  description: "Description",
  publicLabel: "Public",
  blocks: "Blocks",
  block: "Block",
  addBlock: "Add block",
  removeBlock: "Remove",
  moveUp: "Up",
  moveDown: "Down",
  compose: "Compose",
  composeTitle: "Compose template",
  composeResult: "Composed prompt",
  copyComposed: "Copy",
  copied: "Copied",
  copyError: "Could not copy",
  dynamicFor: "Dynamic content for",
  dynamicPlaceholder: "Replacement value",
  missingDynamic: "Enter every dynamic replacement value.",
  noDynamic: "This template has no dynamic blocks.",
  loading: "Loading...",
  empty: "No prompt templates.",
  error: "Could not load prompt templates.",
  searchTemplates: "Search templates...",
  searchBlocks: "Search blocks...",
  allPublic: "Public + private",
  allDynamic: "Dynamic + static",
  allTypes: "All types",
  columns: "Columns",
  selected: (selected, total) => `${selected} of ${total} selected`,
  exportLabel: "Export",
  importLabel: "Import",
  importError: "Could not import file.",
};

const templateFormSchema = z.object({
  name: z.string().trim().min(1).max(100),
  description: z.string().trim().max(1000).optional(),
  is_public: z.boolean(),
});
type TemplateFormValues = z.infer<typeof templateFormSchema>;

const emptyValues: TemplateFormValues = {
  name: "",
  description: "",
  is_public: false,
};

const blockTypes = ["role", "task", "context", "instruction", "example", "format"] as const;
type TemplateSort = "name" | "visibility" | "block_count";
type TemplateBlockSort = "name" | "type" | "dynamic" | "visibility" | "position";

interface TemplateTableParams<TSort extends string> {
  page: number;
  pageSize: number;
  q: string;
  f: string;
  sort: TSort;
  order: DataTableSortDirection;
}

const DEFAULT_TEMPLATE_TABLE_PARAMS: TemplateTableParams<TemplateSort> = {
  page: 1,
  pageSize: 10,
  q: "",
  f: "",
  sort: "name",
  order: "asc",
};

const DEFAULT_BLOCK_TABLE_PARAMS: TemplateTableParams<TemplateBlockSort> = {
  page: 1,
  pageSize: 10,
  q: "",
  f: "",
  sort: "position",
  order: "asc",
};
type ClipboardCopyState = "idle" | "copied" | "error";

type ComposableBlock = Pick<TemplateBlockPublic, "block_id" | "content" | "is_dynamic">;

async function copyTextToClipboard(text: string): Promise<boolean> {
  const clipboard = globalThis.navigator?.clipboard;
  if (!clipboard?.writeText) {
    return false;
  }

  try {
    await clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

function renderComposedPrompt(
  blocks: ComposableBlock[],
  dynamicFields: Record<number, string>,
  fallbackContent: string,
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

export interface PromptTemplateEditorSkinProps {
  labels?: Partial<PromptTemplateEditorLabels>;
}

export default function PromptTemplateEditorSkin({ labels }: PromptTemplateEditorSkinProps) {
  const t = { ...DEFAULT_LABELS, ...labels };
  const templates = usePromptTemplates();
  const blocks = usePromptBlocks();
  const { compose, composeMutation } = useComposePrompt();
  const { exportTemplateMutation, importMutation } = usePromptTransfer();
  const [transferStatus, setTransferStatus] = React.useState<string | null>(null);
  const fileInputRef = React.useRef<HTMLInputElement | null>(null);
  const [editing, setEditing] = React.useState<PromptTemplatePublic | null>(null);
  const [open, setOpen] = React.useState(false);
  const [deleting, setDeleting] = React.useState<PromptTemplatePublic | null>(null);
  const [activeId, setActiveId] = React.useState<number | null>(null);
  const [blockToAdd, setBlockToAdd] = React.useState<string>("");
  const [composeOpen, setComposeOpen] = React.useState(false);
  const [dynamicFields, setDynamicFields] = React.useState<Record<number, string>>({});
  const [composeError, setComposeError] = React.useState<string | null>(null);
  const [composeContent, setComposeContent] = React.useState<string | null>(null);
  const [copyState, setCopyState] = React.useState<ClipboardCopyState>("idle");
  const [templateTableParams, setTemplateTableParams] =
    React.useState<TemplateTableParams<TemplateSort>>(DEFAULT_TEMPLATE_TABLE_PARAMS);
  const [blockTableParams, setBlockTableParams] =
    React.useState<TemplateTableParams<TemplateBlockSort>>(DEFAULT_BLOCK_TABLE_PARAMS);

  const form = useForm<TemplateFormValues>({
    resolver: zodResolver(templateFormSchema),
    defaultValues: emptyValues,
  });

  React.useEffect(() => {
    void templates.refresh();
    void blocks.refresh();
  }, [templates.refresh, blocks.refresh]);

  const activeTemplate =
    templates.data?.data.find((template) => template.id === activeId) ??
    templates.data?.data[0] ??
    null;

  React.useEffect(() => {
    if (activeId === null && templates.data?.data[0]) {
      setActiveId(templates.data.data[0].id);
    }
  }, [activeId, templates.data]);

  const availableBlocks = React.useMemo<PromptBlockPublic[]>(() => {
    const used = new Set((activeTemplate?.blocks ?? []).map((block) => block.block_id));
    return (blocks.data?.data ?? []).filter((block) => !used.has(block.id));
  }, [activeTemplate, blocks.data]);

  const startCreate = () => {
    setEditing(null);
    form.reset(emptyValues);
    setOpen(true);
  };

  const startEdit = (template: PromptTemplatePublic) => {
    setEditing(template);
    form.reset({
      name: template.name,
      description: template.description ?? "",
      is_public: template.is_public,
    });
    setOpen(true);
  };

  const save = async (values: TemplateFormValues) => {
    const body = {
      ...values,
      description: values.description?.trim() ? values.description.trim() : null,
    };
    if (editing) {
      await templates.updateMutation.mutateAsync({ templateId: editing.id, body });
    } else {
      const created = await templates.createMutation.mutateAsync(body);
      setActiveId(created.id);
    }
    setOpen(false);
    setEditing(null);
  };

  const exportTemplate = async (template: PromptTemplatePublic) => {
    setTransferStatus(null);
    const payload = await exportTemplateMutation.mutateAsync(template.id);
    downloadPromptExport(payload, promptExportFilename("template", template.slug));
  };

  const onImportFile = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    setTransferStatus(null);
    try {
      const parsed = await readPromptExportFile(file);
      const result = await importMutation.mutateAsync(parsed);
      setTransferStatus(
        `Imported ${result.templates.created.length} template(s), ${result.templates.skipped.length} skipped (already exist).`,
      );
    } catch {
      setTransferStatus(t.importError);
    }
  };

  const runCompose = async () => {
    if (!activeTemplate) return;
    const dynamicBlocks = activeTemplate.blocks.filter((block) => block.is_dynamic);
    const missing = dynamicBlocks.some(
      (block) => (dynamicFields[block.block_id] ?? "").trim() === ""
    );
    if (missing) {
      setComposeError(t.missingDynamic);
      setComposeContent(null);
      return;
    }
    try {
      setComposeError(null);
      setCopyState("idle");
      const result = await compose(
        activeTemplate.id,
        dynamicBlocks.map((block) => ({
            id: block.block_id,
            content: dynamicFields[block.block_id] ?? "",
          })),
      );
      setComposeContent(renderComposedPrompt(activeTemplate.blocks, dynamicFields, result.content));
    } catch {
      setComposeContent(null);
      setComposeError("Could not compose template.");
    }
  };

  const templateColumns = React.useMemo<ColumnDef<PromptTemplatePublic>[]>(
    () => [
      {
        id: "select",
        header: ({ table }) => (
          <Checkbox
            checked={
              table.getIsAllPageRowsSelected() ||
              (table.getIsSomePageRowsSelected() && "indeterminate")
            }
            onCheckedChange={(value) => table.toggleAllPageRowsSelected(Boolean(value))}
            aria-label="Select all"
          />
        ),
        cell: ({ row }) => (
          <Checkbox
            checked={row.getIsSelected()}
            onCheckedChange={(value) => row.toggleSelected(Boolean(value))}
            aria-label="Select row"
          />
        ),
        enableSorting: false,
        enableHiding: false,
      },
      {
        accessorKey: "name",
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title={t.name} />
        ),
        enableSorting: true,
      },
      {
        id: "actions",
        header: t.actions,
        enableHiding: false,
        cell: ({ row }) => (
          <div className="flex min-w-48 flex-wrap gap-1.5">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-8 px-2 text-xs"
              onClick={() => setActiveId(row.original.id)}
            >
              {t.blocks}
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-8 px-2 text-xs"
              onClick={() => void exportTemplate(row.original)}
            >
              <Download className="mr-1 size-3.5" />
              {t.exportLabel}
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-8 px-2 text-xs"
              onClick={() => startEdit(row.original)}
            >
              {t.edit}
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-8 px-2 text-xs text-destructive hover:text-destructive"
              onClick={() => setDeleting(row.original)}
            >
              {t.deleteLabel}
            </Button>
          </div>
        ),
      },
      {
        accessorFn: (row) => (row.is_public ? "public" : "private"),
        id: "visibility",
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title={t.publicLabel} />
        ),
        enableSorting: true,
        cell: ({ row }) => (
          <Badge variant={row.original.is_public ? "default" : "outline"}>
            {row.original.is_public ? "Public" : "Private"}
          </Badge>
        ),
      },
      {
        accessorFn: (row) => String(row.blocks.length),
        id: "block_count",
        header: ({ column }) => <DataTableColumnHeader column={column} title={t.blocks} />,
        enableSorting: true,
        cell: ({ row }) => row.original.blocks.length,
      },
      {
        accessorKey: "description",
        header: t.description,
        cell: ({ row }) => row.original.description ?? "",
      },
    ],
    [t],
  );

  const blockColumns = React.useMemo<ColumnDef<TemplateBlockPublic>[]>(
    () => [
      {
        id: "select",
        header: ({ table }) => (
          <Checkbox
            checked={
              table.getIsAllPageRowsSelected() ||
              (table.getIsSomePageRowsSelected() && "indeterminate")
            }
            onCheckedChange={(value) => table.toggleAllPageRowsSelected(Boolean(value))}
            aria-label="Select all"
          />
        ),
        cell: ({ row }) => (
          <Checkbox
            checked={row.getIsSelected()}
            onCheckedChange={(value) => row.toggleSelected(Boolean(value))}
            aria-label="Select row"
          />
        ),
        enableSorting: false,
        enableHiding: false,
      },
      {
        accessorKey: "name",
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title={t.name} />
        ),
        enableSorting: true,
      },
      {
        id: "actions",
        header: t.actions,
        enableHiding: false,
        cell: ({ row }) => (
          <div className="flex min-w-40 flex-wrap gap-1.5">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="size-7 p-0"
              disabled={!activeTemplate || row.index === 0 || templates.setPositionMutation.isPending}
              onClick={() => {
                if (!activeTemplate) return;
                templates.setPositionMutation.mutate({
                  templateId: activeTemplate.id,
                  blockId: row.original.block_id,
                  position: row.original.position - 1,
                });
              }}
            >
              <ArrowUp className="size-4" />
              <span className="sr-only">{t.moveUp}</span>
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="size-7 p-0"
              disabled={
                !activeTemplate ||
                row.index === activeTemplate.blocks.length - 1 ||
                templates.setPositionMutation.isPending
              }
              onClick={() => {
                if (!activeTemplate) return;
                templates.setPositionMutation.mutate({
                  templateId: activeTemplate.id,
                  blockId: row.original.block_id,
                  position: row.original.position + 1,
                });
              }}
            >
              <ArrowDown className="size-4" />
              <span className="sr-only">{t.moveDown}</span>
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-7 px-2 text-xs text-destructive hover:text-destructive"
              disabled={!activeTemplate || templates.removeBlockMutation.isPending}
              onClick={() => {
                if (!activeTemplate) return;
                templates.removeBlockMutation.mutate({
                  templateId: activeTemplate.id,
                  blockId: row.original.block_id,
                });
              }}
            >
              {t.removeBlock}
            </Button>
          </div>
        ),
      },
      {
        accessorKey: "type",
        header: ({ column }) => <DataTableColumnHeader column={column} title={t.type} />,
        enableSorting: true,
      },
      {
        accessorFn: (row) => (row.is_dynamic ? "dynamic" : "static"),
        id: "dynamic",
        header: ({ column }) => <DataTableColumnHeader column={column} title="Dynamic" />,
        enableSorting: true,
        cell: ({ row }) => (
          <Badge variant={row.original.is_dynamic ? "default" : "secondary"}>
            {row.original.is_dynamic ? "Dynamic" : "Static"}
          </Badge>
        ),
      },
      {
        accessorFn: (row) => (row.is_public ? "public" : "private"),
        id: "visibility",
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title={t.publicLabel} />
        ),
        enableSorting: true,
        cell: ({ row }) => (
          <Badge variant={row.original.is_public ? "default" : "outline"}>
            {row.original.is_public ? "Public" : "Private"}
          </Badge>
        ),
      },
      {
        accessorKey: "position",
        header: ({ column }) => <DataTableColumnHeader column={column} title="Position" />,
        enableSorting: true,
      },
      {
        accessorKey: "content",
        header: "Content",
        cell: ({ row }) => (
          <p className="line-clamp-2 max-w-xl whitespace-pre-wrap text-muted-foreground">
            {row.original.content}
          </p>
        ),
      },
    ],
    [activeTemplate, t, templates.removeBlockMutation, templates.setPositionMutation],
  );

  const publicFilterOptions: DataTableFilterOptions = {
    title: t.publicLabel,
    options: [
      { label: "Public", value: "public" },
      { label: "Private", value: "private" },
    ],
  };
  const blockFilterOptions: DataTableFilterOptions = {
    title: t.type,
    options: [
      ...blockTypes.map((type) => ({ label: type, value: type })),
      { label: "Dynamic", value: "dynamic" },
      { label: "Static", value: "static" },
      { label: "Public", value: "public" },
      { label: "Private", value: "private" },
    ],
  };

  const filteredTemplates = React.useMemo(() => {
    const q = templateTableParams.q.trim().toLowerCase();
    const rows = (templates.data?.data ?? []).filter((template) => {
      const matchesQuery =
        q === "" ||
        template.name.toLowerCase().includes(q) ||
        template.description?.toLowerCase().includes(q);
      const activeFilters = templateTableParams.f ? templateTableParams.f.split(",") : [];
      const matchesFilter =
        activeFilters.length === 0 ||
        activeFilters.some((filter) => {
          if (filter === "public") return template.is_public;
          if (filter === "private") return !template.is_public;
          return false;
        });
      return matchesQuery && matchesFilter;
    });
    const direction = templateTableParams.order === "desc" ? -1 : 1;
    return rows.sort((left, right) => {
      const leftValue =
        templateTableParams.sort === "visibility"
          ? String(left.is_public)
          : templateTableParams.sort === "block_count"
            ? String(left.blocks.length).padStart(8, "0")
            : left.name;
      const rightValue =
        templateTableParams.sort === "visibility"
          ? String(right.is_public)
          : templateTableParams.sort === "block_count"
            ? String(right.blocks.length).padStart(8, "0")
            : right.name;
      return leftValue.localeCompare(rightValue) * direction;
    });
  }, [templateTableParams, templates.data?.data]);

  const pagedTemplates = React.useMemo(() => {
    const start = (templateTableParams.page - 1) * templateTableParams.pageSize;
    return filteredTemplates.slice(start, start + templateTableParams.pageSize);
  }, [filteredTemplates, templateTableParams.page, templateTableParams.pageSize]);

  const filteredTemplateBlocks = React.useMemo(() => {
    const q = blockTableParams.q.trim().toLowerCase();
    const rows = (activeTemplate?.blocks ?? []).filter((block) => {
      const matchesQuery =
        q === "" ||
        block.name.toLowerCase().includes(q) ||
        block.description?.toLowerCase().includes(q) ||
        block.content.toLowerCase().includes(q);
      const activeFilters = blockTableParams.f ? blockTableParams.f.split(",") : [];
      const matchesFilter =
        activeFilters.length === 0 ||
        activeFilters.some((filter) => {
          if (filter === "dynamic") return block.is_dynamic;
          if (filter === "static") return !block.is_dynamic;
          if (filter === "public") return block.is_public;
          if (filter === "private") return !block.is_public;
          return block.type === filter;
        });
      return matchesQuery && matchesFilter;
    });
    const direction = blockTableParams.order === "desc" ? -1 : 1;
    return rows.sort((left, right) => {
      const leftValue =
        blockTableParams.sort === "dynamic"
          ? String(left.is_dynamic)
          : blockTableParams.sort === "visibility"
            ? String(left.is_public)
            : blockTableParams.sort === "position"
              ? String(left.position).padStart(8, "0")
              : String(left[blockTableParams.sort]);
      const rightValue =
        blockTableParams.sort === "dynamic"
          ? String(right.is_dynamic)
          : blockTableParams.sort === "visibility"
            ? String(right.is_public)
            : blockTableParams.sort === "position"
              ? String(right.position).padStart(8, "0")
              : String(right[blockTableParams.sort]);
      return leftValue.localeCompare(rightValue) * direction;
    });
  }, [activeTemplate?.blocks, blockTableParams]);

  const pagedTemplateBlocks = React.useMemo(() => {
    const start = (blockTableParams.page - 1) * blockTableParams.pageSize;
    return filteredTemplateBlocks.slice(start, start + blockTableParams.pageSize);
  }, [blockTableParams.page, blockTableParams.pageSize, filteredTemplateBlocks]);

  return (
    <section className="not-content space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3 pb-3">
        <div className="space-y-2">
          <h2 className="text-xl font-semibold tracking-tight">{t.title}</h2>
          <p className="text-sm text-muted-foreground">{t.subtitle}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant="outline"
            disabled={importMutation.isPending}
            onClick={() => fileInputRef.current?.click()}
          >
            <Upload className="mr-2 size-4" />
            {t.importLabel}
          </Button>
          <input
            ref={fileInputRef}
            type="file"
            accept="application/json,.json"
            className="hidden"
            onChange={onImportFile}
          />
          <Button type="button" onClick={startCreate}>
            <Plus className="mr-2 size-4" />
            {t.create}
          </Button>
        </div>
      </div>

      {transferStatus ? (
        <p role="status" className="text-sm text-muted-foreground">
          {transferStatus}
        </p>
      ) : null}

      {templates.loading && !templates.data ? (
        <p className="text-sm text-muted-foreground">{t.loading}</p>
      ) : null}
      {templates.error && !templates.data ? (
        <p role="alert" className="text-sm text-destructive">
          {t.error}
        </p>
      ) : null}

      <DataTable
        key="prompt-template-table-actions-v2"
        columns={templateColumns}
        data={pagedTemplates}
        loading={templates.loading}
        rowCount={filteredTemplates.length}
        page={templateTableParams.page}
        pageSize={templateTableParams.pageSize}
        onPageChange={(page) =>
          setTemplateTableParams((current) => ({ ...current, page }))
        }
        onPageSizeChange={(pageSize) =>
          setTemplateTableParams((current) => ({ ...current, page: 1, pageSize }))
        }
        sortBy={templateTableParams.sort}
        sortDir={templateTableParams.order}
        onSortChange={(sort, order) =>
          setTemplateTableParams((current) => ({
            ...current,
            page: 1,
            sort: (sort as TemplateSort | undefined) ?? DEFAULT_TEMPLATE_TABLE_PARAMS.sort,
            order: order ?? DEFAULT_TEMPLATE_TABLE_PARAMS.order,
          }))
        }
        q={templateTableParams.q}
        onSearchChange={(q) =>
          setTemplateTableParams((current) => ({ ...current, page: 1, q }))
        }
        f={templateTableParams.f}
        onFilterChange={(f) =>
          setTemplateTableParams((current) => ({ ...current, page: 1, f }))
        }
        filterOptions={publicFilterOptions}
        labels={{
          loading: t.loading,
          empty: t.empty,
          toolbar: {
            search: t.searchTemplates,
            reset: "Reset",
            viewOptions: { view: t.columns, toggleColumns: t.columns },
          },
          pagination: {
            selectedRows: t.selected,
          },
        }}
      />

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <FileText className="size-4" />
            {activeTemplate ? activeTemplate.name : t.blocks}
          </CardTitle>
          <CardDescription>
            {activeTemplate?.description ?? t.blocks}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {activeTemplate ? (
            <>
              <div className="flex flex-col gap-3 md:flex-row md:items-center">
                <Select value={blockToAdd} onValueChange={setBlockToAdd}>
                  <SelectTrigger className="md:max-w-sm">
                    <SelectValue placeholder={t.addBlock} />
                  </SelectTrigger>
                  <SelectContent>
                    {availableBlocks.map((block) => (
                      <SelectItem key={block.id} value={String(block.id)}>
                        {block.name} ({block.type})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  type="button"
                  variant="outline"
                  disabled={!blockToAdd || templates.addBlockMutation.isPending}
                  onClick={() => {
                    templates.addBlockMutation.mutate({
                      templateId: activeTemplate.id,
                      blockId: Number(blockToAdd),
                      position: activeTemplate.blocks.length,
                    });
                    setBlockToAdd("");
                  }}
                >
                  <Plus className="mr-2 size-4" />
                  {t.addBlock}
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  className="md:ml-auto"
                  onClick={() => {
                    setDynamicFields({});
                    setComposeError(null);
                    setComposeContent(null);
                    setCopyState("idle");
                    setComposeOpen(true);
                  }}
                >
                  <Wand2 className="mr-2 size-4" />
                  {t.compose}
                </Button>
              </div>
              <DataTable
                key={`prompt-template-blocks-actions-v2-${activeTemplate.id}`}
                columns={blockColumns}
                data={pagedTemplateBlocks}
                loading={templates.loading}
                rowCount={filteredTemplateBlocks.length}
                page={blockTableParams.page}
                pageSize={blockTableParams.pageSize}
                onPageChange={(page) =>
                  setBlockTableParams((current) => ({ ...current, page }))
                }
                onPageSizeChange={(pageSize) =>
                  setBlockTableParams((current) => ({ ...current, page: 1, pageSize }))
                }
                sortBy={blockTableParams.sort}
                sortDir={blockTableParams.order}
                onSortChange={(sort, order) =>
                  setBlockTableParams((current) => ({
                    ...current,
                    page: 1,
                    sort: (sort as TemplateBlockSort | undefined) ?? DEFAULT_BLOCK_TABLE_PARAMS.sort,
                    order: order ?? DEFAULT_BLOCK_TABLE_PARAMS.order,
                  }))
                }
                q={blockTableParams.q}
                onSearchChange={(q) =>
                  setBlockTableParams((current) => ({ ...current, page: 1, q }))
                }
                f={blockTableParams.f}
                onFilterChange={(f) =>
                  setBlockTableParams((current) => ({ ...current, page: 1, f }))
                }
                filterOptions={blockFilterOptions}
                labels={{
                  loading: t.loading,
                  empty: t.blocks,
                  toolbar: {
                    search: t.searchBlocks,
                    reset: "Reset",
                    viewOptions: { view: t.columns, toggleColumns: t.columns },
                  },
                  pagination: {
                    selectedRows: t.selected,
                  },
                }}
              />
            </>
          ) : (
            <p className="text-sm text-muted-foreground">{t.empty}</p>
          )}
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? t.edit : t.create}</DialogTitle>
            <DialogDescription>{t.subtitle}</DialogDescription>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(save)} className="space-y-4">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t.name}</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t.description}</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="is_public"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-4">
                    <FormControl>
                      <Checkbox checked={field.value} onCheckedChange={field.onChange} />
                    </FormControl>
                    <div className="space-y-1 leading-none">
                      <FormLabel>{t.publicLabel}</FormLabel>
                      <FormDescription>Available outside private owner scope.</FormDescription>
                    </div>
                  </FormItem>
                )}
              />
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                  {t.cancel}
                </Button>
                <Button
                  type="submit"
                  disabled={templates.createMutation.isPending || templates.updateMutation.isPending}
                >
                  {t.save}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      <Dialog open={composeOpen} onOpenChange={setComposeOpen}>
        <DialogContent className="max-h-[calc(100dvh-2rem)] max-w-[calc(100vw-2rem)] overflow-y-auto sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>
              {activeTemplate ? `${t.composeTitle}: ${activeTemplate.name}` : t.composeTitle}
            </DialogTitle>
            <DialogDescription>{activeTemplate?.description ?? activeTemplate?.name}</DialogDescription>
          </DialogHeader>
          <div className="min-w-0 space-y-4">
            {(activeTemplate?.blocks ?? []).filter((block) => block.is_dynamic).length === 0 ? (
              <p className="text-sm text-muted-foreground">{t.noDynamic}</p>
            ) : (
              (activeTemplate?.blocks ?? [])
                .filter((block) => block.is_dynamic)
                .map((block) => (
                  <div key={block.block_id} className="mb-3 space-y-3">
                    <label className="block py-2 text-sm font-medium">
                      {t.dynamicFor}: {block.name}
                    </label>
                    <Textarea
                      rows={3}
                      placeholder={t.dynamicPlaceholder}
                      value={dynamicFields[block.block_id] ?? ""}
                      onChange={(event) =>
                        setDynamicFields((current) => ({
                          ...current,
                          [block.block_id]: event.target.value,
                        }))
                      }
                    />
                    <pre className="whitespace-pre-wrap rounded-md border bg-muted/30 p-3 text-xs text-muted-foreground">
                      {block.content}
                    </pre>
                  </div>
                ))
            )}
            {composeError ? (
              <p role="alert" className="text-sm text-destructive">
                {composeError}
              </p>
            ) : null}
            {composeContent ? (
              <div className="space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-3 py-2">
                  <p className="text-sm font-medium">{t.composeResult}</p>
                  <div className="flex items-center gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        void copyTextToClipboard(composeContent).then((copied) =>
                          setCopyState(copied ? "copied" : "error"),
                        );
                      }}
                    >
                      <Copy className="mr-2 size-4" />
                      {t.copyComposed}
                    </Button>
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
                <Textarea
                  className="min-h-40 max-h-72 max-w-full resize-y overflow-auto"
                  value={composeContent}
                  onChange={(event) => setComposeContent(event.target.value)}
                />
              </div>
            ) : null}
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setComposeOpen(false)}>
              {t.cancel}
            </Button>
            <Button type="button" disabled={composeMutation.isPending} onClick={() => void runCompose()}>
              {t.compose}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={deleting !== null} onOpenChange={(next) => !next && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t.deleteTitle}</AlertDialogTitle>
            <AlertDialogDescription>
              {deleting?.name}: {t.deleteDescription}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t.cancel}</AlertDialogCancel>
            <AlertDialogAction
              disabled={templates.deleteMutation.isPending}
              onClick={() => {
                if (!deleting) return;
                void templates.deleteMutation
                  .mutateAsync(deleting.id)
                  .finally(() => {
                    setDeleting(null);
                    if (activeId === deleting.id) setActiveId(null);
                  });
              }}
            >
              {t.deleteLabel}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
}
