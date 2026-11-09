# Min GPT

字符级 GPT 教学源码，读取同目录的 `data.txt`，从零训练并续写。使用已有的非便携入口原稿，未改训练代码。

在本目录使用 Python 3.12 或更新版本：

```powershell
python -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r requirements.txt
.\.venv\Scripts\python.exe -B min_gpt.py
```

输入 `0` 使用默认提示词 `GPT`。完整训练为 800 步；其他提示词中的字符必须出现在 `data.txt` 中。首次安装 PyTorch 需要联网。
