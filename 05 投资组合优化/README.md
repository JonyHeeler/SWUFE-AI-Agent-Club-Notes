# 投资组合优化

金额单位为万元，总资金 8000，银行利率 5%；按单项最大风险 `max(q_i x_i)` 建模。源文件原样保留，题干与讲解请前往[云端学习资料](https://jonywang.xyz/AgentClub/notes/index.html)的 2-8、2-9。

`finance_model.py` 只依赖 Python 标准库，包含独立顶点枚举核验：

```powershell
python -B finance_model.py
```

`code/` 是 SciPy 求解与 Matplotlib 绘图版本，使用已有的非便携入口原稿。请使用 Python 3.12 或更新版本，在本目录执行：

```powershell
python -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r code/requirements.txt
.\.venv\Scripts\python.exe -B 'code/1 求解投资组合.py'
.\.venv\Scripts\python.exe -B 'code/2 绘制收益风险曲线.py'
.\.venv\Scripts\python.exe -B 'code/3 绘制资金分配图.py'
```

先求解再绘图。结果在 `results/`、图表在 `figures/`；标准库版本会生成 `results.csv` 与 `results.md`。这些产物已被 Git 忽略，仓库仅保存可复现源码及依赖清单。
