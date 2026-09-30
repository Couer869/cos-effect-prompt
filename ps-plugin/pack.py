# -*- coding: utf-8 -*-
"""把本插件打包成可分发的 zip。

用法：
    python pack.py

只收运行时文件（manifest/index.html/index.js/styles.css）+ README +
安装说明，web-test/ 等开发文件不进包。打包前后对包内每个文件做一次
发布前扫描，扫出敏感内容就中止，不产出 zip。

输出：~/Downloads/cos-effect-prompt-ps-plugin-v<版本>.zip
"""
import io
import json
import os
import re
import shutil
import sys
import zipfile

SRC = os.path.dirname(os.path.abspath(__file__))          # 本脚本就在 ps-plugin/ 下
OUT_DIR = os.path.join(os.path.expanduser("~"), "Downloads")
STAGE = os.path.join(os.environ.get("TEMP", os.path.expanduser("~")),
                     "cos-plugin-package-stage")
PKG_NAME = "cos-effect-prompt"

RUNTIME = ["manifest.json", "index.html", "index.js", "styles.css"]
EXTRA = ["README.md"]

# 只有代码文件才查"埋点"——文档里出现这些词往往是在讲怎么防埋点，不算问题
CODE_FILES = ("index.js", "index.html", "styles.css", "manifest.json")

# 代码里才需要查的"埋点"真实形态
TELEMETRY_CODE = [
    (r"(?i)sendBeacon", "埋点上报"),
    (r"(?i)\bgtag\s*\(|google-analytics|googletagmanager", "埋点上报"),
    (r"(?i)mixpanel|umami|plausible\.io|posthog|sentry\.io", "埋点上报"),
    (r"(?i)new\s+Image\s*\(\s*\)\s*\.src\s*=", "疑似埋点像素"),
]

# 所有文件都要查的
COMMON = [
    # 真实密钥形态（sk-xxx / sk-... 这类占位符长度不够，不会命中）
    (r"sk-[A-Za-z0-9_\-]{16,}", "疑似 API Key"),
    (r"(?i)bearer\s+[A-Za-z0-9_\-\.]{16,}", "疑似 Bearer 令牌"),
    (r"(?i)(api[_-]?key|apikey|secret|access[_-]?token|password)\s*[\"']?\s*[:=]\s*[\"'][^\"']{12,}[\"']",
     "疑似硬编码凭据"),
    # 打包机的绝对路径：只认真实盘符路径，%APPDATA% 这类占位符放行
    (r"[A-Za-z]:\\+Users\\+[A-Za-z0-9_.\-]+", "本机用户目录绝对路径"),
    (r"[A-Za-z]:\\+[A-Za-z0-9_\-]+\\+[A-Za-z0-9_\-]+\\+[A-Za-z0-9_\- ]{4,}\\+", "本机绝对路径"),
    # 白名单之外的外链
    (r"https?://(?!github\.com/Couer869|v\.douyin\.com|api\.deepseek\.com|dashscope\.aliyuncs\.com"
     r"|api\.moonshot\.cn|open\.bigmodel\.cn|api\.siliconflow\.cn|api\.minimax\.chat"
     r"|api\.openai\.com|openrouter\.ai|registry\.npmmirror\.com|www\.adobe\.com"
     r"|developer\.adobe\.com|creativecloud\.adobe\.com)[A-Za-z0-9\.\-]+", "白名单外的外链"),
]

# 打包者本人标识。Couer869 是公开 GitHub 账号、com.couer869.* 是插件 id，
# 属于有意公开的署名，先剔除再查剩余部分，避免误报
SELF_MARKS = [
    (r"(?i)\bcouer\b", "打包者用户名"),
    (r"(?i)\bcouer869\b", "打包者用户名"),
]

INSTALL_TXT = u"""COS 后期提示词生成器 — Photoshop 插件 v%(ver)s
================================================

【安装（30 秒，不需要任何额外工具）】

1. 关闭 Photoshop
2. 找到 Photoshop 安装目录下的 Plug-ins 文件夹，例如：
      C:\\Program Files\\Adobe\\Adobe Photoshop 2026\\Plug-ins\\
   （装在 D 盘就换成 D:\\...\\Adobe Photoshop 2026\\Plug-ins\\）
3. 把压缩包里的 cos-effect-prompt 整个文件夹解压进去，变成：
      Plug-ins\\cos-effect-prompt\\manifest.json
      Plug-ins\\cos-effect-prompt\\index.html
      Plug-ins\\cos-effect-prompt\\index.js
      Plug-ins\\cos-effect-prompt\\styles.css
4. 重启 Photoshop → 菜单「增效工具 / Plugins」→「COS 提示词」

【首次使用要填自己的 API】

插件不内置任何密钥，必须填你自己的：
  · 打开面板 → 选一个服务商预设（自动填好接口地址）
  · 填上你的 API Key
  · 点「拉取模型」自动获取模型列表，选一个
  · 点「保存并进入」

不知道填什么，可以看 README.md 里的「常见服务商填写参考」表格。

【你的 Key 存在哪】

只存在你自己电脑上：
  %%%%APPDATA%%%%\\Adobe\\UXP\\PluginsStorage\\PHSP\\<版本>\\External\\com.couer869.coseffectprompt\\
除你填的接口地址外，不会发往任何第三方。没有任何埋点或统计上报。

【功能一览】

  · 生成提示词   —— 描述需求，生成专业后期提示词（44 种特效 + 修脸/发型/服装/身材/光影/3D 融合）
  · 继续优化     —— 基于上一版提新要求，输出完整新版本，可撤销
  · 知识库       —— 写死「必须遵守」的固定要求，每次生成自动带上
  · 学习库       —— 投喂你认可的提示词范例，让它模仿风格与写法
  · 图生文       —— 导入图片反推提示词（需要支持看图的模型，需另配视觉模型）
  · 多模型输出   —— Nano Banana / Midjourney / ComfyUI / Stable Diffusion / NovelAI
  · 一键导出     —— 生成结果直接写入你设置的目录

【开源】

  GitHub : https://github.com/Couer869/cos-effect-prompt
  抖音   : https://v.douyin.com/dNeL4w9CUBs/
  MIT 许可，可自由使用、修改、分发。

【本包不含任何个人信息】

打包时已逐文件扫描确认：无 API Key、无令牌、无本机路径、无用户名、
无历史记录、无埋点。配置和历史只在你自己的电脑上生成。
"""


def scan(name, data):
    """返回该文件命中的敏感项列表（空 = 干净）"""
    try:
        text = data.decode("utf-8")
    except UnicodeDecodeError:
        return ["二进制文件，无法扫描"] if data else []

    hits = []
    rules = list(COMMON)
    if name in CODE_FILES:
        rules += TELEMETRY_CODE

    for pat, label in rules:
        for m in re.findall(pat, text):
            s = m if isinstance(m, str) else m[0]
            hits.append("%s: %s" % (label, s[:60]))

    # 本人标识：先剔掉公开署名（GitHub 账号 / 插件 id），再看剩下有没有残留
    scrubbed = text.replace("Couer869", "").replace("couer869", "")
    for pat, label in SELF_MARKS:
        for m in re.findall(pat, scrubbed):
            s = m if isinstance(m, str) else m[0]
            hits.append("%s: %s" % (label, s[:60]))

    return sorted(set(hits))


def main():
    manifest = json.load(io.open(os.path.join(SRC, "manifest.json"), encoding="utf-8"))
    ver = manifest["version"]
    zip_path = os.path.join(OUT_DIR, "cos-effect-prompt-ps-plugin-v%s.zip" % ver)

    if os.path.isdir(STAGE):
        shutil.rmtree(STAGE)
    dest = os.path.join(STAGE, PKG_NAME)
    os.makedirs(dest)

    for f in RUNTIME + EXTRA:
        p = os.path.join(SRC, f)
        if not os.path.isfile(p):
            print("!! 缺少文件: %s" % f)
            sys.exit(1)
        shutil.copy2(p, os.path.join(dest, f))

    io.open(os.path.join(dest, u"\u5b89\u88c5\u8bf4\u660e.txt"), "w",
            encoding="utf-8-sig").write(INSTALL_TXT % {"ver": ver})

    # 开发文件确认没进包
    assert not os.path.isdir(os.path.join(dest, "web-test")), "web-test 不该进包"

    print("=== 打包内容 ===")
    entries = sorted(os.listdir(dest))
    for f in entries:
        print("  %-16s %6d 字节" % (f, os.path.getsize(os.path.join(dest, f))))

    print("\n=== 发布前扫描 ===")
    all_clean = True
    for f in entries:
        data = io.open(os.path.join(dest, f), "rb").read()
        hits = scan(f, data)
        if hits:
            all_clean = False
            print("  [!!] %s" % f)
            for h in hits:
                print("        %s" % h)
        else:
            print("  [OK] %s" % f)

    if not all_clean:
        print("\n扫描未通过，已中止打包（不产出 zip）。")
        shutil.rmtree(STAGE, ignore_errors=True)
        sys.exit(1)

    if not os.path.isdir(OUT_DIR):
        os.makedirs(OUT_DIR)
    if os.path.exists(zip_path):
        os.remove(zip_path)

    with zipfile.ZipFile(zip_path, "w", zipfile.ZIP_DEFLATED) as z:
        for f in entries:
            z.write(os.path.join(dest, f), PKG_NAME + "/" + f)

    print("\n=== 打包完成 ===")
    print("  %s" % zip_path)
    print("  %.1f KB" % (os.path.getsize(zip_path) / 1024.0))
    print("\n=== zip 内结构 ===")
    with zipfile.ZipFile(zip_path) as z:
        for n in z.namelist():
            print("  %s" % n)

    print("\n下一步：解压后建议跑一遍自测确认可运行 ——")
    print('  node web-test/smoke.js "<解压出的 cos-effect-prompt 目录>"')


if __name__ == "__main__":
    main()
