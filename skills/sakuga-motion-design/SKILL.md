---
name: sakuga-motion-design
description: Design, adapt, and verify sakuga-inspired interface motion with directional squash and stretch, flat ink effects, and authored timing. Use for integrating Sakuga VFX controls, creating related reactions for new controls, text, imagery and exhibition scenes, or tuning their rhythm, materials and effects across projects. 适用于作画感 UI 动效、手绘冲击与速度反馈、展示场景编排及其逐帧验收。
---

# Sakuga Motion Design

输入是项目的对象、事件、状态、交互入口与表现目标。先从项目读取实际布局、焦点、数据更新位置、渲染环境与已有主题；缺省时按真实语义、局部效果、克制强度推进。交付可运行的修改，说明动作选择、调节入口、验证证据及适用范围。单纯静态排版或普通淡入淡出沿用项目工作流。

## 选工作方式

- **接入与调整。** 读 [Web 接入与适配](references/integration.md) 和 [来源](references/sources.md)。按已固定的上游版本复用所需控件，保留真实 DOM/语义、事件、键盘与表单契约。检查页面上的核心实例与加载顺序。区分 CSS、画布和素材三类调整；需改变动作语义或生命周期时，明确自有模块或分支的责任。
- **衍生创作。** 读 [造型](references/visual-language.md) 和 [动作规格](references/motion-recipes.md)。涉及多个对象、页面或连续手势时读 [场景编排](references/scenes.md)。先为动作写明触发、即时状态、主体、锚点、方向、节拍、效果预算、打断与完成条件，再选择合适的绘制方式。

## 实现与验证

1. 让原生操作和状态先可用。一次成功操作只有一个状态提交点；取消、重复、反转各有明确的结果。减少动画时可立即读取同一状态。
2. 为反馈选一个主节拍。主体、装饰的时序由动作含义决定，真实状态即时提交。例如落点的装饰痕迹应在接触拍出现。文字保持可读，拖动对象的焦点和命中面保持稳定。
3. 小型单一反馈可直接用场景内的 CSS 或 WAAPI 表现层。涉及主题适配、多个预设或素材时才读 [个性化](references/profiles.md)；需要借用实现时看 [Web 示例](assets/web/index.html)。主题、尺寸、场景与偏好切换都应结束已过时的视觉批次。
4. 按 [验收](references/verification.md) 单独完成定点取帧和正常速度交互。用实际入口检查状态、层级、恢复、减少动画和重复输入。把源码事实、运行观察、设计推断、新增设计明确区分。
