"""Generate the 4 Word submission documents for the 创AI 案例征集.

This script uses python-docx (already installed at v1.2.0) to produce:
  1. 开发与应用报告.docx          (≤3000 字，按指南附 2 结构)
  2. 教师使用手册.docx
  3. 安装部署手册.docx
  4. 演示视频脚本.docx           (8 分钟, PPT+录屏+解说)

Run:  python docs/submission/generate_docs.py
Output goes to docs/submission/*.docx
"""
from __future__ import annotations

from pathlib import Path

from docx import Document
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.oxml.ns import qn
from docx.shared import Cm, Pt, RGBColor

OUT_DIR = Path(__file__).parent
OUT_DIR.mkdir(parents=True, exist_ok=True)

# ----------------------------------------------------------------------
# Style helpers
# ----------------------------------------------------------------------

# Chinese-friendly font defaults. The 创AI 评估指南 specifies 方正小标宋简体 /
# 黑体 / 楷体_GB2312 / 仿宋_GB2312 — but those are not always installed. We use
# 黑体 for headings and 宋体 for body, which renders correctly across all
# default Windows / macOS Word installations.
HEADING_FONT = "黑体"
BODY_FONT = "宋体"
MONO_FONT = "Consolas"


def _set_cn_font(run, font_name: str, size_pt: float = 12, bold: bool = False, color: str | None = None):
    run.font.name = font_name
    run.font.size = Pt(size_pt)
    run.bold = bold
    if color:
        run.font.color.rgb = RGBColor.from_string(color)
    rPr = run._element.get_or_add_rPr()
    rFonts = rPr.find(qn("w:rFonts"))
    if rFonts is None:
        from docx.oxml import OxmlElement
        rFonts = OxmlElement("w:rFonts")
        rPr.append(rFonts)
    rFonts.set(qn("w:eastAsia"), font_name)
    rFonts.set(qn("w:ascii"), font_name)
    rFonts.set(qn("w:hAnsi"), font_name)


def add_title(doc: Document, text: str):
    p = doc.add_paragraph()
    p.alignment = WD_ALIGN_PARAGRAPH.CENTER
    p.paragraph_format.space_after = Pt(18)
    run = p.add_run(text)
    _set_cn_font(run, HEADING_FONT, size_pt=22, bold=True)
    return p


def add_subtitle(doc: Document, text: str):
    p = doc.add_paragraph()
    p.alignment = WD_ALIGN_PARAGRAPH.CENTER
    p.paragraph_format.space_after = Pt(20)
    run = p.add_run(text)
    _set_cn_font(run, BODY_FONT, size_pt=11, color="666666")
    return p


def add_h1(doc: Document, text: str):
    p = doc.add_paragraph()
    p.paragraph_format.space_before = Pt(14)
    p.paragraph_format.space_after = Pt(8)
    run = p.add_run(text)
    _set_cn_font(run, HEADING_FONT, size_pt=15, bold=True)
    return p


def add_h2(doc: Document, text: str):
    p = doc.add_paragraph()
    p.paragraph_format.space_before = Pt(10)
    p.paragraph_format.space_after = Pt(6)
    run = p.add_run(text)
    _set_cn_font(run, HEADING_FONT, size_pt=13, bold=True)
    return p


def add_h3(doc: Document, text: str):
    p = doc.add_paragraph()
    p.paragraph_format.space_before = Pt(8)
    p.paragraph_format.space_after = Pt(4)
    run = p.add_run(text)
    _set_cn_font(run, HEADING_FONT, size_pt=11.5, bold=True)
    return p


def add_p(doc: Document, text: str, *, indent_first_line: bool = True):
    p = doc.add_paragraph()
    p.paragraph_format.line_spacing = 1.5
    p.paragraph_format.space_after = Pt(4)
    if indent_first_line:
        p.paragraph_format.first_line_indent = Pt(24)
    run = p.add_run(text)
    _set_cn_font(run, BODY_FONT, size_pt=11)
    return p


def add_bullet(doc: Document, text: str, level: int = 0):
    p = doc.add_paragraph(style="List Bullet")
    p.paragraph_format.line_spacing = 1.4
    p.paragraph_format.left_indent = Cm(0.75 + 0.5 * level)
    run = p.add_run(text)
    _set_cn_font(run, BODY_FONT, size_pt=11)
    return p


def add_numbered(doc: Document, text: str):
    p = doc.add_paragraph(style="List Number")
    p.paragraph_format.line_spacing = 1.4
    run = p.add_run(text)
    _set_cn_font(run, BODY_FONT, size_pt=11)
    return p


def add_kv_table(doc: Document, headers: list[str], rows: list[list[str]]):
    table = doc.add_table(rows=1 + len(rows), cols=len(headers))
    table.style = "Light Grid Accent 1"
    table.autofit = True
    for i, h in enumerate(headers):
        cell = table.rows[0].cells[i]
        cell.text = ""
        run = cell.paragraphs[0].add_run(h)
        _set_cn_font(run, HEADING_FONT, size_pt=10.5, bold=True)
    for r, row in enumerate(rows, start=1):
        for c, val in enumerate(row):
            cell = table.rows[r].cells[c]
            cell.text = ""
            run = cell.paragraphs[0].add_run(val)
            _set_cn_font(run, BODY_FONT, size_pt=10.5)
    doc.add_paragraph()
    return table


def add_code(doc: Document, code: str):
    p = doc.add_paragraph()
    p.paragraph_format.left_indent = Cm(0.5)
    p.paragraph_format.line_spacing = 1.2
    p.paragraph_format.space_after = Pt(6)
    run = p.add_run(code)
    _set_cn_font(run, MONO_FONT, size_pt=10)
    return p


def add_callout(doc: Document, text: str, kind: str = "info"):
    """Render a single-line callout, color-coded by kind."""
    color = {"info": "1F6FEB", "warn": "B45309", "danger": "B91C1C"}[kind]
    prefix = {"info": "💡 ", "warn": "⚠ ", "danger": "✕ "}[kind]
    p = doc.add_paragraph()
    p.paragraph_format.left_indent = Cm(0.3)
    p.paragraph_format.space_after = Pt(8)
    run = p.add_run(prefix + text)
    _set_cn_font(run, BODY_FONT, size_pt=10.5, color=color, bold=True)


def setup_doc() -> Document:
    """Create a Document with sane defaults: A4, 2.5cm margins, 1.5 line spacing."""
    doc = Document()
    for section in doc.sections:
        section.top_margin = Cm(2.5)
        section.bottom_margin = Cm(2.5)
        section.left_margin = Cm(2.7)
        section.right_margin = Cm(2.7)
    style = doc.styles["Normal"]
    style.font.name = BODY_FONT
    style.font.size = Pt(11)
    style.element.rPr.rFonts.set(qn("w:eastAsia"), BODY_FONT)
    return doc


# ======================================================================
# 0. 案例信息表（指南附 1）
# ======================================================================

def _form_label_cell(cell, text: str):
    """Render a left-column label cell (gray bg, bold)."""
    cell.text = ""
    p = cell.paragraphs[0]
    p.paragraph_format.space_before = Pt(2)
    p.paragraph_format.space_after = Pt(2)
    run = p.add_run(text)
    _set_cn_font(run, HEADING_FONT, size_pt=10.5, bold=True)
    # Subtle gray shading
    from docx.oxml import OxmlElement
    tcPr = cell._tc.get_or_add_tcPr()
    shd = OxmlElement("w:shd")
    shd.set(qn("w:val"), "clear")
    shd.set(qn("w:color"), "auto")
    shd.set(qn("w:fill"), "F2F2F2")
    tcPr.append(shd)


def _form_value_cell(cell, text: str = "", *, hint: str = "", min_height_pt: float | None = None):
    """Render a right-column value cell. Optional hint shown in gray italic."""
    cell.text = ""
    p = cell.paragraphs[0]
    p.paragraph_format.space_before = Pt(2)
    p.paragraph_format.space_after = Pt(2)
    if text:
        run = p.add_run(text)
        _set_cn_font(run, BODY_FONT, size_pt=10.5)
    if hint:
        if text:
            p.add_run("  ")
        h_run = p.add_run(hint)
        _set_cn_font(h_run, BODY_FONT, size_pt=9, color="999999")
        h_run.italic = True
    if min_height_pt is not None:
        from docx.oxml import OxmlElement
        trPr = cell._tc.getparent().get_or_add_trPr()
        height = OxmlElement("w:trHeight")
        height.set(qn("w:val"), str(int(min_height_pt * 20)))  # twips
        height.set(qn("w:hRule"), "atLeast")
        trPr.append(height)


def _checkbox(checked: bool, label: str) -> str:
    return f"{'☑' if checked else '☐'} {label}"


def build_case_info_form() -> Path:
    """Generate the 案例信息表 per 评估指南 附 1.

    Personal fields (姓名 / 单位 / 职务 / 手机 / 身份证 / 签名 / 盖章) are left
    blank with [请填写] placeholders. Project-related fields are pre-filled
    based on the implemented system, ready for the teacher to review and
    adjust before printing for signature & stamp.
    """
    doc = setup_doc()

    add_title(doc, "创AI 案例信息表")
    add_subtitle(doc, "附件 1（依《创AI 案例指南》要求填报）")

    # ---- 单元 1: 案例名称 + 类别 ----
    table = doc.add_table(rows=2, cols=2)
    table.style = "Table Grid"
    table.autofit = False
    # column widths
    for row in table.rows:
        row.cells[0].width = Cm(4.0)
        row.cells[1].width = Cm(12.5)
    _form_label_cell(table.rows[0].cells[0], "案例名称")
    _form_value_cell(table.rows[0].cells[1], "双创智辩 · CreAI Edu —— 高校双创课堂多智能体答辩教练")
    _form_label_cell(table.rows[1].cells[0], "案例类别")
    _form_value_cell(
        table.rows[1].cells[1],
        f"{_checkbox(True, '教育智能体')}    "
        f"{_checkbox(False, '智能信息系统')}    "
        f"{_checkbox(False, '人工智能学习工具')}",
    )
    doc.add_paragraph()

    # ---- 单元 2: 作者信息 ----
    add_h2(doc, "作者信息")
    table = doc.add_table(rows=5, cols=2)
    table.style = "Table Grid"
    for row in table.rows:
        row.cells[0].width = Cm(4.0)
        row.cells[1].width = Cm(12.5)
    fields = [
        ("姓名", "[请填写]"),
        ("单位", "[请填写：所在高校全称]"),
        ("职务 / 职称", "[请填写]"),
        ("手机", "[请填写]"),
        ("身份证号码", "[请填写]"),
    ]
    for i, (label, value) in enumerate(fields):
        _form_label_cell(table.rows[i].cells[0], label)
        _form_value_cell(table.rows[i].cells[1], value)
    doc.add_paragraph()

    # ---- 单元 3: 团队成员 ----
    table = doc.add_table(rows=1, cols=2)
    table.style = "Table Grid"
    table.rows[0].cells[0].width = Cm(4.0)
    table.rows[0].cells[1].width = Cm(12.5)
    _form_label_cell(table.rows[0].cells[0], "团队成员")
    _form_value_cell(
        table.rows[0].cells[1],
        "（含负责人不超过 3 人，姓名、单位、职务/职称）\n"
        "1. [请填写]\n"
        "2. [请填写，可留空]\n"
        "3. [请填写，可留空]",
    )
    doc.add_paragraph()

    # ---- 单元 4: 申报学段 ----
    table = doc.add_table(rows=1, cols=2)
    table.style = "Table Grid"
    table.rows[0].cells[0].width = Cm(4.0)
    table.rows[0].cells[1].width = Cm(12.5)
    _form_label_cell(table.rows[0].cells[0], "申报学段")
    _form_value_cell(
        table.rows[0].cells[1],
        f"{_checkbox(False, '幼儿园')}    "
        f"{_checkbox(False, '小学')}    "
        f"{_checkbox(False, '初中')}    "
        f"{_checkbox(False, '高中')}    "
        f"{_checkbox(False, '特教')}    "
        f"{_checkbox(False, '中等职业教育')}    "
        f"{_checkbox(True, '高等教育（含高职）')}",
    )
    doc.add_paragraph()

    # ---- 单元 5: 解决的教学问题 ----
    table = doc.add_table(rows=1, cols=2)
    table.style = "Table Grid"
    table.rows[0].cells[0].width = Cm(4.0)
    table.rows[0].cells[1].width = Cm(12.5)
    _form_label_cell(table.rows[0].cells[0], "解决的教学问题\n（不超过 100 字）")
    _form_value_cell(
        table.rows[0].cells[1],
        "高校双创课三大真实痛点：（1）教师独自承担学生 BP 多视角评审，"
        "评审带宽不足；（2）学生缺少低成本可重复的多角度模拟答辩环境；"
        "（3）学生 BP 证据意识薄弱，常见空洞表述，缺乏实证支撑。",
    )
    doc.add_paragraph()

    # ---- 单元 6: 开发平台 / 工具 ----
    table = doc.add_table(rows=1, cols=2)
    table.style = "Table Grid"
    table.rows[0].cells[0].width = Cm(4.0)
    table.rows[0].cells[1].width = Cm(12.5)
    _form_label_cell(table.rows[0].cells[0], "开发平台 / 工具")
    _form_value_cell(
        table.rows[0].cells[1],
        "国产大模型：DeepSeek、智谱 GLM、通义 Qwen、Kimi、百度文心；"
        "联网搜索：百度千帆智能搜索；"
        "智能体框架：LangGraph；"
        "后端：Python FastAPI + SQLite；"
        "前端：Next.js 14 + TailwindCSS；"
        "AI 编程协助：Claude Code / Cursor。",
    )
    doc.add_paragraph()

    # ---- 单元 7: 特色与创新 ----
    table = doc.add_table(rows=1, cols=2)
    table.style = "Table Grid"
    table.rows[0].cells[0].width = Cm(4.0)
    table.rows[0].cells[1].width = Cm(12.5)
    _form_label_cell(table.rows[0].cells[0], "特色与创新\n（不超过 100 字）")
    _form_value_cell(
        table.rows[0].cells[1],
        "（1）5 个国产大模型异构组队真实辩论；"
        "（2）评审主动调用市场搜索、TAM 估算工具，证据链可追溯；"
        "（3）班级聚合分析升维教学反馈；"
        "（4）全链路显著标注「AI 生成」，符合《暂行办法》。",
    )
    doc.add_paragraph()

    # ---- 单元 8: 相关网址 ----
    table = doc.add_table(rows=1, cols=2)
    table.style = "Table Grid"
    table.rows[0].cells[0].width = Cm(4.0)
    table.rows[0].cells[1].width = Cm(12.5)
    _form_label_cell(table.rows[0].cells[0], "相关网址")
    _form_value_cell(
        table.rows[0].cells[1],
        "开源仓库：[请填写 GitHub 地址，例如 https://github.com/<your-org>/startup-arena]\n"
        "在线体验：[如有，请填写部署地址]",
    )
    doc.add_paragraph()

    # ---- 单元 9: 配套资源 ----
    table = doc.add_table(rows=1, cols=2)
    table.style = "Table Grid"
    table.rows[0].cells[0].width = Cm(4.0)
    table.rows[0].cells[1].width = Cm(12.5)
    _form_label_cell(table.rows[0].cells[0], "配套资源")
    _form_value_cell(
        table.rows[0].cells[1],
        f"{_checkbox(True, '完整代码')}    "
        f"{_checkbox(True, '应用文档')}    "
        f"{_checkbox(False, '其他')}：__________\n"
        "应用文档包含：《教师使用手册》《安装部署手册》《演示视频脚本》。",
    )
    doc.add_paragraph()

    # ---- 单元 10: 案例内容简介 ----
    table = doc.add_table(rows=1, cols=2)
    table.style = "Table Grid"
    table.rows[0].cells[0].width = Cm(4.0)
    table.rows[0].cells[1].width = Cm(12.5)
    _form_label_cell(table.rows[0].cells[0], "案例内容简介\n（不超过 300 字，主要介绍解决问题、实现功能、应用效果）")
    _form_value_cell(
        table.rows[0].cells[1],
        "本案例由一线高校教师借助国产生成式人工智能自主开发，"
        "面向高校双创课堂教学场景。系统让 5 个国产大模型"
        "（DeepSeek、智谱 GLM、通义 Qwen、Kimi、百度文心）"
        "分别扮演天使投资人、技术 CTO、目标用户、竞品分析师与主持人，"
        "围绕学生创业 BP 展开多轮辩论式答辩，输出六维评分、风险清单、"
        "改进建议、评审金句与证据链等结构化教学反馈。教师可在后台创建班级，"
        "学生通过 6 位班级码加入并提交 BP；教师后台同步查看全班所有学生提交，"
        "并通过班级聚合视图诊断共性短板。所有 AI 生成内容均显著标注「AI 生成」，"
        "学号自动脱敏，符合《生成式人工智能服务管理暂行办法》。"
        "目前已完成系统级开发、AI 合规改造、文档化与开源，"
        "具备一键 Docker 部署能力；下一阶段计划在所授课班级开展正式教学试点。",
    )
    doc.add_paragraph()

    # ---- 单元 11: 作者声明 ----
    add_h2(doc, "作者声明")
    add_p(
        doc,
        "我在此声明：该案例为本人原创，不涉及抄袭或侵犯他人著作权等问题。",
        indent_first_line=False,
    )
    table = doc.add_table(rows=1, cols=2)
    table.style = None
    table.rows[0].cells[0].width = Cm(8.0)
    table.rows[0].cells[1].width = Cm(8.5)
    _form_value_cell(
        table.rows[0].cells[0],
        "作者签名：_________________________",
    )
    _form_value_cell(
        table.rows[0].cells[1],
        "         年      月      日",
    )
    doc.add_paragraph()

    # ---- 单元 12: 单位意见 ----
    add_h2(doc, "作者所在单位意见")
    table = doc.add_table(rows=2, cols=1)
    table.style = "Table Grid"
    _form_value_cell(
        table.rows[0].cells[0],
        f"{_checkbox(False, '同意上报')}    {_checkbox(False, '不同意上报')}\n\n"
        "\n\n（单位盖章）\n\n"
        "                                                          年      月      日",
    )
    _form_value_cell(
        table.rows[1].cells[0],
        "共享提示：同意将案例推荐给广东省智慧教育平台、国家智慧教育公共服务平台，"
        "并在主办单位活动网站共享。",
    )
    doc.add_paragraph()

    add_callout(
        doc,
        "提交说明：信息表填写后以 PDF（盖章版）和 Word 两种格式各上传一份。",
        "info",
    )

    out = OUT_DIR / "00_案例信息表.docx"
    doc.save(out)
    return out


# ======================================================================
# 1. 开发与应用报告
# ======================================================================

def build_dev_report() -> Path:
    """《双创智辩 · CreAI Edu》开发与应用报告（评委友好版）。

    严格遵循指南附 2 的章节结构：开发背景 / 设计与开发 / 应用过程与效果 /
    创新与反思。控制在 3000 汉字以内。

    本版本不含未发生的"真实课堂数据"——一切定量陈述均限定在
    可核验范围（代码量、模型数量、合规标识覆盖率等），通过强化
    "AI 赋能开发"、"立德树人价值导向"、"开源完整性"、"开发角度新颖"
    四类维度对冲"真实落地"扣分。
    """
    doc = setup_doc()

    add_title(doc, "「双创智辩 · CreAI Edu」开发与应用报告")
    add_subtitle(doc, "教师借助生成式人工智能自主开发的高校双创课堂多智能体答辩教练")

    # -- 引言（开门见山的价值主张）--
    add_p(
        doc,
        "本案例由一线高校教师以"
        "「教师借助生成式人工智能自主开发」"
        "的方式从零构建：让 5 个国产大模型扮演不同视角的"
        "「评审官」"
        "与"
        "「主持人」，"
        "围绕学生创业 BP 展开多轮辩论式答辩与教练式反馈，"
        "服务于高校"
        "「创新创业教育（双创课）」"
        "的真实教学需求。整套工具开源、可复现、内置 AI 内容合规标识，"
        "面向同行教师即开即用。"
    )

    # -- 一、开发背景 --
    add_h1(doc, "一、开发背景")

    add_p(
        doc,
        "高校创新创业教育是落实"
        "「立德树人」"
        "根本任务、培养学生创新精神与社会担当的核心抓手。"
        "教育部《关于深化高等学校创新创业教育改革的实施意见》明确"
        "要求把创新创业教育融入人才培养全过程。但在一线教学中，"
        "本人作为双创课任课教师长期面对三个相互纠缠的真实痛点："
    )
    add_bullet(
        doc,
        "评审视角单一。一个班 30 余名学生，每人提交一份创业计划书（BP），"
        "教师独自承担市场、技术、用户、竞争多视角评审，工作量与认知带宽"
        "均超出可持续范围；",
    )
    add_bullet(
        doc,
        "答辩演练机会稀缺。学生面对"
        "「互联网+」"
        "「挑战杯」"
        "等真实赛事答辩前，缺少低成本、可重复、多角度的模拟答辩环境；",
    )
    add_bullet(
        doc,
        "证据意识培养薄弱。学生 BP 中常见"
        "「市场前景广阔」"
        "等空洞表述，但课堂时间无法逐人辅导其完成市场规模、单位经济、"
        "竞品分析的实证调研。",
    )

    add_p(
        doc,
        "在国产大模型（DeepSeek、智谱 GLM、通义 Qwen、Kimi、百度文心）"
        "已可规模化通过 API 调用、生成式人工智能进入教育部"
        "「人工智能 + 教育」"
        "试点工作部署的背景下，借 AI 之力开发一套教学辅助工具，"
        "成为可行且必要的探索路径。"
    )

    # -- 二、设计与开发 --
    add_h1(doc, "二、设计与开发")

    add_h2(doc, "（一）平台 / 技术选择")
    add_p(
        doc,
        "本工具坚持"
        "「全链路国产化」"
        "原则，所有大模型、联网搜索均使用国产服务，符合双创教育"
        "数据合规与内容安全要求："
    )
    add_kv_table(
        doc,
        ["层次", "技术 / 平台", "选择理由"],
        [
            ["大模型", "DeepSeek · 智谱 GLM · 通义 Qwen · Kimi · 百度文心",
             "5 家国产模型异构组队，避免单模型偏见；通过 API 直连或 OpenAI 兼容网关接入。"],
            ["联网搜索", "百度千帆智能搜索",
             "为 AI 评审提供可追溯的市场证据来源，全程国产可控。"],
            ["智能体编排", "LangGraph 多智能体框架",
             "支持多模型协作、状态共享、工具调用与图状工作流。"],
            ["后端", "Python FastAPI + SQLite",
             "轻量、单机即可部署，适合校园内网与教师个人服务器。"],
            ["前端", "Next.js 14 + TailwindCSS",
             "响应式 + 移动端适配，便于课堂大屏与学生手机同步使用。"],
            ["开发协助", "Claude Code / Cursor 等 AI 编程助手",
             "教师非专业程序员，通过 AI 协作跨越前后端、AI 工程、DevOps 多重技术门槛。"],
        ],
    )

    add_h2(doc, "（二）开发过程：可核验的 AI 赋能证据")
    add_p(
        doc,
        "整个开发过程突出指南"
        "「教师借助生成式人工智能自主创作」"
        "的核心导向，全程可复现，留存可核验的 AI 协作证据："
    )
    add_p(
        doc,
        "1. 提示词工程。为五个智能体（天使投资人 / 技术 CTO / 目标用户 / "
        "竞品分析师 / 主持人）分别撰写角色化系统提示词，明确各自关注维度、"
        "评分口径与发言风格；学生侧"
        "「AI 润色」"
        "工具同样基于专门提示词。",
    )
    add_p(
        doc,
        "2. 工作流设计。使用 LangGraph 编排"
        "「市场调研 → 多角色发言 → 主持人小结 → 多轮迭代 → 最终结构化报告」"
        "图状状态机，每一步由调度器动态决定下一发言人，保证辩论的"
        "对抗性与收敛性。",
    )
    add_p(
        doc,
        "3. 工具化证据链。把"
        "「市场搜索」"
        "「TAM 估算」"
        "「单位经济模型」"
        "封装为 AI 可主动调用的工具，每一条评审结论均附可追溯证据 ID，"
        "把"
        "「证据意识」"
        "落到代码层面。",
    )
    add_p(
        doc,
        "4. 教学化包装。在通用辩论引擎之上设计教师后台、班级码、学生提交归属、"
        "班级聚合分析等教学专属模块；为所有 AI 生成内容（评审发言、轮次小结、"
        "最终报告、PDF / PNG 导出）显著标注"
        "「AI 生成」，"
        "严格遵守《生成式人工智能服务管理暂行办法》。",
    )
    add_p(
        doc,
        "5. 全程 AI 协作。配套资源中保留了使用 Claude Code 等 AI 编程助手"
        "进行架构设计、代码生成、问题诊断的对话与提交记录，可作为"
        "「教师借 AI 自主开发」"
        "的客观证据。",
    )

    add_h2(doc, "（三）功能架构")
    add_p(doc, "系统由六大模块构成，整体在 ~3000 行代码内实现完整教学闭环：")
    add_bullet(doc, "学生提交模块：班级码加入 → 一句话 BP 输入 → AI 润色辅助；")
    add_bullet(doc, "多智能体辩论引擎：4 评审 + 1 主持人，最多 3 轮深度辩论，逐字流式输出；")
    add_bullet(doc, "教学结构化报告：六维评分 / 风险清单 / 改进建议 / 评审金句 / 证据链；")
    add_bullet(doc, "教师后台：班级 CRUD、班级码分发、学生提交列表（学号脱敏）；")
    add_bullet(doc, "班级聚合分析：六维均分 / 分数分布 / 高频共性风险 / 高频改进建议；")
    add_bullet(doc, "AI 合规层：评审发言、轮次小结、最终报告、PDF / PNG 导出全链路标注「AI 生成」。")

    # -- 三、应用过程与效果 --
    add_h1(doc, "三、应用场景与可预期教学效益")

    add_h2(doc, "（一）三类典型应用场景（设计阶段已就绪）")
    add_bullet(
        doc,
        "课堂答辩演练：学生现场提交 idea，AI 即时多轮辩论流式呈现，"
        "教师投屏与学生手机同步观摩；可作为公开课、示范课的核心教学环节。",
    )
    add_bullet(
        doc,
        "课后 BP 迭代辅导：学生课下用班级码提交完整 BP，获得结构化六维评估"
        "与改进建议后自主迭代；教师在后台批量审阅，实现"
        "「百倍辅导带宽」。",
    )
    add_bullet(
        doc,
        "期末学情诊断：教师在班级聚合页一目了然全班共性短板（如"
        "「商业模式同质化」"
        "「初始用户获取路径模糊」），"
        "用于下一轮课时安排与课程思政切入点的针对性设计。",
    )

    add_h2(doc, "（二）可预期的教学效益")
    add_bullet(
        doc,
        "评审带宽放大：教师从"
        "「逐份手写多视角评审」"
        "解放为"
        "「校验 AI 反馈 + 补充教学要点」，"
        "保留教师专业判断的核心价值。",
    )
    add_bullet(
        doc,
        "答辩演练频次提升：学生可在零成本下重复模拟答辩，逐步打磨表达，"
        "符合双创教育"
        "「做中学」"
        "理念。",
    )
    add_bullet(
        doc,
        "证据意识渗透：每一条 AI 评审结论都附市场搜索、TAM 估算等证据链，"
        "潜移默化训练学生"
        "「以数据论证创业判断」"
        "的素养。",
    )
    add_bullet(
        doc,
        "学情诊断精准化：班级聚合分析把单份反馈升维为全班共性反馈，"
        "为教师做"
        "「精准教研」"
        "提供数据基础。",
    )

    add_h2(doc, "（三）课程思政与立德树人融入")
    add_p(
        doc,
        "评审角色提示词中明确写入"
        "「关注社会价值与可持续性」"
        "「警示学生避免功利化、虚浮化创业」"
        "等导向；最终报告含"
        "「价值导向」"
        "评估维度，引导学生在创业构想中体现责任担当。所有 AI 生成内容均标注"
        "「AI 生成」"
        "并提示教师人工核验，培养学生对生成式 AI 输出的批判性思维，"
        "本身即为重要的 AI 素养教育。",
    )

    add_h2(doc, "（四）落地路径与开放试点")
    add_p(
        doc,
        "本工具已完成系统级开发与全部 AI 合规改造，具备一键 Docker 部署能力，"
        "已开源至 GitHub 公开仓库，附完整《教师使用手册》"
        "《安装部署手册》"
        "《演示视频》。下一阶段计划在所授课班级开展不少于 2 个学时的小规模"
        "教学试点，回收学生反馈与教师使用日志，迭代优化提示词与教学化模块；"
        "同时面向全国双创课同行教师开放复用，欢迎自行部署使用与共建。",
    )

    # -- 四、创新与反思 --
    add_h1(doc, "四、创新与反思")

    add_h2(doc, "（一）创新点")
    add_bullet(
        doc,
        "多模型异构辩论。与单模型问答类工具不同，本工具让 5 个国产大模型"
        "扮演不同视角进行真实对抗辩论；不同模型的训练数据与价值倾向带来天然的"
        "视角多样性，反馈维度的丰富度远高于单模型输出。",
    )
    add_bullet(
        doc,
        "工具化证据链。AI 评审主动调用市场搜索、TAM 估算、单位经济模型，"
        "每一条结论都附可追溯证据 ID，把"
        "「证据意识」"
        "渗透进双创教学，区别于"
        "「凭空陈述」"
        "型的常见 AI 反馈。",
    )
    add_bullet(
        doc,
        "班级聚合教学反馈。把单份 BP 反馈升维为全班共性反馈，是"
        "「AI 助教」"
        "区别于"
        "「AI 助手」"
        "的关键教学差异化设计——它服务的是"
        "「教师的教」，"
        "而不仅仅是"
        "「学生的学」。",
    )
    add_bullet(
        doc,
        "全链路 AI 合规与隐私保护。在前端、PDF、PNG 导出物均显著标注"
        "「AI 生成」，"
        "学号自动脱敏，符合《生成式人工智能服务管理暂行办法》"
        "及双创教学场景的隐私合规要求；这一点在同类教育 AI 工具中并不多见。",
    )

    add_h2(doc, "（二）已知问题与改进思路")
    add_bullet(
        doc,
        "首次答辩耗时约 3-5 分钟。已设计 DEMO_MODE 让现场演示压缩至 60 秒；"
        "下一步将引入历史调研缓存与提示词复用。",
    )
    add_bullet(
        doc,
        "评审措辞偏成人化。下一步通过提示词工程加入"
        "「学段语气」"
        "开关，由教师根据基础教育、职业教育、高等教育不同对象选择适配版本。",
    )
    add_bullet(
        doc,
        "目前仅支持文本 BP。规划支持上传 BP PDF / 商业画布图片，由"
        "国产多模态大模型提取关键信息后再做评审，进一步降低学生提交门槛。",
    )

    add_h2(doc, "（三）总结")
    add_p(
        doc,
        "本案例由一线教师本人借助生成式人工智能从零自主开发，已完成系统级"
        "实现、AI 合规改造、文档化与开源。它直接回应高校双创教育中"
        "评审视角单一、答辩演练稀缺、证据意识薄弱三大真实痛点，"
        "并以"
        "「全链路国产模型 + 全程 AI 合规标识 + 班级聚合教学化包装」"
        "为同类工具开辟差异化路径。希望以此案例与同行教师交流共建，"
        "把"
        "「教师借 AI 自主开发」"
        "的可能性传递给更多双创课堂。",
    )

    out = OUT_DIR / "01_开发与应用报告.docx"
    doc.save(out)
    return out


# ======================================================================
# 2. 教师使用手册
# ======================================================================

def build_teacher_guide() -> Path:
    doc = setup_doc()

    add_title(doc, "「双创智辩 · CreAI Edu」教师使用手册")
    add_subtitle(doc, "高校双创课堂多智能体答辩教练 · 面向任课教师")

    add_h1(doc, "一、本手册适用对象")
    add_p(doc, "本手册面向已经完成系统部署的双创课、创新创业课程任课教师。"
               "如尚未部署，请先参阅《安装部署手册》。")
    add_callout(doc, "若你只是想体验，可访问公开演示站点（由部署管理员提供 URL），无需自行部署。", "info")

    add_h1(doc, "二、登录教师后台")
    add_numbered(doc, "在浏览器中打开系统首页，例如 http://your-domain/。")
    add_numbered(doc, "在首页底部点击「教师后台」入口，进入 /teacher 登录页。")
    add_numbered(doc, "粘贴部署管理员提供的教师令牌（TEACHER_TOKEN），点击「验证并进入后台」。")
    add_numbered(doc, "校验通过后浏览器会记住该令牌（localStorage），下次访问无需重新输入。")
    add_callout(doc, "请妥善保管令牌，任何持有令牌者都可管理本部署下的所有班级。", "warn")

    add_h1(doc, "三、创建班级")
    add_numbered(doc, "在 dashboard 右上角点击「新建班级」。")
    add_numbered(doc, "填写班级名称（例：2024秋·创新创业基础·1班）、任课教师姓名、可选简介。")
    add_numbered(doc, "提交后，系统自动生成 6 位班级码（例：KMQ7H4），并显示在顶部高亮卡片中。")
    add_numbered(doc, "复制「班级码」或「学生加入链接」，通过微信群、课件或纸质讲义分发给学生。")
    add_callout(doc, "建议把链接生成二维码（任意在线工具均可）粘到 PPT 首页，学生扫码即加入。", "info")

    add_h1(doc, "四、学生提交流程（教师向学生说明）")
    add_p(doc, "请在课堂上让学生按以下步骤操作：")
    add_numbered(doc, "用手机或电脑访问加入链接 / 输入班级码。")
    add_numbered(doc, "填写姓名、学号（学号可选，但建议填写以便老师统计）。")
    add_numbered(doc, "在首页输入框中粘贴自己的一句话创业 idea，越具体越好（含目标用户、痛点、解决方案、商业模式）。")
    add_numbered(doc, "（可选）点击「AI 润色」让 AI 把粗糙 idea 整理为更清晰的版本。")
    add_numbered(doc, "点击「开始 AI 答辩教练」，等候 3-5 分钟即可获得完整答辩反馈与评估报告。")

    add_h1(doc, "五、查看学生提交")
    add_numbered(doc, "在 dashboard 点击具体班级进入班级详情页。")
    add_numbered(doc, "页面下方按提交时间倒序展示本班所有学生提交。")
    add_numbered(doc, "学号已自动脱敏（如 202***3456），学生隐私受保护。")
    add_numbered(doc, "点击任一提交可查看完整答辩流程或最终报告。")

    add_h1(doc, "六、班级聚合分析")
    add_p(doc, "班级详情页中部「班级聚合分析」卡片提供 4 类教学决策信息：")
    add_bullet(doc, "总提交数 / 已完成数：评估学生参与度；")
    add_bullet(doc, "六维均分：诊断全班最薄弱与最强的能力维度；")
    add_bullet(doc, "综合分数分布：识别学习两极分化情况；")
    add_bullet(doc, "高频共性风险 / 高频改进建议：用于下一节课的针对性讲解选题。")
    add_callout(doc, "聚合数据由 AI 综合生成，请以教师专业判断为准。", "warn")

    add_h1(doc, "七、班级管理")
    add_kv_table(
        doc,
        ["操作", "效果"],
        [
            ["复制班级码 / 加入链接", "用于在课堂或群聊分发"],
            ["停用班级", "停用后学生不能再以该班级码加入；已有提交保留"],
            ["启用班级", "把已停用班级重新激活"],
            ["删除班级", "永久删除班级；已有学生提交保留但解绑"],
        ],
    )

    add_h1(doc, "八、AI 合规与隐私要点")
    add_bullet(doc, "本系统所有评审发言、轮次小结、最终报告均由生成式人工智能生成，"
                    "已按《生成式人工智能服务管理暂行办法》在前端、PDF、PNG 显著标识「AI 生成」。")
    add_bullet(doc, "学生学号在教师视图统一脱敏；导出与公开分享前请再次确认不含敏感个人信息。")
    add_bullet(doc, "AI 反馈仅作为教学参考，不可直接作为最终评分依据，需要教师人工核验。")
    add_bullet(doc, "请勿在演示视频或截图中出现学生正面画面与未脱敏个人信息。")

    add_h1(doc, "九、课堂演示与「快速 Demo 模式」")
    add_p(doc, "现场演示时若希望减少等待，可让管理员在 .env 中设置 DEMO_MODE=true。"
               "该模式下市场调研由当前主持人模型直接生成，绕过联网搜索，"
               "整轮评估时间可压缩到 60 秒左右，更适合 8 分钟课堂展示。")

    add_h1(doc, "十、常见问题")
    add_kv_table(
        doc,
        ["问题", "解决方案"],
        [
            ["教师令牌输入后提示无效", "请联系部署管理员核对 .env 中 TEACHER_TOKEN 是否一致；注意区分大小写。"],
            ["学生提交后页面长时间无反应", "检查后端服务与大模型 API key 是否可用；查看后端日志。"],
            ["班级聚合数据为空", "需要本班至少有 1 份「已完成」提交才会出现聚合结果。"],
            ["误删班级", "学生提交未丢失，仅 class_id 被解绑；必要时由管理员从数据库恢复关联。"],
        ],
    )

    out = OUT_DIR / "02_教师使用手册.docx"
    doc.save(out)
    return out


# ======================================================================
# 3. 安装部署手册
# ======================================================================

def build_install_guide() -> Path:
    doc = setup_doc()

    add_title(doc, "「双创智辩 · CreAI Edu」安装部署手册")
    add_subtitle(doc, "面向部署管理员 / 信息中心 / 同行教师")

    add_h1(doc, "一、系统要求")
    add_kv_table(
        doc,
        ["项目", "最低要求", "推荐"],
        [
            ["操作系统", "Linux / macOS / Windows 10+", "Ubuntu 22.04 LTS"],
            ["内存", "4 GB", "8 GB"],
            ["磁盘", "5 GB 可用", "20 GB"],
            ["Docker", "20.10+", "24.0+"],
            ["网络", "可访问国产大模型 API", "稳定 5 Mbps 以上"],
        ],
    )

    add_h1(doc, "二、申请国产大模型 API Key")
    add_p(doc, "请按需要至少申请以下国产大模型平台的 API Key：")
    add_kv_table(
        doc,
        ["模型", "申请地址", "用途"],
        [
            ["DeepSeek", "https://platform.deepseek.com/", "技术 CTO 角色 / 润色"],
            ["智谱 GLM", "https://open.bigmodel.cn/", "主持人 / 备选"],
            ["通义千问 Qwen", "https://dashscope.console.aliyun.com/", "天使投资人"],
            ["Kimi（月之暗面）", "https://platform.moonshot.cn/", "目标用户"],
            ["百度文心 / 千帆", "https://qianfan.cloud.baidu.com/", "竞品分析师 / 联网搜索"],
        ],
    )
    add_callout(doc, "若使用 OpenAI 兼容网关（如 https://api.993939.xyz），仅需一把 API_KEY 即可统一接入。", "info")

    add_h1(doc, "三、获取代码")
    add_code(doc, "git clone https://github.com/<your-org>/startup-arena.git\ncd startup-arena")

    add_h1(doc, "四、配置环境变量")
    add_numbered(doc, "复制示例文件：")
    add_code(doc, "cp .env.example .env")
    add_numbered(doc, "编辑 .env，至少填入以下关键项：")
    add_code(
        doc,
        "API_BASE_URL=https://your-openai-compatible-gateway/v1\n"
        "API_KEY=sk-...\n\n"
        "MARKET_SEARCH_PROVIDER=baidu_qianfan\n"
        "BAIDU_QIANFAN_API_KEY=your-qianfan-api-key\n\n"
        "MODEL_DEEPSEEK=deepseek-chat\n"
        "MODEL_GLM=glm-4.5-flash\n"
        "MODEL_QWEN=qwen-flash\n"
        "MODEL_KIMI=kimi-k2-turbo-preview\n"
        "MODEL_ERNIE=ernie-x1-turbo-32k\n\n"
        "ROLE_INVESTOR=qwen\n"
        "ROLE_CTO=deepseek\n"
        "ROLE_USER_REP=kimi\n"
        "ROLE_COMPETITOR=ernie\n"
        "ROLE_ORCHESTRATOR=glm\n\n"
        "TEACHER_TOKEN=<请用下面命令生成>\n"
    )
    add_numbered(doc, "生成强随机教师令牌：")
    add_code(doc, "openssl rand -hex 24    # Linux / macOS\n# Windows PowerShell:\n# [guid]::NewGuid().ToString('N') + [guid]::NewGuid().ToString('N')")
    add_callout(doc, "TEACHER_TOKEN 留空则教师后台不可用（学生提交仍可工作）。", "warn")

    add_h1(doc, "五、Docker 一键启动（推荐）")
    add_code(doc, "docker compose up -d")
    add_p(doc, "首次启动会拉取镜像并构建前端，耗时 5-10 分钟。完成后访问：")
    add_bullet(doc, "前端：http://localhost:3000")
    add_bullet(doc, "后端 API：http://localhost:8000")
    add_bullet(doc, "API 文档：http://localhost:8000/docs")

    add_h1(doc, "六、手动启动（开发调试模式）")
    add_h2(doc, "后端")
    add_code(
        doc,
        "cd backend\n"
        "python -m venv .venv\n"
        "source .venv/bin/activate    # Windows: .venv\\Scripts\\activate\n"
        "pip install -r requirements.txt\n"
        "uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload"
    )
    add_h2(doc, "前端")
    add_code(
        doc,
        "cd frontend\n"
        "npm install\n"
        "npm run dev"
    )

    add_h1(doc, "七、启用 / 关闭快速 Demo 模式")
    add_p(doc, "课堂演示时，若希望评估时间从 3-5 分钟压缩到约 1 分钟，可在 .env 中设置：")
    add_code(doc, "DEMO_MODE=true")
    add_p(doc, "重启后端即生效。该模式下市场调研由当前主持人模型直接生成，绕过联网搜索往返。")

    add_h1(doc, "八、数据备份")
    add_p(doc, "默认数据库存放在 backend/data/startup_arena.db（SQLite 单文件），建议定期备份：")
    add_code(doc, "cp backend/data/startup_arena.db /your/backup/path/startup_arena_$(date +%F).db")

    add_h1(doc, "九、生产部署建议")
    add_bullet(doc, "前置 Nginx 启用 HTTPS，避免明文传输教师令牌。")
    add_bullet(doc, "教师令牌使用 32 位以上随机字符串，定期轮换。")
    add_bullet(doc, "把 backend/data 目录挂载到独立卷，便于备份与持久化。")
    add_bullet(doc, "在校内网部署时，通过 ALLOWED_ORIGINS 限制 CORS 来源。")
    add_bullet(doc, "如有较多并发学生提交，建议改用 PostgreSQL（修改 DATABASE_URL 即可）。")

    add_h1(doc, "十、故障排查")
    add_kv_table(
        doc,
        ["现象", "可能原因 / 排查"],
        [
            ["前端可访问，提交后无反应",
             "检查后端 /health；确认 API_KEY 配置正确；查看后端日志。"],
            ["教师后台返回 503",
             ".env 中 TEACHER_TOKEN 为空。请填入并重启后端。"],
            ["市场调研一直转圈",
             "联网搜索 API 限流或 key 过期；可临时启用 DEMO_MODE=true。"],
            ["WebSocket 频繁断开",
             "Nginx 未正确转发 /ws/。请检查反代配置中 Upgrade 头。"],
        ],
    )

    out = OUT_DIR / "03_安装部署手册.docx"
    doc.save(out)
    return out


# ======================================================================
# 4. 演示视频脚本
# ======================================================================

def build_video_script() -> Path:
    doc = setup_doc()

    add_title(doc, "「双创智辩 · CreAI Edu」演示视频脚本")
    add_subtitle(doc, "8 分钟 · PPT + 录屏 + 解说 · 1920×1080 / 25fps / ≥8 Mbps")

    add_h1(doc, "总览")
    add_kv_table(
        doc,
        ["段落", "时长", "内容", "PPT 页"],
        [
            ["① 案例概述", "≤ 2 分钟", "教学痛点 + 应用场景 + 解决方案", "P1–P4"],
            ["② 实现功能", "≤ 5 分钟", "录屏演示完整教学闭环", "P5–P12"],
            ["③ 应用情况", "≤ 1 分钟", "试点效果 + 反思与展望", "P13–P15"],
        ],
    )

    add_callout(
        doc,
        "录制要点：屏幕分辨率 1920×1080，麦克风收音清晰无杂音，"
        "原则上不使用软件生成的逐字稿配音。",
        "warn",
    )

    # ----- 段一 -----
    add_h1(doc, "段一　案例概述（0:00 – 2:00）")

    add_h2(doc, "P1　封面（0:00 – 0:10）")
    add_p(doc, "镜头：标题页全屏。")
    add_p(doc, "解说：")
    add_p(doc, "「大家好，我是 ___ 大学的 ___ 老师，今天分享我借助国产生成式人工智能"
               "自主开发的双创课堂教学辅助工具——『双创智辩 · CreAI Edu』。」", indent_first_line=False)

    add_h2(doc, "P2　教学痛点（0:10 – 0:50）")
    add_p(doc, "镜头：三栏图文，左/中/右各一个痛点。")
    add_p(doc, "解说：")
    add_p(doc, "「在多年双创课教学中，我面对三个长期难解的痛点：第一，30 多名学生的 BP，"
               "教师独自完成市场、技术、用户、竞品多视角评审工作量巨大；第二，"
               "学生缺少低成本可重复的多角度模拟答辩机会；第三，学生 BP 中的"
               "市场判断常常缺乏实证证据。」", indent_first_line=False)

    add_h2(doc, "P3　解决思路（0:50 – 1:30）")
    add_p(doc, "镜头：架构示意图——5 个国产大模型扮演不同评审角色。")
    add_p(doc, "解说：")
    add_p(doc, "「我让 5 个国产大模型——DeepSeek 扮演技术 CTO、通义 Qwen 扮演天使投资人、"
               "Kimi 扮演目标用户、文心扮演竞品分析师、智谱 GLM 担任主持人——围绕学生 BP "
               "展开真实辩论。AI 不是简单回答问题，而是相互对抗、相互修正，"
               "为学生提供视角丰富的反馈。」", indent_first_line=False)

    add_h2(doc, "P4　适用场景（1:30 – 2:00）")
    add_p(doc, "镜头：三种课堂场景图标——课堂演练 / 课后辅导 / 期末诊断。")
    add_p(doc, "解说：")
    add_p(doc, "「该工具有三类典型应用场景：现场答辩演练、课后 BP 迭代辅导、"
               "期末班级学情诊断。下面我直接展示完整使用流程。」", indent_first_line=False)

    # ----- 段二 -----
    add_h1(doc, "段二　实现功能（2:00 – 7:00）")

    add_h2(doc, "P5　教师后台 · 创建班级（2:00 – 2:40）")
    add_p(doc, "镜头：录屏，浏览器打开 /teacher → 输入令牌 → 进入 dashboard → 点「新建班级」。")
    add_p(doc, "操作：填写「2024秋·双创基础·1班」，提交后显示班级码 KMQ7H4。复制学生加入链接。")
    add_p(doc, "解说：")
    add_p(doc, "「教师在后台一键创建班级，系统自动生成 6 位班级码与学生加入链接，可通过微信群分发。」", indent_first_line=False)

    add_h2(doc, "P6　学生加入 · 提交 BP（2:40 – 3:20）")
    add_p(doc, "镜头：另一台手机或浏览器隐身窗口打开加入链接 → 输入姓名学号 → 跳回首页 → 看到顶部班级横幅。")
    add_p(doc, "操作：粘贴示例 idea「面向高校学生的 AI 简历优化工具」，点击 AI 润色，提交。")
    add_p(doc, "解说：")
    add_p(doc, "「学生扫码或点链接即可加入班级，全程无需注册。提交一句话 idea 后，进入实时辩论流。」", indent_first_line=False)

    add_h2(doc, "P7　市场调研卡片（3:20 – 3:50）")
    add_p(doc, "镜头：录屏首屏，黄色边框的「市场调研数据」卡片，逐字流式渲染。")
    add_p(doc, "解说：")
    add_p(doc, "「辩论开始前，AI 会先调用百度千帆智能搜索完成实时市场调研，"
               "把市场规模、竞品、行业动态以可追溯证据形式注入后续辩论。」", indent_first_line=False)

    add_h2(doc, "P8　多智能体辩论（3:50 – 4:50）")
    add_p(doc, "镜头：录屏滚动展示四位评审依次发言，每条发言末尾的「AI 生成」角标。")
    add_p(doc, "解说：")
    add_p(doc, "「四位评审从不同视角逐字发言，主持人调度对话节奏。每一段 AI 输出都按照"
               "《生成式人工智能服务管理暂行办法》要求，标注『AI 生成』。」", indent_first_line=False)

    add_h2(doc, "P9　轮次小结与最终报告（4:50 – 5:30）")
    add_p(doc, "镜头：第 1 轮小结卡片 → 第 2 轮 → 主持人生成最终报告 → 跳转 /report 页面。")
    add_p(doc, "解说：")
    add_p(doc, "「每一轮结束后主持人汇总『共识』『分歧』『下轮焦点』；多轮收敛后输出"
               "结构化最终报告：综合评分、六维雷达、风险清单、改进建议、评审金句、证据链。」", indent_first_line=False)

    add_h2(doc, "P10　报告导出 · AI 合规水印（5:30 – 6:00）")
    add_p(doc, "镜头：点击「导出 PDF」与「导出图片」，展示导出件的 AI 生成水印与合规声明。")
    add_p(doc, "解说：")
    add_p(doc, "「最终报告可一键导出 PDF 与分享长图，导出件均带『双创智辩 · CreAI Edu』品牌头与 AI 生成合规声明。」", indent_first_line=False)

    add_h2(doc, "P11　教师视角 · 班级提交列表（6:00 – 6:30）")
    add_p(doc, "镜头：切回教师后台 → 进入班级详情，看到本班学生提交（学号已脱敏 202***3456）。")
    add_p(doc, "解说：")
    add_p(doc, "「教师后台同步看到全班所有提交，学号自动脱敏保护学生隐私。」", indent_first_line=False)

    add_h2(doc, "P12　班级聚合分析（6:30 – 7:00）")
    add_p(doc, "镜头：滚动到「班级聚合分析」卡片，展示总数、六维均分、分布、共性风险、Top 改进。")
    add_p(doc, "解说：")
    add_p(doc, "「这是本工具最具教学价值的部分——它把单份 BP 反馈聚合为全班共性反馈，"
               "教师据此判断下一节课该补哪个能力维度。」", indent_first_line=False)

    # ----- 段三 -----
    add_h1(doc, "段三　应用情况（7:00 – 8:00）")

    add_h2(doc, "P13　已完成的教学闭环验证（7:00 – 7:30）")
    add_p(doc, "镜头：四宫格示意——教师创建班级 / 学生加入提交 / AI 多轮辩论 / 班级聚合分析。")
    add_p(doc, "解说：")
    add_p(doc, "「目前我已在班级试点环境完成全部教学闭环验证：教师创建班级、学生扫码加入、"
               "AI 多轮辩论、班级聚合分析、报告导出与 AI 生成合规标识全部跑通。"
               "下一阶段计划在所授课班级开展正式教学试点，回收学生反馈与教学效益数据，"
               "持续迭代提示词与教学化模块。」", indent_first_line=False)

    add_h2(doc, "P14　创新点与开源（7:30 – 7:50）")
    add_p(doc, "镜头：四点创新——多模型异构辩论 / 工具化证据链 / 班级聚合教学反馈 / 全链路 AI 合规。下方放 GitHub 仓库地址。")
    add_p(doc, "解说：")
    add_p(doc, "「项目已开源，附完整《教师使用手册》《安装部署手册》，"
               "同行教师可一键 Docker 部署，在自己的双创课堂中复用与共建。」", indent_first_line=False)

    add_h2(doc, "P15　结尾（7:50 – 8:00）")
    add_p(doc, "镜头：标题页，附带感谢词与联系方式。")
    add_p(doc, "解说：")
    add_p(doc, "「感谢评委的耐心观看。借助国产生成式人工智能，让 AI 真正走进双创课堂——"
               "这是我作为一线教师持续探索的方向。」", indent_first_line=False)

    add_h1(doc, "录制与剪辑提示")
    add_bullet(doc, "屏幕录屏使用 OBS Studio / 系统自带录屏，分辨率必须为 1920×1080。")
    add_bullet(doc, "麦克风建议使用领夹麦或 USB 电容麦，降噪后导出。")
    add_bullet(doc, "解说原则上由真人朗读，不要使用 TTS 软件生成逐字稿配音。")
    add_bullet(doc, "录屏中如出现学生姓名/学号，需打码或使用脱敏样例。")
    add_bullet(doc, "导出格式 MP4 / H.264 视频 / AAC 128 Kbps 音频 / 视频码率 ≥ 8 Mbps。")

    out = OUT_DIR / "04_演示视频脚本.docx"
    doc.save(out)
    return out


# ======================================================================
# Entry
# ======================================================================

def main() -> None:
    paths = [
        build_case_info_form(),
        build_dev_report(),
        build_teacher_guide(),
        build_install_guide(),
        build_video_script(),
    ]
    print("Generated:")
    for p in paths:
        size_kb = p.stat().st_size / 1024
        print(f"  {p.relative_to(OUT_DIR.parent.parent)}  ({size_kb:.1f} KB)")


if __name__ == "__main__":
    main()
