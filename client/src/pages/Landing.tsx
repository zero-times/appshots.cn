import { Link } from 'react-router-dom';

const FEATURES = [
  {
    title: '智能模板匹配',
    desc: '上传截图后自动识别应用调性并推荐最契合的视觉模板。',
    points: ['深浅主题覆盖', 'AI 推荐排序', '一键切换预览'],
  },
  {
    title: '中英文营销文案',
    desc: '每张截图自动生成标题与副标题，支持逐页微调与长度提示。',
    points: ['自动同步更新', '字数建议', '完成度统计'],
  },
  {
    title: '全尺寸导出',
    desc: '支持 App Store 与 Google Play 多尺寸批量导出，直接用于上架素材。',
    points: ['按尺寸批量导出', '进度可视化', '登录解锁无水印'],
  },
] as const;

const STEPS = [
  { id: '01', title: '上传素材', desc: '拖拽 3-5 张应用截图' },
  { id: '02', title: 'AI 分析', desc: '识别风格 + 生成文案' },
  { id: '03', title: '预览微调', desc: '切换模板与语言' },
  { id: '04', title: '导出交付', desc: '一键打包全部尺寸' },
] as const;

const STATS = [
  { label: '生成时间', value: '10-20 秒', tone: 'text-emerald-100 bg-emerald-500/15 ring-emerald-300/40' },
  { label: '模板风格', value: '14+', tone: 'text-primary-100 bg-primary-500/15 ring-primary-300/40' },
  { label: '支持尺寸', value: 'iPhone / iPad / Google Play', tone: 'text-slate-100 bg-white/10 ring-white/15' },
] as const;

export default function Landing() {
  return (
    <div className="mx-auto max-w-6xl px-4 pb-16 pt-12 sm:pt-16">
      <section className="sf-card relative overflow-hidden p-8 sm:p-12">
        <div className="pointer-events-none absolute -right-24 -top-24 h-64 w-64 rounded-full bg-primary-500/20 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-20 -left-20 h-64 w-64 rounded-full bg-accent-500/20 blur-3xl" />
        <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(120deg,rgba(255,255,255,0.05),transparent_42%)]" />

        <div className="relative grid gap-10 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
          <div>
            <div className="flex flex-wrap items-center gap-2 text-[11px] uppercase tracking-[0.24em] text-slate-400">
              <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1">appshots</span>
              <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1">AI Screenshot Studio</span>
            </div>
            <h1 className="sf-display mt-6 text-4xl font-bold leading-tight text-white sm:text-5xl">
              让你的 App 截图
              <span className="block bg-gradient-to-r from-primary-300 via-accent-400 to-emerald-300 bg-clip-text text-transparent">
                更快、更专业、更能转化
              </span>
            </h1>
            <p className="mt-5 max-w-xl text-base leading-relaxed text-slate-300 sm:text-lg">
              用 appshots 上传原始截图后，AI 自动完成调性分析、文案生成和模板推荐，
              你只需要微调细节，就能导出一套可直接上架的截图资产。
            </p>

            <div className="mt-8 flex flex-wrap gap-3">
              <Link to="/create" className="sf-btn-primary">
                立即开始制作
              </Link>
              <Link to="/history" className="sf-btn-ghost">
                查看历史项目
              </Link>
            </div>

            <div className="mt-8 grid gap-3 sm:grid-cols-3">
              {STATS.map((stat) => (
                <div key={stat.label} className="rounded-xl border border-white/10 bg-white/5 px-4 py-3">
                  <p className="text-[11px] uppercase tracking-[0.2em] text-slate-500">{stat.label}</p>
                  <p className={`mt-2 inline-flex rounded-full px-3 py-1 text-sm font-semibold ring-1 ${stat.tone}`}>
                    {stat.value}
                  </p>
                </div>
              ))}
            </div>
          </div>

          <div className="relative">
            <div className="pointer-events-none absolute -left-10 top-12 h-48 w-48 rounded-full bg-primary-500/15 blur-3xl" />
            <div className="pointer-events-none absolute -right-6 bottom-10 h-40 w-40 rounded-full bg-emerald-400/15 blur-3xl" />
            <div className="relative">
              <div className="absolute -left-6 top-6 hidden w-[160px] rotate-[-6deg] rounded-[24px] border border-white/10 bg-slate-950/70 p-3 shadow-[0_24px_60px_rgba(6,7,12,0.6)] sm:block">
                <div className="aspect-[9/16] rounded-[18px] bg-gradient-to-br from-slate-800 via-slate-900 to-slate-950 p-3">
                  <div className="rounded-full bg-white/10 px-2 py-1 text-[10px] text-slate-200">模板推荐</div>
                  <div className="mt-3 space-y-2">
                    <div className="h-16 rounded-xl bg-white/10" />
                    <div className="h-10 rounded-lg bg-white/5" />
                  </div>
                </div>
              </div>
              <div className="mx-auto w-full max-w-sm rounded-[28px] border border-white/10 bg-slate-950/70 p-4 shadow-[0_30px_90px_rgba(6,7,12,0.65)]">
                <div className="aspect-[9/16] rounded-[22px] border border-white/10 bg-gradient-to-br from-[#0F172A] via-[#111827] to-[#020617] p-4">
                  <div className="flex items-center justify-between text-[11px] uppercase tracking-[0.24em] text-slate-400">
                    <span>Preview</span>
                    <span>6.7"</span>
                  </div>
                  <div className="mt-4 space-y-3">
                    <div className="rounded-xl bg-white/10 p-3 text-xs text-slate-200">
                      <p className="text-[10px] uppercase tracking-[0.22em] text-slate-400">标题</p>
                      <p className="mt-2 text-sm text-white">从核心价值到关键功能</p>
                    </div>
                    <div className="rounded-xl border border-white/10 bg-white/5 p-3 text-xs text-slate-300">
                      <p className="text-[10px] uppercase tracking-[0.22em] text-slate-400">副标题</p>
                      <p className="mt-2 text-sm text-slate-200">同步文案，实时预览每一张截图。</p>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div className="h-16 rounded-lg bg-gradient-to-br from-primary-500/30 to-primary-500/5" />
                      <div className="h-16 rounded-lg bg-gradient-to-br from-emerald-400/25 to-emerald-400/5" />
                    </div>
                  </div>
                </div>
              </div>
              <div className="absolute -right-6 bottom-2 hidden w-[150px] rotate-[6deg] rounded-[24px] border border-white/10 bg-slate-950/70 p-3 shadow-[0_24px_60px_rgba(6,7,12,0.6)] sm:block">
                <div className="aspect-[9/16] rounded-[18px] bg-gradient-to-br from-[#111827] via-[#1F2937] to-[#0B1120] p-3">
                  <div className="rounded-full bg-white/10 px-2 py-1 text-[10px] text-slate-200">导出进度</div>
                  <div className="mt-4 h-2 rounded-full bg-white/10">
                    <div className="h-full w-2/3 rounded-full bg-gradient-to-r from-primary-400 to-accent-500" />
                  </div>
                  <div className="mt-4 space-y-2">
                    <div className="h-10 rounded-lg bg-white/5" />
                    <div className="h-10 rounded-lg bg-white/5" />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="mt-10 grid gap-4 lg:grid-cols-[0.9fr_1.1fr]">
        <div className="sf-card-soft p-6">
          <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Workflow</p>
          <h2 className="sf-display mt-3 text-xl font-semibold text-white">从上传到交付，全程可视化</h2>
          <p className="mt-3 text-sm text-slate-300">
            appshots 以「截图内容」为主线，将文案、模板与导出流程串联，让每一步都有明确反馈。
          </p>
          <div className="mt-6 space-y-3">
            {STEPS.map((step) => (
              <div key={step.id} className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/5 px-4 py-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-primary-400/40 bg-primary-500/20 text-xs font-semibold text-primary-100">
                  {step.id}
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-white">{step.title}</h3>
                  <p className="mt-1 text-xs text-slate-300">{step.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          {FEATURES.map((item) => (
            <article key={item.title} className="sf-card-soft p-5">
              <h2 className="sf-display text-base font-semibold text-white">{item.title}</h2>
              <p className="mt-2 text-sm leading-relaxed text-slate-300">{item.desc}</p>
              <div className="mt-4 flex flex-wrap gap-2">
                {item.points.map((point) => (
                  <span
                    key={point}
                    className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[11px] text-slate-300"
                  >
                    {point}
                  </span>
                ))}
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="mt-10 sf-card flex flex-col items-start justify-between gap-6 p-8 sm:flex-row sm:items-center">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Ready to forge</p>
          <h2 className="sf-display mt-2 text-2xl font-semibold text-white">开始下一次上架素材迭代</h2>
          <p className="mt-2 text-sm text-slate-300">从截图上传到导出成品，最快 3 分钟完成一轮。</p>
        </div>
        <div className="flex flex-wrap gap-3">
          <Link to="/create" className="sf-btn-primary">
            创建新项目
          </Link>
          <Link to="/history" className="sf-btn-ghost">
            查看项目中心
          </Link>
        </div>
      </section>
    </div>
  );
}
