### 📢 任务修改执行报告

1. **修改了哪些文件：** `src/views/StoreView.vue`、`src/commerce-state.js`、新增 `src/domain/subscription-display.js`、`src/domain/commerce.js`、`src/data/commerce-messages.js`、`src/membership.css`、`ios/Eluva/CommerceRepository.swift`；相关测试、隔离夹具、实施计划和 P6 契约。最终 H5 资源已同步 iOS。
2. **每个文件解决了什么问题：** 会员页区分当前套餐、已确认的下周期安排、待 Apple 批准购买；首次选择跟随实际套餐，当前标签独立于手动选择；修正已确认下期切换后旧审批标记残留。
3. **是否影响登录注册流程：** 否。复用原账户和统一 Native Bridge；仅在账户切换后重新初始化订阅页面的选择状态。
4. **是否影响本地用户数据：** 保留交易主键、商品 ID、所属账户和 Apple 到期时间，不重新计算或叠加会员周期。新增分支仅在新鲜、已验证且匹配的下期切换确认后，原子清除对应 `pendingProductId/pendingAt`；写入失败保留原状态。套餐选择仍是账户隔离的内存 UI 状态。
5. **是否检查了 iOS 适配和键盘交互：** 英法六尺寸的已安排状态、当前／待批准长标签、页面上下滚动和 Safe Area 已核对，二级页无 TabBar；真实 WKWebView 验证通过。本页没有新增输入，未进行系统键盘或签名真机实测。
6. **如何测试本次修改：** Web 247 项通过；原生仓储 11 项、WKWebView 7 项，共 18 项通过；最终状态说明更新后，新增的 3 项订阅 WK 场景再次通过。Vite 构建、265 项资源审计／同步、主工程模拟器 Debug 与无签名 iOS Release 构建通过，最终五处运行资源逐字节一致。

页面行为：

- 当前月套餐仍按原到期日显示，例如 `Current: Monthly · Pro valid until Nov 24, 2026`。
- Apple 已确认年套餐下期切换时，独立显示 `Scheduled: Annual Plan · Starts on Nov 24, 2026`。年套餐卡上有 Scheduled 标签，月套餐卡保留 Current plan 标签。展示日期来自真实字段，示例日期不是写死文案。
- 已有年套餐首次读取或重新登录后默认选年套餐。主动选择月／季套餐后，当前年套餐标签仍保留；安静刷新、取消、失败及权益页返回保持选择。实际生效的套餐改变后才跟随新套餐。
- 会员尚未读入时不把默认月套餐标成已选或允许提交。当前、已安排及待批准的对应选项，不重复触发购买；其他选择继续走既有 Apple 报价与确认流程。
- 待批准购买显示独立的 Awaiting Apple approval／En attente de l’approbation d’Apple，不把它写成已安排，也不提前授予权益。若同时存在不同目标的已安排变更与审批请求，分别展示。
- 底部说明也区分当前、已安排、审批状态，避免月转年后仍暗示当前月套餐会按月续订。新选择其他套餐时继续展示对应价格、周期及 Apple 最终确认说明。
- 已关闭自动续订、过期、撤销或没有有效权益时不承诺下期生效。未知下一商品不编造名称；没有可靠的未来日期时说明需等 Apple 确认，并保留 Manage subscription。

数据依据与批准闭环：

`nextProductId` 来自已验证的续订偏好，`pendingProductId` 来自购买 `.pending`，二者独立。具体未来生效日使用当前周期 `expiresAt`；`accessUntil` 可能包含账单宽限期，只用于当前权益有效期，不作为下期开始日期。不会在前端累加一个月、三个月或一年。旧 SKU 保留原始记录；可用已保存的稳定 plan 展示当前名称，下一 SKU 只有精确匹配目录才显示具体名称。

原生原先只在收到目标商品本身的交易时解除 pending。下期切换的批准可能只更新当前月交易的续订偏好，本轮增加对应分支：本次接受的已验证续订状态为 active、继续续订、下一商品匹配待批准目标且是已配置 Pro、签名不早于请求，也不早于已保存的续订信息，当前交易仍有效且未撤销／升级时，原子解除该请求。旧回调、取消续订、未知商品、不同目标或写入失败都不清除；不靠等待时长推断拒批。

官方依据已核对：[Apple 同级不同周期切换规则](https://developer.apple.com/help/app-store-connect/reference/in-app-purchases-and-subscriptions/auto-renewable-subscription-information/)、[续订偏好字段](https://developer.apple.com/documentation/storekit/product/subscriptioninfo/renewalinfo/autorenewpreference)、[购买待批准状态](https://developer.apple.com/documentation/storekit/product/purchaseresult/pending)。本轮展示只依据返回的实际状态，不根据用户刚点选的套餐推断 Apple 已安排或已扣款。

逐文件职责：

- `src/domain/subscription-display.js`：统一投影当前、已安排和审批三种状态，验证日期与已知名称；不修改数据或授予会员。
- `src/commerce-state.js`：默认实际套餐、保留手动选择、账户重置及已生效套餐变化同步。
- `src/views/StoreView.vue`：两条计划说明、三种独立标签、对应 CTA 与价格说明；保留 Restore、管理和原错误恢复。
- `src/membership.css`：沿用原紫色、字体、胶囊和布局，新增自然换行的小标签及状态块，仅作用于订阅页。
- `src/data/commerce-messages.js`：新增英语／法语当前、下期、批准及状态说明。
- `src/domain/commerce.js`：浏览器快照与原生一致返回账户的 pendingProductId，不制造批准结果。
- `ios/Eluva/CommerceRepository.swift`：已确认下期变更解除匹配审批的原子保存分支。
- `tests/subscription-display.test.js`、`tests/commerce-state.test.js`：新状态投影、默认与手动选择、旧记录、时间、取消、审批和账户隔离回归。
- `tests/fixtures/subscriptions.html`：独立库的年套餐、月转年、年转月、审批、已安排并有另一审批和明确标注的支付展示夹具。不会打入生产入口或写入用户账户。
- `tests/native-pro/NativeProEntitlementTests.swift`、`NativeProWebViewTests.swift`、`README.md`：保存原有回归，新增真实仓储与 WK 页面验证；可按说明生成独立工程复跑，不更改生产测试 target。
- `docs/app-flow-and-implementation-plan.md`、`docs/p6-route-contracts.json`：记录本轮生效规则。上一轮 Pro 三项权益实现保持。

设计与验证证据：

重新读取蓝湖“充值” `7574cbf3-7a5f-467f-a7af-6c582c36ee4a`，目录更新时间为 2026-10-23T13:53:43.789866Z；当前目录未返回版本数字，现有样式记录 v1，不冒称切换过新版本。保留原插画、背景、字体、主色、三档商品、价格和 Restore 位置；新增动态状态按用户本轮明确要求使用原主题的文字与布局。

- [Web 测试](./evidence/subscription-schedule-2026-10-24/web-tests.log)
- [18 项原生与 WK 测试](./evidence/subscription-schedule-2026-10-24/native-tests.log)
- [最终 3 项订阅 WK 复测](./evidence/subscription-schedule-2026-10-24/wk-store-final.log)
- [最终 WK 截图及 DOM 清单](./evidence/subscription-schedule-2026-10-24/wk-store-final-attachments/manifest.json)
- [英法六尺寸与交互摘要](./evidence/subscription-schedule-2026-10-24/browser-verification.json)：六种视口 × 两种语言，上下区域共 24 张矩阵截图，另覆盖年套餐默认选择、待批准转已安排、手动选择保持及连续提交。
- [Vite 和同步日志](./evidence/subscription-schedule-2026-10-24/vite-build.log)、[Debug](./evidence/subscription-schedule-2026-10-24/xcode-debug.log)、[Release](./evidence/subscription-schedule-2026-10-24/xcode-release.log)、[最终打包资源一致性](./evidence/subscription-schedule-2026-10-24/packaged-resource-audit.json)

WK 运行于独立 iOS 26.5 iPhone 17 模拟器，实际 Web 视口 402×874；英法六尺寸浏览器检查与 WK 结论分开记录。收据与页面数据均为隔离测试夹具，验证真实仓储、Vue、资源装载与唯一 Bridge 的行为，不代表 Apple 沙盒扣款或真实批准。未清空或修改现有账户、动态与会员；无签名构建不等于真机验证。

未完成／边界：本轮没有签名真机、真实 Apple 沙盒购买／恢复、系统批准弹窗或跨设备验证。未知未来 SKU／日期只提供管理入口；Apple 拒批若没有可验证回调，不自行删除等待记录。Vite 仍有既有单包超过 500kB 提示，Xcode 有无 AppIntents 依赖的元数据提示；模拟器窗口销毁附近有系统 WebKit/RBS 进程日志，没有持续资源或约束错误。其他未提交工作及用户自己的 Xcode 配置保持原样。
