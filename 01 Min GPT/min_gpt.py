"""一个字符级 GPT：读取 data.txt，从零训练，再逐字续写。"""
from pathlib import Path
import torch
from torch import nn
from torch.nn import functional as F

CONTEXT, WIDTH, HEADS = 32, 32, 4
BATCH_SIZE, STEPS, LEARNING_RATE = 16, 800, 0.003
DEFAULT_PROMPT, NEW_CHARS = "GPT", 120
DEVICE = "cuda" if torch.cuda.is_available() else "cpu"


class GPT(nn.Module):
    def __init__(self, vocab_size):
        super().__init__()
        self.token = nn.Embedding(vocab_size, WIDTH)
        self.position = nn.Embedding(CONTEXT, WIDTH)
        self.transformer = nn.TransformerEncoderLayer(
            WIDTH, HEADS, dim_feedforward=4 * WIDTH, dropout=0,
            activation="gelu", batch_first=True, norm_first=True)
        self.norm = nn.LayerNorm(WIDTH)
        self.head = nn.Linear(WIDTH, vocab_size)

    def forward(self, ids):  # [批次, 字符数] → [批次, 字符数, 词表大小]
        length = ids.size(1)
        x = self.token(ids) + self.position(torch.arange(length, device=ids.device))
        # True 表示禁止关注；上三角遮住未来，只能看当前和之前的字符。
        mask = torch.ones(length, length, dtype=torch.bool, device=ids.device).triu(1)
        x = self.transformer(x, src_mask=mask)
        return self.head(self.norm(x))


@torch.no_grad()
def generate(model, chars, prompt):
    model.eval()
    ids = torch.tensor([[chars.index(c) for c in prompt]], device=DEVICE)
    for _ in range(NEW_CHARS):
        logits = model(ids[:, -CONTEXT:])[:, -1, :]  # 最后一个位置预测下一个字
        next_id = torch.multinomial(F.softmax(logits, dim=-1), 1)
        ids = torch.cat((ids, next_id), dim=1)  # 把预测加回来，继续预测
    return "".join(chars[i] for i in ids[0].tolist())


def main():
    torch.manual_seed(42)
    torch.set_num_threads(2)  # 小模型用少量 CPU 线程，避免调度开销
    text = Path(__file__).with_name("data.txt").read_text(encoding="utf-8")
    chars = sorted(set(text))  # 最简单的 tokenizer：一个字符就是一个 token
    prompt = input("请输入提示词（输入 0 使用 GPT）：").strip()
    prompt = DEFAULT_PROMPT if prompt == "0" else prompt
    if len(text) <= CONTEXT or not prompt or not set(prompt) <= set(chars):
        raise ValueError("语料必须长于 CONTEXT；提示词非空且每个字符都在语料中。")
    data = torch.tensor([chars.index(c) for c in text], device=DEVICE)
    model = GPT(len(chars)).to(DEVICE)
    print(f"设备：{DEVICE} | 词表：{len(chars)} | 参数：{sum(p.numel() for p in model.parameters()):,}")
    print("\n训练前：\n" + generate(model, chars, prompt))
    model.train()
    optimizer = torch.optim.AdamW(model.parameters(), lr=LEARNING_RATE)
    for step in range(STEPS):
        starts = torch.randint(len(data) - CONTEXT, (BATCH_SIZE,), device=DEVICE)
        batch = data[starts[:, None] + torch.arange(CONTEXT + 1, device=DEVICE)]
        x, y = batch[:, :-1], batch[:, 1:]  # 输入：我爱学；目标：爱学习
        logits = model(x)
        loss = F.cross_entropy(logits.reshape(-1, len(chars)), y.reshape(-1))
        optimizer.zero_grad()
        loss.backward()
        optimizer.step()
        if step % 200 == 0 or step == STEPS - 1:
            print(f"step {step + 1:4d}/{STEPS} | loss {loss.item():.4f}")
    print("\n训练后：\n" + generate(model, chars, prompt))


if __name__ == "__main__":
    main()
