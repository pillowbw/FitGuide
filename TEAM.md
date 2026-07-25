# FitGuide 组员协作说明（短版）

仓库：https://github.com/pillowbw/FitGuide

## 第一次：把项目拉到本地

```powershell
git clone https://github.com/pillowbw/FitGuide.git
cd FitGuide
npm install
npm run dev
```

浏览器打开终端里显示的地址（一般是 http://localhost:5173）。

> 需要先安装 Node.js（LTS）：https://nodejs.org/  
> 需要安装 Git：https://git-scm.com/

---

## 日常：拉最新代码再改

开始干活前先同步：

```powershell
cd FitGuide
git pull
npm install
npm run dev
```

---

## 改完代码：提交并推上去（让别人能看到）

```powershell
git add .
git status
git commit -m "简要说明你改了什么"
git push
```

如果提示没有权限，让仓库管理员在 GitHub 把你加成 **Collaborator**（Settings → Collaborators）。

---

## 协作建议（减少互相覆盖）

1. 改之前先 `git pull`
2. 尽量只改自己负责的文件
3. `commit` 信息写清楚（例如：`完善业余路径推荐` / `补全胸肌视频链接`）
4. 推送成功后在群里说一声「已 push」

---

## 不写代码的同学

不用装开发环境。把资料发群或交给写代码的人即可，例如：

- 图片文件
- 视频链接表格（肌肉名 / 介绍 / 视频 URL）

由写代码的人填进项目并 `push`。
