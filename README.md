# QLyrix 🎵

<p align="center">
  <img src="src/assets/icon.png" width="120" height="120" alt="QLyrix Logo" />
</p>

<p align="center">
  <strong>基于 Tauri v2 + Vue 3 的轻量级 Apple Music 风格歌词与哔哩哔哩 MV 桌面播放器</strong>
</p>

<p align="center">
  <a href="https://github.com/icecolaqaq/QLyrix/releases"><img src="https://img.shields.io/github/v/release/icecolaqaq/QLyrix?style=flat-square&color=6366f1" alt="Release"></a>
  <a href="https://tauri.app/"><img src="https://img.shields.io/badge/Tauri-v2-24c8db?style=flat-square&logo=tauri" alt="Tauri v2"></a>
  <a href="https://vuejs.org/"><img src="https://img.shields.io/badge/Vue-3.5-42b883?style=flat-square&logo=vuedotjs" alt="Vue 3"></a>
  <a href="https://www.typescriptlang.org/"><img src="https://img.shields.io/badge/TypeScript-5.x-3178c6?style=flat-square&logo=typescript" alt="TypeScript"></a>
  <a href="LICENSE"><img src="https://img.shields.io/badge/License-MIT-blue?style=flat-square" alt="License"></a>
  <img src="https://img.shields.io/badge/Platform-Windows-0078d4?style=flat-square&logo=windows" alt="Platform Windows">
</p>

---

## 🌟 项目亮点

QLyrix 是为 **QQ 音乐桌面客户端** 量身打造的次时代外置歌词与视觉播放器。经过全新架构重构，从原本庞大的 Electron 迁移至 **Tauri v2 + Rust** 原生底层，在保留极致视觉动画的同时，**安装包体积精简至仅 7.8 MB**，内存占用与启动速度均得到飞跃式提升！

- 🍎 **Apple Music 风格逐字歌词**：采用 AMLL 渲染引擎，呈现丝滑流动的动态逐字高亮、弹簧物理滚动、鼠标滚轮字体缩放以及双语/音译歌词支持。
- 🏝️ **独立桌面灵动岛 (Dynamic Island)**：极具质感的桌面迷你胶囊形态，支持悬停丝滑展开、八叉树算法专辑流光背景、实时声波跳动、双行歌词展示与快捷切歌。
- 🎬 **沉浸式哔哩哔哩 MV 联动**：自动匹配 Bilibili 高清 MV 视频背景，支持 10 种 Pixi 粒子与艺术字幕特效、视频平铺/裁剪适应模式、视频模糊调节以及 B 站扫码登录解锁 1080P60 画质。
- 🎨 **自适应动态着色与背景模糊**：实时提取当前播放专辑的主题色，渲染绚丽的液态渐变光影与高斯模糊背景。
- ⚙️ **独立设置中心与系统托盘**：提供开机自启、主窗口置顶、托盘快捷操作、QMusicSupport 通信组件管理以及 GitHub 一键在线更新。

---

## 📸 功能特性一览

### 1. 主歌词窗口 (Main Lyrics Window)
- **常规模式**：左侧展示黑胶转动唱片、歌曲信息、音质标签（臻品母带/Hi-Res/无损等）、播放进度控制；右侧展示大屏 Apple Music 歌词。
- **迷你模式**：自动折叠为紧凑悬浮窗，专注文档或游戏办公。
- **歌词快捷交互**：点击任意歌词行快速跳转播放进度，鼠标滚轮实时调整字体大小并带气泡提示。
- **歌词导出**：支持一键导出当前歌曲的 `.lrc`、`.qrc`（逐字时间轴）及纯文本歌词文件。

### 2. 桌面灵动岛 (Dynamic Island)
- **迷你胶囊态**：32px 圆形黑胶封面、歌名跑马灯、4 频段声波均衡动画（暂停时休眠静止）。
- **展开交互态**：鼠标移入平滑变大为 400x200 卡片，显示流光渐变背景或封面模糊、实时双行歌词、收藏心形按钮、上一曲/下一曲/播放暂停及时间轴拖拽。
- **双击热区**：随时双击一键呼出/隐藏主歌词窗口；右键直接隐藏灵动岛。

### 3. MV 模式与粒子特效字幕
- 支持哔哩哔哩 MV 智能匹配与手动搜索关联，记住每首歌曲的专属 MV。
- 提供 10 款字幕特效预设：`微风粒子 (wind)`、`霓虹辉光 (glow)`、`星芒闪烁 (sparkle)`、`胶片电影 (cinema)`、`随机动态 (random)` 等。
- 支持水平/垂直翻转、画面缩放比例微调、多重平铺与全屏铺满。

### 4. 偏好设置中心 (Settings)
- **常规**：开机自启动开关、主窗口置顶、关闭主窗口时最小化至托盘、灵动岛常驻开关。
- **显示与歌词**：自定逐字高亮色彩选择器、翻译文本颜色、未播歌词不透明度限制消除、默认 MV 清晰度偏好。
- **哔哩哔哩账号**：原生扫码登录机制，实时展示账号昵称、UID、大会员标识。

---

## 🚀 下载与安装

前往 [GitHub Releases 发布页](https://github.com/icecolaqaq/QLyrix/releases) 下载最新版本的 Windows 安装程序或便携版：

| 安装包类型 | 文件名示例 | 说明 |
| :--- | :--- | :--- |
| **标准安装包 (推荐)** | `QLyrix_1.0.0_x64-setup.exe` | 仅 ~7.8 MB，一键安装并创建桌面与开始菜单快捷方式 |

### 系统要求
- **操作系统**：Windows 10 / Windows 11 (64-bit)
- **播放源支持**：已安装并运行 QQ 音乐 Windows 客户端
- **运行时环境**：Windows 10/11 内置 WebView2 Runtime（系统自带）

### 使用步骤
1. 打开并登录 **QQ 音乐** 客户端播放任意歌曲。
2. 启动 **QLyrix**，程序将自动启动后台通信支持服务并连接至 QQ 音乐。
3. 畅享精美的 Apple Music 歌词动效与桌面灵动岛！

---

## 🛠️ 本地开发与构建

如果您希望在本地开发或自行编译项目：

### 1. 前置依赖
- [Node.js](https://nodejs.org/) (v18+ 或 v20+)
- [pnpm](https://pnpm.io/) (`npm i -g pnpm`)
- [Rust](https://www.rust-lang.org/) (stable toolchain, `rustc` & `cargo`)
- [Visual Studio Build Tools](https://visualstudio.microsoft.com/visual-cpp-build-tools/) (包含 C++ 编译环境)

### 2. 克隆仓库与安装依赖
```bash
git clone https://github.com/icecolaqaq/QLyrix.git
cd QLyrix

# 安装前端依赖
pnpm install
```

### 3. 运行开发环境
```bash
# 启动 Tauri 开发模式（同时运行 Vite 前端服务与 Rust 窗口环境）
pnpm tauri:dev
```

### 4. 校验与生产打包
```bash
# 执行代码规范检测与类型检查
pnpm run lint
npm run build

# 打包生成 Windows NSIS 安装包
pnpm tauri:build
```
打包输出产物将保存在 `src-tauri/target/release/bundle/nsis/` 目录下。

---

## 📁 目录结构

```text
QLyrix/
├── library/
│   └── QMusicSupport/      # QQ 音乐本地通信支持服务程序
├── src/                    # 前端代码 (Vue 3 + TypeScript)
│   ├── assets/             # 静态资源与应用图标
│   ├── components/         # 核心渲染组件 (LyricPlayer, PixiSubtitles, MvBottomBar 等)
│   ├── composables/        # 响应式业务逻辑 (useLyric, useMvMode, usePlayerControls)
│   ├── services/           # 基础设施服务 (qmusicService, bilibiliService, tauriBridge)
│   ├── styles/             # 样式表与动画
│   ├── views/              # 窗口顶层视图 (LyricsView, IslandView, SettingsView)
│   ├── App.vue             # 多窗口动态路由宿主
│   └── main.ts             # 应用前端入口
├── src-tauri/              # Rust 原生后端 (Tauri v2)
│   ├── src/
│   │   ├── lib.rs          # 托盘菜单、窗口管理、进程守护、IPC 命令实现
│   │   └── main.rs         # 原生应用入口
│   ├── Cargo.toml          # Rust 依赖声明
│   └── tauri.conf.json     # Tauri 窗口与安全权限配置
├── README.md               # 项目介绍文档
└── package.json            # 前端依赖配置
```

---

## 🤝 鸣谢与致敬

- [Apple Music Like Lyrics (AMLL)](https://github.com/Steve-xmh/applemusic-like-lyrics) - 优秀的 Apple Music 动效歌词渲染器
- [Tauri](https://tauri.app/) - 极致轻量的跨平台桌面端框架
- [Element Plus](https://element-plus.org/) - 现代化的 Vue 3 桌面端组件库
- [PixiJS](https://pixijs.com/) - 强劲的高性能 2D WebGL 渲染引擎
- [QMusicSupport](https://github.com/icecolaqaq/QLyrix/tree/main/QMusicSupport) - 本地 QQ 音乐播放状态通信支持库

---

## 📄 开源许可证

本项目基于 [MIT License](LICENSE) 开源。

*免责声明：本项目仅供个人技术研究与学习交流使用，相关音乐及视频版权归原版权方（腾讯音乐娱乐集团 / 哔哩哔哩）所有。*
