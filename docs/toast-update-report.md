# Eluva 全局 Toast 修改报告

日期：2026-10-22

## 设计与实现

按用户本轮授权设计统一瞬时提示。没有指定 Toast 蓝湖设计 ID；采用项目现有紫色渐变、浅色叠层、圆角阴影、本地 Plus Jakarta Sans 和 AppIcon 体系。其他页面设计版本保持原有依据。

- 默认位于导航下方：Safe Area + 86px；左右留白16px，小屏12px，最大宽370px。
- 白色至浅紫渐变、23px圆角、白色细边、柔和阴影与背景模糊；粉／橙／青主题使用对应浅色。
- 文案为本地 Plus Jakarta Sans 600／14px／21px，自然换行；关闭触摸区域44×44px。
- 成功、信息、提醒有对应SVG图标；删号等重要完成结果居中，最大宽340px。
- 自动显示4.2～7.5秒，按文案长度计算；支持手动关闭、焦点暂停和减少动态效果。页面操作无需等待。
- 全局只有一个提示；重复提示重新计时，旧计时不能关闭新提示。成功提示允许保留一次返回跳转，之后导航清理；账户切换、退出与后台清理。
- Toast通过Teleport位于body，不受AppModal的背景inert影响；关闭不关闭原弹窗，不抢占输入焦点。

## 修改文件与目的

1. `src/components/AppToast.vue`、`src/toast.css`：全局视觉、计时、动效、关闭、主题和可视区域适配。
2. `src/state.js`、`src/domain/notice.js`：复用notice，新增编号、类型、位置和返回保留规则；全部为内存状态。
3. `src/App.vue`：挂载唯一Toast，移除旧计时器。
4. `src/components/AppIcon.vue`：补充同体系信息和提醒路径。
5. `src/components/ContentShell.vue`、`src/components/PageShell.vue`、`src/components/AuthConversation.vue`：移除旧行内瞬时提示，认证验证码反馈接入统一入口。
6. `src/styles.css`、`src/auth-conversation.css`、`src/profile.css`、`src/membership.css`：清理旧提示专属样式。
7. `src/social-state.js`、`src/personal-state.js`、`src/content-state.js`：按操作产生准确反馈，移除共用Saved默认值，保留显式静默操作。
8. `src/components/CollectionEditor.vue`、`src/components/SocialSafety.vue`、`src/components/IncomingVideoBanner.vue`：接入合集、拉黑／解除和邀请过期提示。
9. `src/views/HomeView.vue`、`src/views/ChatsView.vue`、`src/views/MainView.vue`：统一原有诊断入口反馈，入口仍按原条件隐藏。
10. `src/views/PostComposerView.vue`、`src/views/PostDetailView.vue`、`src/views/SettingsView.vue`：统一发布、保留输入、举报、通知能力、语言更新和删号反馈。
11. `src/views/VideoCallView.vue`、`src/video-connecting.css`：等待通话控制改用全局Toast，移除独立底部提示和重复计时器。
12. `src/data/toast-messages.js`、`src/i18n.js`、`src/data/content-messages.js`、`src/data/social-messages.js`、`src/data/personal-messages.js`、`src/data/realtime-messages.js`、`src/data/commerce-messages.js`：更新英法反馈及订阅完成状态文案。
13. `tests/notice.test.js`、`tests/fixtures/toast.html`：生命周期、账户隔离、语义、禁用措辞和隔离视觉夹具。
14. `ios/EluvaTests/WebBundleTests.swift`：英法实际操作集成验证，更新通话与静默操作回归选择器。
15. `docs/app-flow-and-implementation-plan.md`、本报告及证据目录：同步规则和验证结果。
16. `dist/`、`ios/Eluva/Web/`：生产构建与iOS资源同步产物。

## 文案与业务边界

- 资料：Your profile is up to date.／Votre profil est à jour.
- 主题：Your new theme is ready.／Votre nouveau thème est prêt.
- 新建合集：Your collection is ready.／Votre collection est prête.
- 已读：All Light-Ups are marked as read.／Toutes les illuminations sont marquées comme lues.
- 举报：Thank you for helping keep Eluva safe.／Merci de contribuer à la sécurité d’Eluva.
- 反馈：Thank you for sharing your feedback.／Merci d’avoir partagé votre avis.
- 拉黑反馈说明动态、会话已隐藏；解除使用对应结果。
- 验证码只提示输入六位验证码，不声称真实邮件已发送。固定567567及原校验不变。
- 可达Toast均有英法覆盖，并检查local、demo、saved、record(ed)、diagnostic、browser及法语对应测试措辞。
- 消息发送、Help Buddy发送、关注与取消关注继续静默更新；Reply与introduction正式确认弹窗保留。
- 表单错误、读取失败、输入校验和权限拒绝保留持久错误与重试入口。订阅环境标识、Apple交易和恢复规则不变。
- 未修改账户、关系、消息、动态、订阅的持久化模型；未清空或迁移用户数据。

## 验证结果与证据

1. `npm test`：115通过，0失败。覆盖语义、重复提示、旧计时关闭、返回、退出和账户切换、英法措辞。
2. 浏览器EN／FR×六视口：320×568、375×667、375×812、390×844、393×852、430×932。全部无横向溢出，关闭按钮44px；法语长提示小屏自然增高到106px。见[矩阵记录](./evidence/toast-2026-10-22/browser-matrix.json)及同目录截图。
3. 浏览器另验四主题、居中长文案、手动关闭、自动消失、退出清理、AppModal共存。居中法语长文案在320×568下高127px，完整可读可操作。见[附加记录](./evidence/toast-2026-10-22/browser-lifecycle-and-themes.json)。
4. iPhone17／iOS26.5模拟器，生产包WKWebView：10项集成测试全部通过。新增EN／FR实际主题保存的六尺寸、失败保留选项、重试、重复续时、自动消失、关闭与弹窗共存；回归聊天／Help Buddy／关注静默、Reply正式弹窗、点亮已读和视频等待控制。见[汇总](./evidence/toast-2026-10-22/validation-summary.json)。
5. WKWebView尺寸记录：[英文](./evidence/toast-2026-10-22/Toast-en-layout-and-lifecycle.json)、[法文](./evidence/toast-2026-10-22/Toast-fr-layout-and-lifecycle.json)。基准截图：[英文](./evidence/toast-2026-10-22/Toast-en-390x844-WKWebView.png)、[法文](./evidence/toast-2026-10-22/Toast-fr-390x844-WKWebView.png)。
6. `npm run build`：Vite构建、资源审计与同步通过。264项资源在dist、iOS Web、模拟器App、无签名设备App四处SHA-256一致。见[资源核对](./evidence/toast-2026-10-22/resource-integrity.json)。
7. Xcode模拟器构建／测试通过，结果包`.build/toast-20261022-final.xcresult`；无签名generic iOS设备构建通过。测试日志未匹配到约束冲突和资源缺失；模拟器WebContent退出存在RBS／ProcessSuspension警告。

最初离屏计时测试被WebKit挂起，改为可见UIWindow重跑；测试对离场动画的选择器亦已修正。最终以上述通过结果包为准。

## 复测步骤

1. 个人中心→设置→主题，保存后返回设置页：导航下出现主题反馈，可关闭并会自动消失。
2. 更新资料、合集、发布、举报、反馈、拉黑，核对对应反馈；失败保留输入和重试，不出现成功提示。
3. CHATS点亮消息全部已读：动作完成、确认弹窗关闭，出现准确反馈。
4. 视频等待页点击功能按钮显示顶部提示，挂断返回清理提示。
5. 切换英法及主题；长提示完整显示，连续操作不堆叠多个提示。
6. 核对发送消息／Help Buddy／关注／取消关注没有Saved提示，Reply仍为正式确认弹窗。

## 待办与限制

- 真机安装、真机视觉及真实系统键盘下的Toast专项验证未执行，沿用此前用户批准的真机待办。
- 输入编辑与键盘监听复用既有实现，未新增输入表单。本次WKWebView测试窗口使用注入Safe Area完成六尺寸检查；不包含伪造状态栏。
- Vite仍有既有主JS chunk超过500kB提示；本轮未扩展代码拆包范围。
- 浏览器、模拟器WKWebView、无签名设备编译结果分别记录，不代表真机验证。
