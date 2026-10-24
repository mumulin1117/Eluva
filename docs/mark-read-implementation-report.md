### 📢 任务修改执行报告

2026-10-20，点亮通知批量已读确认弹窗。

1. **修改了哪些文件：** `src/views/ChatsView.vue`、`src/components/AppModal.vue`、`src/social.css`、`public/images/p3/mark-read-background.png`、`tests/fixtures/mark-read.html`、`ios/EluvaTests/WebBundleTests.swift`、本报告和 [验证证据目录](/Users/linqian/Documents/Eluva/docs/evidence/mark-read-2026-10-20)；Vite生成资源与`ios/Eluva/Web`同步更新。
2. **每个文件解决了什么问题：**
   - ChatsView使用独立`mark-read`弹窗变体。提交前检查busy，使用本次选中事件ID快照；现有`social.readEvents`完成持久化与状态同步后关闭弹窗并清理目标ID。保存中禁用操作，失败留在弹窗内显示本地化错误，可点击同一按钮重试；打开时清理旧错误。
   - AppModal仅为该变体增加样式类，继续复用现有遮罩、焦点、内部滚动与释放inert逻辑。
   - social.css仅限定该弹窗，移除旧渐变、边框和圆角底图，使用用户提供的透明PNG作为背景，文字与按钮仍为真实组件。背景随内容高度适配，小屏法语允许按钮换行，未缩小字体。
   - 原PNG按字节复制为英文文件名，没有重绘、裁剪或替代素材。原始608×591；2倍逻辑尺寸304×295.5，与蓝湖slice标注303×295略有差异，记录而未改图。
   - 新夹具使用独立UUID数据库与两个可读点亮事件，支持仅测试用的一次失败和人工释放保存；不进入生产包。原生测试使用临时库、真实本地bundle、既有scheme handler与唯一Native Bridge。
3. **是否影响登录注册流程：** 否，未修改认证、账户服务或协议流程。
4. **是否影响本地用户数据：** 只按现有服务写入当前账户对应点亮事件的已读标记；普通聊天未读消息和好友申请保持不变。没有存储结构迁移或清空数据。
5. **是否检查了 iOS 适配和键盘交互：** 英法六视口320×568、375×667、375×812、390×844、393×852、430×932分别完成浏览器及离屏模拟器WKWebView布局检查。弹窗与操作未超屏，无横向溢出，使用测试合成安全区。弹窗没有输入框，也未修改键盘逻辑；真实设备安全区、系统键盘与真机触摸未验证，继续列为待办。
6. **如何测试本次修改：**
   - `node --test tests/social.test.js`：11项通过，包含定向已读不改普通会话未读数、账户隔离等。
   - 浏览器：成功关闭、取消不改变未读、失败保留弹窗与未读数、重试成功关闭、保存中busy禁用与一次调用；操作结束恢复主页面交互。12张双语尺寸截图见[screenshots](/Users/linqian/Documents/Eluva/docs/evidence/mark-read-2026-10-20/screenshots)。
   - 最终Xcode定向测试：`testEnglishMarkLightNoticesRead`、`testFrenchMarkLightNoticesRead`，2项通过；覆盖新背景、六尺寸边界、STORAGE_FAILED留窗且原2条未读不变、重试关闭、连续点击不重复发送和普通聊天未读数不变。12组原生布局记录及2张截图已导出。
   - Vite构建、资源审计、iOS同步通过；232个文件在dist、iOS源包、模拟器App、设备目标App四处SHA256一致，用户PNG与正式资源字节一致。模拟器构建/测试及iPhoneOS无签名构建成功；无签名构建不代表设备安装或真机验证。

蓝湖核对：`消息--一键已读点亮消息提示`，设计ID `39d224fc-857d-4dd0-a8e4-9bb0eff9c0c0`，本轮接口版本2，更新时间`2026-10-20T13:43:55.030031Z`；Group 1503为背景图层。以用户附件作为本轮素材权威来源。详见[设计记录](/Users/linqian/Documents/Eluva/docs/evidence/mark-read-2026-10-20/design-reference.json)。没有扩展到其他弹窗或重做消息列表。

首轮原生法语在视口切换时触发布局边界断言；独立诊断重跑通过，测试随后补充等待实际内容容器与遮罩宽度同步，再完成最终英法2项测试。首次与诊断日志均保留。结束时存在WebKit RBS/ProcessSuspension进程清理提示，未声称真机控制台无告警。

证据：[交互记录](/Users/linqian/Documents/Eluva/docs/evidence/mark-read-2026-10-20/browser-flow.json)、[浏览器矩阵](/Users/linqian/Documents/Eluva/docs/evidence/mark-read-2026-10-20/browser-matrix.json)、[原生摘要](/Users/linqian/Documents/Eluva/docs/evidence/mark-read-2026-10-20/native-test-summary.json)、[原生附件](/Users/linqian/Documents/Eluva/docs/evidence/mark-read-2026-10-20/native-attachments/manifest.json)、[资源校验](/Users/linqian/Documents/Eluva/docs/evidence/mark-read-2026-10-20/resource-verification.json)。

复测：消息页右上更多 → 标记点亮通知已读 → Mark as read；确认弹窗消失、点亮未读角标归零而聊天角标保持。失败时弹窗内出现错误，重试完成后关闭；Cancel仅关闭，不标记。

![英文390×844浏览器截图](/Users/linqian/Documents/Eluva/docs/evidence/mark-read-2026-10-20/screenshots/confirm-en-390x844.jpg)

![英文390×844离屏WKWebView截图](/Users/linqian/Documents/Eluva/docs/evidence/mark-read-2026-10-20/screenshots/Mark-read-en-390x844-WKWebView.png)
