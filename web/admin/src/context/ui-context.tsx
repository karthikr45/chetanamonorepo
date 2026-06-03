"use client";

import {
  createContext,
  useCallback,
  useContext,
  useState,
  type ReactNode,
} from "react";

interface UiContextValue {
  sidebarOpen: boolean;
  setSidebarOpen: (open: boolean) => void;
  toggleSidebar: () => void;
}

const UiContext = createContext<UiContextValue | null>(null);

export function UiProvider({ children }: { children: ReactNode }) {
  const [sidebarOpen, setSidebarOpenState] = useState(false);

  const setSidebarOpen = useCallback((open: boolean) => {
    setSidebarOpenState(open);
  }, []);

  const toggleSidebar = useCallback(() => {
    setSidebarOpenState((prev) => !prev);
  }, []);

  const value: UiContextValue = {
    sidebarOpen,
    setSidebarOpen,
    toggleSidebar,
  };

  return <UiContext.Provider value={value}>{children}</UiContext.Provider>;
}

export function useUi() {
  const ctx = useContext(UiContext);
  if (!ctx) {
    throw new Error("useUi must be used within UiProvider");
  }
  return ctx;
}
