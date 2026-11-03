/**
 * 应用层加密工具（D1 静态数据保护）
 *
 * 设计目标：
 * 1. 即使攻击者拿到 D1 数据库导出文件（或 Cloudflare 账号被只读入侵），
 *    也无法直接看到邮箱地址、邮件正文、附件内容、站内聊天内容。
 * 2. 邮箱地址需要支持等值查询，因此采用“确定性加密 + HMAC 盲索引”：
 *    - 数据库保存密文（encd:v1:...）
 *    - 另存 HMAC 盲索引（bidx:v1:...）用于 WHERE 查询
 *    - 同一个地址始终得到相同密文/索引，但不知道密钥无法还原
 * 3. 其它内容字段使用随机 IV 的 AES-256-GCM，防止相同内容被识别。
 *
 * 密钥只放在 Worker Secret（MAIL_ENCRYPTION_KEY），不写入 D1、不写入代码仓库。
 * 注意：密钥丢失后数据不可恢复，请务必备份密钥；当前版本不支持在线轮换密钥。
 */

const TEXT_PREFIX = 'enc:v1:';
const ADDRESS_PREFIX = 'encd:v1:';
const INDEX_PREFIX = 'bidx:v1:';
const MIN_SECRET_LENGTH = 16;

const encoder = new TextEncoder();
const decoder = new TextDecoder();

let masterSecret = '';
let warnedMissingKey = false;

/** 设置当前 isolate 使用的加密密钥（由 index.ts / email-handler.ts 在请求入口调用） */
export function configureEncryption(secret?: string): void {
  const value = (secret || '').trim();
  masterSecret = value;

  if (!isEncryptionEnabled() && !warnedMissingKey) {
    warnedMissingKey = true;
    console.warn(
      '[crypto] 未配置 MAIL_ENCRYPTION_KEY 或长度不足 16 字符：敏感字段将以明文写入 D1。' +
      '生产环境请执行 `wrangler secret put MAIL_ENCRYPTION_KEY` 配置密钥。'
    );
  }
}

/** 是否启用了加密 */
export function isEncryptionEnabled(): boolean {
  return masterSecret.length >= MIN_SECRET_LENGTH;
}

function toBase64(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function fromBase64(value: string): Uint8Array {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

function toHex(bytes: Uint8Array): string {
  return [...bytes].map(b => b.toString(16).padStart(2, '0')).join('');
}

/** 由主密钥派生 AES-256-GCM 密钥 */
async function getAesKey(usage: 'encrypt' | 'decrypt'): Promise<CryptoKey> {
  const digest = await crypto.subtle.digest(
    'SHA-256',
    encoder.encode(`miaoyou:aes-gcm:v1:${masterSecret}`)
  );
  return crypto.subtle.importKey(
    'raw',
    digest,
    { name: 'AES-GCM' },
    false,
    [usage]
  );
}

/** 由主密钥派生 HMAC-SHA256 密钥（用于盲索引与确定性 IV） */
async function getHmacKey(): Promise<CryptoKey> {
  const digest = await crypto.subtle.digest(
    'SHA-256',
    encoder.encode(`miaoyou:hmac:v1:${masterSecret}`)
  );
  return crypto.subtle.importKey(
    'raw',
    digest,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
}

async function hmac(value: string): Promise<Uint8Array> {
  const key = await getHmacKey();
  const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(value));
  return new Uint8Array(signature);
}

/** 是否已经是加密文本 */
export function isEncryptedText(value: unknown): boolean {
  return typeof value === 'string' && value.startsWith(TEXT_PREFIX);
}

/** 是否已经是加密地址 */
export function isEncryptedAddress(value: unknown): boolean {
  return typeof value === 'string' && value.startsWith(ADDRESS_PREFIX);
}

/**
 * 加密任意文本（AES-256-GCM，随机 IV）
 * 空字符串保持为空，避免无意义写入。
 */
export async function encryptText(plaintext: string | null | undefined): Promise<string> {
  if (plaintext === null || plaintext === undefined) return '';
  if (!isEncryptionEnabled() || plaintext === '' || isEncryptedText(plaintext)) {
    return plaintext;
  }

  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await getAesKey('encrypt');
  const ciphertext = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv: iv.buffer as ArrayBuffer },
    key,
    encoder.encode(plaintext)
  );

  return `${TEXT_PREFIX}${toBase64(iv)}:${toBase64(new Uint8Array(ciphertext))}`;
}

/**
 * 解密文本；对历史明文数据直接原样返回（向后兼容）。
 */
export async function decryptText(value: string | null | undefined): Promise<string> {
  if (value === null || value === undefined || value === '') return '';
  if (!isEncryptedText(value)) return value;

  if (!isEncryptionEnabled()) {
    return '[已加密数据：请在 Worker 配置 MAIL_ENCRYPTION_KEY 后查看]';
  }

  try {
    const body = value.slice(TEXT_PREFIX.length);
    const sep = body.indexOf(':');
    if (sep < 0) return value;
    const iv = fromBase64(body.slice(0, sep));
    const ciphertext = fromBase64(body.slice(sep + 1));
    const key = await getAesKey('decrypt');
    const plaintext = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: iv.buffer as ArrayBuffer },
      key,
      ciphertext.buffer as ArrayBuffer
    );
    return decoder.decode(plaintext);
  } catch (error) {
    console.error('[crypto] 文本解密失败:', error);
    return '[解密失败：密钥可能已变更]';
  }
}

/**
 * 确定性加密邮箱地址（AES-256-GCM，IV 由 HMAC 派生）
 * 相同地址得到相同密文，便于数据库等值查询；没有密钥无法还原。
 */
export async function encryptAddress(address: string): Promise<string> {
  const normalized = normalizeAddress(address);
  if (!isEncryptionEnabled() || normalized === '' || isEncryptedAddress(normalized)) {
    return normalized;
  }

  const ivSource = await hmac(`address-iv:${normalized}`);
  const iv = ivSource.slice(0, 12);
  const key = await getAesKey('encrypt');
  const ciphertext = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv: iv.buffer as ArrayBuffer },
    key,
    encoder.encode(normalized)
  );

  return `${ADDRESS_PREFIX}${toBase64(iv)}:${toBase64(new Uint8Array(ciphertext))}`;
}

/**
 * 解密邮箱地址；历史明文直接返回。
 */
export async function decryptAddress(value: string | null | undefined): Promise<string> {
  if (value === null || value === undefined || value === '') return '';
  if (!isEncryptedAddress(value)) return value;

  if (!isEncryptionEnabled()) {
    return '[已加密邮箱：请在 Worker 配置 MAIL_ENCRYPTION_KEY 后查看]';
  }

  try {
    const body = value.slice(ADDRESS_PREFIX.length);
    const sep = body.indexOf(':');
    if (sep < 0) return value;
    const iv = fromBase64(body.slice(0, sep));
    const ciphertext = fromBase64(body.slice(sep + 1));
    const key = await getAesKey('decrypt');
    const plaintext = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: iv.buffer as ArrayBuffer },
      key,
      ciphertext.buffer as ArrayBuffer
    );
    return normalizeAddress(decoder.decode(plaintext));
  } catch (error) {
    console.error('[crypto] 地址解密失败:', error);
    return '[解密失败：密钥可能已变更]';
  }
}

/**
 * 邮箱地址盲索引（HMAC-SHA256）
 * 用于 WHERE address_hash = ? 查询，数据库里看不到原始地址。
 */
export async function blindIndexAddress(address: string): Promise<string> {
  const normalized = normalizeAddress(address);
  if (!isEncryptionEnabled() || normalized === '') return normalized;
  return `${INDEX_PREFIX}${toHex(await hmac(`address:${normalized}`))}`;
}

/** 规范化邮箱地址：去空白并统一小写 */
export function normalizeAddress(address: string): string {
  return address.trim().toLowerCase();
}

/**
 * 同时返回地址的密文和盲索引，减少重复 HMAC 计算。
 */
export async function protectAddress(address: string): Promise<{ value: string; hash: string; plain: string }> {
  const plain = normalizeAddress(address);
  const [value, hash] = await Promise.all([encryptAddress(plain), blindIndexAddress(plain)]);
  return { value, hash, plain };
}
