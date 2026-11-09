"""教学用单项最大风险模型；金额单位均为万元，仅依赖 Python 标准库。"""
import csv
from fractions import Fraction
from itertools import product
from pathlib import Path

TOTAL = Fraction(8000)
RATES = tuple(map(Fraction, ("0.05", "0.32", "0.26", "0.08", "0.16")))
RISKS = tuple(map(Fraction, ("0", "0.085", "0.055", "0.01", "0.10")))
ORDER = (1, 2, 4, 3)


def budget(value):
    value = Fraction(str(value))
    if value < 0:
        raise ValueError("风险上限 B 不能为负数")
    return value


def income(allocation):
    return sum((rate * amount for rate, amount in zip(RATES, allocation)), Fraction(0))


def risk(allocation):
    return max(q * x for q, x in zip(RISKS, allocation))


def solve(value):
    """按收益率递减分配，每项上限 B / q_i，剩余资金存银行。"""
    bound = budget(value)
    allocation = [Fraction(0)] * 5
    remaining = TOTAL
    for i in ORDER:
        allocation[i] = min(remaining, bound / RISKS[i])
        remaining -= allocation[i]
    allocation[0] = remaining
    return tuple(allocation)


def vertex_best(value):
    """独立枚举可行域顶点，核对贪心结果；返回最优收益，不依赖 ORDER。"""
    bound = budget(value)
    caps = (TOTAL,) + tuple(min(TOTAL, bound / q) for q in RISKS[1:])
    best = None
    # 总额固定的盒子约束顶点，至多一个变量不在其上下界。
    for free in range(5):
        fixed = [i for i in range(5) if i != free]
        for ends in product((0, 1), repeat=4):
            allocation = [Fraction(0)] * 5
            for i, end in zip(fixed, ends):
                allocation[i] = caps[i] * end
            allocation[free] = TOTAL - sum(allocation)
            if 0 <= allocation[free] <= caps[free]:
                result = income(allocation)
                best = result if best is None else max(best, result)
    return best


def main():
    values = (0, 20, 50, 100, 200, 400, 680, 800)
    rows = []
    for value in values:
        allocation = solve(value)
        assert sum(allocation) == TOTAL
        assert min(allocation) >= 0
        assert risk(allocation) <= value
        assert income(allocation) == vertex_best(value)
        row = (Fraction(value), *allocation, income(allocation), risk(allocation))
        rows.append([f"{float(number):.6f}" for number in row])
    output = Path(__file__).resolve().parent
    header = ["B_万元", "银行_万元", "S1_万元", "S2_万元", "S3_万元", "S4_万元", "收益_万元", "实际风险_万元"]
    with (output / "results.csv").open("w", encoding="utf-8-sig", newline="") as handle:
        writer = csv.writer(handle)
        writer.writerow(header)
        writer.writerows(rows)
    lines = ["# 金融建模示例计算结果", "", "金额单位：万元。显示六位小数，计算使用精确分数；风险采用 max(q_i x_i)。", "", "| " + " | ".join(header) + " |", "| " + " | ".join(["---"] * len(header)) + " |"]
    lines.extend("| " + " | ".join(row) + " |" for row in rows)
    lines.extend(["", "全部 8 组结果均通过资金、非负、风险约束与独立顶点枚举收益核验。", ""])
    (output / "results.md").write_text("\n".join(lines), encoding="utf-8")
    print("\n".join(lines))


if __name__ == "__main__":
    main()
