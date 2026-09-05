import { createContext, useCallback, useContext, useEffect, useState } from "react";
import type { ReactNode } from "react";
import { ApiError, getActiveRequesters } from "../api";
import type { Requester } from "../api";

// BR-07: the selected Requester id lives in sessionStorage only - cleared
// when the tab closes, never a cookie or server session, so this reads as
// visibly different from real authentication.
const STORAGE_KEY = "toktickit.devRequesterId";

type Status = "loading" | "ready" | "error";

interface RequesterContextValue {
  status: Status;
  error: string | null;
  requesters: Requester[];
  requester: Requester | null;
  selectRequester: (id: number) => void;
  changeRequester: () => void;
  retry: () => void;
}

const RequesterContext = createContext<RequesterContextValue | undefined>(undefined);

function readStoredId(): number | null {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    const id = raw ? Number(raw) : NaN;
    return Number.isInteger(id) ? id : null;
  } catch {
    return null;
  }
}

function writeStoredId(id: number | null): void {
  try {
    if (id === null) {
      sessionStorage.removeItem(STORAGE_KEY);
    } else {
      sessionStorage.setItem(STORAGE_KEY, String(id));
    }
  } catch {
    // sessionStorage unavailable (private mode, disabled storage, ...):
    // the selection just won't survive a reload, which is not fatal for a
    // testing-only mechanism.
  }
}

export function RequesterProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<Status>("loading");
  const [error, setError] = useState<string | null>(null);
  const [requesters, setRequesters] = useState<Requester[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [reloadToken, setReloadToken] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setStatus("loading");
    setError(null);

    getActiveRequesters()
      .then((list) => {
        if (cancelled) return;
        setRequesters(list);

        const storedId = readStoredId();
        const stillActive = storedId !== null && list.some((r) => r.id === storedId);
        if (storedId !== null && !stillActive) {
          // BR-09: the stored Requester no longer appears among active
          // Requesters (deactivated, or the session is stale) - drop it.
          writeStoredId(null);
        }
        setSelectedId(stillActive ? storedId : null);
        setStatus("ready");
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setError(err instanceof ApiError ? err.message : "Unable to load development requesters");
        setStatus("error");
      });

    return () => {
      cancelled = true;
    };
  }, [reloadToken]);

  const selectRequester = useCallback((id: number) => {
    writeStoredId(id);
    setSelectedId(id);
  }, []);

  // BR-10: clears the selection; every page keyed on `requester.id` will
  // naturally refetch once a new Requester is selected, never reusing data.
  const changeRequester = useCallback(() => {
    writeStoredId(null);
    setSelectedId(null);
  }, []);

  const retry = useCallback(() => setReloadToken((t) => t + 1), []);

  const requester = requesters.find((r) => r.id === selectedId) ?? null;

  return (
    <RequesterContext.Provider
      value={{ status, error, requesters, requester, selectRequester, changeRequester, retry }}
    >
      {children}
    </RequesterContext.Provider>
  );
}

export function useRequester(): RequesterContextValue {
  const ctx = useContext(RequesterContext);
  if (!ctx) {
    throw new Error("useRequester must be used within a RequesterProvider");
  }
  return ctx;
}
