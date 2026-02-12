import { MEMBERSHIP_WECHAT_QR_PATH, membershipWechatLabel } from '../../constants/membership';

interface MembershipWechatCardProps {
  title?: string;
  subtitle?: string;
  compact?: boolean;
}

export function MembershipWechatCard({
  title = '微信手动开通会员',
  subtitle = '扫码后备注「开通会员」',
  compact = false,
}: MembershipWechatCardProps) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/5 p-3">
      <p className="text-xs uppercase tracking-[0.18em] text-slate-500">{title}</p>
      <p className="mt-1 text-xs text-slate-300">{membershipWechatLabel()} · {subtitle}</p>
      <a href={MEMBERSHIP_WECHAT_QR_PATH} target="_blank" rel="noreferrer" className="mt-3 inline-flex">
        <img
          src={MEMBERSHIP_WECHAT_QR_PATH}
          alt="会员微信二维码"
          className={
            compact
              ? 'h-32 w-32 rounded-lg border border-white/10 bg-white p-1 object-contain'
              : 'h-44 w-44 rounded-lg border border-white/10 bg-white p-1 object-contain'
          }
          loading="lazy"
        />
      </a>
    </div>
  );
}
