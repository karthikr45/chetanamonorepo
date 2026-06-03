"use client";

import { useState, useRef, useCallback } from "react";
import dynamic from "next/dynamic";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const ReactPlayer = dynamic(() => import("react-player"), { ssr: false }) as any;

const TABS = [
  { id: "audio" as const, label: "Audio" },
  { id: "video" as const, label: "Video" },
];

type TabId = "audio" | "video";

type UploadedFile = {
  file: File;
  previewUrl: string;
  name: string;
  size: number;
  type: string;
};

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function formatFileName(name: string): string {
  return name.replace(/[-_]/g, " ").replace(/\.\w+$/, "");
}

/* ─── Audio Preview Card ─── */
function AudioPreview({ item, onRemove }: { item: UploadedFile; onRemove: () => void }) {
  return (
    <div
      className="flex flex-col gap-2.5 rounded-xl border p-3"
      style={{ backgroundColor: "var(--app-card-bg)", borderColor: "var(--app-divider)" }}
    >
      {/* Header row */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <div
            className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg"
            style={{ backgroundColor: "var(--app-search-bg)" }}
          >
            <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" style={{ color: "var(--app-brand)" }}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
            </svg>
          </div>
          <div className="min-w-0">
            <p className="truncate text-xs font-medium" style={{ color: "var(--app-text-primary)" }} title={item.name}>
              {formatFileName(item.name)}
            </p>
            <p className="text-[10px]" style={{ color: "var(--app-text-secondary)" }}>
              {formatSize(item.size)}
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={onRemove}
          className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded transition-colors hover:bg-[var(--app-nav-hover-bg)]"
          style={{ color: "var(--app-danger)" }}
          aria-label="Remove"
        >
          <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Audio player with native controls (play, seek, volume) */}
      <ReactPlayer
        src={item.previewUrl}
        controls
        width="100%"
        height={40}
      />
    </div>
  );
}

/* ─── Video Preview Card ─── */
function VideoPreview({ item, onRemove }: { item: UploadedFile; onRemove: () => void }) {
  const [playing, setPlaying] = useState(false);

  return (
    <div
      className="flex flex-col overflow-hidden rounded-xl border"
      style={{ backgroundColor: "var(--app-card-bg)", borderColor: "var(--app-divider)" }}
    >
      <div className="relative h-40 w-full bg-black">
        <ReactPlayer
          src={item.previewUrl}
          playing={playing}
          controls
          width="100%"
          height="100%"
          style={{ position: "absolute", top: 0, left: 0 }}
          onPlay={() => setPlaying(true)}
          onPause={() => setPlaying(false)}
          onEnded={() => setPlaying(false)}
        />
       
      </div>

      {/* Info */}
      <div className="flex items-center justify-between gap-2 px-3 py-2">
        <div className="min-w-0">
          <p className="truncate text-xs font-medium" style={{ color: "var(--app-text-primary)" }} title={item.name}>
            {formatFileName(item.name)}
          </p>
          <p className="text-[10px]" style={{ color: "var(--app-text-secondary)" }}>
            {formatSize(item.size)}
          </p>
        </div>
        <button
          type="button"
          onClick={onRemove}
          className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded transition-colors hover:bg-[var(--app-nav-hover-bg)]"
          style={{ color: "var(--app-danger)" }}
          aria-label="Remove"
        >
          <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
    </div>
  );
}

/* ─── Main Page Content ─── */
export function SaveMediaPageContent() {
  const [activeTab, setActiveTab] = useState<TabId>("audio");
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
  const [dragOver, setDragOver] = useState(false);
  const [uploading, setUploading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const acceptMap: Record<TabId, string> = {
    audio: "audio/*",
    video: "video/*",
  };

  const handleFiles = useCallback(
    (incoming: FileList | null) => {
      if (!incoming) return;
      const newFiles: UploadedFile[] = Array.from(incoming)
        .filter((f) => {
          if (activeTab === "audio") return f.type.startsWith("audio/");
          return f.type.startsWith("video/");
        })
        .map((f) => ({
          file: f,
          previewUrl: URL.createObjectURL(f),
          name: f.name,
          size: f.size,
          type: f.type,
        }));
      setUploadedFiles((prev) => [...prev, ...newFiles]);
    },
    [activeTab]
  );

  const removeFile = (index: number) => {
    setUploadedFiles((prev) => {
      const removed = prev[index];
      if (removed) URL.revokeObjectURL(removed.previewUrl);
      return prev.filter((_, i) => i !== index);
    });
  };

  const clearAll = () => {
    uploadedFiles.forEach((f) => URL.revokeObjectURL(f.previewUrl));
    setUploadedFiles([]);
  };

  const handleSave = async () => {
    if (uploadedFiles.length === 0) return;
    setUploading(true);
    try {
      // TODO: call API to upload files
    } finally {
      setUploading(false);
    }
  };

  const filteredUploads = uploadedFiles.filter((f) =>
    activeTab === "audio" ? f.type.startsWith("audio/") : f.type.startsWith("video/")
  );

  return (
    <div className="space-y-1">
      {/* Header with tabs */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold" style={{ color: "var(--app-text-primary)" }}>
          Save Media
        </h1>
        <div
          className="flex items-center gap-1 rounded-xl border p-1"
          style={{ backgroundColor: "var(--app-search-bg)", borderColor: "var(--app-divider)" }}
        >
          {TABS.map(({ id, label }) => (
            <button
              key={id}
              type="button"
              onClick={() => setActiveTab(id)}
              className={`relative rounded-lg px-5 py-2 text-sm font-medium transition-all duration-200 ${
                activeTab === id ? "shadow-sm" : "hover:bg-[var(--app-nav-hover-bg)]"
              }`}
              style={
                activeTab === id
                  ? { backgroundColor: "var(--app-card-bg)", color: "var(--app-text-primary)" }
                  : { color: "var(--app-text-secondary)" }
              }
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <p className="text-sm" style={{ color: "var(--app-text-secondary)" }}>
        Upload {activeTab} files to save and preview before submitting
      </p>

      {/* Drop zone — only when no files uploaded for this tab */}
      {filteredUploads.length === 0 && (
        <div
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => { e.preventDefault(); setDragOver(false); handleFiles(e.dataTransfer.files); }}
          onClick={() => inputRef.current?.click()}
          className={`flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed px-6 py-16 transition-colors ${
            dragOver ? "border-[var(--app-brand)]" : ""
          }`}
          style={{
            borderColor: dragOver ? "var(--app-brand)" : "var(--app-divider)",
            backgroundColor: dragOver ? "var(--app-search-bg)" : "var(--app-card-bg)",
          }}
        >
          <input
            ref={inputRef}
            type="file"
            multiple
            accept={acceptMap[activeTab]}
            className="hidden"
            onChange={(e) => { handleFiles(e.target.files); if (inputRef.current) inputRef.current.value = ""; }}
          />
          {activeTab === "audio" ? (
            <svg className="mb-3 h-12 w-12" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24" style={{ color: "var(--app-text-secondary)" }}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
            </svg>
          ) : (
            <svg className="mb-3 h-12 w-12" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24" style={{ color: "var(--app-text-secondary)" }}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
            </svg>
          )}
          <p className="text-sm font-medium" style={{ color: "var(--app-text-primary)" }}>
            Drag &amp; drop {activeTab} files here, or <span style={{ color: "var(--app-brand)" }}>browse</span>
          </p>
          <p className="mt-1 text-xs" style={{ color: "var(--app-text-secondary)" }}>
            {activeTab === "audio" ? "Supports MP3, WAV, OGG, AAC" : "Supports MP4, WEBM, MOV, AVI"}
          </p>
        </div>
      )}

      {/* Uploaded file previews */}
      {filteredUploads.length > 0 && (
        <div className="space-y-4">
          {/* Action bar */}
          <div
            className="flex flex-wrap items-center justify-between gap-3 rounded-xl border px-5 py-3"
            style={{ backgroundColor: "var(--app-card-bg)", borderColor: "var(--app-divider)" }}
          >
            <p className="text-sm font-medium" style={{ color: "var(--app-text-primary)" }}>
              {filteredUploads.length} {activeTab} file{filteredUploads.length !== 1 ? "s" : ""} ready
            </p>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => inputRef.current?.click()}
                className="flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors hover:bg-[var(--app-nav-hover-bg)]"
                style={{ borderColor: "var(--app-search-border)", color: "var(--app-text-secondary)" }}
              >
                <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                </svg>
                Add More
              </button>
              <button
                type="button"
                onClick={clearAll}
                className="flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors hover:bg-[var(--app-nav-hover-bg)]"
                style={{ borderColor: "var(--app-search-border)", color: "var(--app-danger)" }}
              >
                <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
                Clear All
              </button>
            </div>
            <input
              ref={inputRef}
              type="file"
              multiple
              accept={acceptMap[activeTab]}
              className="hidden"
              onChange={(e) => { handleFiles(e.target.files); if (inputRef.current) inputRef.current.value = ""; }}
            />
          </div>

          {/* Media grid */}
          <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
            {filteredUploads.map((item, i) => {
              const idx = uploadedFiles.indexOf(item);
              return activeTab === "audio" ? (
                <AudioPreview key={`${item.name}-${i}`} item={item} onRemove={() => removeFile(idx)} />
              ) : (
                <VideoPreview key={`${item.name}-${i}`} item={item} onRemove={() => removeFile(idx)} />
              );
            })}
          </div>

          {/* Save button */}
          <div
            className="flex items-center justify-between rounded-xl border px-5 py-4"
            style={{ backgroundColor: "var(--app-card-bg)", borderColor: "var(--app-divider)" }}
          >
            <p className="text-sm" style={{ color: "var(--app-text-secondary)" }}>
              {filteredUploads.length} file{filteredUploads.length !== 1 ? "s" : ""} selected for upload
            </p>
            <button
              type="button"
              onClick={handleSave}
              disabled={uploading}
              className="inline-flex h-11 items-center justify-center gap-2 rounded-xl px-6 text-sm font-medium text-white transition-colors hover:opacity-90 disabled:opacity-60"
              style={{ backgroundColor: "var(--app-brand)" }}
            >
              {uploading && (
                <svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
              )}
              {uploading ? "Saving…" : "Save Media"}
            </button>
          </div>
        </div>
      )}

    </div>
  );
}
