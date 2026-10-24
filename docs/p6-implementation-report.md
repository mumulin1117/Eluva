# P6 StoreKit 与统一额度实施记录

实施日期：2026-10-18（Asia/Shanghai）。**本轮完成的是未配置商品时的可运行路径、StoreKit 基础设施和统一发布额度流水，不是正式商业 P6 全部出口通过。** 商品类型、正式商品 ID、权益、商业额度及计日时区尚未收到用户确认；配置保持 `confirmed:false`、`products:[]`，Pro 筛选及头像框继续锁定。没有把蓝湖候选规则或测试夹具当作正式商品。

### 📢 任务修改执行报告

1. **修改了哪些文件：** 逐文件用途及前后哈希见 [source-files.json](evidence/p6/source-files.json)。新增 `src/domain/commerce.js`、`src/services/browser-commerce.js`、`src/commerce-state.js`、`src/views/StoreView.vue`、`src/data/commerce-messages.js`、`src/commerce.css`、`ios/Eluva/CommerceRepository.swift`、`ios/Eluva/StoreCoordinator.swift`、Web/原生测试与独立 StoreKitTest 配置。对内容发布、账户删除、唯一 Bridge、页面入口、构建和文档作必要增量修改。

2. **每个文件解决了什么问题：**
   - `commerce.js` / `CommerceRepository.swift`：统一额度、奖励次数、分环境余额、流水、历史用量兼容和账户所有权。公开发布的内容与记账在同一事务中提交；私密、失败和同 commit 重试不重复记消耗。当前无商业上限，也没有奖励发放入口或已确认金币单价。
   - `StoreCoordinator.swift`：StoreKit 2 商品读取、商品类型匹配、价格重新核对、购买、取消、失败、待处理、启动监听、未完成交易重放及用户主动恢复。价格文本、币种、商品名和描述来自 StoreKit。只接受 `.verified`，绑定持久化 UUID `appAccountToken`；到账及交易 ID 写入成功后才 `finish()`，存储失败保留 Apple 事务待重试。
   - `browser-commerce.js`：浏览器只读本地额度与余额，明确购买不可用；拒绝购买/恢复，不接受伪造 grant、receipt、reward 或 debit RPC。未增加模拟支付按钮。
   - `commerce-state.js` / `StoreView.vue`：购买页、权益待确认表、余额及流水、商品重载、恢复说明、帮助及协议草案。读写有 busy/disabled/error/retry；选中商品不随语言变化重置。页面离开后丢弃 RPC 迟到结果；Apple 事务由应用级监听继续处理，不把“返回页面”当作取消支付。轮询仅在页面可见且无操作时更新权威余额，离页清理。
   - `browser-content.js` / `ContentRepository.swift` / `content.js`：保留既有发布校验、媒体和幂等提交，改为统一分配器记账。旧 `content.quota` 保留兼容镜像；已有用量不会被新增命名空间重置。
   - `personal.js` / `PersonalRepository.swift`：删号同时移除目标账户钱包/流水，保留不含邮箱、资料和令牌的交易去重墓碑；其他账户钱包不变。退出不删余额或用量。
   - `NativeBridge.swift` / `WebViewController.swift` / `LocalRepository.swift`：只在现有 Bridge 增加 `commerce` 服务；未开第二套协议。应用启动安装交易监听，本地敏感数据仍使用原 vault。
   - `MainView.vue` / `PostComposerView.vue` / `ProfileEditView.vue` / `router.js`：我的、发布筛选和头像框入口接同一购买页，二级页面无 TabBar；发布与资料草稿返回保留。未实现任何未确认 Pro 解锁。
   - `commerce.css` / 文案 / 本地素材：使用原始图形与渐变、本地 Braah One 与 OFL、已有 Poppins；补齐 EN/FR 不可用、恢复和环境说明。
   - 测试、生成与审计脚本：覆盖账户/环境隔离、写入失败、去重、恢复、撤销、额度和真实 Xcode StoreKitTest；Web 构建证据改写入 P6，P1—P5 历史保留。

3. **是否影响登录注册流程：** 否，未改变认证接口、账号凭据、固定验证码、注册提交或 Onboarding 顺序。购买按现有已登录账户保护；退出/换账户清理购买界面缓存。现有认证回归通过。

4. **是否影响本地用户数据：** 是，新增版本 1 的 `commerce` 区域，增量保留旧数据。生产、Apple sandbox、Xcode StoreKit 余额隔离，浏览器公开发布流水标为 `localPreview`，不产生付费余额。交易去重键包含环境及 Apple transaction ID；重放写入失败不会先结束事务。不存在清库或自动重置。账户删除保留最小去重墓碑，防止同一事务转投其他账户。

5. **是否检查了 iOS 适配和键盘交互：** 已保存 11 状态 × 英法双语 × 六视口共 **132 张浏览器截图**，核对实际图片尺寸、文字、素材加载、主滚动区域、弹层、横向溢出及二级 TabBar。可编辑字段实际选中 7 字符，普通段落点击后收键盘焦点回到 BODY；编辑区 `user-select:text`，普通内容为 `none`。这只证明浏览器输入与焦点行为。**本轮原生 UI、软键盘、硬件 Safe Area 和真机 StoreKit 未执行。** Mac 锁屏，Chrome 蓝湖调用本轮超时，两台已配对设备均 unavailable。

6. **如何测试本次修改：** Web **63/63**；iPhone SE / iOS17.5 Simulator 原生测试 **42/42**（其中一项真实 StoreKitTest 集成）。Vite 构建、资源审计/同步、通用 Simulator 与未签名 iOS 设备目标编译通过；最终四份包资源以 [evidence-audit.json](evidence/p6/evidence-audit.json) 为准。可复测：固定账号 → 我的 → Pro → 重载/恢复/帮助/协议/权益/余额；发布草稿 → 筛选 → Pro → 换语言 → 返回；私密发布不记消耗，公开发布失败保留输入、重试仅记一次，重新加载后流水保留。详见[验证摘要](evidence/p6/verification-summary.json)和[交互记录](evidence/p6/interaction-observations.json)。

## 设计核对与视觉边界

- #28「充值」：`7574cbf3-7a5f-467f-a7af-6c582c36ee4a`，更新 `2026-10-13T15:14:57.20977Z`，精确 ID 的切图接口返回「版本1」。
- #26「充值--会员功能」：`bff19b3d-1f29-42a7-a935-c674940b9443`，更新 `2026-10-13T15:14:57.216034Z`，精确 ID 返回「版本1」。
- [原始目录/版本/标注](evidence/p6/design-input.json)、[参考图](evidence/p6/references/design-28.png)、[权益参考图](evidence/p6/references/design-26.png)、[逐页契约](p6-route-contracts.json)均已保存。标注模式未生成完整可用 HTML，使用导出的 `data-css` 与原始 SVG，不假称完成 Chrome 人工逐层签核。
- 目录 195×422 是预览；原稿为 390 逻辑宽，切图原始存储 4 倍。布局使用流式容器；背景、光效、宝石和按钮渐变保留原导出的路径、蒙版、变换和渐变，未把整张稿当页面缩放。图标裁去烘焙英文后叠加双语文字，保持图形比例；PRO 为原始字形路径，未用近似 Baloo 字体替换。
- 标题使用 Braah One：购买页 28/400/39；权益页 24/400/25（25 行高据原文本层高度补齐，原 CSS 未单列 line-height）。表格 Poppins 14/400 或 500/17，列比例 133:111:117、普通行最小 70、表头 46，分隔线 0.5/1，颜色按原标注。法语换行时允许行高增长，不压缩整屏。
- 修正了源 SVG 蒙版导致宝石不可见、卡片图标随长文案拉伸、权益标题错误字体、列比例与分隔线。使用本地字体及授权，来源和哈希见 [asset-sources.json](evidence/p6/asset-sources.json)。
- 为避免承诺未确认业务，移除源稿静态美元价格、月/季/年套餐及不续费文案；候选权益数字、勾选和“无限”替为“未配置”。没有恢复旧的自动匹配业务，也未实现付费编辑帖子。沿用项目通用导航及语言入口；浏览器不绘制假的 iOS 状态栏，Safe Area 硬件效果仍需真机核对。
- 余额/流水、不可用、恢复帮助和购买协议提示缺少直接稿，按相同背景、字体、白色胶囊及面板体系补齐；这不等于用户已签核新视觉。购买协议只是不可购买提示及非约束草案，不是正式条款。
- 截图保留加载脚本及捕获时间。最终权益表修正后更新该状态的 12 张截图；其他状态在修正前样式构建中捕获，其组件样式未改变。依赖 CSS 导致 Vite 的 JS 文件名改变，但重现构建核对到两份 JS 字节 SHA-256 完全相同；旧样式和重现产物在 capture-build 中明确标记为重现证据，未冒充当时保留的包。不能声称每张都来自完全同一个 CSS 包或给出像素一致性百分比。

## 交易和恢复边界

以 Apple 官方 [Transaction.updates](https://developer.apple.com/documentation/storekit/transaction/updates)、[finish](https://developer.apple.com/documentation/storekit/transaction/finish())、[currentEntitlements](https://developer.apple.com/documentation/storekit/transaction/currententitlements) 与 [appAccountToken](https://developer.apple.com/documentation/storekit/product/purchaseoption/appaccounttoken(_:)) 为接口依据。读取的官方 Markdown 留在证据目录。

- 启动监听 + `Transaction.unfinished` 负责未交付事务；非消耗品及订阅历史用于已验证权益状态。恢复由用户明确点击后执行 `AppStore.sync()`；不遍历已结束消耗品历史来重建或重复加币。只处理配置中的商品，未知商品不发权益。
- 不支持把用户输入的“成功”或 H5 提供的签名当作验证；事务必须来自 StoreKit `.verified`、正确商品类型和可匹配账户令牌。缺失/不匹配令牌保留待核对，不将 Apple 购买任意绑定到当前登录者。
- 已验证订阅/非消耗品只保存通用权益记录，检查到期、升级和撤销；**正式 Pro 功能映射、订阅宽限/续费承诺、非续订延期叠加规则尚未冻结，也未交付正式权益解锁。** 不能仅往配置填 SKU 就宣称商业接入完成。
- 取消/失败/待处理不加余额；在页内保留状态反馈。待处理的 Apple 后续批准由监听处理；其商业提示/重试政策仍需随最终商品冻结。未知结果或超时先检查交易，不能把离页/超时当作退款或支付撤销。
- 消耗品退款暂冻结对应环境可消费余额并提示复核，不擅自制造负债或猜测追扣规则。这是保守隔离策略，尚非已确认退款业务。
- 全本地模式不承诺恢复已经消耗的金币、卸载后的旧钱包、跨设备账户绑定或云端余额。真实上线前需确认这些边界，不能静默接未经授权后端。

## 测试环境及仍未完成的部分

`ios/EluvaTests/Fixtures/CommerceQA.storekit` 仅进入测试 bundle，SKU `eluva.qa.coins`、10 枚及测试价格仅是测试夹具，不在正式配置或购买 UI 里售卖。集成测试通过 StoreKit 返回商品与交易，模拟取消/断网、Ask to Buy 待处理 → 批准到账，再恢复检查未重复发币；原生仓储另测失败重放、重复事务、环境和账户隔离、删除墓碑及撤销。**Xcode StoreKitTest 不是 Apple sandbox，更不是实际扣款。** Apple sandbox 标签已实现，但未使用真实沙盒账号交易。

本轮浏览器测试位于独立 `http://127.0.0.1:4182`，保留一个私密 QA 帖与一个公开 QA 帖；账户正式资料仍是 Eluva Demo，所有付费余额为 0。未触碰 P5 等其他 origin 的 QA 对象，未执行额外永久删除。

需要继续完成：

1. 用户确认商品类型、正式商品 ID、发放权益/金币、有效期，以及额度消耗、优先级、周期/时区和 Pro 映射。当前两个问题已提出，尚无回答。
2. 配齐正式 Bundle ID/签名和 App Store Connect 商品；完成订阅（若选择）专属规则、正式购买条款、最终商业 UI 和权益与功能的联动。
3. 蓝湖 Chrome 图层人工复核、缺稿视觉签核，以及原生 UI、软键盘、Safe Area、Apple 沙盒和真实设备交易路径验收。

本轮构建成功不代表签名、安装或真机验收通过；原生测试日志中的模拟失败和 SDK/AppIntents 警告按原样保留，不宣称观察过完整原生界面运行控制台。
