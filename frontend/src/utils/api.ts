import { API_BASE_URL } from "../config";

// API请求基础URL
const apiUrl = (path: string) => `${API_BASE_URL}${path}`;

// 读取/操作邮箱数据所需的密码鉴权头
const authHeaders = (password?: string): Record<string, string> => {
  if (!password) return {};
  return { 'X-Mailbox-Password': password };
};

// 创建随机邮箱
export const createRandomMailbox = async (expiresInHours = 876000) => {
  try {
    const requestBody = JSON.stringify({
      expiresInHours,
    });
    
    const response = await fetch(apiUrl('/api/mailboxes'), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: requestBody,
    });
    
    if (!response.ok) {
      throw new Error('Failed to create mailbox');
    }
    
    const data = await response.json();
    
    if (data.success) {
      return { success: true, mailbox: data.mailbox, password: data.password };
    } else {
      throw new Error(data.error || 'Unknown error');
    }
  } catch (error) {
    return { success: false, error };
  }
};

// 使用指定的用户名和密码创建邮箱
export const createMailboxWithCredentials = async (address: string, password: string, expiresInHours = 876000) => {
  try {
    const response = await fetch(apiUrl('/api/mailboxes'), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        address: address.trim(),
        password: password.trim(),
        expiresInHours,
      }),
    });
    
    // 尝试解析 JSON，防止服务器返回 HTML 错误页导致崩溃
    let data;
    try {
      data = await response.json();
    } catch {
      return { success: false, error: `服务器响应错误 (${response.status})` };
    }
    
    // 统一处理非 200 状态码
    if (!response.ok) {
      // 优先使用后端返回的中文错误信息（如 IP 限制提示）
      return { success: false, error: data.error || `创建失败 (${response.status})` };
    }
    
    if (data.success) {
      return { success: true, mailbox: data.mailbox, password: data.password || password };
    } else {
      throw new Error(data.error || '未知错误');
    }
  } catch (error) {
    console.error('Error creating mailbox with credentials:', error);
    // 确保返回的 error 是字符串
    const message = error instanceof Error ? error.message : '网络异常';
    return { success: false, error: message };
  }
};

// 创建自定义邮箱
export const createCustomMailbox = async (address: string, expiresInHours = 876000) => {
  try {
    if (!address.trim()) {
      return { success: false, error: 'Invalid address' };
    }
    
    const response = await fetch(apiUrl('/api/mailboxes'), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        address: address.trim(),
        expiresInHours,
      }),
    });
    
    // 尝试解析响应内容
    const data = await response.json();
    
    if (!response.ok) {
      if (response.status === 400) {
        // 使用后端返回的错误信息
        return { success: false, error: data.error || 'Address already exists' };
      }
      throw new Error(data.error || 'Failed to create mailbox');
    }
    
    if (data.success) {
      return { success: true, mailbox: data.mailbox, password: data.password };
    } else {
      throw new Error(data.error || 'Unknown error');
    }
  } catch (error) {
    console.error('Error creating custom mailbox:', error);
    return { success: false, error };
  }
};

// 获取邮箱信息
export const getMailbox = async (address: string, password?: string) => {
  try {
    const response = await fetch(apiUrl(`/api/mailboxes/${encodeURIComponent(address)}`), {
      headers: authHeaders(password),
    });
    
    if (!response.ok) {
      if (response.status === 404) {
        return { success: false, error: 'Mailbox not found' };
      }
      throw new Error('Failed to fetch mailbox');
    }
    
    const data = await response.json();
    if (data.success) {
      return { success: true, mailbox: data.mailbox };
    } else {
      throw new Error(data.error || 'Unknown error');
    }
  } catch (error) {
    console.error('Error fetching mailbox:', error);
    return { success: false, error };
  }
};

// 获取邮件列表
export const getEmails = async (address: string, password?: string) => {
  try {
    // 检查地址是否为空
    if (!address) {
      return { success: false, error: 'Address is empty', emails: [] };
    }
    
    const response = await fetch(apiUrl(`/api/mailboxes/${encodeURIComponent(address)}/emails`), {
      headers: authHeaders(password),
    });
    
    // 直接处理404状态码
    if (response.status === 404) {
      return { success: false, error: 'Mailbox not found', notFound: true };
    }
    
    if (!response.ok) {
      throw new Error(`Failed to fetch emails: ${response.status}`);
    }
    
    const data = await response.json();
    
    if (data.success) {
      return { success: true, emails: data.emails };
    } else {
      // 检查错误信息是否包含"邮箱不存在"
      if (data.error && (data.error.includes('邮箱不存在') || data.error.includes('Mailbox not found'))) {
        return { success: false, error: data.error, notFound: true };
      }
      throw new Error(data.error || 'Unknown error');
    }
  } catch (error) {
    return { success: false, error, emails: [] };
  }
};

// 删除邮箱
export const deleteMailbox = async (address: string, password?: string) => {
  try {
    const response = await fetch(apiUrl(`/api/mailboxes/${encodeURIComponent(address)}`), {
      method: 'DELETE',
      headers: authHeaders(password),
    });
    
    if (!response.ok) {
      throw new Error('Failed to delete mailbox');
    }
    
    const data = await response.json();
    if (data.success) {
      return { success: true };
    } else {
      throw new Error(data.error || 'Unknown error');
    }
  } catch (error) {
    console.error('Error deleting mailbox:', error);
    return { success: false, error };
  }
};

// 保存邮箱信息到本地存储
export const saveMailboxToLocalStorage = (mailbox: Mailbox, password: string) => {
  localStorage.setItem('tempMailbox', JSON.stringify({
    ...mailbox,
    password,
    savedAt: Date.now() / 1000
  }));
};

// 从本地存储获取邮箱信息
export const getMailboxFromLocalStorage = (): (Mailbox & { password: string }) | null => {
  const savedMailbox = localStorage.getItem('tempMailbox');
  if (!savedMailbox) return null;
  
  try {
    const mailbox = JSON.parse(savedMailbox) as Mailbox & { password: string; savedAt: number };
    
    return mailbox;
  } catch (error) {
    localStorage.removeItem('tempMailbox');
    return null;
  }
};

// 登录邮箱
export const loginMailbox = async (address: string, password: string) => {
  try {
    const response = await fetch(apiUrl('/api/mailboxes/login'), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ address, password }),
    });
    
    const data = await response.json();
    
    if (!response.ok) {
      if (response.status === 401) {
        return { success: false, error: data.error || '邮箱地址或密码错误' };
      }
      throw new Error(data.error || '登录失败');
    }
    
    if (data.success) {
      return { success: true, mailbox: data.mailbox, password };
    } else {
      throw new Error(data.error || '未知错误');
    }
  } catch (error) {
    console.error('Error logging in:', error);
    const message = error instanceof Error ? error.message : '登录失败';
    return { success: false, error: message };
  }
};

// 从本地存储删除邮箱信息
export const removeMailboxFromLocalStorage = () => {
  localStorage.removeItem('tempMailbox');
};

// 获取系统统计信息
export const getStats = async (): Promise<{ success: boolean; stats?: { mailboxCount: number }; error?: any }> => {
  try {
    const response = await fetch(apiUrl('/api/stats'));
    
    if (!response.ok) {
      throw new Error('Failed to fetch stats');
    }
    
    const data = await response.json();
    
    if (data.success) {
      return { success: true, stats: data.stats };
    } else {
      throw new Error(data.error || 'Unknown error');
    }
  } catch (error) {
    console.error('Error fetching stats:', error);
    return { success: false, error };
  }
};

// 批量删除邮件
export const batchDeleteEmails = async (emailIds: string[], password?: string): Promise<{ success: boolean; error?: any }> => {
  try {
    const response = await fetch(apiUrl('/api/emails/batch/delete'), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...authHeaders(password),
      },
      body: JSON.stringify({ emailIds }),
    });
    
    const data = await response.json();
    
    if (data.success) {
      return { success: true };
    } else {
      return { success: false, error: data.error };
    }
  } catch (error) {
    console.error('Error batch deleting emails:', error);
    return { success: false, error };
  }
};

// 批量标记邮件为已读
export const batchMarkAsRead = async (emailIds: string[], password?: string): Promise<{ success: boolean; error?: any }> => {
  try {
    const response = await fetch(apiUrl('/api/emails/batch/read'), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...authHeaders(password),
      },
      body: JSON.stringify({ emailIds }),
    });
    
    const data = await response.json();
    
    if (data.success) {
      return { success: true };
    } else {
      return { success: false, error: data.error };
    }
  } catch (error) {
    console.error('Error batch marking emails as read:', error);
    return { success: false, error };
  }
};

// 批量标记邮件为未读
export const batchMarkAsUnread = async (emailIds: string[], password?: string): Promise<{ success: boolean; error?: any }> => {
  try {
    const response = await fetch(apiUrl('/api/emails/batch/unread'), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...authHeaders(password),
      },
      body: JSON.stringify({ emailIds }),
    });
    
    const data = await response.json();
    
    if (data.success) {
      return { success: true };
    } else {
      return { success: false, error: data.error };
    }
  } catch (error) {
    console.error('Error batch marking emails as unread:', error);
    return { success: false, error };
  }
};

// 发送站内消息（给本站的另一邮箱，需要发件箱密码鉴权；支持附件与emoji）
export const sendInternalMessage = async (fromAddress: string, toAddress: string, content: string, password?: string, attachmentIds: string[] = []): Promise<{ success: boolean; error?: any; message?: InternalChatMessage }> => {
  try {
    const response = await fetch(apiUrl(`/api/mailboxes/${encodeURIComponent(fromAddress)}/messages`), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ toAddress, content, password, attachmentIds }),
    });

    // 优先解析 JSON；失败时透出 HTTP 状态，避免把真正的错误吞成"发送失败"
    let data: any;
    try {
      data = await response.json();
    } catch {
      return { success: false, error: `服务器返回异常 (HTTP ${response.status})` };
    }

    if (data.success) {
      return { success: true, message: data.message };
    }
    return { success: false, error: data.error || `请求失败 (HTTP ${response.status})` };
  } catch (error) {
    console.error('Error sending internal message:', error);
    return { success: false, error: error instanceof Error ? error.message : String(error) };
  }
};

// 上传站内聊天附件（浏览器读取文件后以 base64 提交，最多5个）
export const uploadChatAttachments = async (address: string, files: { filename: string; mimeType: string; content: string; size: number }[], password?: string): Promise<{ success: boolean; error?: any; message?: string; attachments?: { id: string; filename: string; mimeType: string; size: number }[] }> => {
  try {
    const response = await fetch(apiUrl(`/api/mailboxes/${encodeURIComponent(address)}/chat/attachments`), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...authHeaders(password),
      },
      body: JSON.stringify({ files }),
    });

    let data: any;
    try {
      data = await response.json();
    } catch {
      return { success: false, error: `服务器返回异常 (HTTP ${response.status})` };
    }
    if (data.success) {
      return { success: true, attachments: data.attachments ?? [] };
    }
    return { success: false, error: data.error || '上传失败', message: data.message };
  } catch (error) {
    console.error('Error uploading chat attachments:', error);
    return { success: false, error: `上传请求失败: ${error instanceof Error ? error.message : String(error)}` };
  }
};

// 下载站内聊天附件（返回 Blob，供前端生成下载链接）
export const downloadChatAttachment = async (address: string, attachmentId: string, password?: string): Promise<{ success: boolean; error?: any; blob?: Blob; filename?: string; mimeType?: string }> => {
  try {
    const response = await fetch(apiUrl(`/api/mailboxes/${encodeURIComponent(address)}/chat/attachments/${attachmentId}`), {
      headers: authHeaders(password),
    });
    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      return { success: false, error: data.error || `下载失败 (${response.status})` };
    }
    const blob = await response.blob();
    const disposition = response.headers.get('Content-Disposition') || '';
    const match = disposition.match(/filename="?([^";]+)"?/);
    return {
      success: true,
      blob,
      filename: match ? decodeURIComponent(match[1]) : 'attachment',
      mimeType: response.headers.get('Content-Type') || 'application/octet-stream',
    };
  } catch (error) {
    console.error('Error downloading chat attachment:', error);
    return { success: false, error };
  }
};

// 已读回执同步：上报我已读的消息 + 下载对方是否已读我的消息（服务端每小时节流一次）
export const syncChatReadStatus = async (address: string, messageIds: string[], password?: string): Promise<{ success: boolean; error?: any; synced?: boolean; syncAt?: number; readReceipts?: { msgKey: string; peer: string; read: boolean; readAt: number }[] }> => {
  try {
    const response = await fetch(apiUrl(`/api/mailboxes/${encodeURIComponent(address)}/chat/read-sync`), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...authHeaders(password),
      },
      body: JSON.stringify({ messageIds }),
    });

    const data = await response.json();
    if (data.success) {
      return { success: true, synced: data.synced, syncAt: data.syncAt, readReceipts: data.readReceipts ?? [] };
    }
    return { success: false, error: data.error || '同步失败' };
  } catch (error) {
    console.error('Error syncing chat read status:', error);
    return { success: false, error };
  }
};

// 站内聊天消息
export interface InternalChatMessage {
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
  attachments?: { id: string; filename: string; mimeType: string; size: number }[];
  /** 本地乐观发送的占位消息（尚未收到服务端确认） */
  pending?: boolean;
  /** 发送失败标记（仅乐观占位消息） */
  failed?: boolean;
}

// 上传文件描述（base64）
export interface ChatUploadFile {
  filename: string;
  mimeType: string;
  content: string;
  size: number;
}

// 获取与对方的站内对话（增量轮询）
export const getInternalChat = async (address: string, withAddress: string, since = 0, password?: string): Promise<{ success: boolean; error?: any; messages?: InternalChatMessage[]; deletedKeys?: string[]; deletedAt?: number }> => {
  try {
    const query = `with=${encodeURIComponent(withAddress)}&since=${since}&limit=30`;
    const response = await fetch(apiUrl(`/api/mailboxes/${encodeURIComponent(address)}/chat?${query}`), {
      headers: authHeaders(password),
    });

    const data = await response.json();

    if (data.success) {
      return { success: true, messages: data.messages, deletedKeys: data.deletedKeys || [], deletedAt: data.deletedAt || 0 };
    }
    return { success: false, error: data.error || '获取对话失败' };
  } catch (error) {
    console.error('Error fetching internal chat:', error);
    return { success: false, error, messages: [], deletedKeys: [], deletedAt: 0 };
  }
};

// 编辑站内消息（仅发送者可编辑）
export const editInternalMessage = async (address: string, msgKey: string, content: string, password?: string): Promise<{ success: boolean; error?: any; message?: InternalChatMessage }> => {
  try {
    const response = await fetch(apiUrl(`/api/mailboxes/${encodeURIComponent(address)}/chat/messages/${encodeURIComponent(msgKey)}/edit`), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...authHeaders(password),
      },
      body: JSON.stringify({ content }),
    });
    const data = await response.json();
    if (data.success) return { success: true, message: data.message };
    return { success: false, error: data.error || '编辑失败' };
  } catch (error) {
    console.error('Error editing internal message:', error);
    return { success: false, error: error instanceof Error ? error.message : String(error) };
  }
};

// 删除站内消息（仅发送者可删除）
export const deleteChatMessage = async (address: string, msgKey: string, password?: string): Promise<{ success: boolean; error?: any }> => {
  try {
    const response = await fetch(apiUrl(`/api/mailboxes/${encodeURIComponent(address)}/chat/messages/${encodeURIComponent(msgKey)}`), {
      method: 'DELETE',
      headers: authHeaders(password),
    });
    const data = await response.json();
    if (data.success) return { success: true };
    return { success: false, error: data.error || '删除失败' };
  } catch (error) {
    console.error('Error deleting internal message:', error);
    return { success: false, error: error instanceof Error ? error.message : String(error) };
  }
};

// 拉取与对方的完整站内对话（导出用，较大的 limit）
export const getFullInternalChat = async (address: string, withAddress: string, password?: string): Promise<{ success: boolean; error?: any; messages?: InternalChatMessage[] }> => {
  try {
    const query = `with=${encodeURIComponent(withAddress)}&since=0&limit=5000`;
    const response = await fetch(apiUrl(`/api/mailboxes/${encodeURIComponent(address)}/chat?${query}`), {
      headers: authHeaders(password),
    });

    const data = await response.json();

    if (data.success) {
      return { success: true, messages: data.messages };
    }
    return { success: false, error: data.error || '获取对话失败' };
  } catch (error) {
    console.error('Error fetching full internal chat:', error);
    return { success: false, error, messages: [] };
  }
};

// 获取当前邮箱未读站内消息数
export const getUnreadChatCount = async (address: string, password?: string): Promise<{ success: boolean; error?: any; count?: number }> => {
  try {
    const response = await fetch(apiUrl(`/api/mailboxes/${encodeURIComponent(address)}/chat/unread`), {
      headers: authHeaders(password),
    });

    const data = await response.json();

    if (data.success) {
      return { success: true, count: data.count ?? 0 };
    }
    return { success: false, error: data.error || '获取未读数失败' };
  } catch (error) {
    console.error('Error fetching unread chat count:', error);
    return { success: false, error };
  }
};

// 获取当前邮箱的站内会话列表（谁发来、发了什么、几条未读）
export const getInternalChatConversations = async (address: string, password?: string): Promise<{ success: boolean; error?: any; conversations?: ChatConversation[] }> => {
  try {
    const response = await fetch(apiUrl(`/api/mailboxes/${encodeURIComponent(address)}/chat/conversations`), {
      headers: authHeaders(password),
    });

    const data = await response.json();

    if (data.success) {
      return { success: true, conversations: data.conversations ?? [] };
    }
    return { success: false, error: data.error || '获取会话列表失败' };
  } catch (error) {
    console.error('Error fetching chat conversations:', error);
    return { success: false, error, conversations: [] };
  }
};

// 清空与对方的站内聊天记录（hours>0 只清最近 N 小时；0 清空全部）
export const clearInternalChat = async (address: string, withAddress: string, hours = 0, password?: string): Promise<{ success: boolean; error?: any; deleted?: number }> => {
  try {
    const query = `with=${encodeURIComponent(withAddress)}&hours=${hours}`;
    const response = await fetch(apiUrl(`/api/mailboxes/${encodeURIComponent(address)}/chat?${query}`), {
      method: 'DELETE',
      headers: authHeaders(password),
    });

    const data = await response.json();

    if (data.success) {
      return { success: true, deleted: data.deleted };
    }
    return { success: false, error: data.error || '清空失败' };
  } catch (error) {
    console.error('Error clearing internal chat:', error);
    return { success: false, error };
  }
};