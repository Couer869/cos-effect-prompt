<div align="center">

# cos-effect-prompt

**COS 人像后期提示词生成 Skill — 为 Nano Banana (Gemini 图像模型) 生成专业级 JSON 后期指令**

> 给 COS 照 / 角色照 / 写真加特效、修脸、塑形、做氛围 —— 一句话说需求，输出一份可直接粘贴的成品指令。
> 给一张照片，还能**反推**出它的后期处理，复现效果、学习别人的修图。

`Nano Banana` `Gemini` `Cosplay` `AI 后期` `提示词`

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
![Language: Chinese](https://img.shields.io/badge/language-%E4%B8%AD%E6%96%87-blue)

</div>

---

## 为什么用它

Nano Banana 是吃**自然语言**的图像模型，但"加个特效"这种模糊说法往往效果随机。这个 Skill 把它变成**专业级的 JSON 指令**：

- **保底规则先行**—— 构图 / 面部 / 姿势不许动，杜绝"换了一张脸"
- **按需启用模块**—— 你要什么就生成什么，绝不硬塞无关处理
- **泛化兜底**—— 知识库没有的需求（调色 / 换背景 / 重塑光）也能自动现造
- **光影一致兜底**—— 所有修改与照片原光源、噪点统一，效果"长在照片里"而不是贴上去
- **反推模式**—— 给一张照片，反推出它的后期处理（特效/修图/调色），输出可复现指令
- **风格识别学习**—— 识别照片/描述的风格并输出风格预设；新风格可学入库，越用越懂

把照片和指令一起交给 Nano Banana，得到的是**稳定、可控、可复现**的高质量后期。

---

## 功能模块

| 模块 | 能力 | 触发词示例 |
|---|---|---|
| `special_effects` | 特效：魔法阵 / 火焰 / 雷电 / 冰霜 / 翅膀 / 光环 / 粒子 / 霓虹 / 雨雪 / 赛博街景…，**默认 CG 质感 / 建模画风**| "加魔法阵" "手上加火焰" "翅膀" |
| `face_retouch` | 修脸：磨皮 / 祛瑕疵 / 瘦脸 / 眼神光 / 妆容 / 发际线（默认自然档） | "修脸自然点" "祛痘印" "瘦下巴" |
| `hair_enhancement` | 亮晶晶头发：丝绸光泽 + 闪粉星尘 | "头发亮晶晶" "加闪粉" |
| `clothing_refresh` | 服装：面料焕新 / 褶皱管理 / 瑕疵修复（污渍、破损、开线） | "衣服太皱了" "去污渍" |
| `body_sculpting` | 塑形：液化瘦腰 + 背景变形修复 | "瘦腰" "修一下身材" |
| `wind_effect` | 风效：裙摆 / 披风 / 飘带统一风向飘动 | "裙摆飘起来" |

> **泛化兜底**：以上都没有的需求，Skill 会按四要素（动作 / 对象 / 目标描述 / 保持项）自动组装同等质量的新模块。

---

## 快速上手

**生成提示词全程不需要图片**—— 对 agent 说需求，纯文字就能输出完整 JSON 指令。图片只在最后一步出图时才需要。

1. **说出需求**—— 对 agent 描述你想怎么处理（**纯文字，不用传图**）。示例：
   > "帮我在这张 COS 照脚下加一个金色魔法阵，CG 质感，明显一点"
   > "修脸自然点，头发加点亮晶晶的"
   > "背景换成赛博朋克夜景，冷色调，下点雨"
2. **复制指令**—— agent 输出完整 JSON 指令，直接复制。
3. **粘贴出图**—— 打开 Nano Banana，上传你的照片，把 JSON 粘贴进去发送。

> **想看效果再细化**？在 Nano Banana 里追加一句"把魔法阵调更华丽，其余不变"即可迭代，无需重新生成整套 JSON。

**完整示例**—— 你说：

> "帮我瘦一下腰，头发加点亮晶晶的，再在她手上加一团火焰。"

Skill 输出：

```json
{
  "role": "Cosplay人像后期综合处理师",
  "base_rules": {
    "preserve_composition": true,
    "preserve_face": true,
    "preserve_pose": "不改变动作姿势",
    "no_scale_rotate_translate": true
  },
  "detection": {
    "identify": "分析全身身材比例、服装类型和可移动部分(裙摆/披风/飘带)、头发长度方向"
  },
  "body_sculpting": {
    "slim": { "targets": "腰部轻微液化收缩(5-10%)", "method": "保持自然比例和肌肉线条流畅" },
    "background_fix": "液化导致的背景变形完全修复"
  },
  "hair_enhancement": {
    "gloss": "发丝呈现丝绸般的顺滑光泽，高光随发丝走向自然流动",
    "sparkle": "发丝间点缀细碎亮晶晶的闪粉与星尘光点，如星光洒落"
  },
  "special_effects": {
    "style": "CG质感，建模画风：高精度3D渲染，表面平滑细腻、边缘清晰锐利，体积光与全局光照，类似高端游戏过场CG的特效表现",
    "effects": [
      {
        "type": "火焰",
        "location": "右手掌心",
        "visual_description": "燃烧跃动的火焰从掌心腾起，火舌卷动，火星与热浪四溅，橙红与金黄交织。以高精度3D渲染质感呈现，表面平滑细腻、边缘清晰锐利，光效具有体积感与全局光照感，类似高端游戏过场CG的特效表现",
        "intensity": "中",
        "blend": "火焰的光照亮角色的受光面，产生暖橙色的环境光晕，投影方向与照片原有光源一致。特效以CG材质渲染，光影遵循物理规律(体积光/环境反射)，与照片中角色形成高质量的融合，避免扁平贴图感"
      }
    ]
  },
  "constraints": {
    "严禁": "改变动作姿势、液化过度变形、背景出现变形、重绘人物本体(面部/服饰/体型)、特效光源方向与照片不一致",
    "禁止": "闪粉/光点溢出到面部或背景、改变发型轮廓"
  },
  "integration": {
    "light_match": "所有修改区域光影一致",
    "noise_match": "噪点一致"
  }
}
```

只输出**你需要的模块**——没有多余的键，直接复制即用。

### 导入插件（预设格式）

输出可直接导入图像处理插件，信封结构：

```json
{
  "id": "f_special_gold-magic-circle",
  "title": "脚下加金色魔法阵",
  "content": "{\"role\":\"Cosplay人像后期综合处理师\",...}",
  "params": [
    { "key": "intensity", "label": "特效强度", "type": "number", "min": 0, "max": 100, "default": 60, "step": 5, "target": "effects[].intensity" },
    { "key": "style_weight", "label": "风格权重", "type": "number", "min": 0, "max": 100, "default": 50, "step": 5, "target": "style" },
    { "key": "blend_strength", "label": "光影融入", "type": "number", "min": 0, "max": 100, "default": 60, "step": 5, "target": "blend" }
  ],
  "category": "special",
  "subCategory": "",
  "refImages": [],
  "_isFactory": true
}
```

- `content`：完整指令 JSON（转义字符串），解包后可直接粘贴 Nano Banana
- `params`：**可调参数控件**（特效强度 / 风格权重 / 光影融入），插件可渲染滑块，默认值已烘焙进 content
- `category`：英文分类（`special` / `face` / `hair` / `clothing` / `body` / `wind` / `scene` / `color` / `background` / `lighting`）
- `id` / `title`：语义化建议值，导入插件后可自行修改

---

## 设计理念

### 1. 保底规则永远在场
`base_rules` + `constraints` 把"什么不许动"写成显式规则。Nano Banana 对"保持不变的指令"响应特别好，这是防止人物画崩的关键。

### 2. 按需启用，拒绝堆砌
六个模块，用户提了才启用。要修脸就不会误加火焰，要特效就不会乱塑形。

### 3. 特效默认 CG 质感
所有特效默认以**高精度 3D 渲染质感**呈现（表面平滑、边缘锐利、体积光、全局光照），对标高端游戏过场 CG，而不是廉价贴图。

### 4. 泛化兜底，永不失手
任何知识库没收录的需求，Skill 提取四要素（动作 / 对象 / 目标描述 / 保持项）现造一个模块——质量与已知模块同一标准。

### 5. 光影噪点全图统一
每个模块的 `blend` 都要求与照片原光源方向一致，`integration` 全局兜底光影与噪点，多模块叠加也不割裂。

### 6. 透视永远一致
所有新增元素严格匹配照片原有的灭点、相机角度与景深——贴地元素随地面透视形变，垂直元素保持正确高度，杜绝"贴图感"。

---

## 反推模式（照片 → 提示词）

看到一张惊艳的角色图，想知道它是怎么做出来的？把照片给 agent，问一句：

> "这张图后期是怎么做的？帮我分析一下，我想复现。"
> "照着这张图的效果，帮我给另一张照片也做一份指令。"

Skill 会**观察照片 → 识别后期处理 → 反推复现指令**：

```markdown
## 反推分析
- 特效：脚下金色发光魔法阵（中强，CG 质感，符文旋转）
- 修图：轻微磨皮保留质感，冷色调电影调色
- 场景：夜景街景，霓虹氛围

## 复现指令
{ ... 可直接粘贴的 JSON ... }
```

在反推基础上还能叠加新要求："把魔法阵改成蓝色""去掉调色""把翅膀换掉"——输出融合指令。

> **前提**：反推需要模型能"看到"照片（多模态）。如果当前模型没有视觉，agent 会先问你照片的关键特征。

---

## 安装

```bash
git clone https://github.com/Couer869/cos-effect-prompt.git
```

| 平台 | 方式 |
|---|---|
| **Cherry Studio**| 把 `cos-effect-prompt` 文件夹复制到 `Data\Skills\` 下，自动识别、无需注册 |
| **Claude Code**| 放入项目 `.claude/skills/` 或插件 `skills/` 目录 |
| **其他 Agent Skills 兼容环境**| 参照对应环境的 skills 目录规范放置 |

---

## 目录结构

```
cos-effect-prompt/
├── SKILL.md                    # 触发条件 + 5 步组装流程 + 泛化模块逻辑
└── references/
    ├── effects.md              # 28 种特效词库（视觉描述 / 融入写法 / 强度词 / CG 质感）
    ├── portrait.md             # 修脸 / 亮晶晶头发 / 服装瑕疵词库
    ├── fallback.md             # 库外需求泛化组装（调色 / 换背景 / 重塑光 / 去路人）
    ├── template.json           # 完整 JSON 骨架
    └── nano-banana.md          # Nano Banana 编辑原理 + 摄影/电影术语
```

---

## 常见问题

**Q：和 Stable Diffusion 的提示词有什么不同？**
SD 用逗号 tag，Nano Banana 吃自然语言。本 Skill 的 JSON 是给 Nano Banana 的，不要混用到 SD。

**Q：为什么是 JSON，而不是一段话？**
JSON 无歧义：保底规则、处理模块、约束分离，模型更容易"照做不越界"，输出也更稳定可复现。

**Q：效果不理想怎么办？**
Skill 每条指令都自带迭代接口——对 Nano Banana 追加"把火焰调猛烈些，其余不变"即可，无需重新生成整套 JSON。

**Q：想要写实实拍 / 二次元手绘风格的特效？**
直接告诉 agent（如"特效要写实实拍风"），Skill 会用对应风格覆盖默认的 CG 质感。

**Q：指令里的中文直接粘贴吗？**
是的。Nano Banana 支持中文，JSON 值均为可直接使用的专业中文描述。

---

## 反馈与贡献

用得不顺手？有想加的特效 / 模块？欢迎提 [Issue](https://github.com/Couer869/cos-effect-prompt/issues) 或直接改进后提交 PR。

---

## License

[MIT](LICENSE) — 自由使用、修改与再分发。
