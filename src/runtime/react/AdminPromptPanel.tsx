import * as React from "react";
import { usePromptAdmin } from "../hooks/usePromptAdmin.js";

export interface AdminPromptDashboardLabels {
  title: string;
  subtitle: string;
  forbidden: string;
  blocks: string;
  templates: string;
  categories: string;
  users: string;
  loading: string;
  error: string;
  emptyActivity: string;
  noCategories: string;
  activityFor: string;
  overviewTitle: string;
}

const DEFAULT_LABELS: AdminPromptDashboardLabels = {
  title: "Prompt admin",
  subtitle: "Prompt-engine overview at a glance.",
  forbidden: "You need administrator access to view this page.",
  blocks: "Blocks",
  templates: "Templates",
  categories: "Categories",
  users: "Active users",
  loading: "Loading…",
  error: "Could not load admin data.",
  emptyActivity: "No recent activity.",
  noCategories: "No categories yet.",
  activityFor: "Model",
  overviewTitle: "Overview"
};

export interface AdminPromptPanelProps {
  labels?: Partial<AdminPromptDashboardLabels>;
}

function StatCard({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="rounded-md border bg-card p-4">
      <p className="text-sm font-medium text-muted-foreground">{label}</p>
      <p className="mt-1 text-2xl font-semibold tabular-nums">{value}</p>
    </div>
  );
}

export function AdminPromptPanel({ labels }: AdminPromptPanelProps) {
  const t: AdminPromptDashboardLabels = { ...DEFAULT_LABELS, ...labels };
  const { allowed, overview, loading, error, load } = usePromptAdmin();
  const [ready, setReady] = React.useState(false);

  React.useEffect(() => {
    if (!allowed) {
      setReady(true);
      return undefined;
    }
    let cancelled = false;
    void load()
      .catch(() => undefined)
      .finally(() => {
        if (!cancelled) setReady(true);
      });
    return () => {
      cancelled = true;
    };
  }, [allowed, load]);

  if (!allowed) {
    return (
      <section className="not-content mx-auto w-full max-w-md py-10 text-center text-sm text-muted-foreground">
        {t.forbidden}
      </section>
    );
  }

  if (!ready && loading) {
    return (
      <section className="not-content space-y-6" aria-busy="true">
        <p className="text-sm">{t.loading}</p>
      </section>
    );
  }

  if (error && !overview) {
    return (
      <section className="not-content">
        <p role="alert" className="rounded-md border border-destructive/50 p-4 text-sm text-destructive">
          {t.error}
        </p>
      </section>
    );
  }

  return (
    <section className="not-content space-y-6">
      <div className="space-y-1">
        <h2 className="text-xl font-semibold tracking-tight">{t.title}</h2>
        <p className="text-sm text-muted-foreground">{t.subtitle}</p>
      </div>

      <div className="grid auto-rows-fr gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label={t.blocks} value={overview?.blocks.count ?? 0} />
        <StatCard label={t.templates} value={overview?.templates.count ?? 0} />
        <StatCard label={t.categories} value={overview?.categories?.count ?? 0} />
        <StatCard label={t.users} value={overview?.activity.nb_users ?? 0} />
      </div>

      <div className="space-y-2">
        <h3 className="text-base font-semibold">{t.overviewTitle}</h3>
        <ul className="space-y-1 rounded-md border p-4 text-sm">
          {(overview?.activity.activity.activity ?? []).length === 0 ? (
            <li className="text-muted-foreground">{t.emptyActivity}</li>
          ) : (
            (overview?.activity.activity.activity ?? []).map((counter) => (
              <li key={counter.model} className="flex justify-between">
                <span>{counter.model}</span>
                <span className="tabular-nums">
                  +{counter.added} · ↻{counter.updated}
                </span>
              </li>
            ))
          )}
        </ul>
      </div>
    </section>
  );
}