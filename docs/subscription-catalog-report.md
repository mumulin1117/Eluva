### 📢 任务修改执行报告

1. **修改了哪些文件：**
   - `src/data/subscription-plans.js`：已确认的三档USD展示目录及英法金额格式。
   - `src/views/StoreView.vue`：固定呈现方案，进入只读会员快照，确认后才启动购买。
   - `src/commerce-state.js`：同一操作锁内读取真实Apple商品并购买，保持选中ID、账户校验与快照竞态保护。
   - `src/data/commerce-messages.js`：USD展示说明、检查订阅及失败重试英法文案。
   - `src/domain/commerce.js`：注释明确展示目录与实际付款报价的边界，未改变商品策略或权益模型。
   - `tests/commerce-state.test.js`、`tests/subscriptions.test.js`、`tests/fixtures/membership.html`、`ios/EluvaTests/WebBundleTests.swift`：购买时序、失败、取消、账户及页面回归。
   - `docs/app-flow-and-implementation-plan.md`、本报告、`docs/evidence/subscription-catalog-2026-10-23/`、`ios/Eluva/Web/`：约定、证据及最终资源包。

2. **每个文件解决了什么问题：**
   - 始终按顺序展示月度 `eluva_monthly_promember` / USD4.99、季度 `eluva_quarterly_promember` / USD12.99、年度 `eluva_annualy_promember` / USD39.99。保留用户提供的annualy拼写。三项仍为已确认的同组自动续期订阅，不改周期。
   - 原来的“没有Apple商品返回就不显示方案”被固定目录替代。首屏、切换方案、检查订阅及从权益／流水返回均不调用commerce.products。默认月度选中，选择其他方案不请求Apple，不因部分商品缺失而偷偷切换方案。
   - 点击Continue后在单一critical `store-purchase` 操作中执行products → 验证所选商品和可购买状态 → purchase；传入的是刚取得的Apple displayPrice/currency，不是页面USD常量。加载、取消、失败和重复点击都走原状态，不增加第二套Bridge或绕过StoreKit。
   - 页面明确显示价格以美元计，最终价格和币种在Apple付款确认页确认。原生仍在purchase内再次读取并核对报价、商品类型、周期、订阅组与账户令牌；报价变化失败保留页面并可重试。原生StoreCoordinator无代码修改。
   - 商品读取失败、设备购买受限、所选商品缺失时不调用purchase；目录和选中态保持。浏览器仍不可付款，不产生模拟成功。当前已订阅方案继续禁购；其他方案走既有Apple变更流程。Restore、管理订阅、到期／宽限／取消续订及Mine会员状态保持。
   - 修复同范围内两个竞态：购买／恢复／管理开始后取消旧后台快照，避免晚到数据覆盖新权益；被操作锁拒绝的重复操作不再清空现有状态文案。
   - 不修改页面插画、字体、按钮体系或专属样式。沿用已冻结会员设计 `7574cbf3-7a5f-467f-a7af-6c582c36ee4a`、2026-10-21T10:00:22.325275Z 的现有本地资源；本轮改动来自用户明确的展示／调用方式要求，不把USD展示配置当成蓝湖或Apple实时报价。

3. **是否影响登录注册流程：** 否。未修改认证、验证码、协议同意或资料引导。

4. **是否影响本地用户数据：** 不新增持久化字段，不清空或迁移账户。订阅仍只接受原生验证后保存的交易和到期日；展示配置不发VIP、不延长有效期、不加金币。修复的是内存快照覆盖时序，测试使用隔离数据库和原生临时仓库。

5. **是否检查了 iOS 适配和键盘交互：**
   - 英法六尺寸320×568、375×667、375×812、390×844、393×852、430×932，核对固定三档价格、选中态、无横向溢出、Restore至少44pt及二级页无TabBar。
   - 本页没有输入区，未改键盘逻辑。实体iPhone、真实系统付款界面与沙盒账户验证仍沿用此前待办，不将模拟器或StoreKitTest视为真机。

6. **如何测试本次修改：**
   - `npm test`：134/134通过。新增／调整测试覆盖固定目录、真实EUR报价不被USD覆盖、一个锁内products→purchase、重复确认与Restore互斥、缺所选商品／受限不付款、切账户丢弃晚到报价、恢复不被旧快照覆盖、拒绝重复操作保留状态。
   - 浏览器隔离页面首屏3项且products=0、purchase=0；选择年度后确认，实际产生一次products读取，浏览器原生能力限制失败后仍显示3项并保留年度选择。法语320小屏首屏同样0商品读取且无横向溢出。
   - WKWebView使用实际生产包与唯一Native Bridge，验证英法固定三项、首屏及选择不读取商品、未配置时点击后失败／重试、条款／权益／流水返回、头像框入口与当前会员方案保护。
   - StoreKitTest使用已配置的三档自动续期商品和隔离测试会话，关闭付款对话框并注入取消；核对一次products→purchase、取消文案、无成功交易、无权益／流水。Apple测试框架允许保留failed取消记录，不能把记录存在误判成已支付。
   - 首轮旧Pro状态测试因为离屏WKWebView等待动画帧而挂起，已中止并保留日志，改为可见测试窗口后重跑；首次取消记录断言也已修正。失败和中止批次不计作通过。最终分批结果见verification-summary.json。
   - 最终20项不同原生用例通过、0跳过：最终批次12项Repository／StoreKitTest与4项WKWebView通过，另4项英法目录／头像框用例在首批通过。首批整体中止且包含失败，不将该批次整体标为通过。
   - Vite生产构建、264资源审计／同步、无签名设备构建及最终WKWebView测试构建通过；dist、iOS Web、iOS17模拟器App和无签名设备App的264个资源逐项SHA-256一致。具体结果和截图索引在证据目录。不把旧资源包作为本轮验证。

Apple仍负责发起购买并展示确认界面，依据[Product.purchase(options:)](https://developer.apple.com/documentation/storekit/product/purchase%28options%3A%29)。本轮没有真实扣款，没有修改App Store Connect商品配置。

证据：[本轮目录](./evidence/subscription-catalog-2026-10-23/)，重点文件为verification-summary.json、browser-flow.json、资源哈希、Membership-catalog截图及原生测试日志。

未完成事项：Development Team／真机签名、正式App Store Connect商品实际可读性、真实沙盒Apple付款／恢复／跨设备流程与人工确认系统付款界面。按用户此前“先交付，真机列待办”执行。StoreKitTest关闭付款对话框，不冒称付款界面实测。Vite仍有大于500kB包体提示，原生生命周期有系统日志，不宣称控制台全程无告警。
