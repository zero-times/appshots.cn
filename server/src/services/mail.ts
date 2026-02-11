import nodemailer from 'nodemailer';
import { env } from '../config/env.js';

let transporter: nodemailer.Transporter | null = null;

function getTransporter(): nodemailer.Transporter | null {
  if (transporter) return transporter;

  if (!env.smtpHost || !env.smtpUser || !env.smtpPass) {
    return null;
  }

  transporter = nodemailer.createTransport({
    host: env.smtpHost,
    port: env.smtpPort,
    secure: env.smtpSecure,
    auth: {
      user: env.smtpUser,
      pass: env.smtpPass,
    },
  });

  return transporter;
}

export function isMailConfigured(): boolean {
  return !!(env.smtpHost && env.smtpUser && env.smtpPass);
}

export async function sendVerificationCode(to: string, code: string): Promise<boolean> {
  const t = getTransporter();

  if (!t) {
    console.log(`[Mail] SMTP not configured, skipping email to ${to}`);
    return false;
  }

  try {
    await t.sendMail({
      from: `"${env.mailFromName}" <${env.mailFromAddress || env.smtpUser}>`,
      to,
      subject: `${code} 是你的验证码 — ${env.mailFromName}`,
      text: `你的验证码是：${code}\n\n10 分钟内有效，请勿分享给他人。\n\n如果你没有请求此验证码，请忽略此邮件。`,
      html: `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 480px; margin: 0 auto; padding: 40px 20px;">
          <div style="text-align: center; margin-bottom: 32px;">
            <div style="display: inline-block; background: linear-gradient(135deg, #f97316, #ea580c); color: white; font-weight: 900; font-size: 18px; width: 48px; height: 48px; line-height: 48px; border-radius: 12px;">A</div>
          </div>
          <h2 style="margin: 0 0 8px; font-size: 20px; color: #1e293b; text-align: center;">验证你的邮箱</h2>
          <p style="margin: 0 0 24px; color: #64748b; font-size: 14px; text-align: center;">请输入以下验证码完成登录</p>
          <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 24px; text-align: center; margin-bottom: 24px;">
            <span style="font-size: 36px; font-weight: 700; letter-spacing: 8px; color: #0f172a; font-family: 'SF Mono', Monaco, 'Cascadia Code', monospace;">${code}</span>
          </div>
          <p style="margin: 0 0 4px; color: #94a3b8; font-size: 13px; text-align: center;">验证码 10 分钟内有效</p>
          <p style="margin: 0; color: #94a3b8; font-size: 13px; text-align: center;">如果你没有请求此验证码，请忽略此邮件。</p>
          <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 32px 0 16px;" />
          <p style="margin: 0; color: #cbd5e1; font-size: 12px; text-align: center;">${env.mailFromName}</p>
        </div>
      `,
    });

    console.log(`[Mail] Verification code sent to ${to}`);
    return true;
  } catch (err) {
    console.error(`[Mail] Failed to send to ${to}:`, err);
    return false;
  }
}
