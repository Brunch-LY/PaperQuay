# PaperQuay v{{VERSION}}

PaperQuay is an AI-assisted desktop application for literature management, PDF reading, paper overview generation, full-text translation, notes, and research workflow automation.

## Downloads

Download the native installer for your operating system from the Assets section below.

| Platform | Recommended asset |
| --- | --- |
| Windows | `.exe` installer or `.msi` package |
| macOS | `.dmg` package for Apple Silicon or Intel |
| Linux | Electron desktop package such as `.AppImage`, `.deb`, or `.tar.gz` |

## Highlights

- Added PDF paragraph translation popovers in PDF-only reading mode. Clicking a parsed paragraph now shows the corresponding cached MinerU translation when available, with a manual translate option when no cache exists.
- Improved popover placement for paragraph translation and selected-text translation. The floating panel now uses the selected paragraph or selection rectangle and tries to avoid covering the selected content.
- Fixed note anchor highlights in the PDF reader so saved note references no longer block later selection, paragraph clicks, or translation actions on the same text.
- Changed the PDF thumbnail sidebar to be collapsed by default on first entry, reducing first-load work and keeping the reading surface cleaner.
- Preserved dual-pane linked reading behavior while adding the PDF-only paragraph translation workflow.
- Kept release packaging for Windows, macOS Intel, macOS Apple Silicon, and Linux, including Windows `.exe` and `.msi` assets.

## Included In This Release

- Added PDF block click context, including click position and rendered block bounds, so paragraph translation popovers can be placed accurately.
- Reused selected-excerpt translation state for cached paragraph translations without triggering unnecessary automatic selected-text translation requests.
- Added nearest-block hit detection to make PDF paragraph clicks more forgiving near paragraph edges.
- Added selection rectangle capture for PDF text selection, structured-block selection, and PDF annotation workspace selection.
- Rendered selection quick actions through a body-level portal with a higher layer so the panel is not clipped by reader panes or sidebars.
- Made PDF note-anchor overlays non-interactive except for their small numbered jump button.
- Updated the thumbnail sidebar preference key and default collapsed state for the new reading experience.

## Notes

- AI features require your own compatible model endpoint and API key in Settings.
- MinerU parsing requires a MinerU API key unless you are using already parsed local cache data.
- Release assets are generated automatically by GitHub Actions.

---

# PaperQuay v{{VERSION}} 中文说明

PaperQuay 是一款 AI 辅助的桌面端文献管理、PDF 阅读、论文概览生成、全文翻译、笔记和科研工作流自动化应用。

## 下载说明

请在下方 Assets 区域选择与你的操作系统对应的原生安装包。

| 平台 | 推荐安装包 |
| --- | --- |
| Windows | `.exe` 安装包或 `.msi` 安装包 |
| macOS | Apple Silicon 或 Intel 对应的 `.dmg` 安装包 |
| Linux | Electron 构建生成的 `.AppImage`、`.deb` 或 `.tar.gz` 桌面安装包 |

## 版本亮点

- 新增 PDF 阅读模式下的段落译文浮层。点击 MinerU 解析后的段落时，会优先显示对应的缓存译文；没有缓存时，可以直接单独翻译该段。
- 优化段落译文和划词翻译浮层的位置。浮层会根据段落或选区的屏幕矩形避让，尽量不遮挡当前选中的内容。
- 修复 PDF 中加入笔记后的锚点高亮阻塞问题。保存到笔记的段落仍会保留高亮提示，但不会再影响后续划词、点击段落或触发翻译。
- PDF 左侧缩略图侧栏首次进入时默认收起，降低首屏加载压力，让阅读区域更干净。
- 保留双栏对照模式的联动阅读行为，同时补充 PDF 单栏阅读下的段落译文体验。
- 自动发布流程继续覆盖 Windows、macOS Intel、macOS Apple Silicon 和 Linux，并包含 Windows `.exe` 与 `.msi` 安装包。

## 本次版本包含

- 新增 PDF 段落点击上下文，记录点击位置和渲染后的段落边界，用于更准确地放置译文浮层。
- 复用划词翻译状态显示缓存段落译文，避免段落点击触发不必要的自动划词翻译请求。
- 增加最近段落命中兜底，让点击 PDF 段落边缘时也能更稳定地触发段落译文。
- 为 PDF 划词、结构块划词和 PDF 批注工作区划词补充选区矩形捕获。
- 将划词/段落浮层渲染到 body 层级，避免被阅读器分栏或侧栏裁切。
- 将 PDF 笔记锚点整段覆盖层改为不拦截鼠标事件，仅保留右上角编号按钮用于跳转。
- 更新缩略图侧栏偏好键，并将首次进入的默认状态改为收起。

## 备注

- AI 功能需要你在设置中自行配置兼容的大模型接口和 API Key。
- MinerU 解析需要有效的 MinerU API Key，除非你使用的是已经解析好的本地缓存数据。
- 发布资产由 GitHub Actions 自动生成。
