### 📢 任务修改执行报告

1. **修改了哪些文件：**
   - 详情与轮播：`src/views/PostDetailView.vue`、`src/components/PostImageCarousel.vue`、`src/components/PostCard.vue`、`src/components/AppModal.vue`、`src/content-state.js`、`src/post-detail.css`。
   - 消息与资料入口及说明：`src/views/ConversationView.vue`、`src/views/ChatsView.vue`、`src/views/ProfileView.vue`、`src/components/ConnectionAction.vue`、`src/social-state.js`、`src/social.css`、`src/data/social-messages.js`、`src/data/content-messages.js`。
   - 浏览器业务：`src/domain/social.js`、`src/domain/content.js`、`src/domain/personal.js`、`src/services/browser-social.js`。
   - 原生仓库：`ios/Eluva/SocialRepository.swift`、`ios/Eluva/ContentRepository.swift`、`ios/Eluva/PersonalRepository.swift`。
   - 本地资源：`public/images/post-detail/` 下的 `background.svg`、`hero-overlay.svg`、`profile-icon.svg`、`reply-background.svg`、`reply-icon.svg`、`lit-bulb.svg`、`lit-up-badge.png`。
   - 测试：`tests/social.test.js`、`tests/image-carousel.test.js`、`tests/fixtures/post-detail.html`、`ios/EluvaTests/SocialTests.swift`、`ios/EluvaTests/WebBundleTests.swift`。
   - 规范和记录：`AGENTS.md`、`docs/app-flow-and-implementation-plan.md`、`docs/lanhu-design-catalog.json`、`docs/post-detail-connection-plan.md`、本报告及 `docs/evidence/post-detail-2026-10-20/`。Vite 输出与 `ios/Eluva/Web/` 已同步更新。

2. **每个文件解决了什么问题：**
   - `PostDetailView.vue` 将原来的评论入口替换成一次 Reply 私信联系，删除评论列表、数量、输入和取消点亮入口；保留举报、屏蔽、拉黑、删除和大图查看。资料／关系未读取成功时只提供失败恢复，避免用未知权限开放发送。
   - `post-detail.css` 用正常布局实现文案、作者卡、按钮与页码；Grid 叠放顶栏和全幅媒体。顶部光晕、底部渐变、按钮底图使用原始 SVG 图层。小屏发现的 SVG 两侧留白已通过装饰素材的 `preserveAspectRatio="none"` 修复，没有缩放整页。
   - `PostImageCarousel.vue` 复用单一可取消时钟，详情传入 2000ms，资料卡原有 4000ms 不变。手动选页、滑动、数量同步；缺图可重试，弹层、后台、离页、不可见、触摸、减少动态效果和键盘焦点分别控制暂停。`content-state.js` 按账户和动态保留图片索引。
   - `PostCard.vue` 删除个人主页／我的内容等复用卡片中的评论图标与计数，并把缺图重试传递到已有读取流程；`ProfileView.vue` 接回同一读取方法。
   - `ConversationView.vue` 允许双方查看待处理的联系。发送方没有继续输入入口，接收方可以 Decline 或用文字回复；实际回复提交成功后开放文字、表情、图片、语音和原有视频入口。失败保留输入。返回支持原动态路径。
   - `ChatsView.vue` 显示收到、等待和已拒绝联系状态；`ConnectionAction.vue` 使用有效聊天权限打开会话，避免把已拒绝显示成等待；`ProfileView.vue` 不再对已建立联系显示旧好友申请等待提示。
   - `social-state.js` 在关注变化后同步内容权限；`social-messages.js` 和 `social.css` 补齐英法提示、请求决策和状态显示。
   - `content-messages.js` 与 `social-messages.js` 清理首次引导、帮助和空列表中遗留的公开评论／仅好友申请解锁说明。`AppModal.vue` 新增默认关闭的 `blurOnBlank`，仅本轮 Reply 弹层启用点击空白释放输入焦点。
   - `domain/social.js` 与两端 SocialRepository 增加稳定用户对的 connection 状态、原子消息提交和幂等去重；两端 ContentRepository 用互关判断仅好友可见性；两端 PersonalRepository 清理删号涉及的 connection 元数据。继续复用同一个 Native Bridge，未创建第二套服务或真实后端。
   - 规范和实施计划已明确：详情没有评论，聊天通过互关或 Reply 得到实际回复解锁。历史报告保留为历史记录，不再作为现行规则。

3. **是否影响登录注册流程：** 否。没有修改认证、固定验证码、账户凭证、EULA 或注册原子提交。隔离测试夹具里的第二个账号仅用于测试，不进入生产数据。

4. **是否影响本地用户数据：** 有增量迁移。
   - `social.connections[pairId]` 保存 `pending / connected / declined`、来源动态和初始／回复消息 ID。`social.conversationRulesVersion` 标记一次迁移。
   - 历史已接受好友一次性补入双向关注，保留原有聊天能力和历史实体；之后不会因重新读取而自动回关。新好友申请的接受同样建立互关。
   - 点亮、单向关注、互关、Reply 联系仍分别管理。Reply 联系不会自动增加关注，也不授予仅好友动态的访问权限。
   - Reply／接收者回复／Decline 与去重记录在同一事务保存；失败不占用机会、不扣额度；重复回调不产生第二条信息。
   - 有待回复的 Reply 时，接收者在互关期间回复也会建立独立联系；后来取消关注仍可通过已建立联系继续交流。只有互关、没有 Reply 回复时，取消关注则撤销该授权路径。
   - 保留原有账户、动态、评论和消息；没有清空数据。新联系按稳定用户对隔离；拉黑优先于两条授权路径。
   - **保守实现选择：** Decline 后不重新开放同一用户对的陌生 Reply，以避免重复打扰；互关仍可解锁。没有把冷却期、付费重发或新数量上限写成用户已确认规则。介绍文字继续沿用既有 500 字素技术限制，正常消息沿用 2000 字素限制。

5. **是否检查了 iOS 适配和键盘交互：**
   - 浏览器英法 × 六视口 × 点亮前后共 24 组截图；没有横向溢出，素材已加载，图片为 `object-fit: cover`，详情没有 TabBar 或评论 UI。320 小屏可滚动到完整按钮和页码。
   - 实际 iOS 17.5 模拟器 WKWebView 加载生产本地包、真实资源处理器与唯一 Bridge；完成上述 24 组 DOM 测量，保存 4 张 390×844 基准 WKWebView 截图。
   - 测试中显式注入 20/0、44/34、59/34 安全区数值。这是离屏 WKWebView 的布局检查，不是相应型号的真实 Safe Area 结论。
   - Reply 输入继续使用项目已有 visualViewport 和 AppModal 内部滚动；取消、切语言和查看资料返回后保留草稿，失败可重试。浏览器及 WKWebView 验证空白点击释放焦点，输入区选择规则为 text、普通文字为 none。**没有验证真实系统键盘、真机后台与触摸性能。** 真机仍按此前用户决定列待办，不将浏览器或离屏测试等同真机。

6. **如何测试本次修改：**
   - `npm test`：89 项通过，0 失败。新增覆盖跨动态去重、失败不占用、真实接收账号文字回复原子解锁、Decline 回滚与幂等、互关／取消关注、互关期间回复后联系独立保留、旧关系只迁移一次，以及详情 2000ms／资料 4000ms 时钟差异。
   - 最终原生专项：3 项仓库测试和英法 2 项 WKWebView 测试，共 5 项通过。结果包 `/private/tmp/Eluva-post-detail-delivered-20261020.xcresult`。
   - 浏览器实际走通 Reply 失败 → 取消／换语言保留 → 重试成功 → 灰色等待提示 → 接收者消息列表 → 回复失败保留 → 回复解锁；另走通 Decline 失败重试、单向关注受限、回关后发送、取消互关后收起输入。
   - 验证单图无数量、缺图重试恢复、详情读取失败重试恢复、资料返回保留 Reply 草稿、轮播数量与索引同步，以及弹层打开期间暂停。精确 2000ms 由可控时钟单测验证；浏览器计时观察记录同时包含工具往返时间，不把它写成精确两秒测量。
   - Vite 生产构建和资源审计通过，231 个生产资源同步到 iOS；模拟器测试构建和无签名设备构建通过。231 个资源在 dist、iOS 源目录、模拟器包和设备包四份 SHA-256 相同；额外 `.generated-files.json` 为同步工具元数据，单独记录。
   - 用户提供的 Lit Up PNG 与本地资源逐字节相同；设计素材只进入本地资源，没有生产设计平台引用。
   - **全量原生回归尝试未通过：** 范围外 `CommerceTests.swift:50` 的现有 StoreKit 测试读取到空商品列表后强制解包崩溃；重启后旧首页用例长时间无进展，已中止并保留日志。没有修改购买模块，也没有把专项通过称为全量通过。

## 设计核对与差异记录

三张稿均重新核对为版本 1：未点亮 `b8286fe3-7162-4708-8519-3e48ac42093e`、点亮后 `cd70eece-7690-40a5-b5ea-468338856ab6`、回复弹层 `5668da27-b55c-4d61-8ed1-d1f16772a1a4`。更新时间和原始标注见 [方案](./post-detail-connection-plan.md) 与证据 `source/`。

390×844 英文基准测量：未点亮图片高 632、正文 y644、Light Up x82/y716/226×50；点亮后图片高 502、正文 y518、作者卡 x15/y628/360×135、View Profile 160×46、Reply x200/y704/160×44、底部页码位于操作区后。正文 Poppins 16/600/22，姓名 Inter 16/700/19，简介 Plus Jakarta Sans 13/400/16，两个按钮分别为 Plus Jakarta Sans 14/600/18 和 Poppins 14/600/21。

- 原始徽章 SVG 为 64×26、用户 PNG 为 128×52；MCP logical_size 却写 62×24。按实际 SVG／用户图片比例呈现，未混用尺寸。
- 历史 Rectangle 8 标注从 y112 起，附件照片覆盖到顶栏背后；采用本轮附件的完整可见裁切，顶部使用独立原始光晕层。
- 画布工具返回 195×422，标注和用户 780×1688 附件均换算到 390×844。只拉伸装饰渐变的填充区域，不缩小整页。
- 用户内容采用项目既有提供的照片。隔离验收夹具用 3 张照片和设计正文，原稿的海边照片／6 张计数未作为生产业务数据替换。因此截图用于组件与布局对照，不声称整张图片像素一致。WKWebView 夹具也包含默认头像缺失状态。
- 顶部光晕、背景、View Profile 图形、Lit Up 和按钮渐变／高光取自原始素材；法语徽章文案独立渲染。**Reply 三点气泡没有可导出的原始路径，当前按 18×18 标注和附件重建，尚待原始矢量核对。**
- 分页视觉点为 10／28×4；辅助分页点击区域适当扩展，间距比原稿略宽，整图同时支持滑动，大图页提供独立前后操作。

## 验证证据与复测

- [完整证据目录](./evidence/post-detail-2026-10-20/)：原稿、标注、切图元数据、24 张浏览器矩阵截图、流程截图、构建和测试日志。
- [浏览器矩阵](./evidence/post-detail-2026-10-20/browser-matrix.json)、[原生结果](./evidence/post-detail-2026-10-20/native-test-summary.json)、[最终 WKWebView 附件清单](./evidence/post-detail-2026-10-20/native-final/manifest.json)、[四份资源校验](./evidence/post-detail-2026-10-20/resource-verification.json)。
- [小屏底部颜色采样](./evidence/post-detail-2026-10-20/small-screen-background.json)：320×568 滚动后底部左／中／右均为 RGB(142,102,250)，确认已消除装饰 SVG 的侧边留白。
- 开发复测：运行 `npm run dev -- --port 5187`，打开 `/tests/fixtures/post-detail.html?locale=en&scenario=lit&safe=1&controls=1#/post/detail-qa-post`。每次载入创建唯一 IndexedDB，保留正式账户数据。夹具按钮可切换收发双方和触发失败；不打包到生产入口。

未完成：真机签名安装、真实系统键盘与后台／手势性能验收；Reply 原始气泡矢量逐路径核对；范围外全量原生 StoreKit 回归阻塞的排查。最终浏览器无 error／warn；WKWebView 销毁过程中仍有系统 ProcessSuspension／ProcessCapabilities 提示，日志已保留，未将其描述为零告警。
