import type { WizardStep } from '../../stores/projectStore';

const STEPS: { id: WizardStep; label: string }[] = [
  { id: 'upload', label: '上传截图' },
  { id: 'info', label: '应用信息' },
  { id: 'analyzing', label: 'AI 分析' },
  { id: 'preview', label: '预览编辑' },
  { id: 'export', label: '导出交付' },
];

export function StepIndicator({ current }: { current: WizardStep }) {
  const currentIndex = STEPS.findIndex((s) => s.id === current);

  return (
    <div className="mb-8 flex flex-wrap items-center justify-center gap-2 sm:gap-3">
      {STEPS.map((step, i) => {
        const active = i <= currentIndex;
        return (
          <div key={step.id} className="flex items-center gap-2">
            <div
              className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-semibold transition ${
                active
                  ? 'bg-gradient-to-br from-primary-500 to-primary-700 text-white shadow-glow'
                  : 'bg-white/10 text-slate-400'
              }`}
            >
              {i + 1}
            </div>
            <span className={`hidden text-sm sm:inline ${active ? 'text-slate-100' : 'text-slate-500'}`}>{step.label}</span>
            {i < STEPS.length - 1 && <div className="hidden h-px w-5 bg-white/15 sm:block" />}
          </div>
        );
      })}
    </div>
  );
}
