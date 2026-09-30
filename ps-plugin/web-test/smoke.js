/* 冒烟测试：用 jsdom 加载真实 index.html + index.js，验证
 *  1) init() 不抛错
 *  2) 所有按钮 handler 都挂上了（点击不报错）
 *  3) 知识库能存/读，并且会注入到 system prompt
 *  4) 输出区是 div，复制/导出能读到内容
 */
const fs = require("fs");
const path = require("path");
const { JSDOM } = require("jsdom");

const PLUGIN = "C:/Users/couer/cos-effect-prompt/ps-plugin";
const html = fs.readFileSync(path.join(PLUGIN, "index.html"), "utf8");
const js = fs.readFileSync(path.join(PLUGIN, "index.js"), "utf8");

let passed = 0, failed = 0;
function check(name, cond, extra) {
  if (cond) { passed++; console.log("  PASS  " + name); }
  else { failed++; console.log("  FAIL  " + name + (extra ? "  -> " + extra : "")); }
}

// ---- 记录发出的请求，用于验证 system prompt 注入 ----
let capturedBody = null;
let copiedText = null;
let lastSaved = null;

const dom = new JSDOM(html, { runScripts: "outside-only", url: "http://localhost/" });
const w = dom.window;

// fetch 打桩
w.fetch = function (url, opts) {
  capturedBody = JSON.parse(opts.body);
  const payload = { choices: [{ message: { content: '{"id":"f_special_test","title":"测试"}' } }] };
  return Promise.resolve({
    ok: true, status: 200,
    text: function () { return Promise.resolve(JSON.stringify(payload)); }
  });
};
// alert 等
w.navigator.clipboard = { writeText: function (t) { copiedText = t; return Promise.resolve(); } };

// UXP 桩
w.require = function (name) {
  if (name === "uxp") {
    return { storage: { formats: { utf8: "utf8" }, localFileSystem: {
      getFileForSaving: function (suggested) {
        return Promise.resolve({
          name: suggested,
          write: function (content) { lastSaved = content; return Promise.resolve(); }
        });
      },
      getEntryWithUrl: function () { return Promise.reject(new Error("n/a")); },
      getFolder: function () { return Promise.reject(new Error("n/a")); }
    } } };
  }
  if (name === "clipboard") return { copy: function (t) { copiedText = t; } };
  if (name === "photoshop") throw new Error("no ps");
  throw new Error("unknown " + name);
};

const errors = [];
w.addEventListener("error", function (e) { errors.push(e.message); });

// 执行插件脚本
try {
  w.eval(js);
} catch (e) {
  console.log("  FAIL  脚本执行抛错 -> " + e.message);
  failed++;
}

console.log("\n[1] 初始化");
const d = w.document;
check("无未捕获错误", errors.length === 0, errors.join("; "));
check("错误条隐藏", d.getElementById("errBar").classList.contains("hidden"));
check("首屏为配置页", !d.getElementById("viewSetup").classList.contains("hidden"));
check("主界面隐藏", d.getElementById("viewMain").classList.contains("hidden"));

console.log("\n[2] 服务商预设自动填地址");
d.querySelector('#providerPreset .opt[data-value="deepseek"]').click();
check("baseUrl 已自动填入", d.getElementById("baseUrl").value === "https://api.deepseek.com/v1",
  d.getElementById("baseUrl").value);
check("model 已自动填入", d.getElementById("model").value === "deepseek-chat",
  d.getElementById("model").value);
check("预设高亮", d.querySelector('#providerPreset .opt[data-value="deepseek"]').classList.contains("active"));

console.log("\n[3] 保存配置进入主界面");
d.getElementById("apiKey").value = "sk-user-own-key";
d.getElementById("btnEnter").click();
check("进入主界面", !d.getElementById("viewMain").classList.contains("hidden"));
check("配置页隐藏", d.getElementById("viewSetup").classList.contains("hidden"));
check("摘要显示", d.getElementById("cfgSummary").textContent.indexOf("deepseek-chat") >= 0,
  d.getElementById("cfgSummary").textContent);

console.log("\n[4] 知识库");
d.getElementById("btnKB").click();
check("进入知识库页", !d.getElementById("viewKB").classList.contains("hidden"));
d.getElementById("kbText").value = "我的固定要求：特效一律写实3DCG；不要过度磨皮";
d.getElementById("kbSave").click();
check("保存成功提示", d.getElementById("kbStatus").classList.contains("ok"),
  d.getElementById("kbStatus").textContent);
check("已写入 localStorage", w.localStorage.getItem("cos_effect_prompt_kb_v1").indexOf("3DCG") >= 0);
d.getElementById("kbBack").click();
check("返回主界面", !d.getElementById("viewMain").classList.contains("hidden"));

console.log("\n[5] 生成（验证知识库注入 + 输出区可编辑）");
d.getElementById("request").value = "加个金色魔法阵";
d.getElementById("gen").click();

setTimeout(function () {
  const out = d.getElementById("output");
  check("输出区是 TEXTAREA（可编辑）", out.tagName === "TEXTAREA", out.tagName);
  check("输出内容已写入", out.value.indexOf("f_special_test") >= 0, out.value);
  check("自动增高 rows >= 12", out.rows >= 12, "rows=" + out.rows);

  const sys = capturedBody.messages[0].content;
  check("system prompt 含知识库标题", sys.indexOf("用户知识库") >= 0);
  check("system prompt 含知识库正文", sys.indexOf("不要过度磨皮") >= 0);
  check("system prompt 含技能核心", sys.indexOf("Cosplay 人像后期综合处理师") >= 0);

  console.log("\n[5b] 手动编辑结果后，导出内容跟着变");
  lastSaved = null;
  out.value = '{"id":"f_special_edited","title":"我改过的"}';
  d.getElementById("save").click();
  out.value = '{"id":"f_special_test","title":"测试"}';  // 还原，后面还要用

  // saveAs 是异步的，要等它落地再断言
  setTimeout(function () {
  check("另存取的是编辑后的内容",
    lastSaved && lastSaved.indexOf("f_special_edited") >= 0, String(lastSaved).slice(0, 50));

  console.log("\n[6] 复制按钮");
  copiedText = null;
  d.getElementById("copy").click();
  setTimeout(function () {
    check("复制到了输出区内容", copiedText && copiedText.indexOf("f_special_test") >= 0,
      String(copiedText).slice(0, 60));
    check("复制状态提示成功", d.getElementById("status").classList.contains("ok"),
      d.getElementById("status").textContent);
    check("状态里报了字符数", /\d+ 字符/.test(d.getElementById("status").textContent),
      d.getElementById("status").textContent);

    console.log("\n[6b] 剪贴板全挂时的兜底：应全选内容并提示 Ctrl+C");
    w.require = function (name) {
      if (name === "uxp") return { storage: { formats: { utf8: "utf8" }, localFileSystem: {
        getFileForSaving: function () { return Promise.resolve(null); },
        getEntryWithUrl: function () { return Promise.reject(new Error("n/a")); },
        getFolder: function () { return Promise.reject(new Error("n/a")); } } } };
      if (name === "clipboard") throw new Error("clipboard unavailable");
      if (name === "photoshop") throw new Error("no ps");
      throw new Error("unknown " + name);
    };
    // 重新加载脚本，模拟"剪贴板模块不存在"的环境
    const dom2 = new JSDOM(html, { runScripts: "outside-only", url: "http://localhost/" });
    const w2 = dom2.window;
    w2.localStorage.setItem("cos_effect_prompt_cfg_v1", JSON.stringify({
      baseUrl: "https://api.deepseek.com/v1", apiKey: "sk-x",
      model: "deepseek-chat", targetModel: "nanobanana", exportDir: ""
    }));
    w2.navigator.clipboard = undefined;
    w2.document.execCommand = function () { return false; };  // 全挂
    w2.require = w.require;
    w2.eval(js);
    const o2 = w2.document.getElementById("output");
    o2.value = "测试兜底内容";
    w2.document.getElementById("copy").click();
    setTimeout(function () {
      const st = w2.document.getElementById("status").textContent;
      check("兜底提示用户按 Ctrl+C", st.indexOf("Ctrl+C") >= 0, st);
      check("兜底时内容已全选",
        o2.selectionStart === 0 && o2.selectionEnd === o2.value.length,
        o2.selectionStart + "-" + o2.selectionEnd);

      runRest();
    }, 30);
  }, 30);
  }, 30);   // 5b 的等待

  function runRest() {
  console.log("\n[6c] 展开全部");
  const o = d.getElementById("output");
  d.getElementById("btnExpand").click();
  check("展开后加上 expanded", o.classList.contains("expanded"));
  check("按钮变为收起", d.getElementById("btnExpand").textContent === "收起");
  d.getElementById("btnExpand").click();
  check("再点恢复", !o.classList.contains("expanded"));

  console.log("\n[7] 继续优化 / 撤销");
  d.getElementById("refine").value = "改成蓝色";
  d.getElementById("btnRefine").click();
  setTimeout(function () {
    check("优化后仍有内容", d.getElementById("output").value.indexOf("f_special_test") >= 0);
    check("优化框已清空", d.getElementById("refine").value === "");
    check("优化请求带上了修改要求",
      JSON.stringify(capturedBody.messages).indexOf("改成蓝色") >= 0);
    d.getElementById("btnRevert").click();
    check("撤销回到上一版", d.getElementById("status").textContent.indexOf("撤销") >= 0,
      d.getElementById("status").textContent);

    console.log("\n[8] 历史记录");
    check("历史计数 > 0", d.getElementById("histCount").textContent !== "0",
      d.getElementById("histCount").textContent);
    check("历史条目已渲染", d.querySelectorAll("#historyList .hist-item").length > 0);

    console.log("\n=========================================");
    console.log("通过 " + passed + " / 失败 " + failed);
    console.log("运行时错误: " + (errors.length ? errors.join("; ") : "无"));
    process.exit(failed ? 1 : 0);
  }, 30);
  }  // runRest
}, 60);
