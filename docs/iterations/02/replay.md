# 复跑迭代验收

开发产物是可直接打开的 `index.html`。自动化需要 Node.js 和已安装的 Playwright。默认使用 Playwright 安装的 Chromium，`SAKUGA_CHROMIUM` 可指向另一处同兼容性的 Chromium，`PLAYWRIGHT_MODULE` 可指向 Playwright 的 `index.mjs`。以下从仓库根运行，将复跑结果写入另选的目录。

- [check-controls.mjs](check-controls.mjs) 接受题号、产物目录、输出目录。拖动题可附第四个参数将手柄定位到另一个合适的节点。第三轮的手柄为 `.draft`，基线与第一轮用默认的 slider 角色。
- [check-scenes.mjs](check-scenes.mjs) 接受 `--case`、`--input`、`--out`、`--playwright`，可选 `--chromium` 与 `--selectors`。按各报告旁边的 `selectors.json` 对应图板、文字与效果；断言使用同样的动作、状态与视觉标准。
- [check-transfer.mjs](check-transfer.mjs) 接受工单样例 HTML 路径和结果目录。独立任务的 [验收](runs/transfer/acceptance.md) 也能直接在浏览器执行。

```powershell
node docs/iterations/02/check-controls.mjs 01 docs/iterations/02/runs/round-2/01 replay/01
node docs/iterations/02/check-controls.mjs 02 docs/iterations/02/runs/round-3/02 replay/02 '.draft'
node docs/iterations/02/check-scenes.mjs --case 04 --input docs/iterations/02/runs/round-1/04 --out replay/04 --playwright $env:PLAYWRIGHT_MODULE --selectors docs/iterations/02/runs/round-1/04/evidence/selectors.json
node docs/iterations/02/check-transfer.mjs docs/iterations/02/runs/transfer/index.html replay/transfer
```

稳定状态与输入路径按机器判定，读形、接触时序与短暂遮挡需要打开同批画面。以 `fixed` 标记的帧来自冻结 Web Animations 时间轴，余下动作帧附浏览器实时时钟采集窗口。复跑可比较 [固定题面和验收指纹](frozen-inputs.json) 与 [四个技能快照的文件指纹](versions.json)。
