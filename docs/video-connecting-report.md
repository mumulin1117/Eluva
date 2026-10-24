# 聊天视频入口：连接中头像页面

日期：2026-10-21。范围：聊天视频入口、现有 VideoCallView 与必要权限／取消依赖。

## 修改文件

- `src/views/VideoCallView.vue`：改为蓝湖“接通后”布局的连接中状态。对方头像全屏 Aspect Fill、本人资料头像作小窗；缺图回退默认头像。姓名来自当前会话用户；英语显示 `Connecting......`、法语显示 `Connexion en cours......`。不显示计时器、在线绿点、样片或自动接通。
- `src/video-connecting.css`：专属正常 Flex 布局、Safe Area、底部渐变、照片裁切与四按钮排布。二级页无 TabBar，不绘制系统状态栏和 Home Indicator。
- `src/data/realtime-messages.js`：英法连接状态、接通后可用提示、权限设置／重试、不支持及结束记录失败提示。
- `public/images/p4/connecting-mic.svg`、`connecting-flip.svg`、`connecting-camera.svg`、`connecting-hangup.svg`：对应版本的原始 SVG 切图，含原始半透明底座及白色图标；保留 48／56 逻辑尺寸，不以 emoji 替换。
- `ios/Eluva/NativeBridge.swift`：在唯一 Bridge 的 realtime 服务增加 `prepareCall`，复用身份、通话所有权、互关／Reply 联系、拉黑和请求取消验证。
- `ios/Eluva/VideoDemoCoordinator.swift`：先请求摄像头，再请求麦克风，各自返回 authorized／denied／restricted／unsupported。授权前后复核有效通话，过期结果丢弃。该步骤只准备权限，不创建 AVCaptureSession、录音器、音频引擎或视频流，不把记录改成 active。
- `ios/Eluva/RealtimeMediaCoordinator.swift`：按 callId、peer、request 管理待授权工作，接入既有挂断、离页、后台、拉黑、退出与超时清理；录音／旧摄像头能力与待授权工作互斥。
- `src/services/browser-realtime.js`：浏览器校验通话和安全边界后如实返回 DEVICE_UNSUPPORTED；不会伪造浏览器获得 iOS 权限。
- `tests/realtime.test.js`：增加权限准备在浏览器不伪造接通／startedAt 的断言。
- `ios/EluvaTests/WebBundleTests.swift`：英法会话进入、六尺寸、真实账户照片来源、提示、连续挂断、返回草稿、拒绝／重试，以及待授权阶段挂断／离页／后台／拉黑后的迟到结果检查。
- `tests/fixtures/video-connecting.html`：UUID 数据库隔离的浏览器 QA 夹具，仅测试目录可用；提供显式授权结果夹具与挂起响应控件，不进入生产资源。
- `docs/app-flow-and-implementation-plan.md`、`docs/p4-route-contracts.json`、`docs/lanhu-design-catalog.json`：同步本次确认的 UI 和权限契约，旧相机／样片选择器不再是当前页面入口。`ios/Eluva/Web` 为资源同步产物。

## 设计冻结与差异

- “接通后”，ID `40107aab-69f4-4524-8feb-0c1a32b3fb25`，版本1，更新时间 `2026-10-13T15:14:57.212219Z`；本轮目录索引33。原图、标注、切图信息保存于 `evidence/video-connecting-2026-10-21/source/`。
- 目录画布 195×422；标注画布 390×844；原图 780×1688。切图存储倍率4：48逻辑按钮的 PNG为192×192、56按钮为224×224；生产使用原始SVG，不将文件像素当CSS尺寸。
- 390×844、顶部安全区44／底部34时：标题顶部56，Plus Jakarta Sans 20／800／25；状态文字12／700／15；本人小窗90×120、x280／y569、圆角16；四按钮x44／126／208／290，48／48／48／56，挂断顶部737。布局由真实内容、Flex和安全区计算，未固定整页缩放。
- 页面整体遮罩 `rgba(28,25,23,.2)`；底部渐变区域259逻辑高度。设计标注没有完整返回底部渐变色标、小窗图层参数：小窗按原图测量，渐变透明至黑色 .85 为现有同体系遮罩处理，这些项目不宣称已逐色标复核。其他可获得字号、透明度和按钮SVG已对照。
- 用户明确调整：原远端／本人视频画面替换为头像，计时器换连接状态，取消在线绿点；原始示例人物和姓名没有写死进业务页面。本人无头像使用默认图；WKWebView夹具另外设置真实账户自有照片，核对小窗使用其受权限保护的 media URL。
- 小屏不缩小字体；错误或长提示允许主内容内部滚动，底部挂断保持可达。

## 行为、保存与失败恢复

1. 聊天点击视频先沿用原联系权限校验，然后进入连接页、创建／复用稳定 callId，自动经 `realtime.prepareCall({callId})` 准备两项权限。
2. 相机拒绝时仍取得麦克风的独立授权状态；受限和不支持分别处理。页面保留状态与挂断入口；拒绝／受限在 iOS 提供设置和重试，失败可重试，不重复创建通话。
3. 三个功能按钮只显示“通话接通后即可使用”的本地化提示，连续点击更新同一提示，不开麦、不切镜头、不启动采集。
4. 挂断立即取消待授权请求、清理轮询和提示计时器并返回原会话；本地结束记录异步幂等保存，不用等待存储结束才离页。失败给当前账户自然反馈，不能困住挂断页面。返回保留聊天草稿。
5. 离页、后台、拉黑、退出时取消对应作用域。系统授权弹窗的迟到结果不会继续请求下一权限、启动设备或重开页面；没有声称能够强行关闭 iOS 系统授权弹窗。
6. 只使用原有 `realtime.calls` 的 ready／ended、endedAt／reason。没有增加账户字段、重置历史、发送远端消息、扣额度或改关系；底层旧预览／样片接口保留兼容，当前页面不暴露入口。

## 验证证据与边界

- Web 测试：105 项通过，见 `web-tests.log`。
- 浏览器：英法 × 六尺寸 × 连接中／拒绝权限，共24条截图与记录，无横向溢出、缺图、计时器或 TabBar，挂断未裁切。见 `browser-matrix.json`、`browser-*.png`。
- 浏览器实走：拒绝 → 重试恢复、接通前按钮提示、拉黑 → 返回受限会话、挂起权限 → 挂断 → 迟到响应仍保持原会话，以及真实浏览器 adapter 的不支持状态。见 `browser-flows.json`。granted／denied／hold 是具名测试夹具结果，不是浏览器或真机系统授权结论。
- 编辑过程出现过 Vite HMR 循环导入错误；独立新标签最终加载无 error／warning，见 `browser-final-console.json`。生产 bundle 另由 WKWebView 测试加载。
- WKWebView 使用实际打包本地资源、URL Scheme 和 Native Bridge；英法六尺寸保存12张连接页截图，另有拒绝状态截图。系统授权结果仅通过 DEBUG 测试注入控制，Release 不包含注入入口。
- 原生检查覆盖两项通话仓储、两项英法页面、一项待授权生命周期，共5个独立测试。最终5项全部通过，见 `native-summary.json`、`native-recovered.log` 与 `native-verified-attachments/manifest.json`；早期测试设置遗漏与模拟器服务关闭造成的失败日志保留，不计为通过。
- Vite 生产构建与资源审计／同步通过，见 `build-final.log`；保留既有大于500kB chunk提示。iphoneos Release 无签名构建通过，见 `device-delivery-build.log`。四份资源均为264文件、哈希完全一致，核对见 `resource-hashes.json`。
- 本次不影响登录注册、账户资料或聊天历史。没有输入框布局改动；检查返回保留草稿，但未执行真实软件键盘弹出／收起。
- **未执行：真机系统权限弹窗、真机设置往返、真实硬件采集、触摸／后台体验与性能。** 继续按此前确认将真机签名与验证列为待办。模拟器离屏 WKWebView、安全区参数、浏览器夹具和无签名构建均不替代真机结论；当前流程没有真实远端接通信令。

复测：与已互关或 Reply 已获回复的用户打开会话 → 视频 → 检查双方头像和 Connecting → 处理相机／麦克风权限 → 点击三个功能按钮查看提示 → 挂断返回并核对草稿。再验证拒绝、设置、重试和待授权阶段退出；未建立联系或被拉黑者不得绕过通话权限。
