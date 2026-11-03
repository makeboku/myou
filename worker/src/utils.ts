/**
 * 生成随机字符串
 * @param length 字符串长度
 * @returns 随机字符串
 */
export function generateRandomString(length: number): string {
    const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    for (let i = 0; i < length; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  }

/**
 * 生成随机密码
 * @param length 密码长度，默认25-35之间随机（与前端 CreateLoginDialog 保持一致）
 * @returns 随机密码
 */
export function generatePassword(length?: number): string {
    const finalLength = length || Math.floor(Math.random() * 11) + 25; // 25-35随机
    const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*';
    let result = '';
    for (let i = 0; i < finalLength; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  }
  
  /**
   * 生成随机邮箱地址
   * @returns 随机邮箱地址
   */
  export function generateRandomAddress(): string {
    // 生成8-12位随机字符
    const length = Math.floor(Math.random() * 5) + 8;
    return generateRandomString(length);
  }
  
  /**
   * 生成唯一ID
   * @returns 唯一ID
   */
  export function generateId(): string {
    return crypto.randomUUID();
  }
  
  /**
   * 获取当前时间戳（秒）
   * @returns 当前时间戳
   */
  export function getCurrentTimestamp(): number {
    return Math.floor(Date.now() / 1000);
  }
  
  /**
   * 计算过期时间戳
   * @param hours 小时数
   * @returns 过期时间戳
   */
  export function calculateExpiryTimestamp(hours: number): number {
    return getCurrentTimestamp() + (hours * 60 * 60);
  }
  
  /**
   * 检查字符串是否为有效的邮箱地址格式
   * @param address 邮箱地址
   * @returns 是否有效
   */
  export function isValidEmailAddress(address: string): boolean {
    // 简单的邮箱格式验证
    const regex = /^[a-zA-Z0-9._-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    return regex.test(address);
  }
  
  /**
   * 提取邮箱地址的用户名部分
   * @param address 完整邮箱地址
   * @returns 用户名部分
   */
  export function extractMailboxName(address: string): string {
    return address.split('@')[0];
  }
  
  /**
   * 格式化日期时间
   * @param timestamp 时间戳（秒）
   * @returns 格式化的日期时间字符串
   */
  export function formatDateTime(timestamp: number): string {
    const date = new Date(timestamp * 1000);
    return date.toISOString();
  }

/**
 * 基础 HTML 净化：移除 <script>、事件绑定属性(on*)、javascript: 协议链接，防存储型XSS
 * 同时供 Cloudflare 邮件入口与 /api/inbound Webhook 复用。
 * @param html 原始 HTML
 * @returns 净化后的 HTML
 */
export function sanitizeHtml(html: string): string {
  return (html || '')
    // 移除 <script>...</script> 及其自闭合形式
    .replace(/<script\b[^>]*>[\s\S]*?<\/script\s*>/gi, '')
    .replace(/<script\b[^>]*\/>/gi, '')
    // 移除事件绑定属性 on*=...
    .replace(/\son\w+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, '')
    // 移除 javascript: 协议的链接
    .replace(/(href|src|action)\s*=\s*(["'])\s*javascript:[^"']*\2/gi, '$1=$2$2')
    // 移除 <iframe>（可嵌入脚本/钓鱼页面）
    .replace(/<iframe\b[^>]*>[\s\S]*?<\/iframe\s*>/gi, '')
    .replace(/<iframe\b[^>]*\/>/gi, '');
}
