"use client";

import { useState } from "react";
import { ViewPageContent } from "@/app/(dashboard)/view/ViewPageContent";
import { UploadPageContent } from "./UploadPageContent";
import { StudentsActionBar } from "@/features/students/components/StudentsActionBar";

type TabId = "view" | "upload";

export function StudentsPageContent() {
  const [activeTab, setActiveTab] = useState<TabId>("view");
  const [reloadKey, setReloadKey] = useState(0);

  return (
    <div className="space-y-1">
      {activeTab === "view" && (
        <>
          <StudentsActionBar
            onUpload={() => setActiveTab("upload")}
            onCreated={() => setReloadKey((k) => k + 1)}
          />
          <ViewPageContent
            key={reloadKey}
            onNavigateUpload={() => setActiveTab("upload")}
          />
        </>
      )}
      {activeTab === "upload" && (
        <UploadPageContent onBack={() => setActiveTab("view")} />
      )}
    </div>
  );
}
