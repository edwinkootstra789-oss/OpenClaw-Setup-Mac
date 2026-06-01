from PIL import Image, ImageDraw, ImageFont
import os

# 创建图片
width, height = 1080, 1440
img = Image.new('RGB', (width, height), color='#FF6B6B')
draw = ImageDraw.Draw(img)

# 标题文字
title = '冷库验收20项checklist'
subtitle = '食品厂老板必看'
warning = '漏一项都可能被罚款！'

# 使用默认字体
try:
    font_title = ImageFont.truetype('C:/Windows/Fonts/simhei.ttf', 80)
    font_sub = ImageFont.truetype('C:/Windows/Fonts/simhei.ttf', 60)
    font_warn = ImageFont.truetype('C:/Windows/Fonts/simhei.ttf', 50)
    font_small = ImageFont.truetype('C:/Windows/Fonts/simhei.ttf', 40)
except:
    font_title = ImageFont.load_default()
    font_sub = ImageFont.load_default()
    font_warn = ImageFont.load_default()
    font_small = ImageFont.load_default()

# 绘制文字
draw.text((width//2, 400), subtitle, fill='white', font=font_sub, anchor='mm')
draw.text((width//2, 550), title, fill='white', font=font_title, anchor='mm')
draw.text((width//2, 700), warning, fill='#FFE66D', font=font_warn, anchor='mm')

# 底部文字
draw.text((width//2, 1100), '和顺环境 | 15年冷库总承包商', fill='white', font=font_small, anchor='mm')
draw.text((width//2, 1200), '包验收通过 · 省心又放心', fill='#FFE66D', font=font_small, anchor='mm')

# 保存
output_path = 'C:/Users/20305/.openclaw/workspace/skills/xiaohongshu-skills-main/cover.png'
img.save(output_path)
print(f'封面已保存: {output_path}')
