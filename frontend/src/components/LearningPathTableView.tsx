import type { LearningPathTable } from "@/lib/types";

export function LearningPathTableView({ table }: { table: LearningPathTable }) {
  return (
    <div className="mt-2 overflow-x-auto rounded-lg border border-border">
      <table className="w-full text-left text-xs">
        <thead>
          <tr className="bg-black/[0.03] dark:bg-white/5">
            {table.headers.map((h, i) => (
              <th key={i} className="px-2.5 py-1.5 font-medium text-muted">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {table.rows.map((row, i) => (
            <tr key={i} className="border-t border-border">
              {row.map((cell, j) => (
                <td key={j} className="px-2.5 py-1.5 align-top">
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
