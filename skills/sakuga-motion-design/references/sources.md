# 来源与取证边界

本 skill 从 Justin Finkelman 的 Sakuga VFX 派生。研究版本固定为 [c3dabb173928a3ad2372183103caf2e6f50953d0](https://github.com/finktheartist/sakuga-vfx/commit/c3dabb173928a3ad2372183103caf2e6f50953d0)。[在线 Gallery](https://sakuga-vfx.vercel.app/gallery/) 可能随部署变化，源码定位和复现实验用固定版本。

| 查阅目标 | 首选来源 |
| --- | --- |
| 原创作工作流及其边界 | [原 skill](https://github.com/finktheartist/sakuga-vfx/blob/c3dabb173928a3ad2372183103caf2e6f50953d0/skills/sakuga-vfx/SKILL.md)、[README](https://github.com/finktheartist/sakuga-vfx/blob/c3dabb173928a3ad2372183103caf2e6f50953d0/README.md)、[llms.txt](https://github.com/finktheartist/sakuga-vfx/blob/c3dabb173928a3ad2372183103caf2e6f50953d0/llms.txt) |
| 复制与使用具体组件 | [固定源码树](https://github.com/finktheartist/sakuga-vfx/tree/c3dabb173928a3ad2372183103caf2e6f50953d0)，目录内的源码、README 与 demo 对照看 |
| 公共机制 | [原版 core.js](../assets/upstream/core.js) 是根目录核心的原样副本；原 skill 和所有组件使用生成副本。同页先注册的核心生效 |
| 核心产物与真实输入 | [build.mjs](https://github.com/finktheartist/sakuga-vfx/blob/c3dabb173928a3ad2372183103caf2e6f50953d0/tools/build.mjs)、[test.mjs](https://github.com/finktheartist/sakuga-vfx/blob/c3dabb173928a3ad2372183103caf2e6f50953d0/tools/test.mjs)、[取帧工具](../assets/upstream/look.mjs) |
| 原版资源 | [拟声字源图](https://github.com/finktheartist/sakuga-vfx/tree/c3dabb173928a3ad2372183103caf2e6f50953d0/art/words)、[trace.py](https://github.com/finktheartist/sakuga-vfx/blob/c3dabb173928a3ad2372183103caf2e6f50953d0/tools/trace.py)、[Toggle 画稿图集](https://github.com/finktheartist/sakuga-vfx/blob/c3dabb173928a3ad2372183103caf2e6f50953d0/toggle/frames.webp) |

原版文件在 `assets/upstream/`，保持 [MIT 许可和原版权声明](../assets/upstream/LICENSE)。其中 `starter.html` 与 `look.mjs` 源自原 skill；`core.js` 含已描摹的拟声字路径。组件内嵌核心与 Toggle 图集通过固定上游按需获取。新场景使用自己的代码、造型和文字。

在使用报告中将证据按发生方式表述。源码事实可定位到冻结版本的行或函数；运行观察注明输入、环境及截图/状态；设计推断说明从哪些证据提炼；新增设计记录项目如何实现及验证。当前 skill 的场景规则和预设是新增设计。
