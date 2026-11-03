import { Env } from './types';
import { initializeDatabase, cleanupExpiredMailboxes, cleanupExpiredMails, cleanupRateEvents } from './database';
import { handleEmail } from './email-handler';
import { configureEncryption } from './crypto';
import app from './routes';

// 数据库初始化标志：避免每个请求都执行几十条 D1 语句（初始化+全表 UPDATE），
// 导致 Worker 超出 CPU 时间上限（Cloudflare 503 / error code 1102）
let dbInitPromise: Promise<void> | null = null;

function ensureDatabaseInitialized(env: Env): Promise<void> {
  if (!dbInitPromise) {
    dbInitPromise = initializeDatabase(env.DB).catch(error => {
      // 初始化失败时重置，允许后续请求重试
      dbInitPromise = null;
      throw error;
    });
  }
  return dbInitPromise;
}

// 导出Worker处理函数
export default {
  // 处理HTTP请求
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    // 每个 isolate 的密钥只配置一次，但重复调用无副作用；必须早于任何数据库读写
    configureEncryption(env.MAIL_ENCRYPTION_KEY);

    const url = new URL(request.url);

    // 非 API 请求：优先提供前端静态资源（frontend/dist），未命中则回退到 index.html（SPA 路由刷新）
    if (!url.pathname.startsWith('/api')) {
      if (env.ASSETS) {
        const assetResponse = await env.ASSETS.fetch(request);
        if (assetResponse.status !== 404) return assetResponse;
        // SPA 回退：/internal-chat 等前端路由直接返回 index.html
        const indexRequest = new Request(new URL('/', request.url), request);
        const indexResponse = await env.ASSETS.fetch(indexRequest);
        if (indexResponse.status === 200) {
          return new Response(indexResponse.body, indexResponse);
        }
        return indexResponse;
      }
      // 未配置静态资源绑定
      return new Response('入口页面不存在，请检查 ASSETS 绑定配置', { status: 404 });
    }

    try {
      // 自动初始化数据库（每个 isolate 仅执行一次，避免每请求全表初始化导致 CPU 超时）
      await ensureDatabaseInitialized(env);
      
      // 手动初始化数据库（如果请求中包含init参数）
      if (url.searchParams.has('init')) {
        return new Response(JSON.stringify({ 
          success: true, 
          message: '数据库初始化成功' 
        }), {
          headers: { 'Content-Type': 'application/json' }
        });
      }
      
      // 处理API请求
      return app.fetch(request, env, ctx);
    } catch (error) {
      console.error('请求处理失败:', error);
      
      // 返回详细的错误信息
      return new Response(JSON.stringify({
        success: false,
        error: '服务器内部错误',
        message: error instanceof Error ? error.message : String(error)
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }
  },
  
  // 处理邮件
  async email(message: any, env: Env, _ctx: ExecutionContext): Promise<void> {
    configureEncryption(env.MAIL_ENCRYPTION_KEY);
    try {
      await handleEmail(message, env);
    } catch (error) {
      console.error('处理邮件失败:', error);
      throw new Error(`Failed to process email: ${error instanceof Error ? error.message : String(error)}`);
    }
  },
  
  // 定时任务 - 每小时清理过期邮箱以及过期邮件和已被阅读的邮件
  async scheduled(_event: ScheduledEvent, env: Env, _ctx: ExecutionContext): Promise<void> {
    configureEncryption(env.MAIL_ENCRYPTION_KEY);
    try {
      const deleted = await cleanupExpiredMailboxes(env.DB);
      console.log(`已清理 ${deleted} 个过期邮箱`);
      const deletedMail = await cleanupExpiredMails(env.DB);
      console.log(`已清理 ${deletedMail} 个过期邮件`);
      await cleanupRateEvents(env.DB);
      console.log('已清理过期速率限制记录');
    } catch (error) {
      console.error('定时任务执行失败:', error);
    }
  },
};