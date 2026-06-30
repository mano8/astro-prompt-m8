"use client";

// Prompt admin "Maintenance / Danger zone": the destructive create/edit/delete
// operations on blocks and templates, each behind a shadcn `alert-dialog`
// confirmation. Logic stays a live dependency
// (@mano8/astro-prompt-m8/hooks); this file is only the shadcn skin, copied
// into the consumer via the @mano8-prompt registry — edit freely per app.
import * as React from "react";
import { AlertTriangle } from "lucide-react";
import { usePromptBlocks } from "@mano8/astro-prompt-m8/hooks";
import { usePromptTemplates } from "@mano8/astro-prompt-m8/hooks";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger
} from "@/components/ui/alert-dialog";

export interface PromptMaintenanceLabels {
  title: string;
  subtitle: string;
  blocksTitle: string;
  blocksDescription: string;
  templatesTitle: string;
  templatesDescription: string;
  confirmTitle: string;
  cancel: string;
  confirm: string;
  running: string;
  error: string;
  empty: string;
  blockDelete: string;
  templateDelete: string;
}

const DEFAULT_LABELS: PromptMaintenanceLabels = {
  title: "Maintenance",
  subtitle: "Destructive prompt-engine operations. Each action is irreversible.",
  blocksTitle: "Delete a prompt block",
  blocksDescription: "Blocks used by a template cannot be deleted; detach them first.",
  templatesTitle: "Delete a prompt template",
  templatesDescription: "Removes the template and detaches all its blocks.",
  confirmTitle: "Are you sure?",
  cancel: "Cancel",
  confirm: "Delete",
  running: "Deleting…",
  error: "Deletion failed.",
  empty: "Nothing to delete.",
  blockDelete: "Delete block",
  templateDelete: "Delete template"
};

export interface PromptMaintenancePanelProps {
  labels?: Partial<PromptMaintenanceLabels>;
}

export function PromptMaintenancePanel({ labels }: PromptMaintenancePanelProps) {
  const t = { ...DEFAULT_LABELS, ...labels };
  const blockHook = usePromptBlocks();
  const templateHook = usePromptTemplates();
  const [error, setError] = React.useState<string | null>(null);

  const deleteBlock = async (id: number) => {
    try {
      setError(null);
      await blockHook.deleteMutation.mutateAsync(id);
    } catch {
      setError(t.error);
    }
  };

  const deleteTemplate = async (id: number) => {
    try {
      setError(null);
      await templateHook.deleteMutation.mutateAsync(id);
    } catch {
      setError(t.error);
    }
  };

  return (
    <div className="not-content space-y-6">
      <div className="space-y-1">
        <h2 className="text-xl font-semibold tracking-tight">{t.title}</h2>
        <p className="text-sm text-muted-foreground">{t.subtitle}</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t.blocksTitle}</CardTitle>
          <CardDescription>{t.blocksDescription}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {(blockHook.data?.data ?? []).length === 0 ? (
            <p className="text-sm text-muted-foreground">{t.empty}</p>
          ) : (
            (blockHook.data?.data ?? []).map((block) => (
              <div
                key={block.id}
                className="flex items-center justify-between rounded-md border p-3"
              >
                <div>
                  <p className="text-sm font-medium">{block.name}</p>
                  <p className="text-xs text-muted-foreground">{block.type}</p>
                </div>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="outline" size="sm" className="gap-2 text-destructive">
                      <AlertTriangle className="size-4" />
                      {t.blockDelete}
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>{t.confirmTitle}</AlertDialogTitle>
                      <AlertDialogDescription>
                        {block.name} — {t.blocksDescription}
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>{t.cancel}</AlertDialogCancel>
                      <AlertDialogAction
                        disabled={blockHook.deleteMutation.isPending}
                        onClick={() => void deleteBlock(block.id)}
                      >
                        {blockHook.deleteMutation.isPending ? t.running : t.confirm}
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t.templatesTitle}</CardTitle>
          <CardDescription>{t.templatesDescription}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {(templateHook.data?.data ?? []).length === 0 ? (
            <p className="text-sm text-muted-foreground">{t.empty}</p>
          ) : (
            (templateHook.data?.data ?? []).map((tpl) => (
              <div
                key={tpl.id}
                className="flex items-center justify-between rounded-md border p-3"
              >
                <div>
                  <p className="text-sm font-medium">{tpl.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {tpl.blocks.length} blocks
                  </p>
                </div>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="outline" size="sm" className="gap-2 text-destructive">
                      <AlertTriangle className="size-4" />
                      {t.templateDelete}
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>{t.confirmTitle}</AlertDialogTitle>
                      <AlertDialogDescription>
                        {tpl.name} — {t.templatesDescription}
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>{t.cancel}</AlertDialogCancel>
                      <AlertDialogAction
                        disabled={templateHook.deleteMutation.isPending}
                        onClick={() => void deleteTemplate(tpl.id)}
                      >
                        {templateHook.deleteMutation.isPending ? t.running : t.confirm}
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      {error ? (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      ) : null}
    </div>
  );
}