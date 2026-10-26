### 📢 任务修改执行报告

1. **修改了哪些文件：** 三个状态模块、TabBar、Home／Chats／Profile／PostDetail／Conversation／Collections／ProfileCollections／Main／Settings／PostList／Friends／LightNotices／Help／Feedback 视图；相关状态测试、浏览器隔离夹具、WK 测试与实施计划。下方列出职责，未改视觉资源、字体、颜色或布局。
2. **每个文件解决了什么问题：** 已成功展示的父页面直接恢复现有数据，不因重新挂载而重复读取或重播骨架、内容淡入及首页发现动画；首次访问、主动刷新和明确重试仍使用实际服务。
3. **是否影响登录注册流程：** 否。认证、建号、协议与验证码保持；切换账户或退出后清空临时展示标记，下一账户不能复用上一账户内容。
4. **是否影响本地用户数据：** 不迁移、不清空、不复制业务记录。展示标记只有当前内存中的成功实体 ID，不持久化；动态、关系、消息、草稿、合集、订阅仍由原状态和仓储管理。关注、点亮、发布、拉黑等成功结果即时投影，不依靠返回刷新才更新。
5. **是否检查了 iOS 适配和键盘交互：** 实际 WKWebView 返回链路、390×667 较小原生窗口及默认模拟器窗口已验证，保留 Safe Area 与 TabBar 规则；没有修改输入或键盘逻辑。未进行实体 iPhone、系统键盘及真实手势实测。英法六尺寸浏览器证据单独记录，不作为真机结论。
6. **如何测试本次修改：** 51 项相关状态／导航／加载测试通过。Vite 构建、265 项资源审计／同步、Xcode 模拟器 Debug 与无签名 iOS Release 构建通过，dist／iOS 源资源／Debug App／Release App／WK 测试宿主五处运行资源逐字节一致。完整 20 项隔离原生与 WK 回归通过（11 项仓储、9 项 WK，其中 2 项为新增返回场景）；浏览器矩阵见下方证据。

行为与边界：

- Home 返回恢复已完成分组、横向位置和既有引导进度，不再次进入 busy 或亮灯／落卡过程；成功 0 条的空态也可恢复。首次未完成发现仍走原呈现流程。
- Chats 返回直接恢复成功列表或空态、All／Follow 选中与分类滚动，不重新读取，也不再插入骨架。下拉刷新与失败重试仍使用真实读取，连续操作仍去重。
- Profile 和 PostDetail 只有在目标已成功展示、内容与关系快照均归当前账户、实际目标仍存在且未拉黑时恢复。首次目标保留原 1000ms 首显节奏和首图准备；返回不重播内容淡入。显式重新读取先失效对应展示标记，取消／失败不会把旧标记当新成功。
- 返回保留原 ContentShell 滚动、主页动态图和详情图片页码；不引入 KeepAlive，旧页仍正常卸载，媒体、轮播、观察器、定时器与异步读取继续清理。
- Conversation 复用成功线程与原草稿；真实未读确认和草稿准备仍可执行，不把这些必要写操作误作整页刷新。权限与拉黑依旧来自当前共享关系，权限仍由本地统一仓储校验。
- 合集仅记录成功读取 ID，返回从当前本人合集或他人可见合集投影恢复；帖子仍需存在且符合主页可见性，他人合集始终只读。缺失／被拉黑内容不从旧对象恢复，空合集列表也不重复读取。
- TabBar 与个人／设置／列表挂载复用成功账户快照；Main 的关注行直接依据已提交的 social 关系，避免跳过 personal 读取后留下旧关注列表。订阅有效期时钟、Apple 状态更新与系统通知权限检查保持。

逐文件职责：

- `src/content-state.js`、`social-state.js`、`personal-state.js`：可选 `reuse` 读取；只在已登录、已成功读取且 ownerId 精确一致时复用，包括成功空结果。默认读取和所有明确刷新不改变；保留在途快照去重。新增 `presentedPosts`／`presentedProfiles`／`presentedThreads`／`presentedCollections` 临时 ID 标记，重置时清空。
- `src/views/HomeView.vue`、`ChatsView.vue`、`src/components/AppTabBar.vue`：挂载时直接恢复已成功展示的数据，停止返回带来的附加读取。
- `src/views/ProfileView.vue`、`PostDetailView.vue`：目标与权限检查、成功展示标记、强制重试失效、仅首次内容淡入及旧任务取消保护。
- `src/views/CollectionsView.vue`、`ProfileCollectionsView.vue`：从实时快照恢复合集与只读资料，保留选择、原帖可见性与失败入口。
- `src/views/ConversationView.vue`：复用已展示线程，保留原草稿、未读确认及媒体清理；补充账户检查。
- `src/views/MainView.vue`、`SettingsView.vue`、`PostListView.vue`、`FriendsView.vue`、`LightNoticesView.vue`、`HelpView.vue`、`FeedbackView.vue`：仅挂载读取按需复用，明确重试／写操作不复用。Main 关注行使用当前关系，粉丝保留已有权威 ID 及实际互关结果，并过滤已屏蔽用户。
- `tests/discovery-state.test.js`、`social-state.test.js`、`personal-state.test.js`：新增 7 项，覆盖空快照、不产生读取／busy／错误清理、强制读取／刷新、旧账户、重置、在途读取及草稿保持。
- `tests/native-pro/NativeProWebViewTests.swift`、`README.md`：新增 2 项真实 WK 返回测试；测试内审计实际 Bridge 转发与 DOM 瞬时骨架插入，不给生产代码加入口。390×667 原生窗口确保非零详情滚动确实得到验证。
- `tests/fixtures/loading.html`：浏览器专用的随机独立 IndexedDB、计数／失败／返回控制与骨架审计，不进入生产包。
- `docs/app-flow-and-implementation-plan.md`：记录最新返回规则，明确覆盖旧“缓存返回静默读取”描述。

证据：

- [51 项相关测试](./evidence/navigation-return-2026-10-24/focused-tests.log)
- [全量 Web 测试](./evidence/navigation-return-2026-10-24/web-tests.log)：254 项中 253 项通过；`tests/subscriptions.test.js` 的 Xcode 商品配置断言因当前工作区缺少 `ios/Eluva/viu.storekit` 报 ENOENT。该文件在本轮开始时存在、后续读取时已不在工作区；本轮未修改或补回订阅配置，也未跳过该测试。
- [两项实际 WK 返回测试](./evidence/navigation-return-2026-10-24/wk-return-fixed.log)、[附件索引](./evidence/navigation-return-2026-10-24/wk-return-attachments/manifest.json)
- [完整原生与 WK 最终回归](./evidence/navigation-return-2026-10-24/native-wk-final.log)
- [Vite 构建与同步](./evidence/navigation-return-2026-10-24/vite-build.log)、[Xcode Debug](./evidence/navigation-return-2026-10-24/xcode-debug.log)、[Xcode Release](./evidence/navigation-return-2026-10-24/xcode-release.log)、[五处资源一致性](./evidence/navigation-return-2026-10-24/resource-audit.json)

开发者复测：首次进入 Home／Chats／他人主页／详情，确认原首次呈现；上下级往返确认立即显示原列表、分类、图片页码及位置；主动刷新或失败重试确认仍读取；关注／点亮／发布后返回查看结果；屏蔽作者后返回确认内容消失；切换账户确认不会复用上一账户内容。

未完成项：签名实体 iPhone、系统键盘／真实触摸与长时性能验证；缺失的 StoreKit 测试配置需另行确认。保留既有 Vite 大包提示及模拟器进程清理日志，不将无签名构建或浏览器截图视为真机验证。

2026-10-24 后续状态：用户要求删除测试代码后，上述 tests／专用宿主及失效 StoreKit 引用已移除，原始历史验证结果仅保留作证据，当前清理范围见 [测试代码清理报告](./test-code-removal-report.md)。随后触摸复测发现 ConversationView 返回恢复使用 social 却漏导入，造成会话 setup 空白；已补齐同一状态导入并重建，真实入口会话与富文本编辑复测通过，见 [触摸交互报告](./iphone-touch-report.md)。
