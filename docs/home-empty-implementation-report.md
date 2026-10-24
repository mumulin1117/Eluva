### 📢 任务修改执行报告

1. **修改了哪些文件：** 新增 `src/components/HomeEmptyPanel.vue`、`src/home-empty.css`、`public/images/home-empty/` 下五项资源和 `tests/fixtures/home-empty.html`；修改 `src/views/HomeView.vue`、`src/components/ContentShell.vue`、`src/data/content-messages.js`、`ios/EluvaTests/WebBundleTests.swift`、`docs/app-flow-and-implementation-plan.md` 和 `docs/lanhu-design-catalog.json`。Vite 生成包及 `ios/Eluva/Web/` 同步更新。文件 SHA-256 见 [source-files.json](/Users/linqian/Documents/Eluva/docs/evidence/home-empty-2026-10-20/source-files.json)。
2. **每个文件解决了什么问题：** HomeEmptyPanel 复用 ActionButton，分离真实文案、星星、铅笔和筛选恢复；home-empty.css 仅限定首页空态样式，用正常 Grid/Flex 布局恢复海岛、云朵、Share、波纹、数量条、底部玻璃面板与 TabBar，装饰层允许相对定位。HomeView 以当前账户已成功读取的实际候选数决定空态，增加导航防重入、读取失败上下文、空刷新反馈和轻量筛选重置；未改动现有筛选与五条分组算法。ContentShell 新增可选 errorKey，首页读取失败不再显示“保存失败”的误导文案，未就绪时禁用帮助和筛选。content-messages 提供英法空态及恢复文案。五项本地资源补齐原始插画，原始字节未改动。测试夹具在独立数据库中调整可见性以制造空态，保持全部原帖；不进入生产包。WebBundleTests 增加英法真实 WKWebView 本地包测试；两份规划文档取消“新注册必定空态”的旧描述。
3. **是否影响登录注册流程：** 未修改认证、EULA、账户服务、密码或注册资料逻辑。最终原生集成测试保留并通过既有英法认证/EULA回归。
4. **是否影响本地用户数据：** 不修改存储结构，不删除或覆盖既有账户和动态。正式页面继续使用原有权限、可见性、安全、筛选、草稿和统一额度状态。空态本身不读写 guideDone；首次定位引导原有完成逻辑保持，手动四页帮助继续独立。筛选保存/重置仍只在服务成功后同步。浏览器夹具使用本轮独立端口5187与UUID数据库；原生测试使用临时目录、临时密钥及独立偏好，清理仅涉及各自临时夹具。
5. **是否检查了 iOS 适配和键盘交互：** 完成英语/法语六尺寸12张最终截图和12份空态 WKWebView DOM 观察；使用合成安全区（SE20/0、版本1基准44/34、393/430为59/34），不是设备真实安全区结论。320法语采用3行提示，保持13px文字和16px按钮；地图主区域允许滚动，主按钮和导航保持可见。实际浏览器滚动到同频条后，进入发布返回及关闭帮助均恢复188px位置。发布页隐藏TabBar，草稿支持原有编辑能力。没有改动系统键盘逻辑；真机、真实系统键盘和设备触摸未验证。
6. **如何测试本次修改：** Web84项通过；最终WebBundleTests6项通过，包含新增英法空态、原有认证/EULA、五条发现分组、帮助失败与guideDone隔离回归。Vite、资源审计/同步、模拟器及无签名设备目标构建通过；224项资源在dist、iOS源包、模拟器App、设备App四处逐文件SHA-256一致。五项新素材与原始文件字节一致，QA HTML不在生产包。最终浏览器无error/warn。详见[验证摘要](/Users/linqian/Documents/Eluva/docs/evidence/home-empty-2026-10-20/verification-summary.json)、[截图矩阵](/Users/linqian/Documents/Eluva/docs/evidence/home-empty-2026-10-20/browser-matrix.json)、[交互记录](/Users/linqian/Documents/Eluva/docs/evidence/home-empty-2026-10-20/browser-flow.json)、[WKWebView附件](/Users/linqian/Documents/Eluva/docs/evidence/home-empty-2026-10-20/native-attachments/manifest.json)。

本轮视觉冻结蓝湖“首页--默认进入”版本1，ID `9ceb471c-970d-4817-b764-01eb22189114`，并使用用户提供的780×1688附件作为390×844逻辑视口参考。蓝湖当前接口默认版本2；在内置浏览器点击历史“版本1”后，登录状态变化提示使画布/在线标注未能继续加载。没有使用版本2参数。实施前已冻结项目保存的版本1标注、原始SVG与用户附件，见[图层与版本记录](/Users/linqian/Documents/Eluva/docs/evidence/home-empty-2026-10-20/design-reference.json)。在线历史版本原参数核对仍待恢复登录后完成。

`empty-star.png` 是用户160×160原文件，按80×80显示；`compose-pencil.png` 是用户34×34原文件，按17×17显示。`foreground-cloud.png` 从版本1背景SVG内嵌透明PNG直接解码；左侧云朵按原图镜像，历史图层锚点与附件可见边界的差异已记录。Share和同频头像使用版本1完整SVG，保留原始嵌入图与阴影边界，不再把PNG不同像素尺寸拉入设计图层框。未生成任何替代图片。

390×844英语基准下：底部面板从y596开始、248高；提示Poppins500、13/17，颜色rgba(163,96,239,1)，起点29/631；星星位于297/604，80×80；按钮位于25/665，340×50，Poppins600、16/17；Tab图标从y741开始，50×50。同频可见胶囊为210×28，外围保留44px触摸区。云朵、Share完整导出和波纹采用原稿相对关系；核心控件没有用整页截图或绝对坐标布局。逐项记录见[视觉审计](/Users/linqian/Documents/Eluva/docs/evidence/home-empty-2026-10-20/visual-audit.json)。

玻璃面板的精确填充/模糊、深色按钮完整渐变参数以及Share独立白描边路径未包含在保存的版本1标注中；当前按附件取样与边缘测量重建，具体值及来源在视觉审计中标明，尚不能宣称这些参数与在线原图层完全一致。帮助图标复用已有AppIcon，原始独立矢量路径仍缺失。既有本地字体家族、字重和行高已核对，但设计师原始字体二进制版本未提供。

截图对照：[版本1附件](/Users/linqian/Documents/Eluva/docs/evidence/home-empty-2026-10-20/source/reference-version-1.png)、[英语390×844](/Users/linqian/Documents/Eluva/docs/evidence/home-empty-2026-10-20/screenshots/empty-en-390x844.jpg)、[法语320×568](/Users/linqian/Documents/Eluva/docs/evidence/home-empty-2026-10-20/screenshots/empty-fr-320x568.jpg)。H5未绘制系统时间、信号或Home Indicator；夹具包含真实已有消息未读数5，其角标与无角标原稿不同。浏览器捕获接口返回JPEG，未声称无损逐像素一致。

交互已实走：读取中不显示0条；首次读取失败可重试；刷新期间保留原结果、禁用重复刷新与发布；超时与STORAGE_FAILED均可恢复；仍为0时显示准确反馈；恢复符合条件的内容后返回最多5条卡片；筛选无结果保留单个主发布按钮与轻量重置入口；取消发布保留草稿；通过个人中心→设置切换法语后草稿仍在；发布不符合当前筛选的文字后继续为空，重置筛选后新动态出现在首组。隔离夹具最终为11帖（原10帖全部保留加1帖）、1个账户，guideDone仍为true。帮助打开第1页、四个分页，关闭保留滚动和焦点。

复测可启动 `npm run dev -- --port 5187`，访问 `/tests/fixtures/home-empty.html?locale=en&scenario=empty&safe=1`；locale支持fr，scenario支持filter、loading、load-failure。加controls=1出现仅测试用的可见控制条，可挂起/释放一次读取、制造下一次失败、切换夹具候选及审计数据。这些能力只在tests/fixtures中，不在正式应用，也没有新增Bridge协议。

未验证/限制：真机安装、真实设备安全区、系统键盘和手指触摸未执行；离屏模拟器WKWebView不代表可见原生窗口或真机视觉验收。原生结束时存在WebKit RBS/ProcessSuspension清理告警，未宣称控制台全程无告警。初次沙盒环境无法连接CoreSimulator，重试获准访问后正式测试通过，原失败日志保留。首轮截图留在证据目录，正式验收以browser-matrix列出的12张最终截图为准。
