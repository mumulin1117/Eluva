### 📢 任务修改执行报告

1. **修改了哪些文件：** `src/views/PostDetailView.vue`、`src/post-detail.css`、新增 `public/images/post-detail/background.png` 和 `hero-overlay.png`、`ios/EluvaTests/WebBundleTests.swift`、`docs/post-detail-connection-plan.md`、本报告与 `docs/evidence/post-detail-glow-2026-10-20/`；生产构建与iOS Web资源同步更新。
2. **每个文件解决了什么问题：**
   - 详情页原背景及照片顶部光晕均包含Gaussian blur滤镜。iPhone 17／iOS 26.5实际WKWebView复现了用户截图中的硬边紫色矩形，旧iOS17.5证据没有此矩形。仅规范化SVG命名空间的首次修复未解决问题，新增像素断言仍失败，失败结果保留；未将该尝试交付为修复。
   - CSS改用蓝湖原始纯装饰背景PNG（1560×3376）与原光晕SVG按3倍预渲染的透明PNG（1170×777），避开运行时SVG滤镜。未绘制替代渐变或合成页面；文字、按钮、图片和所有交互独立渲染。原SVG已恢复并逐字节确认未改动，保留其原始几何、颜色、遮罩与模糊参数；转换仅在内存中规范化XML命名空间供librsvg读取，没有增加生产依赖。
   - 页码条件从“多于一张”改成“有媒体”：单图显示居中的 `1/1`，不显示多图圆点和轮播控件；无媒体不显示页码，多图继续联动。14px图片间距和现有自动轮播保持。
   - 原生测试增加单图英法用例，复用原详情完整测试；增加截图光晕边界像素断言，避免仅有DOM检查却漏掉此类视觉错误。计划移除“单图隐藏页码”的旧规则。
3. **是否影响登录注册流程：** 否。没有修改认证、账户服务、路由或Native Bridge。
4. **是否影响本地用户数据：** 否。没有持久化变更或清理数据；浏览器独立数据库和原生临时仓库构造测试帖子，不修改已有动态。
5. **是否检查了 iOS 适配和键盘交互：** 在iPhone 17／iOS26.5模拟器离屏WKWebView检查英法×单图/三图×点亮前后×六尺寸，共48组布局。均确认图片与返回按钮底部14px、页码文字居中、单图1/1、无横向溢出、操作可滚动到达且隐藏TabBar。保存8张原生截图；390×844光晕边界最大颜色跳变由17降至1，阈值8不变。浏览器另核对英文单图390×844。Reply输入焦点和点击空白失焦随原测试回归通过；没有进行系统键盘、真实手指或实体iPhone验证。
6. **如何测试本次修改：**
   - `node --test tests/image-carousel.test.js`：5项通过，包括单图不启动时钟、多图2秒、主页4秒与清理。
   - iPhone17／iOS26.5定向测试4项通过：`testEnglishPostDetailConnections`、`testFrenchPostDetailConnections`、`testEnglishSingleImagePostDetail`、`testFrenchSingleImagePostDetail`。同时复测点亮、Reply保存失败保留输入、重试成功、待回复限制和没有评论UI。
   - Vite生产构建、资源审计、iOS同步、模拟器测试构建、无签名iPhoneOS设备构建通过。dist、ios/Eluva/Web、iPhone17模拟器App及设备App各237个资源逐文件SHA-256一致。
   - 开发者复测：在iPhone17模拟器打开单图动态，检查顶部背景及照片顶部没有矩形；底部为1/1；点亮后仍为1/1。再打开多图动态，等待2秒并手动切换，确认页码联动；返回再进保持既有规则。

设计依据：蓝湖未点亮 `b8286fe3-7162-4708-8519-3e48ac42093e`，更新时间 `2026-10-13T15:22:06.252058Z`；点亮后 `cd70eece-7690-40a5-b5ea-468338856ab6`，更新时间 `2026-10-13T15:22:06.263144Z`，本轮切图接口核对为版本1。用户最新截图用于错误复现；用户最新单图1/1要求优先。素材URL、导出参数与尺寸见 `design-reference.json`。

结果包：修复前 `/private/tmp/Eluva-detail-glow-before-20261020.xcresult`；首次无效SVG修复 `/private/tmp/Eluva-detail-glow-fixed-20261020.xcresult`；最终通过 `/private/tmp/Eluva-detail-glow-png-20261020.xcresult`。全部阶段日志和修复前原SVG留在本轮证据目录；最终48组记录见 `wkwebview-matrix.json`。

未完成项：真机验证仍按用户确认列为待办；本轮没有重新运行iOS17.5测试。Vite已有分块大于500kB提示保留；原生测试结束仍有WebKit RBS/ProcessSuspension回收日志，不宣称控制台无任何警告。

![修复后的单图点亮态，iOS26.5模拟器WKWebView](/Users/linqian/Documents/Eluva/docs/evidence/post-detail-glow-2026-10-20/screenshots/Detail-en-1images-lit-390x844-WKWebView.png)
