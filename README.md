# FitGuide — 健身动作指南（黑客松）

纯前端：React + Vite + React Router。用户档案与计划保存在 `localStorage`，教学视频使用外链。

## 快速开始

```bash
npm install
npm run dev
```

浏览器打开终端提示的本地地址（通常是 `http://localhost:5173`）。

## 三人分工

| 成员 | 负责文件 | 功能 |
|------|----------|------|
| **A** | `src/pages/Home.jsx`、`ProfileSetup.jsx`、`BeginnerFlow.jsx`；`src/components/BodyTypePicker.jsx`、`Layout.jsx`；`src/data/bodyTypes.json`；`src/styles/global.css` | 首页路径选择、建档、业余目标推荐 |
| **B** | `src/pages/AnatomyExplorer.jsx`、`MuscleDetail.jsx`；`src/components/MuscleMap.jsx`、`VideoList.jsx`；`src/data/muscles.json`、`exercises.json` | 正反肌肉图、肌肉详情与视频 |
| **C** | `src/pages/TrainingPlan.jsx`；`src/utils/storage.js`、`planGenerator.js`；`src/data/planRules.json` | 个性化周计划生成 |

组装时主要改 `src/App.jsx` 路由（已接好，一般不用动）。

## 路由

| 路径 | 页面 |
|------|------|
| `/` | 首页 |
| `/profile` | 建档 |
| `/beginner` | 业余路径 |
| `/anatomy` | 进阶解剖图 |
| `/muscle/:id` | 肌肉详情 |
| `/plan` | 训练计划 |

## 数据契约（改字段前先同步）

### 用户档案（`storage.js`）

```js
{
  gender: 'male' | 'female' | 'other' | '',
  height: number | null,
  weight: number | null,
  chest, waist, hip, bodyFat, // 可选 number | null
  currentBodyTypeId: string,
  path: 'beginner' | 'advanced' | '',
  goalRegion: 'upper' | 'core' | 'lower' | 'full' | '',
  targetBodyTypeId: string,
  selectedMuscleIds: string[]
}
```

API：`getProfile()` / `saveProfile(patch)` / `getPlan()` / `savePlan(plan)`（`storage.js`）；`generatePlan()`（`planGenerator.js`，生成后自动 `savePlan`）。

### JSON 文件

- `bodyTypes.json`：`kind` 为 `current` 或 `target`；目标身材可带 `recommendedMuscleIds`
- `muscles.json`：`id`, `name`, `side`(`front`|`back`), `region`, `summary`, `tips`
- `exercises.json`：`muscleIds`, `videoUrl`, `advice`, `level`
- `planRules.json`：每周训练天数、组次数、部位优先顺序

## 资源

身材例图放在 `public/body/`。成员 B 可把真实解剖 SVG 放到同目录，并在 `MuscleMap.jsx` 里做成可点击热区。

## 合并给我时

按现有目录交文件即可，或 zip 并标注 A/B/C。我会接到路由上做联调。
