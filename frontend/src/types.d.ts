// 允许导入 JSON 文件
declare module '*.json' {
  const value: any;
  export default value;
}

// 定义邮箱相关类型
interface Mailbox {
  id: string;
  address: string;
  password: string;
  createdAt: number;
  expiresAt: number;
  lastAccessed: number;
  ipAddress?: string;
}

interface Email {
  id: string;
  mailboxId: string;
  fromAddress: string;
  fromName?: string;
  toAddress: string;
  subject?: string;
  textContent?: string;
  htmlContent?: string;
  receivedAt: number;
  hasAttachments: boolean;
  isRead: boolean;
  isInternal?: boolean;
}

interface Attachment {
  id: string;
  emailId: string;
  filename: string;
  contentType: string;
  content: ArrayBuffer;
  size: number;
}

// 站内会话列表项
interface ChatConversation {
  peer: string;
  lastMessage: string;
  lastAt: number;
  unreadCount: number;
}

// Toast 相关类型
interface Toast {
  id: string;
  title?: string;
  description?: string;
  action?: React.ReactNode;
  variant?: 'default' | 'destructive';
}

// 声明环境变量类型
interface ImportMetaEnv {
  readonly VITE_EMAIL_DOMAIN: string;
  readonly VITE_API_BASE_URL: string;
  readonly VITE_EXTERNAL_LINKS: string;
  readonly VITE_SITE_MODE: string;
  readonly VITE_SITE_NAME: string;
  readonly VITE_OTHER_SITE_URL: string;
  readonly VITE_OTHER_SITE_LABEL: string;
  readonly VITE_DEV_API_TARGET: string;
  readonly MODE: string;
  readonly DEV: boolean;
  readonly PROD: boolean;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
} 