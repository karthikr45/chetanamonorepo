"use client";

import dynamic from "next/dynamic";
import { useMemo } from "react";
import "react-quill-new/dist/quill.snow.css";

const ReactQuill = dynamic(() => import("react-quill-new"), { ssr: false }) as any;

const TOOLBAR_OPTIONS = [
  ["bold", "italic", "underline", "strike", "code"],
  [{ script: "super" }, { script: "sub" }],
  [{ header: [1, 2, 3, 4, 5, 6, false] }],
  [{ size: ["small", false, "large", "huge"] }],
  [{ font: [] }],
  [{ list: "ordered" }, { list: "bullet" }],
  [{ indent: "-1" }, { indent: "+1" }],
  [{ align: [] }],
  [{ color: [] }, { background: [] }],
  ["link", "image"],
  ["clean"],
];

type Props = {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
};

export function RichTextEditor({ value, onChange, placeholder }: Props) {
  const modules = useMemo(
    () => ({
      toolbar: TOOLBAR_OPTIONS,
      clipboard: { matchVisual: false },
    }),
    [],
  );

  const formats = [
    "bold", "italic", "underline", "strike", "code",
    "script",
    "header", "size", "font",
    "list", "indent",
    "align",
    "color", "background",
    "link", "image",
  ];

  return (
    <div className="rich-text-editor">
      <ReactQuill
        theme="snow"
        value={value}
        onChange={onChange}
        modules={modules}
        formats={formats}
        placeholder={placeholder}
      />
    </div>
  );
}
