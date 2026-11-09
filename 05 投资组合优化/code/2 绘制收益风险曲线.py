"""只读取求解结果，输出收益—风险有效前沿。"""
import csv
from pathlib import Path

import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt

ROOT = Path(__file__).resolve().parent.parent
FIGURES = ROOT / "figures"


def main():
    path = ROOT / "results" / "risk_scan.csv"
    if not path.exists():
        raise FileNotFoundError("请先运行 1 求解投资组合.py")
    with path.open(encoding="utf-8-sig", newline="") as file:
        rows = list(csv.DictReader(file))
    plt.rcParams.update({
        "font.sans-serif": ["Microsoft YaHei", "SimHei", "DejaVu Sans"],
        "axes.unicode_minus": False, "pdf.fonttype": 42,
        "svg.fonttype": "path", "font.size": 10,
    })
    x = [float(row["budget"]) for row in rows]
    y = [float(row["profit"]) for row in rows]
    fig, ax = plt.subplots(figsize=(7.0, 4.3), layout="constrained")
    ax.plot(x, y, color="#F47E39", linewidth=1.8)
    for row in rows:
        if float(row["budget"]) in [0, 50, 100, 200, 250, 400, 680]:
            ax.plot(float(row["budget"]), float(row["profit"]), "o",
                    color="#F47E39", markeredgecolor="white", markersize=5)
    ax.set(xlim=(-8, 690), ylim=(0, 2800),
           xlabel="风险预算（万元）", ylabel="最大预期收益（万元）",
           xticks=[0, 200, 400, 600, 680], yticks=[0, 700, 1400, 2100, 2800])
    ax.grid(axis="y", linestyle=(0, (3, 3)), color="#E2E5E7")
    ax.tick_params(length=0, labelcolor="#6E7479", pad=7)
    for spine in ax.spines.values():
        spine.set_visible(False)
    FIGURES.mkdir(exist_ok=True)
    for ext in ["pdf", "png", "svg"]:
        fig.savefig(FIGURES / f"收益风险有效前沿.{ext}", dpi=240)
    plt.close(fig)
    print(f"收益—风险曲线已保存至 {FIGURES}")


if __name__ == "__main__":
    main()
