# 画稿托位

阅读了候选版 `SKILL.md`、`references/visual-language.md`、`references/motion-recipes.md`、`references/scenes.md` 和 `references/verification.md`。画稿为自绘 CSS 平涂山水，操作和动作都在本页实现。

拖动保留触点相对画稿的初始偏移，位置实时跟随，三托位以实际中心确定最近目标。变形用有符号速度控制前缘锚点及宽高，快拖只在来向轨道留下短墨线。释放读取最近一次移动与衰减速度，过了 70 ms 窗口只作轻落点。Escape 或失去触点会清理墨线并回到已选托位。阈值和墨线数量上限集中在 `tuning`。

用 Chromium 无头浏览器从本地文件验证了八组操作，覆盖键盘、点选、快拖、慢拖、反向、停住后释放和立即快速释放，以及 Escape、模拟触屏取消和完成、390 px、加载前和拖动中启用减少动画。检查了快速拖动及窄屏定位截图。触屏验证使用 Chromium 协议模拟。
