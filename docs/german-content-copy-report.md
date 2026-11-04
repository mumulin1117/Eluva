# 同频动态德语文案调整（2026-11-04）

## 修改范围

仅调整 `src/data/content-messages.js` 的五个德语字段，并通过既有构建流程更新 iOS 加密 H5 资源及配套完整性参数。

| 字段 | 原文 | 调整后 |
| --- | --- | --- |
| lightUp | Aufleuchten | Aufleuchten lassen |
| lit | Erleuchtet | Leuchtet |
| reply | Antwort | Antworten |
| resonanceCount | {n} Resonanzen gefunden | {n} passende Beiträge gefunden |
| resonanceCountOne | 1 Resonanz gefunden | 1 passender Beitrag gefunden |

首页、动态详情与其他使用这些共享字段的入口同步生效。`Profil ansehen`、`Teilen` 和用户动态原文保留。未修改样式、导航、点亮状态、Reply 私信权限、登录注册或用户数据结构。

## 验证

- 对比修改前文件，仅上述五个德语字段不同；英文及其他字段一致。
- 使用实际 PostCard、ActionButton 组件及页面 CSS，检查英语、德语在 320×568、375×667、375×812、390×844、393×852、430×932 下的数量条、点亮按钮、状态标签和回复按钮。12 组控件排版检查通过，按钮文字无溢出。该检查是隔离的控件夹具，不替代完整页面或真机验收。
- `npm run build` 通过；生产资源审计及 265 项资源加密同步通过。Vite 仍有大于 500 kB 的分包体积提示，本轮未改变分包策略。
- Xcode Debug / iPhone 17 模拟器构建通过，覆盖安装 `com.eluva.app`，未卸载或清空数据。
- 实际 WKWebView 首页显示 `5 passende Beiträge gefunden`、`Aufleuchten lassen`；进入动态详情确认长按钮完整显示，并返回首页。
- 本轮没有变更输入控件或键盘逻辑，未重测键盘；未进行物理真机验证。已点亮标签和回复按钮在控件夹具验证，未为截图主动修改现有动态的点亮状态。

## 证据与复测

截图和排版结果：`docs/evidence/german-copy-2026-11-04/`。

开发者可在设置中选择 Deutsch，检查首页 0/1/多条匹配数量、未点亮详情按钮，以及既有已点亮动态的 `Leuchtet` 状态和 `Antworten` 按钮。切回 English 后仍应显示原英文。
