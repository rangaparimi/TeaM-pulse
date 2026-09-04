"use client";

import { useEffect, useState } from "react";
import { Download, Eye, X } from "lucide-react";
import { API_URL } from "@/lib/api";

const IMAGE_EXTENSIONS = ["png", "jpg", "jpeg", "webp"];
const SPREADSHEET_EXTENSIONS = ["xlsx", "xls"];

function extensionOf(filename: string): string {
  return filename.includes(".") ? filename.split(".").pop()!.toLowerCase() : "";
}

function TextFilePreview({ url }: { url: string }) {
  const [text, setText] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch(url, { credentials: "include" })
      .then((res) => {
        if (!res.ok) throw new Error(`Couldn't load file (${res.status})`);
        return res.text();
      })
      .then((body) => {
        if (!cancelled) setText(body);
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : "Couldn't load file");
      });
    return () => {
      cancelled = true;
    };
  }, [url]);

  if (error) return <p className="text-xs text-[var(--color-discrepancy)]">{error}</p>;
  if (text === null) return <p className="text-xs text-muted">Loading…</p>;
  return (
    <pre className="max-h-[65vh] overflow-auto whitespace-pre-wrap rounded-lg bg-black/[0.03] p-3 text-xs dark:bg-white/5">
      {text}
    </pre>
  );
}

export function FilePreviewButton({ learningPathId, filename }: { learningPathId: number; filename: string }) {
  const [open, setOpen] = useState(false);
  const ext = extensionOf(filename);
  const fileUrl = `${API_URL}/learning-paths/${learningPathId}/file`;

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1 text-xs font-medium text-[var(--color-accent)] hover:underline"
      >
        <Eye size={11} /> Preview
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
          onClick={() => setOpen(false)}
        >
          <div
            className="max-h-[85vh] w-full max-w-3xl overflow-auto rounded-xl border border-border bg-surface p-4 shadow-lg"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-3 flex items-center justify-between gap-3">
              <h3 className="truncate text-sm font-semibold">{filename}</h3>
              <button
                onClick={() => setOpen(false)}
                className="shrink-0 rounded-full p-1 text-muted hover:bg-black/5 dark:hover:bg-white/10"
              >
                <X size={16} />
              </button>
            </div>

            {IMAGE_EXTENSIONS.includes(ext) ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={fileUrl} alt={filename} className="max-h-[70vh] w-full rounded-lg object-contain" />
            ) : ext === "pdf" ? (
              <iframe src={fileUrl} title={filename} className="h-[70vh] w-full rounded-lg border border-border" />
            ) : SPREADSHEET_EXTENSIONS.includes(ext) ? (
              <div className="space-y-3 text-sm">
                <p className="text-xs text-muted">
                  Excel files can&apos;t be previewed inline — the extracted table already shown on this
                  learning path is the structured version of this file&apos;s content.
                </p>
                <a
                  href={fileUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-medium hover:bg-black/5 dark:hover:bg-white/5"
                >
                  <Download size={12} /> Download original file
                </a>
              </div>
            ) : (
              <TextFilePreview url={fileUrl} />
            )}
          </div>
        </div>
      )}
    </>
  );
}
