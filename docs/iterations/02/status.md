# Sakuga Motion Design · 迭代 02

基线是可恢复的 [55bd33b](https://github.com/Starmeteo/sakuga-motion-design/commit/55bd33ba3a6659ce32c0e2542dd113a5129eea15)。第三轮候选为本次正式 skill。[入口](../../../skills/sakuga-motion-design/SKILL.md) · [现状与基线证据](baseline.md) · [固定验收](criteria.md) · [版本指纹](versions.json)

## 轮次与决定

| 轮次 | 证据与根因 | 接受的变更与独立复验 |
| --- | --- | --- |
| 1 | 旧技能要求状态即时更新，落版开发者将印次和装饰印痕一并揭示。两档固定 65 ms 的纸面已有印痕，印板仍悬空；计数即时正确。两个单一反馈都额外读取了主题与素材参考。 | 场景说明区分业务提交和接触拍，个性化说明让压缩、印痕及楔线共用各档命中时钟。入口将调色、双档和素材阅读改为按需。独立重做的 04 在固定 65 ms 仍未出印，两档分别约 105/170 ms 接触出印、印次从首个状态采样即为 1。两档时长 318/465 ms、纵向压缩 0.88/0.74、接触楔 2/6。新 01/02 均跳过主题参考，03 仍为揭示参数按需查阅。 [接触对照](contact-comparison.png) · [04 产物与验证](runs/round-1/04/evidence/report.json) |
| 2 | 第一轮 01 恢复系统偏好后，文字层从 `none` 到 `translateY(0)` 产生 110 ms 的 `CSSTransition`。标签没有位移，浏览器仍创建了过渡，违反无输入恢复应安静的 M 项。 [定向探针](runs/round-1/01/evidence/preference-probe.jsonl) | 说明两种偏好共享同一静止属性，并检查恢复后 CSS 与 WAAPI 是否都空闲。新代理仅看第二轮 skill 重做 01，规范脚本 6/6 通过，持按和已提交的两条恢复路径均无陈旧动画。 [复验](runs/round-2/01/evidence/report.json) |
| 3 | 第一轮 02 进入减少动画后，CSS 已隐藏墨迹，两个 WAAPI 动画仍在运行。调试看到该页初次切回普通动效时能收到 `change`；持续 RAF 读取同个对象的 `.matches` 后，再次进入减少动画，查询值更新但该清理监听未被调用。只将热路径改为读取事件缓存的临时诊断副本通过同样断言。 [定向探针](runs/round-1/02/evidence/preference-probe.txt) | 在拖动规格加入偏好缓存、主动清场与保留合法手势的做法。新代理只看第三轮 skill 重做 02，规范脚本 4/4 通过；另用 390 px 仿真触屏确认活动拖动进入减少动画时画面清空、恢复后无旧迹，并可继续松手提交。 [复验](runs/round-3/02/evidence/report.json) · [执行记录](runs/round-3/02/use.md) |

保留三轮中验证通过的指导，第一轮候选因两个偏好回归未作为独立版本发布。未改变已发布的 Web 资源、上游核心与许可。诊断页面与评测记录保存在 skill 之外。开发产物来自不同独立执行者，每项为有限样本，对照支持具体修复结论。

## 最终回归

| 任务 | 证据 | 最终判定 |
| --- | --- | --- |
| 标记校样 | [样例](runs/round-2/01/index.html) · [记录](runs/round-2/01/evidence/report.json) | 6 组通过。持按、击中和撤销样本轮廓清楚。 |
| 画稿托位 | [样例](runs/round-3/02/index.html) · [记录](runs/round-3/02/evidence/report.json) | 4 组通过。慢／快拖纵向比例约 1.02／1.29，快拖来路有墨；停 350 ms 再放无高速反馈。 |
| 章节卡 | [样例](runs/round-1/03/index.html) · [记录](runs/round-1/03/evidence/report.json) | 14 项通过，图板可辨正反方向，文字与最后状态一致。 |
| 落版双档 | [样例](runs/round-1/04/index.html) · [记录](runs/round-1/04/evidence/report.json) | 12 项通过。人工核对两档接触拍通过。 |
| 静态文案 | [控制题](tasks/05-unrelated.md) · [选择记录](routing.md) | 旧版和候选目录描述各由一个独立代理判定，均只做一行文本改动。 |

03/04 保留第一轮独立产物，后两轮更改只针对持按 CSS 与 RAF 拖动。阶段开始及末尾均运行了现有综合 Web 演示和上一阶段的海报撤销回归。测试使用 Windows 上 Playwright 1.65.1 与 Chromium Headless Shell 159.0.8154.6。[复跑方式](replay.md)

验收中发现脚本将透明原生 radio 本身当作可见面，导致错误判定 390 px 上的换档入口不可读。真实触摸已经命中且提交正确。将测量映射至与 radio 关联、可见且可命中的 label 后，同一标准重跑基线与候选，04 均为 12/12。业务判定和画面标准保持不变。

## 保留任务与限制

独立代理在最终候选冻结后才获得工单队列任务和初始页面；开发轮次未使用其题面或实现。[封存要求](runs/transfer/request.md) · [验收](runs/transfer/acceptance.md) · [可运行样例](runs/transfer/index.html) · [机器记录](runs/transfer/evidence/report.json)

六组通过。900 px 置顶 104 时，其画面纵坐标由约 359 px 到 123 px，归位时方向反转，105 始终在约 435 px，收束后零活跃动画。四次连续激活的间隔约 75、78、63 ms，最终恢复编号顺序。360 px 下模拟触摸、键盘焦点及两种减少动画条件通过。经过时编号仍能辨认，相邻工单的部分正文会被前景工单短暂盖住，落稳后恢复。 [起势与归位帧图](runs/transfer/use.md) · [上移中段](runs/transfer/evidence/advance-mid.png) · [下移中段](runs/transfer/evidence/return-mid.png)

独立执行记录覆盖目录选择和实际参考读取，未获得 Codex 客户端自动分发的统计。未测物理设备、实物触屏、Safari/Firefox、屏幕阅读器播报或帧耗。对减少动画 MQL 行为的结论限于本次 Chromium 浏览器与观察到的实现。

下一轮优先用竖向画稿样例在 Firefox 与 Safari 重测持续触点中的偏好开关，核对清场、恢复和合法提交。保留同一轨迹及输入条件，查清事件差异后再改跨渲染器的规则。
