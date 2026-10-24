### 📢 任务修改执行报告

1. **修改了哪些文件：** `public/images/p3/mark-read-background.png`，本报告和 `docs/evidence/mark-read-background-1504-2026-10-20/`；生产构建生成资源及 `ios/Eluva/Web` 同步更新。
2. **每个文件解决了什么问题：** 使用用户最新提供的 `Group 1504@2x.png` 原始透明 PNG，替换原 Group 1503 背景。图片为 626×591，保留其紫色底层卡片、前层渐变卡片、透明边缘与阴影，源文件与项目资源 SHA-256 完全相同。沿用既有专属背景引用和自适应弹窗布局，本轮未修改 CSS、Vue 组件、业务服务或测试代码。
3. **是否影响登录注册流程：** 否，仅替换 CHATS 标记点亮通知已读确认弹窗的背景。
4. **是否影响本地用户数据：** 否，无数据结构变更、迁移或清理。验证使用隔离夹具和临时原生仓库；标记成功后关闭弹窗，失败保留弹窗重试，普通聊天与好友请求未读保持原有行为。
5. **是否检查了 iOS 适配和键盘交互：** 已在 iOS 17.5 模拟器 WKWebView 检查英法两语言，以及 320×568、375×667、375×812、390×844、393×852、430×932 六种视口。12组布局记录检查弹窗、按钮边界和横向溢出；保存英法390×844原生截图并目视核对。浏览器另检查英文390×844、法语320×568。弹窗无输入区，不涉及键盘；本轮未进行真机验证和系统键盘验证。
6. **如何测试本次修改：**
   - 浏览器实际验证标记成功后自动关闭；法语小屏首次保存失败时留窗、随后重试成功关闭。记录见 `browser-flow.json`、`browser-retry.json`。
   - 复用既有 `testEnglishMarkLightNoticesRead`、`testFrenchMarkLightNoticesRead` 两项原生定向测试，2项通过。覆盖六尺寸布局、STORAGE_FAILED失败留窗且两条点亮未读不变、重试关闭、连续点击不重复保存、主页面解除inert、普通聊天未读不变。
   - Vite生产构建、资源审计、iOS同步、模拟器测试构建、无签名iphoneos构建全部通过。dist、ios/Eluva/Web、模拟器App和设备App各235项资源逐文件SHA-256一致。
   - 开发者复测：CHATS右上角更多 → Mark light-up notices as read → 确认新双层卡片背景 → Mark as read；完成后弹窗应消失，点亮通知未读清零。

本轮最新附件为素材权威来源，覆盖此前报告中的 Group 1503 背景记录。原图内容未生成、重绘或改色，既有文字、按钮和弹窗交互继续独立渲染。

未完成项：真机安装与触摸验证仍按用户已确认安排列为待办。Vite现有大于500kB分块提示保留，构建成功；本次资源替换不扩展为分包调整。

证据目录：[本轮验证记录](/Users/linqian/Documents/Eluva/docs/evidence/mark-read-background-1504-2026-10-20)。

![英文390×844 WKWebView截图](/Users/linqian/Documents/Eluva/docs/evidence/mark-read-background-1504-2026-10-20/screenshots/Mark-read-en-390x844-WKWebView.png)
