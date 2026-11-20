/**
 * dsh-express-cards — 结构化表达插件的 Host 侧。
 *
 * 职责：向 systemPrompt 注册一节「回复表达纪律」，教模型结论先行、分段、
 * 用表格/列表承载信息，并用 `expresscard` 代码块输出结构化卡片摘要。
 * 卡片渲染由 Client 侧（client.js）在 `conversation.chat.markdown.fence`
 * 槽完成；解析失败时自动退回普通代码块，内容不丢失。
 *
 * 配置（cordis.patch.yml 行内 config，无 schema，带手动默认值）：
 * - enabled：总开关，默认 true，关闭后不再注入表达纪律。
 * - instruction：注入的纪律文本，默认 DEFAULT_INSTRUCTION。
 * 刻意不依赖 schemastery：本地目录链接安装时无法从源码目录解析依赖。
 */
export const SECTION_NAME = 'express-format'

/** 默认表达纪律文本（中文，紧凑）。 */
export const DEFAULT_INSTRUCTION = [
  '## 回复表达纪律（结构化表达插件）',
  '',
  '- 简单问题直接回答：不要开场白、不要客套、不要结尾总结。',
  '- 信息量大的回答：结论先行；按主题分小节；对比或多字段数据用 Markdown 表格；',
  '  流程用有序列表；并列要点用无序列表；段落之间留空行。',
  '- 值得突出的核心结论、步骤、指标或提示，用 `expresscard` 代码块输出卡片摘要',
  '  （细节仍写正文）：',
  '  ```expresscard',
  '  {"title":"…","kind":"conclusion","body":"…"}',
  '  ```',
  '  `kind` 可选：`conclusion`（结论）、`steps`（步骤，用 `items` 字符串数组）、',
  '  `metrics`（指标，用 `metrics` 数组，每项 `{"label":"…","value":"…"}`）、',
  '  `note`（提示）。可选 `columns`: 2 或 3 开启卡片内多列（列表分栏、指标并排）；',
  '  指标 ≥4 条会自动两列。',
  '  需要多张卡片并排时用卡片组：`{"columns":2,"cards":[{"title":"…"},{"title":"…"}]}`，',
  '  组内每张卡片与单卡片同构，最多 3 列、窄屏自动回退单列。',
  '  URL 会渲染成可点击链接（点击在右侧内置浏览器打开）。JSON 需合法；',
  '  解析失败会自动显示为普通代码块，不影响内容完整性。',
  '- 卡片只承载摘要，一个回答最多 2-3 张；不要把琐碎的小答案也装进卡片。',
  '- 多字段数据对比一律用 Markdown 表格；表格能表达清楚时不要用卡片，',
  '  卡片内容不得与表格重复。',
  '- 长回答结尾可附「下一步」行动项。',
].join('\n')

/** 提示词注册表服务。 */
export const inject = ['systemPrompt']

/**
 * 注册表达纪律节。放在 persona suffix 之后（输出规则最后看到），
 * 顺序用系统分配的锚点计算，避免与未来版本漂移。
 * 不导出 Config schema：零运行时依赖，config 用默认值补齐。
 */
export function apply(ctx, config = {}) {
  const enabled = config.enabled !== false
  const instruction = typeof config.instruction === 'string' && config.instruction.trim() !== ''
    ? config.instruction
    : DEFAULT_INSTRUCTION
  ctx.effect(() => {
    if (!enabled) return
    return ctx.systemPrompt.section({
      name: SECTION_NAME,
      order: ctx.systemPrompt.getSectionOrder('DEPLOYMENT_PERSONA_SUFFIX') + 50,
      text: instruction,
    })
  }, 'express-cards.section')
}
