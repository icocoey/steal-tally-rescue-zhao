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
npm run dev
npm test
npm run build:pages
```

推送到 `main` 分支后，GitHub Actions 会自动构建并发布公开的 GitHub Pages 试玩页面。

本项目为“窃符救赵”历史故事的游戏化改编，并非史实复原。场景与角色全部由程序化几何体构成，未复用参考项目的模型、音乐或界面素材。
