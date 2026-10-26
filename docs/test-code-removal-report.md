### 📢 任务修改执行报告

1. **修改了哪些文件：** 删除 71 个文件：`tests/` 57 个、历史 QA 脚本 12 个、诊断开关与测试来电组件 2 个；修改包配置、浏览器与原生仓储、Home／Chats／Mine、VideoCall、无用测试文案／样式、Xcode 生成脚本与 scheme。逐项路径及删除前指纹见[删除清单](./evidence/test-code-removal-2026-10-24/deleted-files.json)。
2. **每个文件解决了什么问题：** 移除自动化测试与测试夹具、fake-indexeddb 依赖、npm test、独立 WK 测试宿主、诊断入口、模拟失败、测试策略／写入／环境覆盖、测试来电和样片激活接口；解除失效的 viu.storekit 引用，生成脚本只创建正式 App。移除后不再留下测试入口或生产代码对测试目录的依赖。
3. **是否影响登录注册流程：** 未改变邮箱登录、注册、验证码、资料顺序、协议及账户规则。固定账号保留；浏览器仓储仍使用原默认数据库，原生仍使用原 Application Support 路径、标准偏好和 Keychain 密钥。仅删除测试专用覆盖参数，不替换生产存储来源。
4. **是否影响本地用户数据：** 不清空、迁移或改写已有账户、消息、关系、动态、订阅及草稿。共享用户／动态、固定账号、旧记录兼容和真实交易验证保留。历史报告、截图及日志保留；不把测试代码删除误作业务模拟内容删除。
5. **是否检查了 iOS 适配和键盘交互：** 正常页面布局与键盘处理未修改，仅删除原开发诊断 UI。独立 iPhone 17／iOS 26.5 模拟器安装正式包，实际 WKWebView 已显示 Eluva guide 与 Terms & Policies 首屏，截图显示 Vue 首屏，日志有首次非空布局和首个有效绘制。没有代替用户接受新协议；本轮不声称已重新跑完原生登录、系统键盘、媒体权限、付款或真机流程。英法尺寸浏览器检查单独记录。
6. **如何测试本次修改：** 60 个 JavaScript 模块及 55 个 Vue 组件编译／解析无错误，Swift 全源语法和 Ruby 语法通过，Xcode 工程加载仅有 Eluva target。Vite、265 项资源审计／同步、签名模拟器 Debug 与无签名 iOS Release 构建通过；dist、iOS Web 源资源、Debug App、Release App 四处运行资源逐字节一致。测试代码按要求已删除，本轮未运行或重建自动化测试，先前测试次数不作为删除后的结论。

文件职责与删除边界：

- `tests/`：删除 Node 测试、隔离浏览器 HTML／图片夹具、独立原生测试宿主与生成器，不再存在该目录。
- `scripts/audit-evidence.mjs`、`audit-demo-data.py`、`audit-p2/p3/p4/p5/p6/p7-evidence.py`、`audit-p7-fonts.swift`、`audit-post-carousel.py`、`build-p7-registry.py`、`generate-video-fixture.swift`：删除历史 QA／测试生成工具；保留 `prepare-assets`、`audit-build`、`resource-reference`、`sync-ios` 和用户原始素材导入工具，它们服务生产构建。
- `package.json`、`package-lock.json`：删除测试命令与 fake-indexeddb，依赖锁文件同步更新。
- `src/views/HomeView.vue`、`ChatsView.vue`、`MainView.vue`：删除开发诊断按钮、弹层、故障注入与测试来电，保留继续草稿、正常更多菜单、分类、返回数据恢复和首次加载。
- `src/services/presentation.js`、`src/components/IncomingVideoBanner.vue`：删除失去正式用途的测试开关及仅由测试触发的来电组件；删除对应英法文案、Toast 特殊处理和专属 CSS。
- `src/services/browser-repository.js`、`browser-content.js`、`browser-social.js`、`browser-personal.js`、`browser-realtime.js`：移除模拟故障、写入／策略／数据库环境注入及测试来电／激活；正常原子保存、真实错误捕获、权限和离页清理保留。固定账号初始化继续保留业务关系与会话种子。
- `ios/Eluva/LocalRepository.swift`、`ContentRepository.swift`、`SocialRepository.swift`、`PersonalRepository.swift`、`CommerceRepository.swift`、`RealtimeRepository.swift`、`WebViewController.swift`：移除失败注入、写入／策略覆盖、测试环境构造参数与减少动态覆盖；正常系统减少动态、真实媒体及原仓储／Bridge 保留。
- `src/views/VideoCallView.vue`：新通话只创建正常 outgoing 连接，历史通话仍可读取／结束。
- `scripts/generate-ios.rb`、`ios/Eluva.xcodeproj/xcshareddata/xcschemes/Eluva.xcscheme`：移除测试 target 生成、StoreKitTest／夹具资源及失效 StoreKit 配置引用。未重生成或覆盖主 pbxproj，签名和正式商品配置未改。
- `README.md`、实施计划：更新当前可执行命令与清理范围；旧验证记录明确为历史。

保留 `public/demo/local-voice.wav` 以兼容旧语音记录与资源准备；`public/demo/local-video.mp4` 为静态媒体，本次代码清理未扩大到素材删除。`demo-fixtures.json` 与对应数据模块承担用户要求的共享模拟内容，不属于独立测试宿主。

验证证据：

- [源码编译](./evidence/test-code-removal-2026-10-24/source-compilation.json)、[测试入口扫描](./evidence/test-code-removal-2026-10-24/test-entry-scan.json)
- [Vite 与同步](./evidence/test-code-removal-2026-10-24/vite-build.log)、[Debug 构建](./evidence/test-code-removal-2026-10-24/xcode-debug.log)、[Release 构建](./evidence/test-code-removal-2026-10-24/xcode-release.log)、[四处资源一致性](./evidence/test-code-removal-2026-10-24/resource-audit.json)
- [浏览器检查（用户新指令到来时中断）](./evidence/test-code-removal-2026-10-24/browser-smoke.json)：法语 Home／Chats 六尺寸共12组无横向溢出；Mine／订阅入口可打开。英语六尺寸、详情／主页在该轮未完成；原语言已恢复法语。后续触摸任务的英法检查另见 [触摸交互报告](./iphone-touch-report.md)。
- [正式 WK 首屏](./evidence/test-code-removal-2026-10-24/wk-production-first-screen.png)、[正式启动日志](./evidence/test-code-removal-2026-10-24/wk-production-startup.log)

未执行：实体 iPhone／真机签名与系统键盘、完整原生登录注册、媒体权限和真实 Apple 付款。本轮首个模拟器启动命令在安装尚未完成时返回失败；安装完成后重新启动成功，最终截图和日志来自成功运行。保留 Vite 既有大包警告及模拟器系统日志，不以构建成功代替完整业务验证。
