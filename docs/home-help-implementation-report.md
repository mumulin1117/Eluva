### 📢 任务修改执行报告

1. **修改了哪些文件：** 新增 `src/components/HomeHelpModal.vue`、`src/data/home-help.js`、`public/images/home-help/step-1.png` 至 `step-4.png`；修改 `src/components/AppModal.vue`、`src/components/ContentShell.vue`、`src/views/HomeView.vue`、`src/data/content-messages.js`、`ios/EluvaTests/WebBundleTests.swift`、`docs/app-flow-and-implementation-plan.md`；新增本报告及 `docs/evidence/home-help-2026-10-19/`。生产构建同步更新 `ios/Eluva/Web/` 生成资源。
2. **每个文件解决了什么问题：** HomeHelpModal 复用 AppModal、ActionButton 实现四页图文、分页、手势、键盘、加载／失败／重试和清理；home-help 数据文件对应四个设计 ID 与原始图层位置；四张 PNG 是从蓝湖 SVG 内嵌数据直接解码得到的原始透明插画，未改动像素，也没有英文文字；AppModal 增加默认不影响旧弹窗的隐藏标题和遮罩关闭配置，以及帮助专属样式标识；ContentShell 转发入口事件并在首页未就绪时禁用帮助；HomeView 使用独立 helpOpen 状态，首次定位引导继续使用原 guideStep／guideDone，防止叠加；content-messages 提供英法四页文案、按钮、分页及图片错误提示；WebBundleTests 扩展实际本地包集成验证并加入仅测试使用的图片失败代理；实施计划区分手动帮助和首次引导，记录已确认交互与保存边界。
3. **是否影响登录注册流程：** 未改动认证服务、账户接口、EULA 或注册规则。因复用 AppModal，最终运行英法认证／EULA 的既有 WKWebView 回归，均通过。
4. **是否影响本地用户数据：** 不修改存储结构，不删除或覆盖账户、动态、关系、草稿、筛选及引导记录。手动帮助不请求账户／内容服务，不读写 guideDone；当前页与图片状态只存在于弹窗生命周期内。原生测试将隔离测试库中的 guideDone 设为 false，验证完整查看、失败重试和关闭后仍为 false，且没有新增 content.preferences 或 content.snapshot 调用。设置页语言验证后已恢复原英语偏好。
5. **是否检查了 iOS 适配和键盘交互：** 四页 × en/fr × 六视口（320×568、375×667、375×812、390×844、393×852、430×932），完成 48 张浏览器截图与 48 份帮助状态的离屏 WKWebView DOM 观察。英文设计基准下四页均为 x=15、y=174、360×457，按钮始终位于可视区域；法语长文案可增高，不裁切。浏览器实际检查左右拖动、分页、方向键、Esc、Skip、末页关闭、重新打开和焦点恢复。没有修改系统键盘逻辑；真实 Safe Area、iPhone 手指触摸、系统键盘和真机未验证。
6. **如何测试本次修改：** Web 全套 84 项通过；最终 4 项 WebBundleTests 通过，包含英法帮助与共享认证／EULA 回归；Vite、219 项资源同步、模拟器及无签名设备目标构建通过。Vite／iOS 源包／模拟器 App／无签名设备 App 四份资源逐文件 SHA-256 一致，四张生产插画与 SVG 提取原始字节 SHA-256 一致。详见[验证摘要](evidence/home-help-2026-10-19/verification-summary.json)、[截图矩阵](evidence/home-help-2026-10-19/browser-matrix.json)、[实际交互记录](evidence/home-help-2026-10-19/browser-flow.json)、[WKWebView 附件](evidence/home-help-2026-10-19/native-attachments/manifest.json)及[视觉核对](evidence/home-help-2026-10-19/visual-audit.json)。

本轮设计依据为蓝湖“首页-使用帮助1～4”，均为切图接口标识的“版本1”。最新更新时间、设计 ID 与切图图层 ID 保存在[设计映射](evidence/home-help-2026-10-19/design-reference.json)，SVG、原稿图片和提取清单保存在 `docs/evidence/home-help-2026-10-19/source/`。195×422 是目录预览尺寸，逻辑画布为 390×844；没有将整页图片缩放成页面。第4页裁切位置由源 SVG 的 pattern 变换计算，保留原始 PNG，再用 CSS 映射原图层。

在 390×844 英语基准下逐页核对：白色弹窗 360×457；图文区 360×360，上角20、下角34；渐变 #BB7DFD → #7F3BEF；正文 Poppins 500、17px／26px；按钮 Plus Jakarta Sans 600、14px／18px、159×48；按钮间距12、白色区上下内边距24／25；分页激活50×4，其余20×4，间距4。插画、渐变、正文和控件分别渲染，不使用整页截图或带英文的组合切图作为正式组件。

保留蓝湖第一、三、四页英文；第二页将旧 like 术语替换为 Eluva 的 Light up，并说明查看作者资料。法语独立本地化：390×844 下第一、三页文案需三行，弹窗增高至483，其余页保持457；保留字号、完整文案和页脚，属于语言适配。底层显示当前真实首页及 Eluva 品牌，不复制原稿中的旧品牌或背景数据。原稿和实现可分别打开比较：

- 第1页：[蓝湖原稿](evidence/home-help-2026-10-19/source/reference-1.png)、[英语实现](evidence/home-help-2026-10-19/screenshots/help-1-en-390x844.jpg)。
- 第2页：[蓝湖原稿](evidence/home-help-2026-10-19/source/reference-2.png)、[英语实现](evidence/home-help-2026-10-19/screenshots/help-2-en-390x844.jpg)。
- 第3页：[蓝湖原稿](evidence/home-help-2026-10-19/source/reference-3.png)、[英语实现](evidence/home-help-2026-10-19/screenshots/help-3-en-390x844.jpg)。
- 第4页：[蓝湖原稿](evidence/home-help-2026-10-19/source/reference-4.png)、[英语实现](evidence/home-help-2026-10-19/screenshots/help-4-en-390x844.jpg)。

交互与保存：点击“？”每次从第1页开始；左右滑动、分页、方向键及 Home／End 切页，到边界停止；不自动播放。Skip 随时关闭；Got It 在前三页前进、末页关闭，重复点击同次更新不会跳过多页。遮罩不关闭，Esc 可关闭；底层首页停止交互，关闭恢复入口焦点及原内容位置。图片预加载有实际 loading 状态，失败保留本页说明、分页和关闭能力，重试只重载目标插画；离页或关闭后丢弃晚到结果并清理手势、捕获及监听，没有自动轮播定时器。帮助不新增语言切换入口。

原生失败恢复使用测试 target 中的 HelpResourceProbe，仅让第二张本地插画首次加载失败，随后通过同一个正式 LocalResourceHandler 读取成功；生产代码没有注入失败的后门。最终集成测试还验证了遮罩不关闭、快速重复点击不跨页、Skip／Esc／末页关闭、重新打开回第1页及滚动和焦点恢复。

未完成：真机安装和交互、真实设备安全区及系统键盘检查未执行；无签名设备构建不代表真机通过。浏览器拖动是鼠标驱动，不能替代 iPhone 触摸结论。测试结束仍有 WebKit RBS／ProcessSuspension 清理日志，未声称原生控制台全程无告警。
