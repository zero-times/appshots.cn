import { useCallback, useEffect, useRef, useState } from 'react';

interface UploadZoneProps {
  files: File[];
  previewUrls: string[];
  onFilesChange: (files: File[]) => void;
}

export function UploadZone({ files, previewUrls, onFilesChange }: UploadZoneProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const dragDepthRef = useRef(0);
  const [isDragging, setIsDragging] = useState(false);
  const [errorMessages, setErrorMessages] = useState<string[]>([]);

  const MAX_FILES = 5;
  const MAX_FILE_SIZE = 10 * 1024 * 1024;
  const VALID_TYPES = ['image/png', 'image/jpeg', 'image/webp'];

  useEffect(() => {
    const resetDragState = () => {
      dragDepthRef.current = 0;
      setIsDragging(false);
    };

    const handleWindowLeave = (event: DragEvent) => {
      if (event.target === document.documentElement) {
        resetDragState();
      }
    };

    window.addEventListener('dragend', resetDragState);
    window.addEventListener('drop', resetDragState);
    window.addEventListener('dragleave', handleWindowLeave);

    return () => {
      window.removeEventListener('dragend', resetDragState);
      window.removeEventListener('drop', resetDragState);
      window.removeEventListener('dragleave', handleWindowLeave);
    };
  }, []);

  const handleFiles = useCallback(
    (newFiles: FileList | null) => {
      if (!newFiles) return;
      const nextErrors: string[] = [];
      let invalidType = 0;
      let tooLarge = 0;
      let duplicates = 0;

      const existingKeys = new Set(files.map((file) => `${file.name}-${file.size}-${file.lastModified}`));
      const incoming = Array.from(newFiles).filter((file) => {
        const key = `${file.name}-${file.size}-${file.lastModified}`;
        if (existingKeys.has(key)) {
          duplicates += 1;
          return false;
        }
        if (!VALID_TYPES.includes(file.type)) {
          invalidType += 1;
          return false;
        }
        if (file.size > MAX_FILE_SIZE) {
          tooLarge += 1;
          return false;
        }
        existingKeys.add(key);
        return true;
      });

      const merged = [...files, ...incoming];
      const limited = merged.slice(0, MAX_FILES);

      if (invalidType) {
        nextErrors.push(`已跳过 ${invalidType} 个非图片文件（仅支持 PNG/JPG/WebP）。`);
      }
      if (tooLarge) {
        nextErrors.push(`已跳过 ${tooLarge} 个超出 10MB 的文件。`);
      }
      if (duplicates) {
        nextErrors.push(`已跳过 ${duplicates} 个重复文件。`);
      }
      if (merged.length > MAX_FILES) {
        nextErrors.push(`最多可上传 ${MAX_FILES} 张，已自动截取前 ${MAX_FILES} 张。`);
      }

      setErrorMessages(nextErrors);
      onFilesChange(limited);
    },
    [files, onFilesChange],
  );

  const removeFile = (index: number) => {
    const next = files.filter((_, i) => i !== index);
    onFilesChange(next);
    if (errorMessages.length > 0) {
      setErrorMessages([]);
    }
  };

  const clearAll = () => {
    onFilesChange([]);
    setErrorMessages([]);
  };

  const moveFile = (index: number, direction: 'left' | 'right') => {
    const target = direction === 'left' ? index - 1 : index + 1;
    if (target < 0 || target >= files.length) return;
    const next = [...files];
    const [item] = next.splice(index, 1);
    next.splice(target, 0, item);
    onFilesChange(next);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-slate-300">
            已选择 <span className="font-semibold text-primary-200">{files.length}</span>/{MAX_FILES} 张截图{' '}
            {files.length < 3 && <span className="text-amber-300">（至少 3 张）</span>}
          </p>
          <p className="mt-1 text-xs text-slate-500">建议按应用流程排序上传，以便生成更连贯的文案。</p>
        </div>
        {files.length > 0 && (
          <button type="button" onClick={clearAll} className="sf-btn-ghost px-3 py-1.5 text-xs">
            清空全部
          </button>
        )}
      </div>

      <div
        className={`sf-card relative cursor-pointer border-2 border-dashed p-8 text-center transition ${
          isDragging
            ? 'border-primary-400 bg-primary-500/10 shadow-glow'
            : 'border-white/15 hover:border-primary-400/60 hover:bg-white/10'
        }`}
        onDragEnter={(e) => {
          e.preventDefault();
          dragDepthRef.current += 1;
          setIsDragging(true);
        }}
        onDragOver={(e) => {
          e.preventDefault();
        }}
        onDragLeave={() => {
          dragDepthRef.current = Math.max(0, dragDepthRef.current - 1);
          if (dragDepthRef.current === 0) {
            setIsDragging(false);
          }
        }}
        onDrop={(e) => {
          e.preventDefault();
          dragDepthRef.current = 0;
          setIsDragging(false);
          handleFiles(e.dataTransfer.files);
        }}
        onClick={() => inputRef.current?.click()}
      >
        <input
          ref={inputRef}
          type="file"
          accept="image/png,image/jpeg,image/webp"
          multiple
          className="hidden"
          onChange={(e) => {
            handleFiles(e.target.files);
            e.currentTarget.value = '';
          }}
        />

        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-white/10 text-xl">🖼️</div>
        <p className="text-lg font-semibold text-white">拖拽截图到这里，或点击上传</p>
        <p className="mt-2 text-sm text-slate-300">支持 PNG/JPG/WebP，上传 3-5 张，每张不超过 10MB</p>
        <div className="mt-4 grid grid-cols-1 gap-2 text-left text-xs text-slate-400 sm:grid-cols-3">
          <div className="rounded-lg border border-white/10 bg-white/5 px-3 py-2">优先展示主流程与核心功能</div>
          <div className="rounded-lg border border-white/10 bg-white/5 px-3 py-2">命名清晰有助于 AI 理解内容</div>
          <div className="rounded-lg border border-white/10 bg-white/5 px-3 py-2">避免空白页或占位图</div>
        </div>
      </div>

      {errorMessages.length > 0 && (
        <div className="rounded-lg border border-amber-400/40 bg-amber-500/10 px-4 py-3 text-xs text-amber-100">
          {errorMessages.map((msg, index) => (
            <p key={index}>{msg}</p>
          ))}
        </div>
      )}

      {previewUrls.length > 0 && (
        <div className="sf-card-soft space-y-3 p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-slate-500">截图顺序</p>
              <p className="mt-1 text-[11px] text-slate-400">从左到右即为生成顺序，可用按钮微调。</p>
            </div>
            <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[11px] text-slate-300">
              当前 {files.length} 张
            </span>
          </div>
          <div className="flex gap-3 overflow-x-auto pb-2">
            {previewUrls.map((url, i) => (
              <div key={i} className="relative w-24 flex-shrink-0">
                <img
                  src={url}
                  alt={`Screenshot ${i + 1}`}
                  className="h-44 w-24 rounded-lg border border-white/15 object-cover"
                />
                <span className="absolute left-1.5 top-1.5 rounded-full bg-slate-950/70 px-1.5 py-0.5 text-[10px] text-slate-200 ring-1 ring-white/10">
                  {i + 1}
                </span>
                <div className="mt-2 text-[10px] text-slate-400">
                  {(files[i]?.name || `截图 ${i + 1}`).slice(0, 12)}
                </div>
                <div className="mt-2 flex items-center justify-between gap-1">
                  <button
                    type="button"
                    onClick={() => moveFile(i, 'left')}
                    disabled={i === 0}
                    className="flex h-6 w-6 items-center justify-center rounded-full border border-white/10 bg-white/5 text-[10px] text-slate-200 transition hover:border-white/30 hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-40"
                    aria-label={`move-left-${i}`}
                  >
                    ←
                  </button>
                  <button
                    type="button"
                    onClick={() => moveFile(i, 'right')}
                    disabled={i === files.length - 1}
                    className="flex h-6 w-6 items-center justify-center rounded-full border border-white/10 bg-white/5 text-[10px] text-slate-200 transition hover:border-white/30 hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-40"
                    aria-label={`move-right-${i}`}
                  >
                    →
                  </button>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      removeFile(i);
                    }}
                    className="flex h-6 w-6 items-center justify-center rounded-full bg-rose-500/80 text-[11px] font-semibold text-white transition hover:bg-rose-500"
                    aria-label={`remove-${i}`}
                  >
                    ×
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
