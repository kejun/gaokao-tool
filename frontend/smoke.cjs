const { chromium } = require('/root/.hermes/hermes-agent/node_modules/playwright');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  const errors = [];
  page.on('console', m => { if (m.type() === 'error') errors.push('[console] ' + m.text()); });
  page.on('pageerror', e => errors.push('[pageerror] ' + e.message));

  const BASE = 'http://localhost:4173';
  const results = [];
  async function check(name, url, selectors) {
    try {
      await page.goto(url, { waitUntil: 'networkidle', timeout: 15000 });
      await page.waitForTimeout(500);
      const verdicts = [];
      for (const [label, sel] of Object.entries(selectors)) {
        const count = await page.locator(sel).count();
        verdicts.push(`${label}:${count > 0 ? 'OK' : 'MISSING'}`);
      }
      results.push(`✅ ${name} (${url.split('#')[1] || '/'}) — ${verdicts.join(' | ')}`);
    } catch (e) {
      results.push(`❌ ${name} — ${e.message.split('\n')[0]}`);
    }
  }

  // 1. 首页
  await check('首页', BASE + '/#/', {
    '标题': 'h1:has-text("北京高考志愿决策助手")',
    '赋分认知卡': 'text=赋分认知',
    '倒计时': 'text=填报',
    '分数滑块': 'input[type="range"]',
    '选科按钮': 'button:has-text("物理")',
    '等效分卡片': 'text=位次区间',
    '2027选科变化': 'text=2027 选科新变化',
    '免责声明': 'text=仅供参考',
  });

  // 2. 首页交互：分数 550 → 查看可报院校
  try {
    await page.goto(BASE + '/#/', { waitUntil: 'networkidle', timeout: 15000 });
    await page.locator('input[type="range"]').fill('550');
    await page.locator('button:has-text("查看可报院校")').click();
    await page.waitForTimeout(1200);
    results.push(`✅ 首页→查询跳转 (url=${page.url().split('#')[1]})`);
  } catch (e) {
    results.push(`❌ 首页→查询跳转 — ${e.message.split('\n')[0]}`);
  }

  // 3. 院校列表
  await check('院校列表', BASE + '/#/schools?score=550', {
    '冲稳保分组': 'text=冲稳保',
    '筛选栏': 'select, [class*="filter"]',
    '院校卡': 'text=院校',
  });

  // 4. 院校详情（从列表点第一个）
  try {
    await page.goto(BASE + '/#/schools?score=550', { waitUntil: 'networkidle', timeout: 15000 });
    await page.waitForTimeout(800);
    const first = page.locator('a[href*="/school/"], [class*="card"]').first();
    if (await first.count()) {
      await first.click();
      await page.waitForTimeout(1200);
      const url = page.url();
      results.push(`✅ 列表→详情跳转 (url=${url.split('#')[1]})`);
      const hasTrend = await page.locator('text=趋势').count();
      const hasMajor = await page.locator('text=专业').count();
      results.push(`   详情页元素 — 趋势:${hasTrend > 0 ? 'OK' : 'MISSING'} | 专业表:${hasMajor > 0 ? 'OK' : 'MISSING'}`);
    } else {
      results.push(`⚠️ 列表无卡片可点`);
    }
  } catch (e) {
    results.push(`❌ 详情页 — ${e.message.split('\n')[0]}`);
  }

  // 5. Planner 志愿表沙盘
  await check('Planner', BASE + '/#/planner', {
    '标题': 'text=志愿表',
    '导出按钮': 'button:has-text("导出")',
    '配比提示': 'text=冲',
  });

  // 6. Favorites 收藏夹
  await check('Favorites', BASE + '/#/favorites', {
    '页面存在': 'body',
    '导出': 'button:has-text("导出")',
  });

  // 7. Profile 个人档案
  await check('Profile', BASE + '/#/profile', {
    '页面存在': 'body',
    '输入项': 'input',
  });

  console.log(results.join('\n'));
  console.log('---JS ERRORS---');
  if (errors.length) console.log(errors.join('\n'));
  else console.log('无 JS 错误 ✅');
  await browser.close();
})();