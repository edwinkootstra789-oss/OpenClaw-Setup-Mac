---
name: word-cn-format
description: 提供Word文档按中文格式标准化的功能，包括标题、正文、图片、图表等格式的统一处理。支持多种预设格式：通用中文格式（微软雅黑）和课程方案格式（仿宋）。适用于企业文档、学术论文、报告、课程方案等场景。
---

# Word中文格式标准化

## 功能概述

本skill提供Word文档的中文格式标准化功能，支持多种格式标准：

1. **通用中文格式** - 使用微软雅黑字体，适用于企业文档、学术论文、报告
2. **课程方案格式** - 使用仿宋字体，专为课程方案文档设计

功能包括：
- 标题和各级标题的格式化
- 正文的字体大小和行距设置
- 段前段后位置调整
- 行缩进设置
- 图片和图表的格式标准化

## 目录结构

```
sample_1/
├── SKILL.md              # 技能说明文件
├── scripts/
│   ├── format_word.py    # 核心格式化脚本
│   └── requirements.txt  # 依赖项
├── references/
│   ├── format_standard.md  # 格式标准说明
│   └── usage_guide.md      # 使用指南
└── assets/
    └── template.docx     # 模板文件
```

## 格式标准

### 1. 通用中文格式（默认）

#### 标题格式
- 标题：微软雅黑，2号字体，加粗，居中，段前12磅，段后6磅
- 一级标题：微软雅黑，3号字体，加粗，左对齐，段前12磅，段后6磅
- 二级标题：微软雅黑，4号字体，加粗，左对齐，段前6磅，段后3磅
- 三级标题：微软雅黑，小4号字体，加粗，左对齐，段前3磅，段后3磅

#### 正文格式
- 字体：微软雅黑，5号字体
- 行距：1.5倍行距
- 段前：0磅
- 段后：0磅
- 首行缩进：2字符

### 2. 课程方案格式

专为课程方案、培训大纲等教育类文档设计的格式标准。

#### 字体设置
- **字体**：仿宋 (FangSong)
- **默认字号**：11pt

#### 标题层级

| 层级 | 用途 | 字号 | 对齐 | 加粗 |
|------|------|------|------|------|
| **主标题** | 课程方案标题 | **24pt** | 居中 | ✅ |
| **一级标题** | 一、二、三... 章节 | **14pt** | 左对齐 | ✅ |
| **二级标题** | 小标题（如"社会职务与荣誉"） | **11pt** | 左对齐 | ✅ |
| **正文** | 普通内容 | **11pt** | 左对齐 | ❌ |

#### 特殊格式
- **元信息**（服务提供方、客户名称等）：11pt，加粗
- **人名**（如讲师姓名）：11pt，加粗

### 图片和图表格式（通用）
- 图片居中显示
- 图片下方添加编号和说明
- 图表标题在图表上方，居中显示
- 图表数据标签清晰可见

## 使用方法

### 1. 安装依赖

```bash
pip install -r scripts/requirements.txt
```

### 2. 选择格式标准

#### 通用中文格式（默认）

```bash
python scripts/format_word.py <input_file> [output_file]
```

#### 课程方案格式

```bash
python scripts/format_course.py <input_file> [output_file]
```

参数说明：
- `<input_file>`：要格式化的Word文档路径
- `[output_file]`：可选，格式化后的文档保存路径，默认在原文件基础上加"_formatted"后缀

## 示例

### 通用中文格式示例

```bash
# 格式化文档并保存为新文件
python scripts/format_word.py document.docx formatted_document.docx

# 直接在原文件基础上格式化
python scripts/format_word.py report.docx
```

### 课程方案格式示例

```bash
# 格式化课程方案文档
python scripts/format_course.py "AI课程方案.docx"

# 指定输出文件名
python scripts/format_course.py "AI课程方案.docx" "AI课程方案_格式化.docx"
```

### 预期效果

执行脚本后，文档将按照选定的格式标准进行统一处理，确保整体风格一致，符合中文排版规范。

## 目录结构

```
word-cn-format/
├── SKILL.md                    # 技能说明文件
├── scripts/
│   ├── format_word.py          # 通用中文格式脚本
│   ├── format_course.py        # 课程方案格式脚本
│   └── requirements.txt        # 依赖项
├── references/
│   ├── format_standard.md      # 通用格式标准说明
│   └── course_standard.md      # 课程方案格式标准
└── assets/
    └── template.docx           # 模板文件
```