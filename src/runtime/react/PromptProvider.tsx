import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode
} from "react";
import { configurePrompt, type PromptRuntimeConfig } from "../config.js";
import { getPromptAuthAdapter, type PromptAuthAdapter } from "../authAdapter.js";
import {
  runPromptEngineM8Preflight,
  type PromptEngineM8Preflight
} from "../api/meta.js";

export type PromptContextValue = {
  adapter: PromptAuthAdapter;
  user: unknown;
  isSuperuser: boolean;
  loading: boolean;
  /**
   * Result of the once-per-session `GET /meta` compatibility preflight, or
   * `null` while it is still in flight. Consume it through
   * `usePromptCompatibility`; the shipped skins render the shared `state-error`
   * block when `status` is `"incompatible"`.
   */
  compatibility: PromptEngineM8Preflight | null;
};

const PromptContext = createContext<PromptContextValue | null>(null);

function isPromiseLike(value: unknown): value is PromiseLike<unknown> {
  return Boolean(
    value &&
      (typeof value === "object" || typeof value === "function") &&
      "then" in value &&
      typeof (value as { then?: unknown }).then === "function"
  );
}

function readAdapterUser(adapter: PromptAuthAdapter): { user: unknown; loading: boolean } {
  if (!adapter.getUser) return { user: null, loading: false };
  try {
    const value = adapter.getUser();
    if (isPromiseLike(value)) return { user: null, loading: true };
    return { user: value, loading: false };
  } catch {
    return { user: null, loading: false };
  }
}

export function PromptProvider({
  children,
  config,
  adapter
}: {
  children: ReactNode;
  config?: Partial<PromptRuntimeConfig>;
  adapter?: PromptAuthAdapter;
}) {
  if (config) configurePrompt(config);

  const resolved = adapter ?? getPromptAuthAdapter();
  const [authState, setAuthState] = useState(() => readAdapterUser(resolved));
  const [compatibility, setCompatibility] = useState<PromptEngineM8Preflight | null>(null);

  // `H5`: the compatibility guard's live call site. The runner is memoised on
  // its module, so mounting four views does not read `/meta` four times, and it
  // resolves rather than rejects — an unreachable service must not take the
  // provider down before the views have a chance to say so.
  useEffect(() => {
    let cancelled = false;
    void runPromptEngineM8Preflight().then((result) => {
      if (!cancelled) setCompatibility(result);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!resolved.getUser) {
      setAuthState({ user: null, loading: false });
      return undefined;
    }

    let cancelled = false;
    try {
      const value = resolved.getUser();
      if (!isPromiseLike(value)) {
        setAuthState({ user: value, loading: false });
        return undefined;
      }

      setAuthState((current) => ({ ...current, loading: true }));
      Promise.resolve(value)
        .then((nextUser) => {
          if (!cancelled) setAuthState({ user: nextUser, loading: false });
        })
        .catch(() => {
          if (!cancelled) setAuthState({ user: null, loading: false });
        });
    } catch {
      setAuthState({ user: null, loading: false });
    }

    return () => {
      cancelled = true;
    };
  }, [resolved]);

  const currentUserState = readAdapterUser(resolved);
  const user = currentUserState.loading ? authState.user : currentUserState.user;
  const loading = currentUserState.loading ? authState.loading : false;

  const value = useMemo<PromptContextValue>(
    () => ({
      adapter: resolved,
      user,
      isSuperuser: Boolean(resolved.isSuperuser?.(user)),
      loading,
      compatibility
    }),
    [compatibility, loading, resolved, user]
  );

  return <PromptContext.Provider value={value}>{children}</PromptContext.Provider>;
}

export function usePromptContext(): PromptContextValue {
  const context = useContext(PromptContext);
  if (!context) throw new Error("usePromptContext must be used inside PromptProvider");
  return context;
}
