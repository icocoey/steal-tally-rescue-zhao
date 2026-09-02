# 窃符救赵 · 魏宫夜行

一款使用 React、Three.js 与 Vinext 制作的桌面网页潜行冒险游戏。玩家操控信陵君的门客木偶，在魏宫中避开内侍、寻找如姬、潜入寝殿盗取虎符，并将虎符交给接应将军。

## 操作

- `WASD`：移动
- `Shift`：奔跑
- `Ctrl`：蹲行
- `E`：交互或长按取符
- `Esc`：暂停
- 鼠标滚轮：调整镜头距离

## 开发

```bash
npm install
npm run assets:generate
npm run dev
npm test
npm run build:pages
```

推送到 `main` 分支后，GitHub Actions 会自动构建并发布公开的 GitHub Pages 试玩页面。

## 日常同步

当前 Codex 项目目录是唯一开发源，“GitHub上传版”只作备份。在 GitHub Desktop 中添加本目录后：

1. 开始工作前执行 **Fetch origin**，有更新时执行 **Pull origin**。
2. 大型改动从 `main` 创建功能分支，在功能分支分批提交并 **Push origin**。
3. 测试通过后创建 Pull Request；合并到 `main` 才会更新 GitHub Pages。
4. 发生冲突时先拉取并在 GitHub Desktop 解决，不使用强制推送覆盖远端。

当前画面升级分支为 `feature/visual-detail-pass`。角色优先加载 `public/assets/models/palace-puppet.glb`，GLB 缺失或加载失败时自动回退到程序化木偶。角色动作统一命名为 `idle`、`walk`、`run`、`crouch`、`interact`、`sleep`、`handoff`。场景碰撞仍由独立简化碰撞盒负责，不依赖视觉模型。

本项目为“窃符救赵”历史故事的游戏化改编，并非史实复原。现有 GLB、材质、布料与烛光为项目原创资产，来源与许可记录见 `public/assets/ASSET-LICENSES.md`；未复用参考项目的模型、音乐或界面素材。
