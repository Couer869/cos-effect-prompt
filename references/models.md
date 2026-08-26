# 多模型适配知识库

用户要提示词时，**先辨别目标模型**，再用该模型最合适的格式输出。辨别与格式规则如下。

## 一、模型注册表

| 模型 | 识别关键词（用户怎么说） | 输出格式 |
|---|---|---|
| **Nano Banana**（默认） | 没提模型 / Nano Banana / 香蕉 / Gemini 图像 | 插件预设信封（JSON，见 SKILL.md） |
| **ComfyUI / Stable Diffusion** | comfyui / comfy / stable diffusion / SD / WebUI / A1111 / 采样器 / CFG / 步数 / LoRA / 负面提示词 / checkpoint / 负面词 | SD 风格：正向 tag + 负向 tag + 参数 |
| **Midjourney** | mj / midjourney / --ar / --v / --stylize / --sref / MJ 风格 | 自然语言 + `--参数` |
| **NovelAI** | novelai / nagi / danbooru / 二次元 tag / 标签 | Danbooru 标签（逗号分隔） |

**默认**：用户没说模型 → 一律按 Nano Banana 信封格式。

## 二、ComfyUI / Stable Diffusion 输出格式

```json
{
  "model": "comfyui",
  "positive_prompt": "masterpiece, best quality, 1girl, solo, white dress, ...特效tags...",
  "negative_prompt": "bad anatomy, extra fingers, deformed hands, worst quality, low quality, blurry",
  "params": {
    "steps": 28,
    "cfg": 7.0,
    "sampler": "dpmpp_2m",
    "scheduler": "karras",
    "clip_skip": 2,
    "seed": null,
    "size": "1024x1024"
  }
}
```

### tag 语法
- 逗号分隔；权重 `(tag:1.2)` 加强、`(tag:0.8)` 减弱、`[tag:0.9]` 渐弱
- 负面词照抄到 `negative_prompt`（构图/人物保护写进负面：`bad perspective`、`distorted`、`extra person`）
- 特效/元素用英文 tag，从下表「特效 tag 对照」取

### 特效 tag 对照（effects.md 中文描述 → SD tag）

| effects.md 特效 | SD tag 示例 |
|---|---|
| 魔法阵 | `magic circle, glowing runes, golden light, intricate geometric pattern, luminous, on ground, perspective` |
| 火焰 | `fire, flames, embers, glowing, warm lighting, orange and gold` |
| 雷电 | `lightning, electric arcs, blue purple glow, sparks, energy` |
| 冰霜 | `ice crystals, frost, icy blue, frozen, cold light, crystalline` |
| 翅膀 | `white feathered wings, angel wings, spread wings, glowing edges` |
| 光环 | `holy halo, golden ring, soft glow, floating above head` |
| 粒子/光尘 | `glowing particles, sparkles, floating lights, bokeh, dreamy` |
| 霓虹 | `neon lights, cyberpunk, glowing signs, wet street reflection, purple blue` |
| 雨天 | `rain, rain drops, wet ground, reflections, cinematic` |
| 花瓣 | `falling petals, cherry blossoms, pink petals, dreamy` |
| 赛博街景 | `cyberpunk city, neon signs, skyscrapers, rainy street, holograms, night` |

其他特效按此规律把中文描述转成英文 tag：主体物 + 颜色/材质/光效 + 位置/关系。

### 人物保护（对应 base_rules / constraints）
- 正面加：`photorealistic` / `detailed face` / `sharp focus` / `perfect anatomy`
- 负面加：`bad anatomy`、`extra fingers`、`deformed`、`distorted`、`extra person`、`bad perspective`
- 透视一致 → 负面 `bad perspective, wrong perspective`；正面可加 `correct perspective, proper vanishing point`

## 三、Midjourney 输出格式

自然语言描述 + `--参数`（MJ 具体风格措辞见 `mj-style.md`）：

```
全身照，脚下金色发光魔法阵，符文旋转，梦幻氛围 --ar 3:4 --v 6 --stylize 200
```

常用参数：`--ar`（画幅）、`--v`（版本）、`--s` / `--stylize`（风格化）、`--no`（排除）、`--sref`（风格参考）。
人物保护转成正向描述："保持人物五官与服装细节清晰一致，不改变姿态"。

## 四、NovelAI 输出格式

Danbooru 标签（逗号分隔），加权重：

```
1girl, solo, white dress, golden magic circle, glowing, luminous runes, fantasy, masterpiece, best quality
```

负面（NovelAI 固定）：`lowres, bad anatomy, bad hands, error, missing fingers, extra digit, fewer digits, cropped, worst quality, low quality, normal quality, jpeg artifacts, signature, watermark, username, blurry`

## 五、辨别流程（第 0 步）

1. 用户**明说模型** → 直接用该模型
2. 用户**没说** → 找术语暗示（采样器/CFG/步数/LoRA → ComfyUI；--ar/--v → MJ；tag/标签 → NovelAI）
3. **都没有** → 默认 Nano Banana

辨别后有疑问 → 问一次："这条提示词是给 ComfyUI / Midjourney / NovelAI 还是 Nano Banana？"
