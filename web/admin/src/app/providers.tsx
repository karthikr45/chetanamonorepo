"use client";

import { Provider as ReduxProvider } from "react-redux";
import { store } from "@/store";
import { UiProvider } from "@/context/ui-context";
import { AuthProvider } from "@/features/auth";
import type { ReactNode } from "react";

export function Providers({ children }: { children: ReactNode }) {
  return (
    <ReduxProvider store={store}>
      <AuthProvider>
        <UiProvider>{children}</UiProvider>
      </AuthProvider>
    </ReduxProvider>
  );
}
