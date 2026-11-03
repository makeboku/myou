import * as PostalMimeModule from 'postal-mime';
import { Env, ParsedEmail } from './types';
import { getMailbox, saveEmail, saveAttachment } from './database';
import { configureEncryption } from './crypto';
import { sanitizeHtml } from './utils';

const PostalMime = PostalMimeModule.default;

/**
 * 处理接收到的邮件
 * @param message 邮件消息
 * @param env 环境变量
 */
export async function handleEmail(message: any, env: Env): Promise<void> {
  configureEncryption(env.MAIL_ENCRYPTION_KEY);
  try {
    const parser = new PostalMime();
    const email = await parser.parse(message.raw) as ParsedEmail;

    console.log('邮件解析结果:', {
      subject: email.subject,
      from: email.from,
      to: email.to,
      hasHtml: !!email.html,
      hasText: !!email.text,
      attachmentsCount: email.attachments?.length || 0
    });

    // 提取完整邮箱地址
    const mailboxAddress = email.to?.[0]?.address || '';
    if (!mailboxAddress) {
      console.log('邮件缺少收件人地址，静默丢弃');
      return;
    }
    
    console.log('查找邮箱:', mailboxAddress);
    
    // 查找对应的邮箱（不检查过期时间）
    const mailbox = await getMailbox(env.DB, mailboxAddress);
    
    if (!mailbox) {
      // 未知邮箱静默拒收：不向发件人返回错误，避免被用来探测邮箱是否存在
      console.log('邮箱不存在，静默拒收邮件');
      return;
    }

    // 保存邮件（收到的 HTML 先做基础净化，移除脚本/事件绑定/javascript:，防存储型XSS）
    const savedEmail = await saveEmail(env.DB, {
      mailboxId: mailbox.id,
      fromAddress: email.from.address,
      fromName: email.from.name || '',
      toAddress: mailboxAddress,
      subject: email.subject || '',
      textContent: email.text || '',
      htmlContent: sanitizeHtml(email.html || ''),
      hasAttachments: !!email.attachments?.length,
    });

    // 保存附件（如果有）
    if (email.attachments && email.attachments.length > 0) {
      console.log(`开始保存 ${email.attachments.length} 个附件`);
      
      for (const attachment of email.attachments) {
        try {
          // 将 ArrayBuffer 转换为 Base64 字符串
          const base64Content = arrayBufferToBase64(attachment.content);
          
          // 计算附件大小（字节）
          const size = attachment.size || attachment.content.byteLength;
          
          // 保存附件
          await saveAttachment(env.DB, {
            emailId: savedEmail.id,
            filename: attachment.filename,
            mimeType: attachment.mimeType,
            content: base64Content,
            size: size
          });
          
          console.log(`附件 ${attachment.filename} 保存成功`);
        } catch (attachmentError) {
          console.error(`保存附件 ${attachment.filename} 失败:`, attachmentError);
          // 继续处理其他附件，不中断流程
        }
      }
    }
  } catch (error) {
    console.error('处理邮件失败:', error);
  }
}

/**
 * 将 ArrayBuffer 转换为 Base64 字符串
 * @param buffer ArrayBuffer 数据
 * @returns Base64 字符串
 */
function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}