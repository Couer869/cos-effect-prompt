/* COS 后期提示词生成器 — Photoshop UXP 插件
 * 用户填入自己的 OpenAI 兼容 API，生成专业后期提示词。
 * Key 仅存本机 localStorage，不上传任何第三方。
 */

const uxp = require("uxp");
const fs = uxp.storage.localFileSystem;
const formats = uxp.storage.formats;
const clipboard = require("clipboard");

let photoshop = null;
try { photoshop = require("photoshop"); } catch (e) { /* 非 PS 环境忽略 */ }

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

function buildSystemPrompt(target) {
  let fmt = FORMAT_NANOBANANA;
  if (target === "midjourney") fmt = FORMAT_MJ;
  else if (target === "comfyui") fmt = FORMAT_COMFYUI;
  else if (target === "novelai") fmt = FORMAT_NOVELAI;

  return (
    SKILL_CORE +
    "\n" +
    fmt +
    `
【工作方式】
- 用户只描述需求时：直接生成提示词，不要反问（除非完全无从下手）
- 用户给出照片并问"这是什么风格/怎么做的/照着做"时：进入反推模式——先给 3-5 条简短分析，再给可复现的提示词
- 输出纯净可用，不要加多余的寒暄与解释
- 只输出最终结果本身，不要包 markdown 代码块标记
`
  );
}

/* ============================================================
 * 二、设置存取
 * ============================================================ */

const CFG_KEY = "cos_effect_prompt_cfg_v1";
const HISTORY_KEY = "cos_effect_prompt_history_v1";
const MAX_HISTORY = 30;

function loadConfig() {
  try { return JSON.parse(localStorage.getItem(CFG_KEY) || "{}"); }
  catch (e) { return {}; }
}

function saveConfig(cfg) {
  try { localStorage.setItem(CFG_KEY, JSON.stringify(cfg)); }
  catch (e) { setStatus("设置保存失败：" + e.message, "err"); }
}

function readForm() {
  return {
    baseUrl: document.getElementById("baseUrl").value.trim(),
    apiKey: document.getElementById("apiKey").value.trim(),
    model: document.getElementById("model").value.trim(),
    targetModel: document.getElementById("targetModel").value,
    exportDir: document.getElementById("exportDir").value.trim()
  };
}

function writeForm(cfg) {
  document.getElementById("baseUrl").value = cfg.baseUrl || "";
  document.getElementById("apiKey").value = cfg.apiKey || "";
  document.getElementById("model").value = cfg.model || "";
  document.getElementById("targetModel").value = cfg.targetModel || "nanobanana";
  document.getElementById("exportDir").value = cfg.exportDir || "";
}

/* ============================================================
 * 三、历史记录
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

  // 清空
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
      document.getElementById("output").value = item.result || "";
      if (item.request) document.getElementById("request").value = item.request;
      if (item.target) document.getElementById("targetModel").value = item.target;
      setStatus("已载入历史记录", "ok");
    });

    box.appendChild(row);
  });
}

/* ============================================================
 * 四、文件导出
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
  const isJson = /\.json$/.test(filename);
  const file = await fs.getFileForSaving(filename, { types: isJson ? ["json"] : ["txt"] });
  if (!file) return;
  await file.write(content, { format: formats.utf8 });
  setStatus("已保存：" + file.name, "ok");
}

async function exportToDir() {
  const out = document.getElementById("output").value.trim();
  if (!out) { setStatus("没有可导出的内容", "err"); return; }

  const cfg = readForm();
  const filename = buildFilename(cfg.targetModel, out);
  const dir = (cfg.exportDir || "").trim();

  // 未设目录 → 退回"另存为"对话框
  if (!dir) { return saveAs(filename, out); }

  // 归一化目录路径为 file: URL
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
 * 五、调用 API
 * ============================================================ */

async function callLLM(cfg, userText) {
  const base = cfg.baseUrl.replace(/\/+$/, "");
  const url = /\/chat\/completions$/.test(base) ? base : base + "/chat/completions";

  const body = {
    model: cfg.model,
    messages: [
      { role: "system", content: buildSystemPrompt(cfg.targetModel) },
      { role: "user", content: userText }
    ],
    temperature: 0.7,
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
 * 六、界面交互
 * ============================================================ */

function setStatus(msg, cls) {
  const el = document.getElementById("status");
  el.textContent = msg || "";
  el.className = "status" + (cls ? " " + cls : "");
}

function init() {
  writeForm(loadConfig());
  renderHistory();

  // 设置区折叠
  const toggle = document.getElementById("settingsToggle");
  const body = document.getElementById("settingsBody");
  toggle.addEventListener("click", function () {
    if (body.classList.contains("hidden")) {
      body.classList.remove("hidden");
      document.getElementById("chev").textContent = "▾";
    } else {
      body.classList.add("hidden");
      document.getElementById("chev").textContent = "▸";
    }
  });

  // 保存 / 清除设置
  document.getElementById("saveCfg").addEventListener("click", function () {
    saveConfig(readForm());
    setStatus("设置已保存（仅存本机）", "ok");
  });

  document.getElementById("clearCfg").addEventListener("click", function () {
    localStorage.removeItem(CFG_KEY);
    writeForm({});
    setStatus("已清除设置", "ok");
  });

  // 快捷填充
  const chips = document.querySelectorAll(".chip");
  for (let i = 0; i < chips.length; i++) {
    chips[i].addEventListener("click", function () {
      const ta = document.getElementById("request");
      const tpl = chips[i].getAttribute("data-tpl") || "";
      ta.value = ta.value.trim() ? (ta.value.trim() + "；" + tpl) : tpl;
      setStatus("已填入示例需求", "ok");
    });
  }

  // 带上当前文档信息
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

  // 生成
  document.getElementById("gen").addEventListener("click", async function () {
    const cfg = readForm();
    if (!cfg.baseUrl || !cfg.apiKey || !cfg.model) {
      setStatus("请先填写 Base URL / API Key / 模型名", "err");
      return;
    }
    const req = document.getElementById("request").value.trim();
    if (!req) { setStatus("请先描述你的需求", "err"); return; }

    saveConfig(cfg);
    const btn = document.getElementById("gen");
    btn.disabled = true;
    setStatus("生成中…");

    try {
      const out = await callLLM(cfg, req);
      document.getElementById("output").value = out;
      addHistory({ time: nowStr(), target: cfg.targetModel, request: req, result: out });
      setStatus("生成完成", "ok");
    } catch (e) {
      setStatus("失败：" + e.message, "err");
    } finally {
      btn.disabled = false;
    }
  });

  // 复制
  document.getElementById("copy").addEventListener("click", function () {
    const v = document.getElementById("output").value;
    if (!v) { setStatus("没有可复制的内容", "err"); return; }
    clipboard.copy(v);
    setStatus("已复制到剪贴板", "ok");
  });

  // 导出到目录
  document.getElementById("exportQuick").addEventListener("click", function () {
    exportToDir();
  });

  // 另存为
  document.getElementById("save").addEventListener("click", function () {
    const v = document.getElementById("output").value.trim();
    if (!v) { setStatus("没有可保存的内容", "err"); return; }
    const cfg = readForm();
    saveAs(buildFilename(cfg.targetModel, v), v).catch(function (e) {
      setStatus("保存失败：" + e.message, "err");
    });
  });

  // 清空历史
  document.getElementById("clearHistory").addEventListener("click", function () {
    localStorage.removeItem(HISTORY_KEY);
    renderHistory();
    setStatus("历史记录已清空", "ok");
  });
}

init();
