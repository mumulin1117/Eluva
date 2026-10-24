### 📢 任务修改执行报告

1. **修改了哪些文件：**
   - `src/views/StoreView.vue`：两个购买说明弹窗显式复用居中connection提示；移除余额入口，为Purchase help增加专属类，正文独立包裹。
   - `src/membership.css`：Purchase help独占居中一行、至少44px点击高度，两个正文段落间隔12px。仅页面类生效。
   - `src/data/commerce-messages.js`：英法超时说明由“查看余额和交易”改为使用Restore检查订阅，避免指向已移除的入口。
   - `ios/EluvaTests/WebBundleTests.swift`：调整现有会员呈现回归中依赖余额入口的断言，验证两弹窗、帮助居中及关闭恢复。
   - `docs/app-flow-and-implementation-plan.md`、本报告及`docs/evidence/subscription-notices-2026-10-24/`；`ios/Eluva/Web/`同步生产资源。
2. **每个文件解决了什么问题：**
   - Services Purchase Agreement与Purchase help从普通底部弹层改为现有信息提示体系，与Collections帮助、Reply状态提示一致：使用既有本地星星PNG、叠层卡片背景、Poppins标题／正文及黑色Done按钮；没有新增插画或独立通信／业务链路，不冒称蓝湖新增同名稿。
   - 直接使用`AppModal centered variant="connection"`，共享AppModal、connection-modal.css及其他页面均未修改。长正文沿用内部滚动，头部、关闭和确认按钮保持可见；Done、关闭叉、Escape、遮罩关闭沿用现有机制，背景inert、焦点约束及关闭恢复保持。
   - 删除订阅页Balance & activity入口，Purchase help单独占一行并居中；保留Manage、Check subscription和Restore。钱包路由、余额、配额、账本和历史交易不删除。
   - 原协议与帮助正文保持，三档目录、选中套餐、购买、恢复、检查订阅、失败提示布局及会员到期显示保持。仅超时辅助说明随入口移除作必要调整。
3. **是否影响登录注册流程：** 否。
4. **是否影响本地用户数据：** 否。不改商品、权益、交易、余额或账户持久化；测试使用隔离仓库与WK数据，不清空用户数据，不执行真实购买或恢复。
5. **是否检查了 iOS 适配和键盘交互：** 英法六尺寸320×568、375×667、375×812、390×844、393×852、430×932：两种弹窗共24组，会员目录及两种购买失败状态继续回归36组。小屏法语正文可滚到底，头尾和至少44px操作区保持可见，无横向溢出；帮助入口每组均检测文字居中、行中心与页面中心一致。使用一个iPhone17／iOS26.5模拟器调整WK尺寸和安全区，不等于六种真机。弹窗无输入框，未修改键盘；真机待复核。
6. **如何测试本次修改：**
   - 180项Web自动化通过。
   - Vite生产构建、265项本地资源审计和iOS同步通过。
   - 无签名设备Release构建通过。
   - `testEnglishMembershipPresentation`、`testFrenchMembershipPresentation`通过，零失败／跳过；每两种弹窗在六尺寸检测本地素材、标题／按钮、正文滚动、安全区、重复点击仅一个弹窗、焦点约束和四种关闭路径。关闭恢复触发按钮、原滚动位置、原套餐；弹窗交互未增加Apple商品读取或购买调用。
   - 保留原目录、三档价格、选择状态、失败重试及“不配置商品／Apple商品不可用”隔离夹具；该验证不代表真实Apple支付／恢复已完成。
   - 导出8张弹窗截图、48张既有目录／错误截图和对应JSON；已查看英文390×844协议与法语320×568购买帮助，小屏可滚动正文并始终显示确认按钮。
   - dist、iOS源资源、模拟器Debug包及无签名设备Release包的265项运行资源逐项SHA-256一致；预期的同步索引另行校验。
   - 保留既有Vite大分块提示、测试UIApplication.windows弃用及模拟器WebKit回收诊断，未扩展到无关修复。
   - 复测：打开订阅页底部协议→查看居中提示→滚动正文→Done／关闭返回；打开居中的Purchase help→关闭后原套餐及位置保留。余额入口不再出现，Restore及Check subscription仍可用。

[验证汇总](./evidence/subscription-notices-2026-10-24/verification-summary.json) · [截图索引](./evidence/subscription-notices-2026-10-24/wk-attachments.json) · [资源一致性](./evidence/subscription-notices-2026-10-24/resource-consistency.json)
