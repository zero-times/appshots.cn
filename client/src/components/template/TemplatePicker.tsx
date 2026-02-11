import { TEMPLATES } from '@appshots/shared';
import type { TemplateStyleId } from '@appshots/shared';

interface TemplatePickerProps {
  selected: TemplateStyleId;
  recommended?: TemplateStyleId;
  onChange: (id: TemplateStyleId) => void;
}

type LayoutPreviewVariant = 'hero-top' | 'hero-bottom' | 'edge-flow' | 'story-slice';

const TEMPLATE_PREVIEWS: Record<TemplateStyleId, string> = {
  clean: 'bg-white border border-gray-200',
  'tech-dark': 'bg-gradient-to-b from-[#0F0F1A] to-[#1A1A2E]',
  vibrant: 'bg-gradient-to-br from-[#667EEA] to-[#764BA2]',
  aurora: 'bg-gradient-to-br from-[#0B132B] via-[#1C2541] to-[#5BC0BE]',
  'sunset-glow': 'bg-gradient-to-br from-[#FF9A8B] via-[#FF6A88] to-[#FF99AC]',
  'forest-mist': 'bg-gradient-to-br from-[#E6F4EA] via-[#CDEAD5] to-[#A8DDB5]',
  'rose-gold': 'bg-gradient-to-br from-[#FFF6F0] via-[#FAD4D8] to-[#E8B4B8]',
  'monochrome-bold': 'bg-gradient-to-b from-[#0F1115] to-[#2A2F3A]',
  'ocean-breeze': 'bg-gradient-to-br from-[#E0F7FA] via-[#90E0EF] to-[#48CAE4]',
  'neon-pulse': 'bg-gradient-to-br from-[#09090F] via-[#15162B] to-[#00E5FF]',
  'lavender-dream': 'bg-gradient-to-br from-[#F5F3FF] via-[#E9D5FF] to-[#D8B4FE]',
  'desert-sand': 'bg-gradient-to-br from-[#FFF7ED] via-[#FED7AA] to-[#FDBA74]',
  'midnight-purple': 'bg-gradient-to-br from-[#140A2E] via-[#2E1065] to-[#7C3AED]',
  'candy-pop': 'bg-gradient-to-br from-[#FF5EA8] via-[#FF86C8] to-[#7C9CFF]',
};

const TEMPLATE_LAYOUTS: Record<TemplateStyleId, LayoutPreviewVariant> = {
  clean: 'hero-top',
  'tech-dark': 'story-slice',
  vibrant: 'edge-flow',
  aurora: 'story-slice',
  'sunset-glow': 'hero-bottom',
  'forest-mist': 'hero-top',
  'rose-gold': 'hero-bottom',
  'monochrome-bold': 'story-slice',
  'ocean-breeze': 'edge-flow',
  'neon-pulse': 'story-slice',
  'lavender-dream': 'hero-bottom',
  'desert-sand': 'hero-top',
  'midnight-purple': 'story-slice',
  'candy-pop': 'edge-flow',
};

const TEMPLATE_LAYOUT_LABELS: Record<LayoutPreviewVariant, string> = {
  'hero-top': '上文案 · 下主图',
  'hero-bottom': '上主图 · 下文案',
  'edge-flow': '连贯走向 + 边界漂移',
  'story-slice': '主视觉跨屏切片',
};

const TEMPLATE_TONES: Record<TemplateStyleId, string> = {
  clean: '极简留白，适合工具和效率类应用',
  'tech-dark': '深色科技感，适合专业与效率产品',
  vibrant: '高饱和彩度，适合社交与娱乐场景',
  aurora: '极光氛围，适合高级感产品展示',
  'sunset-glow': '暖调友好，适合生活方式类应用',
  'forest-mist': '自然清新，适合健康和习惯养成类',
  'rose-gold': '柔和轻奢，适合女性向和消费类',
  'monochrome-bold': '黑白高对比，强调专业与力量',
  'ocean-breeze': '清蓝通透，适合工具与旅行类',
  'neon-pulse': '霓虹动感，适合潮流和音乐类',
  'lavender-dream': '轻柔紫调，适合教育和记录类',
  'desert-sand': '暖金质感，适合阅读和内容类',
  'midnight-purple': '深紫电感，适合金融和 AI 产品',
  'candy-pop': '糖果撞色，适合年轻化产品',
};

function TemplateLayoutMock({ layout }: { layout: LayoutPreviewVariant }) {
  if (layout === 'hero-bottom') {
    return (
      <>
        <div className="absolute left-1/2 top-2 h-12 w-9 -translate-x-1/2 rounded-[10px] border border-white/45 bg-black/25 shadow-[0_8px_22px_rgba(0,0,0,0.35)]" />
        <div className="absolute bottom-2 left-2 right-2 rounded-lg border border-white/20 bg-black/25 px-2 py-1.5">
          <span className="block h-1.5 w-14 rounded-full bg-white/75" />
          <span className="mt-1 block h-1.5 w-10 rounded-full bg-white/45" />
        </div>
      </>
    );
  }

  if (layout === 'story-slice') {
    return (
      <>
        <div className="absolute inset-y-6 left-0 right-0 -skew-y-6 rounded-[8px] bg-gradient-to-r from-white/30 via-white/65 to-white/30" />
        <div className="absolute -right-1 top-4 h-[52px] w-9 rounded-[10px] border border-white/45 bg-black/35 shadow-[0_10px_24px_rgba(0,0,0,0.38)]" />
        <span className="absolute left-2 top-10 text-[9px] font-semibold tracking-[0.22em] text-white/70">ARC</span>
      </>
    );
  }

  if (layout === 'edge-flow') {
    return (
      <>
        <div className="pointer-events-none absolute inset-y-0 left-0 right-0 flex items-center">
          <span className="block h-[2px] w-full bg-gradient-to-r from-white/0 via-white/60 to-white/0" />
        </div>
        <div className="absolute -right-2 top-4 h-[52px] w-9 rotate-[9deg] rounded-[10px] border border-white/45 bg-black/30 shadow-[0_10px_24px_rgba(0,0,0,0.38)]" />
        <div className="absolute left-2 top-2 rounded-md bg-black/20 px-2 py-1">
          <span className="block h-1.5 w-14 rounded-full bg-white/75" />
          <span className="mt-1 block h-1.5 w-11 rounded-full bg-white/45" />
        </div>
      </>
    );
  }

  return (
    <>
      <div className="absolute left-2 right-2 top-2 rounded-md bg-black/20 px-2 py-1">
        <span className="block h-1.5 w-16 rounded-full bg-white/75" />
        <span className="mt-1 block h-1.5 w-11 rounded-full bg-white/45" />
      </div>
      <div className="absolute bottom-2 left-1/2 h-12 w-9 -translate-x-1/2 rounded-[10px] border border-white/45 bg-black/25 shadow-[0_8px_20px_rgba(0,0,0,0.35)]" />
    </>
  );
}

export function TemplatePicker({ selected, recommended, onChange }: TemplatePickerProps) {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-slate-200">模板风格</h3>
        <span className="text-xs text-slate-400">支持连贯走向与故事线切片两种组合</span>
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {Object.values(TEMPLATES).map((t) => {
          const layout = TEMPLATE_LAYOUTS[t.id];
          return (
            <button
              key={t.id}
              onClick={() => onChange(t.id)}
              aria-pressed={selected === t.id}
              className={`group relative overflow-hidden rounded-2xl border p-3 text-left transition ${
                selected === t.id
                  ? 'border-primary-400/70 bg-primary-500/10 ring-1 ring-primary-400/60'
                  : 'border-white/10 bg-white/5 hover:border-white/25 hover:bg-white/10'
              }`}
            >
              <div className="absolute inset-0 opacity-0 transition group-hover:opacity-100">
                <div className="absolute -right-8 top-6 h-24 w-24 rounded-full bg-primary-500/15 blur-2xl" />
              </div>

              <div className="relative">
                <div
                  className={`relative h-20 overflow-hidden rounded-xl ${TEMPLATE_PREVIEWS[t.id]} transition group-hover:scale-[1.01]`}
                >
                  <div className="absolute inset-0 bg-[radial-gradient(circle_at_18%_12%,rgba(255,255,255,0.35),transparent_50%)]" />
                  <TemplateLayoutMock layout={layout} />
                </div>
                <div className="pointer-events-none absolute inset-0 rounded-xl border border-white/10" />
                {selected === t.id && <div className="absolute inset-0 rounded-xl ring-2 ring-primary-300/70" />}
              </div>

              <div className="mt-3 flex items-center justify-between gap-2">
                <div>
                  <p className="text-sm font-semibold text-slate-100">{t.nameZh}</p>
                  <p className="text-[11px] text-slate-500">{t.name}</p>
                </div>
                <div className="flex flex-col items-end gap-1">
                  {recommended === t.id && <span className="sf-badge text-[9px]">AI 推荐</span>}
                  {selected === t.id && (
                    <span className="rounded-full border border-primary-300/40 bg-primary-500/10 px-2 py-0.5 text-[9px] uppercase tracking-[0.2em] text-primary-100">
                      已选
                    </span>
                  )}
                </div>
              </div>

              <div className="mt-2 flex flex-wrap items-center gap-2">
                <span className="rounded-full border border-white/10 bg-black/20 px-2 py-0.5 text-[10px] tracking-[0.08em] text-slate-200">
                  {TEMPLATE_LAYOUT_LABELS[layout]}
                </span>
              </div>
              <p className="mt-2 text-[11px] leading-relaxed text-slate-400">{TEMPLATE_TONES[t.id]}</p>
            </button>
          );
        })}
      </div>
    </div>
  );
}
