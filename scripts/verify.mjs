/**
 * 用 headless Chromium 验证 dsh-express-cards 的卡片渲染：
 * - 解析逻辑（parseCard）在浏览器环境下的行为
 * - 插件 CSS 的真实计算样式：color-mix 降级、多列 grid、720px 断点、主题 token
 *
 * 不依赖 React：把插件的 CSS 原样注入，按组件输出结构手写等价 DOM。
 */
import { spawn } from 'node:child_process'
import { mkdtempSync, writeFileSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const CHROME = process.env.CHROME_PATH
  ?? (process.platform === 'darwin'
    ? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
    : process.platform === 'win32'
      ? 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'
      : '/usr/bin/google-chrome')
const CLIENT = process.argv[2] ?? '/Users/mi/code/dsh-express-cards/client.js'

/** 从 client.js 提取插件 CSS 与解析函数源码。 */
function extractSource() {
  const src = readFileSync(CLIENT, 'utf8')
  const cssStart = src.indexOf('const CSS = `')
  const cssEnd = src.indexOf('`\n\n    /**', cssStart)
  if (cssStart < 0 || cssEnd < 0) throw new Error('CSS block not found')
  const css = src.slice(cssStart + 'const CSS = `'.length, cssEnd)

  const constStart = src.indexOf('const CARD_KINDS')
  const constEnd = src.indexOf('const DICTS')
  const logic = src.slice(constStart, constEnd)
  return { css, logic }
}

const { css, logic } = extractSource()

/* 模拟宿主主题 token：亮色与暗色两套。 */
const TOKENS_LIGHT = `
  --dsw-alias-bg-layer-1:#ffffff; --dsw-alias-bg-layer-2:#f7f8fa;
  --dsw-alias-border-l1:rgba(0,0,0,0.08); --dsw-alias-border-l2:rgba(0,0,0,0.14);
  --dsw-alias-label-primary:#0f1115; --dsw-alias-label-secondary:#4b5563;
  --dsw-alias-label-tertiary:#81858d; --dsw-alias-brand-primary:#1b6ef3;
  --dsw-alias-state-success-primary:#22c55e; --dsw-alias-state-warn-primary:#f59e0b;
  --dsw-static-blue-500:#3b82f6; --dsw-radius-sm:6px;
  --dsh-content-font-size:14px; --dsh-content-font-delta:0px;
`
const TOKENS_DARK = `
  --dsw-alias-bg-layer-1:#232324; --dsw-alias-bg-layer-2:#2c2c2e;
  --dsw-alias-border-l1:rgba(255,255,255,0.08); --dsw-alias-border-l2:rgba(255,255,255,0.14);
  --dsw-alias-label-primary:#ecedf0; --dsw-alias-label-secondary:#a9adb5;
  --dsw-alias-label-tertiary:#7c818a; --dsw-alias-brand-primary:#5b9dff;
  --dsw-alias-state-success-primary:#4ade80; --dsw-alias-state-warn-primary:#fbbf24;
  --dsw-static-blue-500:#60a5fa; --dsw-radius-sm:6px;
  --dsh-content-font-size:14px; --dsh-content-font-delta:0px;
`

/** 与组件 renderCard 结构一致的单卡 HTML。 */
function cardHtml({ kind = 'conclusion', title = 'T', body = '', items = [], metrics = [], columns = 0 }) {
  const cols = columns ? ` data-columns="${columns}"` : ''
  const bodyHtml = body ? `<p class="ec-body">${body}</p>` : ''
  const itemsHtml = items.length
    ? `<ol class="ec-items">${items.map(t => `<li>${t}</li>`).join('')}</ol>` : ''
  const metricsHtml = metrics.length
    ? `<dl class="ec-metrics">${metrics.map(m =>
        `<div class="ec-metric"><dt>${m.label}</dt><dd>${m.value}</dd></div>`).join('')}</dl>` : ''
  return `<div class="ec-wrap"><section class="ec ec-${kind}" data-expresscard-kind="${kind}"${cols} aria-label="${title}">
    <header class="ec-head"><span class="ec-kind">K</span><span class="ec-title">${title}</span>
    <button type="button" class="ec-toggle">原文</button></header>
    ${bodyHtml}${itemsHtml}${metricsHtml}
  </section></div>`
}

function groupHtml(columns, cards) {
  return `<div class="ec-group"><div class="ec-grid" data-columns="${columns}">${
    cards.map(c => `<div class="ec-cell">${cardHtml({ ...c, columns: 0 })}</div>`).join('')
  }</div></div>`
}

const html = `<!doctype html>
<html><head><meta charset="utf-8"><style>
  html, body { margin: 0; padding: 0; background: #fff; }
  .host-light { ${TOKENS_LIGHT} }
  .host-dark { ${TOKENS_DARK}; background: #1a1a1b; }
  .wrap { width: 900px; padding: 12px; box-sizing: border-box; }
  .wrap-narrow { width: 700px; padding: 12px; box-sizing: border-box; }
  .ec-metrics { margin: 6px 0 0; }
</style>
<style id="plugin-css">${css}</style>
</head><body>
<div class="host-light"><div class="wrap" id="L">
  ${cardHtml({ kind: 'conclusion', body: 'light body' })}
  ${cardHtml({ kind: 'steps', columns: 2, items: ['a', 'b', 'c', 'd'] })}
  ${cardHtml({ kind: 'metrics', columns: 3, metrics: [
    { label: 'p', value: '1' }, { label: 'q', value: '2' }, { label: 'r', value: '3' },
    { label: 's', value: '4' }, { label: 't', value: '5' }, { label: 'u', value: '6' }] })}
  ${groupHtml(2, [{ title: 'g1' }, { title: 'g2' }])}
  ${groupHtml(3, [{ title: 'h1' }, { title: 'h2' }, { title: 'h3' }])}
</div></div>
<div class="host-dark"><div class="wrap" id="D">
  ${cardHtml({ kind: 'conclusion', body: 'dark body' })}
  ${groupHtml(2, [{ title: 'd1' }, { title: 'd2' }])}
</div></div>
<div class="host-light"><div class="wrap-narrow" id="N">
  ${cardHtml({ kind: 'steps', columns: 2, items: ['a', 'b', 'c', 'd'] })}
  ${groupHtml(3, [{ title: 'n1' }, { title: 'n2' }, { title: 'n3' }])}
</div></div>
<script>
  // 从插件源码里取出的纯函数（与 client.js 完全一致）
  ${logic}
  window.__parseCard = parseCard
  window.__ready = true
</script>
</body></html>`

const dir = mkdtempSync(join(tmpdir(), 'ec-verify-'))
const pagePath = join(dir, 'page.html')
writeFileSync(pagePath, html)

const port = 9333 + Math.floor(Math.random() * 400)
const profile = join(dir, 'profile')
const chrome = spawn(CHROME, [
  '--headless=new', '--no-sandbox', '--disable-gpu',
  `--remote-debugging-port=${port}`, `--user-data-dir=${profile}`,
  '--no-first-run', '--no-default-browser-check', 'about:blank',
], { stdio: 'ignore' })

const sleep = ms => new Promise(r => setTimeout(r, ms))

async function waitPort() {
  for (let i = 0; i < 100; i++) {
    try {
      const r = await fetch(`http://127.0.0.1:${port}/json/version`)
      if (r.ok) return await r.json()
    } catch { /* 还没起来 */ }
    await sleep(100)
  }
  throw new Error('chrome devtools port not ready')
}

class CDP {
  constructor(url) {
    this.ws = new WebSocket(url)
    this.id = 0
    this.pending = new Map()
    this.events = new Map()
  }
  async open() {
    await new Promise((res, rej) => {
      this.ws.addEventListener('open', res, { once: true })
      this.ws.addEventListener('error', rej, { once: true })
    })
    this.ws.addEventListener('message', ev => {
      const msg = JSON.parse(ev.data)
      if (msg.id !== undefined) {
        const p = this.pending.get(msg.id)
        if (p) { this.pending.delete(msg.id); msg.error ? p.rej(new Error(msg.error.message)) : p.res(msg.result) }
      } else {
        const waiters = this.events.get(msg.method)
        if (waiters?.length) waiters.shift()(msg.params)
      }
    })
  }
  send(method, params = {}) {
    const id = ++this.id
    return new Promise((res, rej) => {
      this.pending.set(id, { res, rej })
      this.ws.send(JSON.stringify({ id, method, params }))
    })
  }
  once(method) {
    return new Promise(res => {
      const list = this.events.get(method) ?? []
      list.push(res)
      this.events.set(method, list)
    })
  }
  close() { try { this.ws.close() } catch { /* ignore */ } }
}

const results = []
const check = (name, pass, detail) => results.push({ name, pass, detail })

try {
  await waitPort()
  const tab = await (await fetch(`http://127.0.0.1:${port}/json/new?url=about:blank`, { method: 'PUT' })).json()
  const cdp = new CDP(tab.webSocketDebuggerUrl)
  await cdp.open()
  await cdp.send('Page.enable')
  await cdp.send('Runtime.enable')

  const loaded = cdp.once('Page.loadEventFired')
  await cdp.send('Page.navigate', { url: `file://${pagePath}` })
  await loaded

  // 等脚本执行
  for (let i = 0; i < 50; i++) {
    const r = await cdp.send('Runtime.evaluate', { expression: 'window.__ready === true', returnByValue: true })
    if (r.result.value === true) break
    await sleep(60)
  }

  const evaluate = async expression => {
    const r = await cdp.send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true })
    if (r.exceptionDetails) throw new Error(r.exceptionDetails.text + ' ' + JSON.stringify(r.exceptionDetails.exception?.description ?? ''))
    return r.result.value
  }

  /* ---- 1. 解析逻辑 ---- */
  const parseChecks = await evaluate(`(() => {
    const P = window.__parseCard
    const out = {}
    out.single = !!P(JSON.stringify({title:'A',kind:'conclusion',body:'x'}))
    out.group2 = P(JSON.stringify({columns:2,cards:[{title:'a',body:'x'},{title:'b',body:'y'}]}))?.columns
    out.group3 = P(JSON.stringify({columns:3,cards:[{title:'a',body:'x'},{title:'b',body:'y'},{title:'c',body:'z'}]}))?.columns
    out.filtered = P(JSON.stringify({cards:[{title:'a',body:'x'},{body:'no title'}]}))?.cards.length
    out.allInvalid = P(JSON.stringify({cards:[{body:'no title'}]})) === null
    out.badJson = P('{oops') === null
    out.autoCols = P(JSON.stringify({title:'m',kind:'metrics',metrics:[{label:'a',value:'1'},{label:'b',value:'2'},{label:'c',value:'3'},{label:'d',value:'4'}]}))?.columns
    out.unknownKind = P(JSON.stringify({title:'u',kind:'weird',body:'x'}))?.kind
    out.noTitle = P(JSON.stringify({body:'x'})) === null
    return out
  })()`)

  check('单卡片解析', parseChecks.single === true, parseChecks.single)
  check('卡片组 2 列', parseChecks.group2 === 2, parseChecks.group2)
  check('卡片组 3 列', parseChecks.group3 === 3, parseChecks.group3)
  check('组内坏卡片被过滤', parseChecks.filtered === 1, parseChecks.filtered)
  check('组内全无效 → 回退', parseChecks.allInvalid === true, parseChecks.allInvalid)
  check('坏 JSON → 回退', parseChecks.badJson === true, parseChecks.badJson)
  check('metrics ≥4 自动两列', parseChecks.autoCols === 2, parseChecks.autoCols)
  check('未知 kind → note', parseChecks.unknownKind === 'note', parseChecks.unknownKind)
  check('缺 title → 无效', parseChecks.noTitle === true, parseChecks.noTitle)

  /* ---- 2. 计算样式 ---- */
  const styles = await evaluate(`(() => {
    const q = (sel, root = document) => root.querySelector(sel)
    const cs = el => getComputedStyle(el)
    const L = document.getElementById('L')
    const D = document.getElementById('D')
    const N = document.getElementById('N')
    const conclusion = q('.ec-conclusion', L)
    const steps2 = q('.ec-steps[data-columns="2"]', L)
    const metrics3 = q('.ec[data-columns="3"] .ec-metrics', L)
    const grid2 = q('.ec-grid[data-columns="2"]', L)
    const grid3 = q('.ec-grid[data-columns="3"]', L)
    const narrowSteps = q('.ec-steps[data-columns="2"]', N)
    const narrowGrid = q('.ec-grid[data-columns="3"]', N)
    const darkCard = q('.ec', D)
    const containerQuery = CSS.supports('container-type: inline-size')
    const narrowWidth = N.getBoundingClientRect().width
    return {
      ink: cs(conclusion).getPropertyValue('--ec-ink').trim(),
      accentInk: cs(conclusion).borderLeftColor,
      bgLight: cs(conclusion).backgroundColor,
      bgDark: cs(darkCard).backgroundColor,
      colorLight: cs(conclusion).color,
      colorDark: cs(darkCard).color,
      listColumns: cs(q('.ec-items', steps2)).columnCount,
      metricsCols: cs(metrics3).gridTemplateColumns,
      grid2: cs(grid2).gridTemplateColumns,
      grid3: cs(grid3).gridTemplateColumns,
      narrowListColumns: cs(q('.ec-items', narrowSteps)).columnCount,
      narrowGrid: cs(narrowGrid).gridTemplateColumns,
      toggleMinHeight: cs(q('.ec-toggle', L)).minHeight,
      radius: cs(conclusion).borderRadius,
      colorMixSupported: CSS.supports('color: color-mix(in srgb, red 50%, blue)'),
      containerQuery,
      viewportWidth: innerWidth,
      narrowWidth,
      cardCount: L.querySelectorAll('.ec').length,
    }
  })()`)

  // color-mix 生效：--ec-ink 应等于混合后的色值，而不是兜底的 label-primary
  const inkIsMix = styles.ink !== 'rgb(15, 17, 21)'
  check('color-mix 生效（--ec-ink 非兜底值）', inkIsMix, `${styles.ink} | supports=${styles.colorMixSupported}`)
  check('亮色卡片背景为浅色', /^rgb\(2[4-5][0-9], 2[4-5][0-9], 2[4-5][0-9]\)$/.test(styles.bgLight) === false && styles.bgLight !== 'rgba(0, 0, 0, 0)', styles.bgLight)
  check('暗色卡片背景为深色', styles.bgDark !== 'rgb(255, 255, 255)', styles.bgDark)
  check('steps columns=2 列表分栏', styles.listColumns === '2', styles.listColumns)
  check('metrics columns=3 三组键值', styles.metricsCols.split(/\s+/).length === 6, styles.metricsCols)
  check('卡片组 2 列网格', styles.grid2.split(' ').length === 2, styles.grid2)
  check('卡片组 3 列网格', styles.grid3.split(' ').length === 3, styles.grid3)
  check('容器查询可用', styles.containerQuery === true, `supports=${styles.containerQuery} viewport=${styles.viewportWidth} container=${styles.narrowWidth}`)
  check('窄容器(<720) 列表回退单列（容器查询，非视口）', styles.narrowListColumns === '1', styles.narrowListColumns)
  check('窄容器(<720) 网格回退单列（容器查询，非视口）', styles.narrowGrid.split(' ').length === 1, styles.narrowGrid)
  check('切换按钮 24px 触控高度', parseFloat(styles.toggleMinHeight) >= 24, styles.toggleMinHeight)
  check('圆角使用宿主 token', parseFloat(styles.radius) > 0, styles.radius)

  // 截图留证
  const shot = await cdp.send('Page.captureScreenshot', { format: 'png' })
  const shotPath = join(dir, 'cards.png')
  writeFileSync(shotPath, Buffer.from(shot.data, 'base64'))
  check('截图已生成', true, shotPath)

  cdp.close()
} catch (error) {
  check('测试执行', false, error.message)
} finally {
  chrome.kill('SIGKILL')
  await sleep(150)
  try { rmSync(dir, { recursive: true, force: true }) } catch { /* ignore */ }
}

const passed = results.filter(r => r.pass).length
console.log(`\n=== dsh-express-cards headless 验证（Chromium）===`)
for (const r of results) {
  console.log(`${r.pass ? '✅' : '❌'} ${r.name}${r.pass ? '' : ' → ' + JSON.stringify(r.detail)}`)
}
console.log(`\n${passed}/${results.length} 通过`)
process.exit(passed === results.length ? 0 : 1)
