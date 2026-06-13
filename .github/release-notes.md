# PaperQuay v{{VERSION}}

PaperQuay is an open-source AI paper workspace for literature management, PDF reading, paper overview generation, full-text translation, inline notes, Zotero import, Agent workflows, and local RAG.

## Downloads

Download the native installer for your operating system from the Assets section below.

| Platform | Recommended asset |
| --- | --- |
| Windows | `.exe` installer or `.msi` package |
| macOS | `.dmg` package for Apple Silicon or Intel |
| Linux | Electron desktop package such as `.AppImage`, `.deb`, or `.tar.gz` |

## Highlights

- Optimized macOS titlebar behavior: the app now uses the native traffic-light controls and removes duplicate custom window buttons on macOS.
- Improved PDF.js lifecycle cleanup to reduce stale worker/render-task errors when opening, switching, or closing PDFs.
- Improved Agent RAG answers with clickable citation tags that jump back to the referenced paper block or page.
- Added and clarified the RAG Top-K setting for controlling how many nearest context blocks are sent to the model.
- Refined selection and paragraph translation popovers, including independent Settings switches and safer positioning around selected text.
- Improved side-panel chat input behavior, multi-session QA handling, and Agent interaction polish.

## Notes

- AI features require your own compatible model endpoint and API key in Settings.
- MinerU parsing requires a MinerU API key unless you are using already parsed local cache data.
- Release assets are generated automatically by GitHub Actions.

---

# PaperQuay v{{VERSION}} 中文说明

PaperQuay 是一个开源 AI 论文工作台，覆盖文献管理、PDF 阅读、论文概览生成、全文翻译、内联笔记、Zotero 导入、Agent 工作流和本地 RAG。

## 下载说明

请在下方 Assets 区域选择与你的操作系统对应的安装包。

| 平台 | 推荐安装包 |
| --- | --- |
| Windows | `.exe` 安装包或 `.msi` 安装包 |
| macOS | Apple Silicon 或 Intel 对应的 `.dmg` 安装包 |
| Linux | `.AppImage`、`.deb` 或 `.tar.gz` 桌面安装包 |

## 本次更新

- 优化 macOS 标题栏：macOS 下使用系统左上角三色按钮，并隐藏重复的自定义窗口控制按钮。
- 优化 PDF.js 生命周期清理，减少切换、关闭或重新打开 PDF 时的旧 worker / 渲染任务报错。
- 优化 Agent RAG 回答：引用标签支持点击跳转到对应论文的结构块或页面。
- 增加并明确 RAG Top-K 设置，用于控制发送给模型的最相近上下文块数量。
- 优化划词翻译和 PDF 段落翻译浮层，支持独立开关，并改进浮层位置以减少遮挡。
- 优化侧边栏问答输入、多会话问答和 Agent 交互体验。

## 备注

- AI 功能需要在设置中自行配置兼容的大模型接口和 API Key。
- MinerU 解析需要有效的 MinerU API Key，除非你使用的是已经解析好的本地缓存数据。
- Release 资源由 GitHub Actions 自动生成。
