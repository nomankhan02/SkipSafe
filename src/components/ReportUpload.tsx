"use client";

import { useRef, type ChangeEvent } from "react";
import { FileText, Loader2, Upload, X } from "lucide-react";
import { Button } from "@/components/ui/button";

type ReportUploadProps = {
  fileName: string | null;
  isParsing: boolean;
  onFileSelected: (file: File) => void;
  onClear: () => void;
};

export function ReportUpload({
  fileName,
  isParsing,
  onFileSelected,
  onClear,
}: ReportUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  const openPicker = () => {
    inputRef.current?.click();
  };

  const handleChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    // Reset immediately so choosing the same file again still fires change.
    event.target.value = "";
    if (file) onFileSelected(file);
  };

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0">
        <div className="flex items-center gap-2 text-sm font-medium text-foreground">
          <FileText className="size-4 shrink-0 text-muted-foreground" />
          <span className="truncate">
            {fileName ?? "No attendance report loaded"}
          </span>
        </div>
        <p className="mt-1 text-xs text-muted-foreground">
          Parsed locally in your browser. The PDF is never uploaded or stored.
        </p>
      </div>

      <div className="flex shrink-0 items-center gap-2">
        <input
          ref={inputRef}
          type="file"
          accept="application/pdf,.pdf"
          className="sr-only"
          aria-label="Choose attendance report PDF"
          onChange={handleChange}
        />
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={openPicker}
          disabled={isParsing}
          className="h-8 rounded-none border-border bg-transparent px-2.5 text-xs font-normal text-muted-foreground shadow-none hover:bg-muted hover:text-foreground"
        >
          {isParsing ? (
            <Loader2 className="size-3.5 animate-spin motion-reduce:animate-none" />
          ) : (
            <Upload className="size-3.5" />
          )}
          {isParsing ? "Reading PDF" : fileName ? "Replace PDF" : "Upload PDF"}
        </Button>

        {fileName && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onClear}
            disabled={isParsing}
            className="h-8 rounded-none px-2 text-xs font-normal text-muted-foreground hover:text-foreground"
          >
            <X className="size-3.5" />
            Clear
          </Button>
        )}
      </div>
    </div>
  );
}
