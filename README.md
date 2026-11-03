# <div align="center">🚀 秒邮 - 永久匿名邮箱服务</div>

<div align="center">
  <p>
    <a href="./README.en.md">English</a> | <strong>简体中文</strong>
  </p>

  <p>如果这个项目对您有帮助，请考虑给它一个 ⭐️ Star ⭐️，这将是对我最大的鼓励！</p>

  <img src="frontend/public/favicon.svg" alt="秒邮 Logo" width="120" height="120" style="background-color: #4f46e5; padding: 20px; border-radius: 12px; margin: 20px 0;">

  <h3>💌 安全、简单、永久有效的匿名邮箱服务</h3>

  <p>
    <a href="#features"><strong>✨ 功能特点</strong></a> •
    <a href="#screenshots"><strong>📸 界面预览</strong></a> •
    <a href="#deployment"><strong>🚀 快速部署</strong></a> •
    <a href="#env-vars"><strong>🔧 环境变量</strong></a> •
    <a href="#development"><strong>💻 本地开发</strong></a> •
    <a href="#tech-stack"><strong>🔧 技术栈</strong></a> •
    <a href="#project-structure"><strong>📁 项目结构</strong></a>
  </p>

</div>


## <a id="features"></a>✨ 功能特点

<div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 10px; margin: 20px 0;">
  <div>
    <h4>✨ 即时创建</h4>
    <p>无需注册，一键生成永久匿名邮箱地址，即时可用</p>
  </div>
  <div>
    <h4>🔒 隐私保护</h4>
    <p>保护您的真实邮箱，避免垃圾邮件和信息泄露，完全匿名使用</p>
  </div>
  <div>
    <h4>🔐 密码登录</h4>
    <p>每个邮箱拥有独立高强度密码，可跨设备随时登录找回</p>
  </div>
  <div>
    <h4>🔄 多账号切换</h4>
    <p>登录过的邮箱自动保存到浏览器，顶部一键切换，管理多个账号更方便</p>
  </div>
  <div>
    <h4>⚡ 实时接收</h4>
    <p>实时接收邮件，支持自动刷新（10秒间隔），不错过任何邮件</p>
  </div>
  <div>
    <h4>🌐 全球可用</h4>
    <p>基于Cloudflare构建，全球边缘网络加速</p>
  </div>
  <div>
    <h4>🌙 深色模式</h4>
    <p>支持深色/浅色主题切换，保护视力</p>
  </div>
  <div>
    <h4>🌍 多语言</h4>
    <p>支持中英文界面，满足不同用户需求</p>
  </div>
  <div>
    <h4>📱 响应式设计</h4>
    <p>完美适配各种设备，从手机到桌面</p>
  </div>
</div>

---

## <a id="screenshots"></a>📸 界面预览

> 截图待补充

| 页面 | 说明 |
|------|------|
| 🏠 **首页** | 引导用户创建或登录邮箱，展示功能介绍、使用场景、FAQ |
| 📬 **收件箱** | 登录后显示邮件列表，支持查看邮件详情、附件 |
| 🔄 **多账号切换** | 顶部下拉菜单，在多个已保存邮箱间快速切换 |

---

## <a id="deployment"></a>🚀 快速部署

Miaoyou 现在采用全新的一体化部署方式，前端和后端整合为一个 Cloudflare Worker，部署更加简单！

### 🎯 部署方式选择

我们提供两种部署方式，您可以根据需求选择：

#### 方式一：一键部署（推荐新手）

<div align="center">
  <a href="http://deploy.workers.cloudflare.com/?url=https://github.com/fyjn4r5/miaoyou-copy" target="_blank">
    <img src="https://deploy.workers.cloudflare.com/button" alt="Deploy to Cloudflare" />
  </a>
</div>

<div style="background-color: #2d2d2d; color: #ffffff; padding: 15px; border-radius: 5px; margin: 15px 0;">
  <h4>✅ 优点：</h4>
  <ul>
    <li>部署简单，一键完成</li>
    <li>无需修改配置文件</li>
    <li>适合快速体验</li>
  </ul>
  
  <h4>❌ 缺点：</h4>
  <ul>
    <li>无法获得后续代码更新</li>
    <li>需要手动绑定自定义域名</li>
  </ul>
  
  <h4>📋 部署步骤：</h4>
  <ol>
    <li>点击上方 "Deploy to Cloudflare" 按钮</li>
    <li>按照页面提示连接您的 GitHub 账户</li>
    <li>填写应用名称和数据库名称</li>
    <li>在高级设置 -> 构建变量中设置：
      <ul>
        <li><code>VITE_EMAIL_DOMAIN</code>: 您的域名列表，使用 ',' 分割 (例如: mdzz.uk,zaunist.com)</li>
      </ul>
    </li>
    <li>点击"创建和部署"</li>
    <li>部署完成后，在 Cloudflare Workers 控制面板中绑定自定义域名</li>
    <li>配置 Cloudflare Email 路由，将邮件转发到您的 Worker</li>
  </ol>
</div>

#### 方式二：Fork 后通过 Github Action 自定义部署（推荐进阶用户）

<div style="background-color: #2d2d2d; color: #ffffff; padding: 15px; border-radius: 5px; margin: 15px 0;">
  <h4>✅ 优点：</h4>
  <ul>
    <li>可以获得后续代码更新</li>
    <li>完全自定义配置</li>
    <li>更好的版本控制</li>
    <li>通过 GitHub Action 自动部署，更加安全便捷</li>
  </ul>
  
  <h4>❌ 缺点：</h4>
  <ul>
    <li>需要一定的技术基础</li>
    <li>需要手动创建数据库和配置密钥</li>
  </ul>
  
  <h4>📋 部署步骤：</h4>
  <ol>
    <li>Fork 本项目到您的 GitHub 账户</li>
    <li>在 Cloudflare Dashboard 中创建一个 D1 数据库，并记录下数据库的 <strong>database_name</strong> 和 <strong>database_id</strong></li>
    <li>在您的 GitHub 仓库中, 前往 <strong>Settings</strong> > <strong>Secrets and variables</strong> > <strong>Actions</strong></li>
    <li>点击 <strong>New repository secret</strong> 并添加以下五个密钥：
      <ul>
        <li><code>CF_API_TOKEN</code>: 你的 Cloudflare API Token。你可以在 <a href="https://dash.cloudflare.com/profile/api-tokens" target="_blank">这里</a> 创建，使用 "Edit Cloudflare Workers" 模板即可。</li>
        <li><code>CF_ACCOUNT_ID</code>: 你的 Cloudflare 账户 ID。你可以在 Workers 页面的右侧找到。</li>
        <li><code>D1_DATABASE_ID</code>: 你在第二步中创建的 D1 数据库的 ID。</li>
        <li><code>D1_DATABASE_NAME</code>: 你在第二步中创建的 D1 数据库的名称。</li>
        <li><code>VITE_EMAIL_DOMAIN</code>: 你的域名列表，多个域名用逗号 ',' 分割 (例如: example.com,test.com)。</li>
      </ul>
    </li>
    <li>完成以上步骤后，项目将在每次推送到 <code>main</code> 分支时自动部署。你也可以在 Actions 页面手动触发部署。</li>
    <li>部署完成后，为你的 Worker 绑定一个自定义域名。</li>
    <li>最后，配置 Cloudflare Email 路由，将邮件转发到你的 Worker。</li>
  </ol>
</div>

### 📧 配置邮件路由

无论选择哪种部署方式，都需要配置 Cloudflare Email 路由：

<div style="background-color: #2d2d2d; color: #ffffff; padding: 15px; border-radius: 5px; margin: 15px 0;">
  <ol>
    <li>在 Cloudflare 控制面板中找到您的域名</li>
    <li>进入 "Email" -> "Email Routing"</li>
    <li>启用 Email Routing</li>
    <li>添加路由规则：
      <ul>
        <li>匹配类型："Catch-all address"</li>
        <li>操作："Send to a Worker"</li>
        <li>选择您部署的 Worker</li>
      </ul>
    </li>
    <li>如果有多个域名，请为每个域名重复上述步骤</li>
  </ol>
</div>

---


## <a id="env-vars"></a>🔧 环境变量

### VITE_EXTERNAL_LINKS（自定义顶部导航栏「工具」链接）

该项目以 Workers + Assets 方式部署，推荐直接在 `wrangler.toml` 的 `[vars]` 中设置，或部署后在 Cloudflare Dashboard → Workers → 环境变量中修改。`/api/config` 会把这些变量在运行时返回给前端，无需重新构建前端。格式：

```
标签|URL,标签|URL
```

最多 5 个，默认值：

```
临时Gmail邮箱|https://smailpro.com/temporary-email,真实地址生成器|https://ip.alice7.eu.org/
```

示例：

```
临时邮箱|https://temp-mail.org,IP 查询|https://ip.sb,密码生成|https://1password.com/password-generator
```

> **注意**：`wrangler.toml` 的 `[vars]` 不会传递给 Vite 构建时的 `import.meta.env`。因此外部链接、站名、站点模式等请以 `/api/config` 的运行时配置为准；`frontend/.env` 只用于构建期兜底。

### VITE_EMAIL_DOMAIN（邮箱域名）

推荐在 `wrangler.toml` 的 `[vars]` 中设置 `ALLOWED_EMAIL_DOMAINS`（后端唯一数据源，前端通过 `/api/config` 获取），格式：`域名1,域名2,域名3`。旧的 `VITE_EMAIL_DOMAIN` 仅作为向后兼容兜底。

> 新增的 `ALLOWED_EMAIL_DOMAINS` 优先于 `VITE_EMAIL_DOMAIN`，推荐只使用前者；两者都支持逗号分隔的多个域名。创建邮箱时后端会校验域名是否在白名单内。

### 双站点模式（VITE_SITE_MODE）

| 变量 | 说明 | 示例 |
|------|------|------|
| `VITE_SITE_MODE` | `temp`=临时邮箱站，`perm`=匿名/永久邮箱站 | `perm` |
| `VITE_SITE_NAME` | 站点标题 | `秒邮-永久匿名邮箱` |
| `VITE_OTHER_SITE_URL` | 标题点击后跳转的另一个站点（留空则回首页） | `https://temp.example.com` |
| `VITE_OTHER_SITE_LABEL` | 跳转链接文案 | `切换站点` |

### ALLOWED_ORIGINS（CORS 白名单）

除同源、`localhost`、`127.0.0.1`、`*.pages.dev` 外，额外允许的来源，逗号分隔。留空时保持向后兼容（允许所有来源）。

### 入站 Webhook（INBOUND_WEBHOOK_SECRET）

非 Cloudflare Email Routing 场景（例如 ForwardEmail）可把邮件 POST 到 `/api/inbound`。设置该 Secret 后，请求必须携带 `X-Forward-Email-Secret` 请求头。未知收件邮箱会静默忽略。

```bash
wrangler secret put INBOUND_WEBHOOK_SECRET
```

### 数据加密（MAIL_ENCRYPTION_KEY / MIGRATION_SECRET）

```bash
# D1 敏感字段加密主密钥（至少 16 字符；丢失后数据无法恢复，请离线备份）
wrangler secret put MAIL_ENCRYPTION_KEY
# 历史数据批量加密管理接口密钥
wrangler secret put MIGRATION_SECRET
```

加密覆盖：邮箱地址、邮件主题/正文/HTML、发件人名称、附件内容与文件名、站内聊天内容、聊天附件。邮箱密码仍使用 PBKDF2-SHA256（10 万次迭代）单向哈希，不可逆。详细设计见 [`修改说明.md`](./修改说明.md)。

旧库升级：先备份 D1，用 `GET /api/admin/encryption/status` 查看待迁移数量，再循环 `POST /api/admin/encryption/migrate`（请求头 `X-Migration-Secret`）分批完成加密。迁移会跳过解密失败的数据行，不会用错误占位文本覆盖原内容。

---

## <a id="development"></a>💻 本地开发

### 前置要求

- **Node.js** >= 18
- **pnpm** >= 8（推荐使用 `npm install -g pnpm` 安装）
- **Cloudflare 账户**（用于后端开发和部署）

### 环境变量配置

在 `frontend/` 目录下创建 `.env` 文件（参考 `.env.example`）：

```bash
# 邮箱域名配置（多域名以逗号分隔）
VITE_EMAIL_DOMAIN=example.com,abc.com,def.com

# API 源地址（不要带 /api）
# 前后端同域部署（Worker 同时托管前端静态资源）时留空；
# 前后端分离部署时填写 API 源，例如 https://api.example.com
VITE_API_BASE_URL=
```

### 🚀 启动开发服务器

```bash
# 1. 安装所有依赖
pnpm install

# 2. 启动前端开发服务器（默认端口 5173）
pnpm dev:frontend

# 3. 启动后端开发服务器（默认端口 8787，需要 wrangler）
pnpm dev:backend

# 前端开发服务器会自动将 /api 请求代理到后端
```

### 前端构建

```bash
# 构建生产版本
pnpm run build

# 预览构建结果
pnpm run preview
```

### ⚙️ 部署到 Cloudflare

```bash
# 部署 Worker（需要配置 wrangler.toml）
pnpm run deploy
```

### 前端访问

| 环境 | 地址 |
|------|------|
| 本地开发 | http://localhost:5173 |
| API 地址 | /api（通过 Vite proxy） |

> **注意**：本地开发时，邮件接收功能需要 Cloudflare Email Routing 配合，仅在生产环境可用。

---

## <a id="tech-stack"></a>🔧 技术栈

<div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 20px; margin: 20px 0;">
  <div>
    <h3>🎨 前端</h3>
    <ul>
      <li><strong>React 18</strong> - 用户界面库</li>
      <li><strong>TypeScript</strong> - 类型安全的JavaScript超集</li>
      <li><strong>Tailwind CSS</strong> - 实用优先的CSS框架</li>
      <li><strong>Vite</strong> - 现代前端构建工具</li>
      <li><strong>React Router v6</strong> - 前端路由</li>
      <li><strong>i18next</strong> - 国际化解决方案</li>
      <li><strong>Font Awesome</strong> - 图标库</li>
    </ul>
  </div>
  <div>
    <h3>⚙️ 后端</h3>
    <ul>
      <li><strong>Cloudflare Workers</strong> - 边缘计算平台</li>
      <li><strong>Hono</strong> - 轻量级Web框架</li>
      <li><strong>Cloudflare D1</strong> - 边缘SQL数据库（SQLite）</li>
      <li><strong>Cloudflare Email Workers</strong> - 邮件处理服务</li>
    </ul>
  </div>
</div>

## <a id="project-structure"></a>📁 项目结构

```
Miaoyou/
├── frontend/                    # 前端 React 应用
│   ├── i18n/locales/            # 国际化翻译文件
│   │   ├── zh-CN.json           #   中文翻译
│   │   └── en.json              #   英文翻译
│   ├── public/                  # 静态资源
│   └── src/
│       ├── components/          # 通用组件
│       │   ├── Header.tsx       #   页面顶部导航栏
│       │   ├── HeaderMailbox.tsx #   邮箱操作栏（复制、切换、注销）
│       │   ├── MailboxSwitcher.tsx #   多账号切换下拉菜单
│       │   ├── CreateLoginDialog.tsx #   创建/登录弹窗
│       │   ├── EmailList.tsx    #   邮件列表
│       │   ├── EmailDetail.tsx  #   邮件详情
│       │   ├── Layout.tsx       #   页面布局
│       │   └── ...
│       ├── contexts/
│       │   └── MailboxContext.tsx #   全局邮箱状态管理
│       ├── pages/
│       │   ├── HomePage.tsx     #   首页
│       │   ├── MailboxPage.tsx  #   邮箱详情页
│       │   └── ...
│       ├── utils/
│       │   ├── api.ts           #   后端 API 调用封装
│       │   └── helpers.ts       #   工具函数（生成地址/密码）
│       ├── config.ts            #   前端配置
│       ├── types.d.ts           #   TypeScript 类型定义
│       └── App.tsx              #   应用入口
├── worker/                      # 后端 Cloudflare Worker
│   └── src/
│       ├── index.ts             #   Worker 入口
│       ├── routes.ts            #   API 路由处理
│       ├── database.ts          #   D1 数据库操作
│       ├── email-handler.ts     #   邮件接收处理
│       ├── types.ts             #   类型定义
│       └── utils.ts             #   工具函数
├── wrangler.toml                # Cloudflare Worker 配置
├── package.json                 # 项目根配置
└── README.md                    # 项目说明
```

## 🔑 核心功能详解

### 邮箱创建
- **随机创建**：系统自动生成12位随机用户名和30+位高强度密码
- **自定义创建**：用户可自定义用户名和密码
- **多域名支持**：支持配置多个邮箱域名供用户选择

### 邮箱登录
- 通过完整邮箱地址和密码登录
- 登录信息保存到浏览器 localStorage，下次自动恢复会话

### 多账号管理（v2 新增）
- 所有登录过的邮箱自动保存在浏览器本地
- 顶部导航栏显示切换按钮（至少2个账号时出现）
- 下拉列表展示所有已保存账号，当前账号高亮显示
- 支持单个删除或一键清空所有已保存账号（保留当前账号）

### 邮件功能
- 实时接收邮件（自动刷新每10秒）
- 查看邮件详情（发件人、主题、正文、附件）
- 邮件缓存机制，减少重复请求
- 24小时后自动清理邮件

---

## 👥 贡献指南

欢迎提交Pull Request或Issue来改进这个项目！

## 📄 许可证

[MIT License](./LICENSE)
