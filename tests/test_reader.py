import importlib.util
import json
import tempfile
import threading
import unittest
from pathlib import Path
from urllib.error import HTTPError
from urllib.request import ProxyHandler, Request, build_opener


spec = importlib.util.spec_from_file_location("reader", Path(__file__).resolve().parents[1] / "reader.py")
reader = importlib.util.module_from_spec(spec)
spec.loader.exec_module(reader)


class ReaderTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.original_root = reader.ROOT
        reader.ROOT = Path(self.temp.name)
        self.write("index.html", "<h1>阅读器</h1>")
        self.write("README.md", "# 协会\n\n最新正文")
        self.write("0 准备开始/0-1 导读.md", "# 0-1 全章节导读\n\n## 内容\n正文")
        self.server = reader.ThreadingHTTPServer(("127.0.0.1", 0), reader.ReaderHandler)
        self.thread = threading.Thread(target=self.server.serve_forever, daemon=True)
        self.thread.start()
        self.url = f"http://127.0.0.1:{self.server.server_port}"
        self.open = build_opener(ProxyHandler({})).open

    def tearDown(self):
        self.server.shutdown()
        self.server.server_close()
        self.thread.join()
        reader.ROOT = self.original_root
        self.temp.cleanup()

    def write(self, path, text):
        file = reader.ROOT / path
        file.parent.mkdir(parents=True, exist_ok=True)
        file.write_text(text, encoding="utf-8")
        return file

    def chapters(self):
        with self.open(self.url + "/api/chapters") as response:
            self.assertEqual(response.headers["Cache-Control"], "no-store")
            return json.load(response)

    def test_live_edit_add_rename_and_delete(self):
        self.assertEqual(len(self.chapters()), 2)
        self.write("README.md", "# 协会\n\n保存后更新")
        self.assertIn("保存后更新", self.chapters()[0]["content"])
        file = self.write("0 准备开始/0-2 新章节.md", "# 0-2 新章节")
        self.assertEqual(len(self.chapters()), 3)
        renamed = file.with_name("0-3 改名.md")
        file.rename(renamed)
        self.assertIn("0 准备开始/0-3 改名.md", [ch["path"] for ch in self.chapters()])
        renamed.unlink()
        self.assertEqual(len(self.chapters()), 2)

    def test_construction_and_private_directories_are_excluded(self):
        for path, title in [("1 建设中/README.md", "已完成"), ("0 准备开始/建设中/README.md", "已完成"),
                            ("0 准备开始/0-3 暂存.md", "0-3 建设中"), ("0 准备开始/.venv/README.md", "依赖"),
                            ("code/README.md", "旧工具")]:
            self.write(path, "# " + title)
        self.assertEqual(len(self.chapters()), 2)

    def test_numeric_order_and_plain_text(self):
        self.write("0 准备开始/0-10 纯文本.txt", "示例文字")
        self.write("0 准备开始/0-2 新章节.md", "# 0-2 新章节")
        chapters = self.chapters()
        self.assertEqual([ch["number"] for ch in chapters], ["", "0-1", "0-2", "0-10"])
        self.assertTrue(chapters[-1]["title"].endswith("（纯文本版）"))

    def test_images_and_page_are_served_without_code_directory(self):
        self.write("public/test.png", "image")
        for path in ["/", "/public/test.png"]:
            with self.open(self.url + path) as response:
                self.assertEqual(response.status, 200)

    def test_private_files_traversal_and_directory_listing_are_blocked(self):
        self.write(".git/config", "private")
        self.write("code/private.txt", "private")
        for path in ["/.git/config", "/code/private.txt", "/public/", "/%2e%2e/reader.py"]:
            with self.assertRaises(HTTPError) as failure:
                self.open(self.url + path)
            self.assertEqual(failure.exception.code, 404)
        with self.assertRaises(HTTPError) as failure:
            self.open(Request(self.url + "/api/chapters", headers={"Host": "example.com"}))
        self.assertEqual(failure.exception.code, 403)

    def test_empty_catalog(self):
        (reader.ROOT / "README.md").unlink()
        (reader.ROOT / "0 准备开始/0-1 导读.md").unlink()
        self.assertEqual(self.chapters(), [])


if __name__ == "__main__":
    unittest.main()
