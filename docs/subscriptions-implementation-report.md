### 📢 任务修改执行报告

2026-10-21。范围：三档 Pro 自动续期订阅、验证后本地持久化、会员到期显示、恢复与管理入口，以及必要的原生和双语适配。Bundle ID 已按用户最新回复统一为 `com.eluva.app`。

1. **修改了哪些文件：**
   - `src/domain/commerce.js`：正式商品配置、会员状态投影、到期计算。
   - `ios/Eluva/CommerceRepository.swift`：验证交易、续订状态、账户令牌兼容、持久化与订阅流水。
   - `ios/Eluva/StoreCoordinator.swift`、`ios/Eluva/NativeBridge.swift`：StoreKit 商品、购买、监听、恢复、管理和唯一 Bridge 接入。
   - `src/commerce-state.js`、新增 `src/composables-membership.js`：会员快照、后台更新、过期刷新及离页清理。
   - `src/views/StoreView.vue`、`src/views/MainView.vue`、`src/membership.css`、`src/personal.css`、`src/data/commerce-messages.js`：订阅页 Restore、当前方案、期限与状态；个人中心 Pro 身份；英法文案与布局。
   - `scripts/generate-ios.rb`、`ios/Eluva.xcodeproj/project.pbxproj`、`ios/Eluva/Simulator.entitlements`：App/测试 Bundle ID 和模拟器 application identifier；重建工程仍保留正式 ID，旧 Keychain access group 保留。
   - `tests/subscriptions.test.js`、`tests/commerce-state.test.js`、`tests/commerce.test.js`、`tests/fixtures/subscriptions.html`、`ios/EluvaTests/CommerceTests.swift`、`ios/EluvaTests/WebBundleTests.swift`、`ios/EluvaTests/Fixtures/CommerceQA.storekit`：业务、失败恢复、StoreKitTest 及 WKWebView 验证。
   - `README.md`、`docs/app-flow-and-implementation-plan.md`、`docs/p6-route-contracts.json`、`docs/lanhu-design-catalog.json`：修正本轮已经确认的商品范围；保留旧验收历史与未确认额度。
   - 构建生成 `public/config/commerce-policy.json`，同步至 `dist` 与 `ios/Eluva/Web`；测试 HTML 和 StoreKitTest 配置不作为生产支付方案。

2. **每个文件解决了什么问题：**
   - 商品与价格：仅配置 `eluva_monthly_promember`（1 个月）、`eluva_quarterly_promember`（3 个月）、`eluva_annualy_promember`（1 年）。保持用户提供的 ID 拼写。三者按同组自动续期处理；运行时价格、币种、商品类型与周期来自 StoreKit，并核验类型、周期及组一致性。用户提供的美元价格仅用于测试配置和对照，未写死到生产报价。
   - 购买：沿用 `commerce.purchase` → StoreKit `Product.purchase`。报价变化时要求重新读取；购买中锁定重复操作；取消不激活；待批准保存 pending；验证失败不发放。通过验证后先原子持久化，再 `finish()`。重复回调或反复 Restore 不重复产生订阅流水，也不加金币。
   - 期限：本地保存当前账户的商品 ID、原交易 ID、环境、购买时间、Apple 到期日、续订开关和验证时间。使用 Apple 到期日及已验证宽限期计算可用截止日；不按固定 30/365 天推算。历史较旧的签名记录不能延长新状态；过期、撤销和升级状态具有相应边界。
   - 续订：监听交易和已验证续订状态；进入前台/会员页面时读取缓存并安排后台核对。可见页面每 5 秒读取本地快照，关闭页面时清理计时器、监听和未完成的界面读取。离线缓存只持续到记录的截止时间，不因失败自动延长。
   - 账户：`appAccountToken` 为规范化账户邮箱派生的稳定、不含明文邮箱的 UUID。旧随机 token 保存为 alias，保留已有交易归属；重新安装后同一账户可以匹配原 token。其他 Eluva 账户不能领取同一 Apple 交易。删除账户仍保留既有去重墓碑策略，退出不删除交易资料。
   - 显示：个人中心增加 Pro Activated、有效期、头像 PRO；订阅页显示当前期限、当前方案、续订关闭、宽限期、过期、退款/撤销及账单重试状态。Xcode/Sandbox 标签根据交易环境显示；正式交易不显示测试标签。当前方案按钮不可重复购买，其他方案可以调用 Apple 的变更流程；未生效的方案变更不会提前替换现有权益。
   - 恢复：右上角 Restore 显式调用 `AppStore.sync()`，核对当前 Apple 账户交易与 Eluva 账户归属，区分恢复有效订阅、已到期记录、无记录及失败。失败保留状态并可再次恢复/重载。管理入口调用 Apple 订阅管理界面。不会把已消费的消耗品重新发放。
   - 后台读取不占用购买操作锁、不清除前台错误，避免页面轮询导致按钮持续 busy。购买后关联 Mine 与 Store 使用同一快照，无需重新加载页面。

3. **是否影响登录注册流程：**
   - 否。没有修改认证、验证码、资料引导或原子建号规则。登录/切换账户时清理的只是会员界面缓存，随后读取对应账户交易。
   - Bundle ID 从 `com.eluva.local` 改为 `com.eluva.app` 后，iOS 会将它识别为另一 App 沙盒。旧 App/旧数据未删除，未执行跨沙盒搬迁；新 App 中需要按原有登录规则进入账户。原有 Keychain/vault 服务命名没有批量更名。

4. **是否影响本地用户数据：**
   - 是，增量保存已验证订阅元数据、pending、旧 token aliases 与订阅流水；保留账户隔离及旧内容、消息、余额。没有清空用户或动态，也没有为了展示 Pro 改写真实账户。
   - 测试使用独立临时仓库、UUID IndexedDB 与 StoreKitTest 交易，测试结束清理对应临时环境。页面截图中的 UI 夹具有明确标识，不代表 Apple 购买成功。
   - 本轮只接通用户指定的订阅身份、期限和恢复展示。公开发布额度、金币消费、免费合集数量及尚未确认的 Pro 细项不新增商业规则；原有权益比较页的未配置项也不伪造为已解锁。

5. **是否检查了 iOS 适配和键盘交互：**
   - 已检查英语/法语，六种视口 `320×568`、`375×667`、`375×812`、`390×844`、`393×852`、`430×932`。浏览器 48 个主矩阵组合覆盖 Mine/Store、有效/无订阅、双语六尺寸；另检查过期、撤销、宽限期、关闭续期、购买受限与恢复失败。
   - WKWebView 使用实际本地 Web 包和唯一 Native Bridge，检查双语六尺寸无横向溢出、Restore 点击高度至少 44、订阅页无 TabBar；保存原生快照与测量附件。WK 会员状态使用原生临时仓库的验证记录夹具，不能当作 Apple 付款页证据。
   - 本轮没有新增输入框，键盘交互不变。模拟器/WK 检查不能替代真机 Safe Area、硬件键盘或 Apple 付款页的人工验证。

6. **如何测试本次修改：**
   - Web 自动化：`npm test`，100 项通过，0 失败。
   - Vite：`npm run build`，构建、生产资源审计和 iOS 同步通过。已有大 chunk 提示保留，未隐瞒为无警告。
   - 新 Bundle ID 原生：iPhone 15 / iOS 17.5，19 项相关测试通过，0 跳过；iPhone 17 / iOS 26.5，2 项 Pro WKWebView 测试通过。12 项交易仓库/StoreKitTest、1 项真实 Keychain 仓库重建和 6 项会员相关页面检查包含在 19 项内，不重复相加。
   - StoreKitTest：实际使用 Apple StoreKitTest 框架读取三商品，执行购买、重复恢复、续期、关闭续期、到期、购买取消、网络错误、待批准/批准及退款；另保留消耗品不重复恢复回归。测试关闭系统付款对话框，因此不能声称已人工验证付款页。
   - iOS 26.5 模拟器的 StoreKitTest 曾返回内部错误/空商品，本轮改用可工作的独立 iOS 17.5 测试设备完成交易测试；iOS 26.5 仍完成本地 WK 验证。历史失败日志保留，最终结果以 `verification-summary.json` 指向的 final 结果为准。
   - Release / iphoneos 无签名构建通过，产物 Bundle ID 为 `com.eluva.app`。本轮还修正新增代码的 Swift 并发捕获警告；系统 AppIntents 提取提示和部分 WebKit 进程退出日志另行记录。
   - 详细结果、资源哈希与截图索引：[验证汇总](./evidence/subscriptions-2026-10-21/verification-summary.json)、[浏览器矩阵](./evidence/subscriptions-2026-10-21/browser-matrix.json)、[失败恢复记录](./evidence/subscriptions-2026-10-21/browser-flow.json)、[设计依据](./evidence/subscriptions-2026-10-21/design-reference.json)。

### 设计核对与必要差异

- 蓝湖「充值」`7574cbf3-7a5f-467f-a7af-6c582c36ee4a`，接口更新时间原值 `2026-10-21T10:00:22.325275Z`；「我的」`78750ef7-6763-4785-bdf0-08309be4ad4c`，`2026-10-21T10:00:22.337023Z`。当前查询未返回明确历史版本号，不宣称已切到某个版本。沿用已提取的同体系原始素材，结合本次用户附件与图层标注。
- API 缩略画布 195×422、设计 CSS 基准 390×844、附件/导出倍率分别处理。Restore 标注 Poppins 600/15；有效期 Poppins 400/12、18 行高；Mine Pro 标题 Bakbak One 400/17。复用原宝石场景、PRO 标、渐变、图标及本地字体，未生成替代插画。
- 文字和状态独立渲染。长法语、测试环境标签和异常状态允许页面滚动。已购时使用 Current plan，未购时 Continue with Pro。
- 用户已确认自动续期，因此原稿中一次性付款/No auto-renewal 文案被准确的自动续期说明替换。原稿示例有效期和固定价格不用于真实状态。
- 本地保存：[附件会员页](./evidence/subscriptions-2026-10-21/source/reference-store.png)、[附件个人中心](./evidence/subscriptions-2026-10-21/source/reference-mine.jpg)、[会员页实现（隔离 UI 夹具）](./evidence/subscriptions-2026-10-21/screenshots/store-active-en-390x844.jpg)、[个人中心实现（隔离 UI 夹具）](./evidence/subscriptions-2026-10-21/screenshots/mine-active-en-390x844.jpg)。

### 复测步骤与未完成项

1. 用正式 Bundle ID `com.eluva.app` 打开 Xcode 工程，配置原用户所属开发团队和有效签名，在 App Store Connect 核对三个商品均已可用于测试、同一组、周期分别为 1 月/3 月/1 年。用户提供的价格不等于当前 storefront 返回价格。
2. 用对应 Eluva 账户进入会员页，等待 StoreKit 返回产品与价格。点击 Continue，完成 Apple 付款页；确认 Mine/Store 同步当前方案和真实到期日。重复 Restore 不应增加流水。
3. 在 Apple 系统订阅中关闭续期，再回 App 检查仍可使用至已付截止日；验证续订/变更后到期日更新、退款/撤销后失效。切换到其他 Eluva 账户，不能继承前一账户 Pro。
4. 重启及前台返回后检查缓存恢复；断网失败不得激活、延长或清除旧有效订阅。购买处于 pending 时保留待核对提示，审批后才激活。
5. **待办：Development Team/真机签名、Apple 沙盒实际商品可读性与系统付款/恢复/订阅管理界面、真机购买及跨设备恢复。** 按用户此前“先交付，真机验证列为待办”执行，未重复索要团队。无真实扣款、无远端配置修改，不能将 StoreKitTest 或 WK 截图作为这些项目已完成的结论。

Apple 依据：[当前有效交易](https://developer.apple.com/documentation/storekit/transaction/currententitlements)、[显式同步恢复](https://developer.apple.com/documentation/storekit/appstore/sync())、[订阅状态](https://developer.apple.com/documentation/storekit/product/subscriptioninfo/status(for:))、[宽限期截止时间](https://developer.apple.com/documentation/storekit/product/subscriptioninfo/renewalinfo/graceperiodexpirationdate)。
