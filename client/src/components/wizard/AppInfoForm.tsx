interface AppInfoFormProps {
  appName: string;
  appDescription: string;
  onNameChange: (value: string) => void;
  onDescriptionChange: (value: string) => void;
  onSubmit: () => void;
  isLoading: boolean;
  error?: string | null;
}

export function AppInfoForm({
  appName,
  appDescription,
  onNameChange,
  onDescriptionChange,
  onSubmit,
  isLoading,
  error,
}: AppInfoFormProps) {
  const nameCount = appName.trim().length;
  const descriptionCount = appDescription.trim().length;

  return (
    <form
      className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_220px]"
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit();
      }}
    >
      <div className="space-y-4">
        {error && (
          <div className="rounded-lg border border-rose-400/40 bg-rose-500/10 px-4 py-3 text-sm text-rose-100">
            {error}
          </div>
        )}
        <div className="sf-card-soft space-y-3 p-4">
          <div className="flex items-center justify-between">
            <label className="sf-label">App 名称 *</label>
            <span className="text-[11px] text-slate-500">{nameCount} 字符</span>
          </div>
          <input
            type="text"
            value={appName}
            onChange={(e) => onNameChange(e.target.value)}
            placeholder="例如：appshots Pro"
            className="sf-input"
          />
          <p className="text-xs text-slate-400">建议简洁明确，便于 AI 提取核心卖点。</p>
        </div>

        <div className="sf-card-soft space-y-3 p-4">
          <div className="flex items-center justify-between">
            <label className="sf-label">一句话描述（可选）</label>
            <span className="text-[11px] text-slate-500">{descriptionCount} 字符</span>
          </div>
          <input
            type="text"
            value={appDescription}
            onChange={(e) => onDescriptionChange(e.target.value)}
            placeholder="例如：AI 驱动的应用商店截图生成器"
            className="sf-input"
          />
          <p className="text-xs text-slate-400">一句话定位会影响模板与文案语气。</p>
        </div>

        <button type="submit" disabled={!appName.trim() || isLoading} className="sf-btn-primary w-full">
          {isLoading ? 'AI 分析中...' : '开始 AI 分析'}
        </button>
      </div>

      <aside className="sf-card-soft hidden space-y-3 p-4 text-xs text-slate-300 lg:block">
        <p className="text-[11px] uppercase tracking-[0.2em] text-slate-500">AI 会参考</p>
        <div className="space-y-2">
          <div className="rounded-lg border border-white/10 bg-white/5 px-3 py-2">核心功能关键词</div>
          <div className="rounded-lg border border-white/10 bg-white/5 px-3 py-2">目标用户场景</div>
          <div className="rounded-lg border border-white/10 bg-white/5 px-3 py-2">产品语气风格</div>
        </div>
        <p className="text-[11px] text-slate-500">填写得越具体，AI 推荐越精准。</p>
      </aside>
    </form>
  );
}
