# 课程方案格式标准
# 用于标准化课程方案文档的格式

## 格式定义

### 字体设置
- **字体**: 仿宋 (FangSong)
- **备用字体**: 宋体 (SimSun)

### 标题层级定义

#### 主标题 (文档标题)
- **字号**: 24pt
- **对齐**: 居中
- **加粗**: 是
- **用途**: 课程方案主标题，如："8周8大AI神技：拒绝淘汰，一键接管！"课程方案

#### 一级标题 (章节标题)
- **字号**: 14pt
- **对齐**: 左对齐
- **加粗**: 是
- **用途**: 主要章节，如：一、课程基本信息；二、课程提纲；三、讲师介绍
- **格式**: 中文数字 + 顿号，如"一、"

#### 二级标题 (小节标题)
- **字号**: 11pt
- **对齐**: 左对齐
- **加粗**: 是
- **用途**: 小节标题，如：社会职务与荣誉、个人介绍

#### 三级标题 (元信息标签)
- **字号**: 11pt
- **对齐**: 左对齐
- **加粗**: 是
- **用途**: 文档元信息，如：服务提供方、客户名称、课程周期、培训对象
- **格式**: "标签：" + 内容

#### 正文
- **字号**: 11pt
- **对齐**: 左对齐
- **加粗**: 否
- **用途**: 普通段落内容

#### 人名/重要名称
- **字号**: 11pt
- **对齐**: 左对齐
- **加粗**: 是
- **用途**: 讲师姓名、重要职位名称

### 段落设置
- **行距**: 单倍行距 (默认)
- **段前间距**: 0
- **段后间距**: 0
- **首行缩进**: 无

### 页面设置
- **页边距**: 默认 (上下2.54cm，左右3.17cm)

## 使用示例

### 典型文档结构

```
[主标题 - 24pt 居中 加粗]
"课程名称"课程方案

[空行]

[元信息 - 11pt 加粗]
服务提供方：公司名称
客户名称：学校/机构名称
课程周期：共X节课，每节课XX分钟
培训对象：目标学员群体

[空行]

[一级标题 - 14pt 加粗]
一、 课程基本信息

[元信息 - 11pt 加粗]
课程名称：XXX
培训对象：XXX
课程周期：XXX
考核方式：XXX
教学保障：XXX

[一级标题 - 14pt 加粗]
二、 课程提纲

[二级标题 - 11pt 加粗]
第一周：主题

[正文 - 11pt]
内容描述...

[一级标题 - 14pt 加粗]
三、 讲师介绍

[人名 - 11pt 加粗]
讲师姓名

[正文 - 11pt]
职位信息

[二级标题 - 11pt 加粗]
社会职务与荣誉

[正文 - 11pt]
- 职务1
- 职务2

[二级标题 - 11pt 加粗]
个人介绍

[正文 - 11pt]
详细介绍内容...

[一级标题 - 14pt 加粗]
四、 课程安排

[一级标题 - 14pt 加粗]
五、 报价

[正文 - 11pt]
报价说明...
```

## Python 脚本使用

### 格式化文档

```python
from docx import Document
from docx.shared import Pt
from docx.enum.text import WD_ALIGN_PARAGRAPH

def apply_course_format(doc_path, output_path):
    \"\"\"应用课程方案格式\"\"\"
    doc = Document(doc_path)
    
    for para in doc.paragraphs:
        text = para.text.strip()
        if not text:
            continue
            
        # 判断段落类型并应用格式
        if is_main_title(text):
            format_main_title(para)
        elif is_level1_heading(text):
            format_level1_heading(para)
        elif is_level2_heading(text):
            format_level2_heading(para)
        elif is_meta_info(text):
            format_meta_info(para)
        else:
            format_body(para)
    
    doc.save(output_path)

def is_main_title(text):
    \"\"\"判断是否是主标题\"\"\"
    return '课程方案' in text and len(text) < 50

def is_level1_heading(text):
    \"\"\"判断是否是一级标题（一、二、三...）\"\"\"
    import re
    return bool(re.match(r'^[一二三四五六七八九十]+、', text))

def is_level2_heading(text):
    \"\"\"判断是否是二级标题\"\"\"
    # 根据上下文判断，如"社会职务与荣誉"、"个人介绍"
    level2_keywords = ['介绍', '荣誉', '职务', '大纲', '安排']
    return any(kw in text for kw in level2_keywords) and len(text) < 15

def is_meta_info(text):
    \"\"\"判断是否是元信息\"\"\"
    meta_labels = ['服务提供方', '客户名称', '课程周期', '培训对象', 
                   '课程名称', '考核方式', '教学保障']
    return any(text.startswith(label) for label in meta_labels)

def format_main_title(para):
    \"\"\"格式化主标题\"\"\"
    para.alignment = WD_ALIGN_PARAGRAPH.CENTER
    for run in para.runs:
        run.font.name = '仿宋'
        run.font.size = Pt(24)
        run.font.bold = True

def format_level1_heading(para):
    \"\"\"格式化一级标题\"\"\"
    for run in para.runs:
        run.font.name = '仿宋'
        run.font.size = Pt(14)
        run.font.bold = True

def format_level2_heading(para):
    \"\"\"格式化二级标题\"\"\"
    for run in para.runs:
        run.font.name = '仿宋'
        run.font.size = Pt(11)
        run.font.bold = True

def format_meta_info(para):
    \"\"\"格式化元信息\"\"\"
    for run in para.runs:
        run.font.name = '仿宋'
        run.font.size = Pt(11)
        run.font.bold = True

def format_body(para):
    \"\"\"格式化正文\"\"\"
    for run in para.runs:
        run.font.name = '仿宋'
        run.font.size = Pt(11)
        run.font.bold = False
```

## 版本历史

- **v1.0** (2026-03-18): 初始版本，基于"AI外挂全指南"课程方案文档
