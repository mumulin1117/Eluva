### 📢 任务修改执行报告

2026-10-21。范围：用户提供的 20 位用户、10 条动态的共享范围，新注册/已有账号读取，以及 Chats 加载、空态与失败恢复。

1. **修改了哪些文件：**
   - `src/data/demo-fixtures.js`：内置目录升级为版本 3，动态不再写入固定测试账号的 `demoScope`。
   - `src/domain/social.js`、`src/domain/demo-upgrade.js`：共享人物初始化与已有版本迁移不再绑定测试账号。
   - `ios/Eluva/SocialRepository.swift`、`ios/Eluva/DemoFixtures.swift`：相同的原生初始化与版本迁移。
   - `src/social-state.js`、`src/components/AppTabBar.vue`：账户绑定、可取消的独立快照读取，合并 TabBar/Chats 同时读取；静默背景读取与前台失败反馈分离。
   - `src/views/ChatsView.vue`、`src/data/social-messages.js`、`src/social.css`：空会话双语文案、失败/重试与加载结束，加载和刷新期间禁用筛选。
   - `tests/social-state.test.js`、`tests/demo-fixtures.test.js`、`tests/social.test.js`：读写忙状态、空结果、失败恢复、切账户丢弃旧结果、已有注册账号迁移、共享目录与私信隔离测试。
   - `ios/EluvaTests/DemoFixtureTests.swift`、`ios/EluvaTests/SocialTests.swift`、`ios/EluvaTests/WebBundleTests.swift`：同步新规则，补充真实完成注册后 Home/Chats 的集成回归及六尺寸证据。
   - `tests/fixtures/new-account-catalog.html`：UUID 隔离注册夹具，直接调用既有正式注册服务；允许显式挂起/失败读取以观察状态，不进入生产包。
   - `README.md`、`docs/app-flow-and-implementation-plan.md`、`docs/demo-data-catalog.json`：修正“仅测试账号可见”“新账号没有示例动态”的旧描述；本报告及证据。
   - 构建生成/同步 `public/config/content-demo.json`、`public/config/social-demo.json`、`public/config/demo-fixtures.json` 与 iOS Web 包。

2. **每个文件解决了什么问题：**
   - **共享范围：** 旧实现给内置动态添加 `demoScope=eluva-test-user-v1`，给人物添加同账户 `scope`，导致其他账号看不到。现将原有 20 人/10 帖作为 App 公共目录，保持原始 ID、人物对应、10 条英文原文和原始素材。新账号默认筛选可发现这些公开动态，首页仍每组最多 5 条；不会按账号复制帖子或增加新的动态。
   - **权限边界：** 只迁移这些已知内置记录的旧范围；通用 `scope`、私密、好友可见、公开到主页、删除、隐藏和双向拉黑检查继续有效。用户自行发布记录、原帖所有权与合集引用不变。
   - **私有会话：** 测试账号的两组会话、好友/互关、申请和已读不拷贝给新账户。共享人物可浏览、可点亮和按既有规则联系；持续私聊仍只通过双方互关或 Reply 得到实际回复解锁。人物资料继续只使用可信的本地原始素材。
   - **读取完成：** 旧 `loadSocial` 等待全局 `state.ui.busy` 清空，页面和 TabBar 又共用该读取，因此加载结束依赖其他操作释放忙状态。快照现在经同一 Native Bridge 独立读取，具有超时、取消和账户绑定；不再等待全局写锁。成功空数组同样设置 loaded 并结束骨架；并发入口复用一次请求。
   - **失败恢复：** 初始失败显示读取失败及 Retry；失败不当作空数据。刷新失败保留现有快照；再次读取成功清除当前读取错误。切账户/重置取消旧请求，旧快照不能覆盖新账户。社交写操作开始前取消可能过时的背景读取，提交和防重复仍由既有写锁处理。
   - **空态：** All 下显示 “No conversations yet.” 与 “Reply to a moment or follow each other to start connecting.”，法语对应完整翻译。Follow 和未读筛选沿用各自准确空文案。Just Light Up 和 Help Center 保留为功能入口，数量为 0，不制造假聊天或在线状态；没有增加固定等待。

3. **是否影响登录注册流程：**
   - 不改认证流程、验证码、资料顺序、18+、密码校验或原子建号规则。新账号完成注册后读取 App 共享内容；未完成注册仍不落正式账户。
   - 增强既有认证 WK 测试：实际完成注册 → Home 有内容 → 关闭首次定位引导 → Chats 空态 → Mine 退出与重登/重置密码。原测试的独立账户仓库与 Bridge 保持不变。

4. **是否影响本地用户数据：**
   - 是，版本 3 对目录记录进行增量迁移；没有清库、删账号、复制他人会话或重置偏好。迁移在现有仓库事务/原子文件保存边界完成，失败可重试。
   - 已验证迁移失败时旧库不变，重试后保留：自发私密帖子、历史评论、点亮、拉黑、已处理申请、消息已读和凭据。对已经注册的非测试账号，重启后获得共享目录，同时不能看到测试账号私密帖子或私信。
   - 旧 `demoScope` 常量继续作为私有测试会话的归属 ID，不再用它限制公共目录。测试使用 UUID 数据库或原生临时加密仓库，未清理真实账户数据。

5. **是否检查了 iOS 适配和键盘交互：**
   - 英法 × Home/Chats × 六视口，共 24 个浏览器组合；首页均显示 5 条，Chats 均无普通会话、骨架已结束、空文案完整、TabBar 有效、无横向溢出及缺图。
   - 六视口为 320×568、375×667、375×812、390×844、393×852、430×932；浏览器安全区为隔离夹具中的模拟值，不当作真机测量。
   - WKWebView 保存新账号空 Chats 的双语六尺寸记录和快照；既有消息页窗口测试验证下拉刷新、取消、失败、重试和仅点亮入口。认证/新账号流程包含离屏 WK 检查，不是物理设备验证。
   - 未改输入框、键盘处理或 Native Bridge 协议；系统键盘、真机 Safe Area 和硬件交互未进行人工验证。

6. **如何测试本次修改：**
   - Web 最终 104 项通过，0 失败：新增读写忙状态/空读取/失败重试/账号切换，以及已注册用户版本 2→3 迁移回滚。旧“新账号不能看人物/动态”的断言按用户最新要求更新，同时继续断言私密帖、私信和媒体隔离。
   - 原生首轮 12 项通过：8 项仓库、迁移、私密内容、真实账户读取、Reply/互关边界；4 项英法认证与消息页集成。最终筛选禁用调整后，4 项 UI 集成再次通过，不将重复执行算作 16 项不同测试。
   - 浏览器实际验证：挂起读取时显示 4 行骨架 → 释放后真实空态；初次读取失败不显示空态 → Allow reads + Retry 后空态；Follow 无结果文案；控制台无捕获的 warn/error。挂起/失败仅存在于明确标记的隔离夹具。
   - Vite 生产构建、259 个本地资源审计与 iOS 同步通过；Simulator 测试构建与 Release/iphoneos 无签名构建通过；四份资源逐文件 SHA-256 一致。已有 Vite 大 chunk 和 WebKit/RBS 进程结束诊断另行保留。
   - [验证摘要](./evidence/shared-content-new-account-2026-10-21/verification-summary.json)、[浏览器矩阵](./evidence/shared-content-new-account-2026-10-21/browser-matrix.json)、[加载/失败恢复](./evidence/shared-content-new-account-2026-10-21/browser-flows.json)、[文件哈希](./evidence/shared-content-new-account-2026-10-21/source-files.json)。

### 复测与未执行项

更新并启动保留原数据的 App，使用新注册账号或此前注册的普通账号进入 Home：默认 All 应能发现预置公开内容，刷新按原规则切换下一组；设置了无结果筛选/拉黑后仍可正确为空。进入他人资料应显示对应头像与动态，点亮状态属于当前账户。

进入 Chats，无会话时短暂真实读取后出现上述空文案。出现真实读取错误时应有 Retry，重试成功后骨架和错误均消失。测试账号重登仍保留原有两组会话与已读；普通账号不能继承它们。已有用户自行发布内容应继续保留。

本轮只修正数据范围与读取/空态，沿用既有 Home、Chats 的视觉，不重新生成插画或声称重新完成蓝湖全量版本签核。真机签名、物理设备 UI 和系统键盘未验证，按此前约定列为待办。浏览器图与 WK 测试均不替代真机结论。

截图：[新账号 Home](./evidence/shared-content-new-account-2026-10-21/home-en-390x844.png)、[新账号空 Chats](./evidence/shared-content-new-account-2026-10-21/chats-en-390x844.png)、[法语重试成功](./evidence/shared-content-new-account-2026-10-21/chats-retry-empty-fr-390x844.png)。
