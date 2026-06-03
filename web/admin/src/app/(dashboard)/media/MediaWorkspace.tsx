"use client";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import { ViewMediaPageContainer } from "./ViewMediaPageContainer";
import { SaveMediaPageContent } from "../save-media/SaveMediaPageContent";

type Tab = "library" | "upload";

function MediaTabs() {
  const params = useSearchParams();
  const initial: Tab = params.get("tab") === "upload" ? "upload" : "library";
  const [tab, setTab] = useState<Tab>(initial);

  const TABS: { key: Tab; label: string }[] = [
    { key: "library", label: "Library" },
    { key: "upload", label: "Upload" },
  ];

  return (
    <div>
      <div className="flex flex-wrap gap-2 mb-5">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className="px-4 py-2 rounded-lg text-sm font-semibold transition-colors"
            style={{
              backgroundColor: tab === t.key ? "#6c739c" : "#e2e8f0",
              color: tab === t.key ? "#fff" : "#0f172a",
            }}
          >
            {t.label}
          </button>
        ))}
      </div>
      {tab === "library" ? (
        <ViewMediaPageContainer />
      ) : (
        <SaveMediaPageContent />
      )}
    </div>
  );
}

export function MediaWorkspace() {
  return (
    <Suspense fallback={null}>
      <MediaTabs />
    </Suspense>
  );
}
