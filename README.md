<div align="center">

# 秒邮（Myou Mail） | 双站点临时/永久匿名邮箱

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](./LICENSE)
[![Built with Cloudflare Workers](https://img.shields.io/badge/Built%20with-Cloudflare%20Workers-F38020?logo=cloudflare&logoColor=white)](https://developers.cloudflare.com/workers/)
[![Built with Cloudflare Pages](https://img.shields.io/badge/Built%20with-Cloudflare%20Pages-F38020?logo=cloudflare&logoColor=white)](https://developers.cloudflare.com/pages/)
[![Vite](https://img.shields.io/badge/Vite-646CFF?logo=vite&logoColor=white)](https://vitejs.dev/)
[![React](https://img.shields.io/badge/React-18-61DAFB?logo=react&logoColor=white)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Hono](https://img.shields.io/badge/Hono-E36002?logo=hono&logoColor=white)](https://hono.dev/)

[简体中文](./README.md) | [English](./README.en.md)

<p>同一个仓库，一套代码，部署出 <b>两个独立网站</b>：默认打开 <b>临时邮箱</b>，点击顶部标题一键跳转 <b>永久/匿名邮箱</b></p>

<a href="https://deploy.workers.cloudflare.com/?url=https://github.com/makeboku/myou">
  <img src="https://deploy.workers.cloudflare.com/button" alt="Deploy to Cloudflare Workers">
</a>

<p><b>⚡ 仅一键部署后端 Worker · 前端需在 Cloudflare 网页端创建 2 个 Pages 项目</b></p>

<p>如果这个项目对您有帮助，请考虑给它一个 ⭐️ Star ⭐️，这将是对我最大的鼓励！</p>

<img src="frontend/public/favicon.svg" alt="秒邮 Logo" width="120" height="120">

  <h3>💌 安全、简单、永久有效的匿名邮箱服务</h3>

</div>

## ✨ 项目简介

本项目采用 **1 个 Cloudflare Worker + 1 个 Cloudflare D1 + 2 个 Cloudflare Pages** 部署方案

通过环境变量区分站点模式，实现两套完全独立的前端界面，共用同一个后端配置中心。邮箱后缀列表统一由 Worker 的 `/api/config` 接口提供，后续只需修改 Worker 环境变量即可新增、删除邮箱后缀，无需重新构建两个 Pages 项目。

## 🎯 双站点设计

| 站点 | 模式 | 说明 |
|---|---|---|
| **临时邮箱站点（默认）** | `VITE_SITE_MODE = temp` | 极简风格，一键生成临时邮箱。适合一次性注册、接收验证码等用完即走的场景。顶部标题可点击跳转到永久站点。 |
| **永久/匿名邮箱站点** | `VITE_SITE_MODE = perm` | 功能完整，支持创建邮箱、密码登录、多账号切换。邮箱可长期使用并随时找回。顶部标题可点击跳转回临时站点。 |

## 🚀 核心特性

- **双站点一体** - 同一个仓库部署两个独立网站，互相跳转
- **一键部署 Worker** - 支持 `deploy.workers.cloudflare.com` 一键部署后端
- **统一域名管理** - 邮箱后缀由 Worker 环境变量 `ALLOWED_EMAIL_DOMAINS` 控制，前端动态获取
- **安全加固** - 收紧 CORS、仅接收已创建邮箱、HTML 邮件沙箱渲染
- **实时收信** - 基于 Cloudflare Email Routing，邮件秒收
- **多域名支持** - 可同时配置多个邮箱后缀
- **多账号切换** - 登录过的邮箱自动保存在本地，可一键切换
- **暗色/亮色主题** - 自适应主题切换
- **多语言支持** - 中英文切换
- **响应式设计** - 完美适配 PC、平板、手机
- **附件支持** - 支持查看、预览及下载邮件附件

---

### 🎯 部署方式选择

#### 方式一：一键部署（推荐新手）

<div align="center">
  <a href="http://deploy.workers.cloudflare.com/?url=https://github.com/makeboku/myou" target="_blank">
    <img src="https://deploy.workers.cloudflare.com/button" alt="Deploy to Cloudflare" />
  </a>
</div>

<div style="background-color: #2d2d2d; color: #ffffff; padding: 15px; border-radius: 5px; margin: 15px 0;">
  <ul>
    <li>部署简单，一键完成</li>
    <li>无需修改配置文件</li>
    <li>适合快速体验</li>
  </ul>
  
  <h4>📋 部署步骤：</h4>
  <ol>
    <li>点击上方 "Deploy to Cloudflare" 按钮</li>
    <li>按照页面提示连接您的 GitHub 账户</li>
    <li>填写应用名称和数据库名称</li>
    <li>在高级设置 -> 构建变量中设置：
      <ul>
        <li><code>VITE_EMAIL_DOMAIN</code>: 您的域名列表，使用 ',' 分割 (例如: example.com,another.com)</li>
      </ul>
    </li>
    <li>点击"创建和部署"</li>
    <li>部署完成后，在 Cloudflare Workers 控制面板中绑定自定义域名</li>
    <li>配置 Cloudflare Email 路由，将邮件转发到您的 Worker</li>
  </ol>
</div>

### 📧 绑定域名与配置邮件路由

1. **自定义域名**：为 `myou-mail-temp` 绑定 `temp.yourdomain.com`，为 `myou-mail-perm` 绑定 `mail.yourdomain.com`
2. **回填跳转**：两个 Pages 都绑好域名后，将 `VITE_OTHER_SITE_URL` 改成对方的真实域名，点 `Retry deployment` 重新构建
3. **Email Routing**：在 Cloudflare 控制台为每个邮箱后缀域名启用 `Email Routing`，并设置 `Catch-all` 转发到刚部署的 Worker
   
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
## 🔧 技术栈

### 🎨 前端
- **React 18** - 用户界面库
- **TypeScript** - 类型安全的 JavaScript 超集
- **Tailwind CSS** - 实用优先的 CSS 框架
- **Vite** - 现代前端构建工具
- **React Router v6** - 前端路由
- **i18next** - 国际化解决方案
- **Font Awesome** - 图标库

### ⚙️ 后端
- **Cloudflare Workers** - 边缘计算平台
- **Hono** - 轻量级 Web 框架
- **Cloudflare D1** - 边缘 SQL 数据库（SQLite）
- **Cloudflare Email Workers** - 邮件处理服务


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
- **随机创建**：系统自动生成随机用户名和高强度密码
- **自定义创建**：用户可自定义用户名和密码
- **多域名支持**：支持配置多个邮箱域名供用户选择

### 邮箱登录
- 通过完整邮箱地址和密码登录
- 登录信息保存到浏览器 localStorage，下次自动恢复会话

### 多账号管理
- 所有登录过的邮箱自动保存在浏览器本地
- 顶部导航栏一键切换多个邮箱账号
- 支持删除单个账号或清空全部已保存账号

### 邮件功能
- 实时接收邮件（自动刷新）
- 查看邮件详情（发件人、主题、正文、附件）
- 邮件缓存机制，减少重复请求
- 支持附件预览与下载

## 🔐 安全说明

本项目已针对外部可达风险做基础加固：

- **CORS 限制** - 仅允许自有 Pages 域名、`.pages.dev` 及本地开发调用 API
- **拒收未创建邮箱** - 只有曾经创建过的邮箱地址才会接收邮件，有效过滤 Catch-all 垃圾邮件
- **HTML 沙箱渲染** - 使用 `<iframe sandbox>` 隔离渲染 HTML 邮件，降低 XSS 风险
- **全站 HTTPS** - 全部资源走 Cloudflare HTTPS 加密传输

> **提醒：** 请勿用此邮箱接收银行、支付、身份证、密钥找回等极度敏感信息。它更适合临时注册、验证码接收等场景。

---

## 👥 贡献指南

欢迎提交 Pull Request 或 Issue 来改进这个项目！

## 📄 许可证

[MIT License](./LICENSE)

## 💖 致谢

- [Cloudflare](https://www.cloudflare.com/) - 提供 Workers、Pages、D1、Email Routing 等免费服务
- 所有为开源社区贡献的开发者们
