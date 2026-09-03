"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { addDays, format } from "date-fns";
import { FileText, Loader2, PenLine, Plus, Upload } from "lucide-react";
import { api } from "@/lib/api";

const ACCEPTED_EXTENSIONS = ".txt,.md,.pdf,.png,.jpg,.jpeg,.webp,.xlsx,.xls";

export function LearningPathForm({ internId, defaultStart }: { internId: number; defaultStart: string }) {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<"text" | "file">("text");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [periodStart, setPeriodStart] = useState(defaultStart);
  const [periodEnd, setPeriodEnd] = useState(format(addDays(new Date(defaultStart), 13), "yyyy-MM-dd"));
  const [error, setError] = useState<string | null>(null);

  const reset = () => {
    setTitle("");
    setDescription("");
    setFile(null);
    setOpen(false);
  };

  const createFromText = useMutation({
    mutationFn: () =>
      api.createLearningPath({
        intern_id: internId,
        title,
        description,
        period_start: periodStart,
        period_end: periodEnd,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["timeline", internId] });
      reset();
    },
    onError: (err) => setError(err instanceof Error ? err.message : "Something went wrong"),
  });

  const createFromFile = useMutation({
    mutationFn: () =>
      api.createLearningPathFromFile({
        intern_id: internId,
        title,
        period_start: periodStart,
        period_end: periodEnd,
        file: file!,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["timeline", internId] });
      reset();
    },
    onError: (err) => setError(err instanceof Error ? err.message : "Something went wrong"),
  });

  const pending = createFromText.isPending || createFromFile.isPending;

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 rounded-lg border border-dashed border-border px-3 py-2 text-sm font-medium text-muted hover:bg-black/5 dark:hover:bg-white/5"
      >
        <Plus size={14} /> Assign a new learning path
      </button>
    );
  }

  return (
    <form
      className="rounded-xl border border-border bg-surface p-4 shadow-sm"
      onSubmit={(e) => {
        e.preventDefault();
        setError(null);
        if (mode === "text") createFromText.mutate();
        else createFromFile.mutate();
      }}
    >
      <label className="block text-xs text-muted">
        Title
        <input
          required
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="e.g. Sprint 3: Backend fundamentals"
          className="mt-1 w-full rounded-lg border border-border bg-transparent px-2.5 py-1.5 text-sm outline-none focus:border-[var(--color-accent)]"
        />
      </label>

      <div className="mt-3 flex gap-1 rounded-lg bg-black/[0.03] p-1 text-xs dark:bg-white/5">
        <button
          type="button"
          onClick={() => setMode("text")}
          className={`flex flex-1 items-center justify-center gap-1.5 rounded-md py-1.5 font-medium transition ${
            mode === "text" ? "bg-surface shadow-sm" : "text-muted"
          }`}
        >
          <PenLine size={12} /> Write it
        </button>
        <button
          type="button"
          onClick={() => setMode("file")}
          className={`flex flex-1 items-center justify-center gap-1.5 rounded-md py-1.5 font-medium transition ${
            mode === "file" ? "bg-surface shadow-sm" : "text-muted"
          }`}
        >
          <Upload size={12} /> Upload a file
        </button>
      </div>

      {mode === "text" ? (
        <label className="mt-3 block text-xs text-muted">
          What should they focus on this period?
          <textarea
            required
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
            className="mt-1 w-full rounded-lg border border-border bg-transparent px-2.5 py-1.5 text-sm outline-none focus:border-[var(--color-accent)]"
          />
        </label>
      ) : (
        <label className="mt-3 block text-xs text-muted">
          Syllabus / curriculum file (.txt, .md, .pdf, image, or .xlsx)
          <div className="mt-1 flex items-center gap-2 rounded-lg border border-dashed border-border px-2.5 py-2">
            <FileText size={14} className="shrink-0 text-muted" />
            <input
              required
              type="file"
              accept={ACCEPTED_EXTENSIONS}
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              className="w-full text-xs file:mr-2 file:rounded-md file:border-0 file:bg-black/5 file:px-2 file:py-1 file:text-xs file:font-medium dark:file:bg-white/10"
            />
          </div>
          <span className="mt-1 block text-[11px] text-muted">
            AI extracts a summary and, where possible, a structured table from the file — used the
            same way a typed description would be.
          </span>
        </label>
      )}

      <div className="mt-3 flex gap-3">
        <label className="flex-1 text-xs text-muted">
          Period start
          <input
            type="date"
            value={periodStart}
            onChange={(e) => setPeriodStart(e.target.value)}
            className="mt-1 w-full rounded-lg border border-border bg-transparent px-2.5 py-1.5 text-sm outline-none focus:border-[var(--color-accent)]"
            required
          />
        </label>
        <label className="flex-1 text-xs text-muted">
          Period end
          <input
            type="date"
            value={periodEnd}
            onChange={(e) => setPeriodEnd(e.target.value)}
            className="mt-1 w-full rounded-lg border border-border bg-transparent px-2.5 py-1.5 text-sm outline-none focus:border-[var(--color-accent)]"
            required
          />
        </label>
      </div>

      <div className="mt-3 flex items-center gap-2">
        <button
          type="submit"
          disabled={pending}
          className="inline-flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm font-medium text-white disabled:opacity-60"
          style={{ backgroundColor: "var(--color-accent)" }}
        >
          {pending && <Loader2 size={14} className="animate-spin" />}
          {pending && mode === "file" ? "Extracting & assigning…" : "Assign"}
        </button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="rounded-lg border border-border px-3 py-1.5 text-sm font-medium hover:bg-black/5 dark:hover:bg-white/5"
        >
          Cancel
        </button>
        {error && <span className="text-xs text-[var(--color-discrepancy)]">{error}</span>}
      </div>
    </form>
  );
}
