"""Local reader: serve the page and load tutorial files on every request."""

import json
import re
import sys
import webbrowser
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import unquote, urlsplit


ROOT = Path(__file__).resolve().parent
CONSTRUCTION = re.compile(r"^(?:\d+(?:-\d+)*\s*)?建设中(?:（纯文本版）)?$")
EXCLUDED = {".git", ".venv", "node_modules", "__pycache__"}


def load_chapters():
    readme = ROOT / "README.md"
    files = [readme] if readme.is_file() and not readme.is_symlink() else []

    def collect(folder):
        for entry in folder.iterdir():
            if entry.is_symlink() or entry.name.startswith(".") or entry.name in EXCLUDED:
                continue
            if entry.is_dir():
                if not CONSTRUCTION.fullmatch(entry.name.strip()):
                    collect(entry)
            elif entry.suffix.lower() == ".md" or (
                entry.suffix.lower() == ".txt" and re.match(r"^\d+-", entry.name)
            ):
                files.append(entry)

    for folder in sorted(ROOT.iterdir()):
        if folder.is_dir() and not folder.is_symlink() and re.match(r"^\d", folder.name):
            if not CONSTRUCTION.fullmatch(folder.name.strip()):
                collect(folder)

    files.sort(key=lambda p: (p.name != "README.md" or p.parent != ROOT,
                             re.sub(r"\d+", lambda m: m[0].zfill(8), p.relative_to(ROOT).as_posix()).casefold()))
    chapters = []
    for file in files:
        try:
            with file.open(encoding="utf-8-sig", newline="") as source:
                content = source.read()
        except FileNotFoundError:
            continue
        heading = re.search(r"(?m)^#[ \t]+(.+)", content)
        title = re.sub(r"^\d+(?:-\d+)*\s+", "", heading[1].strip() if heading else file.stem)
        if CONSTRUCTION.fullmatch(title.strip()):
            continue
        path = file.relative_to(ROOT).as_posix()
        number = re.match(r"^\d+(?:-\d+)*", file.stem)
        group = "协会与学习路线"
        if path == "README.md":
            title = "关于协会与学习路线"
        else:
            folder = re.match(r"^(\d+)\s*(.*)$", path.split("/")[0])
            label = folder[2].strip() or ("实践实验室" if folder[1] == "2" else "学习资料")
            group = f"第 {folder[1]} 章 · {label}"
            if file.suffix.lower() == ".txt":
                title += "（纯文本版）"
        chapters.append(dict(path=path, title=title, number=number[0] if number else "",
                             group=group, content=content))
    return chapters


class ReaderHandler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(ROOT), **kwargs)

    def end_headers(self):
        self.send_header("Cache-Control", "no-store")
        super().end_headers()

    def do_GET(self):
        if self.headers.get("Host", "").split(":")[0] not in {"127.0.0.1", "localhost"}:
            self.send_error(403)
            return
        path = unquote(urlsplit(self.path).path)
        if path == "/api/chapters":
            try:
                data = json.dumps(load_chapters(), ensure_ascii=False).encode("utf-8")
            except (OSError, UnicodeError) as error:
                print(f"读取正文失败：{error}", file=sys.stderr)
                self.send_error(500, "Cannot read tutorial files")
                return
            self.send_response(200)
            self.send_header("Content-Type", "application/json; charset=utf-8")
            self.send_header("Content-Length", str(len(data)))
            self.end_headers()
            self.wfile.write(data)
            return
        try:
            relative = (ROOT / path.lstrip("/")).resolve().relative_to(ROOT)
        except (ValueError, OSError):
            self.send_error(404)
            return
        if any(part.startswith(".") or part in EXCLUDED for part in relative.parts):
            self.send_error(404)
            return
        if path == "/":
            self.path = "/index.html"
        elif not relative.parts or not (
            relative.as_posix() in {"index.html", "README.md"}
            or relative.parts[0] == "public"
            or re.match(r"^\d", relative.parts[0])
        ):
            self.send_error(404)
            return
        super().do_GET()

    def do_HEAD(self):
        self.send_error(405)

    def list_directory(self, path):
        self.send_error(404)

    def log_message(self, format, *args):
        pass


if __name__ == "__main__":
    try:
        with ThreadingHTTPServer(("127.0.0.1", 8765), ReaderHandler) as server:
            url = "http://127.0.0.1:8765/"
            print(f"阅读器已启动：{url}\n保存正文后，页面约 2 秒内自动更新。关闭此窗口可停止服务。", flush=True)
            webbrowser.open(url)
            server.serve_forever()
    except KeyboardInterrupt:
        pass
    except OSError as error:
        print(f"无法启动阅读器，请确认旧的启动窗口已关闭：{error}", file=sys.stderr)
        sys.exit(1)
