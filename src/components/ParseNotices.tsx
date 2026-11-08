import { AlertTriangle, Info } from "lucide-react";
import type { ParseWarning, SkippedRow } from "@/lib/parseReport";

type ParseNoticesProps = {
  warnings: ParseWarning[];
  skippedRows: SkippedRow[];
};

export function ParseNotices({ warnings, skippedRows }: ParseNoticesProps) {
  const incompleteRows = skippedRows.filter(
    (row) => row.classification === "incomplete",
  );
  const metadataRowCount =
    skippedRows.length - incompleteRows.length;

  if (warnings.length === 0 && incompleteRows.length === 0 && metadataRowCount === 0) {
    return null;
  }

  return (
    <section
      aria-labelledby="parser-notices-heading"
      className="space-y-2 border border-border bg-card p-3.5 sm:p-4"
    >
      <h2
        id="parser-notices-heading"
        className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground"
      >
        Report notes
      </h2>

      {metadataRowCount > 0 && (
        <p className="flex items-start gap-1.5 text-[11px] leading-relaxed text-muted-foreground">
          <Info className="mt-0.5 size-3 shrink-0" />
          <span>
            {metadataRowCount} metadata {metadataRowCount === 1 ? "row was" : "rows were"}{" "}
            ignored (student details, headings, dates, notes, summary and footer text).
          </span>
        </p>
      )}

      {warnings.length > 0 && (
        <div className="space-y-1">
          {warnings.map((warning) => (
            <p
              key={`${warning.code}-${warning.printed}`}
              className="flex items-start gap-1.5 text-[11px] leading-relaxed text-status-warning"
            >
              <AlertTriangle className="mt-0.5 size-3 shrink-0" />
              <span>
                {warning.code}: printed {warning.printed}% differs from computed{" "}
                {warning.computed === null ? "—" : `${warning.computed}%`}.
              </span>
            </p>
          ))}
        </div>
      )}

      {incompleteRows.length > 0 && (
        <div className="space-y-1">
          {incompleteRows.map((row) => (
            <p
              key={`${row.page}-${row.rowY}-${row.reason}`}
              className="flex items-start gap-1.5 text-[11px] leading-relaxed text-status-warning"
            >
              <AlertTriangle className="mt-0.5 size-3 shrink-0" />
              <span>
                {row.code ? `${row.code}: ` : "Unrecognized row: "}
                {row.reason}. It was kept visible instead of being discarded.
              </span>
            </p>
          ))}
        </div>
      )}
    </section>
  );
}
