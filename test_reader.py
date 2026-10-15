"""Regression checks for chapter discovery and publication rules."""

import subprocess
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

import reader


class ChapterDiscoveryTests(unittest.TestCase):
    def setUp(self):
        self.folder = tempfile.TemporaryDirectory()
        self.root = Path(self.folder.name)
        self.root_patch = patch.object(reader, 'ROOT', self.root)
        self.root_patch.start()
        self.add('README.md', '# 学习资料')
        self.add('1 正文/1-1 导读.md', '# 1-1 导读')

    def tearDown(self):
        self.root_patch.stop()
        self.folder.cleanup()

    def add(self, name, text):
        target = self.root / name
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_text(text, encoding='utf-8')

    def paths(self):
        return [chapter['path'] for chapter in reader.load_chapters()]

    def test_source_is_excluded_at_every_depth_and_case(self):
        self.add('1 正文/source/vendor/README.md', '# 源码说明')
        self.add('1 正文/附录/SoUrCe/vendor/SECURITY.md', '# Security Policy')
        self.add('1 正文/附录/source/1-2 示例.md', '# 1-2 示例')
        self.assertEqual(self.paths(), ['README.md', '1 正文/1-1 导读.md'])

    def test_other_chapter_folders_remain_visible(self):
        self.add('1 正文/补充/1-2 笔记.md', '# 1-2 笔记')
        self.assertIn('1 正文/补充/1-2 笔记.md', self.paths())

    def test_construction_names_are_excluded_everywhere(self):
        self.add('2 建设中/2-1 草稿.md', '# 2-1 草稿')
        self.add('1 正文/附录（建设中）/1-2 草稿.md', '# 1-2 草稿')
        self.add('1 正文/1-3 草稿-建设中.md', '# 1-3 草稿')
        self.add('1 正文/1-4 草稿.md', '# 1-4 新内容（建设中）')
        self.assertEqual(self.paths(), ['README.md', '1 正文/1-1 导读.md'])

    def test_code_dependencies_still_stay_out_of_chapters(self):
        self.add('1 正文/.venv/README.md', '# 环境说明')
        self.add('1 正文/node_modules/README.md', '# 依赖说明')
        self.assertEqual(self.paths(), ['README.md', '1 正文/1-1 导读.md'])


class GitIgnoreTests(unittest.TestCase):
    def test_construction_files_and_folders_are_ignored(self):
        paths = ['2 建设中/2-1.md', '1 正文/附录（建设中）/README.md',
                 '1 正文/1-9 建设中的内容.md', '建设中.txt']
        result = subprocess.run(
            ['git', 'check-ignore', '--no-index', '-z', '--stdin'],
            cwd=Path(__file__).resolve().parent, input=('\0'.join(paths) + '\0').encode('utf-8'),
            capture_output=True, check=True,
        )
        self.assertEqual(result.stdout.decode('utf-8').rstrip('\0').split('\0'), paths)


if __name__ == '__main__':
    unittest.main()
