/* 冒烟测试：用 jsdom 加载真实 index.html + index.js，验证
 *  1) init() 不抛错，所有 handler 都挂上
 *  2) 服务商预设自动填地址、配置持久化、知识库存取与注入
 *  3) 结果区：浏览态是 div（可滚动），编辑态切 textarea，改完写回
 *  4) 上下翻页按钮真的改了 scrollTop
 *  5) 导出/另存读到的是编辑后的内容
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

let capturedBody = null;
let lastSaved = null;
let opened = null;

const dom = new JSDOM(html, { runScripts: "outside-only", url: "http://localhost/" });
const w = dom.window;

// jsdom 不会去取 <link rel=stylesheet>，把样式表内联进去，getComputedStyle 才有值
const css = fs.readFileSync(path.join(PLUGIN, "styles.css"), "utf8");
const styleEl = w.document.createElement("style");
styleEl.textContent = css;
w.document.head.appendChild(styleEl);

w.fetch = function (url, opts) {
  capturedBody = JSON.parse(opts.body);
  const payload = { choices: [{ message: { content: '{"id":"f_special_test","title":"测试"}' } }] };
  return Promise.resolve({
    ok: true, status: 200,
    text: function () { return Promise.resolve(JSON.stringify(payload)); }
  });
};

function makeRequire() {
  return function (name) {
    if (name === "uxp") {
      return {
        shell: { openExternal: function (u) { opened = u; return Promise.resolve(); } },
        storage: { formats: { utf8: "utf8" }, localFileSystem: {
        getFileForSaving: function (suggested) {
          return Promise.resolve({
            name: suggested,
            write: function (content) { lastSaved = content; return Promise.resolve(); }
          });
        },
        getFileForOpening: function () {
          // 假装用户选了一张 6 字节的 JPEG（走真实的 pickImage 路径）
          const bytes = new Uint8Array([0xFF, 0xD8, 0xFF, 0xE0, 0x00, 0x10]);
          return Promise.resolve({
            name: "test.jpg",
            read: function () { return Promise.resolve(bytes.buffer); }
          });
        },
        getEntryWithUrl: function () { return Promise.reject(new Error("n/a")); },
        getFolder: function () { return Promise.reject(new Error("n/a")); }
      } } };
    }
    if (name === "clipboard") throw new Error("clipboard unavailable");
    if (name === "photoshop") throw new Error("no ps");
    throw new Error("unknown " + name);
  };
}
w.require = makeRequire();

const errors = [];
w.addEventListener("error", function (e) { errors.push(e.message); });

try {
  w.eval(js);
} catch (e) {
  console.log("  FAIL  脚本执行抛错 -> " + e.message);
  failed++;
}

const d = w.document;

console.log("\n[1] 初始化");
check("无未捕获错误", errors.length === 0, errors.join("; "));
check("错误条隐藏", d.getElementById("errBar").classList.contains("hidden"));
check("首屏为配置页", !d.getElementById("viewSetup").classList.contains("hidden"));
check("复制按钮已移除", d.getElementById("copy") === null);

console.log("\n[2] 服务商预设自动填地址");
d.querySelector('#providerPreset .opt[data-value="deepseek"]').click();
check("baseUrl 已自动填入", d.getElementById("baseUrl").value === "https://api.deepseek.com/v1");
check("model 已自动填入", d.getElementById("model").value === "deepseek-chat");

console.log("\n[3] 保存配置进入主界面");
d.getElementById("apiKey").value = "sk-user-own-key";
d.getElementById("btnEnter").click();
check("进入主界面", !d.getElementById("viewMain").classList.contains("hidden"));
check("摘要显示", d.getElementById("cfgSummary").textContent.indexOf("deepseek-chat") >= 0);

console.log("\n[4] 知识库");
d.getElementById("btnKB").click();
check("进入知识库页", !d.getElementById("viewKB").classList.contains("hidden"));
d.getElementById("kbText").value = "我的固定要求：特效一律写实3DCG；不要过度磨皮";
d.getElementById("kbSave").click();
check("保存成功提示", d.getElementById("kbStatus").classList.contains("ok"));
check("已写入 localStorage", w.localStorage.getItem("cos_effect_prompt_kb_v1").indexOf("3DCG") >= 0);
d.getElementById("kbBack").click();
check("返回主界面", !d.getElementById("viewMain").classList.contains("hidden"));

console.log("\n[5] 生成 + 知识库注入");
d.getElementById("request").value = "加个金色魔法阵";
d.getElementById("gen").click();

setTimeout(function () {
  const view = d.getElementById("outputView");
  const ta = d.getElementById("output");

  check("浏览态是 DIV", view.tagName === "DIV", view.tagName);
  check("浏览态显示内容", view.textContent.indexOf("f_special_test") >= 0, view.textContent);
  check("empty 标记已移除", !view.classList.contains("empty"));
  check("编辑态默认隐藏", ta.classList.contains("hidden"));

  const sys = capturedBody.messages[0].content;
  check("system prompt 含知识库标题", sys.indexOf("用户知识库") >= 0);
  check("system prompt 含知识库正文", sys.indexOf("不要过度磨皮") >= 0);
  check("system prompt 含技能核心", sys.indexOf("Cosplay 人像后期综合处理师") >= 0);

  console.log("\n[5b] 滚动：固定高度 + overflow，翻页按钮改 scrollTop");
  const cs = w.getComputedStyle(view);
  check("结果区设了固定 height", cs.height && cs.height !== "auto", cs.height);
  check("overflow-y 为 auto", cs.overflowY === "auto", cs.overflowY);
  check("CSS 里有 .output-view 规则",
    /\.output-view\s*\{[^}]*height:\s*280px/.test(
      fs.readFileSync(path.join(PLUGIN, "styles.css"), "utf8")));

  // jsdom 不做排版，手动给出尺寸来验证按钮逻辑
  Object.defineProperty(view, "clientHeight", { value: 280, configurable: true });
  Object.defineProperty(view, "scrollHeight", { value: 1200, configurable: true });
  view.scrollTop = 0;

  d.getElementById("btnScrollDown").click();
  check("↓ 向下 使 scrollTop 增加", view.scrollTop > 0, "scrollTop=" + view.scrollTop);
  const afterDown = view.scrollTop;
  d.getElementById("btnScrollUp").click();
  check("↑ 向上 使 scrollTop 减少", view.scrollTop < afterDown,
    afterDown + " -> " + view.scrollTop);

  console.log("\n[5c] 展开全部 / 收起");
  d.getElementById("btnExpand").click();
  check("加上 expanded", view.classList.contains("expanded"));
  check("按钮变为收起", d.getElementById("btnExpand").textContent === "收起");
  d.getElementById("btnExpand").click();
  check("再点恢复", !view.classList.contains("expanded"));
  check("按钮变回展开全部", d.getElementById("btnExpand").textContent === "展开全部");

  console.log("\n[5d] 编辑模式：切换 / 写回 / 导出取改后内容");
  const btnEdit = d.getElementById("btnEdit");
  btnEdit.click();
  check("切到编辑态：textarea 显示", !ta.classList.contains("hidden"));
  check("切到编辑态：div 隐藏", view.classList.contains("hidden"));
  check("编辑态预填了内容", ta.value.indexOf("f_special_test") >= 0);
  check("按钮变为完成", btnEdit.textContent === "完成");

  lastSaved = null;
  ta.value = '{"id":"f_special_edited","title":"我改过的"}';
  d.getElementById("save").click();          // 编辑态下直接另存
  ta.value = '{"id":"f_special_edited","title":"我改过的"}';

  setTimeout(function () {
    check("另存取的是编辑后的内容",
      lastSaved && lastSaved.indexOf("f_special_edited") >= 0, String(lastSaved).slice(0, 50));

    btnEdit.click();  // 完成
    check("完成后回到浏览态", !view.classList.contains("hidden"));
    check("编辑框重新隐藏", ta.classList.contains("hidden"));
    check("按钮变回编辑", btnEdit.textContent === "编辑");
    check("改动已写回浏览区", view.textContent.indexOf("f_special_edited") >= 0, view.textContent);

    console.log("\n[5e] 编辑后再导出到目录，内容同步");
    const edited = d.getElementById("outputView").textContent;
    check("浏览区与编辑内容一致", edited.indexOf("f_special_edited") >= 0);

    runRest();
  }, 30);

  function runRest() {
  console.log("\n[6] 继续优化 / 撤销");
  d.getElementById("refine").value = "改成蓝色";
  d.getElementById("btnRefine").click();
  setTimeout(function () {
    check("优化后内容已刷新", d.getElementById("outputView").textContent.indexOf("f_special_test") >= 0,
      d.getElementById("outputView").textContent);
    check("优化框已清空", d.getElementById("refine").value === "");
    check("优化请求带上了修改要求",
      JSON.stringify(capturedBody.messages).indexOf("改成蓝色") >= 0);

    d.getElementById("btnRevert").click();
    check("撤销回到上一版", d.getElementById("status").textContent.indexOf("撤销") >= 0,
      d.getElementById("status").textContent);

    console.log("\n[7] 历史记录");
    check("历史计数 > 0", d.getElementById("histCount").textContent !== "0");
    check("历史条目已渲染", d.querySelectorAll("#historyList .hist-item").length > 0);

    console.log("\n[8] 历史回填 / 新对话");
    d.querySelectorAll("#historyList .hist-item")[0].click();
    check("点历史后内容回填",
      d.getElementById("outputView").textContent.indexOf("f_special_test") >= 0);
    check("回填后回到浏览态",
      !d.getElementById("outputView").classList.contains("hidden"));

    d.getElementById("btnNewChat").click();
    check("新对话清空结果区", d.getElementById("outputView").textContent.indexOf("f_special") < 0);
    check("新对话后 empty 标记回来",
      d.getElementById("outputView").classList.contains("empty"));

    testLearn(function () {
      testImg(function () {
        testLinks();
        done();
      });
    });
  }, 30);
  }  // runRest
}, 60);   // [5] 的外层等待


/* ===== 学习库 ===== */
function testLearn(next) {
  console.log("\n[9] 学习库：投喂与联动");
  d.getElementById("btnLearn").click();
  check("打开学习库视图", !d.getElementById("viewLearn").classList.contains("hidden"));
  check("初始为空", d.getElementById("learnCount").textContent === "0");
  check("默认开启参考", d.getElementById("learnToggle").textContent === "生成时参考：开");

  // 一次粘两条（空行分隔）
  d.getElementById("learnTitle").value = "样例A";
  d.getElementById("learnBody").value =
    "cyberpunk street at night, neon reflections on wet asphalt --ar 16:9\n\n" +
    "portrait, 85mm, f/1.4, soft rim light, shallow depth of field";
  d.getElementById("learnAdd").click();

  check("空行分隔批量投喂 2 条", d.getElementById("learnCount").textContent === "2",
    d.getElementById("learnCount").textContent);
  check("投喂后清空输入框", d.getElementById("learnBody").value === "");
  check("已写入 localStorage", (w.localStorage.getItem("cos_effect_prompt_learn_v1") || "").indexOf("cyberpunk") >= 0);
  check("列表渲染出条目", d.querySelectorAll("#learnList .learn-item").length === 2);
  check("主界面摘要显示学习库", d.getElementById("cfgSummary").textContent.indexOf("学习库") >= 0,
    d.getElementById("cfgSummary").textContent);

  // 联动：生成请求里必须出现投喂内容
  d.getElementById("learnBack").click();
  capturedBody = null;
  d.getElementById("request").value = "来个夜景";
  d.getElementById("gen").click();

  setTimeout(function () {
    const sys = capturedBody.messages[0].content;
    check("生成请求带上了投喂内容", sys.indexOf("cyberpunk street at night") >= 0);
    check("生成请求带上了范例标题", sys.indexOf("参考范例") >= 0);

    // 关掉开关后不应再带
    d.getElementById("btnLearn").click();
    d.getElementById("learnToggle").click();
    check("关闭后按钮文案变化",
      d.getElementById("learnToggle").textContent === "生成时参考：关",
      d.getElementById("learnToggle").textContent);

    d.getElementById("learnBack").click();
    capturedBody = null;
    d.getElementById("gen").click();

    setTimeout(function () {
      const sys2 = capturedBody.messages[0].content;
      check("关闭后生成请求不再带投喂内容", sys2.indexOf("cyberpunk street at night") < 0);
      check("关闭后知识库仍然生效", sys2.indexOf("不要过度磨皮") >= 0);

      // 重新打开，后面的图生文要用
      d.getElementById("btnLearn").click();
      d.getElementById("learnToggle").click();
      d.getElementById("learnBack").click();

      // 删除一条
      d.getElementById("btnLearn").click();
      d.querySelector("#learnList .learn-del").click();
      check("删除后剩 1 条", d.getElementById("learnCount").textContent === "1");
      d.getElementById("learnBack").click();
      next();
    }, 30);
  }, 30);
}

/* ===== 图生文 ===== */
function testImg(next) {
  console.log("\n[10] 图生文");
  d.getElementById("btnImg").click();
  check("打开图生文视图", !d.getElementById("viewImg").classList.contains("hidden"));

  // 未选图就点生成 → 应拦住
  d.getElementById("imgGen").click();
  check("未选图时拦住并提示", d.getElementById("imgStatus").textContent.indexOf("请先选择") >= 0,
    d.getElementById("imgStatus").textContent);

  function boot(cfg, fetchImpl) {
    const dm = new JSDOM(html, { runScripts: "outside-only", url: "http://localhost/" });
    const wm = dm.window;
    const st = wm.document.createElement("style");
    st.textContent = css;
    wm.document.head.appendChild(st);
    wm.localStorage.setItem("cos_effect_prompt_cfg_v1", JSON.stringify(cfg));
    wm.localStorage.setItem("cos_effect_prompt_kb_v1", "我的固定要求：写实3DCG，不要过度磨皮");
    wm.require = makeRequire();
    wm.fetch = fetchImpl;
    wm.eval(js);
    return { w: wm, d: wm.document };
  }

  // --- 情况一：只配了主模型（DeepSeek 这种纯文本），没配视觉模型 ---
  const a = boot({
    baseUrl: "https://api.deepseek.com/v1", apiKey: "sk-x", model: "deepseek-chat",
    targetModel: "nanobanana", exportDir: ""
  }, function () { throw new Error("不该发起请求"); });

  a.d.getElementById("btnImg").click();
  a.d.getElementById("btnPickImage").click();

  setTimeout(function () {
    check("取图后路径已填", a.d.getElementById("imgPath").value === "test.jpg",
      a.d.getElementById("imgPath").value);
    check("取图后有成功提示", a.d.getElementById("imgStatus").classList.contains("ok"),
      a.d.getElementById("imgStatus").textContent);
    check("预览区不再是空态", !a.d.getElementById("imgPreview").classList.contains("empty"));

    a.d.getElementById("imgGen").click();
    check("没配视觉模型时给出明确提示",
      a.d.getElementById("imgStatus").textContent.indexOf("视觉模型") >= 0,
      a.d.getElementById("imgStatus").textContent);

    // --- 情况二：配了独立视觉模型 → 走通，检查请求体 ---
    let visionReq = null;
    const b = boot({
      baseUrl: "https://api.deepseek.com/v1", apiKey: "sk-x", model: "deepseek-chat",
      visionBaseUrl: "https://dashscope.aliyuncs.com/compatible-mode/v1",
      visionApiKey: "sk-vision", visionModel: "qwen-vl-max",
      targetModel: "nanobanana", exportDir: ""
    }, function (url, opts) {
      visionReq = { url: url, body: JSON.parse(opts.body), auth: opts.headers.Authorization };
      return Promise.resolve({
        ok: true, status: 200,
        text: function () {
          return Promise.resolve(JSON.stringify({
            choices: [{ message: { content: '{"id":"f_scene_from_image","title":"图生文结果"}' } }]
          }));
        }
      });
    });

    b.d.getElementById("btnImg").click();
    b.d.getElementById("btnPickImage").click();

    setTimeout(function () {
      b.d.getElementById("imgPrompt").value = "反推这张图的提示词";
      b.d.getElementById("imgGen").click();

      setTimeout(function () {
        check("图生文用视觉模型的地址", visionReq && visionReq.url.indexOf("dashscope") >= 0,
          visionReq && visionReq.url);
        check("图生文用视觉模型的 Key", visionReq && visionReq.auth === "Bearer sk-vision",
          visionReq && visionReq.auth);
        check("图生文用视觉模型名", visionReq && visionReq.body.model === "qwen-vl-max",
          visionReq && visionReq.body.model);

        const msg = visionReq && visionReq.body.messages;
        const content = msg && msg[1] && msg[1].content;
        check("消息是视觉数组格式", Array.isArray(content), typeof content);
        check("含 image_url 且是 data URL",
          Array.isArray(content) && content[1] && content[1].type === "image_url" &&
          content[1].image_url.url.indexOf("data:image/jpeg;base64,") === 0,
          Array.isArray(content) ? JSON.stringify(content[1]).slice(0, 80) : "");
        check("图片被正确 base64 编码",
          Array.isArray(content) && content[1].image_url.url.indexOf("data:image/jpeg;base64,/9j/") === 0,
          Array.isArray(content) ? content[1].image_url.url : "");
        check("含用户的识图要求",
          Array.isArray(content) && content[0].text.indexOf("反推这张图") >= 0);
        check("system prompt 是识图专用",
          msg && msg[0].content.indexOf("看图反推提示词") >= 0);
        check("图生文也带上了知识库",
          msg && msg[0].content.indexOf("写实3DCG") >= 0);

        check("结果写回主界面结果区",
          b.d.getElementById("outputView").textContent.indexOf("f_scene_from_image") >= 0,
          b.d.getElementById("outputView").textContent);
        check("并切回了主界面", !b.d.getElementById("viewMain").classList.contains("hidden"));

        next();
      }, 40);
    }, 40);
  }, 40);
}

/* ===== 开源说明 / 作者主页 ===== */
function testLinks() {
  console.log("\n[11] 开源说明与作者主页");
  d.getElementById("btnSettings").click();
  check("回到设置页", !d.getElementById("viewSetup").classList.contains("hidden"));

  check("显示作者抖音链接",
    d.getElementById("douyinUrl").textContent.indexOf("v.douyin.com/dNeL4w9CUBs") >= 0,
    d.getElementById("douyinUrl").textContent);
  check("有开源说明卡片", d.body.textContent.indexOf("开源说明") >= 0);
  check("说明了 GitHub 仓库", d.body.textContent.indexOf("Couer869/cos-effect-prompt") >= 0);

  // openExternal 打桩，验证点「前往」会调用它
  opened = null;
  d.getElementById("btnOpenDouyin").click();
  check("前往抖音调用了 openExternal", opened === "https://v.douyin.com/dNeL4w9CUBs/", String(opened));
  check("并给出状态提示", d.getElementById("linkStatus").classList.contains("ok"),
    d.getElementById("linkStatus").textContent);

  d.getElementById("btnOpenGithub").click();
  check("打开 GitHub 调用了 openExternal",
    opened === "https://github.com/Couer869/cos-effect-prompt", String(opened));
}

function done() {
  console.log("\n=========================================");
  console.log("通过 " + passed + " / 失败 " + failed);
  console.log("运行时错误: " + (errors.length ? errors.join("; ") : "无"));
  process.exit(failed ? 1 : 0);
}
