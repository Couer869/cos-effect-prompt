# COS 后期提示词生成器 — Photoshop 插件（UXP）

在 Photoshop 面板里填**你自己的 API**，直接生成专业后期提示词——内置 `cos-effect-prompt` 技能的完整知识（默认写实 3DCG、大师电影构图、44 种特效、多模型输出格式、EVA 约定等）。

## 环境要求

- Photoshop **24.0** 或更高（支持 UXP 的版本）
- **UXP Developer Tool**（用于加载开发版插件）：在 Creative Cloud 桌面端「市场」里搜索安装，或从 Adobe 官网下载

## 安装

### 方式 A：直接拷到 Photoshop 的 Plug-ins 目录（推荐，无需任何工具）

UXP 插件可直接放进 Photoshop 安装目录的 `Plug-ins\` 下，PS 启动时会自动加载。

1. 找到你的 Photoshop 安装目录下的 `Plug-ins\`，例如：
   ```
   D:\1\Adobe Photoshop 2026\Plug-ins\
   ```
2. 在里面新建文件夹 `cos-effect-prompt`
3. 把这 4 个文件复制进去：
   ```
   manifest.json
   index.html
   index.js
   styles.css
   ```
4. **重启 Photoshop** → 菜单 **增效工具（Plugins）→ COS 提示词**

> 目录结构应为：
> ```
> Plug-ins/cos-effect-prompt/
> ├── manifest.json
> ├── index.html
> ├── index.js
> └── styles.css
> ```

### 方式 B：用 UXP Developer Tool 加载（有正版 PS + Adobe 账号时）

1. 打开 **UXP Developer Tool**
2. 菜单 **Add Plugin…** → 选择本目录（含 `manifest.json` 的 `ps-plugin` 文件夹）
3. 点击 **Load**（或 **Watch** 以便改动自动重载）
4. 打开 Photoshop → 菜单 **增效工具（Plugins）→ COS 提示词**

> 面板默认停靠在右侧；可拖动到任意位置。

## 配置 API

首次打开面板会停在**配置页**。点一个**服务商预设**（DeepSeek / 通义千问 / Kimi / 智谱 / 硅基流动 / MiniMax / OpenAI / OpenRouter / 自定义）会自动填入接口地址和常用模型名，你只需补上自己的 API Key：

| 字段 | 说明 | 示例 |
|---|---|---|
| **Base URL** | OpenAI 兼容接口地址（选预设后自动填） | `https://api.deepseek.com/v1` |
| **API Key** | 你的密钥（**必填，插件不内置任何 Key**） | `sk-xxxxxxxx` |
| **模型名** | 点「拉取模型」自动从 API 获取列表后点选，也可手填 | `deepseek-chat` |

填好后点 **保存并进入 →**。配置只存本机，**下次打开直接进主界面**；要改点右上角 **设置**。

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
3. 点 **生成提示词** → 结果出现在下方的**生成结果**区
4. 用结果区右上角的按钮取出：
   - **导出到目录** — 一键写入你设置的导出目录（见下）
   - **另存为…** — 弹窗选位置保存

> 没有「复制」按钮：各版本 Photoshop 对 UXP 剪贴板 API 的开放程度差别很大，复制实际不可用，已移除。要取走内容请用上面两个导出按钮，或点「编辑」后用 `Ctrl+A`、`Ctrl+C`。

### 浏览长内容

结果区是一个**固定高度、可上下滚动**的框，三条路都能看全文：

| 方式 | 说明 |
|---|---|
| **框内滚动条** | 直接拖动／滚轮 |
| **↑ 向上 / ↓ 向下** | 按钮直接翻页，滚动条不好拖时用这个 |
| **展开全部** | 放开高度上限，改成整页滚动，一次看全；再点 **收起** 还原 |

### 手动编辑结果

点结果区右上角 **编辑** → 内容切到可编辑输入框，直接改（改参数、加要求、删段落都行）→ 点 **完成** 写回。

**「导出到目录 / 另存为」读的都是你改过之后的内容。**

### 继续优化（多轮迭代）

结果不满意不用重新描述，直接在「继续优化」框里写要改什么，点 **继续优化 →** 就会基于上一版输出**完整的新版本**：

- 一次可以写多条要求（比如"魔法阵改蓝色；强度再高一点；背景换夜景"）
- 点 **撤销上一步** 可以回退到上一版
- 顶部 **新对话** 清空上下文，重新开始

### 知识库（固定偏好前置）

点右上角 **知识库**，把你**每次都要强调的要求**写进去并保存：

```
人物面部特征必须保持，不要过度磨皮
特效一律用写实 3DCG 质感
构图必须有前景元素，不能是纯地面
我是 COS 玩家，服装要严格还原原作设定
```

保存后，**每次「生成提示词」和「继续优化」都会自动把这段内容作为「固定要求」发给 AI**，优先级高于内置默认值——不用每次重复写。内容只存本机，随时可改可清空。

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

本插件 `manifest.json` 中声明的是 `"network": { "domains": "all" }`——**不限制域名**，因此任意 OpenAI 兼容服务商都可直接填写，无需改配置。

### 调整内置知识

提示词的风格偏好、模块体系、输出格式都写在 `index.js` 顶部的 `SKILL_CORE` 与 `FORMAT_*` 常量里，可直接改（对应 GitHub 仓库 `references/` 下的知识库文件）。

## 🔒 安全红线：绝不内置密钥

**本插件不内置任何 API Key，必须由使用者填写自己的。** Key 只保存在使用者本机（浏览器 localStorage），除其自己指定的接口地址外不会发往任何第三方。

### 代码层面的保证

| 规则 | 实现 |
|---|---|
| 不内置密钥 | 代码中没有硬编码的 Key/Token，Key 只来自输入框 |
| 只存本机 | 存于 `localStorage`（键名 `cos_effect_prompt_cfg_v1`），不写文件、不进日志 |
| 知识库同样只存本机 | 知识库文本存于 `localStorage`（键名 `cos_effect_prompt_kb_v1`），仅随你的请求发往你自己配置的接口 |
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

## 开发自测

`web-test/smoke.js` 用 jsdom 加载真实的 `index.html` + `index.js` + `styles.css`，覆盖 48 项断言（初始化、预设自动填地址、配置持久化、知识库存取与注入、生成、结果区滚动与翻页、展开/收起、编辑态切换与写回、导出取改后内容、多轮优化与撤销、历史回填）：

```bash
npm i jsdom --registry https://registry.npmmirror.com
node web-test/smoke.js
```

改动 `index.js` 后建议先跑一遍再去 PS 里试。
