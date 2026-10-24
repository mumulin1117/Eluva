### 📢 任务修改执行报告

1. **修改了哪些文件：**
   - `src/views/SettingsView.vue`：移除设置页 User agreement 一行，保留 Terms of Service、Privacy Policy、Community Guidelines。
   - `src/components/PageShell.vue`：增加默认关闭的 `sourceBack` 选项，启用时复用设置页的返回切图及 `source-icon` 样式。
   - `src/views/LegalView.vue`：上述三页启用同款返回按钮。
   - `src/styles.css`：仅对启用新按钮的导航栏对齐设置页内边距，包含320px小屏。
   - 本报告、实施计划和证据目录；`ios/Eluva/Web/`同步生产资源。
2. **每个文件解决了什么问题：**
   - 设置入口与最新要求一致。三份法律页返回按钮复用 `/images/p2/back-button.png`，点击区域44×44px，图片40×40px，按压、禁用状态与设置一致；导航内边距为顶部 Safe Area + 14px、左右15px、底部14px。
   - 法律正文、滚动容器和现有 `openLegal/returnLegal` 保留。EULA路由及默认返回样式保留，首次启动同意与欢迎流程不变；不删除已保存的协议同意状态，不删除文案资源。
   - 本轮按用户指定的设置页现有返回按钮统一，没有新增蓝湖参数或素材。
3. **是否影响登录注册流程：** 否。未修改认证、欢迎或协议同意逻辑。浏览器实际查看隐私政策后返回，原 Terms & Policies 弹窗恢复；验证期间没有点击 Agree，也没有写入同意。
4. **是否影响本地用户数据：** 否。未修改账户、法律正文、持久化服务或存储结构。
5. **是否检查了 iOS 适配和键盘交互：**
   - 生产预览检查英文三页×六视口（320×568、375×667、375×812、390×844、393×852、430×932），共18组：按钮尺寸和资源正确、无横向溢出、无TabBar，长正文具备滚动区域。
   - 无新增输入控件，未修改键盘逻辑；Safe Area沿用同一变量。本轮浏览器默认安全区为0，不能据此声称真实设备安全区或键盘复测通过。
   - 本轮未执行法语视觉、WKWebView交互或真机验证。既有本地化测试验证英法字典键、非空、插值等，不能替代法语页面排版检查。
6. **如何测试本次修改：**
   - 180项现有Web测试全部通过，未新增针对小型UI改动的重复测试。
   - Vite生产构建、本地资源审计及265项资源同步通过；保留已有大分块提示。
   - Xcode Debug／generic iOS Simulator构建通过。
   - dist、iOS源资源及Debug模拟器包的265项资源SHA-256逐项一致。
   - 保存英文390×844隐私政策、430×932社区规范截图，以及18组尺寸数据与欢迎返回记录。
   - 复测：设置中只显示三个法律入口；分别进入后用同款圆形返回按钮返回设置，原合理滚动位置保留。首次欢迎仍可打开隐私／条款并返回原协议弹窗。

[六尺寸记录](./evidence/settings-legal-back-2026-10-24/browser-en-six-viewports.json) · [隐私政策截图](./evidence/settings-legal-back-2026-10-24/privacy-390x844-en.png) · [社区规范截图](./evidence/settings-legal-back-2026-10-24/community-430x932-en.png) · [资源一致性](./evidence/settings-legal-back-2026-10-24/resource-consistency.json)
