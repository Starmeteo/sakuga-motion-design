# 画稿托位

直接打开同目录的 `index.html`。入口为可拖拽、可聚焦的「竖向画稿」滑块，以及「上」「中」「下」三个原生按钮。

读取基线技能的 `SKILL.md`、`references/visual-language.md`、`references/motion-recipes.md` 的 Slider 和中断规格、`references/scenes.md`、`references/profiles.md`、`references/verification.md`。采用原创 CSS 画稿和原生 Pointer Events。抓取点决定预览位置，实际位移速度驱动子层形变和固定在来路的短墨线。停顿让速度失效。提交槽位取释放位置对应的最近中心，取消恢复此前位置。

Chromium 在 390 px 下通过慢拖抓取偏移、快拖形变和墨迹、停顿后释放、Escape、点选、上下键和动作中切换减少动画。另目视检查上下两个方向的快拖画面。模拟触摸检查了启动时减少动画、拖动和触摸取消。未测实体触屏和读屏。
