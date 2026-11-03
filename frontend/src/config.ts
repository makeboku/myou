// 配置文件，用于管理域名、站点模式与API地址设置

// 站点配置接口（由 Worker /api/config 返回）
export interface SiteConfig {
  emailDomains: string[];
  externalLinks?: Array<{ label: string; url: string }>;
  siteMode: 'temp' | 'perm';
  siteName: string;
  otherSiteUrl: string;
  otherSiteLabel: string;
}

// API 地址前缀（同域部署时留空；分离部署时填 API 源，不要带 /api）
export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '';

// 缓存
let cachedEmailDomains: string[] | null = null;
let cachedExternalLinks: Array<{ label: string; url: string }> | null = null;
let cachedSiteConfig: SiteConfig | null = null;
let configLoaded = false;

// 从 API 获取全站配置（域名、双站点模式、外部链接）
export async function getSiteConfig(): Promise<SiteConfig> {
  if (cachedSiteConfig && configLoaded) {
    return cachedSiteConfig;
  }

  try {
    const response = await fetch(`${API_BASE_URL}/api/config`);
    if (response.ok) {
      const data = await response.json();
      if (data.success && data.config) {
        const siteMode = (data.config.siteMode === 'temp' ? 'temp' : 'perm') as 'temp' | 'perm';
        const siteName = data.config.siteName || (siteMode === 'temp' ? '临时邮箱' : '匿名邮箱');
        cachedSiteConfig = {
          emailDomains: data.config.emailDomains || [],
          externalLinks: data.config.externalLinks,
          siteMode,
          siteName,
          otherSiteUrl: data.config.otherSiteUrl || '',
          otherSiteLabel: data.config.otherSiteLabel || (siteMode === 'temp' ? '匿名或永久邮箱' : '返回临时邮箱'),
        };
        cachedEmailDomains = cachedSiteConfig.emailDomains;
        cachedExternalLinks = cachedSiteConfig.externalLinks || null;
        configLoaded = true;
        return cachedSiteConfig;
      }
    }
  } catch (error) {
    console.error('获取站点配置失败:', error);
  }

  // 如果 API 获取失败，使用环境变量作为后备；
  // 注意：不标记 configLoaded，下次调用会重试，避免把无效配置永久缓存。
  const fallbackDomains = (import.meta.env.VITE_EMAIL_DOMAIN || '').split(',').map(domain => domain.trim()).filter(domain => domain);
  const siteMode = (import.meta.env.VITE_SITE_MODE === 'temp' ? 'temp' : 'perm') as 'temp' | 'perm';
  const fallbackConfig: SiteConfig = {
    emailDomains: fallbackDomains,
    externalLinks: undefined,
    siteMode,
    siteName: import.meta.env.VITE_SITE_NAME || (siteMode === 'temp' ? '临时邮箱' : '匿名邮箱'),
    otherSiteUrl: import.meta.env.VITE_OTHER_SITE_URL || '',
    otherSiteLabel: import.meta.env.VITE_OTHER_SITE_LABEL || (siteMode === 'temp' ? '匿名或永久邮箱' : '返回临时邮箱'),
  };
  cachedSiteConfig = fallbackConfig;
  cachedEmailDomains = fallbackConfig.emailDomains;
  return fallbackConfig;
}

// 从 API 获取邮箱域名配置
export async function getEmailDomains(): Promise<string[]> {
  if (cachedEmailDomains && configLoaded) {
    return cachedEmailDomains;
  }
  const config = await getSiteConfig();
  return config.emailDomains;
}

// 获取默认邮箱域名
export async function getDefaultEmailDomain(): Promise<string> {
  const domains = await getEmailDomains();
  return domains[0] || '';
}

// 同步版本的邮箱域名配置（用于向后兼容；构建时未注入则留空，避免显示无效的 example.com）
export const EMAIL_DOMAINS = (import.meta.env.VITE_EMAIL_DOMAIN || '').split(',').map(domain => domain.trim()).filter(domain => domain) || [];
export const DEFAULT_EMAIL_DOMAIN = EMAIL_DOMAINS[0] || '';

// 清除配置缓存，强制下次调用重新向服务端拉取
export function resetEmailDomainsCache(): void {
  cachedEmailDomains = null;
  cachedExternalLinks = null;
  cachedSiteConfig = null;
  configLoaded = false;
}

// 从 API 获取外部链接配置
export async function getExternalLinks(): Promise<string> {
  if (cachedExternalLinks && configLoaded) {
    return cachedExternalLinks.map((l: { label: string; url: string }) => `${l.label}|${l.url}`).join(',');
  }
  try {
    const response = await fetch(`${API_BASE_URL}/api/config`);
    if (response.ok) {
      const data = await response.json();
      if (data.success && data.config.externalLinks) {
        cachedExternalLinks = data.config.externalLinks;
        return data.config.externalLinks.map((l: { label: string; url: string }) => `${l.label}|${l.url}`).join(',');
      }
    }
  } catch (error) {
    console.error('获取外部链接配置失败:', error);
  }
  // 如果 API 获取失败，使用环境变量作为后备
  return import.meta.env.VITE_EXTERNAL_LINKS || '';
}

// 其他配置
export const DEFAULT_AUTO_REFRESH = false;
export const AUTO_REFRESH_INTERVAL = 10000; // 10秒

// 站点模式相关（同步版本，用于首屏渲染）
export const SITE_MODE = (import.meta.env.VITE_SITE_MODE === 'temp' ? 'temp' : 'perm') as 'temp' | 'perm';
export const SITE_NAME = import.meta.env.VITE_SITE_NAME || (SITE_MODE === 'temp' ? '临时邮箱' : '匿名邮箱');
export const OTHER_SITE_URL = import.meta.env.VITE_OTHER_SITE_URL || '';
export const OTHER_SITE_LABEL = import.meta.env.VITE_OTHER_SITE_LABEL || (SITE_MODE === 'temp' ? '匿名或永久邮箱' : '返回临时邮箱');
