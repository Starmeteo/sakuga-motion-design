# 标记校样

阅读了候选版 `SKILL.md`、`references/visual-language.md`、`references/motion-recipes.md`、`references/scenes.md` 和 `references/verification.md`。从零实现原生按钮和局部 WAAPI 动作。

原生 `click` 同步提交开关值和「待校／已校」。按住时底缘固定，印面压低，文字保持比例。标记后约 45 ms 进入压缩峰值，背后的单枚几何印芒同时出现，252 ms 内回稳。取消标记采用 155 ms 小幅回弹。按住拖离只复位；新输入和减少动画都会清理已有装饰。动作时序可在脚本末尾的关键帧中调整。

用 Chromium 无头浏览器从本地文件验证了六组操作，覆盖 Tab、Enter、Space、鼠标移出后释放、连续切换、390 px、加载前和动作中启用减少动画，以及模拟触屏点按与拖离。暂停 WAAPI 批次后采样 0、32、49、65、123、251 ms，检查接触拍与文字层，另检查了持按和窄屏截图。触屏验证使用 Chromium 协议模拟。
