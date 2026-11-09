"""读取同一份结果，绘制预算变化下的配置和 100 万元预算示例。"""
import csv
import json
from pathlib import Path

import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt

ROOT = Path(__file__).resolve().parent.parent
FIGURES = ROOT / "figures"
COLORS = ["#347BCB", "#0E9F91", "#E2B04B", "#AA70C7", "#9AA0AA"]
ORDER = [1, 2, 3, 4, 0]
LABELS = ["S1", "S2", "S3", "S4", "银行"]


def save(fig, name):
    for ext in ["pdf", "png", "svg"]:
        fig.savefig(FIGURES / f"{name}.{ext}", dpi=240)
    plt.close(fig)


def main():
    results = ROOT / "results"
    if not (results / "risk_scan.csv").exists():
        raise FileNotFoundError("请先运行 1 求解投资组合.py")
    with (results / "risk_scan.csv").open(encoding="utf-8-sig", newline="") as file:
        rows = list(csv.DictReader(file))
    example = json.loads((results / "optimal_100.json").read_text(encoding="utf-8"))
    plt.rcParams.update({
        "font.sans-serif": ["Microsoft YaHei", "SimHei", "DejaVu Sans"],
        "axes.unicode_minus": False, "pdf.fonttype": 42,
        "svg.fonttype": "path", "font.size": 10,
    })
    FIGURES.mkdir(exist_ok=True)
    budgets = [float(row["budget"]) for row in rows]
    proportions = [[float(row[f"x{i}"]) / float(row["total"]) * 100 for row in rows] for i in ORDER]
    fig, ax = plt.subplots(figsize=(7.0, 4.3), layout="constrained")
    ax.stackplot(budgets, *proportions, colors=COLORS, labels=LABELS)
    ax.set(xlim=(0, 680), ylim=(0, 100), xlabel="风险预算（万元）",
           ylabel="资金分配比例（%）", xticks=[0, 100, 200, 400, 680])
    ax.legend(loc="upper center", bbox_to_anchor=(0.5, 1.15), ncol=5, frameon=False)
    for spine in ["top", "right"]:
        ax.spines[spine].set_visible(False)
    save(fig, "资金配置随风险预算变化")

    fig, ax = plt.subplots(figsize=(7.0, 1.6), layout="constrained")
    left = 0
    for i, label, color in zip(ORDER, LABELS, COLORS):
        proportion = example[f"x{i}"] / example["total"] * 100
        if proportion > 0:
            ax.barh(0, proportion, left=left, color=color, height=0.45)
            ax.text(left + proportion / 2, 0, f"{label}\n{proportion:.1f}%",
                    ha="center", va="center", color="white", fontsize=10)
        left += proportion
    ax.set(xlim=(0, 100), ylim=(-0.45, 0.45),
           title="风险预算为 100 万元时的资金分配")
    ax.axis("off")
    save(fig, "风险预算100万元资金分配")
    print(f"两张资金配置图已保存至 {FIGURES}")


if __name__ == "__main__":
    main()
