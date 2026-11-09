from openai import OpenAI

client = OpenAI(
    api_key="YOUR_DEEPSEEK_API_KEY",  # 替换为自己的 DeepSeek API Key
    base_url="https://api.deepseek.com",
)
response = client.chat.completions.create(
    model="deepseek-flash",
    messages=[{"role": "user", "content": "现在是技术分享会，我们在学习如何使用 API 调用 AI，你想对在场的同学说什么？"}],
)
print(response.choices[0].message.content)
