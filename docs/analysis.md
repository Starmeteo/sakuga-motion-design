# Sakuga VFX 研究报告

## 基线和证据口径

2026-11-18（北京时间）研究 `finktheartist/sakuga-vfx` 的 `c3dabb173928a3ad2372183103caf2e6f50953d0`。该提交的改动是移除 Slash、Manga 两套主题与相关 API。当前版只含一套默认画法，`setTheme`、`data-sakuga-theme`、旧版强光、闪电、激波等均不属于当前基线。仓库声明 MIT，版权为 Justin Finkelman，文档将拟声字和 Toggle 帧标为通过 Higgsfield 使用 GPT Image 制作。图像原始制作过程未随仓库提供。 [固定提交](https://github.com/finktheartist/sakuga-vfx/tree/c3dabb173928a3ad2372183103caf2e6f50953d0) · [许可证](https://github.com/finktheartist/sakuga-vfx/blob/c3dabb173928a3ad2372183103caf2e6f50953d0/LICENSE) · [覆盖矩阵](coverage.md)

- **源码事实** 来自上述 commit 的可定位实现、工具、说明或素材。
- **运行观察** 来自浏览器自动化的真实输入事件与实时状态读数，或暂停时钟后单独注明的采样画面。
- **设计推断** 解释为什么某个动作方向、节奏、配色或构图有效。
- **新增设计** 指新 skill 拓展的场景与治理约定，应用时按目标项目验收。

## 源码事实

### 分发与核心

仓库有 **11 种组件、12 项展品**，Button 拆成主/次两项，Toast 卡另嵌了一个次级 Save 按钮。根页重定向到 gallery。11 个独立页使用各自的组件脚本和状态输出。Progress 独立页带 demo，当前页没有 README 提到的 Slider。Registry 的 11 个 items 各携带可下载 URL 和放置路径，gallery 的 agent 提示会为现有组件生成接入指令。 [Gallery](https://github.com/finktheartist/sakuga-vfx/blob/c3dabb173928a3ad2372183103caf2e6f50953d0/gallery/index.html#L65) · [Registry](https://github.com/finktheartist/sakuga-vfx/blob/c3dabb173928a3ad2372183103caf2e6f50953d0/registry.json)

根 `core.js` 是唯一公共核心源码。每种独立组件先声明自身 `component(fx)`，随后内嵌同一份 core，再调用组件注册。第一个脚本创建 `window.SakugaFX`，后续副本遇到已存在的全局对象即返回。每个脚本独立分发的约 40 KB 重复字节属于打包方式。Skill 内 `core.js` 与根文件的 Git blob 都是 `0d13688c2d254a35f4662194b0b845216e14ddb1`，单独比对两者很有用，因为上游 `build.mjs --check` 只检查 11 个生成组件里的 core 段和 Toggle 的 sheet 段，普通构建才会复制 skill 的 core。 [核心](https://github.com/finktheartist/sakuga-vfx/blob/c3dabb173928a3ad2372183103caf2e6f50953d0/core.js#L1) · [构建](https://github.com/finktheartist/sakuga-vfx/blob/c3dabb173928a3ad2372183103caf2e6f50953d0/tools/build.mjs)

公共实现中，弹簧以不超过 8 ms 的积分子步更新速度与位置，实时主循环把单次增量限制在 34 ms。`Base` 建 open Shadow DOM，在连接时注册 `frame`，断开时注销。`later` 与 `advance` 共用组件时钟。前景 canvas 全屏 fixed，高 z-index 且不接收指针，效果创建时按 page 坐标取锚点，绘制每帧减当前 scroll。后景 canvas 在宿主内扩边 160 CSS px，可以被祖先裁切。静止宿主的 `frame` 仍持续调度，canvas 的 DOM 对象也会留到页结束。 `layers` 持有后景层对象，断开后绘制循环会清粒子，源码没有从数组移除这个对象的路径。 [层与时钟](https://github.com/finktheartist/sakuga-vfx/blob/c3dabb173928a3ad2372183103caf2e6f50953d0/core.js#L13-L83) · [Base](https://github.com/finktheartist/sakuga-vfx/blob/c3dabb173928a3ad2372183103caf2e6f50953d0/core.js#L217-L258)

### 视觉机制和素材

| 机制 | 证据和适用解释 |
| --- | --- |
| 描边和明暗 | `blob` 拼接圆轮廓，先描边并固定阴影色，再把亮面偏移后裁进轮廓。 `shape` 将相同办法用于不规则碎片和水花。两阶面加边比模糊阴影更能显示缩放与滚动。 |
| 短促切点 | `burst` 用随机星尖、偏移的阴影星和强调色抛针；`ticks` 是局部小 wedges，`kira` 是亮点，`wob` 说明弹性停止。用不同尺度区分命中、落点和停稳。 |
| 方向和余势 | `puff` 在给定速度下扩大、滚动、缩小；`donut` 是带孔、不规则漂移的烟团；`ring` 是较平的等心外扩；`lines` 定向细化；`slash` 头快尾慢，追上后消失；`shards` 有速度、旋转与重力；`splash` 是水冠和飞滴。公共 splash 可调用，Toggle 的水冠来自帧图。 |
| 拟声字 | 六个透明 WebP 各自追踪为 `WORDS[name] = [w,h,path]`，再按形状 × 填边色 × 网点样式烘成 canvas 缓存，运行时 `drawImage`。词为 `don` ドン、`gogo` ゴゴゴゴ、`kachi` カチッ、`pon` ポン、`shu` シュッ、`zuza` ズザッ。 `hollow()` 和 `dotted()` 有硬编码边色。新语言需要字形素材和布局验收。 |
| 帧图 | `frames.webp` 是 2400 × 1950 的透明图集，8 列 × 6 行，43 个有效格，每格 300 × 325，显示 150 × 162.5 CSS px，按 30 fps 积分。源说明称从十二张关键帧扩绘后对齐壳体，仓库只有最终图集。源图人工逐格检查见 [Toggle 图集](evidence/upstream/toggle-atlas.png) 和 [拟声字图集](evidence/upstream/lettering-atlas.png)。 |

核心 `P` 与 `--sk-*` 是两组数据。同时存在局部 CSS 色、显式绘图参数、字形专用色以及图集像素。 `P` 的原位修改影响同一全局实例，绘制时取值与发射时捕获的参数会出现不同的换色时间。包含 `P` 的浅色、阴影、描边、强调、墨色和拟声字槽时，应另外审查组件硬编码（如 Slider 拇指纯白、前冲斩线和字色），以及 Progress 的直接 Canvas 绘制。 [核心绘画](https://github.com/finktheartist/sakuga-vfx/blob/c3dabb173928a3ad2372183103caf2e6f50953d0/core.js#L85-L215)

### 主要动作的参数和边界

- **Button**。按住由 `squashy` 设纵向目标 .5，横向修正 .24，额外发三楔、两侧摇线和短线。click 立刻将纵向 spring 拉到 ≤.6、弹出 spring 拉到 1.24、倾斜置为 −5°，反相排定 190 ms 后结束。中心后景半径 98、17 尖 burst，周围 11 碎片、四烟团、上方 176 px 大字。200 ms 后回弹、摇线、依次三烟环和落片，`seq` 阻止过时的 200 ms 回调进入，190 ms 反相与已安排的后发烟环缺少同样的保护。 `done(hold)` 由应用操作成功后调用，命中 click 与成功 check 是两个时间点。次级只做轻压/弹簧与角落三楔。 [Button](https://github.com/finktheartist/sakuga-vfx/blob/c3dabb173928a3ad2372183103caf2e6f50953d0/button/button.js#L30-L61)
- **Slider**。真实 range 的值、数值泡、FormData 立即跟随 input。画面拇指沿归一化 spring，默认 k=420、d=30，速度单位为轨道分数/秒。令 `s=1+min(1.5,abs(v)*.3)`，拇指横拉 s、纵收至 `1/sqrt(s)`，变形原点在前方，标注泡按有符号 v 倾斜并限 ±14°。 `abs(v)>.35` 后按 `dt*abs(v)*20` 累积发后拖尾，体量随 `min(1,abs(v)/2.4)`；`abs(v)>1.5` 且过 1.1 s 冷却才说 シュッ。记录带符号峰值，以每帧 .96 衰减，native change 时若峰值绝对值 >1.3，按峰值方向出斩线、burst、碎屑，520 ms 后旧锚点补烟。此外终点有独立碎屑。速度来自显示 spring，程序写 value 和键盘阶跃也可能触发拖尾。 [Slider](https://github.com/finktheartist/sakuga-vfx/blob/c3dabb173928a3ad2372183103caf2e6f50953d0/slider/slider.js#L39-L68)
- **Progress**。目标 `goal` 和显示 `p` 分开，公开 `value` 读目标，ARIA 与百分比读画面进度。追赶速度为 `clamp((goal-p)*3,.12,.9)`，下调或 instant 可以跳。沿填充边定位云，云尺寸 `10+25*sqrt(p)`，`spd` 的平滑值驱动向后倾斜与发射量。地面阶段揭示，越过每枚石子附近时升起，停载后 wisps 停发，云团在前沿继续呼吸。首次进入 30%–90% 区间出低沉拟声字。画到 100% 时发一次 `sakuga:done`，同时前后景双 burst、七烟团、碎片和 ドン。画面合上后仍有图层持续画小烟团、星光和大勾；标签的 `Complete ✓` 是独立的 DOM 信息。离屏抑制绘制和大效果，完成事件仍照发。 [Progress](https://github.com/finktheartist/sakuga-vfx/blob/c3dabb173928a3ad2372183103caf2e6f50953d0/progress/progress.js#L24-L95)
- **Toggle**。每次 flip 先提交 `checked`、`aria-checked`、表单值，再开帧序列。ON 走 0…42（首帧到终帧约 1.4 s），源帧 4 有压缩，5–11 拖 smear，12–13 命中，14–18 出水冠，19–28 有烘入粉色 カチッ 撞击字，29–39 余势与落稳，40–42 glint 烘入终态。OFF 直接取 11…0（约 .367 s），不是 ON 全序倒播，已稳定的 42 带 glint 切到 smear 产生接缝。快连按从目标固定路线的开头重播，直接设属性和初始 calm 下的新 flip 则走目标端帧。给新人制作两条路线应先对齐端点及轴心，再审翻转中断与纹理接缝。 [Toggle](https://github.com/finktheartist/sakuga-vfx/blob/c3dabb173928a3ad2372183103caf2e6f50953d0/toggle/toggle.js#L10-L61)

### 其他组件的独特机制

| 组件 | 机制 | 提取用法 |
| --- | --- | --- |
| Checkbox | 画 SVG stroke 路径，CSS 延迟 80 ms，240 ms 完成；两斩线、不同比例碎屑，380 ms 后 glint；撤销仅小扑。 | 先布尔提交，再绘标记；逆操作可以降级。 |
| Radio | 原生组负责互斥与箭头，点独立 spring；当前选项一扇 wedges、两 puff 间隔 120 ms、空心 ポン。 | 同一群组转移强调位置，未选项恢复静态。 |
| Input | 监听原生 `input`，用选择前缀、计算字体和 Canvas 测字估算 caret，密码按圆点。每次两瓣小尘、概率碎屑。 | 高频操作可用少量、近锚点反馈；实际插入位置还应验证输入法与长文本滚动。 |
| Tabs | 位置/宽度/竖向 3 个 spring；按位置 spring 速度增宽并从入射侧拖长，距目的地不足 3 px 才落地出 wedges/烟。 | 分离逻辑选中与视觉着陆。内容区需要应用接线。 |
| Rating | 当前分数、ARIA 与表单立即更新。只给新增星做按索引错开的 60 ms 点亮，最多一颗出重反馈，5 星才有 back burst。 | 一组动作递进与最后一个焦点；重新评分需取消旧延迟。 |
| Toast | 从左 -280 px 起动，`sx.v` 伸长；过 x > -10 进入着陆；消息用 `role=status`，停留后缩走。 | 进、稳、退独立；状态文字完整性与 dismiss 的可用性优先。 |
| Tooltip | 由原生帮助按钮 hover/focus/click 触发，气泡底锚缩放/转动，120 ms 后烟团、环、空心字；Escape 关闭。 | 提示内容是状态，靠近来源、避文案遮挡；离开触发器到气泡的行为需要独立核对。 |

### 上游 skill 与现状差异

| 文档或规则 | 对照证据 | 衍生 skill 的处理 |
| --- | --- | --- |
| Twelve 与 all twelve | `tools/build.mjs:NAMES`、registry、gallery 脚本均 11。主/次按钮分别算展品。 | 引用 11 种标签，验证需要两变体时显式写出。 |
| Button 一帧反相 | [根说明](https://github.com/finktheartist/sakuga-vfx/blob/c3dabb173928a3ad2372183103caf2e6f50953d0/README.md#L8-L21) 与文件注释使用“一帧”，`button/README.md` 参数表和 `impact()` 一致为 190 ms，约 11–12 个 60 Hz 画面。 | 规格记录可测时间、峰值和结束帧。 |
| 一拍一两种效果、字落在 hit、静止时无循环 | 主 Button click 同时发多种效果，Progress 中途 rumble、结束 impact 两个独立语义。Progress 在非零进度停滞及完成后仍画小幅动态；gallery 的 demo 自循环。 | 作为编排原则保留，区分主剪影与支持性余势，持续效果按业务状态和可见性授权。 |
| 保持体积、手驱动用 spring | `squashy` 宽度线性补偿；Slider 的正交方向按平方根缩放。视觉面积只近似补偿，Progress 对目标是线性步进限速，Checkbox tick 是 CSS easing。 | 直接操控用受约束弹簧或跟随，状态转场允许受控时间线，保持可读形状。 |
| Reduced motion 去所有效果 | 新发 core 效果被拦，Button 反相和 CSS/Spring 主体运动仍可出现。主题变量不能移除这些。运行中切换只更新 calm，活跃粒子不清；Progress 初始 reduce 创建空 persist handle，后开启没有自动重建，反向切换已有 persist 继续绘画。Toggle 在 flip 时读取 calm，播放中改变偏好不会自动跳到终态。 | 初始与实时切换分测，静态端点与 DOM 状态立即可见，取消当前 FX、时间线与可选主体运动。 |
| Progress 独立页可以拖 Slider 驱动 | [独立页](https://github.com/finktheartist/sakuga-vfx/blob/c3dabb173928a3ad2372183103caf2e6f50953d0/progress/index.html#L21-L44) 只有 Progress 演示，点击重开，脚本监听完成。 | 运行测试需要外部数据时显式移除 demo 后用 `set()` 驱动。 |
| Starter 点按状态和事件 | `aria-pressed` 双向更新，但 off 分支在派发 change 前 return。 | 复用锚点与节拍，业务状态事件应双向一致。 |
| 现有组件用 CSS 重设风格 | 可以即时覆写继承的控件 CSS；Canvas P、局部硬编码、拟声字路径结构和 Toggle 图集像素单独处理。 | 普通接入保留原件与 API。需要全域样式时先选可维护的调色板适配或新资源。 |
| Tabs 无 panels，Tooltip 无 reposition | 两者在说明中已明确。Tooltip 点击有焦点时保持打开，说明中的 tap 打开成立。Tooltip CSS 无位置翻转，Tabs 不处理横向滚动。 | 按项目补 panel 关联、弹出层避障和关停路径。 |

## 运行观察

**实时交互。** 部署 Gallery 及其 11 个脚本下载内容与锁定提交逐字节相同。原版测试由 Edge 157 执行，22 项通过。另用 Chromium shell 159 对固定源执行扩展试验，检查桌面鼠标与键盘、390 CSS px 和 DPR 2 的模拟触控、六种 FormData 值和 11 个独立页初始化。脚本未记录页面异常。受限进程的早期 CDP 启动失败在改用隔离浏览器进程后排除。 [运行数据](evidence/upstream/audit.json) · [原工具输出](evidence/upstream/test-390-edge.txt) · [部署对比](evidence/upstream/hosted.json)

- Slider 的一次慢拖把输入分成 22 步，每步约 75 ms，总共约 .22 条轨道，显示 spring 峰值约 .135 轨道/秒。一次快拖跨 .39 轨道，80 ms 后记录峰值约 3.07；等待 1.2 秒后记录峰值 .156，低于松手阈值，放开为 90，左键一步为 89。该读数来自浏览器实际鼠标输入后的 spring，取样间隔随执行环境浮动。
- Progress 的真实时钟从 `set(1)` 推进到 `aria-valuenow=100`，`sakuga:done` 触发一次。初始 reduce 模式下点 Button，前景 Canvas 未建立，但按钮仍反相，Toggle 直接画 42。播放中的 Toggle 切到 reduce，使用其固定时钟让第 4 帧继续推进到第 8 帧，逻辑仍为 ON。
- 把正在绘制的 Progress 切到 reduce，Canvas 中非透明像素仍超过零。以 reduce 初始连接再切回普通模式，在 23% 时只有空句柄，前景为零像素，重新连接恢复约 4,028 像素。正常连接的 Progress 从 DOM 移除后画面清空。本检查确认显示清理，未测对象引用占用或内存增长。
- 运行时把宿主的 `--sk-acc` 改为 `#005060`，Button 勾号的 computed stroke 更新，Canvas P 仍为 `#ff5fa8`。单独将 `P.accent` 改为 `#b34210` 时，后景 burst 的辐射尖线显示为新色。 [裁切与染色](evidence/upstream/clipping-film.png)

**逐帧与动作边界。** 播放取样暂停 `SakugaFX` 并按 1/60 s 推进，真输入测量使用实时浏览器，不混用计时。下面记录了实际读取的关键画面与可复查的上游局限。

| 样本 | 可见结果 |
| --- | --- |
| [Button](evidence/upstream/button-film.png) | 按压 100 ms 时纵向比例约 .42。click+0/50/183 ms 仍反相，+200 ms 后恢复白底，+450 ms 处三次余势分散到上方，+1.383 s 尚有微小烟环。前景碎片在 +50/+183 ms 读数中短时遮过标签，较大的主按钮效果接近旁边 Cancel。禁前景后比对相同的 back burst，`overflow:hidden` 将尖芒裁到宿主父层。 |
| [Slider](evidence/upstream/slider-film.png) | 单步 30%→31% 看不到云和速度线。大幅右跳时拇指图形拖长，云位于左后方，数值泡立即显示目标 85%。保持后线先退出，云团后退。大幅反向阶跃后快松手，左向弧线处于前侧，右后方留云团，读数 28% 继续可见。该组方向与峰值由脚本喂入原生值路径，触控拖动另测。 |
| [Progress](evidence/upstream/progress-film.png) | 0→21→47→70% 时前沿滚云与地线推进，停在 70 时保留云。测试在 rumble 尚未退场时瞬间到 100，字形有短时重叠，后续切为 DOM `Complete ✓` 和上方的大勾。若页场景切换太快，跨阶段大字需要相互替换。 |
| [Toggle](evidence/upstream/toggle-film.png) | 实际绘制帧依次取样 0、4、10、14、24、32、42，OFF 入口立即 11，随后 6、0；42 到 11 色块明显跳接，终态 glint 静止保留。 [全部 43 个源图格](evidence/upstream/toggle-atlas.png) |
| [快速重入探针](evidence/upstream/audit.json) | 固定时钟下 5 星后下一帧点 2，旧延迟把画面重新点亮成 5，但值是 2。Button 两次激活相距 100 ms，第二次再过 100 ms 时反相已被第一次的回调取消。Starter 两次点击均切换 `aria-pressed`，共一次 change。 |

原版 `look.mjs` 额外生成了一组七帧 Button 画面，+1.4 s 可见画廊的成功勾。这个勾由宿主的原生 `setTimeout` 驱动，原 `look.mjs` 虽停了核心时钟，墙钟仍走，跨时钟显示区间不应用来推算真实动效时长。 [源工具采样](evidence/upstream/original-look-button.png)

## 设计推断

- 内轮廓变形是动作主语。先遮掉 Canvas，看控制点、变化方向和最终状态还能否读出；再加中心冲击和边缘余势。压缩与接触点放在读者预期受力的一侧。
- 峰值强度与色彩只是部分个性。事件阈值、节拍长短、哪些层先占注意力、余势范围，以及拟声字的使用频率，共同决定同一场景是编辑式克制还是漫画式强调。
- 持有对象时先动真对象语义位置，运动壳体只承载视觉滞后；沿速度反方向丢拖尾，在落点沿朝向表达终止。中止、换向和反复操作时需要同一所有者的取消路径。
- 动态完成画面可以用冲击传递确认感，完成信息、失败消息、操作焦点仍需要独立语义载体，可见且可重新进入。真正的低动作模式应同时保留功能并让视觉端点直达。

## 新增设计和保留依据

保留原库的普通控件语义、四段动作、两调描边、方向性余势、模拟时钟和输入验证的分工。 衍生 skill 将“选择原组件”和“新设计”单独路由，加入 CSS / Canvas / 字形 / 图集配置映射、按用途的动作选型、场景效果优先级、低动作与中断规范、范围限制以及可在其他 Web 工程读取的示例。新的场景和配置约定属于衍生设计。 [Skill](../skills/sakuga-motion-design/SKILL.md)
