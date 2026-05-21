"use client";

import * as React from "react";
import { Image as ImageIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface ScreenshotInputProps {
  id?: string;
  /** Invoked when the user pastes, drops, or picks a file. */
  onFile: (file: File) => Promise<void> | void;
  uploading?: boolean;
  /** Server-signed URL for the existing screenshot, when one is already stored. */
  previewUrl?: string | null;
  /** Original filename hint when there's a stored file but no signed URL. */
  currentFilename?: string | null;
  disabled?: boolean;
}

/**
 * Screenshot input that prefers paste. Click anywhere on the dashed area
 * and press Cmd+V / Ctrl+V to drop in a clipboard image. You can also
 * drag-and-drop a file, or click to use the native file picker.
 *
 * Shows a blob-URL preview immediately after paste so the user sees what
 * they just attached before the upload completes.
 */
export function ScreenshotInput({
  id,
  onFile,
  uploading,
  previewUrl,
  currentFilename,
  disabled,
}: ScreenshotInputProps) {
  const inputRef = React.useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = React.useState(false);
  const [localPreview, setLocalPreview] = React.useState<string | null>(null);

  // Revoke local blob URLs when they change or unmount.
  React.useEffect(() => {
    return () => {
      if (localPreview) URL.revokeObjectURL(localPreview);
    };
  }, [localPreview]);

  async function handleFile(file: File) {
    if (!file.type.startsWith("image/")) return;
    const url = URL.createObjectURL(file);
    setLocalPreview((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return url;
    });
    try {
      await onFile(file);
    } catch {
      // parent surfaces the error toast; nothing to do here.
    }
  }

  function onPaste(e: React.ClipboardEvent<HTMLDivElement>) {
    if (disabled) return;
    const items = e.clipboardData?.items;
    if (!items) return;
    for (let i = 0; i < items.length; i++) {
      const it = items[i];
      if (it.kind === "file" && it.type.startsWith("image/")) {
        const file = it.getAsFile();
        if (file) {
          e.preventDefault();
          void handleFile(file);
          return;
        }
      }
    }
  }

  function onDrop(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setDragging(false);
    if (disabled) return;
    const file = e.dataTransfer.files?.[0];
    if (file) void handleFile(file);
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLDivElement>) {
    // Open the file picker on Enter/Space when the dashed area has focus.
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      inputRef.current?.click();
    }
  }

  const displayUrl = localPreview ?? previewUrl ?? null;

  return (
    <div
      id={id}
      role="button"
      tabIndex={disabled ? -1 : 0}
      aria-disabled={disabled || undefined}
      onPaste={onPaste}
      onDragOver={(e) => {
        e.preventDefault();
        if (!disabled) setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={onDrop}
      onKeyDown={onKeyDown}
      onClick={() => {
        if (!disabled) inputRef.current?.click();
      }}
      className={cn(
        "group rounded-md border-2 border-dashed p-4 transition-colors outline-none",
        "focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
        disabled
          ? "cursor-not-allowed opacity-50 border-border bg-muted/20"
          : "cursor-pointer",
        !disabled && dragging
          ? "border-primary bg-primary/10"
          : !disabled
            ? "border-border bg-muted/20 hover:bg-muted/30 hover:border-primary/60"
            : ""
      )}
    >
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        hidden
        disabled={disabled}
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) void handleFile(f);
          // Allow re-selecting the same file later.
          e.target.value = "";
        }}
      />

      {displayUrl ? (
        <div className="space-y-2">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={displayUrl}
            alt="Screenshot"
            className="max-h-72 w-auto rounded-md border bg-background"
          />
          <p className="text-xs text-muted-foreground">
            {uploading
              ? "Uploading…"
              : "Paste, drop, or click to replace this screenshot."}
          </p>
        </div>
      ) : (
        <div className="flex flex-col items-center gap-1.5 py-6 text-center">
          <div className="rounded-full bg-primary/10 p-2 text-primary">
            <ImageIcon className="h-5 w-5" />
          </div>
          <p className="text-sm font-medium">Paste a screenshot</p>
          <p className="text-xs text-muted-foreground">
            Click here, then press{" "}
            <kbd className="rounded border border-border bg-muted px-1.5 py-0.5 text-[10px] font-mono">
              ⌘V
            </kbd>{" "}
            /{" "}
            <kbd className="rounded border border-border bg-muted px-1.5 py-0.5 text-[10px] font-mono">
              Ctrl+V
            </kbd>
            . You can also drop a file or click to choose one.
          </p>
          {currentFilename && (
            <p className="mt-2 text-xs text-muted-foreground">
              Current: {currentFilename}
            </p>
          )}
          {uploading && (
            <p className="mt-1 text-xs text-primary">Uploading…</p>
          )}
        </div>
      )}
    </div>
  );
}
