import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Upload",
  description: "Upload files",
};

export default function UploadPage() {
  return (
    <div>
      <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">
        Upload
      </h1>
      <p className="mt-2 text-zinc-600 dark:text-zinc-400">
        Upload feature – add hooks and components as needed.
      </p>
    </div>
  );
}
