# 标记校样样例

双击打开 [index.html](index.html) 即可使用。页面使用原生按钮和 `aria-checked` 表达开关状态。鼠标、触摸和键盘激活都由原生 `click` 同步更新「待校」或「已校」。

## 实现依据

读取了 [任务说明](../../../tasks/01-mark.md) 与第二轮候选的 `SKILL.md`、`references/visual-language.md`、`references/motion-recipes.md` 和 `references/verification.md)。 [快照指纹](../../../versions.json)

把按压形变分配到以底缘为支点的章面，标签与命中区保持固定。持按约 205 ms 收到蓄力姿态。确认后以一次压扁命中带出贴近底缘的四枚墨楔，约 250 ms 收尾。取消标记只有 155 ms 的小幅回弹。新动作接管当前装饰，减动效通过 CSS 立即复位，并取消运行中的动画。章面调色位于 CSS 变量，节拍位于脚本的 `windUp`、`strike` 和 `lift`。

## 浏览器验证

- 用 Chromium Headless Shell 打开本地文件，实际按鼠标和键盘验证持按、移出释放、Tab 焦点、Enter、Space 和连续七次点击。核对每次状态、按压复位及最后一态。
- 分别在启动前、动作命中时和持按期间启用减少动画。文字和 ARIA 同步更新，章面归位，墨楔消失。恢复偏好时没有补播。
- 在 390 × 680、DPR 2 的模拟触屏上验证双向轻触切换和触点取消。检查静止、持按和命中收尾画面，取样 27、60、160、250 ms，标签完整可读，250 ms 无余势。触摸覆盖来自浏览器模拟。
