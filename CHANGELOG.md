# 更新日志

## v2.0（修改版）

### 🔐 安全

- **D1 敏感数据应用层加密** — 新增 `worker/src/crypto.ts`：邮箱地址使用确定性 AES-256-GCM + HMAC 盲索引，邮件主题/正文/HTML、发件人名称、附件内容与文件名、站内聊天与聊天附件使用 AES-256-GCM 加密。密钥通过 `MAIL_ENCRYPTION_KEY` Secret 注入，不落库、不入仓。
- **历史数据迁移接口** — `GET /api/admin/encryption/status`、`POST /api/admin/encryption/migrate`，使用 `X-Migration-Secret` 鉴权，分批迁移避免 Worker CPU 超时；迁移游标防止坏数据阻塞，解密失败的行会被跳过而不会被覆盖。
- **CORS 白名单** — 支持 `ALLOWED_ORIGINS`，默认放行同源、localhost、127.0.0.1、`*.pages.dev`。
- **未知邮箱静默拒收** — 避免通过退信探测邮箱是否存在。
- **创建邮箱域名校验** — 服务端按 `ALLOWED_EMAIL_DOMAINS` 校验地址后缀。

### ✨ 新功能

- **双站点模式** — `VITE_SITE_MODE=temp|perm`，站点名称、首屏文案、按钮、标题跳转均可配置，前端运行时从 `/api/config` 读取。
- **ForwardEmail 入站 Webhook** — `POST /api/inbound`，支持 `INBOUND_WEBHOOK_SECRET`。
- **About 页面** — 页脚「关于我们」弹窗与中英文翻译。
- **邮箱总数统计** — 页脚展示已创建邮箱数量。
- **密码长度统一** — 前后端随机密码统一为 25–35 位。

---

## v1.2

### 🐛 Bug 修复

- **修复 `VITE_EXTERNAL_LINKS` 部署不生效** — 该项目以 Workers + Assets 方式部署，`import.meta.env.VITE_EXTERNAL_LINKS` 是 Vite 构建时变量，Cloudflare Dashboard 环境变量不会传递给构建过程。现已将该配置加入 `/api/config` 运行时 API，前端首次加载时从 API 获取，同时保留构建时 env 作为初始回退。现可在 Cloudflare Dashboard → Worker → 环境变量中设置 `VITE_EXTERNAL_LINKS` 覆盖外部链接。

### ✨ 新功能

- **创建邮箱支持自定义用户名** — 创建弹窗的「创建」选项卡中，邮箱地址行右上角新增「自定义」切换按钮。默认仍为随机生成 12 位地址（原有行为不变），点击「自定义」地址变为可编辑输入框（仅允许 `a-zA-Z0-9._-` 字符），点击「随机」切回随机生成模式，域名选择器保持不变。支持中英文。

### 🔧 优化

- **收件箱身份信息按钮排序调整** — 按钮顺序改为：名 → 姓 → 姓名 → 用户名 → 密码
- **密码长度调整为 25-35 位** — 前端 `frontend/src/utils/helpers.ts` 和后端 `worker/src/utils.ts` 的密码生成范围统一为 25-35 位随机长度（原前端 30-40，后端 30-45）

### 📦 文件变更

| 文件 | 变更 |
|------|------|
| `frontend/src/components/Header.tsx` | 运行时 API 获取外部链接，保留构建时 env 回退 |
| `frontend/src/components/CreateLoginDialog.tsx` | 新增自定义用户名输入和支持中英文 |
| `frontend/src/components/EmailList.tsx` | 按钮顺序调整为名→姓→姓名→用户名→密码 |
| `frontend/src/config.ts` | 新增 `getExternalLinks()` 函数 |
| `frontend/src/utils/helpers.ts` | 密码范围 25-35 |
| `frontend/i18n/locales/en.json` | 补充自定义用户名相关翻译 |
| `worker/src/routes.ts` | `/api/config` 返回 `externalLinks` |
| `worker/src/types.ts` | `Env` 接口添加 `VITE_EXTERNAL_LINKS` |
| `worker/src/utils.ts` | 密码范围 25-35 |
| `wrangler.toml` | `[vars]` 添加 `VITE_EXTERNAL_LINKS` 默认值 |

---

## v1.1

- 初始版本
