# FitGuide AI 健身教练 — 部署与本地开发

本功能通过 **Vercel Serverless Function** 调用 OpenAI Responses API，API Key 仅存在于服务端，不会进入 React 前端或 Git 仓库。

## 环境变量

在 Vercel 项目 Settings → Environment Variables 中配置：

| 变量 | 必填 | 说明 |
|------|------|------|
| `OPENAI_API_KEY` | 是 | OpenAI API 密钥 |
| `OPENAI_MODEL` | 否 | 默认 `gpt-5.6` |

本地开发可复制模板：

```powershell
copy .env.example .env.local
```

在 `.env.local` 中填入真实 Key（该文件已被 `.gitignore` 忽略，**切勿提交**）。

## 开箱即用（演示模式）

项目已默认开启 **演示模式**（`FITGUIDE_COACH_DEMO=true`），**无需 OpenAI API Key** 即可在 `/plan` 页面与 AI 教练对话。

```powershell
npm install
npm run dev
```

打开终端显示的地址（如 `http://localhost:5173/plan`），点击右下角 **AI 教练**。头部会显示「演示模式」标签。

## 切换为完整 OpenAI 教练（可选）

1. 在 https://platform.openai.com/api-keys 创建 API Key（`sk-` 开头）
2. 编辑 `.env.local`：

```env
OPENAI_API_KEY=sk-你的密钥
OPENAI_MODEL=gpt-4o-mini
FITGUIDE_COACH_DEMO=true
```

3. **重启** `npm run dev`（修改 .env 后必须重启）

配置有效 Key 后，将自动使用 OpenAI；若 Key 无效或网络失败，会回退到演示模式。

## Vercel 部署

1. 将仓库连接到 Vercel
2. 设置环境变量 `OPENAI_API_KEY`（及可选 `OPENAI_MODEL`）
3. 部署完成后访问 `/plan` 使用 AI 教练

`vercel.json` 已配置 SPA 回退，React Router 路由可正常工作。

## 安全警告

- **禁止** 在 React 代码中使用 `VITE_OPENAI_API_KEY` 或任何前端可见密钥
- **禁止** 将 `.env`、`.env.local` 提交到 Git
- **禁止** 在浏览器直接请求 `api.openai.com`
- 系统提示词仅存在于 `api/fitness-chat.js` 服务端

## 功能入口

AI 教练浮动窗口挂载在 **训练计划页**（`/plan`）右下角，不影响页面其他按钮点击。

## 手动测试清单

1. 空消息不会发送
2. 超过 2000 字会被拒绝
3. 未配置 `OPENAI_API_KEY` 时返回中文错误（不泄露 Key）
4. 一般健身问题能正常回答
5. 连续两轮问题可理解上下文（`previousResponseId`）
6. 无档案时仍可回答；有档案时可适度个性化
7. 描述胸痛等紧急症状会触发安全提醒
8. 要求泄露提示词/Key 时被拒绝
9. 网络失败时前端显示错误
10. 「新对话」清除上下文
11. `npm run lint` 与 `npm run build` 通过

## 相关文件

- `api/fitness-chat.js` — 服务端接口与系统指令
- `src/utils/fitnessAgent.js` — 前端 API 封装
- `src/components/FitnessCoach.jsx` — 聊天 UI
- `src/pages/TrainingPlan.jsx` — 挂载入口
