### 📢 任务修改执行报告

本报告保留2026-10-23静态启动连续性的历史实现与证据。2026-10-24用户确认的首次欢迎回音接力、后续简短揭幕与暂停续播，以[欢迎回音接力报告](./welcome-relay-report.md)为当前依据。

1. **修改了哪些文件：**
   - 原生：`WebViewController.swift`、`NativeBridge.swift`、`AppDelegate.swift`及测试文件工程引用。
   - H5：`index.html`、`public/boot.js`、`src/App.vue`、`src/launch.css`、`src/services/launch-presentation.js`、`src/views/HomeView.vue`及启动错误英法文案。
   - 资源／验证：`public/images/launch-logo.png`、`scripts/prepare-assets.mjs`、`tests/launch-presentation.test.js`、`ios/EluvaTests/LaunchTransitionTests.swift`、实施计划、本报告、证据及生成的iOS Web资源。

2. **每个文件解决了什么问题：**
   - 根因：LaunchScreen为原品牌图，原生makeCover却改成42pt文字Eluva与tagline，index及Vue Boot又重复文字启动页；覆盖层直接隐藏，且两项ready布尔值没有重试代次，导致形状／位置跳变及旧回调抢先揭开的风险。
   - 原生覆盖层直接实例化当前LaunchScreen.storyboard子视图，原尺寸110×110、根视图居中上移50pt、背景全屏aspect fill保持。Window、控制器和WebView有一致基础底色；覆盖层先建立再创建WebKit。正常阶段不添加文字、进度伪装或额外停留。
   - index与Vue Boot使用同一原图、相同比例和位置；构建时从现有launchIcong原始PNG无损复制，背景沿用既有同步。未修改当前LaunchScreen及AppIcon图案，未混用新设计版本。目录核对与原图哈希见`design-reference.json`。
   - H5在实际RouterView组件挂载、最终路由一致后，准备首屏可见图片、关键地图／品牌与字体，再完成双RAF，经既有app.ready携带launchId；singleflight、AbortController和路径／代次守卫丢弃旧结果。原生同时校验当前WKNavigation及代次，两个条件都满足后360ms淡出覆盖，完成才开放触摸；减少动态直接揭开。
   - 首页以launchCovered暂停发现、落卡、光晕及首次引导门控；原生覆盖完全消失后发出可见事件再继续，避免动画在盖层下播完。旧无host/token的WK测试与浏览器不被此原生等待锁住。
   - H5资源准备12秒上限、原生前台20秒兜底；失败保留同品牌背景与图标，出现可重试英法反馈。app.startupFailed继续使用唯一Bridge，校验代次、错误码格式和长度；失败代次封口，迟到ready不能自己关闭错误。重试开启新代次，清空旧错误并重读；H5重试纠正初始失败后可能停留的认证／首页目标。
   - 启动准备时进入后台取消H5等待，原生暂停揭开及超时；回前台重新准备／揭开。离页和销毁清理计时器、动画、观察者及旧异步结果。

3. **是否影响登录注册流程：** 启动入口衔接与启动失败后的目标恢复受到调整；对话内容、资料顺序、验证码、账户校验与原子建号规则不变。首次EULA仍显示，新增启动测试不接受协议。

4. **是否影响本地用户数据：** 否。无存储字段或数据迁移，不清空账户或偏好；测试使用独立临时vault与偏好套件，另建专属QA模拟器，不覆盖用户正在操作的模拟器。

5. **是否检查了 iOS 适配和键盘交互：**
   - 英法欢迎／EULA和已有session首页，六尺寸盖层几何及Storyboard像素对照；实际可见UIKit窗口、真实WKWebView及生产资源。状态栏由系统绘制，H5不添加假状态栏或Home Indicator。
   - 正常像素对齐使用半个实际物理像素容差；@3x下中心位置约0.167pt四舍五入不算设计位移。原图尺寸与Storyboard像素差异要求不变。
   - 本轮无输入区或键盘布局改动；既有认证回归包含缩短可视高度的验证码控件，不能等同系统键盘或真实iPhone验证。

6. **如何测试本次修改：**
   - Node173/173、Vite生产构建、265项资源审计／同步、Debug模拟器测试构建与Release无签名设备构建通过；四份Web资源SHA256一致。
   - 六个不同WKWebView用例通过：英法启动2项及首次引导2项分别在`launch-transition-20261023-visible.xcresult`中通过；英法认证2项在后续`launch-transition-20261023-auth-verified.xcresult`中通过。不把前一个含旧认证测试失败的整个结果包称为通过。
   - 英法欢迎／已有session首页各覆盖六尺寸，24组Storyboard与实际盖层像素差异全部为0；慢解码时盖层完整保留、未发ready；实际360ms原生透明度动画、减少动态注入、当前代次单次ready、失败代次封口、导航／进程失败代理模拟后重试和后台通知恢复通过。首页在覆盖下暂停发现，原生完全揭开后才继续。
   - 英法认证回归实际走通注册、错误验证码、资料提交、新账户公共动态／空聊天、退出重登、密码错误、重置取消及密码不一致恢复；仍以隔离数据执行。首次引导原顺序及帮助独立性回归通过。
   - 首轮原生测试中，理想中心0.1pt阈值未计@3x的物理像素对齐而失败；Storyboard像素对照及恢复路径均继续完成。仅修正测试容差，原生视觉与产品代码未因此变更，原始失败保留。
   - 旧认证回归最初使用离屏WK，定时器被节流，补充运行被主动中止，结果包保存日志也有中止诊断；改用独立可见窗口后暴露旧测试的30ms按钮查询及未绘制弹窗2ms内合成点击问题。诊断显示仍在Settings正常弹窗，无启动错误且未发auth.logout。测试改为真实按钮就绪、双RAF绘制后再次确认可操作，业务断言未降低，最终英法2/2通过；未为这些测试夹具问题修改产品行为。各阶段日志、失败诊断与附件均保留。
   - 已查看英法原稿盖层、真实UIKit过渡中帧与最终欢迎／首页截图，所查帧未见白／黑整屏或图案／位置跳变。像素对照图由纯Storyboard／盖层渲染；过渡／目标图由实际可见窗口drawHierarchy采集，动画时间另有真实presentation层opacity记录，不把截图等同持续帧率、OS冷启动录像或真机结论。
   - Vite现有大于500kB分块及插件耗时提示、模拟器RBS／ProcessSuspension、缺失系统触觉库等诊断如实保留；本轮未发现产品资源丢失或持续Auto Layout冲突。报告详证见[验证汇总](./evidence/launch-transition-2026-10-23/verification-summary.json)、[附件索引](./evidence/launch-transition-2026-10-23/wk-attachments.json)。专属QA模拟器已清理，用户原有模拟器未覆盖安装。
   - 复测：冷启动未登录与已有会话两条入口；加载期间始终同品牌图→目标首屏就绪后渐隐；慢图／字体期间不提前揭开；失败重试；后台恢复；开启减少动态；首页发现和首次引导完整呈现。

未完成与限制：真实iPhone冷启动、OS LaunchScreen到首帧的完整连续录像／性能采样、真实系统后台／前台、系统减少动态开关、键盘及长期性能仍待验；真实资源文件损坏触发H5→native startupFailed的整包集成未故意破坏执行（资源失败与超时由服务单测覆盖，原生恢复由代理模拟覆盖）。模拟器通知、受控图片解码和注入减少动态分别标明，不将浏览器、模拟器或无签名构建称为真机验证。
