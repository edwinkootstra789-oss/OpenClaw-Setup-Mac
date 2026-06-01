"""Desktop Control Demo: 打开计算器 → 3+5= → 截图"""
import pyautogui
import time
from pathlib import Path

pyautogui.FAILSAFE = True
pyautogui.PAUSE = 0

output_path = str(Path.home() / ".openclaw" / "workspace" / "calc_demo.png")

def step(msg):
    print(f"{msg}")
    time.sleep(0.5)

# 1. Win+R 打开运行对话框
step("1/4 打开运行对话框 (Win+R)...")
pyautogui.hotkey('win', 'r')
time.sleep(1)

# 2. 输入 calc 并回车
step("2/4 输入 'calc' 并回车...")
pyautogui.write('calc', interval=0.1)
time.sleep(0.3)
pyautogui.press('enter')

# 3. 等待计算器出现，输入 3+5=
step("3/4 等待计算器打开，输入 3+5=...")
time.sleep(2)
pyautogui.write('3+5=', interval=0.2)

# 4. 截图
step("4/4 截屏保存...")
time.sleep(0.5)
pyautogui.screenshot(output_path)

print(f"\n✅ 截图已保存: {output_path}")
print(f"   大小: {round(Path(output_path).stat().st_size / 1024, 1)} KB")
