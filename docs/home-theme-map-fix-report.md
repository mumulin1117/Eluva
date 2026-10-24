### 📢 任务修改执行报告

1. **修改了哪些文件：** `src/personal.css`、本报告及 `docs/evidence/home-theme-map-2026-10-21/` 验证证据；生产构建同步更新 `ios/Eluva/Web/` 生成资源。未修改 Vue 页面、服务、存储和 Native Bridge。
2. **每个文件解决了什么问题：** 粉色、橙色和青色原来的 `html[data-theme] .page-shell` 背景规则优先级高于首页地图规则，导致 `background-image` 被通用主题渐变图覆盖，空态和内容态均受影响。现在这些规则通过 `:where(:not(.home-shell))` 排除首页，保留原地图。`:where` 不增加选择器权重，其他页面的规则优先级及主题预览保持原样。首页 Tab 图标继续使用选定主题资源；未新增地图素材或滤镜。
3. **是否影响登录注册流程：** 否。认证、EULA、账户创建及账户接口均未修改。
4. **是否影响本地用户数据：** 否。未迁移、清空、删除或覆盖用户数据；主题仍经现有账户偏好服务保存。浏览器使用既有 `home-empty.html` 夹具，在 UUID 独立数据库中构造空态或保留全部十帖的内容态。语言切换仅通过设置入口进行。
5. **是否检查了 iOS 适配和键盘交互：** 四主题 × 英法 × 空态/内容态 × 六尺寸，共96份浏览器截图及DOM记录，均保留地图，无页面横向溢出或缺失图片，TabBar位于视口内；内容态仍为5张动态卡。使用合成安全区，不代表真机安全区结论。首页没有新增输入区域，键盘机制未改动；真实系统键盘和物理设备未验证。
6. **如何测试本次修改：** 全部92项Web测试通过，包括既有主题账户隔离与重新登录恢复测试。iPhone 17／iOS26.5模拟器本地包的4项既有WKWebView测试通过，覆盖英法首页空态、内容分组、返回、失败恢复、草稿保留和发布；这些原生夹具使用紫色，非紫色主题本轮仅在浏览器验证，未将其表述为全主题WKWebView或真机验证。Vite生产构建、资源审计与同步、模拟器构建/测试及无签名设备构建通过；257项资源在dist、iOS源包、模拟器App、设备App四处逐文件SHA-256一致。

设计沿用已冻结的首页地图：空态 `9ceb471c-970d-4817-b764-01eb22189114` 版本1，参考 `docs/evidence/home-empty-2026-10-20/design-reference.json`；内容态沿用现有蓝湖页面 `53ecd7cf-131b-4976-b8c8-52c10658774e`。本轮仅修正背景覆盖，未重新提取或改变设计参数，未宣称本轮重新在线核对蓝湖图层。

证据：
- [修改前（粉色主题）](evidence/home-theme-map-2026-10-21/screenshots/before-pink-empty-en-390x844.jpg)、[修改后同主题](evidence/home-theme-map-2026-10-21/screenshots/after-pink-empty-en-390x844.jpg)。
- [96组视口记录](evidence/home-theme-map-2026-10-21/browser-matrix.json)、[实际设置保存与返回](evidence/home-theme-map-2026-10-21/settings-themes.json)、[验证与资源哈希](evidence/home-theme-map-2026-10-21/verification-summary.json)。
- [Web测试](evidence/home-theme-map-2026-10-21/web-tests.log)、[WKWebView结果](evidence/home-theme-map-2026-10-21/native-test-summary.json)、[原生附件](evidence/home-theme-map-2026-10-21/native-attachments/manifest.json)、[构建](evidence/home-theme-map-2026-10-21/build.log)、[设备目标构建](evidence/home-theme-map-2026-10-21/device-build.log)。

复测：登录后在“个人中心 → 设置 → 主题”选择粉色、橙色或青色并保存，返回首页，确认海岛地图保留且Tab配色更新；紫色主题也保留地图。空态和有内容状态均适用。可运行 `npm run dev -- --port 5187`，访问 `/tests/fixtures/home-empty.html?locale=en&scenario=empty&safe=1`，或将scenario改为content、locale改为fr进入隔离夹具。

限制：物理设备、真实安全区及系统键盘未验证；全主题的WKWebView视觉检查仍待补充。本轮浏览器无warn/error；原生测试退出时仍有既有RBS／WebKit进程终止告警，Vite仍有既有单包超过500kB提醒，未将其称为零告警构建。
