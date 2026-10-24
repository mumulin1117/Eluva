### 📢 任务修改执行报告

1. **修改了哪些文件：** `src/content.css`、新增 `public/images/p2/discovery-photo-overlay.png`、本报告与 `docs/evidence/home-card-mask-2026-10-20/`；生产构建资源已同步至 `ios/Eluva/Web/`。
2. **每个文件解决了什么问题：**
   - 原始PNG逐字节复制自用户提供的Rectangle 9@2x.png，590×282 RGBA，对应295×141逻辑尺寸，未重绘、改色或压平透明度。
   - 首页卡片此前只有文案背后的短CSS渐变，照片本身缺少Rectangle 9。现用原始PNG在照片上叠加透明到白色遮罩，文案位于其上，并去掉首页文案的旧重复渐变。
   - 样式限定 `.home-shell .discovery-list` 的照片卡片。保留原有ScaleAspectFill、卡片布局、文案、点亮与导航；遮罩pointer-events:none，不拦截点击或横向滑动。详情、他人主页、空态、视频和纯文字卡片均不增加此遮罩。
3. **是否影响登录注册流程：** 否，无认证、桥接或路由改动。
4. **是否影响本地用户数据：** 否，无业务服务、持久化或账户数据改动。使用原有隔离夹具验证，没有清空现有数据。
5. **是否检查了 iOS 适配和键盘交互：** 英语/法语×六尺寸共12组浏览器截图及布局核对通过：遮罩高度与照片一致、照片cover、正文在上层、点击可进入详情、返回保留5条。沿用照片141px高度及现有矮屏100px适配；遮罩宽度跟随现有照片框，不改变整卡布局。无新增输入框，未进行真实系统键盘或实体iPhone验证。
6. **如何测试本次修改：**
   - `node --test tests/content.test.js tests/carousel.test.js`：8项通过，未为此装饰改动新增测试。
   - 原有英法HomeDiscoveryBatches WKWebView测试2项通过，覆盖六尺寸、5条批次、刷新、失败保留、重试、筛选与详情返回。其首页尺寸证据为offscreen DOM，不能称为可视WKWebView截图或真机验证。
   - Vite生产构建与资源审计、iOS同步、Xcode模拟器测试构建及无签名iPhoneOS构建通过。dist、iOS源Web、模拟器App、设备App各252个文件哈希一致，遮罩与用户原PNG哈希一致。
   - 复测入口：开发服务器下 `/tests/fixtures/home-empty.html?locale=en&scenario=content&safe=1`，可将locale换成fr。横滑卡片，点击图片进入详情，再返回首页；确认详情没有首页遮罩。

设计依据：蓝湖「首页」`53ecd7cf-131b-4976-b8c8-52c10658774e`，版本2，更新时间 `2026-10-20T13:43:55.058183Z`。图层 `5:149 / Rectangle 9`，标注位置x15/y505，295×141；目录195×422为半尺寸预览，不能作为CSS尺寸。完整Schema接口回退标注模式，已核对原图和对应图层。未扩展调整其他首页布局差异。原图已通过蓝湖工具查看，单独CDN下载返回403；本轮正式遮罩直接使用用户提供文件，不依赖CDN下载。

证据：`browser-matrix.json`、`browser-flow.json`、`native-test-summary.json`、`native-attachments/`、`resource-verification.json`及构建/测试日志，均位于[证据目录](/Users/linqian/Documents/Eluva/docs/evidence/home-card-mask-2026-10-20)。真机、真实触摸及WKWebView可视截图未执行；原有Vite大分块提示仍存在。

![首页原始遮罩效果，英文390×844浏览器](/Users/linqian/Documents/Eluva/docs/evidence/home-card-mask-2026-10-20/screenshots/home-en-390x844.jpg)
