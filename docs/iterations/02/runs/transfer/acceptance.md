# 闭馆巡检验收

把 `index.html` 复制到候选工作目录，从该副本开始。提交冻结后，在当前浏览器打开成品。用 900 × 700 视口和默认动态效果执行首轮，再用 360 × 780 执行窄屏检查。每个独立场景先重载。以下共六项，全部通过才算通过。

1. **业务状态。** 初始 DOM 队列为 `101,102,103,104,105`。点击工单 104 的按钮，下一次绘制可见它处于优先状态，DOM 队列为 `104,101,102,103,105`。点击工单 103 的按钮，DOM 队列为 `103,101,102,104,105`。再次点击 103，恢复初始顺序。每一步的状态提示和 `aria-pressed` 同步，激活优先项时只有该项处于按下态。点击 101 时顺序天然处于队首，这一操作依然正确切换优先状态。
2. **键盘与焦点。** 重载后仅用 Tab 聚焦工单 104，按 Enter 置顶。焦点仍在同一个 104 按钮，页面可见焦点指示。按空格取消优先并检查焦点。再次置顶 104 后按 Tab，焦点到工单 101 的按钮。共五个可操作按钮，每次按键产生一次状态变化。
3. **动作与方向。** 默认速度下从初始状态置顶 104，再取消优先。分别记录动作刚开始、位移中、落稳三个阶段，帧可来自录屏或浏览器动画检查工具，两次各保留三帧。检查 104 从原位向队首运动，受影响工单向相反方向让位，105 仍在原位可读。取消时位移方向随归位而反转。中途帧可辨认主动工单的定向形变或短促笔触，主动工单仍可辨认。落稳画面与 DOM 顺序一致，按 700 ms 后的姿态检查笔触或其它瞬时效果已收束；正常速度连续观看一遍确认没有可见的错位或闪回。
4. **连续输入。** 将下方脚本粘贴到浏览器控制台。每一步在同步与下一帧至少一个采样点读到最新有效状态。四次点击间隔设为约 70 ms，最后一次清空优先状态。最后的按钮与队列姿态在 900 ms 后稳定可用，无残留遮盖、错位或脱离列表的效果。接着手动点击 102，确认仍可继续操作。
5. **窄屏。** 在 360 × 780 确认工单信息和按钮完整可读。用指针或触屏模拟置顶 105 后取消，过程中的视觉反馈留在列表周边，页面无额外横向滚动。落稳后再次逐条检查可用按钮。
6. **减少动态效果。** 开启 `prefers-reduced-motion: reduce` 后重载并置顶 104，然后取消。状态与顺序在下一次绘制生效，动作没有明显位移拖尾、形变或笔触。还原偏好并在一次重排中切入减少动态效果，检查最后姿态、顺序和焦点正确，后续一次操作遵循新偏好。

## 连续输入脚本

每次在重载后的页面执行。脚本使用初始夹具的操作和定位入口。若实现调整结构，先更新脚本选择器并记录适配。保留点击顺序、间隔和状态预期。

```js
(async () => {
  const actions = [
    { id: '104', priority: '104', expected: '104,101,102,103,105' },
    { id: '102', priority: '102', expected: '102,101,103,104,105' },
    { id: '105', priority: '105', expected: '105,101,102,103,104' },
    { id: '105', priority: '', expected: '101,102,103,104,105' },
  ];
  const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
  const frame = () => new Promise(resolve => requestAnimationFrame(resolve));
  const read = () => {
    const rows = [...document.querySelectorAll('#work-orders > .order')];
    const order = rows.map(row => row.dataset.order).join(',');
    const priority = rows.filter(row => row.querySelector('button')
      .getAttribute('aria-pressed') === 'true').map(row => row.dataset.order).join(',');
    return { order, priority };
  };
  const matches = ({ expected, priority }, samples) => samples.some(sample =>
    sample.order === expected && sample.priority === priority);
  const started = performance.now();
  for (const [index, action] of actions.entries()) {
    if (index > 0) await delay(Math.max(0, started + index * 70 - performance.now()));
    document.querySelector(`.order[data-order="${action.id}"] button`).click();
    const immediate = read();
    await frame();
    const nextFrame = read();
    if (!matches(action, [immediate, nextFrame])) {
      throw new Error(`点击 ${action.id} 后状态与顺序不符`);
    }
  }
  await delay(900);
  if (!matches(actions.at(-1), [read()])) throw new Error('收束后状态与顺序不符');
  console.info('连续输入的队列与优先状态通过');
})();
```
