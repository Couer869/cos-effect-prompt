/* COS 后期提示词生成器 — Photoshop UXP 插件
 * 视图：① 首次配置 → ② 生成主界面 → ③ 知识库
 * 配置与知识库只存本机；配置过一次后下次直接进主界面。
 *
 * ⚠️ 安全红线（修改本文件时务必遵守，分发前请复核）：
 *   1. 【绝不内置密钥】不得在代码里写死任何 API Key / Token。Key 必须来自用户输入。
 *   2. 【只存本机】Key 仅保存在 localStorage（CFG_KEY），不得写入文件、日志或历史记录。
 *   3. 【只发用户指定的地址】Key 仅在 Authorization 头中发往用户自己配置的 baseUrl，
 *      禁止发往任何其他域名、禁止加入任何埋点/上报请求。
 *   4. 【分发前自检】搜索 sk- / api_key / token / Authorization，确认无硬编码凭据。
 */

/* 模块加载全部容错：任何一个 require 失败都不能让整个脚本中断 */
let fs = null;
let formats = null;
let clipboard = null;
let photoshop = null;
let shell = null;

try {
  const uxp = require("uxp");
  if (uxp && uxp.storage) {
    fs = uxp.storage.localFileSystem;
    formats = uxp.storage.formats;
  }
  if (uxp && uxp.shell) shell = uxp.shell;
} catch (e) { /* 存储/外壳不可用：导出、外链跳转降级 */ }

try { clipboard = require("clipboard"); } catch (e) { /* 剪贴板不可用：走兜底 */ }
try { photoshop = require("photoshop"); } catch (e) { /* 非 PS 环境 */ }

/* ============================================================
 * 复制文本 / 打开外部链接
 *
 * 说明：结果区不再提供「复制」按钮——各版本 Photoshop 对 UXP 剪贴板
 * API 的开放程度差别太大，生成内容又长，用户反馈实际用不了，已移除。
 * 取走结果请用「导出到目录 / 另存为…」，或进编辑态 Ctrl+A、Ctrl+C。
 *
 * 这里保留一个复制实现，只服务于「复制链接」这种短文本场景
 * （设置页的作者主页），每层都确认成功才返回，不会假报成功。
 * ============================================================ */

async function copyText(text) {
  // 1) UXP 剪贴板模块
  if (clipboard && typeof clipboard.copy === "function") {
    try { clipboard.copy(text); return true; } catch (e) { /* 继续 */ }
  }
  // 2) 浏览器剪贴板：必须 await，无权限时会 reject
  try {
    if (typeof navigator !== "undefined" && navigator.clipboard && navigator.clipboard.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch (e) { /* 继续 */ }
  // 3) execCommand 兜底
  try {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.style.position = "fixed";
    ta.style.left = "-9999px";
    ta.style.top = "0";
    document.body.appendChild(ta);
    ta.focus();
    ta.select();
    const ok = !!(document.execCommand && document.execCommand("copy"));
    document.body.removeChild(ta);
    if (ok) return true;
  } catch (e) { /* 继续 */ }
  // 4) 选中链接文本，让用户自己 Ctrl+C
  try {
    const box = document.getElementById("douyinUrl");
    if (box && window.getSelection && document.createRange) {
      const r = document.createRange();
      r.selectNodeContents(box);
      const s = window.getSelection();
      s.removeAllRanges();
      s.addRange(r);
    }
  } catch (e) { /* 忽略 */ }
  return false;
}

/* 用系统浏览器打开链接（UXP 的 shell.openExternal）。
 * 失败时返回 false，调用方会提示用户手动复制链接。 */
function openExternal(url) {
  try {
    if (shell && typeof shell.openExternal === "function") {
      shell.openExternal(url);
      return true;
    }
  } catch (e) { /* 降级 */ }
  try {
    if (typeof window !== "undefined" && typeof window.open === "function") {
      window.open(url);
      return true;
    }
  } catch (e) { /* 降级 */ }
  return false;
}

/* 字节数组 -> base64。自己实现而不依赖 btoa/FileReader，
 * 因为 UXP 对这两个的支持随版本变化，ArrayBuffer 是稳定拿得到的。 */
const B64_CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";

function bytesToBase64(bytes) {
  let out = "";
  const len = bytes.length;
  let i = 0;
  for (; i + 2 < len; i += 3) {
    const n = (bytes[i] << 16) | (bytes[i + 1] << 8) | bytes[i + 2];
    out += B64_CHARS[(n >> 18) & 63] + B64_CHARS[(n >> 12) & 63] +
           B64_CHARS[(n >> 6) & 63] + B64_CHARS[n & 63];
  }
  const rest = len - i;
  if (rest === 1) {
    const n = bytes[i] << 16;
    out += B64_CHARS[(n >> 18) & 63] + B64_CHARS[(n >> 12) & 63] + "==";
  } else if (rest === 2) {
    const n = (bytes[i] << 16) | (bytes[i + 1] << 8);
    out += B64_CHARS[(n >> 18) & 63] + B64_CHARS[(n >> 12) & 63] +
           B64_CHARS[(n >> 6) & 63] + "=";
  }
  return out;
}

function mimeOf(filename) {
  const n = (filename || "").toLowerCase();
  if (/\.png$/.test(n)) return "image/png";
  if (/\.webp$/.test(n)) return "image/webp";
  if (/\.gif$/.test(n)) return "image/gif";
  if (/\.bmp$/.test(n)) return "image/bmp";
  return "image/jpeg";
}

/* ============================================================
 * 一、内置技能知识（system prompt）
 * ============================================================ */

const SKILL_CORE = `
你是「Cosplay 人像后期综合处理师」，为用户的 COS 照片生成专业级后期提示词。

【默认风格与属性 —— 用户未明确指定时一律带入】
- 风格：写实 3DCG（high-quality 3D CGI render, realistic PBR materials, subsurface scattering, volumetric light）
- 构图：大师电影感构图，从下列选 1-2 种最贴合的：单点透视/对称、三分法、黄金分割、引导线、对角、层次纵深、留白、低角度仰拍、荷兰角、剪影逆光、S形曲线、广角史诗、水面镜像、群像排开、建筑框景
- 景别：远中近三层结合（前/中/后景纵深）
- 前景：放【叙事性实体元素】（散落文件、电缆、积水倒影、瓦砾、遗落装备等）；禁止"栏杆/控制台边缘"这类画框式前景；地面不能是空的
- 镜头：35mm，大光圈 f/1.4（人物与主体都要清晰时用 f/2.0）
- 取景：非半身照（全身/宽松取景，含完整身姿与留白）
- 焦点：焦内锐利（tack-sharp focus）
- 光斑：强化奶油虚化光斑（enhanced creamy bokeh orbs）

以上均为【可改属性】：用户明确指定（如"85mm 半身特写""f/2.8""去掉前景"）就用用户的值。

【硬性规则】
- 透视一致：所有新增元素必须符合原图灭点方向、相机角度、景深关系
- 保底规则：构图/面部/姿势/背景/全局光照/色彩伽马 保持不变
- 禁止全局调色、压光、改色温来掩盖问题
- 光影与噪点全图一致

【模块体系（按需启用，用户提了才加）】
- special_effects：44 种特效（魔法阵/火焰/雷电/冰霜/翅膀/光环/粒子/霓虹/雨雪/花瓣/赛博街景/机械装甲/藤蔓/全息/凤凰/龙翼/圣剑/雷神等）+ 组合模板（法阵开启/火焰爆发/天使降临/赛博之夜/自然魔法/机械觉醒…）
- face_retouch：磨皮/祛瑕疵/瘦脸/眼神光/妆容/发际线；修容风格变体（自然感/厚涂感/CG感）
- hair_enhancement：丝绸光泽/亮晶晶闪钻/CG写实毛发(XGen)/赛璐璐手绘/刘海修整/长发飘动
- clothing_refresh：面料焕新/褶皱管理/瑕疵修复/材质细化(缎面/皮革/蕾丝/金属)/C服还原/绷紧/勒肉
- body_sculpting：液化瘦腰/沙漏比例(胸+10-25%腰-8-15%臀+5-15%)/胸部/腰部/腹肌/肩颈/瑕疵移除(体毛/痘印/疤痕)/背景修复
- wind_effect：裙摆/披风/飘带风动（支持红色画笔箭头引导方向）
- 3d_asset_integration：置入3D素材真实化融合（面数提升/法线转凹凸/SSS/光线匹配/HSL/接触交互/材质精度/框架锁定）
- lighting_reshape：三点布光/逆光/侧光/色温/光比
- 电影风格仿制：王家卫/银翼杀手/波顿/复古胶片/黑白/蒸汽朋克/科幻/新海诚/宫崎骏/西部

【库外需求】
知识库没有的需求（调色/换背景/光影重塑/去路人等）不要拒绝——按"动作+对象+目标描述+保持项"四要素现造模块，质量与已知模块同级。

【EVA 约定（重要）】
涉及 EVA 机甲时一律是【零号机 EVA-00】（橙白配色，凌波丽驾驶的机体），必须与初号机 EVA-01（紫绿）区分：
- 全名：EVA Unit-00 (EVA-00)
- 配色：orange-and-white prototype
- 参数排除：--no Unit-01, purple, green（MJ）或负面词（SD）
`;

const FORMAT_NANOBANANA = `
【输出格式：Nano Banana 插件预设信封】
输出一份可直接导入插件的 JSON，结构：
{
  "id": "f_<category>_<英文kebab-slug>",
  "title": "简短中文标题",
  "content": "<指令JSON整体序列化为转义字符串>",
  "params": [
    { "key":"intensity","label":"特效强度","type":"number","min":0,"max":100,"default":60,"step":5,"target":"effects[].intensity" },
    { "key":"style_weight","label":"风格权重","type":"number","min":0,"max":100,"default":50,"step":5,"target":"style" },
    { "key":"blend_strength","label":"光影融入","type":"number","min":0,"max":100,"default":60,"step":5,"target":"blend" }
  ],
  "category": "special|face|hair|clothing|body|wind|scene|color|background|lighting|style",
  "subCategory": "",
  "refImages": [],
  "_isFactory": true
}
content 内的指令 JSON 结构：{ "role", "base_rules", "detection", 按需模块..., "constraints", "integration" }
- base_rules 固定含：preserve_composition / preserve_face / preserve_pose / preserve_background /
  preserve_lighting_global / preserve_global_hsl_gamma / preserve_perspective / no_scale_rotate_translate
- integration 固定含：light_match / noise_match / perspective_match
只输出你需要的模块，没有的键不输出。content 的引号必须转义（\\"）。
`;

const FORMAT_MJ = `
【输出格式：Midjourney 提示词】
输出可直接粘贴 /imagine 的提示词：自然语言描述 + 参数。
- 遵循 7-Element：主体/媒介/环境/光照/色彩/情绪/构图
- 描述"看得见的东西"，重要元素放前面，控制在 ~40 词内
- 参数：--ar（人像2:3/3:4，宽景16:9）--stylize --style raw（写实）--no（排除）
- 锁风格 --sref [URL] --sw 200；锁角色 --cref [URL] --cw 80
- 避免垃圾词：4k/8k/octane/unreal/v-ray/lumion/HDR/award-winning/photorealistic
- EVA 场景必须带 --no Unit-01, purple, green
`;

const FORMAT_COMFYUI = `
【输出格式：ComfyUI / Stable Diffusion】
输出 JSON：
{
  "model": "comfyui",
  "positive_prompt": "masterpiece, best quality, 1girl, ..., 特效tags, correct perspective",
  "negative_prompt": "bad anatomy, extra fingers, deformed, bad perspective, worst quality, low quality, blurry, watermark",
  "params": { "steps": 28, "cfg": 7.0, "sampler": "dpmpp_2m", "scheduler": "karras", "clip_skip": 2, "seed": null, "size": "1024x1024" }
}
- 正向用英文 tag，逗号分隔；权重 (tag:1.2) 加强、(tag:0.8) 减弱
- 人物保护写正面（photorealistic, detailed face, sharp focus）+ 负面（bad anatomy, extra person）
- 透视一致写负面 bad perspective, wrong perspective
- 用户提到 ControlNet/LoRA 时：指出所需控制类型（OpenPose锁姿势/Depth保透视/Lineart锁边缘/IPAdapter参考风格）与 LoRA 语法 <lora:名称:权重>
`;

const FORMAT_NOVELAI = `
【输出格式：NovelAI】
Danbooru 标签，逗号分隔，可用权重。
正向示例：1girl, solo, white dress, golden magic circle, glowing runes, fantasy, masterpiece, best quality
负面固定：lowres, bad anatomy, bad hands, error, missing fingers, extra digit, fewer digits, cropped, worst quality, low quality, jpeg artifacts, signature, watermark, username, blurry
`;

function formatFor(target) {
  if (target === "midjourney") return FORMAT_MJ;
  if (target === "comfyui") return FORMAT_COMFYUI;
  if (target === "novelai") return FORMAT_NOVELAI;
  return FORMAT_NANOBANANA;
}

/* 知识库：用户写死的「固定要求」，优先级最高 */
function kbBlock(kb) {
  const k = (kb || "").trim();
  if (!k) return "";
  return `
【用户知识库 · 固定要求（每次生成都必须遵守，优先级高于上文默认值）】
${k}
`;
}

/* 学习库：用户投喂的「参考范例」，模仿其结构、用词与风格。
 * 按时间倒序取最新的若干条，并按总字数封顶——投喂太多会挤占上下文、
 * 反而拖垮生成质量，所以这里做硬限制。 */
const LEARN_CHAR_BUDGET = 6000;

function learnBlock(learn) {
  const items = learn || [];
  if (!items.length || !isLearnOn()) return "";

  let body = "";
  let used = 0;
  let n = 0;

  for (let i = 0; i < items.length; i++) {
    const it = items[i];
    const text = (it.body || "").trim();
    if (!text) continue;
    if (used + text.length > LEARN_CHAR_BUDGET) break;

    n++;
    used += text.length;
    body += "\n--- 范例 " + n + (it.title ? "：" + it.title : "") + " ---\n" + text + "\n";
  }

  if (!n) return "";
  return `
【用户投喂的参考范例（共 ${n} 条）】
下面是这位用户认可的提示词样例。请模仿它们的**结构、详细程度、用词习惯与风格取向**，
但不要照抄内容——本次要写的是新东西。
${body}`;
}

function buildSystemPrompt(target, kb) {
  return SKILL_CORE + "\n" + formatFor(target) + `
【工作方式】
- 用户只描述需求时：直接生成提示词，不要反问（除非完全无从下手）
- 用户给出照片并问"这是什么风格/怎么做的/照着做"时：进入反推模式——先给 3-5 条简短分析，再给可复现的提示词
- 【多轮修改】用户对上一版结果提出修改要求时，必须输出【完整更新后的结果】，不要只输出改动片段，
  也不要输出 diff 或解释；保持与上一版相同的输出格式
- 输出纯净可用，不要加多余的寒暄与解释
- 只输出最终结果本身，不要包 markdown 代码块标记
` + learnBlock(loadLearn()) + kbBlock(kb);
}

/* 图生文：看图反推提示词。系统提示换一套，但格式/知识库/学习库照样生效。 */
function buildVisionSystemPrompt(target, kb) {
  return `你是资深的 AI 绘图提示词工程师，擅长看图反推提示词。

【任务】
用户会给你一张图片，外加一段识图要求。仔细分析画面，输出能复现这张图的提示词。

【分析时要在心里过一遍（不要逐条罗列给用户）】
主体与身份、服饰与材质、姿势与表情、构图与镜头（焦距 / 视角 / 景别）、
光源方向与质感、色调与影调、环境与背景、前景元素、特效与氛围、
画风与渲染方式（写实 / 3DCG / 插画 / 胶片…）

【硬性要求】
- 描述必须来自你实际看到的画面，**不要编造看不见的元素**
- 保持原图的透视与构图关系（灭点方向、相机角度、景深关系）
- 直接输出最终提示词，不要输出分析过程、不要输出"首先/然后"这类口语
- 只输出结果本身，不要包 markdown 代码块标记
` + formatFor(target) + learnBlock(loadLearn()) + kbBlock(kb);
}

/* ============================================================
 * 二、配置与本地存储
 * ============================================================ */

const CFG_KEY = "cos_effect_prompt_cfg_v1";
const HISTORY_KEY = "cos_effect_prompt_history_v1";
const KB_KEY = "cos_effect_prompt_kb_v1";
const LEARN_KEY = "cos_effect_prompt_learn_v1";
const LEARN_ON_KEY = "cos_effect_prompt_learn_on_v1";
const MAX_HISTORY = 30;
const MAX_LEARN = 50;

/* 开源与作者信息（写死在代码里，方便分发时统一） */
const GITHUB_URL = "https://github.com/Couer869/cos-effect-prompt";
const DOUYIN_URL = "https://v.douyin.com/dNeL4w9CUBs/";

/* 服务商预设：选中后自动填入接口地址与常用模型名 */
const PROVIDERS = {
  deepseek:    { url: "https://api.deepseek.com/v1",                      model: "deepseek-chat" },
  qwen:        { url: "https://dashscope.aliyuncs.com/compatible-mode/v1", model: "qwen-plus" },
  kimi:        { url: "https://api.moonshot.cn/v1",                       model: "moonshot-v1-8k" },
  zhipu:       { url: "https://open.bigmodel.cn/api/paas/v4",             model: "glm-4-plus" },
  siliconflow: { url: "https://api.siliconflow.cn/v1",                    model: "deepseek-ai/DeepSeek-V3" },
  minimax:     { url: "https://api.minimax.chat/v1",                      model: "abab6.5s-chat" },
  openai:      { url: "https://api.openai.com/v1",                        model: "gpt-4o" },
  openrouter:  { url: "https://openrouter.ai/api/v1",                     model: "openai/gpt-4o" },
  custom:      { url: "",                                                 model: "" }
};

function loadConfig() {
  try { return JSON.parse(localStorage.getItem(CFG_KEY) || "{}"); }
  catch (e) { return {}; }
}

function saveConfig(cfg) {
  try { localStorage.setItem(CFG_KEY, JSON.stringify(cfg)); }
  catch (e) { setSetupStatus("设置保存失败：" + e.message, "err"); }
}

function isConfigured(cfg) {
  return !!(cfg && cfg.baseUrl && cfg.apiKey && cfg.model);
}

function loadKB() {
  try { return localStorage.getItem(KB_KEY) || ""; }
  catch (e) { return ""; }
}

function saveKB(text) {
  try { localStorage.setItem(KB_KEY, text || ""); return true; }
  catch (e) { return false; }
}

/* ---------- 学习库：投喂的参考提示词 ---------- */

function loadLearn() {
  try {
    const v = JSON.parse(localStorage.getItem(LEARN_KEY) || "[]");
    return Array.isArray(v) ? v : [];
  } catch (e) { return []; }
}

function persistLearn(list) {
  try { localStorage.setItem(LEARN_KEY, JSON.stringify(list.slice(0, MAX_LEARN))); return true; }
  catch (e) { return false; }
}

function isLearnOn() {
  try { return localStorage.getItem(LEARN_ON_KEY) !== "0"; }  // 默认开
  catch (e) { return true; }
}

function setLearnOn(on) {
  try { localStorage.setItem(LEARN_ON_KEY, on ? "1" : "0"); } catch (e) { /* 忽略 */ }
}

/* 投喂：整段文本按空行切成多条，一次可以喂一批 */
function addLearnBatch(title, body) {
  const text = (body || "").trim();
  if (!text) return 0;

  const chunks = text.split(/\n\s*\n+/).map(function (s) { return s.trim(); }).filter(Boolean);
  const list = loadLearn();
  const t = nowStr();

  chunks.forEach(function (c, i) {
    list.unshift({
      time: t,
      title: (chunks.length === 1 && title ? title.trim() : "") || ("投喂 " + (i + 1)),
      body: c
    });
  });

  persistLearn(list);
  return chunks.length;
}

/* ---------- 通用：选项组控件（UXP 下原生 select 不可靠） ---------- */
function getOptValue(id) {
  const el = document.getElementById(id);
  if (!el) return "";
  if (el.tagName === "SELECT") return el.value;
  const a = el.querySelector(".opt.active");
  return a ? (a.getAttribute("data-value") || "") : "";
}

function setOptValue(id, v) {
  const el = document.getElementById(id);
  if (!el) return;
  if (el.tagName === "SELECT") { el.value = v || ""; return; }
  const opts = el.querySelectorAll(".opt");
  for (let i = 0; i < opts.length; i++) {
    if (opts[i].getAttribute("data-value") === v) opts[i].classList.add("active");
    else opts[i].classList.remove("active");
  }
}

function buildOptList(containerId, items, onPick) {
  const el = document.getElementById(containerId);
  if (!el) return;
  while (el.firstChild) el.removeChild(el.firstChild);
  items.forEach(function (it) {
    const d = document.createElement("div");
    d.className = "opt";
    d.setAttribute("data-value", it.value);
    d.textContent = it.label;
    d.addEventListener("click", function () {
      setOptValue(containerId, it.value);
      if (onPick) onPick(it.value, it.label);
    });
    el.appendChild(d);
  });
}

function currentTarget() {
  const mainVisible = !document.getElementById("viewMain").classList.contains("hidden");
  return getOptValue(mainVisible ? "targetModelMain" : "targetModel") || "nanobanana";
}

function readConfig() {
  return {
    baseUrl: document.getElementById("baseUrl").value.trim(),
    apiKey: document.getElementById("apiKey").value.trim(),
    model: document.getElementById("model").value.trim(),
    visionBaseUrl: document.getElementById("visionBaseUrl").value.trim(),
    visionApiKey: document.getElementById("visionApiKey").value.trim(),
    visionModel: document.getElementById("visionModel").value.trim(),
    targetModel: currentTarget(),
    exportDir: document.getElementById("exportDir").value.trim()
  };
}

function fillConfigForm(cfg) {
  document.getElementById("baseUrl").value = cfg.baseUrl || "";
  document.getElementById("apiKey").value = cfg.apiKey || "";
  document.getElementById("model").value = cfg.model || "";
  document.getElementById("visionBaseUrl").value = cfg.visionBaseUrl || "";
  document.getElementById("visionApiKey").value = cfg.visionApiKey || "";
  document.getElementById("visionModel").value = cfg.visionModel || "";
  document.getElementById("exportDir").value = cfg.exportDir || "";
  setOptValue("targetModel", cfg.targetModel || "nanobanana");
  setOptValue("targetModelMain", cfg.targetModel || "nanobanana");
  setOptValue("targetModelImg", cfg.targetModel || "nanobanana");
}

/* 视觉模型配置：没单独配就回落到主配置 */
function visionConfig() {
  const c = loadConfig();
  return {
    baseUrl: (c.visionBaseUrl || c.baseUrl || "").trim(),
    apiKey: (c.visionApiKey || c.apiKey || "").trim(),
    model: (c.visionModel || "").trim()
  };
}

function updateCfgSummary() {
  const cfg = loadConfig();
  const names = { nanobanana: "Nano Banana", midjourney: "Midjourney", comfyui: "ComfyUI", novelai: "NovelAI" };
  const t = currentTarget();
  const marks = [];
  if (loadKB().trim()) marks.push("知识库");
  if (loadLearn().length && isLearnOn()) marks.push("学习库" + loadLearn().length + "条");
  document.getElementById("cfgSummary").textContent =
    (cfg.model || "未配置模型") + " · " + (names[t] || t) +
    (marks.length ? " · " + marks.join(" / ") + " 已启用" : "");
}

/* ============================================================
 * 三、输出区：浏览态（可滚动 div） / 编辑态（textarea）
 *
 * 为什么分两态：UXP 里 div 的 overflow 滚动可靠，textarea 的不可靠。
 * 所以默认用 div 浏览，需要手改时才切成 textarea，改完写回。
 *
 * 看全的三条路（依次兜底）：
 *   1) 框内原生滚动条（固定 height + overflow-y:auto）
 *   2) 「↑ 向上 / ↓ 向下」按钮直接改 scrollTop —— 滚动条拖不动时也能翻
 *   3) 「展开全部」放开高度上限，交给外层面板滚动
 * ============================================================ */

let currentOutput = "";
let editingOutput = false;

function setOutput(text) {
  currentOutput = text || "";
  editingOutput = false;

  const view = document.getElementById("outputView");
  if (view) {
    view.textContent = currentOutput;
    view.classList.remove("expanded");
    if (currentOutput) view.classList.remove("empty");
    else view.classList.add("empty");
    try { view.scrollTop = 0; } catch (e) { /* 忽略 */ }
  }

  const ta = document.getElementById("output");
  if (ta) ta.value = currentOutput;

  const exp = document.getElementById("btnExpand");
  if (exp) exp.textContent = "展开全部";

  applyEditMode();
  updateOutHint();
}

/* 读结果：编辑态取 textarea，浏览态取缓存（含用户改过的内容） */
function getOutput() {
  if (editingOutput) {
    const ta = document.getElementById("output");
    if (ta) return ta.value;
  }
  return currentOutput;
}

function applyEditMode() {
  const view = document.getElementById("outputView");
  const ta = document.getElementById("output");
  const btn = document.getElementById("btnEdit");
  if (!view || !ta) return;

  if (editingOutput) {
    view.classList.add("hidden");
    ta.classList.remove("hidden");
    if (btn) btn.textContent = "完成";
    try { ta.focus(); } catch (e) { /* 忽略 */ }
  } else {
    ta.classList.add("hidden");
    view.classList.remove("hidden");
    if (btn) btn.textContent = "编辑";
  }
}

/* 提示语：告诉用户当前能不能滚、要不要展开 */
function updateOutHint() {
  const hint = document.getElementById("outHint");
  const view = document.getElementById("outputView");
  if (!hint || !view) return;

  if (editingOutput) {
    hint.textContent = "编辑模式：直接改内容，改完点「完成」写回结果区";
    return;
  }
  if (!currentOutput) {
    hint.textContent = "结果区可上下滚动浏览全文";
    return;
  }

  // clientHeight / scrollHeight 在部分环境取不到，取不到就当不溢出
  const sh = view.scrollHeight || 0;
  const ch = view.clientHeight || 0;
  const over = sh > 0 && ch > 0 && sh > ch + 4;

  hint.textContent = over
    ? "内容较长：可拖框内滚动条，或用「↑ 向上 / ↓ 向下」翻看，也可「展开全部」"
    : "内容已全部显示；点「展开全部」可再放宽高度";
}

/* 上下翻页：直接改 scrollTop，不依赖滚动条可拖动 */
function scrollOutput(dir) {
  const view = document.getElementById("outputView");
  if (!view) return;
  if (view.classList.contains("expanded")) {
    setStatus("已展开全部内容，请用面板整体滚动条浏览", "ok");
    return;
  }
  const step = Math.max(80, Math.round((view.clientHeight || 280) * 0.85));
  try {
    view.scrollTop = (view.scrollTop || 0) + dir * step;
  } catch (e) { /* 忽略 */ }
  updateOutHint();
}

/* ============================================================
 * 四、视图切换
 * ============================================================ */

function showView(name) {
  const views = ["viewSetup", "viewMain", "viewKB", "viewLearn", "viewImg"];
  views.forEach(function (id) {
    const el = document.getElementById(id);
    if (!el) return;
    if (id === name) el.classList.remove("hidden");
    else el.classList.add("hidden");
  });

  if (name === "viewMain") { updateCfgSummary(); updateOutHint(); }

  if (name === "viewKB") {
    document.getElementById("kbText").value = loadKB();
    setKbStatus(loadKB().trim() ? "知识库已保存内容" : "知识库为空", "ok");
  }

  if (name === "viewLearn") {
    renderLearn();
    updateLearnToggle();
  }

  if (name === "viewImg") {
    setImgStatus("", "");
  }
}

/* ============================================================
 * 五、历史记录
 * ============================================================ */

function labelOf(target) {
  if (target === "midjourney") return "MJ";
  if (target === "comfyui") return "Comfy";
  if (target === "novelai") return "NAI";
  return "NanoBanana";
}

function nowStr() {
  const d = new Date();
  const p = function (n) { return n < 10 ? "0" + n : "" + n; };
  return d.getFullYear() + "-" + p(d.getMonth() + 1) + "-" + p(d.getDate()) +
         " " + p(d.getHours()) + ":" + p(d.getMinutes());
}

function loadHistory() {
  try { return JSON.parse(localStorage.getItem(HISTORY_KEY) || "[]"); }
  catch (e) { return []; }
}

function persistHistory(list) {
  try { localStorage.setItem(HISTORY_KEY, JSON.stringify(list.slice(0, MAX_HISTORY))); }
  catch (e) { /* 超限忽略 */ }
}

function addHistory(entry) {
  const list = loadHistory();
  list.unshift(entry);
  persistHistory(list);
  renderHistory();
}

function renderHistory() {
  const list = loadHistory();
  const box = document.getElementById("historyList");
  document.getElementById("histCount").textContent = String(list.length);

  while (box.firstChild) box.removeChild(box.firstChild);

  if (!list.length) {
    const empty = document.createElement("div");
    empty.className = "empty";
    empty.textContent = "暂无记录";
    box.appendChild(empty);
    return;
  }

  list.forEach(function (item, idx) {
    const row = document.createElement("div");
    row.className = "hist-item";

    const main = document.createElement("div");
    main.className = "hist-main";

    const title = document.createElement("div");
    title.className = "hist-title";
    title.textContent = item.request || "(无需求)";

    const meta = document.createElement("div");
    meta.className = "hist-meta";
    meta.textContent = item.time || "";

    main.appendChild(title);
    main.appendChild(meta);

    const tag = document.createElement("span");
    tag.className = "hist-tag";
    tag.textContent = labelOf(item.target);

    const del = document.createElement("span");
    del.className = "hist-del";
    del.textContent = "×";
    del.addEventListener("click", function (ev) {
      ev.stopPropagation();
      const l = loadHistory();
      l.splice(idx, 1);
      persistHistory(l);
      renderHistory();
    });

    row.appendChild(main);
    row.appendChild(tag);
    row.appendChild(del);

    row.addEventListener("click", function () {
      setOutput(item.result || "");
      if (item.request) document.getElementById("request").value = item.request;
      if (item.target) {
        setOptValue("targetModelMain", item.target);
        updateCfgSummary();
      }
      setStatus("已载入历史记录", "ok");
    });

    box.appendChild(row);
  });
}

/* ============================================================
 * 五之二、学习库（投喂参考提示词）
 * ============================================================ */

function setLearnStatus(msg, cls) {
  const el = document.getElementById("learnStatus");
  el.textContent = msg || "";
  el.className = "status" + (cls ? " " + cls : "");
}

function updateLearnToggle() {
  const btn = document.getElementById("learnToggle");
  if (!btn) return;
  const on = isLearnOn();
  btn.textContent = "生成时参考：" + (on ? "开" : "关");
  if (on) btn.classList.add("learn-toggle-on");
  else btn.classList.remove("learn-toggle-on");
}

function renderLearn() {
  const list = loadLearn();
  const box = document.getElementById("learnList");
  document.getElementById("learnCount").textContent = String(list.length);

  while (box.firstChild) box.removeChild(box.firstChild);

  if (!list.length) {
    const empty = document.createElement("div");
    empty.className = "empty";
    empty.textContent = "还没有投喂内容";
    box.appendChild(empty);
    return;
  }

  list.forEach(function (item, idx) {
    const row = document.createElement("div");
    row.className = "learn-item";

    const main = document.createElement("div");
    main.className = "learn-main";

    const title = document.createElement("div");
    title.className = "learn-title";
    title.textContent = item.title || "(未命名)";

    const body = document.createElement("div");
    body.className = "learn-body";
    const b = item.body || "";
    body.textContent = b.length > 120 ? (b.slice(0, 120) + "…") : b;

    const meta = document.createElement("div");
    meta.className = "learn-meta";
    meta.textContent = (item.time || "") + " · " + b.length + " 字";

    main.appendChild(title);
    main.appendChild(body);
    main.appendChild(meta);

    const del = document.createElement("span");
    del.className = "learn-del";
    del.textContent = "×";
    del.addEventListener("click", function () {
      const l = loadLearn();
      l.splice(idx, 1);
      persistLearn(l);
      renderLearn();
      updateCfgSummary();
      setLearnStatus("已删除 1 条", "ok");
    });

    row.appendChild(main);
    row.appendChild(del);
    box.appendChild(row);
  });
}

/* ============================================================
 * 五之三、图生文（需要视觉模型）
 * ============================================================ */

let pickedImage = null;   // { name, dataUrl, base64, mime, bytes }

const IMG_MAX_BYTES = 6 * 1024 * 1024;   // 超过就提醒，base64 后体积会再涨 ~33%

function setImgStatus(msg, cls) {
  const el = document.getElementById("imgStatus");
  el.textContent = msg || "";
  el.className = "status" + (cls ? " " + cls : "");
}

function clearPickedImage() {
  pickedImage = null;
  document.getElementById("imgPath").value = "";
  const box = document.getElementById("imgPreview");
  while (box.firstChild) box.removeChild(box.firstChild);
  box.textContent = "还没有选择图片";
  box.classList.add("empty");
}

async function pickImage() {
  if (!fs || !fs.getFileForOpening) {
    setImgStatus("当前环境不支持选择文件", "err");
    return;
  }

  try {
    const file = await fs.getFileForOpening({ types: ["jpg", "jpeg", "png", "webp"] });
    if (!file) return;

    const buf = await file.read({ format: formats.binary });
    const bytes = new Uint8Array(buf);

    if (!bytes.length) { setImgStatus("读取图片失败：文件为空", "err"); return; }

    const mime = mimeOf(file.name);
    const b64 = bytesToBase64(bytes);

    pickedImage = {
      name: file.name,
      mime: mime,
      base64: b64,
      bytes: bytes.length,
      dataUrl: "data:" + mime + ";base64," + b64
    };

    document.getElementById("imgPath").value = file.name;

    // 预览：大图不渲染，避免面板卡住
    const box = document.getElementById("imgPreview");
    while (box.firstChild) box.removeChild(box.firstChild);
    box.classList.remove("empty");

    const kb = Math.round(bytes.length / 1024);
    if (bytes.length > 3 * 1024 * 1024) {
      box.textContent = file.name + "（" + kb + " KB，图太大不预览）";
    } else {
      try {
        const img = document.createElement("img");
        img.src = pickedImage.dataUrl;
        box.appendChild(img);
      } catch (e) {
        box.textContent = file.name + "（" + kb + " KB）";
      }
    }

    if (bytes.length > IMG_MAX_BYTES) {
      setImgStatus("已选择：" + file.name + "（" + kb + " KB）—— 图片偏大，部分接口会拒绝，" +
        "建议先压缩到 2MB 以内", "err");
    } else {
      setImgStatus("已选择：" + file.name + "（" + kb + " KB）", "ok");
    }
  } catch (e) {
    setImgStatus("读取图片失败：" + e.message, "err");
  }
}

async function runImageToText() {
  if (!pickedImage) { setImgStatus("请先选择一张图片", "err"); return; }

  const vc = visionConfig();
  if (!vc.baseUrl || !vc.apiKey || !vc.model) {
    setImgStatus("图生文需要视觉模型：请到「设置 → 视觉模型」填写，或把主模型换成支持看图的", "err");
    return;
  }

  const ask = document.getElementById("imgPrompt").value.trim() ||
    "反推出能复现这张图的提示词，写清构图、光线、镜头与画风。";

  const target = getOptValue("targetModelImg") || "nanobanana";
  const system = buildVisionSystemPrompt(target, loadKB());

  const msgs = [{
    role: "user",
    content: [
      { type: "text", text: ask },
      { type: "image_url", image_url: { url: pickedImage.dataUrl } }
    ]
  }];

  const btn = document.getElementById("imgGen");
  btn.disabled = true;
  setImgStatus("识别中…（图片较大时可能要十几秒）");

  try {
    const out = await callLLM(vc, msgs, system, 0.4);

    // 结果写回主界面结果区，后续可继续优化 / 导出
    setOutput(out);

    // 优化链用纯文本重建：视觉消息留在历史里会让不支持看图的模型报错
    messages = [
      { role: "user", content: "（图生文）识图要求：" + ask + "\n\n已得到如下提示词，请在此基础上按我的后续要求修改。" },
      { role: "assistant", content: out }
    ];
    outputStack = [out];

    addHistory({
      time: nowStr(),
      target: target,
      request: "【图生文】" + pickedImage.name,
      result: out
    });

    showView("viewMain");
    setStatus("图生文完成，结果已写入结果区（可继续优化或导出）", "ok");
  } catch (e) {
    setImgStatus("识别失败：" + e.message, "err");
  } finally {
    btn.disabled = false;
  }
}

/* ============================================================
 * 六、文件导出
 * ============================================================ */

function buildFilename(target, content) {
  const d = new Date();
  const p = function (n) { return n < 10 ? "0" + n : "" + n; };
  const ts = d.getFullYear() + p(d.getMonth() + 1) + p(d.getDate()) + "-" +
             p(d.getHours()) + p(d.getMinutes()) + p(d.getSeconds());

  if (target === "nanobanana") {
    try {
      const obj = JSON.parse(content);
      if (obj && obj.id) return obj.id + ".json";
    } catch (e) { /* 解析失败退回时间戳 */ }
    return "preset-" + ts + ".json";
  }
  if (target === "comfyui") return "comfyui-" + ts + ".json";
  return target + "-" + ts + ".txt";
}

async function saveAs(filename, content) {
  if (!fs || !formats) { setStatus("当前环境不支持文件保存", "err"); return; }
  const isJson = /\.json$/.test(filename);
  const file = await fs.getFileForSaving(filename, { types: isJson ? ["json"] : ["txt"] });
  if (!file) return;
  await file.write(content, { format: formats.utf8 });
  setStatus("已保存：" + file.name, "ok");
}

async function exportToDir() {
  if (!fs || !formats) { setStatus("当前环境不支持直接写目录，请用「另存为…」", "err"); return; }
  const out = getOutput().trim();
  if (!out) { setStatus("没有可导出的内容", "err"); return; }

  const cfg = loadConfig();
  const filename = buildFilename(currentTarget(), out);
  const dir = (cfg.exportDir || "").trim();

  if (!dir) { return saveAs(filename, out); }

  const dirClean = dir.replace(/\\/g, "/").replace(/\/+$/, "");
  const folderUrl = dirClean.indexOf("file:") === 0
    ? dirClean
    : "file:/" + dirClean.replace(/^\/+/, "");

  try {
    const folder = await fs.getEntryWithUrl(folderUrl);
    const file = await folder.createFile(filename, { overwrite: true });
    await file.write(out, { format: formats.utf8 });
    setStatus("已导出 " + filename + " → " + dirClean, "ok");
  } catch (e) {
    setStatus("导出失败：" + e.message + "（请检查导出目录是否存在）", "err");
  }
}

/* ============================================================
 * 七、拉取模型列表（OpenAI 兼容 GET /models）
 * ============================================================ */

/* 拉取模型列表。opt 用于区分「主模型」和「视觉模型」两套输入框。
 * fallbackToMain：视觉模型的地址/Key 允许留空（= 用主配置），这里替它兜底。 */
async function fetchModelsFromAPI(opt) {
  const o = opt || {};
  const baseId = o.baseUrlId || "baseUrl";
  const keyId = o.apiKeyId || "apiKey";
  const modelId = o.modelId || "model";
  const listId = o.listId || "modelList";
  const hintId = o.hintId || "modelHint";
  const statusId = o.statusId || "setupStatus";
  const statusFn = statusId === "setupStatus" ? setSetupStatus : setLinkStatus;

  let base = document.getElementById(baseId).value.trim().replace(/\/+$/, "");
  let key = document.getElementById(keyId).value.trim();

  if (o.fallbackToMain) {
    if (!base) base = document.getElementById("baseUrl").value.trim().replace(/\/+$/, "");
    if (!key) key = document.getElementById("apiKey").value.trim();
  }

  const hint = document.getElementById(hintId);

  if (!base || !key) {
    statusFn("请先填写接口地址和 API Key", "err");
    return;
  }

  const btn = document.getElementById(
    o.baseUrlId === "visionBaseUrl" ? "btnFetchVisionModels" : "btnFetchModels"
  );
  btn.disabled = true;
  hint.textContent = "正在拉取模型列表…";

  try {
    const res = await fetch(base + "/models", {
      headers: { "Authorization": "Bearer " + key }
    });
    const raw = await res.text();

    let data;
    try { data = JSON.parse(raw); }
    catch (e) { throw new Error("返回非 JSON（该服务商可能不支持 /models）"); }

    if (!res.ok) {
      const msg = (data && data.error && (data.error.message || data.error.code)) || res.status;
      throw new Error("HTTP " + res.status + "：" + msg);
    }

    const arr = data.data || data.models || [];
    const list = arr
      .map(function (m) { return (typeof m === "string") ? m : (m.id || m.name || ""); })
      .filter(Boolean)
      .sort();

    if (!list.length) throw new Error("未返回任何模型");

    buildOptList(
      listId,
      list.map(function (id) { return { value: id, label: id }; }),
      function (v) {
        document.getElementById(modelId).value = v;
        statusFn("已选择模型：" + v, "ok");
      }
    );
    document.getElementById(listId).classList.remove("hidden");

    const cur = document.getElementById(modelId).value.trim();
    if (cur && list.indexOf(cur) >= 0) setOptValue(listId, cur);

    hint.textContent = "已拉取 " + list.length + " 个模型";
    statusFn("模型列表已获取，请从下方选择", "ok");
  } catch (e) {
    hint.textContent = "";
    document.getElementById(listId).classList.add("hidden");
    statusFn("拉取失败：" + e.message + "（可手动填写模型名）", "err");
  } finally {
    btn.disabled = false;
  }
}

/* ============================================================
 * 八、调用 API（支持多轮对话）
 * ============================================================ */

let messages = [];      // 对话历史（不含 system）
let outputStack = [];   // 每轮结果，用于撤销

async function callLLM(cfg, msgs, systemPrompt, temperature) {
  const base = cfg.baseUrl.replace(/\/+$/, "");
  const url = /\/chat\/completions$/.test(base) ? base : base + "/chat/completions";

  const sys = systemPrompt || buildSystemPrompt(cfg.targetModel, loadKB());

  const body = {
    model: cfg.model,
    messages: [{ role: "system", content: sys }].concat(msgs),
    temperature: typeof temperature === "number" ? temperature : 0.7,
    stream: false
  };

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": "Bearer " + cfg.apiKey
    },
    body: JSON.stringify(body)
  });

  const raw = await res.text();
  let data;
  try { data = JSON.parse(raw); }
  catch (e) { throw new Error("返回非 JSON：" + raw.slice(0, 200)); }

  if (!res.ok) {
    const msg = (data && data.error && (data.error.message || data.error.code)) || res.status;
    throw new Error("API 错误 " + res.status + "：" + msg);
  }

  const text =
    (data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content) ||
    (data.choices && data.choices[0] && data.choices[0].text) || "";

  if (!text) throw new Error("返回内容为空");
  return text.trim();
}

/* ============================================================
 * 九、界面交互
 * ============================================================ */

function setStatus(msg, cls) {
  const el = document.getElementById("status");
  el.textContent = msg || "";
  el.className = "status" + (cls ? " " + cls : "");
}

function setSetupStatus(msg, cls) {
  const el = document.getElementById("setupStatus");
  el.textContent = msg || "";
  el.className = "status" + (cls ? " " + cls : "");
}

function setKbStatus(msg, cls) {
  const el = document.getElementById("kbStatus");
  el.textContent = msg || "";
  el.className = "status" + (cls ? " " + cls : "");
}

function setLinkStatus(msg, cls) {
  const el = document.getElementById("linkStatus");
  if (!el) return;
  el.textContent = msg || "";
  el.className = "status" + (cls ? " " + cls : "");
}

function resetConversation(clearText) {
  messages = [];
  outputStack = [];
  if (clearText !== false) {
    document.getElementById("request").value = "";
    document.getElementById("refine").value = "";
    setOutput("");
  }
}

function init() {
  const cfg = loadConfig();
  fillConfigForm(cfg);
  renderHistory();

  if (isConfigured(cfg)) showView("viewMain");
  else showView("viewSetup");

  /* ---------- 配置页：服务商预设 ---------- */
  const presetOpts = document.querySelectorAll("#providerPreset .opt");
  for (let i = 0; i < presetOpts.length; i++) {
    presetOpts[i].addEventListener("click", function () {
      const key = this.getAttribute("data-value") || "";
      const p = PROVIDERS[key];
      setOptValue("providerPreset", key);

      if (!p) return;
      if (key === "custom") {
        setSetupStatus("自定义模式：请手动填写接口地址与模型名", "ok");
        return;
      }

      document.getElementById("baseUrl").value = p.url;
      document.getElementById("model").value = p.model;
      setSetupStatus("已填入「" + this.textContent + "」的默认配置，请补填 API Key", "ok");

      const k = document.getElementById("apiKey").value.trim();
      if (k) setTimeout(fetchModelsFromAPI, 300);
    });
  }

  /* ---------- 配置页：拉取模型 ---------- */
  document.getElementById("btnFetchModels").addEventListener("click", function () {
    fetchModelsFromAPI();
  });

  document.getElementById("apiKey").addEventListener("change", function () {
    const base = document.getElementById("baseUrl").value.trim();
    if (base && this.value.trim()) fetchModelsFromAPI();
  });

  /* ---------- 配置页：视觉模型（图生文用）---------- */
  document.getElementById("btnFetchVisionModels").addEventListener("click", function () {
    fetchModelsFromAPI({
      baseUrlId: "visionBaseUrl",
      apiKeyId: "visionApiKey",
      modelId: "visionModel",
      listId: "visionModelList",
      hintId: "visionHint",
      statusId: "setupStatus",
      fallbackToMain: true
    });
  });

  /* ---------- 配置页：开源 / 作者主页 ---------- */
  document.getElementById("douyinUrl").textContent = DOUYIN_URL;

  document.getElementById("btnOpenDouyin").addEventListener("click", function () {
    if (openExternal(DOUYIN_URL)) {
      setLinkStatus("已在浏览器打开作者主页", "ok");
    } else {
      setLinkStatus("打开失败：请手动复制上面的链接", "err");
      copyText(DOUYIN_URL);
    }
  });

  document.getElementById("btnCopyDouyin").addEventListener("click", async function () {
    const ok = await copyText(DOUYIN_URL);
    if (ok) setLinkStatus("链接已复制，粘贴到浏览器或抖音即可打开", "ok");
    else setLinkStatus("复制不可用，链接已选中，请按 Ctrl+C", "err");
  });

  document.getElementById("btnOpenGithub").addEventListener("click", function () {
    if (openExternal(GITHUB_URL)) setLinkStatus("已在浏览器打开 GitHub 仓库", "ok");
    else setLinkStatus("打开失败：仓库地址 " + GITHUB_URL, "err");
  });

  /* ---------- 配置页：浏览目录 ---------- */
  document.getElementById("btnPickDir").addEventListener("click", async function () {
    if (!fs || !fs.getFolder) { setSetupStatus("当前环境不支持目录选择，请手动输入路径", "err"); return; }
    try {
      const folder = await fs.getFolder();
      if (!folder) return;
      const p = (folder.nativePath || "").replace(/\\/g, "/");
      document.getElementById("exportDir").value = p;
      setSetupStatus("已选择导出目录：" + p, "ok");
    } catch (e) {
      setSetupStatus("选择目录失败：" + e.message + "（可手动输入路径）", "err");
    }
  });

  /* ---------- 配置页：保存并进入 ---------- */
  document.getElementById("btnEnter").addEventListener("click", function () {
    const cfgNew = readConfig();
    if (!cfgNew.baseUrl || !cfgNew.apiKey || !cfgNew.model) {
      setSetupStatus("请填写完整：Base URL / API Key / 模型名", "err");
      return;
    }
    saveConfig(cfgNew);
    setSetupStatus("");
    showView("viewMain");
    setStatus("配置已保存，可以开始生成了", "ok");
  });

  /* ---------- 主界面顶部 ---------- */
  document.getElementById("btnSettings").addEventListener("click", function () {
    fillConfigForm(loadConfig());
    showView("viewSetup");
    setSetupStatus("修改后点「保存并进入」", "ok");
  });

  document.getElementById("btnKB").addEventListener("click", function () {
    showView("viewKB");
  });

  document.getElementById("btnLearn").addEventListener("click", function () {
    showView("viewLearn");
  });

  document.getElementById("btnImg").addEventListener("click", function () {
    showView("viewImg");
  });

  document.getElementById("btnNewChat").addEventListener("click", function () {
    resetConversation(true);
    setStatus("已开始新对话", "ok");
  });

  const mainOpts = document.querySelectorAll("#targetModelMain .opt");
  for (let i = 0; i < mainOpts.length; i++) {
    mainOpts[i].addEventListener("click", function () {
      setOptValue("targetModelMain", this.getAttribute("data-value") || "");
      const cfgNow = loadConfig();
      cfgNow.targetModel = currentTarget();
      try { localStorage.setItem(CFG_KEY, JSON.stringify(cfgNow)); } catch (e) { /* 忽略 */ }
      updateCfgSummary();
    });
  }

  /* ---------- 知识库 ---------- */
  document.getElementById("kbBack").addEventListener("click", function () {
    const kb = document.getElementById("kbText").value;
    saveKB(kb);
    showView("viewMain");
    setStatus(kb.trim() ? "知识库已生效，生成时会自动带上" : "知识库为空", "ok");
  });

  document.getElementById("kbSave").addEventListener("click", function () {
    const kb = document.getElementById("kbText").value;
    if (saveKB(kb)) {
      setKbStatus("已保存（" + kb.trim().length + " 字），生成时会自动带上", "ok");
    } else {
      setKbStatus("保存失败：本地存储不可用", "err");
    }
  });

  document.getElementById("kbClear").addEventListener("click", function () {
    document.getElementById("kbText").value = "";
    saveKB("");
    setKbStatus("已清空知识库", "ok");
  });

  /* ---------- 学习库 ---------- */
  document.getElementById("learnBack").addEventListener("click", function () {
    showView("viewMain");
    setStatus(loadLearn().length && isLearnOn()
      ? "学习库已生效（" + loadLearn().length + " 条），生成时会参考"
      : "学习库未启用", "ok");
  });

  document.getElementById("learnAdd").addEventListener("click", function () {
    const title = document.getElementById("learnTitle").value;
    const body = document.getElementById("learnBody").value;

    if (!body.trim()) { setLearnStatus("请先粘贴要投喂的提示词", "err"); return; }

    const n = addLearnBatch(title, body);
    document.getElementById("learnTitle").value = "";
    document.getElementById("learnBody").value = "";
    document.getElementById("learnTitle").focus();

    renderLearn();
    updateCfgSummary();
    setLearnStatus("已投喂 " + n + " 条" +
      (isLearnOn() ? "，生成时会自动参考" : "（当前「生成时参考」是关的，记得打开）"), "ok");
  });

  document.getElementById("learnToggle").addEventListener("click", function () {
    const next = !isLearnOn();
    setLearnOn(next);
    updateLearnToggle();
    updateCfgSummary();
    setLearnStatus(next ? "已开启：生成时会参考学习库" : "已关闭：生成时不再参考学习库",
      next ? "ok" : "");
  });

  document.getElementById("learnClear").addEventListener("click", function () {
    persistLearn([]);
    renderLearn();
    updateCfgSummary();
    setLearnStatus("已清空学习库", "ok");
  });

  /* ---------- 图生文 ---------- */
  document.getElementById("imgBack").addEventListener("click", function () {
    showView("viewMain");
  });

  document.getElementById("btnPickImage").addEventListener("click", function () {
    pickImage();
  });

  document.getElementById("imgGen").addEventListener("click", function () {
    runImageToText();
  });

  const imgOpts = document.querySelectorAll("#targetModelImg .opt");
  for (let i = 0; i < imgOpts.length; i++) {
    imgOpts[i].addEventListener("click", function () {
      setOptValue("targetModelImg", this.getAttribute("data-value") || "");
    });
  }

  /* ---------- 快捷填充 ---------- */
  const chips = document.querySelectorAll(".chip");
  for (let i = 0; i < chips.length; i++) {
    chips[i].addEventListener("click", function () {
      const ta = document.getElementById("request");
      const tpl = chips[i].getAttribute("data-tpl") || "";
      ta.value = ta.value.trim() ? (ta.value.trim() + "；" + tpl) : tpl;
      setStatus("已填入示例需求", "ok");
    });
  }

  /* ---------- 带上文档信息 ---------- */
  document.getElementById("useDoc").addEventListener("click", function () {
    if (!photoshop) { setStatus("当前不在 Photoshop 中运行", "err"); return; }
    try {
      const doc = photoshop.app.activeDocument;
      if (!doc) { setStatus("没有打开的文档", "err"); return; }
      const info =
        "（当前文档：" + doc.name + "，" +
        Math.round(doc.width) + "×" + Math.round(doc.height) + "px，" +
        Math.round(doc.resolution) + "dpi）";
      const ta = document.getElementById("request");
      ta.value = (ta.value.trim() + " " + info).trim();
      setStatus("已带上文档信息", "ok");
    } catch (e) {
      setStatus("读取文档失败：" + e.message, "err");
    }
  });

  /* ---------- 首次生成 ---------- */
  document.getElementById("gen").addEventListener("click", async function () {
    const req = document.getElementById("request").value.trim();
    if (!req) { setStatus("请先描述你的需求", "err"); return; }

    const cfgNow = readConfig();
    if (!isConfigured(cfgNow)) {
      setStatus("配置不完整，请到「设置」检查 API 信息", "err");
      return;
    }

    messages = [{ role: "user", content: req }];

    const btn = document.getElementById("gen");
    btn.disabled = true;
    setStatus("生成中…");

    try {
      const out = await callLLM(cfgNow, messages);
      messages.push({ role: "assistant", content: out });
      outputStack = [out];
      setOutput(out);
      addHistory({ time: nowStr(), target: currentTarget(), request: req, result: out });
      setStatus("生成完成", "ok");
    } catch (e) {
      setStatus("失败：" + e.message, "err");
    } finally {
      btn.disabled = false;
    }
  });

  /* ---------- 继续优化 ---------- */
  document.getElementById("btnRefine").addEventListener("click", async function () {
    const t = document.getElementById("refine").value.trim();
    if (!t) { setStatus("请先写修改要求", "err"); return; }
    if (!messages.length) { setStatus("请先点「生成提示词」得到初版结果", "err"); return; }

    const cfgNow = readConfig();
    messages.push({
      role: "user",
      content: "请基于上一版结果做如下修改，并输出【完整更新后的】结果（保持相同格式，不要只给片段）：\n" + t
    });

    const btn = document.getElementById("btnRefine");
    btn.disabled = true;
    setStatus("优化中…");

    try {
      const out = await callLLM(cfgNow, messages);
      messages.push({ role: "assistant", content: out });
      outputStack.push(out);
      setOutput(out);
      document.getElementById("refine").value = "";
      addHistory({ time: nowStr(), target: currentTarget(), request: "【优化】" + t, result: out });
      setStatus("已更新（第 " + outputStack.length + " 版）", "ok");
    } catch (e) {
      messages.pop();
      setStatus("优化失败：" + e.message, "err");
    } finally {
      btn.disabled = false;
    }
  });

  /* ---------- 撤销 ---------- */
  document.getElementById("btnRevert").addEventListener("click", function () {
    if (outputStack.length <= 1) { setStatus("没有可撤销的步骤", "err"); return; }
    outputStack.pop();
    messages = messages.slice(0, -2);
    setOutput(outputStack[outputStack.length - 1]);
    setStatus("已撤销，回到第 " + outputStack.length + " 版", "ok");
  });

  /* ---------- 编辑 / 完成：浏览态(div) 与 编辑态(textarea) 互切 ---------- */
  document.getElementById("btnEdit").addEventListener("click", function () {
    if (!currentOutput.trim()) { setStatus("还没有可编辑的内容", "err"); return; }

    if (!editingOutput) {
      // 进入编辑：把当前内容灌进 textarea
      const ta = document.getElementById("output");
      ta.value = currentOutput;
      editingOutput = true;
      applyEditMode();
      updateOutHint();
      setStatus("编辑模式：改完点「完成」写回结果区", "ok");
    } else {
      // 完成编辑：写回浏览区
      const ta = document.getElementById("output");
      currentOutput = ta.value;
      editingOutput = false;

      const view = document.getElementById("outputView");
      view.textContent = currentOutput;
      if (currentOutput) view.classList.remove("empty");
      else view.classList.add("empty");
      try { view.scrollTop = 0; } catch (e) { /* 忽略 */ }

      applyEditMode();
      updateOutHint();
      setStatus("修改已写回结果区", "ok");
    }
  });

  /* ---------- 上下翻页 ---------- */
  document.getElementById("btnScrollUp").addEventListener("click", function () {
    scrollOutput(-1);
  });
  document.getElementById("btnScrollDown").addEventListener("click", function () {
    scrollOutput(1);
  });

  /* ---------- 展开全部 / 收起 ---------- */
  document.getElementById("btnExpand").addEventListener("click", function () {
    const view = document.getElementById("outputView");
    if (view.classList.contains("expanded")) {
      view.classList.remove("expanded");
      this.textContent = "展开全部";
    } else {
      view.classList.add("expanded");
      this.textContent = "收起";
    }
    updateOutHint();
  });

  /* 编辑态输入时刷新提示 */
  document.getElementById("output").addEventListener("input", function () {
    updateOutHint();
  });

  /* ---------- 导出 / 另存 ---------- */
  document.getElementById("exportQuick").addEventListener("click", function () {
    exportToDir();
  });

  document.getElementById("save").addEventListener("click", function () {
    const v = getOutput().trim();
    if (!v) { setStatus("没有可保存的内容", "err"); return; }
    saveAs(buildFilename(currentTarget(), v), v).catch(function (e) {
      setStatus("保存失败：" + e.message, "err");
    });
  });

  /* ---------- 清空历史 ---------- */
  document.getElementById("clearHistory").addEventListener("click", function () {
    localStorage.removeItem(HISTORY_KEY);
    renderHistory();
    setStatus("历史记录已清空", "ok");
  });
}

/* 全局错误提示：任何脚本异常都显示在面板顶部 */
window.onerror = function (msg, src, line) {
  try {
    const bar = document.getElementById("errBar");
    if (bar) {
      bar.textContent = "脚本错误：" + msg + "（第 " + line + " 行）";
      bar.classList.remove("hidden");
    }
  } catch (e) { /* 忽略 */ }
  return false;
};

try {
  init();
} catch (e) {
  try {
    const bar = document.getElementById("errBar");
    if (bar) {
      bar.textContent = "初始化失败：" + (e && e.message ? e.message : String(e));
      bar.classList.remove("hidden");
    }
  } catch (e2) { /* 忽略 */ }
}
