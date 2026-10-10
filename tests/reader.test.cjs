const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs');
const os = require('node:os');
const { spawn } = require('node:child_process');
const { pathToFileURL } = require('node:url');
const { chromium } = require('playwright');

(async () => {
  const root = path.resolve(__dirname, '..');
  const fixture = fs.mkdtempSync(path.join(os.tmpdir(), 'club-reader-'));
  let browser, server;
  try {
    for (const name of ['index.html', 'README.md', 'public', ...fs.readdirSync(root).filter(name => /^\d/.test(name) && !/^\d+(?:-\d+)*\s*建设中$/.test(name))]) {
      fs.cpSync(path.join(root, name), path.join(fixture, name), { recursive: true, filter: source => !fs.lstatSync(source).isSymbolicLink() && !['.git', '.venv', 'node_modules', '__pycache__'].includes(path.basename(source)) });
    }
    const python = `import importlib.util\nfrom pathlib import Path\nspec=importlib.util.spec_from_file_location('reader',${JSON.stringify(path.join(root, 'reader.py'))})\nreader=importlib.util.module_from_spec(spec)\nspec.loader.exec_module(reader)\nreader.ROOT=Path(${JSON.stringify(fixture)})\nserver=reader.ThreadingHTTPServer(('127.0.0.1',0),reader.ReaderHandler)\nprint('http://127.0.0.1:'+str(server.server_port)+'/',flush=True)\nserver.serve_forever()`;
    server = spawn('python', ['-u', '-c', python], { windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
    const url = await new Promise((resolve, reject) => {
      let output = '', errors = '';
      server.stdout.on('data', data => { output += data; if (output.includes('\n')) resolve(output.trim()); });
      server.stderr.on('data', data => { errors += data; });
      server.once('error', reject);
      server.once('exit', () => reject(new Error(errors || 'Reader server stopped')));
    });
    browser = await chromium.launch({ channel: 'msedge', headless: true });
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(url);
    await page.waitForFunction(() => !!current);
    assert.equal(await page.locator('#chapters .chapter').count(), await page.evaluate(() => chapters.length));
    assert.equal(fs.existsSync(path.join(fixture, 'code')), false);
    assert.deepEqual(await page.evaluate(() => chapters.filter(ch => ch.path.includes('建设中') || isConstruction(ch.title))), []);
    assert.deepEqual(await page.evaluate(() => [isConstruction('建设中'), isConstruction('2 建设中'), isConstruction('0-9 建设中（纯文本版）'), isConstruction('准备开始')]), [true, true, true, false]);
    assert.deepEqual(await page.evaluate(() => {
      const failures = [];
      for (const chapter of chapters.filter(ch => ch.path.endsWith('.md'))) {
        marked.walkTokens(marked.lexer(chapter.content), token => {
          if (token.type === 'text' && !token.tokens && token.text.includes('**')) failures.push(chapter.path + ': ' + token.text);
        });
      }
      return failures;
    }), []);
    assert.equal(await page.evaluate(() => {
      const chapter = chapters.find(ch => ch.number === '0-5');
      const box = document.createElement('div');
      box.append(renderMarkdown(chapter.content, chapter.path));
      return [...box.querySelectorAll('strong')].some(el => el.textContent === '文件名回答“它叫什么”，路径回答“它在哪里”');
    }), true);
    assert.equal(await page.evaluate(() => {
      const box = document.createElement('div');
      box.append(renderMarkdown(chapterByPath.get('README.md').content, 'README.md'));
      return box.querySelector('img').getAttribute('width');
    }), '200');
    assert.deepEqual(await page.evaluate(() => {
      const chapter = chapters.find(ch => ch.title === '如何阅读 Markdown');
      const box = document.createElement('div');
      box.append(renderMarkdown(chapter.content, chapter.path));
      const heading = [...box.querySelectorAll('h3')].find(el => el.textContent === '7. 代码块');
      const elements = [];
      for (let el = heading.nextElementSibling; el && el.tagName !== 'H3'; el = el.nextElementSibling) elements.push(el);
      return elements.map(el => el.matches('.code-block')
        ? [el.querySelector('.code-bar span').textContent, el.querySelector('code').textContent, el.querySelector('.copy').dataset.copy]
        : el.textContent);
    }), [
      '源码写法：',
      ['text', '```python\nprint("Hello, world!")\n```', '```python\nprint("Hello, world!")\n```'],
      '实际效果：',
      ['python', 'print("Hello, world!")', 'print("Hello, world!")'],
      '复制代码时，只复制代码块里面的内容，不要把上下两行三个反引号一起复制。',
    ]);
    await page.locator('#chapters .chapter.active').click();
    assert.equal(await page.locator('#sidebar').isVisible(), true);
    assert.equal(await page.locator('body').evaluate(el => el.classList.contains('sidebar-closed')), false);

    await page.locator('#theme').click();
    assert.deepEqual(await page.evaluate(() => {
      const style = getComputedStyle(document.body);
      return [style.backgroundColor, style.color, style.transitionDuration];
    }), ['rgb(17, 26, 39)', 'rgb(231, 238, 248)', '0s']);
    await page.reload();
    await page.waitForFunction(() => !!current);
    assert.equal(await page.locator('body').evaluate(el => el.classList.contains('dark')), true);
    await page.locator('#theme').click();
    assert.equal(await page.locator('body').evaluate(el => getComputedStyle(el).backgroundColor), 'rgb(244, 247, 252)');

    await page.locator('#close-menu').click();
    assert.equal(await page.locator('#sidebar').isVisible(), false);
    assert.equal(await page.locator('.shell').evaluate(el => getComputedStyle(el).marginLeft), '0px');
    await page.locator('#menu').click();
    assert.equal(await page.locator('#sidebar').isVisible(), true);
    assert.equal(await page.locator('#menu').getAttribute('aria-expanded'), 'true');

    for (const i of [0, 1, 2]) {
      await page.locator('#toc a').nth(i).click();
      await page.waitForFunction(i => Math.abs(document.getElementById('section-' + i).getBoundingClientRect().top - 100) < 1, i);
      assert.equal(new URLSearchParams(new URL(page.url()).hash.slice(1)).get('section'), 'section-' + i);
    }
    await page.reload();
    await page.waitForFunction(() => !!current);
    await page.waitForFunction(() => Math.abs(document.getElementById('section-2').getBoundingClientRect().top - 100) < 1);
    await page.evaluate(() => { location.hash = chapterHash(current.path, $('section-0').dataset.slug); });
    await page.waitForFunction(() => Math.abs(document.getElementById('section-0').getBoundingClientRect().top - 100) < 1);

    await page.emulateMedia({ reducedMotion: 'reduce' });
    assert.deepEqual(await page.evaluate(() => {
      const failures = [];
      for (const chapter of chapters) {
        showChapter(chapter.path);
        for (const link of $('toc').querySelectorAll('a')) {
          const heading = document.getElementById(link.hash.slice(1));
          const target = heading.getBoundingClientRect().top + scrollY - 100;
          const expected = Math.max(0, Math.min(target, document.documentElement.scrollHeight - innerHeight));
          jumpSection(link.hash);
          if (Math.abs(scrollY - expected) > 1) failures.push(chapter.path + ': ' + link.textContent);
        }
      }
      return failures;
    }), []);
    await page.goto(url);
    await page.waitForFunction(() => !!current);

    // A heading slug can equal another heading's ID; repeated titles must also stay distinct.
    await page.evaluate(() => {
      $('content').innerHTML = '<h2>section 1</h2><p style="height:1000px"></p><h2>重复标题</h2><p style="height:1000px"></p><h2>重复标题</h2><p style="height:1000px"></p>';
      makeToc();
    });
    for (const i of [1, 2]) {
      await page.locator('#toc a').nth(i).click();
      await page.waitForFunction(i => Math.abs(document.getElementById('section-' + i).getBoundingClientRect().top - 100) < 1, i);
      assert.equal(new URLSearchParams(new URL(page.url()).hash.slice(1)).get('section'), 'section-' + i);
    }

    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(url);
    await page.waitForFunction(() => !!current);
    await page.locator('#menu').click();
    await page.locator('#chapters .chapter.active').click();
    assert.equal(await page.locator('#sidebar').evaluate(el => el.classList.contains('open')), true);
    assert.equal(await page.locator('#menu').getAttribute('aria-expanded'), 'true');
    await page.locator('#close-menu').click();
    await page.waitForFunction(() => document.getElementById('sidebar').getBoundingClientRect().right <= 0);
    assert.equal(await page.locator('#menu').getAttribute('aria-expanded'), 'false');
    await page.locator('#menu').click();
    await page.locator('#backdrop').click({ position: { x: 380, y: 500 } });
    await page.waitForFunction(() => document.getElementById('sidebar').getBoundingClientRect().right <= 0);
    await page.locator('.mobile-outline summary').click();
    await page.locator('#mobile-toc a').nth(1).click();
    await page.waitForFunction(() => Math.abs(document.getElementById('section-1').getBoundingClientRect().top - 100) < 1);
    await page.locator('#menu').click();
    const activePath = await page.evaluate(() => current.path);
    const original = fs.readFileSync(path.join(fixture, activePath), 'utf8');
    const position = await page.evaluate(() => scrollY);
    fs.writeFileSync(path.join(fixture, activePath), original + '\n\n实时更新验证。\n');
    await page.waitForFunction(() => $('content').textContent.includes('实时更新验证。'));
    assert.equal(await page.locator('#sidebar').evaluate(el => el.classList.contains('open')), true);
    assert.ok(Math.abs(await page.evaluate(() => scrollY) - position) < 1);
    fs.writeFileSync(path.join(fixture, '0 准备开始/0-99 新增.md'), '# 0-99 动态新增\n\n## 内容\n新正文');
    await page.waitForFunction(() => chapters.some(ch => ch.title === '动态新增'));
    fs.renameSync(path.join(fixture, '0 准备开始/0-99 新增.md'), path.join(fixture, '0 准备开始/0-100 改名.md'));
    await page.waitForFunction(() => chapters.some(ch => ch.path.endsWith('0-100 改名.md')) && !chapters.some(ch => ch.path.endsWith('0-99 新增.md')));
    fs.unlinkSync(path.join(fixture, '0 准备开始/0-100 改名.md'));
    await page.waitForFunction(() => !chapters.some(ch => ch.path.endsWith('0-100 改名.md')));
    fs.writeFileSync(path.join(fixture, '0 准备开始/0-99 建设中.md'), '# 0-99 建设中');
    await page.evaluate(() => refreshChapters());
    assert.equal(await page.evaluate(() => chapters.some(ch => ch.path.endsWith('0-99 建设中.md'))), false);
    fs.unlinkSync(path.join(fixture, activePath));
    await page.waitForFunction(activePath => current && current.path !== activePath, activePath);
    assert.equal(await page.locator('#mark-read').isEnabled(), true);
    const displayed = await page.locator('#content').textContent();
    await page.route('**/api/chapters', route => route.abort());
    await page.evaluate(() => refreshChapters());
    assert.equal(await page.locator('#content').textContent(), displayed);
    await page.unroute('**/api/chapters');
    await page.evaluate(() => refreshChapters());
    await page.waitForFunction(() => !connectionFailed);
    for (const chapter of await page.evaluate(() => chapters.map(ch => ch.path))) fs.unlinkSync(path.join(fixture, chapter));
    await page.waitForFunction(() => !current && !chapters.length);
    assert.equal(await page.locator('#mark-read').isEnabled(), false);
    assert.equal(await page.locator('#completion-bar').evaluate(el => el.style.width), '0%');
    await page.goto(pathToFileURL(path.join(fixture, 'index.html')).href);
    assert.equal(await page.locator('#article-title').textContent(), '请通过启动入口打开');
    assert.deepEqual(errors, []);
    console.log('Passed: reader regressions, live edits/additions/renames/deletions, sidebar and position preserved, reconnection, empty catalog, no code dependency.');
  } finally {
    if (browser) await browser.close();
    if (server) server.kill();
    assert.equal(path.dirname(path.resolve(fixture)), path.resolve(os.tmpdir()));
    fs.rmSync(fixture, { recursive: true, force: true });
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
