"use client";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import { AnnouncementsPageContent } from "./AnnouncementsPageContent";
import { TemplatesPageContent } from "../templates/TemplatesPageContent";

type Tab = "announcements" | "templates";

function CommunicationsTabs() {
  const params = useSearchParams();
  const initial: Tab =
    params.get("tab") === "templates" ? "templates" : "announcements";
  const [tab, setTab] = useState<Tab>(initial);

  const TABS: { key: Tab; label: string }[] = [
    { key: "announcements", label: "Announcements" },
    { key: "templates", label: "Templates" },
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
      {tab === "announcements" ? (
        <AnnouncementsPageContent />
      ) : (
        <TemplatesPageContent />
      )}
    </div>
  );
}

export function CommunicationsWorkspace() {
  return (
    <Suspense fallback={null}>
      <CommunicationsTabs />
    </Suspense>
  );
}
