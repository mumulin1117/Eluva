### 📢 任务修改执行报告

1. **修改了哪些文件：** `src/domain/commerce.js`、生成的`public/config/commerce-policy.json`、`ios/Eluva/viu.storekit`、`tests/subscriptions.test.js`、`tests/commerce-state.test.js`、`tests/fixtures/subscriptions.html`、`README.md`、`docs/app-flow-and-implementation-plan.md`和本报告；生产Web资源已同步至iOS。
2. **每个文件解决了什么问题：** 商品策略统一使用用户更正的三个ID，页面目录从该策略派生；Vite构建生成供原生读取的同一JSON。Xcode StoreKit配置改为同组的三档自动续期，替换旧$0.99非消耗品及不完整的月订阅。测试与当前说明同步，增加配置一致性和旧交易保留回归。
3. **是否影响登录注册流程：** 否。未修改认证、路由、Native Bridge或账户服务。
4. **是否影响本地用户数据：** 不清空或迁移交易。历史已验证交易仍保留真实商品ID、原始到期日与账户归属；当前购买目录改为新ID。
5. **是否检查了 iOS 适配和键盘交互：** 本轮未改UI布局、价格文案、Safe Area或输入。没有重复六视口、系统键盘或真机验证；完成Debug／Release打包内容核对。
6. **如何测试本次修改：** 231项Web测试通过，Vite生产构建、265项资源审计／同步、Xcode模拟器Debug与通用iOS无签名Release构建通过。public、dist、iOS/Web及两个App包中策略的三档ID／周期一致，两个App包内StoreKit配置的价格一致。日志见[证据目录](./evidence/subscription-ids-2026-10-24/)。

本轮生效配置：

- 月：`eluva_monthly_promembe`，USD4.99，1个月（P1M）。
- 季度：`eluva_quarterly_promembe`，USD12.99，3个月（P3M）。
- 年：`eluva_annualy_promembe`，USD39.99，1年（P1Y）。

全部按用户给定拼写保留，包括annualy。三项同组自动续期的既有规则不变，Xcode测试组ID保留；会员页面继续直接展示三档目录，确认购买时才读取StoreKit真实商品及报价。购买、取消、pending、恢复、已验证交易保存和Apple到期日计算逻辑均未改动。

未重写历史签名交易的productId，也未将旧SKU映射为新SKU。旧缓存权益可按原已验证到期日继续显示；旧SKU后续真实续费和恢复不是新SKU，本轮不新增其兼容商品目录。测试中保留旧ID仅用于验证历史记录不会被改写或删除，生产目录只包含本轮三个ID。

未登录或修改App Store Connect后台，未进行真机／Apple沙盒实购或恢复，也未实际打开本轮StoreKit付款确认页。Xcode的viu.storekit属于本机测试配置，其结果不能作为真实扣费证据。复测时重新运行Xcode应用，分别选择月、季、年并检查系统付款页商品；正式／沙盒环境仍要求对应App Store Connect应用中的商品ID、类型、周期和可用状态匹配。

已有无用代码清理及执行期间其他未提交修改保持，不纳入本轮订阅配置改动。
