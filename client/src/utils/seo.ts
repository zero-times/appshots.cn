import { useEffect } from 'react';

const SITE_NAME = 'appshots.cn';
const SITE_URL = 'https://appshots.cn';
const DEFAULT_DESCRIPTION = 'AI App Store 截图生成器，自动完成截图分析、文案生成与 ZIP 导出交付。';

function upsertMeta(attr: 'name' | 'property', key: string, content: string): void {
  let meta = document.querySelector(`meta[${attr}="${key}"]`) as HTMLMetaElement | null;
  if (!meta) {
    meta = document.createElement('meta');
    meta.setAttribute(attr, key);
    document.head.appendChild(meta);
  }
  meta.setAttribute('content', content);
}

function upsertCanonical(url: string): void {
  let link = document.querySelector('link[rel="canonical"]') as HTMLLinkElement | null;
  if (!link) {
    link = document.createElement('link');
    link.setAttribute('rel', 'canonical');
    document.head.appendChild(link);
  }
  link.setAttribute('href', url);
}

export function usePageSeo(options: { title: string; description?: string; path?: string; noindex?: boolean }) {
  const { title, description = DEFAULT_DESCRIPTION, path = '/', noindex = false } = options;

  useEffect(() => {
    const normalizedPath = path.startsWith('/') ? path : `/${path}`;
    const canonicalUrl = new URL(normalizedPath, SITE_URL).toString();
    const fullTitle = `${title} - ${SITE_NAME}`;

    document.title = fullTitle;
    upsertMeta('name', 'description', description);
    upsertMeta('name', 'robots', noindex ? 'noindex,nofollow' : 'index,follow');
    upsertMeta('property', 'og:title', fullTitle);
    upsertMeta('property', 'og:description', description);
    upsertMeta('property', 'og:url', canonicalUrl);
    upsertMeta('name', 'twitter:title', fullTitle);
    upsertMeta('name', 'twitter:description', description);
    upsertCanonical(canonicalUrl);
  }, [description, noindex, path, title]);
}
