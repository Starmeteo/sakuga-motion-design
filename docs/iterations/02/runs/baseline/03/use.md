# 章节卡

直接打开 `index.html`。实现时阅读了基线 `SKILL.md`、`references/visual-language.md`、`motion-recipes.md` 的主动作和中断段、`scenes.md`、`profiles.md`、`verification.md`，以及 `assets/web/index.html`、`profiles.js` 和 `scene.js` 中的章节切换和清场段。

按钮在同一次事件中提交标题、说明、图板和选中态。标题在排版中保持静止。原创 Canvas 图板随目标顺序从左或右进入，过冲一次后回稳。速度线限制在图板区域。每次改选都撤销旧批次。方向键和 Home、End 可选章，Tab、Enter、空格和触摸使用原生按钮。

Chromium 159 测过鼠标快速反向改选、键盘、390 px DPR 2 模拟触摸与横向边界、启动和动作中切换减少动画。桌面两方向在 16 ms 分别位于静止点右、左约 34 px，178 ms 越过静止点约 9 px，369 ms 已回稳。检查了动画帧和移动静止帧，触摸证据来自浏览器模拟。
