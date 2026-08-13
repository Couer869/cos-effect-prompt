# cos-effect-prompt — COS 人像后期提示词生成 Skill

为 COS（cosplay）角色照 / 写真生成**专业级 JSON 后期指令**，可直接配合 [Nano Banana](https://deepmind.google/models/gemini-image/)（Gemini 图像模型）使用。把你的角色照上传 Nano Banana，把指令连同照片一起粘贴，即可得到高质量后期效果。

## ✨ 特性

- **按需启用模块**：只生成用户需要的处理，绝不硬塞
  - `special_effects` — 特效（魔法阵 / 火焰 / 雷电 / 冰霜 / 翅膀 / 光环 / 粒子 / 霓虹 / 雨雪 / 赛博街景…，默认 **CG 质感 / 建模画风**）
  - `face_retouch` — 修脸（磨皮 / 祛瑕疵 / 瘦脸 / 眼神光 / 妆容 / 发际线）
  - `hair_enhancement` — 亮晶晶头发（丝绸光泽 + 闪粉星尘）
  - `clothing_refresh` — 服装（面料 / 褶皱 / 贴合 / 瑕疵修复）
  - `body_sculpting` — 塑形（液化瘦腰 + 背景修复）
  - `wind_effect` — 风效（裙摆 / 披风 / 飘带）
- **泛化兜底**：知识库没收录的需求（调色 / 背景更换 / 光影重塑 / 去路人…）自动现造高质量模块
- **保底规则**：构图 / 面部 / 姿势保持不变，光影噪点全图一致
- **中文输出**：JSON 值均为可直接使用的专业中文描述

## 📦 安装

```bash
# 克隆到你的 Skills 目录
git clone https://github.com/Couer869/cos-effect-prompt.git
# 或直接复制 cos-effect-prompt 文件夹到你使用的 agent 的 skills 目录
```

- **Cherry Studio**：复制到 `Data\Skills\` 下，自动识别，无需注册
- **Claude Code / 其他 Agent Skills 兼容环境**：将整个目录放入 `.claude/skills/` 或插件 `skills/` 目录

## 🚀 使用示例

用户说：*"帮我瘦一下腰，头发加点亮晶晶的，再在她手上加一团火焰。"*

Skill 输出（节选）：

```json
{
  "role": "Cosplay人像后期综合处理师",
  "base_rules": {
    "preserve_composition": true,
    "preserve_face": true,
    "preserve_pose": "不改变动作姿势",
    "no_scale_rotate_translate": true
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
        "visual_description": "燃烧跃动的火焰从掌心腾起，火舌卷动，火星与热浪四溅，橙红与金黄交织。以高精度3D渲染质感呈现……",
        "intensity": "中",
        "blend": "火焰的光照亮角色的受光面，产生暖橙色的环境光晕，投影方向与照片原有光源一致……"
      }
    ]
  }
}
```

## 📂 目录结构

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

## 📄 License

MIT License — 自由使用、修改与再分发。
