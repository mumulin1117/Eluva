### 📢 任务修改执行报告

1. **修改了哪些文件：** 新增 `src/services/touch-policy.js`；修改 `App.vue`、`router.js`、`services/bridge.js`、`styles.css`，以及 `AppModal`、`ContentShell`、`PageShell`、`AuthConversation`、`PostImageCarousel`、`HomeHelpModal`、`ChatsPager`、`PullToRefresh`、`VoiceRecorder`、`VideoPlayer`、`VoiceMessage`；修正 `post-detail.css`、`profile.css`、`personal.css` 的触摸区域与小屏排版，补齐 `views/ConversationView.vue` 遗漏的状态导入，更新实施计划。逐项职责见下方。
2. **每个文件解决了什么问题：** 补齐触摸取消、捕获释放、横滑与纵滚区分、后台及离页清理，阻止滑动后的误点击；修复媒体迟到结果恢复播放的竞态。禁止普通内容系统拖拽、提取菜单及选字，同时保留输入与可编辑文字的选字、复制粘贴和输入法；空白收键盘与遮罩关闭改为完整点击触发。现有原子提交与购买／发送防重继续复用。
3. **是否影响登录注册流程：** 仅共用输入与空白收键盘行为，不改变注册资料顺序、校验、验证码、同意状态或账户创建。欢迎页首次协议照常显示。
4. **是否影响本地用户数据：** 无存储结构、账户或持久化业务规则变更；不删除动态、会话、草稿或订阅。已提交的关键写入不会因 App 暂时进入后台而被当作未完成手势撤销；仍由现有 busy、导航保护、幂等与真实交易回调处理。
5. **是否检查了 iOS 适配和键盘交互：** 保留现有 Safe Area、visualViewport 和主滚动容器。输入保护覆盖 input、textarea、有效 contenteditable 与其文本后代；不可编辑的内联表情仍不开放图片菜单。英法尺寸及浏览器交互结果见下方证据；独立 iPhone 17／iOS 26.5 模拟器已安装正式包，实际 WKWebView 首屏显示正常。实体 iPhone 长按、系统编辑菜单、软键盘及原生录音权限未复测，不能以浏览器结果替代。
6. **如何测试本次修改：** 61 个 JavaScript 模块、55 个 Vue 组件脚本／模板、24 个 CSS 文件编译无错误；Vite 生产构建及 265 项资源审计／iOS 同步通过；Xcode 签名模拟器 Debug、无签名 iOS Release 均成功。dist、iOS Web、Debug App、Release App 的 265 项运行资源逐字节一致，同步元数据清单单独校验。遵照上一条删除测试代码的要求，不恢复或新增测试源码、测试 target、故障注入或专用夹具。

文件职责：

- `touch-policy.js`：集中安装／移除 contextmenu、selectstart、dragstart 捕获监听。按实际可编辑状态放行输入能力，禁止图片／SVG／按钮拖拽；不拦截 copy、paste、beforeinput 或 composition 事件。
- `App.vue`：安装触摸策略，visualViewport 对有效编辑器保持可见；后台／pagehide 通知组件取消临时交互。
- `router.js`：原导航保护允许离开后，统一通知取消临时手势；原数据读取取消和账户／安全路由继续使用原链路。
- `services/bridge.js`：原生宿主已失效或取消消息无法投递时，本地 Promise 仍按 CANCELLED／TIMEOUT 结束并清理等待，迟到响应继续丢弃。
- `AppModal.vue`：打开弹层先中断背景手势／媒体，随后按原 modal stack 设置 inert；完整点击遮罩才关闭。`ContentShell.vue`、`PageShell.vue`、`AuthConversation.vue`：空白完整点击才收键盘，不在开始滚动的 pointerdown 阶段打断编辑，不把编辑器内部节点误判为空白。
- `PostImageCarousel.vue`：滑动方向锁定、纵滚与拖动后抑制误开图片、pointercancel／lostpointercapture 释放捕获；后台、离屏、弹层、导航和销毁取消手势。原轮播间隔与暂停语义保持。
- `HomeHelpModal.vue`：主指针与轴向判断、捕获异常及后台／离页释放；分页按钮实际触摸范围至少 44×44，保留小条图形。
- `ChatsPager.vue`、`PullToRefresh.vue`：修复触摸 fallback 忽略 pointercancel 的路径，追踪实际触点并处理多指取消；释放时复核 disabled、modal、hidden，避免取消后切换分类或刷新。横滑、纵滚、下拉互斥，连续刷新仍由 refreshing/requested 防重。
- `VoiceRecorder.vue`：触摸与键盘按住不互相重复启动；异常捕获安全释放；后台、离页、禁用或更换目标取消录音、权限等待及导入。过期导入结果丢弃并清理暂存；导入、录制和设置请求互斥。
- `VideoPlayer.vue`：单次 play 请求 busy、请求意图与代次校验；暂停／后台后迟到 play 不恢复播放。`VoiceMessage.vue`：播放及拖动进度请求互斥，代次、AbortSignal、指定播放 ID 清理迟到结果，停止轮询并移除监听。
- `post-detail.css`：小分页条放在 44×44 点击区，扩展控制容器避免裁切。`profile.css`：举报原因最小高度 44。`personal.css`：照片移除按钮扩为 44×44，底部链接最小高度 44 并允许法语换行。
- `styles.css`：普通内容禁选字／菜单，编辑区恢复原生文本能力，原子内联图片保留禁提取；不增加 hover 交互。
- `views/ConversationView.vue`：真实 UI 复测发现此前返回恢复代码使用 `social` 却未导入，造成打开会话空白；补上同一状态模块的导入，保留原会话、草稿与权限链路。该问题来自前一轮改动，此轮已修正并重新构建。

证据：

- [源码编译](./evidence/iphone-touch-2026-10-24/source-compilation.json)
- [Vue 自由标识符检查](./evidence/iphone-touch-2026-10-24/vue-reference-audit.json)：55 个组件，额外引用经复核为 Vue `defineOptions` 宏及 Window `innerHeight`，没有新增未解决引用。
- [生产浏览器检查](./evidence/iphone-touch-2026-10-24/browser-smoke.json)：英语／法语 Home 与 Chats 六尺寸共24组横向溢出为0。实际浏览器指针拖动实现 All↔Follow、纵向滚动保持分类、下拉释放刷新、帮助轮播；帮助分页44×44，首页 Light Up 视觉38px加上下各3px命中扩展，elementFromPoint 确认扩展有效。Help Buddy textarea 及会话 contenteditable 实际全选、复制、粘贴通过，随后恢复空草稿，未发送；普通文本 user-select:none、编辑区 text。进入已有会话会依正常业务标记已读，不改变消息内容或关系。法语、All分类已恢复，浏览器临时页已关闭。
- [Vite／资源同步](./evidence/iphone-touch-2026-10-24/vite-build.log)、[Debug](./evidence/iphone-touch-2026-10-24/xcode-debug.log)、[Release](./evidence/iphone-touch-2026-10-24/xcode-release.log)、[资源一致性](./evidence/iphone-touch-2026-10-24/resource-audit.json)
- [实际 WK 首屏](./evidence/iphone-touch-2026-10-24/wk-production-first-screen.png)、[WK 启动日志](./evidence/iphone-touch-2026-10-24/wk-production-startup.log)：显示 Vue guide 与首次协议；日志有首次非空布局及有效绘制。首轮独立验证设备起初为 Shutdown，确认状态并启动后安装成功；修复会话导入后，最终包在新建独立设备上重新安装、启动并保存此截图和日志。没有操作用户正在运行的设备。

复测建议：在实体 iPhone 上分别执行录音按住→松开、上滑取消、系统中断与后台；轮播横滑→纵滚、拖动中离页、弹层打开、指针捕获丢失；输入选字／复制粘贴／法语输入法及软键盘收起；连续点发送／订阅观察单次 busy 和实际结果。权限拒绝、真实 Apple 付款与真机媒体本轮未执行。

浏览器检查没有注入 pointercancel／lostpointercapture，也没有实际触摸或软键盘；这两类取消路径本轮仅完成代码复核和编译。聊天 `social` 导入缺失的原始错误与修复后无新增错误的结果均保留在浏览器证据内，不用后续成功覆盖原始发现。

构建保留 Vite 既有大包警告和 Xcode 无 AppIntents 依赖提示；模拟器日志存在系统 ExtensionKit 网络子进程配置及 WebPrivacy 规则列表告警，实际本地首屏正常，未见持续资源缺失或 Auto Layout 冲突。此首屏检查不代表全业务真机验收。
