import { D1Database } from '@cloudflare/workers-types';
import { 
  Mailbox, 
  CreateMailboxParams, 
  Email, 
  SaveEmailParams, 
  EmailListItem,
  Attachment,
  AttachmentListItem,
  SaveAttachmentParams,
  ChatMessage,
  ChatConversation,
  ChatAttachmentListItem,
  ChatAttachment,
  SaveChatAttachmentParams,
  ReadReceipt
} from './types';
import { 
  generateId, 
  getCurrentTimestamp, 
  calculateExpiryTimestamp 
} from './utils';
import {
  blindIndexAddress,
  decryptAddress,
  decryptText,
  encryptText,
  isEncryptionEnabled,
  normalizeAddress,
  protectAddress,
} from './crypto';

// 附件分块大小（字节）
const CHUNK_SIZE = 500000; // 约500KB

// 密码哈希：PBKDF2(SHA-256, 100000次迭代)，格式 pbkdf2$<saltHex>$<hashHex>
const PASSWORD_HASH_PREFIX = 'pbkdf2$';
const PBKDF2_ITERATIONS = 100000;

function toHex(bytes: Uint8Array): string {
  return [...bytes].map(b => b.toString(16).padStart(2, '0')).join('');
}

// 解密失败/缺少密钥时 crypto 返回的占位文本；迁移时必须跳过，避免把占位符重新加密覆盖原数据
function isDecryptionFailure(value: string | null | undefined): boolean {
  if (!value) return false;
  return value.startsWith('[解密失败') || value.startsWith('[已加密数据') || value.startsWith('[已加密邮箱');
}

function hexToBytes(hex: string): Uint8Array {
  const clean = hex.replace(/[^0-9a-fA-F]/g, '');
  const out = new Uint8Array(clean.length / 2);
  for (let i = 0; i < out.length; i++) {
    out[i] = parseInt(clean.slice(i * 2, i * 2 + 2), 16);
  }
  return out;
}

// 常数时间字符串比较（避免时序攻击）
function timingSafeEqualHex(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

async function hashPassword(password: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const importedKey = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(password),
    'PBKDF2',
    false,
    ['deriveBits']
  );
  const derived = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt: salt.buffer as ArrayBuffer, iterations: PBKDF2_ITERATIONS, hash: 'SHA-256' },
    importedKey,
    256
  );
  return `${PASSWORD_HASH_PREFIX}${toHex(salt)}$${toHex(new Uint8Array(derived))}`;
}

async function verifyPassword(password: string, stored: string): Promise<boolean> {
  if (!stored) return false;
  // 旧版明文密码（哈希方案上线前创建的邮箱），验证通过后由调用方升级为哈希
  if (!stored.startsWith(PASSWORD_HASH_PREFIX)) {
    return stored === password;
  }
  const body = stored.slice(PASSWORD_HASH_PREFIX.length);
  const sepIndex = body.indexOf('$');
  if (sepIndex < 0) return false;
  const saltHex = body.slice(0, sepIndex);
  const expectedHex = body.slice(sepIndex + 1);
  const salt = hexToBytes(saltHex);
  const importedKey = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(password),
    'PBKDF2',
    false,
    ['deriveBits']
  );
  const derived = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt: salt.buffer as ArrayBuffer, iterations: PBKDF2_ITERATIONS, hash: 'SHA-256' },
    importedKey,
    256
  );
  const calcHex = toHex(new Uint8Array(derived));
  return timingSafeEqualHex(calcHex, expectedHex);
}

/**
 * 幂等地为表添加列（若列已存在则跳过）
 */
async function addColumnIfMissing(db: D1Database, table: string, column: string, definition: string): Promise<void> {
  const cols = await db.prepare(`PRAGMA table_info(${table})`).all<{ name: string }>();
  const exists = cols.results?.some(c => c.name === column);
  if (!exists) {
    await db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition};`);
  }
}

interface MailboxRow {
  id: string;
  address: string;
  address_hash?: string | null;
  password: string;
  created_at: number;
  expires_at: number;
  ip_address: string;
  last_accessed: number;
}

/**
 * 按地址查找邮箱行：
 * 1. 优先使用 HMAC 盲索引（加密后的新数据）
 * 2. 回退到明文地址（升级前创建的历史数据）
 */
async function findMailboxRow(db: D1Database, address: string): Promise<MailboxRow | null> {
  const normalized = normalizeAddress(address);
  const hash = await blindIndexAddress(normalized);
  const columns = 'id, address, address_hash, password, created_at, expires_at, ip_address, last_accessed';

  if (hash && hash !== normalized) {
    const byHash = await db
      .prepare(`SELECT ${columns} FROM mailboxes WHERE address_hash = ?`)
      .bind(hash)
      .first<MailboxRow>();
    if (byHash) return byHash;
  }

  const legacy = await db
    .prepare(`SELECT ${columns} FROM mailboxes WHERE address = ?`)
    .bind(normalized)
    .first<MailboxRow>();
  return legacy || null;
}

/**
 * 对历史明文邮箱地址做懒加密（读取/登录时顺带完成迁移）。
 * @returns 解密后的明文地址
 */
async function ensureMailboxAddressEncrypted(db: D1Database, row: MailboxRow): Promise<string> {
  const plain = await decryptAddress(row.address);
  if (!isEncryptionEnabled() || !plain || isDecryptionFailure(plain)) {
    return plain;
  }

  const { value, hash } = await protectAddress(plain);
  if (row.address !== value || row.address_hash !== hash) {
    await db
      .prepare(`UPDATE mailboxes SET address = ?, address_hash = ? WHERE id = ?`)
      .bind(value, hash, row.id)
      .run();
    row.address = value;
    row.address_hash = hash;
  }
  return plain;
}

/**
 * 初始化数据库
 * @param db 数据库实例
 */
export async function initializeDatabase(db: D1Database): Promise<void> {
  try {
    // 创建邮箱表（address 存确定性密文，address_hash 存 HMAC 盲索引）
    await db.exec(`CREATE TABLE IF NOT EXISTS mailboxes (id TEXT PRIMARY KEY, address TEXT UNIQUE NOT NULL, address_hash TEXT, password TEXT NOT NULL, created_at INTEGER NOT NULL, expires_at INTEGER NOT NULL, ip_address TEXT, last_accessed INTEGER NOT NULL);`);
    await addColumnIfMissing(db, 'mailboxes', 'address_hash', 'TEXT');
    
    // 创建邮件表
    await db.exec(`CREATE TABLE IF NOT EXISTS emails (id TEXT PRIMARY KEY, mailbox_id TEXT NOT NULL, from_address TEXT NOT NULL, from_name TEXT, to_address TEXT NOT NULL, subject TEXT, text_content TEXT, html_content TEXT, received_at INTEGER NOT NULL, has_attachments BOOLEAN DEFAULT FALSE, is_read BOOLEAN DEFAULT FALSE, FOREIGN KEY (mailbox_id) REFERENCES mailboxes(id) ON DELETE CASCADE);`);
    await addColumnIfMissing(db, 'emails', 'from_hash', 'TEXT');
    await addColumnIfMissing(db, 'emails', 'to_hash', 'TEXT');
    
    // 创建附件表
    await db.exec(`CREATE TABLE IF NOT EXISTS attachments (id TEXT PRIMARY KEY, email_id TEXT NOT NULL, filename TEXT NOT NULL, mime_type TEXT NOT NULL, content TEXT, size INTEGER NOT NULL, created_at INTEGER NOT NULL, is_large BOOLEAN DEFAULT FALSE, chunks_count INTEGER DEFAULT 0, FOREIGN KEY (email_id) REFERENCES emails(id) ON DELETE CASCADE);`);
    
    // 创建附件块表
    await db.exec(`CREATE TABLE IF NOT EXISTS attachment_chunks (id TEXT PRIMARY KEY, attachment_id TEXT NOT NULL, chunk_index INTEGER NOT NULL, content TEXT NOT NULL, FOREIGN KEY (attachment_id) REFERENCES attachments(id) ON DELETE CASCADE);`);
    
    // [feat] 站内聊天表：与收件箱分离，避免聊天消息刷屏站内邮件
    await db.exec(`CREATE TABLE IF NOT EXISTS chat_messages (id TEXT PRIMARY KEY, mailbox_id TEXT NOT NULL, from_address TEXT NOT NULL, from_name TEXT, to_address TEXT NOT NULL, content TEXT NOT NULL, created_at INTEGER NOT NULL, is_read INTEGER DEFAULT 0);`);
    await db.exec(`CREATE INDEX IF NOT EXISTS idx_chat_messages_mailbox_from ON chat_messages(mailbox_id, from_address, created_at);`);
    await db.exec(`CREATE INDEX IF NOT EXISTS idx_chat_messages_mailbox_to ON chat_messages(mailbox_id, to_address, created_at);`);
    await db.exec(`CREATE INDEX IF NOT EXISTS idx_chat_messages_unread ON chat_messages(mailbox_id, is_read);`);
    await db.exec(`CREATE INDEX IF NOT EXISTS idx_chat_messages_mailbox_created ON chat_messages(mailbox_id, created_at DESC);`);
    
    // [feat] 站内聊天已读回执与消息关联（msg_key 关联双方副本；peer_read 为发送方本地缓存的对方已读状态）
    await addColumnIfMissing(db, 'chat_messages', 'read_at', 'INTEGER DEFAULT 0');
    await addColumnIfMissing(db, 'chat_messages', 'msg_key', 'TEXT');
    await addColumnIfMissing(db, 'chat_messages', 'peer_read', 'INTEGER DEFAULT 0');
    await addColumnIfMissing(db, 'chat_messages', 'peer_read_at', 'INTEGER DEFAULT 0');
    // [feat] 消息编辑：记录最后一次编辑时间，供对方增量轮询发现编辑
    await addColumnIfMissing(db, 'chat_messages', 'edited_at', 'INTEGER DEFAULT 0');
    // [encrypt] 地址盲索引列：加密后仍可按地址等值查询
    await addColumnIfMissing(db, 'chat_messages', 'from_hash', 'TEXT');
    await addColumnIfMissing(db, 'chat_messages', 'to_hash', 'TEXT');
    await db.exec(`CREATE INDEX IF NOT EXISTS idx_chat_messages_msg_key ON chat_messages(msg_key);`);
    await db.exec(`CREATE INDEX IF NOT EXISTS idx_chat_messages_from ON chat_messages(from_address, mailbox_id);`);
    await db.exec(`CREATE INDEX IF NOT EXISTS idx_chat_messages_from_hash ON chat_messages(from_hash, mailbox_id);`);
    await db.exec(`CREATE INDEX IF NOT EXISTS idx_chat_messages_to_hash ON chat_messages(to_hash, mailbox_id);`);
    
    // [feat] 站内聊天附件表（与邮件附件分离），msg_key 为空表示已上传但未随消息发送
    await db.exec(`CREATE TABLE IF NOT EXISTS chat_attachments (id TEXT PRIMARY KEY, mailbox_id TEXT NOT NULL, msg_key TEXT, filename TEXT NOT NULL, mime_type TEXT NOT NULL, content TEXT, size INTEGER NOT NULL, is_large INTEGER DEFAULT 0, chunks_count INTEGER DEFAULT 0, created_at INTEGER NOT NULL);`);
    await db.exec(`CREATE INDEX IF NOT EXISTS idx_chat_attachments_mailbox ON chat_attachments(mailbox_id);`);
    await db.exec(`CREATE INDEX IF NOT EXISTS idx_chat_attachments_msg_key ON chat_attachments(msg_key);`);
    await db.exec(`CREATE TABLE IF NOT EXISTS chat_attachment_chunks (id TEXT PRIMARY KEY, attachment_id TEXT NOT NULL, chunk_index INTEGER NOT NULL, content TEXT NOT NULL);`);
    await db.exec(`CREATE INDEX IF NOT EXISTS idx_chat_attachment_chunks_attachment ON chat_attachment_chunks(attachment_id);`);
    
    // [feat] 站内聊天已读回执同步节流表（每小时最多同步一次，降低 D1 读写量）
    await db.exec(`CREATE TABLE IF NOT EXISTS chat_sync_state (mailbox_id TEXT PRIMARY KEY, last_sync_at INTEGER NOT NULL);`);

    // [feat] 站内消息删除墓碑（记录已删除的 msg_key，供对方增量轮询时移除本地副本）
    await db.exec(`CREATE TABLE IF NOT EXISTS chat_deletions (msg_key TEXT PRIMARY KEY, deleted_at INTEGER NOT NULL);`);
    
    // 速率限制事件表（登录失败/发信等防爆破防刷）
    await db.exec(`CREATE TABLE IF NOT EXISTS rate_events (ip TEXT, action TEXT, created_at INTEGER);`);
    await db.exec(`CREATE INDEX IF NOT EXISTS idx_rate_events_key ON rate_events(ip, action, created_at);`);
    
    // [encrypt] 迁移进度记录表（用于历史数据加密迁移）
    await db.exec(`CREATE TABLE IF NOT EXISTS app_meta (key TEXT PRIMARY KEY, value TEXT NOT NULL);`);
    // [encrypt] 迁移跳过记录表：解密失败的历史行无法自动迁移，记录后不再反复占用批次
    await db.exec(`CREATE TABLE IF NOT EXISTS encryption_skipped (category TEXT NOT NULL, row_id TEXT NOT NULL, reason TEXT, created_at INTEGER NOT NULL, PRIMARY KEY (category, row_id));`);

    // 创建索引
    await db.exec(`CREATE INDEX IF NOT EXISTS idx_mailboxes_address ON mailboxes(address);`);
    await db.exec(`CREATE UNIQUE INDEX IF NOT EXISTS idx_mailboxes_address_hash ON mailboxes(address_hash);`);
    await db.exec(`CREATE INDEX IF NOT EXISTS idx_mailboxes_expires_at ON mailboxes(expires_at);`);
    await db.exec(`CREATE INDEX IF NOT EXISTS idx_emails_mailbox_id ON emails(mailbox_id);`);
    await db.exec(`CREATE INDEX IF NOT EXISTS idx_emails_received_at ON emails(received_at);`);
    await db.exec(`CREATE INDEX IF NOT EXISTS idx_attachments_email_id ON attachments(email_id);`);
    await db.exec(`CREATE INDEX IF NOT EXISTS idx_attachment_chunks_attachment_id ON attachment_chunks(attachment_id);`);
    await db.exec(`CREATE INDEX IF NOT EXISTS idx_attachment_chunks_chunk_index ON attachment_chunks(chunk_index);`);
    
    // [feat] 站内信：为 emails 表添加 is_internal 列（幂等迁移，避免重复添加）
    await addColumnIfMissing(db, 'emails', 'is_internal', 'INTEGER DEFAULT 0');
    // [feat] 站内信：为对话按 peer 地址查询建立索引（from/to 双向，降低扫描行数）
    await db.exec(`CREATE INDEX IF NOT EXISTS idx_emails_mailbox_peer ON emails(mailbox_id, from_address, received_at);`);
    await db.exec(`CREATE INDEX IF NOT EXISTS idx_emails_mailbox_to ON emails(mailbox_id, to_address, received_at);`);
    await db.exec(`CREATE INDEX IF NOT EXISTS idx_emails_from_hash ON emails(from_hash, mailbox_id);`);
    await db.exec(`CREATE INDEX IF NOT EXISTS idx_emails_to_hash ON emails(to_hash, mailbox_id);`);

    // 注意：不要对 address / from_address / to_address 执行 lower() 等原地更新，
    // 加密后的密文包含大小写字符，lower() 会破坏密文导致无法解密。

    console.log('数据库初始化成功');
  } catch (error) {
    console.error('数据库初始化失败:', error);
    // 抛出错误，让上层处理
    throw new Error(`数据库初始化失败: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * 创建邮箱
 * @param db 数据库实例
 * @param params 参数
 * @returns 创建的邮箱
 */
export async function createMailbox(db: D1Database, params: CreateMailboxParams): Promise<Mailbox> {
  const now = getCurrentTimestamp();
  const hashedPassword = await hashPassword(params.password);
  const protectedAddress = await protectAddress(params.address);
  const mailbox: Mailbox = {
    id: generateId(),
    address: protectedAddress.plain,
    password: hashedPassword,
    createdAt: now,
    expiresAt: calculateExpiryTimestamp(params.expiresInHours),
    ipAddress: params.ipAddress,
    lastAccessed: now,
  };
  
  await db.prepare(`INSERT INTO mailboxes (id, address, address_hash, password, created_at, expires_at, ip_address, last_accessed) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`).bind(mailbox.id, protectedAddress.value, protectedAddress.hash, mailbox.password, mailbox.createdAt, mailbox.expiresAt, mailbox.ipAddress, mailbox.lastAccessed).run();
  
  return mailbox;
}

/**
 * 获取邮箱信息（不检查过期时间，邮箱永久有效）
 * @param db 数据库实例
 * @param address 邮箱地址
 * @returns 邮箱信息
 */
export async function getMailbox(db: D1Database, address: string): Promise<Mailbox | null> {
  const now = getCurrentTimestamp();
  const result = await findMailboxRow(db, address);
  
  if (!result) return null;

  const plainAddress = await ensureMailboxAddressEncrypted(db, result);
  
  // 更新最后访问时间
  await db.prepare(`UPDATE mailboxes SET last_accessed = ? WHERE id = ?`).bind(now, result.id).run();
  
  return {
    id: result.id,
    address: plainAddress,
    password: result.password,
    createdAt: result.created_at,
    expiresAt: result.expires_at,
    ipAddress: result.ip_address,
    lastAccessed: now,
  };
}

/**
 * 轻量检查邮箱是否存在并返回ID（不更新 last_accessed，节省 D1 写入）
 * @param db 数据库实例
 * @param address 邮箱地址
 * @returns 邮箱ID或null
 */
export async function getMailboxId(db: D1Database, address: string): Promise<string | null> {
  const result = await findMailboxRow(db, address);
  return result?.id || null;
}

/**
 * 登录邮箱（验证用户名和密码）
 * @param db 数据库实例
 * @param address 邮箱地址
 * @param password 密码
 * @returns 邮箱信息
 */
export async function loginMailbox(db: D1Database, address: string, password: string): Promise<Mailbox | null> {
  const now = getCurrentTimestamp();
  const result = await findMailboxRow(db, address);
  
  if (!result) return null;

  const storedPassword = result.password;
  const passwordMatches = await verifyPassword(password, storedPassword);
  if (!passwordMatches) return null;

  // 旧版明文密码验证通过后，升级为哈希存储（懒迁移）
  if (!storedPassword.startsWith(PASSWORD_HASH_PREFIX)) {
    const hashedPassword = await hashPassword(password);
    await db.prepare(`UPDATE mailboxes SET password = ? WHERE id = ?`).bind(hashedPassword, result.id).run();
  }

  const plainAddress = await ensureMailboxAddressEncrypted(db, result);
  
  // 更新最后访问时间
  await db.prepare(`UPDATE mailboxes SET last_accessed = ? WHERE id = ?`).bind(now, result.id).run();
  
  return {
    id: result.id,
    address: plainAddress,
    password: storedPassword,
    createdAt: result.created_at,
    expiresAt: result.expires_at,
    ipAddress: result.ip_address,
    lastAccessed: now,
  };
}

/**
 * 获取用户的所有邮箱
 * @param db 数据库实例
 * @param ipAddress IP地址
 * @returns 邮箱列表
 */
export async function getMailboxes(db: D1Database, ipAddress: string): Promise<Omit<Mailbox, 'password'>[]> {
  const now = getCurrentTimestamp();
  const results = await db.prepare(`SELECT id, address, created_at, expires_at, ip_address, last_accessed FROM mailboxes WHERE ip_address = ? AND expires_at > ? ORDER BY created_at DESC`).bind(ipAddress, now).all();
  
  if (!results.results) return [];
  
  return Promise.all(results.results.map(async result => ({
    id: result.id as string,
    address: await decryptAddress(result.address as string),
    createdAt: result.created_at as number,
    expiresAt: result.expires_at as number,
    ipAddress: result.ip_address as string,
    lastAccessed: result.last_accessed as number,
  })));
}

/**
 * 删除邮箱
 * @param db 数据库实例
 * @param address 邮箱地址
 */
export async function deleteMailbox(db: D1Database, address: string): Promise<void> {
  // [feat] 由于外键设置了 ON DELETE CASCADE，直接删除邮箱即可级联删除相关邮件和附件
  const normalized = normalizeAddress(address);
  const hash = await blindIndexAddress(normalized);
  // 同时兼容加密后的新数据与升级前的明文数据
  await db.prepare(`DELETE FROM mailboxes WHERE address_hash = ? OR address = ?`).bind(hash, normalized).run();
}

/**
 * 清理孤立的附件（没有关联到任何邮件的附件）
 * @param db 数据库实例
 * @returns 删除的附件数量
 */
async function cleanupOrphanedAttachments(db: D1Database): Promise<number> {
    // [refactor] 优化孤立附件的清理逻辑
    try {
        // 一次性查询所有孤立附件及其分块信息
        const orphanedAttachmentsResult = await db.prepare(`
            SELECT a.id 
            FROM attachments a 
            LEFT JOIN emails e ON a.email_id = e.id 
            WHERE e.id IS NULL
        `).all<{ id: string }>();

        if (!orphanedAttachmentsResult.results || orphanedAttachmentsResult.results.length === 0) {
            return 0;
        }

        const attachmentIds = orphanedAttachmentsResult.results.map(row => row.id);
        const placeholders = attachmentIds.map(() => '?').join(',');

        console.log(`找到 ${attachmentIds.length} 个孤立附件，准备清理...`);

        // 批量删除附件分块
        await db.prepare(`DELETE FROM attachment_chunks WHERE attachment_id IN (${placeholders})`).bind(...attachmentIds).run();
        console.log(`已清理孤立附件的所有分块`);

        // 批量删除附件记录
        const deleteResult = await db.prepare(`DELETE FROM attachments WHERE id IN (${placeholders})`).bind(...attachmentIds).run();
        const deletedCount = deleteResult.meta?.changes || 0;
        console.log(`已清理 ${deletedCount} 个孤立附件记录`);

        return deletedCount;
    } catch (error) {
        console.error('清理孤立附件时出错:', error);
        return 0;
    }
}

/**
 * 清理过期邮箱（现在邮箱为永久有效，此函数保留但不再删除邮箱）
 * @param db 数据库实例
 * @returns 删除的邮箱数量
 */
export async function cleanupExpiredMailboxes(_db: D1Database): Promise<number> {
  // 邮箱现在永久有效，不再清理
  // 如果需要清理非常旧的邮箱（例如超过1年），可以取消下面的注释
  // const now = getCurrentTimestamp();
  // const oneYearAgo = now - (365 * 24 * 60 * 60);
  // const result = await db.prepare(`DELETE FROM mailboxes WHERE created_at <= ?`).bind(oneYearAgo).run();
  // return result.meta?.changes || 0;
  return 0;
}

/**
 * 清理过期邮件
 * @param db 数据库实例
 * @returns 删除的邮件数量
 */
export async function cleanupExpiredMails(db: D1Database): Promise<number> {
  const now = getCurrentTimestamp();
  const oneDayAgo = now - 24 * 60 * 60;
  const ninetyDaysAgo = now - 90 * 24 * 60 * 60;
  
  // 已读邮件超过24小时删除
  const readResult = await db.prepare(`DELETE FROM emails WHERE received_at <= ? AND is_read = 1`).bind(oneDayAgo).run();
  
  // 未读邮件最多保留90天
  const unreadResult = await db.prepare(`DELETE FROM emails WHERE received_at <= ? AND is_read = 0`).bind(ninetyDaysAgo).run();
  
  await cleanupOrphanedAttachments(db);
  
  return (readResult.meta?.changes || 0) + (unreadResult.meta?.changes || 0);
}

/**
 * 清理已被阅读的邮件
 * @param db 数据库实例
 * @returns 删除的邮件数量
 */
export async function cleanupReadMails(db: D1Database): Promise<number> {
  // [refactor] 同样利用 ON DELETE CASCADE 特性简化逻辑
  const result = await db.prepare(`DELETE FROM emails WHERE is_read = 1`).run();
  
  await cleanupOrphanedAttachments(db);
  
  return result.meta?.changes || 0;
}

/**
 * 保存邮件
 * @param db 数据库实例
 * @param params 参数
 * @returns 保存的邮件
 */
export async function saveEmail(db: D1Database, params: SaveEmailParams): Promise<Email> {
  try {
    console.log('开始保存邮件...');
    
    const now = getCurrentTimestamp();
    const email: Email = {
      id: generateId(),
      mailboxId: params.mailboxId,
      fromAddress: params.fromAddress,
      fromName: params.fromName || '',
      toAddress: params.toAddress,
      subject: params.subject || '',
      textContent: params.textContent || '',
      htmlContent: params.htmlContent || '',
      receivedAt: now,
      hasAttachments: params.hasAttachments || false,
      isRead: false,
      isInternal: params.isInternal || false,
    };

    // [encrypt] 地址使用确定性加密 + 盲索引；正文/主题使用随机 IV 的 AES-GCM
    const [from, to, fromName, subject, textContent, htmlContent] = await Promise.all([
      protectAddress(params.fromAddress || ''),
      protectAddress(params.toAddress || ''),
      encryptText(params.fromName || ''),
      encryptText(params.subject || ''),
      encryptText(params.textContent || ''),
      encryptText(params.htmlContent || ''),
    ]);
    
    console.log('准备插入邮件:', email.id);
    
    await db.prepare(`INSERT INTO emails (id, mailbox_id, from_address, from_hash, from_name, to_address, to_hash, subject, text_content, html_content, received_at, has_attachments, is_read, is_internal) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
      .bind(email.id, email.mailboxId, from.value, from.hash, fromName, to.value, to.hash, subject, textContent, htmlContent, email.receivedAt, email.hasAttachments ? 1 : 0, email.isRead ? 1 : 0, email.isInternal ? 1 : 0)
      .run();
    
    console.log('邮件保存成功:', email.id);
    
    return email;
  } catch (error) {
    console.error('保存邮件失败:', error);
    throw new Error(`保存邮件失败: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * 保存附件
 * @param db 数据库实例
 * @param params 参数
 * @returns 保存的附件
 */
export async function saveAttachment(db: D1Database, params: SaveAttachmentParams): Promise<Attachment> {
  try {
    console.log('开始保存附件...');
    
    const now = getCurrentTimestamp();
    const attachmentId = generateId();

    // [encrypt] 附件内容整体加密后再分块；文件名同样加密，D1 中看不到原始文件名
    const [encryptedContent, encryptedFilename] = await Promise.all([
      encryptText(params.content),
      encryptText(params.filename),
    ]);
    
    // 检查附件大小，决定是否需要分块存储
    const isLarge = encryptedContent.length > CHUNK_SIZE;
    console.log(`附件大小: ${params.content.length} 字节, 是否为大型附件: ${isLarge}`);
    
    if (isLarge) {
      // 大型附件，需要分块存储
      const contentLength = encryptedContent.length;
      const chunksCount = Math.ceil(contentLength / CHUNK_SIZE);
      console.log(`将附件分为 ${chunksCount} 块存储`);
      
      // 创建附件记录，但不存储内容
      const attachment: Attachment = {
        id: attachmentId,
        emailId: params.emailId,
        filename: params.filename,
        mimeType: params.mimeType,
        content: '', // 大型附件不在主表存储内容
        size: params.size,
        createdAt: now,
        isLarge: true,
        chunksCount: chunksCount
      };
      
      // 插入附件记录
      await db.prepare(`INSERT INTO attachments (id, email_id, filename, mime_type, content, size, created_at, is_large, chunks_count) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`).bind(attachment.id, attachment.emailId, encryptedFilename, attachment.mimeType, attachment.content, attachment.size, attachment.createdAt, attachment.isLarge ? 1 : 0, attachment.chunksCount).run();
      
      // 分块存储附件内容
      for (let i = 0; i < chunksCount; i++) {
        const start = i * CHUNK_SIZE;
        const end = Math.min(start + CHUNK_SIZE, contentLength);
        const chunkContent = encryptedContent.substring(start, end);
        const chunkId = generateId();
        
        await db.prepare(`INSERT INTO attachment_chunks (id, attachment_id, chunk_index, content) VALUES (?, ?, ?, ?)`).bind(chunkId, attachment.id, i, chunkContent).run();
        console.log(`保存附件块 ${i+1}/${chunksCount}`);
      }
      
      console.log('大型附件保存成功:', attachment.id);
      return attachment;
    } else {
      // 小型附件，直接存储
      const attachment: Attachment = {
        id: attachmentId,
        emailId: params.emailId,
        filename: params.filename,
        mimeType: params.mimeType,
        content: params.content,
        size: params.size,
        createdAt: now,
        isLarge: false,
        chunksCount: 0
      };
      
      await db.prepare(`INSERT INTO attachments (id, email_id, filename, mime_type, content, size, created_at, is_large, chunks_count) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`).bind(attachment.id, attachment.emailId, encryptedFilename, attachment.mimeType, encryptedContent, attachment.size, attachment.createdAt, attachment.isLarge ? 1 : 0, attachment.chunksCount).run();
      
      console.log('小型附件保存成功:', attachment.id);
      return attachment;
    }
  } catch (error) {
    console.error('保存附件失败:', error);
    throw new Error(`保存附件失败: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * 获取邮件列表
 * @param db 数据库实例
 * @param mailboxId 邮箱ID
 * @returns 邮件列表
 */
export async function getEmails(db: D1Database, mailboxId: string): Promise<EmailListItem[]> {
  const results = await db.prepare(`SELECT id, mailbox_id, from_address, from_name, to_address, subject, received_at, has_attachments, is_read, is_internal FROM emails WHERE mailbox_id = ? ORDER BY received_at DESC`).bind(mailboxId).all();
  
  if (!results.results) return [];
  
  return Promise.all(results.results.map(async result => ({
    id: result.id as string,
    mailboxId: result.mailbox_id as string,
    fromAddress: await decryptAddress(result.from_address as string),
    fromName: await decryptText(result.from_name as string),
    toAddress: await decryptAddress(result.to_address as string),
    subject: await decryptText(result.subject as string),
    receivedAt: result.received_at as number,
    hasAttachments: !!result.has_attachments,
    isRead: !!result.is_read,
    isInternal: !!result.is_internal,
  })));
}

/**
 * 获取邮件详情
 * @param db 数据库实例
 * @param id 邮件ID
 * @returns 邮件详情
 */
export async function getEmail(db: D1Database, id: string): Promise<Email | null> {
  const result = await db.prepare(`SELECT id, mailbox_id, from_address, from_name, to_address, subject, text_content, html_content, received_at, has_attachments, is_read, is_internal FROM emails WHERE id = ?`).bind(id).first();
  
  if (!result) return null;
  
  // 标记为已读
  await db.prepare(`UPDATE emails SET is_read = 1 WHERE id = ?`).bind(id).run();
  
  return {
    id: result.id as string,
    mailboxId: result.mailbox_id as string,
    fromAddress: await decryptAddress(result.from_address as string),
    fromName: await decryptText(result.from_name as string),
    toAddress: await decryptAddress(result.to_address as string),
    subject: await decryptText(result.subject as string),
    textContent: await decryptText(result.text_content as string),
    htmlContent: await decryptText(result.html_content as string),
    receivedAt: result.received_at as number,
    hasAttachments: !!result.has_attachments,
    isRead: true,
    isInternal: !!result.is_internal,
  };
}

/**
 * 获取邮件所属的邮箱ID（不读取邮件内容、不标记已读，供鉴权用）
 */
export async function getEmailOwnerMailboxId(db: D1Database, emailId: string): Promise<string | null> {
  const result = await db.prepare(`SELECT mailbox_id FROM emails WHERE id = ?`).bind(emailId).first<{ mailbox_id: string }>();
  return result?.mailbox_id || null;
}

/**
 * 通过附件ID解析其所属邮箱ID（关联邮件，不读取附件内容，供鉴权用）
 */
export async function getAttachmentMailboxId(db: D1Database, attachmentId: string): Promise<string | null> {
  const result = await db.prepare(
    `SELECT e.mailbox_id FROM attachments a JOIN emails e ON e.id = a.email_id WHERE a.id = ?`
  ).bind(attachmentId).first<{ mailbox_id: string }>();
  return result?.mailbox_id || null;
}

/**
 * 根据邮箱ID获取其地址（供鉴权回查用）
 */
export async function getMailboxAddressById(db: D1Database, mailboxId: string): Promise<string | null> {
  const result = await db.prepare(`SELECT address FROM mailboxes WHERE id = ?`).bind(mailboxId).first<{ address: string }>();
  if (!result?.address) return null;
  return decryptAddress(result.address);
}

/**
 * 批量邮件鉴权：检查这些邮件是否都属于同一邮箱
 * @returns exists=存在的邮件数；mailboxId=共同归属的邮箱ID（混属或多重时返回 null）
 */
export async function getEmailsOwnerMailboxId(db: D1Database, emailIds: string[]): Promise<{ exists: number; mailboxId: string | null }> {
  let mailboxId: string | null = null;
  let exists = 0;
  for (const id of emailIds) {
    const result = await db.prepare(`SELECT mailbox_id FROM emails WHERE id = ?`).bind(id).first<{ mailbox_id: string }>();
    if (result) {
      exists++;
      if (mailboxId === null) mailboxId = result.mailbox_id;
      else if (mailboxId !== result.mailbox_id) return { exists, mailboxId: null };
    }
  }
  return { exists, mailboxId };
}

/**
 * 获取附件列表
 * @param db 数据库实例
 * @param emailId 邮件ID
 * @returns 附件列表
 */
export async function getAttachments(db: D1Database, emailId: string): Promise<AttachmentListItem[]> {
  const results = await db.prepare(`SELECT id, email_id, filename, mime_type, size, created_at, is_large, chunks_count FROM attachments WHERE email_id = ? ORDER BY created_at ASC`).bind(emailId).all();
  
  if (!results.results) return [];
  
  return Promise.all(results.results.map(async result => ({
    id: result.id as string,
    emailId: result.email_id as string,
    filename: await decryptText(result.filename as string),
    mimeType: result.mime_type as string,
    size: result.size as number,
    createdAt: result.created_at as number,
    isLarge: !!result.is_large,
    chunksCount: result.chunks_count as number
  })));
}

/**
 * 获取附件详情
 * @param db 数据库实例
 * @param id 附件ID
 * @returns 附件详情
 */
export async function getAttachment(db: D1Database, id: string): Promise<Attachment | null> {
  const result = await db.prepare(`SELECT id, email_id, filename, mime_type, content, size, created_at, is_large, chunks_count FROM attachments WHERE id = ?`).bind(id).first();
  
  if (!result) return null;
  
  const isLarge = !!result.is_large;
  let content = result.content as string;
  
  // 如果是大型附件，需要从块表中获取内容（分块可能是加密后的密文，拼接后再解密）
  if (isLarge) {
    const chunksCount = result.chunks_count as number;
    content = await getAttachmentContent(db, id, chunksCount);
  }
  
  return {
    id: result.id as string,
    emailId: result.email_id as string,
    filename: await decryptText(result.filename as string),
    mimeType: result.mime_type as string,
    content: await decryptText(content),
    size: result.size as number,
    createdAt: result.created_at as number,
    isLarge: isLarge,
    chunksCount: result.chunks_count as number
  };
}

/**
 * 获取大型附件的内容
 * @param db 数据库实例
 * @param attachmentId 附件ID
 * @param chunksCount 块数量
 * @returns 完整的附件内容
 */
async function getAttachmentContent(db: D1Database, attachmentId: string, chunksCount: number): Promise<string> {
  let content = '';
  
  // 按顺序获取所有块
  for (let i = 0; i < chunksCount; i++) {
    const chunk = await db.prepare(`SELECT content FROM attachment_chunks WHERE attachment_id = ? AND chunk_index = ?`).bind(attachmentId, i).first();
    if (chunk && chunk.content) {
      content += chunk.content as string;
    }
  }
  
  return content;
}

/**
 * 删除邮件
 * @param db 数据库实例
 * @param id 邮件ID
 */
export async function deleteEmail(db: D1Database, id: string): Promise<void> {
  // [refactor] 由于外键设置了 ON DELETE CASCADE，直接删除邮件即可
  await db.prepare(`DELETE FROM emails WHERE id = ?`).bind(id).run();
}

/**
 * 将邮件标记为未读
 * @param db 数据库实例
 * @param id 邮件ID
 */
export async function markEmailAsUnread(db: D1Database, id: string): Promise<void> {
  await db.prepare(`UPDATE emails SET is_read = 0 WHERE id = ?`).bind(id).run();
}

/**
 * 批量删除邮件
 * @param db 数据库实例
 * @param emailIds 邮件ID数组
 */
export async function batchDeleteEmails(db: D1Database, emailIds: string[]): Promise<void> {
  if (emailIds.length === 0) return;
  const placeholders = emailIds.map(() => '?').join(',');
  await db.prepare(`DELETE FROM emails WHERE id IN (${placeholders})`).bind(...emailIds).run();
}

/**
 * 批量标记邮件为已读
 * @param db 数据库实例
 * @param emailIds 邮件ID数组
 */
export async function batchMarkEmailsAsRead(db: D1Database, emailIds: string[]): Promise<void> {
  if (emailIds.length === 0) return;
  const placeholders = emailIds.map(() => '?').join(',');
  await db.prepare(`UPDATE emails SET is_read = 1 WHERE id IN (${placeholders})`).bind(...emailIds).run();
}

/**
 * 批量标记邮件为未读
 * @param db 数据库实例
 * @param emailIds 邮件ID数组
 */
export async function batchMarkEmailsAsUnread(db: D1Database, emailIds: string[]): Promise<void> {
  if (emailIds.length === 0) return;
  const placeholders = emailIds.map(() => '?').join(',');
  await db.prepare(`UPDATE emails SET is_read = 0 WHERE id IN (${placeholders})`).bind(...emailIds).run();
}

/**
 * 获取邮箱总数
 * @param db 数据库实例
 * @returns 邮箱总数
 */
export async function getMailboxCount(db: D1Database): Promise<number> {
  const result = await db.prepare(`SELECT COUNT(*) as count FROM mailboxes`).first<{ count: number }>();
  return result?.count || 0;
}

/**
 * 获取指定IP在24小时内创建的邮箱数量
 * @param db 数据库实例
 * @param ipAddress IP地址
 * @returns 邮箱数量
 */
export async function getMailboxCountByIpLast24h(db: D1Database, ipAddress: string): Promise<number> {
  const now = getCurrentTimestamp();
  const oneDayAgo = now - (24 * 60 * 60);
  const result = await db.prepare(`SELECT COUNT(*) as count FROM mailboxes WHERE ip_address = ? AND created_at > ?`).bind(ipAddress, oneDayAgo).first<{ count: number }>();
  return result?.count || 0;
}

/**
 * 发送站内消息（写入独立的 chat_messages 表，双方各自一条，不进入收件箱）
 * 双方副本共用 msg_key；发送方副本额外缓存对方已读回执 peer_read/peer_read_at
 * @param db 数据库实例
 * @param fromMailbox 发件人邮箱
 * @param toMailbox 收件人邮箱
 * @param fromName 发件人显示名（地址）
 * @param content 消息内容
 * @param attachmentIds 附加到该消息的聊天附件ID（须已上传且属于发件人）
 * @returns 发件人侧保存的消息
 */
export async function sendInternalMessage(
  db: D1Database,
  fromMailbox: Mailbox,
  toMailbox: Mailbox,
  fromName: string,
  content: string,
  attachmentIds: string[] = []
): Promise<ChatMessage> {
  const now = getCurrentTimestamp();
  const msgKey = generateId();

  // 发件人侧副本：is_read=1（自己已读）；收件人侧副本：is_read=0（未读）
  const senderId = generateId();
  const receiverId = generateId();

  // 绑定附件（校验归属发件人且未被占用）
  if (attachmentIds.length > 0) {
    const placeholders = attachmentIds.map(() => '?').join(',');
    await db.prepare(
      `UPDATE chat_attachments SET msg_key = ? WHERE id IN (${placeholders}) AND mailbox_id = ? AND msg_key IS NULL`
    ).bind(msgKey, ...attachmentIds, fromMailbox.id).run();
  }

  // [encrypt] 地址使用确定性加密 + 盲索引；消息内容/发件人名使用 AES-GCM
  const [from, to, encryptedName, encryptedContent] = await Promise.all([
    protectAddress(fromMailbox.address),
    protectAddress(toMailbox.address),
    encryptText(fromName || ''),
    encryptText(content || ''),
  ]);

  // 两条写入合并在一次 batch 中，降低 D1 事务开销
  await db.batch([
    db.prepare(`INSERT INTO chat_messages (id, mailbox_id, from_address, from_hash, from_name, to_address, to_hash, content, created_at, is_read, read_at, msg_key, peer_read, peer_read_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
      .bind(senderId, fromMailbox.id, from.value, from.hash, encryptedName, to.value, to.hash, encryptedContent, now, 1, 0, msgKey, 0, 0),
    db.prepare(`INSERT INTO chat_messages (id, mailbox_id, from_address, from_hash, from_name, to_address, to_hash, content, created_at, is_read, read_at, msg_key, peer_read, peer_read_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
      .bind(receiverId, toMailbox.id, from.value, from.hash, encryptedName, to.value, to.hash, encryptedContent, now, 0, 0, msgKey, 0, 0),
  ]);

  console.log(`站内消息发送成功: ${fromMailbox.address} -> ${toMailbox.address}`);
  const attachments = Array.from((await getChatAttachmentsByMsgKeys(db, [msgKey])).values()).flat();
  return {
    id: senderId,
    fromAddress: fromMailbox.address,
    toAddress: toMailbox.address,
    fromName: fromName || '',
    subject: '站内消息',
    textContent: content,
    receivedAt: now,
    isRead: true,
    msgKey,
    attachments,
  };
}

/**
 * 获取与某用户之间的对话消息（轻量、增量查询，降低 D1 读取量）
 * @param db 数据库实例
 * @param mailboxId 当前邮箱ID
 * @param peerAddress 对方邮箱地址
 * @param since 若>0则只获取大于该时间戳的新消息（增量轮询）；为0则获取最近 limit 条
 * @param limit 单次最多返回条数
 * @returns 聊天消息列表（按时间升序）
 */
export async function getChatMessages(
  db: D1Database,
  mailboxId: string,
  peerAddress: string,
  since: number,
  limit: number
): Promise<ChatMessage[]> {
let rows: Array<{
    id: string;
    from_address: string;
    from_name: string;
    to_address: string;
    content: string;
    created_at: number;
    is_read: number | boolean;
    read_at: number;
    msg_key: string | null;
    peer_read: number | boolean;
    peer_read_at: number;
    edited_at: number;
  }> = [];

  // [encrypt] 地址列存密文，用盲索引匹配；同时保留明文匹配以兼容历史数据
  const peerHash = await blindIndexAddress(peerAddress);
  const peerPlain = normalizeAddress(peerAddress);
  const peerWhere = `(from_hash = ? OR to_hash = ? OR from_address = ? OR to_address = ?)`;

  if (since > 0) {
    // 增量轮询：新消息（created_at >= since）或该时间段内被编辑的消息（edited_at >= since）都会返回，客户端按 id 合并
    const res = await db.prepare(`
      SELECT id, from_address, from_name, to_address, content, created_at, is_read, read_at, msg_key, peer_read, peer_read_at, edited_at
      FROM chat_messages
      WHERE mailbox_id = ? AND ${peerWhere} AND (created_at >= ? OR edited_at >= ?)
      ORDER BY created_at ASC
      LIMIT ?
    `).bind(mailboxId, peerHash, peerHash, peerPlain, peerPlain, since, since, limit).all<{
      id: string;
      from_address: string;
      from_name: string;
      to_address: string;
      content: string;
      created_at: number;
      is_read: number | boolean;
      read_at: number;
      msg_key: string | null;
      peer_read: number | boolean;
      peer_read_at: number;
      edited_at: number;
    }>();
    rows = res.results || [];
  } else {
    // 初始加载：取最近 limit 条（先按时间倒序取，再升序返回）
    const res = await db.prepare(`
      SELECT id, from_address, from_name, to_address, content, created_at, is_read, read_at, msg_key, peer_read, peer_read_at, edited_at
      FROM chat_messages
      WHERE mailbox_id = ? AND ${peerWhere}
      ORDER BY created_at DESC
      LIMIT ?
    `).bind(mailboxId, peerHash, peerHash, peerPlain, peerPlain, limit).all<{
      id: string;
      from_address: string;
      from_name: string;
      to_address: string;
      content: string;
      created_at: number;
      is_read: number | boolean;
      read_at: number;
      msg_key: string | null;
      peer_read: number | boolean;
      peer_read_at: number;
      edited_at: number;
    }>();
    rows = (res.results || []).reverse();
  }

  if (rows.length === 0) return [];

  // 批量拉取这些消息关联的附件（按 msg_key），降低 D1 读取行数
  const keys = rows.filter(r => r.msg_key).map(r => r.msg_key as string);
  const attachmentMap = keys.length > 0 && keys.length <= 200
    ? await getChatAttachmentsByMsgKeys(db, keys)
    : new Map<string, ChatAttachmentListItem[]>();

  return Promise.all(rows.map(async r => ({
    id: r.id,
    fromAddress: await decryptAddress(r.from_address),
    toAddress: await decryptAddress(r.to_address),
    fromName: await decryptText(r.from_name || ''),
    subject: '',
    textContent: await decryptText(r.content || ''),
    receivedAt: r.created_at,
    isRead: !!r.is_read,
    readAt: r.read_at || 0,
    msgKey: r.msg_key || undefined,
    editedAt: r.edited_at || 0,
    peerRead: r.msg_key ? !!r.peer_read : false,
    peerReadAt: r.peer_read_at || 0,
    attachments: (r.msg_key && attachmentMap.get(r.msg_key)) || [],
  })));
}

/**
 * 获取该时段内被删除的站内消息 msg_key（用于对方增量轮询时移除本地副本）
 * @param db 数据库实例
 * @param since 只返回 deleted_at >= since 的删除记录
 * @returns 被删除的 msg_key 列表与最近删除时间（用于推进客户端的删除水位线）
 */
export async function getDeletedChatKeys(
  db: D1Database,
  since: number
): Promise<{ keys: string[]; maxDeletedAt: number }> {
  if (since <= 0) return { keys: [], maxDeletedAt: 0 };
  const res = await db.prepare(`
    SELECT msg_key, deleted_at FROM chat_deletions
    WHERE deleted_at >= ?
    ORDER BY deleted_at ASC
    LIMIT 500
  `).bind(since).all<{ msg_key: string; deleted_at: number }>();
  const rows = res.results || [];
  return {
    keys: rows.map(r => r.msg_key),
    maxDeletedAt: rows.reduce((m, r) => Math.max(m, r.deleted_at), 0),
  };
}

/**
 * 编辑一条站内消息（仅发送者可编辑，消息双方副本同步更新并记录编辑时间）
 * @param db 数据库实例
 * @param mailboxId 当前邮箱ID
 * @param address 当前邮箱地址（发送者）
 * @param peerAddress 对方邮箱地址
 * @param msgKey 消息关联键
 * @param newContent 新内容
 * @returns 编辑后的消息（发送者副本）；无权限或不存在返回 null
 */
export async function editInternalMessage(
  db: D1Database,
  mailboxId: string,
  address: string,
  peerAddress: string,
  msgKey: string,
  newContent: string
): Promise<ChatMessage | null> {
  // 必须存在"我发给该对方"的副本，才是可编辑的本人消息
  const myHash = await blindIndexAddress(address);
  const peerHash = await blindIndexAddress(peerAddress);
  const myPlain = normalizeAddress(address);
  const peerPlain = normalizeAddress(peerAddress);
  const own = await db.prepare(
    `SELECT 1 AS x FROM chat_messages WHERE msg_key = ? AND mailbox_id = ? AND ` +
    `((from_hash = ? AND to_hash = ?) OR (from_address = ? AND to_address = ?)) LIMIT 1`
  ).bind(msgKey, mailboxId, myHash, peerHash, myPlain, peerPlain).first();
  if (!own) return null;

  const now = getCurrentTimestamp();
  const encryptedContent = await encryptText(newContent);
  await db.prepare(`UPDATE chat_messages SET content = ?, edited_at = ? WHERE msg_key = ?`)
    .bind(encryptedContent, now, msgKey).run();

  const row = await db.prepare(
    `SELECT id, from_address, from_name, to_address, content, created_at, is_read, read_at, msg_key, peer_read, peer_read_at, edited_at
     FROM chat_messages WHERE msg_key = ? AND mailbox_id = ? LIMIT 1`
  ).bind(msgKey, mailboxId).first<{
    id: string; from_address: string; from_name: string; to_address: string;
    content: string; created_at: number; is_read: number | boolean; read_at: number;
    msg_key: string; peer_read: number | boolean; peer_read_at: number; edited_at: number;
  }>();
  if (!row) return null;

  const attachmentMap = await getChatAttachmentsByMsgKeys(db, [msgKey]);
  return {
    id: row.id,
    fromAddress: await decryptAddress(row.from_address),
    toAddress: await decryptAddress(row.to_address),
    fromName: await decryptText(row.from_name || ''),
    subject: '',
    textContent: await decryptText(row.content || ''),
    receivedAt: row.created_at,
    isRead: !!row.is_read,
    readAt: row.read_at || 0,
    msgKey: row.msg_key || undefined,
    editedAt: row.edited_at || 0,
    peerRead: row.msg_key ? !!row.peer_read : false,
    peerReadAt: row.peer_read_at || 0,
    attachments: (row.msg_key && attachmentMap.get(row.msg_key)) || [],
  };
}

/**
 * 删除一条站内消息（仅发送者可删除；双方副本连同附件一并删除，并写入删除墓碑供对方轮询移除）
 * @param db 数据库实例
 * @param mailboxId 当前邮箱ID
 * @param address 当前邮箱地址（发送者）
 * @param peerAddress 对方邮箱地址
 * @param msgKey 消息关联键
 * @returns 是否删除成功（本人无权限或不存在返回 false）
 */
export async function deleteChatMessage(
  db: D1Database,
  mailboxId: string,
  address: string,
  peerAddress: string,
  msgKey: string
): Promise<boolean> {
  const myHash = await blindIndexAddress(address);
  const peerHash = await blindIndexAddress(peerAddress);
  const myPlain = normalizeAddress(address);
  const peerPlain = normalizeAddress(peerAddress);
  const own = await db.prepare(
    `SELECT 1 AS x FROM chat_messages WHERE msg_key = ? AND mailbox_id = ? AND ` +
    `((from_hash = ? AND to_hash = ?) OR (from_address = ? AND to_address = ?)) LIMIT 1`
  ).bind(msgKey, mailboxId, myHash, peerHash, myPlain, peerPlain).first();
  if (!own) return false;

  await deleteChatAttachmentsByMsgKeys(db, [msgKey]);

  const now = getCurrentTimestamp();
  // 删除双方副本，同时写入墓碑（供对方轮询移除）并顺手清理7天前的旧墓碑
  await db.batch([
    db.prepare(`DELETE FROM chat_messages WHERE msg_key = ?`).bind(msgKey),
    db.prepare(`INSERT OR REPLACE INTO chat_deletions (msg_key, deleted_at) VALUES (?, ?)`).bind(msgKey, now),
    db.prepare(`DELETE FROM chat_deletions WHERE deleted_at < ?`).bind(now - 7 * 86400),
  ]);
  return true;
}

/**
 * 删除与某用户之间的站内消息（同时删除双方各自保存的副本）
 * @param db 数据库实例
 * @param myId 当前邮箱ID
 * @param myAddress 当前邮箱地址
 * @param peerId 对方邮箱ID
 * @param peerAddress 对方邮箱地址
 * @param afterTs 只删除该时间戳之后的消息（秒）；为0表示全部
 * @returns 删除的消息条数
 */
export async function deleteInternalMessages(
  db: D1Database,
  myId: string,
  myAddress: string,
  peerId: string,
  peerAddress: string,
  afterTs: number
): Promise<number> {
  // 双方各自删除 from/to 与双方匹配的站内消息
  const timeCond = afterTs > 0 ? ` AND created_at >= ${afterTs}` : '';
  const myHash = await blindIndexAddress(myAddress);
  const peerHash = await blindIndexAddress(peerAddress);
  const myPlain = normalizeAddress(myAddress);
  const peerPlain = normalizeAddress(peerAddress);
  // 同时匹配加密数据（盲索引）和历史明文数据
  const pairWhere = `((from_hash = ? AND to_hash = ?) OR (from_hash = ? AND to_hash = ?)
    OR (from_address = ? AND to_address = ?) OR (from_address = ? AND to_address = ?))`;

  // 先收集匹配的 msg_key，连带清理聊天附件（双方副本共用 msg_key，一次删除即覆盖双方）
  const keysRes = await db.prepare(`
    SELECT DISTINCT msg_key FROM chat_messages
    WHERE msg_key IS NOT NULL AND mailbox_id = ? AND ${pairWhere}${timeCond}
  `).bind(myId, myHash, peerHash, peerHash, myHash, myPlain, peerPlain, peerPlain, myPlain).all<{ msg_key: string }>();
  await deleteChatAttachmentsByMsgKeys(db, (keysRes.results || []).map(r => r.msg_key));

  const myRes = await db.prepare(`
    DELETE FROM chat_messages
    WHERE mailbox_id = ? AND ${pairWhere}${timeCond}
  `).bind(myId, myHash, peerHash, peerHash, myHash, myPlain, peerPlain, peerPlain, myPlain).run();

  const peerRes = await db.prepare(`
    DELETE FROM chat_messages
    WHERE mailbox_id = ? AND ${pairWhere}${timeCond}
  `).bind(peerId, myHash, peerHash, peerHash, myHash, myPlain, peerPlain, peerPlain, myPlain).run();

  const deleted = (myRes.meta?.changes || 0) + (peerRes.meta?.changes || 0);
  console.log(`清理站内聊天记录: ${deleted} 条（${myAddress} <-> ${peerAddress}${afterTs > 0 ? `, 自 ${afterTs} 起` : ', 全部'}）`);
  return deleted;
}

/**
 * 获取当前邮箱的站内会话列表（最近的对话 = 谁发来、发了什么、几条未读）
 * @param db 数据库实例
 * @param mailboxId 当前邮箱ID
 * @param myAddress 当前邮箱地址
 * @param limit 最多扫描的消息条数（用于聚合最近会话）
 */
export async function getChatConversations(
  db: D1Database,
  mailboxId: string,
  myAddress: string,
  limit = 200
): Promise<ChatConversation[]> {
  // 取最近的消息，聚合出每个对方最近一条内容
  const res = await db.prepare(`
    SELECT from_address, to_address, content, created_at
    FROM chat_messages
    WHERE mailbox_id = ?
    ORDER BY created_at DESC
    LIMIT ?
  `).bind(mailboxId, limit).all<{
    from_address: string;
    to_address: string;
    content: string;
    created_at: number;
  }>();
  const rows = await Promise.all((res.results || []).map(async r => ({
    fromAddress: await decryptAddress(r.from_address),
    toAddress: await decryptAddress(r.to_address),
    content: await decryptText(r.content),
    createdAt: r.created_at,
  })));
  const myPlain = normalizeAddress(myAddress);

  const latest = new Map<string, { lastMessage: string; lastAt: number }>();
  for (const r of rows) {
    const peer = r.fromAddress === myPlain ? r.toAddress : r.fromAddress;
    if (!peer || peer === myPlain) continue;
    if (!latest.has(peer)) {
      latest.set(peer, { lastMessage: r.content || '', lastAt: r.createdAt });
    }
  }

  // 对方发来的未读数（加密后同一地址密文相同，GROUP BY 仍然有效）
  const unreadRes = await db.prepare(`
    SELECT from_address, COUNT(*) AS cnt
    FROM chat_messages
    WHERE mailbox_id = ? AND is_read = 0
    GROUP BY from_address
  `).bind(mailboxId).all<{ from_address: string; cnt: number }>();
  const unreadMap = new Map<string, number>();
  for (const u of unreadRes.results || []) {
    unreadMap.set(await decryptAddress(u.from_address), u.cnt);
  }

  const conversations: ChatConversation[] = [...latest.entries()].map(([peer, info]) => ({
    peer,
    lastMessage: info.lastMessage,
    lastAt: info.lastAt,
    unreadCount: unreadMap.get(peer) || 0,
  }));

  conversations.sort((a, b) => b.lastAt - a.lastAt);
  return conversations;
}

/**
 * 将某用户发给我的聊天消息标记为已读（打开聊天时调用，并记录阅读时间供回执使用）
 * @param db 数据库实例
 * @param mailboxId 当前邮箱ID
 * @param peerAddress 对方邮箱地址
 */
export async function markChatRead(db: D1Database, mailboxId: string, peerAddress: string): Promise<void> {
  const now = getCurrentTimestamp();
  const peerHash = await blindIndexAddress(peerAddress);
  const peerPlain = normalizeAddress(peerAddress);
  await db.prepare(`UPDATE chat_messages SET is_read = 1, read_at = CASE WHEN read_at = 0 THEN ? ELSE read_at END WHERE mailbox_id = ? AND (from_hash = ? OR from_address = ?) AND is_read = 0`)
    .bind(now, mailboxId, peerHash, peerPlain).run();
}

/**
 * 批量将指定的聊天消息标记为已读并记录阅读时间（已读回执上报，节流由调用方控制）
 * @param db 数据库实例
 * @param mailboxId 当前邮箱ID
 * @param messageIds 消息ID列表（须属于该邮箱）
 * @param readAt 阅读时间戳（秒）
 */
export async function markChatMessagesRead(
  db: D1Database,
  mailboxId: string,
  messageIds: string[],
  readAt: number
): Promise<number> {
  if (messageIds.length === 0) return 0;
  const placeholders = messageIds.map(() => '?').join(',');
  const result = await db.prepare(
    `UPDATE chat_messages SET is_read = 1, read_at = CASE WHEN read_at = 0 THEN ? ELSE read_at END WHERE mailbox_id = ? AND id IN (${placeholders}) AND is_read = 0`
  ).bind(readAt, mailboxId, ...messageIds).run();
  return result.meta?.changes || 0;
}

/**
 * 保存一份聊天附件（含大附件分块，与邮件附件相同的分块策略）
 * @param db 数据库实例
 * @param mailboxId 归属邮箱ID（上传者）
 * @param params 附件参数
 * @returns 附件列表项
 */
export async function saveChatAttachment(
  db: D1Database,
  mailboxId: string,
  params: SaveChatAttachmentParams
): Promise<ChatAttachmentListItem> {
  const now = getCurrentTimestamp();
  const attachmentId = generateId();
  const cleanFilename = params.filename.replace(/[\\\/\r\n]/g, '').slice(0, 200) || 'attachment';

  // [encrypt] 附件内容与文件名加密后再入库
  const [encryptedContent, encryptedFilename] = await Promise.all([
    encryptText(params.content),
    encryptText(cleanFilename),
  ]);
  const isLarge = encryptedContent.length > CHUNK_SIZE;

  if (isLarge) {
    const contentLength = encryptedContent.length;
    const chunksCount = Math.ceil(contentLength / CHUNK_SIZE);
    await db.prepare(`INSERT INTO chat_attachments (id, mailbox_id, msg_key, filename, mime_type, content, size, is_large, chunks_count, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
      .bind(attachmentId, mailboxId, null, encryptedFilename, params.mimeType, '', params.size, 1, chunksCount, now).run();
    for (let i = 0; i < chunksCount; i++) {
      const start = i * CHUNK_SIZE;
      const end = Math.min(start + CHUNK_SIZE, contentLength);
      await db.prepare(`INSERT INTO chat_attachment_chunks (id, attachment_id, chunk_index, content) VALUES (?, ?, ?, ?)`)
        .bind(generateId(), attachmentId, i, encryptedContent.substring(start, end)).run();
    }
  } else {
    await db.prepare(`INSERT INTO chat_attachments (id, mailbox_id, msg_key, filename, mime_type, content, size, is_large, chunks_count, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
      .bind(attachmentId, mailboxId, null, encryptedFilename, params.mimeType, encryptedContent, params.size, 0, 0, now).run();
  }

  return { id: attachmentId, filename: cleanFilename, mimeType: params.mimeType, size: params.size };
}

/**
 * 按 msg_key 批量获取聊天附件（键与双方副本一致，一次查询拉取对话内的所有附件，降低 D1 读取行数）
 * @param db 数据库实例
 * @param msgKeys 消息关联键列表
 * @returns 附件列表（按 msgKey 分组）
 */
export async function getChatAttachmentsByMsgKeys(
  db: D1Database,
  msgKeys: string[]
): Promise<Map<string, ChatAttachmentListItem[]>> {
  const map = new Map<string, ChatAttachmentListItem[]>();
  if (msgKeys.length === 0) return map;
  const placeholders = msgKeys.map(() => '?').join(',');
  const res = await db.prepare(
    `SELECT id, filename, mime_type, size, msg_key FROM chat_attachments WHERE msg_key IN (${placeholders})`
  ).bind(...msgKeys).all<{ id: string; filename: string; mime_type: string; size: number; msg_key: string }>();
  for (const r of res.results || []) {
    const list = map.get(r.msg_key) || [];
    list.push({ id: r.id, filename: await decryptText(r.filename), mimeType: r.mime_type, size: r.size });
    map.set(r.msg_key, list);
  }
  return map;
}

/**
 * 获取聊天附件详情（含内容，用于下载）
 * @param db 数据库实例
 * @param id 附件ID
 * @returns 附件详情
 */
export async function getChatAttachment(db: D1Database, id: string): Promise<ChatAttachment | null> {
  const result = await db.prepare(`SELECT id, mailbox_id, msg_key, filename, mime_type, content, size, is_large, chunks_count, created_at FROM chat_attachments WHERE id = ?`).bind(id).first();
  if (!result) return null;

  let content = result.content as string;
  if (result.is_large) {
    const chunksCount = result.chunks_count as number;
    let joined = '';
    for (let i = 0; i < chunksCount; i++) {
      const chunk = await db.prepare(`SELECT content FROM chat_attachment_chunks WHERE attachment_id = ? AND chunk_index = ?`).bind(id, i).first();
      if (chunk && chunk.content) joined += chunk.content as string;
    }
    content = joined;
  }

  return {
    id: result.id as string,
    mailboxId: result.mailbox_id as string,
    msgKey: (result.msg_key as string) || null,
    filename: await decryptText(result.filename as string),
    mimeType: result.mime_type as string,
    content: await decryptText(content),
    size: result.size as number,
    createdAt: result.created_at as number,
  };
}

/**
 * 判断当前用户是否有权访问某聊天附件（上传者本人，或该附件所关联消息的收发双方）
 * @param db 数据库实例
 * @param attachmentId 附件ID
 * @param requesterMailboxId 访问者邮箱ID
 * @returns 是否有权访问
 */
export async function canAccessChatAttachment(
  db: D1Database,
  attachmentId: string,
  requesterMailboxId: string
): Promise<boolean> {
  const attachment = await db.prepare(`SELECT mailbox_id, msg_key FROM chat_attachments WHERE id = ?`).bind(attachmentId).first<{ mailbox_id: string; msg_key: string | null }>();
  if (!attachment) return false;
  if (attachment.mailbox_id === requesterMailboxId) return true;
  if (!attachment.msg_key) return false;
  // 未绑定归属判断：消息收发双方均可见
  const msg = await db.prepare(`SELECT 1 AS x FROM chat_messages WHERE msg_key = ? AND mailbox_id = ?`).bind(attachment.msg_key, requesterMailboxId).first();
  return !!msg;
}

/**
 * 清理与一组 msg_key 关联的聊天附件（删除附件记录及分块）
 * @param db 数据库实例
 * @param msgKeys 消息关联键列表
 */
async function deleteChatAttachmentsByMsgKeys(db: D1Database, msgKeys: string[]): Promise<void> {
  if (msgKeys.length === 0) return;
  const keyPlaceholders = msgKeys.map(() => '?').join(',');
  const attRes = await db.prepare(`SELECT id FROM chat_attachments WHERE msg_key IN (${keyPlaceholders})`).bind(...msgKeys).all<{ id: string }>();
  const ids = (attRes.results || []).map(r => r.id);
  if (ids.length > 0) {
    const idPlaceholders = ids.map(() => '?').join(',');
    await db.prepare(`DELETE FROM chat_attachment_chunks WHERE attachment_id IN (${idPlaceholders})`).bind(...ids).run();
  }
  await db.prepare(`DELETE FROM chat_attachments WHERE msg_key IN (${keyPlaceholders})`).bind(...msgKeys).run();
}

/**
 * 已读回执同步：上报我读过的消息 + 下载对方是否已读我的消息（每小时一次，节流）
 * 未到同步周期时仅返回当前缓存的已读回执，不产生任何 D1 写入
 * @param db 数据库实例
 * @param myId 当前邮箱ID
 * @param myAddress 当前邮箱地址
 * @param reportedReadIds 我在当前会话中已查看的消息ID列表
 * @returns 同步结果与已读回执列表
 */
export async function syncChatReadStatus(
  db: D1Database,
  myId: string,
  myAddress: string,
  reportedReadIds: string[]
): Promise<{ synced: boolean; syncAt: number; readReceipts: ReadReceipt[] }> {
  const now = getCurrentTimestamp();
  const HOUR = 3600;

  const state = await db.prepare(`SELECT last_sync_at FROM chat_sync_state WHERE mailbox_id = ?`).bind(myId).first<{ last_sync_at: number }>();
  const lastSync = state?.last_sync_at || 0;
  const due = now - lastSync >= HOUR;
  const syncAt = due ? now : lastSync;

  const myHash = await blindIndexAddress(myAddress);
  const myPlain = normalizeAddress(myAddress);

  if (due) {
    // 1. 上报：把我已打开/已读的消息标记为已读并记录时间
    if (reportedReadIds.length > 0) {
      await markChatMessagesRead(db, myId, reportedReadIds, now);
    }

    // 2. 下载：对方副本中标记已读的消息回填到我方副本（有索引(from_hash, mailbox_id)、(msg_key)）
    const receivers = await db.prepare(`
      SELECT msg_key, to_address AS peer, read_at
      FROM chat_messages
      WHERE (from_hash = ? OR from_address = ?) AND mailbox_id != ? AND is_read = 1 AND msg_key IS NOT NULL
    `).bind(myHash, myPlain, myId).all<{ msg_key: string; peer: string; read_at: number }>();

    const readByKey = new Map<string, number>();
    for (const r of receivers.results || []) {
      if (r.msg_key && !readByKey.has(r.msg_key)) readByKey.set(r.msg_key, r.read_at);
    }

    const updateStmts: ReturnType<D1Database['prepare']>[] = [];
    for (const [key, readAt] of readByKey) {
      updateStmts.push(
        db.prepare(`UPDATE chat_messages SET peer_read = 1, peer_read_at = ? WHERE mailbox_id = ? AND msg_key = ? AND (from_hash = ? OR from_address = ?)`)
          .bind(readAt, myId, key, myHash, myPlain)
      );
    }
    if (updateStmts.length > 0) {
      await db.batch(updateStmts);
    }

    // 3. 记录同步时间（节流）
    await db.prepare(`INSERT INTO chat_sync_state (mailbox_id, last_sync_at) VALUES (?, ?)
      ON CONFLICT(mailbox_id) DO UPDATE SET last_sync_at = excluded.last_sync_at`).bind(myId, now).run();
  }

  // 读取当前最佳已知的已读回执（发送方本地缓存，仅限我发出的消息，最多最近500条）
  const mySent = await db.prepare(`
    SELECT msg_key, to_address AS peer, peer_read, peer_read_at
    FROM chat_messages
    WHERE mailbox_id = ? AND (from_hash = ? OR from_address = ?) AND msg_key IS NOT NULL
    ORDER BY created_at DESC
    LIMIT 500
  `).bind(myId, myHash, myPlain).all<{ msg_key: string; peer: string; peer_read: number | boolean; peer_read_at: number }>();

  const readReceipts: ReadReceipt[] = await Promise.all((mySent.results || []).map(async r => ({
    msgKey: r.msg_key,
    peer: await decryptAddress(r.peer),
    read: !!r.peer_read,
    readAt: r.peer_read_at || 0,
  })));

  return { synced: due, syncAt, readReceipts };
}

/**
 * 获取当前邮箱未读站内消息数量（用于角标/提示条）
 * @param db 数据库实例
 * @param mailboxId 当前邮箱ID
 * @returns 未读数量
 */
export async function getUnreadChatCount(db: D1Database, mailboxId: string): Promise<number> {
  const result = await db.prepare(`SELECT COUNT(*) as count FROM chat_messages WHERE mailbox_id = ? AND is_read = 0`)
    .bind(mailboxId).first<{ count: number }>();
  return result?.count || 0;
}

/**
 * 速率限制：统计窗口内该键（IP+动作）的已有次数，达到上限则返回 true（限流），否则记录一次
 * @param db 数据库实例
 * @param key 统计键（如 "login:218.x.x.x"、"send:foo@domain"）
 * @param windowSeconds 时间窗口（秒）
 * @param maxCount 窗口内允许的最大次数
 * @returns 是否已限流
 */
export async function enforceRateLimit(db: D1Database, key: string, windowSeconds: number, maxCount: number): Promise<boolean> {
  const now = getCurrentTimestamp();
  const cutoff = now - windowSeconds;
  const result = await db.prepare(`SELECT COUNT(*) AS count FROM rate_events WHERE ip = ? AND created_at >= ?`)
    .bind(key, cutoff).first<{ count: number }>();
  if ((result?.count || 0) >= maxCount) return true;
  await db.prepare(`INSERT INTO rate_events (ip, action, created_at) VALUES (?, ?, ?)`)
    .bind(key, 'rate', now).run();
  return false;
}

/**
 * 清理过期的速率限制记录（由定时任务调用，防表膨胀）
 * @param db 数据库实例
 * @param keepSeconds 保留最近多少秒（默认24小时）
 */
export async function cleanupRateEvents(db: D1Database, keepSeconds = 86400): Promise<void> {
  const cutoff = getCurrentTimestamp() - keepSeconds;
  await db.prepare(`DELETE FROM rate_events WHERE created_at < ?`).bind(cutoff).run();
}

/**
 * 验证邮箱密码（不更新 last_accessed，节省 D1 写入；用于发信鉴权等热路径）
 * @param db 数据库实例
 * @param address 邮箱地址
 * @param password 密码
 * @returns 验证通过返回邮箱信息，否则 null
 */
export async function verifyMailboxPassword(db: D1Database, address: string, password: string): Promise<Mailbox | null> {
  const result = await findMailboxRow(db, address);
  if (!result) return null;

  const storedPassword = result.password;
  const ok = await verifyPassword(password, storedPassword);
  if (!ok) return null;

  // 旧版明文密码懒迁移升级为哈希
  if (!storedPassword.startsWith(PASSWORD_HASH_PREFIX)) {
    const hashedPassword = await hashPassword(password);
    await db.prepare(`UPDATE mailboxes SET password = ? WHERE id = ?`).bind(hashedPassword, result.id).run();
  }

  const plainAddress = await ensureMailboxAddressEncrypted(db, result);

  return {
    id: result.id,
    address: plainAddress,
    password: storedPassword,
    createdAt: result.created_at,
    expiresAt: result.expires_at,
    ipAddress: result.ip_address,
    lastAccessed: result.last_accessed,
  };
}

// ============================================================================
// 历史数据加密迁移（管理接口使用，按批次执行，避免单次请求 CPU 超时）
// ============================================================================

export interface EncryptionMigrationResult {
  mailboxes: number;
  emails: number;
  chatMessages: number;
  attachments: number;
  chatAttachments: number;
}

export interface EncryptionStatus {
  enabled: boolean;
  pending: EncryptionMigrationResult;
  skipped: EncryptionMigrationResult;
}

// 迁移游标：按主键向前推进，避免个别解密失败的行永远占住批次头部导致后续数据无法迁移
async function getMigrationCursor(db: D1Database, category: string): Promise<string> {
  const row = await db.prepare(`SELECT value FROM app_meta WHERE key = ?`)
    .bind(`encrypt_cursor:${category}`)
    .first<{ value: string }>();
  return row?.value || '';
}

async function setMigrationCursor(db: D1Database, category: string, value: string): Promise<void> {
  await db.prepare(`INSERT OR REPLACE INTO app_meta (key, value) VALUES (?, ?)`)
    .bind(`encrypt_cursor:${category}`, value).run();
}

/** 记录无法自动迁移的行（解密失败 / 数据损坏），避免反复占用迁移批次 */
async function markEncryptionSkipped(db: D1Database, category: string, rowId: string, reason: string): Promise<void> {
  await db.prepare(`INSERT OR REPLACE INTO encryption_skipped (category, row_id, reason, created_at) VALUES (?, ?, ?, ?)`)
    .bind(category, rowId, reason.slice(0, 200), getCurrentTimestamp()).run();
}

function nextMigrationCursor(rows: Array<{ id: string }>, limit: number): string {
  if (rows.length === 0 || rows.length < limit) return '';
  return rows[rows.length - 1].id;
}

/** 统计尚未加密的历史数据量（排除已记录为无法迁移的行） */
export async function getEncryptionStatus(db: D1Database): Promise<EncryptionStatus> {
  const pending: EncryptionMigrationResult = {
    mailboxes: 0,
    emails: 0,
    chatMessages: 0,
    attachments: 0,
    chatAttachments: 0,
  };
  const skipped: EncryptionMigrationResult = {
    mailboxes: 0,
    emails: 0,
    chatMessages: 0,
    attachments: 0,
    chatAttachments: 0,
  };

  const countOf = async (sql: string): Promise<number> => {
    const row = await db.prepare(sql).first<{ count: number }>();
    return row?.count || 0;
  };

  const notSkipped = (category: string) =>
    `id NOT IN (SELECT row_id FROM encryption_skipped WHERE category = '${category}')`;

  pending.mailboxes = await countOf(`SELECT COUNT(*) AS count FROM mailboxes WHERE (address_hash IS NULL OR address NOT LIKE 'encd:v1:%') AND ${notSkipped('mailboxes')}`);
  pending.emails = await countOf(`SELECT COUNT(*) AS count FROM emails WHERE (from_hash IS NULL OR to_hash IS NULL OR from_address NOT LIKE 'encd:v1:%' OR to_address NOT LIKE 'encd:v1:%' OR (subject <> '' AND subject NOT LIKE 'enc:v1:%') OR (text_content <> '' AND text_content NOT LIKE 'enc:v1:%') OR (html_content <> '' AND html_content NOT LIKE 'enc:v1:%') OR (from_name <> '' AND from_name NOT LIKE 'enc:v1:%')) AND ${notSkipped('emails')}`);
  pending.chatMessages = await countOf(`SELECT COUNT(*) AS count FROM chat_messages WHERE (from_hash IS NULL OR to_hash IS NULL OR from_address NOT LIKE 'encd:v1:%' OR to_address NOT LIKE 'encd:v1:%' OR (content <> '' AND content NOT LIKE 'enc:v1:%') OR (from_name <> '' AND from_name NOT LIKE 'enc:v1:%')) AND ${notSkipped('chatMessages')}`);
  pending.attachments = await countOf(`SELECT COUNT(*) AS count FROM attachments WHERE (filename NOT LIKE 'enc:v1:%' OR (is_large = 0 AND content <> '' AND content NOT LIKE 'enc:v1:%')) AND ${notSkipped('attachments')}`);
  pending.chatAttachments = await countOf(`SELECT COUNT(*) AS count FROM chat_attachments WHERE (filename NOT LIKE 'enc:v1:%' OR (is_large = 0 AND content <> '' AND content NOT LIKE 'enc:v1:%')) AND ${notSkipped('chatAttachments')}`);

  for (const category of Object.keys(skipped) as Array<keyof EncryptionMigrationResult>) {
    skipped[category] = await countOf(`SELECT COUNT(*) AS count FROM encryption_skipped WHERE category = '${category}'`);
  }

  return { enabled: isEncryptionEnabled(), pending, skipped };
}

/**
 * 加密一批历史数据（每类最多 limit 条）。
 * 需要先配置 MAIL_ENCRYPTION_KEY，否则会抛出错误。
 */
export async function encryptLegacyBatch(db: D1Database, limit = 20): Promise<EncryptionMigrationResult> {
  if (!isEncryptionEnabled()) {
    throw new Error('未配置 MAIL_ENCRYPTION_KEY，无法执行加密迁移');
  }

  const safeLimit = Math.max(1, Math.min(limit, 50));
  const result: EncryptionMigrationResult = {
    mailboxes: 0,
    emails: 0,
    chatMessages: 0,
    attachments: 0,
    chatAttachments: 0,
  };

  // 1. 邮箱地址
  const mailboxCursor = await getMigrationCursor(db, 'mailboxes');
  const mailboxes = await db.prepare(
    `SELECT id, address, address_hash FROM mailboxes
     WHERE (address_hash IS NULL OR address NOT LIKE 'encd:v1:%')
       AND id NOT IN (SELECT row_id FROM encryption_skipped WHERE category = 'mailboxes')
       AND id > ?
     ORDER BY id LIMIT ?`
  ).bind(mailboxCursor, safeLimit).all<{ id: string; address: string; address_hash: string | null }>();
  for (const row of mailboxes.results || []) {
    const plain = await decryptAddress(row.address);
    if (!plain || isDecryptionFailure(plain)) {
      await markEncryptionSkipped(db, 'mailboxes', row.id, plain || 'decrypt failed');
      continue;
    }
    const protectedAddress = await protectAddress(plain);
    await db.prepare(`UPDATE mailboxes SET address = ?, address_hash = ? WHERE id = ?`)
      .bind(protectedAddress.value, protectedAddress.hash, row.id).run();
    result.mailboxes++;
  }
  await setMigrationCursor(db, 'mailboxes', nextMigrationCursor(mailboxes.results || [], safeLimit));

  // 2. 邮件
  const emailCursor = await getMigrationCursor(db, 'emails');
  const emails = await db.prepare(
    `SELECT id, from_address, from_name, to_address, subject, text_content, html_content FROM emails
     WHERE (from_hash IS NULL OR to_hash IS NULL OR from_address NOT LIKE 'encd:v1:%' OR to_address NOT LIKE 'encd:v1:%'
        OR (subject <> '' AND subject NOT LIKE 'enc:v1:%')
        OR (text_content <> '' AND text_content NOT LIKE 'enc:v1:%')
        OR (html_content <> '' AND html_content NOT LIKE 'enc:v1:%')
        OR (from_name <> '' AND from_name NOT LIKE 'enc:v1:%'))
       AND id NOT IN (SELECT row_id FROM encryption_skipped WHERE category = 'emails')
       AND id > ?
     ORDER BY id LIMIT ?`
  ).bind(emailCursor, safeLimit).all<{
    id: string; from_address: string; from_name: string; to_address: string;
    subject: string; text_content: string; html_content: string;
  }>();
  for (const row of emails.results || []) {
    const [fromPlain, toPlain, fromNamePlain, subjectPlain, textPlain, htmlPlain] = await Promise.all([
      decryptAddress(row.from_address),
      decryptAddress(row.to_address),
      decryptText(row.from_name),
      decryptText(row.subject),
      decryptText(row.text_content),
      decryptText(row.html_content),
    ]);
    if ([fromPlain, toPlain, fromNamePlain, subjectPlain, textPlain, htmlPlain].some(isDecryptionFailure)) {
      await markEncryptionSkipped(db, 'emails', row.id, 'decrypt failed');
      continue;
    }

    const [from, to] = await Promise.all([
      protectAddress(fromPlain),
      protectAddress(toPlain),
    ]);
    const [fromName, subject, textContent, htmlContent] = await Promise.all([
      encryptText(fromNamePlain),
      encryptText(subjectPlain),
      encryptText(textPlain),
      encryptText(htmlPlain),
    ]);
    await db.prepare(`UPDATE emails SET from_address = ?, from_hash = ?, from_name = ?, to_address = ?, to_hash = ?, subject = ?, text_content = ?, html_content = ? WHERE id = ?`)
      .bind(from.value, from.hash, fromName, to.value, to.hash, subject, textContent, htmlContent, row.id).run();
    result.emails++;
  }
  await setMigrationCursor(db, 'emails', nextMigrationCursor(emails.results || [], safeLimit));

  // 3. 站内聊天消息
  const chatCursor = await getMigrationCursor(db, 'chatMessages');
  const chatMessages = await db.prepare(
    `SELECT id, from_address, from_name, to_address, content FROM chat_messages
     WHERE (from_hash IS NULL OR to_hash IS NULL OR from_address NOT LIKE 'encd:v1:%' OR to_address NOT LIKE 'encd:v1:%'
        OR (content <> '' AND content NOT LIKE 'enc:v1:%')
        OR (from_name <> '' AND from_name NOT LIKE 'enc:v1:%'))
       AND id NOT IN (SELECT row_id FROM encryption_skipped WHERE category = 'chatMessages')
       AND id > ?
     ORDER BY id LIMIT ?`
  ).bind(chatCursor, safeLimit).all<{ id: string; from_address: string; from_name: string; to_address: string; content: string }>();
  for (const row of chatMessages.results || []) {
    const [fromPlain, toPlain, fromNamePlain, contentPlain] = await Promise.all([
      decryptAddress(row.from_address),
      decryptAddress(row.to_address),
      decryptText(row.from_name),
      decryptText(row.content),
    ]);
    if ([fromPlain, toPlain, fromNamePlain, contentPlain].some(isDecryptionFailure)) {
      await markEncryptionSkipped(db, 'chatMessages', row.id, 'decrypt failed');
      continue;
    }

    const [from, to] = await Promise.all([
      protectAddress(fromPlain),
      protectAddress(toPlain),
    ]);
    const [fromName, content] = await Promise.all([
      encryptText(fromNamePlain),
      encryptText(contentPlain),
    ]);
    await db.prepare(`UPDATE chat_messages SET from_address = ?, from_hash = ?, from_name = ?, to_address = ?, to_hash = ?, content = ? WHERE id = ?`)
      .bind(from.value, from.hash, fromName, to.value, to.hash, content, row.id).run();
    result.chatMessages++;
  }
  await setMigrationCursor(db, 'chatMessages', nextMigrationCursor(chatMessages.results || [], safeLimit));

  // 4. 邮件附件
  const attachmentCursor = await getMigrationCursor(db, 'attachments');
  const attachments = await db.prepare(
    `SELECT id, filename, content, is_large, chunks_count FROM attachments
     WHERE (filename NOT LIKE 'enc:v1:%' OR (is_large = 0 AND content <> '' AND content NOT LIKE 'enc:v1:%'))
       AND id NOT IN (SELECT row_id FROM encryption_skipped WHERE category = 'attachments')
       AND id > ?
     ORDER BY id LIMIT ?`
  ).bind(attachmentCursor, safeLimit).all<{ id: string; filename: string; content: string; is_large: number | boolean; chunks_count: number }>();
  for (const row of attachments.results || []) {
    const isLarge = !!row.is_large;
    let plainContent = await decryptText(row.content);
    if (isLarge) {
      plainContent = await getAttachmentContent(db, row.id, row.chunks_count);
      plainContent = await decryptText(plainContent);
    }
    const plainFilename = await decryptText(row.filename);
    if (isDecryptionFailure(plainContent) || isDecryptionFailure(plainFilename)) {
      await markEncryptionSkipped(db, 'attachments', row.id, 'decrypt failed');
      continue;
    }

    const encryptedFilename = await encryptText(plainFilename);
    const encryptedContent = await encryptText(plainContent);
    const newChunks = encryptedContent.length > CHUNK_SIZE ? Math.ceil(encryptedContent.length / CHUNK_SIZE) : 0;

    await db.prepare(`DELETE FROM attachment_chunks WHERE attachment_id = ?`).bind(row.id).run();
    if (newChunks > 0) {
      for (let i = 0; i < newChunks; i++) {
        const start = i * CHUNK_SIZE;
        const end = Math.min(start + CHUNK_SIZE, encryptedContent.length);
        await db.prepare(`INSERT INTO attachment_chunks (id, attachment_id, chunk_index, content) VALUES (?, ?, ?, ?)`)
          .bind(generateId(), row.id, i, encryptedContent.substring(start, end)).run();
      }
    }
    await db.prepare(`UPDATE attachments SET filename = ?, content = ?, is_large = ?, chunks_count = ? WHERE id = ?`)
      .bind(encryptedFilename, newChunks > 0 ? '' : encryptedContent, newChunks > 0 ? 1 : 0, newChunks, row.id).run();
    result.attachments++;
  }
  await setMigrationCursor(db, 'attachments', nextMigrationCursor(attachments.results || [], safeLimit));

  // 5. 站内聊天附件
  const chatAttachmentCursor = await getMigrationCursor(db, 'chatAttachments');
  const chatAttachments = await db.prepare(
    `SELECT id, filename, content, is_large, chunks_count FROM chat_attachments
     WHERE (filename NOT LIKE 'enc:v1:%' OR (is_large = 0 AND content <> '' AND content NOT LIKE 'enc:v1:%'))
       AND id NOT IN (SELECT row_id FROM encryption_skipped WHERE category = 'chatAttachments')
       AND id > ?
     ORDER BY id LIMIT ?`
  ).bind(chatAttachmentCursor, safeLimit).all<{ id: string; filename: string; content: string; is_large: number | boolean; chunks_count: number }>();
  for (const row of chatAttachments.results || []) {
    const isLarge = !!row.is_large;
    let plainContent = await decryptText(row.content);
    if (isLarge) {
      let joined = '';
      for (let i = 0; i < row.chunks_count; i++) {
        const chunk = await db.prepare(`SELECT content FROM chat_attachment_chunks WHERE attachment_id = ? AND chunk_index = ?`).bind(row.id, i).first();
        if (chunk && chunk.content) joined += chunk.content as string;
      }
      plainContent = await decryptText(joined);
    }
    const plainFilename = await decryptText(row.filename);
    if (isDecryptionFailure(plainContent) || isDecryptionFailure(plainFilename)) {
      await markEncryptionSkipped(db, 'chatAttachments', row.id, 'decrypt failed');
      continue;
    }

    const encryptedFilename = await encryptText(plainFilename);
    const encryptedContent = await encryptText(plainContent);
    const newChunks = encryptedContent.length > CHUNK_SIZE ? Math.ceil(encryptedContent.length / CHUNK_SIZE) : 0;

    await db.prepare(`DELETE FROM chat_attachment_chunks WHERE attachment_id = ?`).bind(row.id).run();
    if (newChunks > 0) {
      for (let i = 0; i < newChunks; i++) {
        const start = i * CHUNK_SIZE;
        const end = Math.min(start + CHUNK_SIZE, encryptedContent.length);
        await db.prepare(`INSERT INTO chat_attachment_chunks (id, attachment_id, chunk_index, content) VALUES (?, ?, ?, ?)`)
          .bind(generateId(), row.id, i, encryptedContent.substring(start, end)).run();
      }
    }
    await db.prepare(`UPDATE chat_attachments SET filename = ?, content = ?, is_large = ?, chunks_count = ? WHERE id = ?`)
      .bind(encryptedFilename, newChunks > 0 ? '' : encryptedContent, newChunks > 0 ? 1 : 0, newChunks, row.id).run();
    result.chatAttachments++;
  }
  await setMigrationCursor(db, 'chatAttachments', nextMigrationCursor(chatAttachments.results || [], safeLimit));

  return result;
}