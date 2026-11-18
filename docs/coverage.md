# 上游来源与覆盖矩阵

研究对象为 2026-11-18 获取的 `finktheartist/sakuga-vfx@c3dabb173928a3ad2372183103caf2e6f50953d0`。Git 树 57 个文件，下表各项覆盖其 57 个路径。 `运行` 表示在所述环境实际打开或调用，`逐帧` 表示沿固定步长离散取样并阅读画面，`素材逐格` 表示读源图格子。帧图证据和实时输入分属不同试验。 [固定提交](https://github.com/finktheartist/sakuga-vfx/tree/c3dabb173928a3ad2372183103caf2e6f50953d0) · [Git 树](evidence/upstream/tree.txt) · [审计报告](analysis.md)

## 组件与独立演示

源码栏包括每个目录的 README、去除公共段后的 JS 实现和独立 `index.html`。各独立页均实际导航，确认靶组件已注册并完成内部初始化。控件的实时测试在共用 Gallery 中执行，输入由浏览器派发。框架适配、所有自定义属性组合、全部程序化方法和键盘行为全排列未覆盖。

| 组件 | 读源码 | Gallery 实时输入 | 独立页 / 逐帧 | 尚未验证的代表项 |
| --- | --- | --- | --- | --- |
| Button | 是 | 鼠标次级、Enter 主按钮，触控主按钮，观察成功勾与全局单前景层 | 已加载。主按钮按压、命中、恢复共 9 采样，另核对快速重复和裁切。 [逐帧](evidence/upstream/button-film.png) | 次级密集布局、异步失败处理、读屏播报。 |
| Toggle | 是 | 鼠标 ON、空格 OFF、触控 ON，观察即时 ARIA 和两端帧 | 已加载。两条路线共 12 采样、43 个源图格及偏好切换中间帧。 [逐帧](evidence/upstream/toggle-film.png) | 任意中途再次翻转的所有组合、加载失败和低速设备解码。 |
| Slider | 是 | 真实慢/快鼠标拖与松开后数值、持有峰值衰减、箭头、触控拖动 | 已加载。可控值阶跃、近静止、速度拖尾与模拟 release 共 11 采样。 [逐帧](evidence/upstream/slider-film.png) | RTL、连续触控取消、整体位置动画下锚点。 |
| Checkbox | 是 | 鼠标勾选、空格取消及触控勾选 | 已加载。未逐帧。 | 快速反复勾选的延迟闪点。 |
| Radio | 是 | 鼠标选 B、箭头回 A，原脚本触控 B | 已加载。未逐帧。 | 运行中替换选项与长标签多行。 |
| Input | 是 | 鼠标/触控聚焦后真实键事件输入 hey | 已加载。未逐帧。 | 中文 IME、选区替换、长文本滚动、密码字形和剪贴板。 |
| Tabs | 是 | 鼠标/触控选第 3 项、ArrowLeft 回第 2 项 | 已加载。未逐帧。 | 面板关联、过多选项溢出和重新布局时着陆。 |
| Progress | 是 | 实时 demo 完成、实时 set(.5) 和 set(1)、ARIA 与一次完成事件 | 已加载。积累/暂稳/达到终点/稳定共 9 采样，另测动态少动效与卸载。 [逐帧](evidence/upstream/progress-film.png) | 异常进度源、失败与暂停的业务状态、设备资源占用。 |
| Rating | 是 | 鼠标 5、ArrowLeft 4，原脚本触控 4 | 已加载。未截连续帧图，固定时钟核对抢先改分。 | 表单 reset 与真实辅助技术播报。 |
| Toast | 是 | 鼠标 Save、Dismiss、重复后自动退场，原脚本触控 Save | 已加载。未逐帧。 | 快速 show/hide 合并或排队、不同长度/视窗消息。 |
| Tooltip | 是 | 鼠标 hover、Escape、390 触控打开/退出 | 已加载。未逐帧。 | 顶边/左右视口、触发器到气泡的鼠标通路、读屏体验。 |

## 公共源、构建、文档与资源

| 项目 | 已读取或清点 | 已运行或检查 | 尚未验证 |
| --- | --- | --- | --- |
| `core.js`、11 个生成片段、skill 内 core | 唯一公共真源，核对 Spring/Layer/时钟/FX/WORDS/Base，生成标记与首次加载规则 | 构建检查退出 0，根和 skill blob hash 相等。浏览器 Gallery 一前景层。逐帧任务覆盖被调用到的公共 FX。 [构建输出](evidence/upstream/build.txt) | 所有原语的参数空间，尤其没有单独制作公共 `splash` 的效果图。 |
| 根 `README.md`、`llms.txt`、`LICENSE` | 读文档、API 索引、MIT 和资产归属声明，关键差异见报告 | 文档中关涉主组件数、按钮反相与减动效的可观察断言已核对 | shadcn 和上游 skill 安装命令未执行，文件式分发已通过 11 个独立页验证。 |
| 根 `index.html`、`gallery/index.html`、`registry.json`、`vercel.json`、`.gitignore` | 根重定向到 Gallery，Gallery 12 项展示与提示，Registry 11 项，Vercel trailingSlash，仓库 ignore 项 | Gallery 两种宽度 1100×820 和 390×900（DPR 2、模拟触控），横向 scrollWidth 等于视口。部署 Gallery HTML 与其 11 个脚本 HTTP 200 且与 Git 树内容 SHA-256 一致。 [部署对比](evidence/upstream/hosted.json) | Gallery 的系统剪贴板权限、shadcn CLI 下载路径实测、Vercel 构建过程。 |
| `skills/sakuga-vfx/SKILL.md`、`starter.html` | 六步方法与报告规则，starter 的语义按钮与核心复用 | 双向 aria-pressed，只有 on 发 change。源规则与交互/逐帧结果对照。 | starter 无独立全节拍影片；原 skill 自动发现未安装验证。 |
| `skills/sakuga-vfx/look.mjs` | 原始 CDP、选择器（可穿一级 shadow）、暂停共享时钟、动作注入、60 Hz 舍入与裁截图 | Edge 157 实际运行，7 样本、无脚本错误。额外脚本采样见上表。 [原工具输出](evidence/upstream/look-mjs-edge.txt) · [源工具影片](evidence/upstream/original-look-button.png) | 原工具未统一浏览器 CSS 时钟/随机，不能用其 DOM 快照推算设备帧率。 |
| `tools/build.mjs` | 单源盖章、图集 base64、`--check` 边界 | 运行 `--check`，11 份生成脚本一致。另核对 skill core blob。 | 普通写入型构建留给需要修改上游 core 的任务。 |
| `tools/test.mjs` | 读 390 px CDP 触控和键盘断言，两个键盘检查先以 JS 聚焦 | Edge 157 原脚本测试部署画廊，22 项通过。另执行本地固定源扩展审计。 [完整输出](evidence/upstream/test-390-edge.txt) | 原测试套件未覆盖真实设备、所有导航顺序和负向状态。 |
| `tools/shot.mjs` | CDP 截图，小工具参数与可选独立 film 分支 | Edge 157 原工具截 1100×2473 Gallery，退出 0。 [输出](evidence/upstream/shot-mjs-edge.txt) · [全页图](evidence/upstream/original-shot-gallery.png) | 依赖 `window.__film` 的分支；审计树未提供对应页面。 |
| `tools/trace.py`、`art/words/*.webp` | 逐张检查六字，透明 alpha 阈值 128，轮廓保留与量化路径 | Python 3.14.6、potracer 0.0.4、Pillow 12.3.0、NumPy 2.5.1 在临时副本运行，六条生成路径块逐字相同。 [图集](evidence/upstream/lettering-atlas.png) · [输出](evidence/upstream/trace.txt) | 原画稿、生成提示与汉字新素材。 |
| `toggle/frames.webp` | 逐格审 43 帧，核对格尺寸、空格、OFF 子序列和 ON glint | 独立页时钟和真输入均验证，图集无需外请求。 [素材逐格](evidence/upstream/toggle-atlas.png) | 上游原始关键帧与绘画过程。 |

## 运行环境和复现

- Windows，Node 26.1.0。扩展审计用 Chromium headless shell 159.0.8154.6 和 Playwright 1.65.1，从当前 checkout 通过 Playwright route 返回原始 HTML 与 JS。 [脚本](evidence/upstream/audit.mjs) · [记录](evidence/upstream/audit.json) · [桌面](evidence/upstream/gallery-desktop.png) · [窄屏](evidence/upstream/gallery-390.png)
- 原版 `test.mjs`、`look.mjs`、`shot.mjs` 用 Microsoft Edge 157.0.4341.60 的独立临时配置跑过已做字节对照的在线 Gallery。受限环境原始 CDP localhost/Edge 启动未成功，改用获准的 Windows 浏览器进程运行原 CLI，且扩展审计最终用独立 Chromium shell 跑通。没有为此调整系统浏览器配置。 [受限启动记录](evidence/upstream/test-390-shell.txt)
- 扩展审计脚本需浏览器和 Playwright。将上游克隆到 `.research-upstream` 并检出本页记录的完整 SHA，或通过 `UPSTREAM` 提供固定版本的本地路径。默认寻找已安装的 Playwright 包，`PLAYWRIGHT_MODULE` 可指向另一处 Playwright 的 `index.mjs`，`BROWSER_EXE` 可指定 Chromium 二进制。 `EVIDENCE` 可指定新的输出目录。脚本直接调用浏览器 `mouse`、`keyboard`、`tap` 和 CDP 触控，实时段保持浏览器时钟开启。逐帧段只暂停 `SakugaFX`，按 1/60 s 采样并种随机。`Math.random` 固定用于帧图样本，实时测试仍用原生随机源。
- 字体、渲染像素和连续输入采样间隔随浏览器和运行环境变化。此次没有报告设备 FPS、内存增长量、触控硬件、屏幕阅读器或 Safari、Firefox 的结论。
