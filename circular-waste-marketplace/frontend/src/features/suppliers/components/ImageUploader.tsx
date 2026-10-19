import React, { useCallback, useEffect, useRef, useState } from "react";
import { UploadCloud, X, AlertTriangle } from "lucide-react";

// ─── Magic-byte constants ────────────────────────────────────────────────────
const JPEG_MAGIC = [0xff, 0xd8, 0xff];
const PNG_MAGIC = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
const RIFF_MAGIC = [0x52, 0x49, 0x46, 0x46]; // "RIFF"
const WEBP_MAGIC = [0x57, 0x45, 0x42, 0x50]; // "WEBP"

const MAX_FILES = 5;

function getMaxBytes(): number {
  const mb = Number(import.meta.env.VITE_MAX_UPLOAD_MB ?? 10);
  return mb * 1024 * 1024;
}

function matchBytes(buf: Uint8Array, magic: number[], offset = 0): boolean {
  return magic.every((b, i) => buf[offset + i] === b);
}

async function isValidImage(file: File): Promise<boolean> {
  let buf: Uint8Array;
  if (typeof file.arrayBuffer === "function") {
    buf = new Uint8Array(await file.arrayBuffer()).slice(0, 12);
  } else {
    buf = await new Promise<Uint8Array>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () =>
        resolve(new Uint8Array(reader.result as ArrayBuffer).slice(0, 12));
      reader.onerror = () => reject(reader.error);
      reader.readAsArrayBuffer(file);
    });
  }
  if (matchBytes(buf, JPEG_MAGIC)) return true;
  if (matchBytes(buf, PNG_MAGIC)) return true;
  if (matchBytes(buf, RIFF_MAGIC, 0) && matchBytes(buf, WEBP_MAGIC, 8)) return true;
  return false;
}

function fileKey(f: File): string {
  return `${f.name}::${f.size}`;
}

// ─── Props ───────────────────────────────────────────────────────────────────
export interface ImageUploaderProps {
  value: File[];
  onChange: (files: File[]) => void;
  disabled?: boolean;
}

export const ImageUploader: React.FC<ImageUploaderProps> = ({
  value,
  onChange,
  disabled = false,
}) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const urlMap = useRef<Map<File, string>>(new Map());
  const [error, setError] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);

  // Revoke ALL object URLs on unmount
  useEffect(() => {
    return () => {
      urlMap.current.forEach((url) => URL.revokeObjectURL(url));
      urlMap.current.clear();
    };
  }, []);

  const getThumbUrl = (file: File): string => {
    if (!urlMap.current.has(file)) {
      urlMap.current.set(file, URL.createObjectURL(file));
    }
    return urlMap.current.get(file)!;
  };

  const revokeUrl = (file: File) => {
    const url = urlMap.current.get(file);
    if (url) {
      URL.revokeObjectURL(url);
      urlMap.current.delete(file);
    }
  };

  const processFiles = useCallback(
    async (incoming: FileList | File[]) => {
      setError(null);
      const maxBytes = getMaxBytes();
      const existingKeys = new Set(value.map(fileKey));
      const accepted: File[] = [];

      for (const file of Array.from(incoming)) {
        // Capacity check
        if (value.length + accepted.length >= MAX_FILES) {
          setError(`Maximum ${MAX_FILES} images allowed.`);
          break;
        }
        // Dedupe
        if (existingKeys.has(fileKey(file))) continue;
        // Size
        if (file.size > maxBytes) {
          setError(`"${file.name}" exceeds ${Math.round(maxBytes / 1024 / 1024)}MB limit.`);
          continue;
        }
        // Magic-byte validation
        const valid = await isValidImage(file);
        if (!valid) {
          setError(`"${file.name}" is not a valid JPEG, PNG, or WebP image.`);
          continue;
        }
        accepted.push(file);
        existingKeys.add(fileKey(file));
      }

      if (accepted.length > 0) {
        onChange([...value, ...accepted]);
      }
    },
    [value, onChange]
  );

  const handleRemove = (file: File) => {
    revokeUrl(file);
    onChange(value.filter((f) => f !== file));
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    if (!disabled && e.dataTransfer.files.length) {
      processFiles(e.dataTransfer.files);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      inputRef.current?.click();
    }
  };

  return (
    <div className="space-y-2">
      {/* Drop zone */}
      <div
        role="button"
        tabIndex={0}
        aria-label="Upload waste evidence photos"
        onKeyDown={handleKeyDown}
        onClick={() => !disabled && inputRef.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          if (!disabled) setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
        className={`relative border-2 border-dashed rounded-2xl p-6 text-center transition-colors cursor-pointer ${
          dragging
            ? "border-brand-500 bg-brand-500/10"
            : "border-slate-700 hover:border-brand-500/60 bg-slate-900/40"
        } ${disabled ? "opacity-50 cursor-not-allowed" : ""}`}
      >
        <input
          ref={inputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          multiple
          className="hidden"
          disabled={disabled}
          onChange={(e) => {
            if (e.target.files) processFiles(e.target.files);
            e.target.value = ""; // allow re-selecting same file
          }}
        />
        <div className="flex flex-col items-center gap-2 py-2">
          <div className="h-12 w-12 rounded-xl bg-slate-800 text-slate-400 flex items-center justify-center">
            <UploadCloud className="h-6 w-6" />
          </div>
          <div className="text-sm font-semibold text-slate-200">
            Drop photos here, or click to browse
          </div>
          <p className="text-xs text-slate-400">
            JPEG, PNG, or WebP · max {Math.round(getMaxBytes() / 1024 / 1024)}MB each · up to {MAX_FILES} files
          </p>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="flex items-center gap-2 text-xs text-red-400 bg-red-500/10 border border-red-500/20 px-3 py-2 rounded-xl">
          <AlertTriangle className="h-4 w-4 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Thumbnail grid */}
      {value.length > 0 && (
        <div className="grid grid-cols-5 gap-2">
          {value.map((file, idx) => (
            <div key={`${fileKey(file)}-${idx}`} className="relative group rounded-xl overflow-hidden border border-slate-700 aspect-square">
              <img
                src={getThumbUrl(file)}
                alt={file.name}
                className="w-full h-full object-cover"
              />
              <button
                type="button"
                onClick={() => handleRemove(file)}
                aria-label={`Remove ${file.name}`}
                className="absolute top-1 right-1 h-6 w-6 rounded-full bg-black/70 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <X className="h-3.5 w-3.5" />
              </button>
              <div className="absolute bottom-0 left-0 right-0 bg-black/60 px-1 py-0.5 text-[10px] text-slate-300 truncate">
                {file.name}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
