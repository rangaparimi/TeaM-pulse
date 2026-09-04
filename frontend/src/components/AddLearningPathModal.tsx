"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { addDays, format } from "date-fns";
import { FileText, Loader2, Plus, X } from "lucide-react";
import { api } from "@/lib/api";

const ACCEPTED_EXTENSIONS = ".txt,.md,.pdf,.png,.jpg,.jpeg,.webp,.xlsx,.xls";

export function AddLearningPathButton({ internId, defaultStart }: { internId: number; defaultStart: string }) {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [periodStart, setPeriodStart] = useState(defaultStart);
  const [periodEnd, setPeriodEnd] = useState(format(addDays(new Date(defaultStart), 13), "yyyy-MM-dd"));
  const [error, setError] = useState<string | null>(null);

  const create = useMutation({
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
      setOpen(false);
      setTitle("");
      setFile(null);
      setError(null);
    },
    onError: (err) => setError(err instanceof Error ? err.message : "Something went wrong"),
  });

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 rounded-lg border border-dashed border-border px-3 py-1.5 text-xs font-medium text-muted hover:bg-black/5 dark:hover:bg-white/5"
      >
        <Plus size={13} /> Add learning path
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onClick={() => setOpen(false)}
        >
          <div
            className="w-full max-w-md rounded-xl border border-border bg-surface p-5 shadow-lg"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold">Add a learning path</h3>
              <button
                onClick={() => setOpen(false)}
                className="rounded-full p-1 text-muted hover:bg-black/5 dark:hover:bg-white/10"
              >
                <X size={16} />
              </button>
            </div>

            <form
              className="mt-4 space-y-3"
              onSubmit={(e) => {
                e.preventDefault();
                setError(null);
                create.mutate();
              }}
            >
              <label className="block text-xs text-muted">
                Title
                <input
                  required
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. Sprint 4: API hardening"
                  className="mt-1 w-full rounded-lg border border-border bg-transparent px-2.5 py-1.5 text-sm outline-none focus:border-[var(--color-accent)]"
                />
              </label>

              <label className="block text-xs text-muted">
                Text, Excel, PDF, or image file
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
                  AI extracts a summary (and a table, where possible) from the file, then this
                  intern&apos;s GitHub activity is analyzed against it.
                </span>
              </label>

              <div className="flex gap-3">
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

              <div className="flex items-center gap-2 pt-1">
                <button
                  type="submit"
                  disabled={create.isPending}
                  className="inline-flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm font-medium text-white disabled:opacity-60"
                  style={{ backgroundColor: "var(--color-accent)" }}
                >
                  {create.isPending && <Loader2 size={14} className="animate-spin" />}
                  {create.isPending ? "Extracting & assigning…" : "Assign"}
                </button>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="rounded-lg border border-border px-3 py-1.5 text-sm font-medium hover:bg-black/5 dark:hover:bg-white/5"
                >
                  Cancel
                </button>
              </div>
              {error && <p className="text-xs text-[var(--color-discrepancy)]">{error}</p>}
            </form>
          </div>
        </div>
      )}
    </>
  );
}
