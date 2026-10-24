### 📢 任务修改执行报告

1. **修改了哪些文件：** `src/components/ContentShell.vue`、`src/components/PageShell.vue`、`src/views/VideoCallView.vue`、`src/content.css`、`src/styles.css`、`docs/app-flow-and-implementation-plan.md`、README、本报告及生成后的 `ios/Eluva/Web`。完整文件用途与前后哈希见 [source-files.json](evidence/language-entry-2026-10-19/source-files.json)。
2. **每个文件解决了什么问题：** ContentShell 删除全局语言按钮、弹层、状态及相关导入；PageShell 删除欢迎/认证/引导页的语言下拉框；VideoCallView 删除独立视频页面的语言按钮、弹层及未使用导入；两份样式文件清理专用语言按钮样式。实施计划记录用户确认的唯一入口，README 与本报告说明位置和验证。设置页继续复用现有选择、保存、即时切换、失败留页及返回逻辑，没有新建语言服务或改写 Native Bridge。
3. **是否影响登录注册流程：** 不改变认证逻辑、导航顺序、凭证、验证码、注册草稿或提交规则。仅移除认证页额外的语言切换控件；未登录页面继续使用系统首次匹配或用户已保存的语言。本轮实际退出/重登固定测试账号，法语与英语分别保持，均能登录。
4. **是否影响本地用户数据：** 没有数据迁移、清库或新增字段；设置保存仍只调用既有 `preferences.locale`。账户、资料、帖子、消息与关系保留。界面操作核对了保存法语立即生效、重载保持法语、选英语但返回不保存仍为法语、重新登录保持选择；最后通过唯一入口将测试预览恢复为原来的英语。
5. **是否检查了 iOS 适配和键盘交互：** Home、设置、语言设置、登录、视频演示入口完成 en/fr × 六视口，共 60 张矩阵截图；个人中心、消息、会话、他人资料和 Welcome 另有双语共 10 张补充截图。没有额外语言按钮/下拉框/语言弹层、横向溢出或缺失图片；一级页 TabBar 与二级页隐藏规则正常。没有修改键盘与 Safe Area 代码，未做真机或系统键盘复测；浏览器截图不能作为真机结论。
6. **如何测试本次修改：** `npm test` 74 项通过；本轮 2 项离屏 WKWebView 本地包测试通过（双语 12 份尺寸 DOM），它们验证欢迎/EULA 启动、字体、资源和布局，不代表原生触摸验证。Vite 生产构建、Web 资源同步、模拟器编译及无签名设备目标编译通过。dist、iOS 源 Web 包、模拟器 App 和设备 App 共四组各 213 文件 SHA-256 一致。完整结果见 [verification-summary.json](evidence/language-entry-2026-10-19/verification-summary.json)、[截图与 DOM](evidence/language-entry-2026-10-19/browser-matrix.json)、[语言闭环观察](evidence/language-entry-2026-10-19/language-flow.json)和 [构建资源哈希](evidence/language-entry-2026-10-19/resource-hashes.json)。

用户确认的页面规则

- 手动切换整个 App 界面语言的唯一入口：个人中心 → 设置 → App language / Langue de l’application。
- 启动、Welcome、登录注册、Onboarding、Home、消息、资料、发布、媒体及视频等其他页面不提供额外的全局语言按钮、下拉框或语言弹层。
- 语言设置页选项仍为 English / Français，先选择再保存；保存成功后切换并返回设置，返回而不保存不改变当前语言。
- 原有首次系统语言匹配、手动选择优先及重启/重登持久化保持有效。
- 文字翻译和语音转写中的源语言选项只作用于内容处理，不会修改 App 界面语言，因此保留，不把它们当成全局语言切换入口删除。

设计来源与范围

本轮重新读取蓝湖：`设置` ID `ca85d44a-3696-4475-9f83-2fc4fea1b5b1`，版本 1，195×450，更新时间原值 `2026-10-13T15:14:57.265859Z`；`我的` ID `78750ef7-6763-4785-bdf0-08309be4ad4c`，版本 1，195×422，更新时间原值 `2026-10-13T15:14:57.267899Z`。保存的目录及切图元数据见 [design-sources.json](evidence/language-entry-2026-10-19/design-sources.json)。本轮按用户明确指令收敛入口，保留现有设置页语言选择样式，不宣称存在新的独立语言页蓝湖稿，也不替换字体、背景或其他素材。

复测步骤

1. 用固定测试账号登录，打开 Home、消息、他人资料及视频演示入口，确认头部没有地球语言按钮；视频只进入本地演示说明页，返回会话正常，没有启动摄像头、麦克风或远端通话。
2. 个人中心 → 设置 → App language，选 Français 并保存，确认立即返回法语设置；重载、退出和重新登录后仍为法语。
3. 再进入语言页，选择 English 后直接返回，确认仍为法语；重新进入并保存 English 后才切为英语。
4. 欢迎页与登录页均无额外语言下拉框；认证、注册和引导继续继承当前语言。公共组件源检查确认没有其他组件再调用 `saveLocale`，保留 SettingsView 为唯一 UI 调用者。
5. 可运行 `npm test`、`ELUVA_EVIDENCE_DIR=docs/evidence/language-entry-2026-10-19 npm run build`，以及 Xcode Eluva scheme 的 `WebBundleTests`。历史阶段截图及哈希保持其原版本边界，不用当前构建覆盖旧证据。

未执行与限制

没有重新执行所有历史原生仓储测试，也未进行物理设备触摸、系统键盘或原生视频硬件验证；本轮不修改这些能力。原生测试退出阶段仍有 WebKit RBS / ProcessSuspension 系统日志，不宣称原生控制台全程无告警。之前 P7 的正式设计签核和其他发布待办继续按原记录保留。
