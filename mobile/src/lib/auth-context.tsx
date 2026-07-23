import React, { createContext, useCallback, useContext, useEffect, useState } from "react";
import { api, ApiError, getToken, logout as apiLogout, type Me } from "./api";

type AuthState = {
  ready: boolean;
  me: Me | null;
  refresh: () => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthState>({
  ready: false,
  me: null,
  refresh: async () => {},
  signOut: async () => {},
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);
  const [me, setMe] = useState<Me | null>(null);

  const refresh = useCallback(async () => {
    const token = await getToken();
    if (!token) {
      setMe(null);
      return;
    }
    try {
      setMe(await api.me());
    } catch (err) {
      // 401 → token expired or access revoked; network errors keep the old profile.
      if (err instanceof ApiError && err.status === 401) {
        await apiLogout();
        setMe(null);
      }
    }
  }, []);

  useEffect(() => {
    (async () => {
      await refresh();
      setReady(true);
    })();
  }, [refresh]);

  const signOut = useCallback(async () => {
    await apiLogout();
    setMe(null);
  }, []);

  return (
    <AuthContext.Provider value={{ ready, me, refresh, signOut }}>{children}</AuthContext.Provider>
  );
}

export function useAuth(): AuthState {
  return useContext(AuthContext);
}
