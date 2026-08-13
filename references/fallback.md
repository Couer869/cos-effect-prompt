# 泛化模块：库中没有的需求怎么组装

知识库已覆盖：特效（effects.md）、修脸/头发/服装（portrait.md）、塑形/风效（template.json）。**除此之外的后期处理**都走泛化组装。以下给出高频未知需求的完整示例——照这个标准，任何没见过的需求都能现造一个同等质量的模块。

> 组装口诀：`action`（强动词做什么）+ `target`（作用对象）+ `goal_description`（看得见的画面结果）+ `preserve`（不许动什么）+ `intensity`（强度）+ `blend`（与照片光影/透视一致）。

---

## 调色（color_grading）

用户："想调个色调，偏冷一点，要电影感"

```json
"color_grading": {
  "action": "调整整体色调",
  "target": "画面整体",
  "goal_description": "冷色调电影感调色，青蓝色偏向，暗部沉稳、高光带冷色，画面氛围清冷高级",
  "preserve": "人物面部细节、光影结构、动作与构图",
  "intensity": "中",
  "blend": "调色统合全图，人物肤色与背景色调协调，避免局部变色"
}
```

> 追加严禁项：`严禁肤色偏色失真`、`严禁局部色调断层`

---

## 背景更换（background_replace）

用户："把背景换成夜晚城市夜景"

```json
"background_replace": {
  "action": "替换背景",
  "target": "原背景",
  "goal_description": "换成夜晚城市灯火夜景，高楼霓虹点点，背景轻微景深虚化，整体氛围浪漫现代",
  "preserve": "人物本体、姿态、服饰、原有抠像边缘自然",
  "intensity": "中",
  "blend": "新背景光源方向与人物受光一致，人物边缘自然融入无白边"
}
```

> 追加严禁项：`严禁人物边缘白边或生硬抠图痕迹`、`严禁人物光影与新背景冲突`

---

## 光影重塑（lighting_reshape）

用户："想把光改成侧逆光的感觉"

```json
"lighting_reshape": {
  "action": "重塑光线",
  "target": "整体光源",
  "goal_description": "改为侧逆光，轮廓光清晰勾勒人物边缘，发丝透光，背景压暗突出主体",
  "preserve": "人物五官、动作与构图",
  "intensity": "中",
  "blend": "所有阴影与高光随新光源方向统一重算，保持光影物理一致"
}
```

> 追加严禁项：`严禁光源方向与阴影不一致导致画面混乱`

---

## 去路人 / 去物体（remove_object）

用户："把背景那个路人 P 掉"

```json
"remove_object": {
  "action": "消除",
  "target": "背景中的路人",
  "goal_description": "完全移除背景中的人物，用自然的建筑与街景纹理无缝填补其所在区域",
  "preserve": "主体人物、背景整体风格",
  "intensity": "中",
  "blend": "填补区域与周围背景的光影纹理一致，无涂抹痕迹"
}
```

> 追加严禁项：`严禁填补区域出现色块或涂抹痕迹`

---

## 组装清单（生成任何新模块时自查）

1. `module_name` 语义化小写英文（自造也行，如 `add_text`、`sky_replace`、`product_insert`）
2. `action` 是强动词，不是"希望/想要"
3. `goal_description` 具体到能"看见"（颜色/质感/光线/氛围），不写空泛形容词
4. `preserve` 默认"人物本体、动作、构图"，按需补充
5. 有强度概念就给 `intensity`，参照 effects.md 强度措辞
6. `blend` 说明新元素/改动与照片光源、透视、景深的关系
7. `constraints` 为该模块追加一条针对性严禁项
8. 需要专业质感时，从 `nano-banana.md` 摄影/电影术语里取词

---

## 反推模式示例（照片 → 提示词）

用户给了一张"夜景 + 脚下金色魔法阵 + 冷色调"的角色照，问："这张图后期是怎么做的？我想复现。"

### 反推分析
- 特效：脚下金色发光魔法阵（中强，CG 质感，符文旋转）
- 修图：轻微磨皮保留质感，冷色调电影调色（青蓝偏向）
- 场景：夜景街景，霓虹氛围，逆光轮廓光

### 复现指令

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
  "face_retouch": {
    "skin": "细腻均匀的皮肤质感，保留真实毛孔细节不失真，肤色通透自然"
  },
  "color_grading": {
    "action": "调整整体色调",
    "target": "画面整体",
    "goal_description": "冷色调电影感调色，青蓝色偏向，暗部沉稳、高光带冷色，画面氛围清冷高级",
    "preserve": "人物面部细节、光影结构、动作与构图",
    "intensity": "中",
    "blend": "调色统合全图，人物肤色与背景色调协调，避免局部变色"
  },
  "special_effects": {
    "style": "CG质感，建模画风：高精度3D渲染，表面平滑细腻、边缘清晰锐利，体积光与全局光照，类似高端游戏过场CG的特效表现",
    "effects": [
      {
        "type": "魔法阵",
        "location": "脚下地面",
        "visual_description": "脚下地面浮现一座金色发光魔法阵，繁复的几何图纹与神秘符文环绕旋转，符文线条柔和发光，CG高精度渲染质感",
        "intensity": "中强",
        "blend": "魔法阵光芒映照角色产生金色环境光，地面法阵保持正确俯视透视，与夜景霓虹的光源氛围一致"
      }
    ]
  },
  "constraints": {
    "严禁": "改变动作姿势、液化过度变形、背景出现变形、重绘人物本体(面部/服饰/体型)、特效光源方向与照片不一致",
    "禁止": "肤色偏色失真、特效与人物光影方向冲突"
  },
  "integration": {
    "light_match": "所有修改区域光影一致",
    "noise_match": "噪点一致"
  }
}
```

### 反推要点
- 每个识别出的处理 = 一个模块；照片里没有的一律不出现
- `visual_description` 描述"看到的效果"，不描述"想要的效果"
- 知识库没有的处理（如上面的 `color_grading`）→ 泛化模块组装
