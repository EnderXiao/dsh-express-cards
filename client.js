/**
 * dsh-express-cards — Client 侧（Web / Desktop 内嵌页面）。
 *
 * 在 `conversation.chat.markdown.fence` 槽注册 `expresscard` 语言层：
 * - 流式（streaming）：原样渲染 children（普通代码块）。
 * - 解析成功：替换为结构化卡片（结论/步骤/指标/提示），附「原文」切换。
 * - 解析失败：渲染 children + 一行提示，内容零丢失。
 *
 * 采用 dsh-plugin-memory 同款模块形态（module/exports + exports.apply），
 * 每个注册独立 try/catch，任一失败不影响其余能力与宿主聊天。
 */
window.__ModuleLoader__.load({
  id: 'dsh-express-cards',
  factory: (require) => {
    var module = { exports: {} }
    var exports = module.exports
    const React = require('react')
    const h = React.createElement
    const { useMemo, useState } = React

    const CARD_KINDS = ['conclusion', 'steps', 'metrics', 'note']
    const LOCALE_NS = 'express'

    /** 解析单张卡片；不合规返回 null。 */
    function parseSingle(data) {
      if (typeof data !== 'object' || data === null || Array.isArray(data)) return null
      const title = typeof data.title === 'string' ? data.title.trim() : ''
      if (!title) return null
      const kind = CARD_KINDS.includes(data.kind) ? data.kind : 'note'
      const body = typeof data.body === 'string' ? data.body.trim() : ''
      // columns：可选 2/3，控制卡片内部列表分栏与指标并排。
      const requested = Number(data.columns)
      const columns = requested === 2 || requested === 3 ? requested : 0
      const items = kind === 'steps' && Array.isArray(data.items)
        ? data.items.filter(x => typeof x === 'string').map(x => x.trim()).filter(Boolean)
        : []
      const metrics = kind === 'metrics' && Array.isArray(data.metrics)
        ? data.metrics
            .filter(x => x && typeof x === 'object' && !Array.isArray(x))
            .map(x => ({ label: String(x.label ?? '').trim(), value: String(x.value ?? '').trim() }))
            .filter(x => x.label || x.value)
        : []
      if (!body && items.length === 0 && metrics.length === 0) return null
      // 未显式指定列数时：指标 ≥4 条自动两列，否则单列。
      const resolvedColumns = columns || (metrics.length >= 4 ? 2 : 0)
      return { title, kind, body, items, metrics, columns: resolvedColumns }
    }

    /**
     * 解析卡片 JSON，支持两种形态：
     * - 单卡片：`{title, kind, body|items|metrics, columns?}`
     * - 卡片组：`{cards: [...], columns: 2|3}` → 多张卡片并排（卡片级多列）
     * 任何不合规内容返回 null（回退普通代码块）。
     */
    function parseCard(code) {
      let data
      try { data = JSON.parse(code) } catch { return null }
      if (typeof data !== 'object' || data === null || Array.isArray(data)) return null

      if (Array.isArray(data.cards)) {
        const cards = data.cards.map(parseSingle).filter(Boolean)
        if (cards.length === 0) return null
        const requested = Number(data.columns)
        const columns = requested === 3 ? 3 : requested === 2 ? 2 : Math.min(cards.length, 2)
        return { group: true, cards, columns }
      }
      return parseSingle(data)
    }

    const DICTS = {
      zh: {
        raw: '原文',
        card: '返回卡片',
        parseFailed: '卡片解析失败，已显示原文。',
        copied: '已复制：',
        kindConclusion: '结论',
        kindSteps: '步骤',
        kindMetrics: '指标',
        kindNote: '提示',
      },
      en: {
        raw: 'Raw',
        card: 'Back to card',
        parseFailed: 'Card could not be parsed; showing the raw block.',
        copied: 'Copied:',
        kindConclusion: 'Conclusion',
        kindSteps: 'Steps',
        kindMetrics: 'Metrics',
        kindNote: 'Note',
      },
    }

    /* 只引用 Theme.listTokens 与既有聊天样式验证过的 token。
       color-mix 保证亮色主题下的文字/色条对比度（暗色主题同样达标）。 */
    const CSS = `
      .ec {
        box-sizing: border-box;
        --ec-accent: var(--dsw-alias-brand-primary);
        /* 先给出不依赖 color-mix 的兜底值：老浏览器（Chromium <111、
           Safari <16.2）会忽略下一条声明，徽标仍可读。 */
        --ec-ink: var(--dsw-alias-label-primary);
        --ec-ink: color-mix(in srgb, var(--ec-accent) 55%, var(--dsw-alias-label-primary));
        border: 1px solid var(--dsw-alias-border-l2);
        border-left: 3px solid var(--ec-ink);
        border-radius: var(--dsw-radius-sm);
        background: var(--dsw-alias-bg-layer-1);
        background: color-mix(in srgb, var(--ec-accent) 4%, var(--dsw-alias-bg-layer-1));
        padding: 10px 12px;
        font-size: var(--dsh-content-font-size, 14px);
        line-height: calc(24px + var(--dsh-content-font-delta, 0px));
        color: var(--dsw-alias-label-primary);
        overflow-wrap: anywhere;
      }
      .ec-conclusion { --ec-accent: var(--dsw-alias-state-success-primary); }
      .ec-steps { --ec-accent: var(--dsw-static-blue-500); }
      .ec-metrics { --ec-accent: var(--dsw-alias-state-warn-primary); }
      .ec-note { --ec-accent: var(--dsw-alias-brand-primary); }
      .ec-head { display: flex; align-items: center; gap: 8px; margin-bottom: 6px; }
      .ec-kind {
        flex: none; font-size: 11px; line-height: 16px; padding: 1px 6px;
        border-radius: var(--dsw-radius-sm);
        border: 1px solid var(--ec-ink);
        color: var(--ec-ink);
      }
      .ec-title { font-weight: 600; min-width: 0; overflow-wrap: anywhere; }
      .ec-toggle {
        flex: none; margin-left: auto; border: none; background: transparent;
        color: var(--dsw-alias-label-secondary);
        font-size: 11px; line-height: 18px; min-height: 24px; padding: 2px 8px;
        border-radius: var(--dsw-radius-sm); cursor: pointer;
      }
      .ec-toggle:hover {
        background: var(--dsw-alias-interactive-bg-hover);
        color: var(--dsw-alias-label-primary);
      }
      .ec-toggle:focus-visible { outline: 2px solid var(--ec-ink); outline-offset: 1px; }
      .ec-body { margin: 0; white-space: pre-wrap; }
      .ec-items { margin: 4px 0 0; padding-left: 20px; }
      .ec-items li + li { margin-top: 4px; }
      .ec-metrics {
        margin: 6px 0 0; display: grid;
        grid-template-columns: max-content 1fr; gap: 4px 14px;
      }
      .ec-metric { display: contents; }
      /* 多列布局：columns=2/3 时列表分栏、指标成对并排。
         窄屏统一回退单列，避免中文标签被压扁。 */
      .ec[data-columns="2"] .ec-items { column-count: 2; column-gap: 24px; }
      .ec[data-columns="3"] .ec-items { column-count: 3; column-gap: 20px; }
      .ec[data-columns="2"] .ec-metrics { grid-template-columns: max-content 1fr max-content 1fr; }
      .ec[data-columns="3"] .ec-metrics {
        grid-template-columns: max-content 1fr max-content 1fr max-content 1fr;
      }
      .ec[data-columns] .ec-items li { break-inside: avoid; }
      /* 卡片组：多张卡片并排（卡片级多列）。 */
      .ec-group { display: flex; flex-direction: column; gap: 6px; }
      /* 容器查询的锚点：卡片实际宽度由聊天列决定，与视口宽度无关
         （侧栏展开时列会变窄而视口不变），所以断点必须按容器算。 */
      .ec-wrap, .ec-group, .ec-cell { container-type: inline-size; }
      .ec-cell { min-width: 0; display: flex; flex-direction: column; }
      .ec-grid { display: grid; gap: 8px; }
      .ec-grid[data-columns="2"] { grid-template-columns: repeat(2, minmax(0, 1fr)); }
      .ec-grid[data-columns="3"] { grid-template-columns: repeat(3, minmax(0, 1fr)); }
      /* 组内卡片更紧凑，标题允许换行不挤压。 */
      .ec-in-grid { padding: 8px 10px; }
      .ec-in-grid .ec-title { font-size: 0.95em; }
      .ec-in-grid .ec-head { margin-bottom: 4px; }
      .ec-groupfoot { display: flex; align-items: center; }
      .ec-groupfoot .ec-toggle { margin-left: 0; }
      /* 窄容器的单列回退：容器查询优先；不支持容器查询的浏览器
         退回视口断点（保守但不会并排挤出屏幕）。 */
      @media (max-width: 720px) {
        .ec-grid[data-columns="2"],
        .ec-grid[data-columns="3"] { grid-template-columns: 1fr; }
        .ec[data-columns="2"] .ec-items,
        .ec[data-columns="3"] .ec-items { column-count: 1; }
        .ec[data-columns="2"] .ec-metrics,
        .ec[data-columns="3"] .ec-metrics { grid-template-columns: max-content 1fr; }
      }
      @container (max-width: 720px) {
        .ec-grid[data-columns="2"],
        .ec-grid[data-columns="3"] { grid-template-columns: 1fr; }
        .ec[data-columns="2"] .ec-items,
        .ec[data-columns="3"] .ec-items { column-count: 1; }
        .ec[data-columns="2"] .ec-metrics,
        .ec[data-columns="3"] .ec-metrics { grid-template-columns: max-content 1fr; }
      }
      .ec-metric dt { color: var(--dsw-alias-label-secondary); white-space: nowrap; }
      .ec-metric dd { margin: 0; min-width: 0; overflow-wrap: anywhere; }
      @media (max-width: 720px) {
        .ec-metrics { grid-template-columns: 1fr; gap: 2px; }
        .ec-metric dd { margin-bottom: 4px; }
      }
      .ec-rawbar, .ec-notice { display: flex; align-items: center; margin: 0; }
      .ec-rawbar .ec-toggle { margin-left: 0; }
      .ec-notice {
        font-size: 11px; line-height: 16px;
        color: var(--dsw-alias-label-secondary);
        padding: 2px 0 6px;
      }
      .ec-link {
        color: var(--dsw-alias-brand-primary);
        text-decoration: underline;
        text-underline-offset: 2px;
        text-decoration-thickness: 1px;
        cursor: pointer;
        overflow-wrap: anywhere;
      }
      .ec-link:hover { opacity: 0.82; }
      .ec-link:focus-visible { outline: 2px solid var(--dsw-alias-brand-primary); outline-offset: 1px; }
      .ec-copied {
        margin-top: 6px;
        font-size: 11px;
        line-height: 16px;
        color: var(--dsw-alias-state-success-primary);
        overflow-wrap: anywhere;
      }
    `

    /** 活动语言字典；取不到时回退中文。 */
    function dictFor(ctx) {
      try {
        return ctx.locale.getSnapshot().active === 'en' ? DICTS.en : DICTS.zh
      } catch {
        return DICTS.zh
      }
    }

    /* 宿主 markdown 链接的真实链路（web-frontend nK 组件）：
       普通点击 → preventDefault + openExternalLink（走用户设置：内置侧栏 / 外部浏览器）；
       带修饰键 → 不拦截，靠 target="_blank" 原生放行。
       本插件在 fence 层拿不到 openExternalLink 这个 React context，因此改走
       ctx.sidebarRight.openTab('browser', { navigation: { params: { url } } })
       —— BrowserBody 正是读 tab.navigation.params.url，http 也能开。 */
    const URL_RE = /(https?:\/\/[^\s<>()"'`]+)/g

    function copyText(text) {
      try {
        if (navigator.clipboard && navigator.clipboard.writeText) {
          return navigator.clipboard.writeText(text)
        }
      } catch { /* 落到下面的兜底 */ }
      try {
        const area = document.createElement('textarea')
        area.value = text
        area.setAttribute('readonly', '')
        area.style.position = 'fixed'
        area.style.opacity = '0'
        document.body.appendChild(area)
        area.select()
        document.execCommand('copy')
        area.remove()
      } catch { /* 复制失败时保留右键复制链接 */ }
      return Promise.resolve()
    }

    /**
     * 在右侧栏内置浏览器打开 URL。
     *
     * `ctx.sidebarRight` 是可选服务：本插件没有把它写进 inject（否则右栏缺席时
     * 整个插件不激活），因此用 cordis 的 `ctx.get()` 做运行时取用。
     * 优先 openTabIn(sessionId, ...) 精确落到当前会话，退回 openTab(...)。
     * @returns 是否成功发起打开（取不到服务或抛错时为 false）。
     */
    function openInSidebarBrowser(ctx, url, sessionId) {
      try {
        const sidebarRight = typeof ctx.get === 'function' ? ctx.get('sidebarRight') : ctx.sidebarRight
        if (!sidebarRight) return false
        // SidebarRightOpenTabOptions 的 params 是扁平的；
        // 服务内部再包装成 tab.navigation.params 交给 BrowserBody。
        const options = { params: { url } }
        if (sessionId !== undefined && typeof sidebarRight.openTabIn === 'function') {
          sidebarRight.openTabIn(sessionId, 'browser', options)
          return true
        }
        if (typeof sidebarRight.openTab === 'function') {
          sidebarRight.openTab('browser', options)
          return true
        }
        return false
      } catch (error) {
        console.warn('[express-cards] opening the sidebar browser failed', error)
        return false
      }
    }

    /** 把纯文本里的 URL 渲染成可点击链接，返回 React 节点数组。 */
    function linkify(text, keyPrefix, ctx, onCopied, sessionId) {
      const parts = String(text).split(URL_RE)
      return parts.map((part, i) => {
        if (i % 2 === 0) return part
        const url = part
        return h('a', {
          key: keyPrefix + i,
          href: url,
          className: 'ec-link',
          // https 才允许 target=_blank 生效（Electron 外部浏览器策略）。
          ...(url.startsWith('https://') ? { target: '_blank', rel: 'noopener noreferrer' } : {}),
          title: url,
          onClick: event => {
            // 带修饰键：不拦截，交给 target=_blank / 宿主原生行为。
            if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return
            event.preventDefault()
            event.stopPropagation()
            if (openInSidebarBrowser(ctx, url, sessionId)) return
            // 内置浏览器不可用：https 退回系统浏览器，其余复制。
            if (url.startsWith('https://')) {
              window.open(url, '_blank', 'noopener,noreferrer')
              return
            }
            copyText(url).then(() => onCopied(url))
          },
        }, url)
      })
    }

    function makeExpressCard(ctx) {
      return function ExpressCard(props) {
        const { code, streaming, children } = props
        // fence 槽的 standardProps 带 sessionId：内置浏览器按会话精确打开。
        const sessionId = props.sessionId
        // 每次渲染取当前语言，切换语言后卡片标签跟着变。
        const t = dictFor(ctx)
        const [showRaw, setShowRaw] = useState(false)
        const [copied, setCopied] = useState('')
        const card = useMemo(() => (streaming ? null : parseCard(code)), [streaming, code])
        const kindLabel = kind => t['kind' + kind[0].toUpperCase() + kind.slice(1)] ?? kind
        const onCopied = url => {
          setCopied(url)
          window.setTimeout(() => setCopied(''), 1600)
        }

        /** 渲染一张卡片（不含外层网格）。 */
        const renderCard = (item, opts = {}) => {
          const { withRaw = true, grid = false, index = 0 } = opts
          return h('section', {
            key: 'card' + index,
            className: 'ec ec-' + item.kind + (grid ? ' ec-in-grid' : ''),
            'data-expresscard-kind': item.kind,
            ...(item.columns ? { 'data-columns': String(item.columns) } : {}),
            'aria-label': item.title,
          },
            h('header', { className: 'ec-head' },
              h('span', { className: 'ec-kind' }, kindLabel(item.kind)),
              h('span', { className: 'ec-title' }, item.title),
              withRaw
                ? h('button', {
                    type: 'button', className: 'ec-toggle',
                    'aria-label': t.raw,
                    onClick: () => setShowRaw(true),
                  }, t.raw)
                : null,
            ),
            item.body ? h('p', { className: 'ec-body' }, linkify(item.body, 'b' + index, ctx, onCopied, sessionId)) : null,
            item.items.length > 0
              ? h('ol', { className: 'ec-items' },
                  item.items.map((text, i) => h('li', { key: i }, linkify(text, 'i' + index + '_' + i, ctx, onCopied, sessionId))))
              : null,
            item.metrics.length > 0
              ? h('dl', { className: 'ec-metrics' },
                  item.metrics.map((m, i) => h('div', { className: 'ec-metric', key: i },
                    h('dt', null, m.label),
                    h('dd', null, linkify(m.value, 'm' + index + '_' + i, ctx, onCopied, sessionId)))))
              : null,
          )
        }

        const copiedLine = copied
          ? h('div', { className: 'ec-copied' }, t.copied + ' ' + copied)
          : null

        // 流式：原样代码块。
        if (streaming) return children

        // 解析失败：原文 + 提示行，内容零丢失。
        if (!card) {
          return h('div', null,
            h('div', { className: 'ec-notice' }, t.parseFailed),
            children,
          )
        }

        // 原文视图：工具条 + 代码块，不套卡片镶边。
        if (showRaw) {
          return h('div', null,
            h('div', { className: 'ec-rawbar' },
              h('button', {
                type: 'button', className: 'ec-toggle',
                onClick: () => setShowRaw(false),
              }, t.card)),
            children,
          )
        }

        // 卡片组：多张卡片并排（卡片级多列）。
        if (card.group) {
          return h('div', { className: 'ec-group' },
            h('div', {
              className: 'ec-grid',
              'data-columns': String(card.columns),
            }, card.cards.map((item, i) => h('div', { className: 'ec-cell', key: 'cell' + i },
              renderCard(item, { withRaw: false, grid: true, index: i })))),
            h('div', { className: 'ec-groupfoot' },
              h('button', {
                type: 'button', className: 'ec-toggle',
                'aria-label': t.raw,
                onClick: () => setShowRaw(true),
              }, t.raw),
            ),
            copiedLine,
          )
        }

        return h('div', { className: 'ec-wrap' },
          renderCard(card),
          copiedLine,
        )
      }
    }

    function apply(ctx) {
      // 语言：一次注册整包字典（与 dsh-plugin-memory 同款形态）。
      try {
        ctx.effect(() => ctx.locale.register(LOCALE_NS, DICTS), 'express: dictionaries')
      } catch (error) {
        console.warn('[express-cards] locale register failed', error)
      }

      // 样式只用 CSS 变量，页面内不需要作用域隔离。
      try {
        ctx.effect(() => {
          if (typeof document === 'undefined') return undefined
          const tag = document.createElement('style')
          tag.setAttribute('data-express-cards', '')
          tag.textContent = CSS
          document.head.appendChild(tag)
          return () => tag.remove()
        }, 'express: styles')
      } catch (error) {
        console.warn('[express-cards] style inject failed', error)
      }

      // 卡片层：宿主 fence 槽按语言派发，key 必须是 expresscard。
      try {
        const ExpressCard = makeExpressCard(ctx)
        ctx.slots.inject('conversation.chat.markdown.fence', () => ctx.slots.register({
          name: 'conversation.chat.markdown.fence',
          id: 'express-card-layer',
          key: 'expresscard',
        }, ExpressCard))
      } catch (error) {
        console.warn('[express-cards] fence slot register failed', error)
      }
    }

    exports.apply = apply
    exports.inject = ['slots', 'locale']
    return module.exports
  },
})
