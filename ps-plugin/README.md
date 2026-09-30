# COS 后期提示词生成器 — Photoshop 插件（UXP）

在 Photoshop 面板里填**你自己的 API**，直接生成专业后期提示词——内置 `cos-effect-prompt` 技能的完整知识（默认写实 3DCG、大师电影构图、44 种特效、多模型输出格式、EVA 约定等）。

## 环境要求

- Photoshop **24.0** 或更高（支持 UXP 的版本）
- **UXP Developer Tool**（用于加载开发版插件）：在 Creative Cloud 桌面端「市场」里搜索安装，或从 Adobe 官网下载

## 安装（开发版，自用）

1. 打开 **UXP Developer Tool**
2. 菜单 **Add Plugin…** → 选择本目录（含 `manifest.json` 的 `ps-plugin` 文件夹）
3. 点击 **Load**（或 **Watch** 以便改动自动重载）
4. 打开 Photoshop → 菜单 **插件 / Plugins → COS 提示词**，面板即出现

> 面板默认停靠在右侧；可拖动到任意位置，或从「窗口 → 扩展」里再次调出。

## 配置 API

面板顶部展开 **API 设置**，填三项后点「保存设置」：

| 字段 | 说明 | 示例 |
|---|---|---|
| **Base URL** | OpenAI 兼容接口地址 | `https://api.deepseek.com/v1` |
| **API Key** | 你的密钥 | `sk-xxxxxxxx` |
| **模型名** | 模型 ID | `deepseek-chat` |

### 常见服务商填写参考

| 服务商 | Base URL | 模型名示例 |
|---|---|---|
| DeepSeek | `https://api.deepseek.com/v1` | `deepseek-chat` |
| 通义千问 | `https://dashscope.aliyuncs.com/compatible-mode/v1` | `qwen-plus` |
| Kimi / Moonshot | `https://api.moonshot.cn/v1` | `moonshot-v1-8k` |
| 智谱 GLM | `https://open.bigmodel.cn/api/paas/v4` | `glm-4-plus` |
| 硅基流动 | `https://api.siliconflow.cn/v1` | `deepseek-ai/DeepSeek-V3` |
| OpenAI | `https://api.openai.com/v1` | `gpt-4o` |
| OpenRouter | `https://openrouter.ai/api/v1` | `openai/gpt-4o` |

> ⚠️ **安全**：Key 只保存在你本机（插件 localStorage），不会上传到任何第三方。**切勿**把带 Key 的配置分享给他人。

## 使用

1. 选择**目标模型**（决定输出格式）：
   - Nano Banana → 插件预设信封 JSON（可直接导入插件）
   - Midjourney → 自然语言 + 参数
   - ComfyUI / SD → tag + 权重 + 负向 + 参数
   - NovelAI → Danbooru 标签
2. 在「你的需求」里描述，例如：
   > 给这张 COS 照脚下加一个金色魔法阵，CG 质感，明显一点

   也可以点下方的**快捷填充**按钮（加魔法阵 / 修脸+亮晶晶发 / 赛博夜景 / 身材塑形 / 电影风格）快速起头
3. 点 **生成提示词** → 结果出现在下方
4. 用结果区右上角的按钮取出：
   - **复制** — 复制到剪贴板
   - **导出到目录** — 一键写入你设置的导出目录（见下）
   - **另存为…** — 弹窗选位置保存

### 历史记录

每次生成会自动存入**历史记录**（最多 30 条，存本机）：

- **点击某条** → 把它载回输入框和结果区，方便二次修改
- **点条目右侧 ×** → 删除该条
- **清空** → 清掉全部历史

### 一键导出到目录

在「API 与导出设置」里填 **导出目录**（如 `C:/Users/你的用户名/Downloads`），之后点 **导出到目录** 就会**无弹窗直接写入**：

- 文件名自动生成：Nano Banana 用预设的 `id`（如 `f_special_gold-magic-circle.json`），其他模型用 `模型名-时间戳`
- **留空**则退回到"另存为"弹窗

### 其他

- **带上文档信息**：把当前 PS 文档的尺寸/分辨率附到需求里（方便 AI 判断画幅）

## 自定义

### 换用其他服务商

本插件在 `manifest.json` 里声明了可访问的域名白名单（UXP 的安全机制）。若你的服务商不在列表中：
1. 打开 `manifest.json`
2. 在 `requiredPermissions.network.domains` 数组里加上你的域名，如 `"https://api.your-provider.com"`
3. 在 UXP Developer Tool 里 **Reload** 插件

### 调整内置知识

提示词的风格偏好、模块体系、输出格式都写在 `index.js` 顶部的 `SKILL_CORE` 与 `FORMAT_*` 常量里，可直接改（对应 GitHub 仓库 `references/` 下的知识库文件）。

## 🔒 安全红线：绝不内置密钥

**本插件不内置任何 API Key，必须由使用者填写自己的。** Key 只保存在使用者本机（浏览器 localStorage），除其自己指定的接口地址外不会发往任何第三方。

### 代码层面的保证

| 规则 | 实现 |
|---|---|
| 不内置密钥 | 代码中没有硬编码的 Key/Token，Key 只来自输入框 |
| 只存本机 | 存于 `localStorage`（键名 `cos_effect_prompt_cfg_v1`），不写文件、不进日志 |
| 只发指定地址 | Key 仅在 `Authorization` 头中发往用户配置的 `baseUrl`，无任何其他网络请求 |
| 不外泄到产物 | 历史记录只存「时间/目标模型/需求/结果」，**不含 Key**；导出文件同样不含 Key |
| 无埋点 | 无任何 analytics / telemetry / 上报请求 |

### 分发前检查清单（每次打包前执行）

```bash
# 1. 确认无硬编码凭据（应无输出）
grep -rniE 'sk-[a-z0-9]{10,}|api[_-]?key\s*[:=]\s*["'"'"'][^"'"'"']{8,}' .

# 2. 确认只有一个网络请求点（应只有一处 fetch，地址来自用户配置）
grep -n "fetch(" index.js

# 3. 确认无上报埋点（应无输出）
grep -rniE "analytics|telemetry|beacon|sentry|report" .
```

再人工确认：`index.js` 顶部的「安全红线」注释未被破坏；`manifest.json` 的域名白名单里**没有**多余的、与你无关的域名。

## 打包分发（给别人用）

自用只需上面的开发版加载。若要分发给他人：

1. 安装 **Adobe UXP Developer Tool** → **Package** 生成 `.ccx`
2. 用 Adobe 开发者账号对 `.ccx` 签名
3. 用户双击 `.ccx` 即可安装（无需开发者工具）
4. **打包后请执行上面的检查清单**

> ⚠️ 分发时**务必**让用户填自己的 API Key，**绝不要**内置你的 Key——否则会被盗刷，且用户的所有请求都会算在你的账上。

## 许可

MIT — 与主项目 `cos-effect-prompt` 一致。
