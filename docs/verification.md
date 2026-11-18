# Sakuga Motion Design 验收记录

2026-11-18（北京时间）。上游研究的证据独立列在 [覆盖矩阵](coverage.md)。本页验证衍生场景和 skill 的迁移能力。时间以动作时钟为准，实时输入取样会受浏览器调度影响。

## 样例与实现

Ink & Inertia 是原生 DOM、CSS、Canvas 2D 的作品展示练习。 [运行方式](../README.md#运行-web)

| 任务 | 实现选择 | 证据 |
| --- | --- | --- |
| 重演 Button 的压击 | 持有弹簧压扁。原生 click 立即更新印次，释放时反相和中心背层冲击交给主拍，烟和碎屑后退。取消只收回蓄势 | [压击帧图](evidence/demo/impact-sheet.png) |
| 将 Slider 的速度反馈移植到版画 | 保留抓取偏移，轨道宽度归一化，有符号速度低通并衰减。快拖横拉纵缩，尾迹逆向，快松沿前进方向斩过。提交最近位置；键盘步进与单点入口提交相同状态 | [拖动画面](evidence/demo/drag-sheet.png) |
| 完成新场景动作 | 章节文本和读序即刻更新，图板与标题分别入场、过冲、回稳。斩线与烟的活动区域限制在图板侧，旧批次随新章节取消 | [双预设同帧对照](evidence/demo/reveal-comparison.png) |
| 双预设 | CSS 与 Canvas 共用色表，描边、方向位移、速度阈值、弹性、持续时间、层级额度独立调整。表现版章节增加楔线，表现版压击加入矢量字 | [预设配置](../skills/sakuga-motion-design/assets/web/profiles.js) |
| 减少动画 | 初载与运行中媒体查询都生效，保留印次、章名与位置，取消运动、清空画布并隐藏其表现层 | [机器读数](evidence/demo/results.json) 的 `live.reducedAtLoad` 与 `live.reduced` |

### 正常速度交互

Windows 桌面 Chromium Headless Shell 159.0.8154.6、Playwright 1.65.1，本地 HTTP。桌面 1360 × 920 CSS px、DPR 1；缩至 750 × 820 验证容器重算；触摸走 390 × 844、DPR 2 的仿真和 Chromium CDP 输入。浏览器按正常时钟推进，键鼠和触摸通过浏览器实际输入路径。 [复测脚本](../tools/verify-demo.mjs) · [桌面静态截图](evidence/demo/desktop-rest.png) · [触摸视口截图](evidence/demo/touch-390.png)

- 键盘 Enter、Space 和鼠标各提交一次印次，松在按钮外没有新增印次。版画滑块的方向键、End、点选和 ARIA 值一致。
- 慢拖采样速率约 +0.046 轨道宽/秒，横向缩放 1.010，尾迹画布无非透明像素；左向快拖约 −0.967、1.194、1236 像素，最后一条尾线向右。停住 300 毫秒再松手没有补斩线。Escape 和触摸取消保留先前承诺的位置，正常触摸拖动提交新位置。 [实时拖动截图](evidence/demo/live-fast-drag.png)
- 短间隔切换章节以最后一次点选为准。视口缩放重算画布并清理进行中的粒子；主层和触点继续对齐。主题各自的新动作在 Canvas 上捕获到该主题的墨色像素。
- 动作中切到减少动画，压击纵向系数回到 1、版画横向系数回到 1、标题偏移归零，三个画布像素均清空。恢复偏好后，旧批次保持清空，新输入正常绘制。销毁后的按键和点击入口不再提交，调度停止。

### 固定时刻检查

1200 × 900 CSS px、DPR 1。用真实输入激活页面自身事件，将示例时钟暂停后推进到精确取样点。固定种子 33713 下两次章节逐帧 PNG 的 SHA-256 相同，换成 14431 可见变化。原版取帧工具和衍生时钟分别执行。

- **压击帧图**以 16 ms 按下、145 ms 释放取样。94 ms 处仍在持有，145–184 ms 显示反相与尖形冲击，字样位于按钮外侧，随后烟尘展开。1000 ms 时回到稳定外观，印次仍可读。
- **拖动帧图**在 39、66、91 ms 沿右侧施加移动，111 ms 松手。拉伸最高 1.36，尾迹在左侧，前向斩线随释放出现；750 ms 归位并清屏。冻结读数中释放速度约 2.51 轨道宽/秒。最初以滞后的版画作为斩线锚点，斩线在追赶段容易被版画遮住。改到落点前缘并限制出界后，111 和 157 ms 的斩线与尾迹分居两侧。
- **章节对照**以 16 ms 为同一次章节触发。初始标题偏移量为 −12 px、−23 px。两版分别配置 346、500 ms 的主体总时长，较强版在 380 ms 的画面仍可见图板轨迹和残余图形，560 ms 两版都回到静止。两版切换后的文本与选中语义一致。差异包含位移、时长、描边和效果组合。

## 独立迁移

独立代理在隔离目录只收到独立 skill、布置的任务和浏览器工具路径。任务是给编辑部作品集做海报移除与撤销。它自行采用即时列表提交、后进先出恢复、稳定操作条的短促墨线和原槽位缩略图的回落。真实输入与定点检查共七组通过，其中快速移除/撤销、空列表回填、焦点与动态减少动画均有断言。 [可直接打开的页面](evidence/forward/index.html) · [代理试做日志](evidence/forward/forward-log.md) · [浏览器记录](evidence/forward/evidence/report.json)

试做暴露了结构变更时的旧影处理、移除与恢复的焦点移交、通用 WAAPI 取帧三处文档缺口。已在 [场景编排](../skills/sakuga-motion-design/references/scenes.md#对象移除与恢复) 与 [验收](../skills/sakuga-motion-design/references/verification.md#定时取帧) 补充，随后对归档的迁移产物运行同一套浏览器检查。

## 验证范围

证据覆盖此 Web 实现与基线浏览器、相应键鼠和模拟触摸输入。未测物理移动设备、Safari/Firefox、屏幕阅读器的实际语音或低端设备帧耗，未给出性能结论。其他环境使用 [技术适配](../skills/sakuga-motion-design/references/integration.md) 的边界重新验收。布局或艺术资源变更后，按 [验收模板](../skills/sakuga-motion-design/references/verification.md) 重做关键姿态与操作。

重新运行衍生验证，需可用的 Node.js 和 Playwright Chromium。安装 Playwright 后从仓库根执行 `node tools/verify-demo.mjs`。可用 `PLAYWRIGHT_MODULE` 指定可选的 Playwright ESM 文件、`SAKUGA_CHROMIUM` 指定 Chromium 可执行文件，或给脚本传入输出目录。浏览器测试自身启动本地临时端口，无需先开演示服务器。
