### 📢 任务修改执行报告

1. **修改了哪些文件：** `src/components/PostImageCarousel.vue`、`src/services/image-carousel.js`、`src/components/PostCard.vue`、`src/views/ProfileView.vue`、`src/content.css`、`src/data/content-messages.js`、`tests/image-carousel.test.js`、`ios/EluvaTests/WebBundleTests.swift`、`scripts/audit-post-carousel.py`、README、实施计划与本报告；生产 Web 资源已同步至 `ios/Eluva/Web`。文件用途及前后哈希见 [source-files.json](evidence/post-carousel-2026-10-19/source-files.json)。
2. **每个文件解决了什么问题：** 新组件和单一可取消计时器让他人主页的多图动态每次展示一张，并按原数组顺序自动循环。PostCard 与 ProfileView 仅在他人主页启用轮播，复用既有查看器打开当前图片；正文仍打开动态详情。CSS 修复示例卡片 `contain` 覆盖导致的 Home 图片留边，统一为 `cover` + 居中裁切，并提高紫色背景上分页/暂停控件的对比度。双语文案覆盖打开图片、暂停、继续。测试验证计时互斥、独立暂停条件、旧回调失效及卸载清理；WKWebView 测试补充等待可视高度 CSS 更新后再测量，保留原尺寸断言。
3. **是否影响登录注册流程：** 否，没有改动账户、凭证、验证码、注册页面或认证服务。
4. **是否影响本地用户数据：** 否，没有数据库迁移或持久化字段变化，20 位人物、10 条示例帖、原图、关系、消息及所有用户数据保留。当前图片、暂停偏好和计时器仅在组件内存中；切语言保留选图，离开后重新进入从第一张开始，页面原有返回及滚动恢复继续复用。
5. **是否检查了 iOS 适配和键盘交互：** Home、他人主页两图、三图状态均完成 en/fr × 六视口，共 36 张真实浏览器矩阵截图。检查图片加载、等比填充、页面宽度、分页控件和 TabBar；他人主页不显示 TabBar。没有修改键盘/Safe Area 代码；本轮没有完成原生界面中的轮播触摸、系统键盘或真机验证。离屏 WKWebView 资源测试与浏览器截图均不能替代这些结论。
6. **如何测试本次修改：** Web 74 项测试通过；本轮重新执行 2 项本地包 WKWebView 集成测试（双语共 12 份 DOM 观察），Vite、资源同步、模拟器及无签名设备目标构建通过。四组 213 个 Web 资源逐文件核对 SHA-256。浏览器实际确认自动换图、暂停、分页、鼠标模拟滑动、键盘左右切换、语言弹层暂停、切语言保持选图、打开当前图片和返回路径。详情见 [验证摘要](evidence/post-carousel-2026-10-19/verification-summary.json)、[截图矩阵](evidence/post-carousel-2026-10-19/browser-matrix.json)及 [轮播实际观察](evidence/post-carousel-2026-10-19/carousel-behavior.json)。

行为与边界

- 多图只在他人主页自动轮播，单图不启动计时；本人资料、我的帖子、合集及 Home 不增加自动轮播。
- 当前展示间隔为 4 秒，可调整；触摸/键盘操作时暂停，手动选图后重新计时。分页和暂停/继续触摸区均为 44×44。
- 进入图片查看器时携带当前图片序号；查看器继续使用原有返回到动态详情、再回主页的导航规则。
- 图片加载期间、加载失败、画面离屏不足四分之一、文档后台、语言/安全等弹层使页面 inert、键盘焦点停留以及用户主动暂停时不自动换图。恢复条件全部解除后重新开始完整间隔，不补跑错过的帧。加载失败保留正文、手动切图与重试入口。
- 遵循系统减少动态效果偏好，关闭自动推进，仍可手动选图。没有引入额外动画库、原生通信协议、远程资源或合成图。
- 左右滑动切图，纵向手势留给页面滚动；处理 pointerup、pointercancel、lostpointercapture，滑动不会误打开详情。浏览器已验证鼠标模拟滑动，真实 iPhone 手指取消/系统中断仍待设备复查。
- 切换语言不会重建当前图片；自动变化不触发无意义的读屏播报。离页取消唯一计时器、可见性/媒体偏好监听和观察器，旧定时回调不能更新已卸载页面。

设计核对

本轮重新读取蓝湖：`首页` ID `53ecd7cf-131b-4976-b8c8-52c10658774e`、`他人用户主页--未关注` ID `02fd48f0-1c13-4a41-a54f-418bcfcb437a`、`他人用户主页--已关注` ID `329febca-a76a-49b9-b797-8c1ba259d194`，均为版本 1、195×422 画布（对应既有 2 倍逻辑基准）。页面更新时间、切图与样式元数据保存在 [design-sources.json](evidence/post-carousel-2026-10-19/design-sources.json)。本轮用户明确的轮播和填充要求优先；字体、背景、头像、原始图像和其他布局沿用现有本地资源，没有整屏固定缩放或重绘素材。

本轮发现并修正的问题

首次浏览器复查发现直接作为类成员调用浏览器定时器会产生 `Illegal invocation`；已改为普通函数包装，实际自动换图通过，修正后控制台记录无新增错误。首次尝试截图/日志保留在 `attempt-before-timer-fix/` 和 `logs/browser-before-timer-fix.json`，不计入最终 36 张矩阵。

首次 WKWebView 集成测试中，英语 320×568 的测量曾在旧可视高度仍为 844 时发生，页脚底部报 824 > 569。测试现等待 `innerWidth`、`innerHeight` 和既有 `--visual-height` 都完成更新再执行原断言，复跑通过；没有放宽页脚尺寸断言或修改认证布局。失败日志和结果包继续保留，最终结果单独记录。测试结束仍有 WebKit RBS / ProcessSuspension 系统日志，不宣称控制台全程无告警。

开发者复查

1. 固定测试账号登录 Home，检查推荐图片无两侧空白且未拉伸；小屏图片高度沿用原布局。
2. 点亮 Leo Martin 或 Lily Bennett 的动态并打开资料，将动态滚到可见区域；分别检查两图与三图自动循环、分页、暂停和继续。
3. 打开语言弹层停留超过 4 秒，当前图片应保持；选择另一语言，图序号仍保持。
4. 左右滑动应仅切图，纵向滑动应滚动页面；点击当前图片应打开同一张查看器，返回路径正确。
5. 离开主页或将应用切后台，检查没有继续可见换图或积累回调；减少动态效果打开时只保留手动切图。后三项设备交互需在 iPhone WKWebView 上复查。
6. `npm test`、`ELUVA_EVIDENCE_DIR=docs/evidence/post-carousel-2026-10-19 npm run build` 可复跑自动化及生产构建；`python3 scripts/audit-post-carousel.py` 复查保存的截图实际像素、DOM、测试结果及四份资源，不驱动 UI 或修改截图。原生仅执行本轮影响相关的 `WebBundleTests`，没有宣称重跑所有历史 47 项原生测试。
