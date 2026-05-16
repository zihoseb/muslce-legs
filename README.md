# 肌肉腿大合成

一个零前端依赖的浏览器合成小游戏。玩法改成了类似“合成大西瓜”的下落物理合成：玩家在顶部投放肌肉腿圆球，同色同级碰撞后升级为更大的肌肉腿，棋盘堆到警戒线以上会结束本局。

## 本地启动

```bash
npm run start
```

然后打开 `http://localhost:3000`。

## 发给别人看

### 同一个 Wi-Fi 内临时预览

```bash
npm run start:lan
```

终端会打印类似 `LAN preview: http://192.168.x.x:3000` 的地址。把这个地址发给同一 Wi-Fi 下的人即可访问。注意：这只适合临时演示，对方离开同一网络就打不开。

### 发公网链接

这个游戏目前不依赖后端数据库，核心都在 `public/` 里，所以最省事的部署方式是静态网站托管：

- Netlify：直接拖拽 `public/` 文件夹，发布后得到一个公网网址。
- Vercel：导入项目后把输出目录设为 `public`，不需要构建命令。
- GitHub Pages：把 `public/` 里的文件发布到 Pages 分支或 `docs/` 目录。

公网部署后，别人用手机浏览器打开链接就能玩；进度会保存在各自设备的 `localStorage`。

### 用 GitHub Pages 发布

本项目已经内置 `.github/workflows/deploy-pages.yml`，推送到 GitHub 后可以自动把 `public/` 发布成网页。

1. 在 GitHub 新建一个公开仓库，例如 `muscle-leg-merge`。
2. 在本地项目目录执行：

   ```bash
   git init
   git add .
   git commit -m "Deploy muscle leg merge game"
   git branch -M main
   git remote add origin https://github.com/你的用户名/muscle-leg-merge.git
   git push -u origin main
   ```

3. 打开 GitHub 仓库的 `Settings` → `Pages`。
4. `Build and deployment` 的 `Source` 选择 `GitHub Actions`。
5. 等 `Actions` 里的 `Deploy GitHub Pages` 跑完。
6. 发布地址通常是：

   ```text
   https://你的用户名.github.io/muscle-leg-merge/
   ```

如果仓库不是公开仓库，GitHub Pages 是否可公开访问取决于你的 GitHub 账号/组织套餐。

## 小程序版本路线

微信生态里建议做成“小游戏”而不是普通“小程序页面”，因为当前玩法主要依赖 Canvas、动画循环和触摸输入。

迁移工作大致是：

1. 新建微信小游戏项目，把 `public/assets/muscle-legs/` 复制到小游戏资源目录。
2. 把 `public/app.js` 拆成平台无关的游戏逻辑模块和微信小游戏入口。
3. 将浏览器 API 替换为微信小游戏 API：`localStorage` 改为 `wx.getStorageSync` / `wx.setStorageSync`，Canvas 获取与触摸事件改为小游戏运行环境里的接口。
4. 将 DOM UI 改成 Canvas 内绘制，或用小程序页面承载排行榜、任务、图鉴等辅助面板。
5. 接入分享、排行榜、激励广告、登录等微信能力。
6. 用微信开发者工具真机预览，之后按平台要求提交审核。

## 已实现内容

- Canvas 下落物理场，支持鼠标、触摸和键盘投放
- 圆形碰撞、重力、墙体、地面反弹和同级合成
- 肌肉腿数据结构：颜色、等级、稀有度、`image`、`highlightImage`、`animationFrames`、特效
- 写实 PNG 素材：`public/assets/muscle-legs/`，包含普通图、高亮图和三帧合成动画
- 等级视觉成长：L1 细腿，之后逐步变成训练腿、粗壮腿、巨型肌肉腿
- 图鉴解锁和好友赠送最高等级肌肉腿
- 任务成就：自动检测完成并发放金币
- 排行榜：本地玩家与模拟玩家 Top 10
- 奖励循环：分享奖励、激励广告冷却、模拟金币包
- 本地存档：`localStorage` 保存玩家进度

## 主要文件

- `public/index.html`：游戏界面结构
- `public/styles.css`：布局、肌肉腿视觉、动画和响应式样式
- `public/app.js`：合成逻辑、背包、任务、排行榜、分享和赠送
- `server.js`：本地静态文件服务

## 开发检查

```bash
npm run check
```
