### 📢 任务修改执行报告

1. **修改了哪些文件：** `src/components/AppModal.vue`、`src/components/ConnectionAction.vue`、`src/views/PostDetailView.vue`、新增 `src/connection-modal.css`、新增 `public/images/p3/connection-star.png`、`ios/EluvaTests/WebBundleTests.swift`、本报告及证据；Web生产资源已同步至iOS。
2. **每个文件解决了什么问题：**
   - AppModal仅新增connection提示变体，复用既有焦点约束、inert背景、遮罩、视觉视口和清理机制。采用用户提供的星星原PNG；叠层背景与现有mark-read-background.png字节相同，直接复用。标题Poppins 700 20/30、正文400 15/23、按钮Plus Jakarta Sans 600 14/18，黑色胶囊确认按钮、白色关闭图标。
   - ConnectionAction只将介绍说明/已发送/等待等信息状态改为叠层提示卡。介绍输入分支保持原来的布局；既有介绍发送成功后保留弹窗并显示等待说明，停止仅用底部notice反馈。
   - PostDetailView发送前的Reply输入框已恢复原始底部sheet、输入与顶部Send，不使用星星输入卡。仅在保存成功后自动打开“Reply sent”星星提示；关闭后再次点击Reply打开同体系等待提示，无第二个输入框。失败保留原输入；成功关闭后恢复Reply按钮焦点。
   - 不复活蓝湖旧“单向关注即可聊天”规则。跨动态一次待回复、实际回复或互关解锁、拉黑优先等服务规则均保持原样，没有新通信协议或重复数据链路。
3. **是否影响登录注册流程：** 否。没有认证、账户或验证码变更。
4. **是否影响本地用户数据：** 没有数据模型、迁移、存储接口或历史数据改动。沿用现有request/replyPost提交，重复提交和失败回滚仍由既有服务处理；仅调整成功后的UI反馈。成功后按原规则清空已提交的Reply草稿，失败保留。
5. **是否检查了 iOS 适配和键盘交互：** 三种实际发送后的状态（sent、waiting、主页A little introduction）×英法×六尺寸共36组最终浏览器截图和布局记录通过，无横向溢出、表单误露或底部toast；按钮、标题、插画和背景均检查。小屏保持真实布局及必要内部滚动。输入框样式恢复，原生Reply测试中的聚焦及空白收焦点仍通过。真实系统键盘、实体iPhone和真实手势未验证。
6. **如何测试本次修改：**
   - social.test.js相关14项通过，覆盖关系权限、一次请求、Reply去重、失败回滚、拉黑和账户隔离。
   - 最终Xcode定向6项通过：英法动态详情、主页安全/合集、标记点亮已读。动态详情新增断言：失败保留输入，重试成功自动出现connection弹窗且无inline-notice，关闭恢复背景交互，再次点击显示等待弹窗且无输入框。
   - 浏览器实际从原始Reply输入框提交，验证失败重试→成功提示→关闭→再次打开等待提示→进入主页后的介绍提示。测试隔离数据库，不改用户的现有资料。
   - Vite生产构建、审计、资源同步、模拟器测试构建和无签名iPhoneOS构建通过。dist、iOS源Web、模拟器App及设备App各253个资源哈希一致；两张正式素材与用户文件字节一致。
   - 开发复测：打开 `/tests/fixtures/post-detail.html?locale=en&scenario=lit&safe=1&controls=1`，点Reply，输入消息，使用Fail next Reply检查保留输入；重试成功应直接弹出星星提示，再点Done及灰色Reply检查等待提示。法语改locale=fr。

设计依据：蓝湖「弹窗--未关注时不能聊天」ID `832996a1-461b-40c3-8da0-17110221f7ff`，版本1，更新时间 `2026-10-13T15:14:57.256563Z`。采用用户附件作为整体风格参考，使用原始PNG，不把完整页面截图作为UI。内容高度、312px外层装饰宽度和插画在短视口下的收缩属于必要适配。完整Schema读取回退标注；原稿image27淡星纹没有独立资源，未伪造该装饰，未声称整页逐像素一致。

证据位于[最终证据目录](/Users/linqian/Documents/Eluva/docs/evidence/connection-modal-2026-10-20)：browser-matrix.json、browser-flow.json、native-test-summary.json、native-final/、wkwebview-final.log及resource-verification.json。first-attempt/和native-attachments/为用户纠正范围前的迭代记录，不能作为最终输入框样式依据。WKWebView定向测试通过；本轮提示框的可视截图来自浏览器，未替代真机或WKWebView可视截图。原有Vite分块提示、WebKit进程回收系统日志保留。

![发送成功后的提示，英文390×844浏览器](/Users/linqian/Documents/Eluva/docs/evidence/connection-modal-2026-10-20/screenshots/sent-en-390x844.jpg)
