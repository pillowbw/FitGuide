# FitGuide AI 健身教练 — 部署与本地开发

教练通过服务端调用 **Chat Completions**（OpenAI 或其兼容接口）。API Key 只存在服务端，不会进入 React 前端或 Git。

> 未配置 Key 时界面会显示「模板演示」——那是关键词模板，**不是**大模型对话。

## 环境变量

| 变量 | 必填 | 说明 |
|------|------|------|
| `OPENAI_API_KEY` | 要真实 AI 时必填 | OpenAI / DeepSeek 等密钥 |
| `OPENAI_MODEL` | 否 | 默认 `gpt-4o-mini`；DeepSeek 用 `deepseek-v4-flash` 或 `deepseek-v4-pro` |
| `OPENAI_BASE_URL` | 否 | 兼容接口地址，如 `https://api.deepseek.com` |
| `FITGUIDE_COACH_DEMO` | 否 | 默认允许无 Key 时用模板；配好 Key 后走真实模型 |

本地：

```powershell
copy .env.example .env.local
```

## 切换为真实 AI（推荐）

### 方案 A：OpenAI

1. 在 https://platform.openai.com/api-keys 创建 Key（`sk-` 开头）
2. 编辑 `.env.local`：

```env
OPENAI_API_KEY=sk-你的密钥
OPENAI_MODEL=gpt-4o-mini
FITGUIDE_COACH_DEMO=true
```

3. **重启** `npm run dev`，打开 `/plan`，标签应变为「真实 AI」

### 方案 B：DeepSeek（国内网络更稳）

1. 在 https://platform.deepseek.com 创建 API Key
2. 编辑 `.env.local`：

```env
OPENAI_API_KEY=sk-你的DeepSeek密钥
OPENAI_BASE_URL=https://api.deepseek.com
OPENAI_MODEL=deepseek-v4-flash
FITGUIDE_COACH_DEMO=true
```

3. 重启 `npm run dev`

配置有效 Key 后走真实多轮对话；Key 无效或网络失败会返回明确错误，**不会再静默伪装成 AI**。

## 模板演示（无 Key）

```powershell
npm install
npm run dev
```

头部显示「模板演示」时，回复来自本地规则，仅供演示能力范围。

## Vercel 部署

1. 连接仓库到 Vercel  
2. 设置 `OPENAI_API_KEY`（及可选 `OPENAI_MODEL`、`OPENAI_BASE_URL`）  
3. 部署后访问 `/plan`

## 安全警告

- **禁止** 在 React 中使用 `VITE_OPENAI_API_KEY`
- **禁止** 将 `.env.local` 提交到 Git
- **禁止** 在浏览器直接请求模型厂商 API

## 功能入口

AI 教练挂载在 **训练计划页**（`/plan`）右下角。

## 相关文件

- `api/lib/fitnessChatHandler.js` — 服务端对话与系统指令
- `api/lib/demoCoach.js` — 无 Key 时的模板回复
- `src/utils/fitnessAgent.js` — 前端 API 封装
- `src/components/FitnessCoach.jsx` — 聊天 UI
