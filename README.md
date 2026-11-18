# Sakuga Motion Design

面向原生控件、图文作品和展示场景的作画感动效 skill。规则从 Sakuga VFX 的固定提交 `c3dabb173928a3ad2372183103caf2e6f50953d0` 提取，配有可复用的 Web 实现，以及上游和衍生版的交互、逐帧和迁移记录。

## 使用 skill

将 [`skills/sakuga-motion-design/`](skills/sakuga-motion-design/SKILL.md) 整个目录加入 Codex 可发现的 skills 路径，或在对话里明确指向该目录的 `SKILL.md`。使用时保留内部目录结构，按需读取 references 和 assets。

本机已安装为 Codex 用户级 skill，并在项目目录外复查了发现状态。 [发现记录](docs/evidence/discovery.json)

> 使用 $sakuga-motion-design 为作品集的章节切换设计局部作画动效。保留原有页面状态和焦点，实现克制版本，给我定点取帧和正常速度操作的验证结果。

## 运行 Web

在本仓库根目录运行下面的命令。

```sh
python -m http.server 8000 --bind 127.0.0.1
```

打开 [Ink & Inertia](http://127.0.0.1:8000/skills/sakuga-motion-design/assets/web/)。按住 **Make a print** 再松手、左右拖动版画、切换章节，分别在 **Restrained** 和 **Expressive** 下体验。同一可拖对象支持方向键及三个位置按钮。原版 [Starter](http://127.0.0.1:8000/skills/sakuga-motion-design/assets/upstream/starter.html) 使用原版核心。

## 研究与验收

- [分析报告](docs/analysis.md) 与 [覆盖矩阵](docs/coverage.md) 记录上游源码、素材、工具和逐项验证。
- [衍生示例验收](docs/verification.md) 记录独立的实时输入、固定时间取帧、双预设、生命周期与后续适用边界。
- [原版许可](skills/sakuga-motion-design/assets/upstream/LICENSE) 随复用的核心、Starter 和取帧工具保留。出处与分发方式见 [来源](skills/sakuga-motion-design/references/sources.md)。
