# 用户参考提示词库

这里存放**你喜欢的参考提示词**（从任何地方收集：MJ / SD / ComfyUI / NovelAI / 别人的作品 / 自己满意的成品）。

**两种存法**：
1. **直接手动粘贴**：按下方「条目模板」填好放进来
2. **让 Skill 存**：把提示词发给 agent 说"存到参考库"，Skill 会自动做泛化分析并写入

**两种用法**：
- **生成时参考**：生成提示词时，Skill 会读取本库，用相关条目的结构与措辞优化输出
- **泛化分析**：说"分析参考库 / 总结共性"，Skill 批量提炼通用模式

## 条目模板

### <参考名 / 标签>
- **来源模型**：MJ / SD / ComfyUI / NovelAI / Nano Banana
- **用途标签**：如 夜景 / 魔法阵 / 二次元 / 电影感
- **原文**：
  ```
  <粘贴原始提示词>
  ```
- **泛化分析**：结构（如 [主体]+[风格]+[光线]+[参数]）、亮点、可迁移的写法
- **可复用要素**：可直接借鉴的关键词 / 结构 / 参数

---

<!-- 参考条目从这里开始 -->

### 示例：赛博霓虹夜景（illustration）
- **来源模型**：Midjourney
- **用途标签**：赛博朋克 / 夜景 / 霓虹
- **原文**：
  ```
  a lone figure in black coat standing in rainy cyberpunk street, neon signs reflecting on wet ground, cold blue and purple tones, cinematic lighting, detailed --ar 3:4 --v 6
  ```
- **泛化分析**：结构 [主体]+[场景]+[光线+色调]+[质感词]+[参数]；亮点是"湿地面反光"串联霓虹与冷调、"cinematic lighting"统一氛围
- **可复用要素**：`rainy street wet reflection`、`cold blue purple tones`、`cinematic lighting`，画幅 `--ar 3:4`
