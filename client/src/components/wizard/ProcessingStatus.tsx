export function ProcessingStatus({ error }: { error: string | null }) {
  if (error) {
    return (
      <div className="sf-card p-10 text-center">
        <div className="text-lg font-semibold text-red-300">分析失败</div>
        <p className="mt-2 text-sm text-slate-300">{error}</p>
      </div>
    );
  }

  return (
    <div className="sf-card p-10 text-center">
      <div className="mx-auto inline-block h-10 w-10 animate-spin rounded-full border-4 border-primary-200/30 border-t-primary-500" />
      <p className="mt-4 font-medium text-white">appshots AI 正在分析截图并生成文案...</p>
      <p className="mt-1 text-sm text-slate-400">通常需要 10-20 秒，请稍候</p>
    </div>
  );
}
