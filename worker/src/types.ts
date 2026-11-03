import { D1Database, Fetcher } from '@cloudflare/workers-types';

interface Ai {
  run: (model: string, options: { messages: Array<{ role: string; content: string }>; stream?: boolean; temperature?: number; max_tokens?: number }) => Promise<ReadableStream>;
}

// 环境变量类型
export interface Env {
  DB: D1Database;
  VITE_EMAIL_DOMAIN?: string;
  // 允许注册/收信的域名列表（逗号分隔），优先于 VITE_EMAIL_DOMAIN
  ALLOWED_EMAIL_DOMAINS?: string;
  VITE_EXTERNAL_LINKS?: string;
  // 双站点配置：temp=临时邮箱站，perm=匿名/永久邮箱站
  VITE_SITE_MODE?: 'temp' | 'perm' | string;
  VITE_SITE_NAME?: string;
  VITE_OTHER_SITE_URL?: string;
  VITE_OTHER_SITE_LABEL?: string;
  // ForwardEmail / 第三方入站 Webhook 校验密钥
  INBOUND_WEBHOOK_SECRET?: string;
  // CORS 允许的额外来源（逗号分隔，默认已放行 localhost / *.pages.dev）
  ALLOWED_ORIGINS?: string;
  // 应用层加密主密钥（>=16 字符），通过 wrangler secret 注入
  MAIL_ENCRYPTION_KEY?: string;
  // 历史数据加密迁移管理接口密钥
  MIGRATION_SECRET?: string;
  AI: Ai;
  ASSETS?: Fetcher;
}

// 邮箱类型
export interface Mailbox {
  id: string;
  address: string;
  password: string;
  createdAt: number;
  expiresAt: number;
  ipAddress: string;
  lastAccessed: number;
}

// 创建邮箱参数
export interface CreateMailboxParams {
  address: string;
  password: string;
  expiresInHours: number;
  ipAddress: string;
}

// 邮件类型
export interface Email {
  id: string;
  mailboxId: string;
  fromAddress: string;
  fromName: string;
  toAddress: string;
  subject: string;
  textContent?: string;
  htmlContent?: string;
  receivedAt: number;
  hasAttachments: boolean;
  isRead: boolean;
  isInternal?: boolean;
}

// 保存邮件参数
export interface SaveEmailParams {
  mailboxId: string;
  fromAddress: string;
  fromName?: string;
  toAddress: string;
  subject?: string;
  textContent?: string;
  htmlContent?: string;
  hasAttachments?: boolean;
  isInternal?: boolean;
}

// 邮件列表项（不包含内容）
export interface EmailListItem {
  id: string;
  mailboxId: string;
  fromAddress: string;
  fromName: string;
  toAddress: string;
  subject: string;
  receivedAt: number;
  hasAttachments: boolean;
  isRead: boolean;
  isInternal?: boolean;
}

// 附件类型
export interface Attachment {
  id: string;
  emailId: string;
  filename: string;
  mimeType: string;
  content: string; // Base64编码的内容，仅用于小型附件
  size: number;
  createdAt: number;
  isLarge: boolean; // 是否为大型附件
  chunksCount: number; // 分块数量
}

// 附件块类型
export interface AttachmentChunk {
  id: string;
  attachmentId: string;
  chunkIndex: number;
  content: string; // 分块的Base64内容
}

// 附件列表项（不包含内容）
export interface AttachmentListItem {
  id: string;
  emailId: string;
  filename: string;
  mimeType: string;
  size: number;
  createdAt: number;
  isLarge: boolean;
  chunksCount: number;
}

// 保存附件参数
export interface SaveAttachmentParams {
  emailId: string;
  filename: string;
  mimeType: string;
  content: string; // Base64编码的内容
  size: number;
}

// API 响应类型
export interface ApiResponse {
  success: boolean;
  error?: string;
  message?: string;
  [key: string]: any;
}

// 解析后的邮件类型
export interface ParsedEmail {
  html?: string;
  text?: string;
  subject?: string;
  from: {
    address: string;
    name?: string;
  };
  to: Array<{
    address: string;
    name?: string;
  }>;
  attachments?: Array<{
    filename: string;
    mimeType: string;
    content: ArrayBuffer;
    size?: number;
  }>;
}

// 发送邮件参数
export interface SendEmailParams {
  fromAddress: string;  // 发件人地址（临时邮箱地址）
  toAddress: string;    // 收件人地址
  toName?: string;      // 收件人名称
  subject: string;      // 邮件主题
  textContent?: string; // 纯文本内容
  htmlContent?: string; // HTML内容
}

// 站内发信参数
export interface SendMessageParams {
  fromAddress: string;   // 发件人邮箱地址
  toAddress: string;     // 收件人邮箱地址
  content: string;       // 消息内容
  subject?: string;      // 可选主题（默认为发件人地址）
}

// 聊天消息
export interface ChatMessage {
  id: string;
  fromAddress: string;
  toAddress: string;
  fromName: string;
  subject: string;
  textContent: string;
  receivedAt: number;
  isRead: boolean;
  msgKey?: string;
  readAt?: number;
  editedAt?: number;
  peerRead?: boolean;
  peerReadAt?: number;
  attachments?: ChatAttachmentListItem[];
}

// 聊天附件（列表项，不含内容）
export interface ChatAttachmentListItem {
  id: string;
  filename: string;
  mimeType: string;
  size: number;
}

// 聊天附件（含内容，用于下载）
export interface ChatAttachment {
  id: string;
  mailboxId: string;
  msgKey: string | null;
  filename: string;
  mimeType: string;
  content: string;
  size: number;
  createdAt: number;
}

// 聊天附件保存参数
export interface SaveChatAttachmentParams {
  filename: string;
  mimeType: string;
  content: string;
  size: number;
}

// 已读回执（发送方视角：我的消息对方是否已读）
export interface ReadReceipt {
  msgKey: string;
  peer: string;
  read: boolean;
  readAt: number;
}

// 会话列表项（用于聊天首页展示"谁发来、发了什么、几条未读"）
export interface ChatConversation {
  peer: string;        // 对方邮箱地址
  lastMessage: string; // 最近一条消息内容
  lastAt: number;      // 最近一条消息时间（秒）
  unreadCount: number; // 对方发来的未读数
}