### 📢 任务修改执行报告

1. **修改了哪些文件：** 见下表；保留工作区其他已有修改，没有增加测试源码或测试入口。
2. **每个文件解决了什么问题：** 将明文 Web 资源改为压缩和双层认证加密包，统一原生与 WKWebView 的资源读取，移除工程对具体 SDK 路径的依赖。
3. **是否影响登录注册流程：** 业务流程没有改变。资源准备完成后才允许数据初始化和文档加载，延续原 LaunchScreen 到 Vue 首帧的衔接。
4. **是否影响本地用户数据：** 不改变存储模型、Keychain、账户保险库、消息、草稿或订阅。解包缓存位于独立的 Library/Caches/PerceptualEluOpenness；缓存损坏恢复验证中账户保险库摘要保持不变。
5. **是否检查了 iOS 适配和键盘交互：** 实际模拟器 WKWebView 启动与资源显示已验证，未修改任何 Vue/CSS、Safe Area 或键盘代码；本轮没有重新执行所有页面的六尺寸键盘回归。真机未验证。
6. **如何测试本次修改：** Vite 生产构建、构建内双层解密回验、265文件逐一SHA256、Debug构建、仅复制ios后的独立Release构建、WKWebView冷／热启动及损坏缓存恢复均通过。详细证据见下文。

| 文件 | 本轮作用 |
| --- | --- |
| `scripts/sync-ios.mjs` | 核对构建清单，压缩、两次独立加密、解密回验，生成配套密钥，复用相同内容包，同步原生字体和启动资源，移除旧生成Web目录。 |
| `ios/Eluva/PerceptualEluOpenness/EluOpenness.eluva` | 替代原Web明文资源；265个生产文件均在包内。 |
| `ios/Eluva/ResourcePackageKey.swift` | 自动生成两组独立40位随机字母数字密钥、包摘要、清单摘要和解压长度；不依赖外部配置。 |
| `ios/Eluva/EncryptedWebResources.swift` | 原生后台认证解密、流式解压、路径与逐文件校验、原子发布、缓存复用和修复。 |
| `ios/Eluva/LocalResources.swift` | WKURLSchemeHandler改用已验证的解包根目录，保留URL协议、MIME、Range、CORS和取消语义。 |
| `ios/Eluva/WebViewController.swift` | 解包成功后才启动StoreKit与H5；失败使用既有重试面板；旧启动请求的迟到结果丢弃。 |
| `ios/Eluva/LocalRepository.swift`、`DemoFixtures.swift`、`ContentRepository.swift`、`SocialRepository.swift`、`CommerceRepository.swift`、`PersonalRepository.swift`、`RealtimeRepository.swift` | 12处原生配置／媒体读取迁移至同一已验证资源目录，避免数据配置缺失。 |
| `ios/Eluva/NativeFonts/`、`ios/Eluva/Info.plist` | 将解包前使用的原生字体作为独立Bundle资源，UIAppFonts不再引用旧Web。 |
| `ios/Eluva.xcodeproj/project.pbxproj`、`scripts/generate-ios.rb` | 更新资源与源码引用，17个系统框架采用SDKROOT相对路径，避免固定iPhoneOS26.0 SDK路径。 |
| `package.json` | `ios:build`先执行生产构建及加密同步。 |
| `.gitignore` | 移除旧Web生成目录规则；加密包与配套Swift源码均可被版本管理，不会在交付时遗漏。 |
| `README.md`、`ios/README.md`、`docs/app-flow-and-implementation-plan.md` | 更新日常构建、独立交付与资源更新流程。 |

本轮未修改H5功能、文案、样式、商品ID、Bundle ID或用户关系规则。文件读取位置改变，生产文件字节保持一致。

## 包格式与运行流程

资源按路径排序，清单包含相对路径、长度和SHA256，随后顺序保存文件内容。整体执行raw DEFLATE压缩，再以两套独立AES-256-GCM密钥和随机nonce加密；两层均认证格式头与层号。密钥各40位，由系统安全随机源生成，包含字母及数字，通过SHA256派生AES密钥。源码不记录在控制台输出或本报告中。

解包前验证整个密文摘要；两层认证均成功后才解压。解压长度上限512MiB、包上限256MiB、清单上限4MiB、文件上限10000。禁止绝对路径、越界、重复路径和软链接。每个文件核对长度与SHA256后才发布为可用资源；缓存还检查缺失、额外文件和损坏。运行时不会连接设计平台或开发服务器。

原始生产文件共93,002,238字节，加密包89,784,080字节（约85.6MiB）。图片等已压缩素材占比较高，因此没有通过降低图像质量追求压缩率。

Apple API依据：[CryptoKit AES.GCM认证解密](https://developer.apple.com/documentation/cryptokit/aes/gcm/open(_:using:authenticating:))、[Compression raw DEFLATE格式](https://developer.apple.com/documentation/compression/compression_zlib)。

## 已执行验证

- `npm run build`：Vite与生产资源审计通过，265文件全部完成打包前／后SHA256校验。
- 重复同步：未变化的清单复用原包、密钥和摘要；从其他工作目录运行同步脚本也成功。
- 内／外层密文分别在内存中篡改，GCM认证均拒绝；未修改实际交付包。
- Swift／Ruby／Node语法、plist及Xcode工程结构检查通过。
- 原工程Debug模拟器构建通过，包含arm64与x86_64。
- 日常`npm run ios:build`完整执行通过，自动先构建并复用已验证加密包；原有`.build/ios`产物检查无旧Web目录、无明文HTML，加密包与当前工程一致。
- 仅将`ios`复制到独立带空格目录，Release模拟器构建通过，未调用根项目、Node、Ruby或构建脚本；独立产物没有Web目录或明文index.html，密文摘要与源工程一致。
- iPhone17／iOS26.5真实WKWebView冷启动打开原欢迎／协议页。运行时265个解包文件与dist逐一一致，原生账户初始化成功。
- 同设备再次启动命中校验缓存，实测资源准备约0.27秒；故意损坏此隔离设备的缓存index.html后，自动完整重建约0.72秒，账户保险库摘要不变。这是当前模拟器测量，不代表真机耗时。
- 独立目录构建的Release产物安装运行成功；另在全新iPhone SE（第3代）／iOS17.5上以法语首次启动，原生解包、数据初始化和法语WKWebView首屏均成功。

构建仅出现Xcode的“未依赖AppIntents.framework，跳过元数据提取”提示。已记录的启动日志无资源加载错误、解包失败或布局冲突。

证据目录：[encrypted-h5-2026-10-24](evidence/encrypted-h5-2026-10-24/)。包括构建日志、非秘密包元数据、独立产物检查、运行时文件校验、缓存恢复记录及WKWebView截图。

## 交付与后续更新

直接发送整个`ios`文件夹，或使用本轮生成的`.build/deliverables/Eluva-iOS-standalone-2026-10-24.zip`。接收者解压，打开`ios/Eluva.xcodeproj`，选择Eluva和iPhone模拟器运行。配套密钥已在工程内，不要求发送方电脑、环境变量、额外密钥或Vue源码。交付包53个文件，ZIP完整性检查通过。

以后修改H5：在完整项目根目录运行`npm run build`，成功后加密包、配套参数和原生资源已同步；`npm run ios:build`也会先执行这一流程。Xcode单独打开时使用现有生成快照，不能替代Vue编译；不要只复制一个密文包而遗漏配套Swift参数。转交前应等整个构建命令成功完成。

## 验证边界

- 本轮使用Xcode26.6；独立目录构建证明不依赖原项目路径，但没有在第二台物理Mac上操作。建议接收者使用相同或更新的Xcode。
- 真机、真机签名、Apple沙盒购买未验证；真机运行需接收者配置可用Team／签名，真实内购仍依赖正确Apple环境。
- 未重新执行登录注册全流程、六尺寸全页面与键盘回归；本轮H5产物逐字节一致，不将启动验证表述为全业务回归。
- 离线App需携带解密能力，密钥可被逆向分析恢复；双层加密用于提高直接提取门槛和校验完整性，不能保证资源绝不可提取。运行时解包内容位于应用沙盒缓存。
