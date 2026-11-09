"""求解、独立核对并保存结果；金额单位均为万元。"""
import csv
import json
from pathlib import Path

import numpy as np
from scipy.optimize import linprog

ROOT = Path(__file__).resolve().parent.parent
RESULTS = ROOT / "results"
TOTAL = 8000.0
NAMES = ["银行", "S1", "S2", "S3", "S4"]
RETURNS = np.array([0.05, 0.32, 0.26, 0.08, 0.16])
RISKS = np.array([0.0, 0.085, 0.055, 0.01, 0.10])
PRIORITY = [1, 2, 4, 3, 0]


def solve(budget):
    """在线性规划中，将每项资产的风险约束写成投资金额上限。"""
    if not np.isfinite(budget) or budget < 0:
        raise ValueError("风险预算必须是有限的非负数")
    bounds = [(0, None)] + [(0, budget / q) for q in RISKS[1:]]
    result = linprog(
        -RETURNS, A_eq=np.ones((1, 5)), b_eq=[TOTAL],
        bounds=bounds, method="highs",
    )
    if not result.success:
        raise RuntimeError(result.message)
    x = result.x
    # 用收益优先级独立核对，不依赖求解器给出的目标值。
    greedy = np.zeros(5)
    remaining = TOTAL
    for i in PRIORITY:
        cap = budget / RISKS[i] if i else TOTAL
        greedy[i] = min(remaining, cap)
        remaining -= greedy[i]
    assert np.allclose(x, greedy, atol=1e-6, rtol=0)
    assert abs(x.sum() - TOTAL) < 1e-6
    assert np.all(x >= -1e-6)
    assert np.max(x * RISKS) <= budget + 1e-6
    return {
        "budget": float(budget), "total": TOTAL, "profit": float(x @ RETURNS),
        "risk": float(np.max(x * RISKS)),
        "return_percent": float((x @ RETURNS) / TOTAL * 100),
        **{f"x{i}": float(value) for i, value in enumerate(x)},
    }


def write_csv(path, rows):
    with path.open("w", encoding="utf-8-sig", newline="") as file:
        writer = csv.DictWriter(file, fieldnames=list(rows[0]))
        writer.writeheader()
        writer.writerows(rows)



def main():
    RESULTS.mkdir(exist_ok=True)
    critical = [
        TOTAL / sum(1 / RISKS[1:]),
        TOTAL / sum(1 / RISKS[[1, 2, 4]]),
        TOTAL / sum(1 / RISKS[[1, 2]]), 680.0,
    ]
    # 同时加入精确转折点，绘图连线才不会略过分段函数的拐角。
    budgets = sorted(set(np.arange(0, 681, 5).tolist() + critical))
    rows = [solve(t) for t in budgets]
    samples = [solve(t) for t in [0, 50, 100, 200, 250, 400, 680]]
    example = solve(100)
    assert round(example["profit"], 2) == 1329.63
    assert solve(0)["profit"] == 400
    assert solve(680)["profit"] == solve(1000)["profit"] == 2560
    for invalid in [-1, float("nan"), float("inf")]:
        try:
            solve(invalid)
        except ValueError:
            pass
        else:
            raise AssertionError("无效预算未被拒绝")
    write_csv(RESULTS / "risk_scan.csv", rows)
    write_csv(RESULTS / "risk_samples.csv", samples)
    write_csv(RESULTS / "critical_points.csv", [
        {"point": f"t{i + 1}", "budget": t}
        for i, t in enumerate(critical)
    ])
    (RESULTS / "optimal_100.json").write_text(
        json.dumps(example, ensure_ascii=False, indent=2), encoding="utf-8",
    )
    print(f"已求解并独立验证 {len(rows)} 个风险预算，结果保存至 {RESULTS}")


if __name__ == "__main__":
    main()
