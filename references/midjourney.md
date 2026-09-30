# Midjourney 提示词指南（Skill 内置）

用户要 **MJ 提示词 / Midjourney 参数 / MJ 生图** 时使用本文件。目标：产出可直接粘贴到 `/imagine` 的高质量 MJ 提示词。

## 一、默认风格与属性（用户偏好，均为可改属性）

写 MJ 提示词时**默认带入**以下设定，用户明确改了就用改的值：

| 属性 | 默认值 | 可改为 |
|---|---|---|
| 风格 | **写实 3DCG**（`high-quality 3D CGI render, realistic PBR materials`） | 二次元 / 水墨 / 电影感 / 插画… |
| 构图 | **电影级构图**（三分法 / 引导线） | 对称 / 中心 / 极简 |
| 景别 | **远中近三层结合**（纵深） | 简化层次 |
| 前景 | **有故事感的实体元素**（非框架式遮挡、非纯地面） | 指定元素或去掉 |
| 镜头焦段 | **35mm** | 24 / 50 / 85 / 135mm |
| 光圈 | **f/1.4**（人与机体都需清晰时用 f/2.0） | f/1.8 - f/8 |
| 取景 | **非半身照**（全身 / 宽松） | 七分身 / 半身 / 特写 |
| 焦点 | **焦内锐利**（`tack-sharp focus`） | — |
| 光斑 | **强化奶油虚化光斑**（`enhanced creamy bokeh orbs`） | 减弱 |

> ⚠️ **前景规则**：不要用"栏杆/控制台边缘"这类**画框式**前景；要放**叙事性实体元素**（散落文件、电缆、积水倒影、瓦砾、遗落装备…）；地面不要是空的。

## 二、提示词结构

```
/imagine [画面描述] [参数]
```

**核心原则**：描述**看得见的东西**，不写抽象概念；短而具体优于长而空洞。重要元素放前面。

## 三、7-Element 框架

| 元素 | 问自己 | 示例 |
|---|---|---|
| **Subject 主体** | 谁/什么？ | a young woman in a white sci-fi bodysuit |
| **Medium 媒介** | 什么形态？ | 3D CGI render / photograph / oil painting |
| **Environment 环境** | 在哪？ | vast NERV hangar / rainy street at dusk |
| **Lighting 光照** | 怎么打光？ | golden hour backlight / cold industrial god rays |
| **Color 色彩** | 什么色调？ | muted desaturated palette / warm amber and cyan |
| **Mood 情绪** | 什么感觉？ | melancholy stillness / tense and imposing |
| **Composition 构图** | 怎么取景？ | wide low-angle hero shot / rule of thirds |

## 四、常用模板

**人像 / 角色**
```
[年龄/特征] [性别] [动作], [服装], [环境], [光照], [相机] [焦段] [光圈], [胶片] --ar 2:3 --style raw
```

**场景 / 环境**
```
[场景], [时间], [天气], [氛围], 前景有[元素], 远中近景别, [相机] --ar 16:9
```

**3DCG 特效合成**
```
[主体], [特效元素], high-quality 3D CGI render, realistic PBR materials,
subsurface scattering, volumetric light, [环境], [光照] --ar 3:4 --stylize 200
```

**故事感 / 艺术感场景**（无机甲也可以）
```
[人物] 独自在 [场景], [光线特征], 前景有[叙事元素],
in the visual style of [作品], muted palette, melancholy stillness --ar 16:9 --stylize 250
```

**动漫（Niji）**
```
[主体], [动作], [环境], [风格说明] --niji 6 --ar 2:3
```

## 五、参数速查

| 参数 | 作用 | 取值 | 默认 |
|---|---|---|---|
| `--ar` | 画幅 | 16:9 / 9:16 / 3:4 / 2:3 / 1:1 / 21:9 | 1:1 |
| `--stylize` / `--s` | 艺术化程度 | 0-1000 | 100 |
| `--chaos` / `--c` | 四图差异度 | 0-100 | 0 |
| `--weird` / `--w` | 怪异美学 | 0-3000 | 0 |
| `--no` | 排除元素 | 词，逗号分隔 | — |
| `--seed` | 复现 | 0-4294967295 | 随机 |
| `--style raw` | 减少美化（写实必备） | — | 关 |
| `--tile` | 无缝贴图 | — | 关 |
| `--niji` | 动漫模型 | 6 | — |
| `--draft` | 草稿模式（快、省） | — | 关 |

**参考类参数**

| 参数 | 作用 | 权重 |
|---|---|---|
| `--sref [URL/编号]` | 复制风格 | `--sw 0-1000`（默认 100） |
| `--cref [URL]` | 复制角色 | `--cw 0-100`（默认 100，0=只保脸部） |
| `--iw` | 图片提示权重 | 0-3（默认 1） |

**画幅建议**：人像竖幅 `2:3` / `3:4`；宽景场景 `16:9`；超宽史诗 `21:9`；手机壁纸 `9:16`。

## 六、多提示词与权重

用 `::` 让概念独立解读，`:N` 控制权重：
```
forest::3 cabin::1 river::1        → 森林为主
plum blossom grove::2 ancient temple::1   → 梅花更重
```
负权重等价于排除：`flowers::-0.5`

## 七、垃圾词黑名单（V7 默认高质量，写了浪费 token）

❌ 不要写：`4k / 6k / 8k / 16k / ultra 4k / octane / unreal / v-ray / lumion / HDR / high-resolution / award-winning / photorealistic`（除非确有必要）

## 八、风格参考与角色一致

- **锁风格**：`--sref [参考图URL] --sw 200`（权重拉高更贴）
- **锁角色**：`--cref [角色图URL] --cw 80`（脸+发型+服装）／`--cw 0`（只保脸）
- **随机找风格**：`--sref random`

## 九、EVA 相关约定（重要）

涉及 EVA 机甲时，**一律是零号机 EVA-00（橙白配色，凌波丽驾驶的机体）**，必须与初号机 EVA-01（紫绿）区分：

- **三重防混淆**：① 全名 `EVA Unit-00 (EVA-00)`；② 配色 `orange-and-white prototype`；③ 参数 `--no Unit-01, purple, green`
- 补强：注明 `piloted by Rei Ayanami`，并写机体特征 `single glowing eye visor, horned forehead, shoulder restraint pylons marked "00", entry plug, umbilical cable`

## 十、反推与迭代

- **反推 MJ 提示词**：给一张图 → 按「主体/媒介/环境/光照/色彩/情绪/构图」+ 参数倒推
- **迭代**：首图满意后用 `--seed [数值]` 复现再微调；改一处只动一个词，便于归因
- **探索**：`--draft` 快速试，确定后去掉再出正式图
