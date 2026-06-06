# PaperQuay v{{VERSION}}

PaperQuay is an AI-assisted desktop application for literature management, PDF reading, paper overview generation, full-text translation, notes, and research workflow automation.

## Downloads

Download the native installer for your operating system from the Assets section below.

| Platform | Recommended asset |
| --- | --- |
| Windows | `.exe` installer |
| macOS | `.dmg` package for Apple Silicon or Intel |
| Linux | Electron desktop package such as `.AppImage`, `.deb`, or `.tar.gz` |

## Highlights

- Added a reading-time chart to the paper detail panel, using the existing PDF reading heatmap data to show total reading time, active document segments, and last read time.
- Kept the library reading heat preview and reader heat progress aligned with the new detail-panel chart, so reading activity is visible from both list and detail views.
- Updated the README files for v{{VERSION}}, including clearer English and Chinese descriptions of notes, inline navigation, reading heat, and reading-time visualization.
- Fixed corrupted Chinese text in release documentation so the Chinese release notes render normally.
- Continued the automated multi-platform release packaging flow for Windows, macOS Intel, macOS Apple Silicon, and Linux.

## Included In This Release

- Added `LiteratureReadingTimeChart` for the selected paper details panel.
- Added reading-time chart aggregation utilities and test coverage for compressing PDF reading heatmap bins into chart buckets.
- Updated English and Chinese README feature descriptions and version badges to v{{VERSION}}.
- Refreshed release notes to explicitly mention the code refactor, notes feature set, inline note navigation, and reading-time visualization.
- Kept release packaging on the split macOS x64 / arm64 matrix to avoid universal binary merge issues with native SQLite vector assets.

## Notes

- Reading-time charts are populated after PDF reading activity is recorded. Existing papers without recorded reading heat will show an empty chart state until opened and read.
- AI features require your own compatible model endpoint and API key in Settings.
- MinerU parsing requires a MinerU API key unless you are using already parsed local cache data.
- Release assets are generated automatically by GitHub Actions after the `app-v{{VERSION}}` tag workflow finishes.

---

# PaperQuay v{{VERSION}} 中文说明

PaperQuay 是一款 AI 辅助的桌面端文献管理、PDF 阅读、论文概览生成、全文翻译、笔记和科研工作流自动化应用。

## 下载说明

请在下方 Assets 区域选择与你的操作系统对应的原生安装包。

| 平台 | 推荐安装包 |
| --- | --- |
| Windows | `.exe` 安装包 |
| macOS | Apple Silicon 或 Intel 对应的 `.dmg` 安装包 |
| Linux | Electron 构建生成的 `.AppImage`、`.deb` 或 `.tar.gz` 桌面安装包 |

## 版本亮点

- 新增文献详情面板的阅读时间图，基于已有 PDF 阅读热力数据展示总阅读时长、活跃阅读区段和最后阅读时间。
- 文献列表阅读热力预览、阅读器热力进度和详情面板阅读时间图保持同一套数据来源，让阅读投入在列表和详情视图都能被看见。
- 更新 v{{VERSION}} 的英文和中文 README，补充笔记、内联跳转、阅读热力和阅读时间可视化说明。
- 修复发布说明中的中文乱码，中文 release notes 现在可以正常阅读。
- 继续使用自动化多平台发布流程，覆盖 Windows、macOS Intel、macOS Apple Silicon 和 Linux。

## 本次版本包含

- 新增 `LiteratureReadingTimeChart`，在选中文献详情面板显示阅读时间图。
- 新增阅读时间图聚合工具和测试，将 PDF 阅读热力 bins 压缩为图表区段。
- 将英文和中文 README 的功能说明与版本徽章更新到 v{{VERSION}}。
- 刷新发布说明，明确说明代码重构、笔记功能、笔记内联跳转和阅读时间可视化。
- 继续使用拆分的 macOS x64 / arm64 构建矩阵，避免 universal 合并 native SQLite vector 资源时出错。

## 备注

- 阅读时间图需要先记录 PDF 阅读活动。没有阅读热力记录的文献会显示空状态，打开并阅读后会自动积累数据。
- AI 功能需要你在设置中自行配置兼容的大模型接口和 API Key。
- MinerU 解析需要有效的 MinerU API Key，除非你使用的是已经解析好的本地缓存数据。
- 推送 `app-v{{VERSION}}` 标签后，GitHub Actions 会自动生成本版本发布资产。
