# 图片放置说明

把生成的图片以资产编号命名后放进本目录（与本文件同级），刷新页面即会自动替换占位块。支持 `.webp` / `.png` / `.jpg`，按此顺序查找。

| 文件名 | 位置 | 画幅 |
|---|---|---|
| `H-01` | 首屏主视觉（未提供时暂用第 11 版插画） | 16:9 |
| `P-01` ~ `P-04` | 序章四幕 | 16:9 |
| `E-01` ~ `E-06` | 纹章：玩法 / 内核 / 美术 / 营地 / 狩猎 / 决战（黑线白底） | 1:1 |
| `T-01` | 章节扉页底纹（可平铺） | 1:1 |
| `G-01` ~ `G-03` | 营地 / 狩猎 / 决战 | 3:2 |
| `K-01` ~ `K-03` | 内核三张竖图（放在巴洛克边框里） | 2:3 |
| `A-01`、`A-02` | 怪物图鉴特写 | 4:5 |
| `A-03` | 猎人群像 | 16:9 |
| `A-04` | H-01 的线稿版 | 16:9 |
| `C-01` | 装备概念稿（未提供时暂用第 10 版装备图） | 3:2 |
| `Z-01` ~ `Z-03` | 尾声画廊 | 21:9 |

`existing/` 里是从设计文档库复制的第 10、11 版现有图，以及从边框组件图裁出的三种边框。

纹章会通过 `mix-blend-mode: multiply`（纸面）或反相后 `screen`（深色扉页）去掉白底，所以纹章请生成为**纯白底黑线**。

封面头骨 `skull-butterfly.webp` 由 `source/skull-butterfly.jpg` 去白底得到，不在上表编号体系内。

## 第三章（美术）：手绘概念稿

美术章节里的图（`A-01` ~ `A-04`、`C-01`、`Z-01` ~ `Z-03`）要像概念设计师的工作稿，而不是成品插画。两种画法任选其一，同一张图里不要混用：

- **厚涂概念稿**：看得见的笔触与刮刀痕，边缘松，不追求每处都画完；色块大而概括，冷灰蓝底上只留一处暖光。
- **线条草稿**：铅笔或墨水速写，保留结构线、辅助线和反复修正的重叠线条；排线表现明暗；可以带手写标注和局部放大的小图；纸面有底色与纹理。

要避免的“AI 感”：线条过分干净均匀、处处同样精细的装饰、塑料或金属高光、完美对称、没有取舍的满画面细节、边缘发光。

可直接用的英文描述（按画法二选一，后接每张图的内容）：

```
厚涂：concept art sketch, loose painterly brushwork, visible brush strokes and palette-knife marks, unfinished edges, limited muted palette of cold grey-blue with a single warm light, design-process feel, not a finished illustration
线条：rough concept design sketch, graphite and ink on toned paper, construction lines, overlapping searching strokes, cross-hatching for shadow, handwritten annotations and small detail callouts, design-process feel, not a finished illustration
避免：clean vector lines, uniform detail, glossy highlights, perfect symmetry, glowing edges, airbrushed gradients
```

| 编号 | 内容 |
|---|---|
| `C-01` | 装备设定页：从左到右依次是罩灯、长矛、肋盾、旅行胫甲，横向排开，中心大约在画面宽度的 16% / 34% / 55% / 82%（页面下方的引线标注按这个位置画）。材质是兽骨骨架、鞣皮与布、筋腱和皮绳捆扎，少量金属。白底或浅色纸底 |
| `A-01` | 玻璃骨髓圣像：六足、逆关节，折叠的掌形头颅没有面孔，透明的胸腔里悬浮着琥珀色骨髓。暗底 |
| `A-02` | 空手唱诗团：黑日般的空洞头环，象牙色的掌片躯干，六只手臂的掌心里各有一张嘴。暗底 |
| `A-03` | 猎人群像：五人一排的角色设定稿，白底 |
| `A-04` | H-01 的线条草稿版，构图与 H-01 完全一致（用于线稿 / 成品对比滑块） |
| `Z-01` ~ `Z-03` | 尾声场景概念稿：手掌石桥与黑日 / 遗迹圣物花园 / 脊椎钟塔的淹没村落 |
