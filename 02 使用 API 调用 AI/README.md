# 使用 API 调用 AI

`code.py` 保留原 API 调用内容，只将 `api_key` 改成 `YOUR_DEEPSEEK_API_KEY`，并移除绑定旧便携环境的启动包装。运行前在本地填入自己的 DeepSeek 密钥；提交前恢复占位符。模型名称沿用原稿，若账户不支持，请由使用者选择其账户可用模型。

使用 Python 3.12 或更新版本，在本目录运行：

```powershell
python -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r requirements.txt
.\.venv\Scripts\python.exe -B code.py
```

不需要旧会前准备包、便携 Python 或额外启动器。真实调用会联网并消耗本人账户额度。不要把填好密钥的脚本提交到 Git，也不要把密钥写入聊天、日志或截图。
