# dsh-express-cards

[English](README.md) | 中文

一个 DeepSeek Harness 插件，让 agent 的回复变得可扫读：往系统提示词里加一节回复格式规范，并把 `expresscard` 代码块渲染成卡片。

## 它做什么

两层，只有第一层影响模型：

| 层 | 效果 |
|---|---|
| Host（提示词） | 注册 `express-format` 系统提示词节：结论先行、分小节、对比用 Markdown 表格、流程用有序列表、并列要点用无序列表、重点用 `expresscard` 输出摘要 |
| Client（渲染） | 在 `conversation.chat.markdown.fence` 注册 `expresscard` 层，把这些代码块画成卡片 |

流式输出与 JSON 解析失败都会退回普通代码块，内容零丢失。

## 安装

```sh
dsh plugin --profile <profile> add github:EnderXiao/dsh-express-cards
```

或在 DSH 桌面端用 **设置 → 插件 → 添加插件** 安装本地目录。

安装后需要重启 DSH：客户端半是浏览器模块，要重新加载页面才生效。

## 卡片协议

语言名为 `expresscard`、内容是 JSON 的代码块：

````markdown
```expresscard
{"title":"测试通过","kind":"conclusion","body":"1327 passed，0 failed。"}
```
````

| 字段 | 含义 |
|---|---|
| `title` | 必填，卡片标题；缺失即视为无效并回退 |
| `kind` | `conclusion` · `steps` · `metrics` · `note`（默认 `note`） |
| `body` | 纯文本，保留换行 |
| `items` | 字符串数组，渲染成有序列表（`steps`） |
| `metrics` | `[{"label":"…","value":"…"}]`，渲染成标签/值行（`metrics`） |
| `columns` | `2` 或 `3`：卡片内 `items` 分栏、`metrics` 并排 |

`body`、`items`、`metrics` 至少要有一个。任何文本字段里的 URL 都会变成链接：普通点击在右侧栏内置浏览器打开，Cmd/Ctrl + 点击交给系统浏览器。

### 卡片组

把多张卡片包起来做网格布局——列数写在组上，不是每张卡片上：

```json
{"columns": 2, "cards": [
  {"title": "前端", "kind": "metrics", "metrics": [{"label": "端口", "value": "10086"}]},
  {"title": "后端", "kind": "metrics", "metrics": [{"label": "端口", "value": "3000"}]}
]}
```

组上不写 `columns` 时默认 `min(卡片数, 2)`。容器宽度小于 720px 时所有多列布局回退单列。

## 配置

插件不声明 Config schema（零运行时依赖），所以 **设置 → 插件** 只提供整行开关。要改配置，编辑 profile 的 `cordis.patch.yml`：

```yaml
- id: express-cards
  name: dsh-express-cards
  config:
    enabled: true          # false = 不注入提示词节（卡片渲染仍然有效）
    instruction: '…'       # 整体替换内置格式规范
```

禁用整行会同时停掉两半。

## 说明与限制

- 提示词是建议不是保证：模型遵循度会波动，长对话后期或上下文压缩后尤其明显。
- 卡片只在 DSH Web 界面渲染（DSH 桌面端内嵌的也是它）。复制到别处，`expresscard` 块就是普通代码块。
- 卡片只承载摘要。多字段对比应放 Markdown 表格，内置规范已明确要求模型不要用卡片重复表格内容。
- 普通点击依赖右侧栏浏览器服务；不可用时 `https:` 链接退回系统浏览器，其他协议复制到剪贴板。
- 不额外发起模型请求、不联网、不读取或上传任何数据。

## 许可证

MIT
