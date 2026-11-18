# 落版

直接打开 `index.html`。实现时阅读了基线 `SKILL.md`、`references/visual-language.md`、`motion-recipes.md` 的主动作和中断段、`scenes.md` 的落点与中断规则、`profiles.md`、`verification.md`，以及 `assets/web/index.html`、`profiles.js` 和 `scene.js` 中的计数和清场段。

原生按钮每次激活立即增加印次。印板从蓄力抬高、加速下落到纸面压扁，再反弹回稳。两档共享 `profiles`，分别配置抬升、压缩、宽展、回弹、时长、楔线数与色彩。换档撤销当前批次，保留印次和标准焦点，之后的落版使用新档。

Chromium 159 测过鼠标连击、Space、Enter、动作中用键盘和鼠标换档、390 px DPR 2 模拟触摸与横向边界，以及启动和动作中切换减少动画。桌面定点测量中，克制和表现的蓄力抬升约 29 px、64 px，触纸纵向缩放约 0.86、0.65，两档都回到静止姿态。检查了动画帧和移动静止帧，触摸证据来自浏览器模拟。
