import { createContext, useCallback, useContext, useEffect, useState } from "react";
import type { ReactNode } from "react";
import { ApiError, getCurrentUser, login as apiLogin, logout as apiLogout } from "../api";
import type { AuthUser } from "../api";

// Lab 3 replaces the Lab 2 RequesterContext (BR-42). There is deliberately no
// browser storage here: the session lives in an httpOnly cookie the client
// cannot read, so "who am I" is always answered by asking the server.

type Status = "loading" | "ready";

interface AuthContextValue {
  status: Status;
  user: AuthUser | null;
  signIn: (email: string, password: string) => Promise<AuthUser>;
  signOut: () => Promise<void>;
  setUser: (user: AuthUser) => void;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<Status>("loading");
  const [user, setUserState] = useState<AuthUser | null>(null);

  useEffect(() => {
    let cancelled = false;

    getCurrentUser()
      .then((current) => {
        if (!cancelled) setUserState(current);
      })
      .catch((err: unknown) => {
        // A 401 here is the normal "not signed in yet" case, not a failure.
        if (!cancelled && !(err instanceof ApiError && err.status === 401)) {
          console.error("[auth] unable to load the current user", err);
        }
      })
      .finally(() => {
        if (!cancelled) setStatus("ready");
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const signIn = useCallback(async (email: string, password: string) => {
    const signedIn = await apiLogin(email, password);
    setUserState(signedIn);
    return signedIn;
  }, []);

  const signOut = useCallback(async () => {
    try {
      await apiLogout();
    } finally {
      // Whatever the server said, this browser is done with the session.
      setUserState(null);
    }
  }, []);

  return (
    <AuthContext.Provider value={{ status, user, signIn, signOut, setUser: setUserState }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return ctx;
}
