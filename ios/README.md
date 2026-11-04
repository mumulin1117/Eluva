# Eluva iOS

此文件夹是可单独交付的 UIKit + WKWebView 工程。请复制整个 `ios` 文件夹，保持内部相对路径完整。

## 在另一台 Mac 运行

1. 安装 Xcode，并安装一个 iOS Simulator runtime。本次使用 Xcode 26.6 验证；项目最低运行版本为 iOS 17。源码包含 Translation 等系统框架，建议使用相同或更新的 Xcode。
2. 打开 `Eluva.xcodeproj`，选择 `Eluva` scheme 和 iPhone 模拟器，点击 Run。
3. 模拟器不需要开发者账号。真机需要在 Signing & Capabilities 中选择自己的可用 Team／签名；Bundle ID 为 `com.eluva.app`。真实内购仍需商品所属应用、签名和 Apple 环境匹配。

也可以在本文件所在目录执行：

```sh
xcodebuild -project Eluva.xcodeproj -scheme Eluva -configuration Debug \
  -sdk iphonesimulator -derivedDataPath build CODE_SIGN_IDENTITY=- build
```

不需要 Node、npm、Ruby、CocoaPods、源电脑的文件、环境变量或外置密钥。Xcode 不会调用父目录脚本，也不会连接开发服务器。不要仅发送 `.xcodeproj` 文件；它必须与 `Eluva` 目录一起交付。

## Swift 文件组织

每个类独立放在与类名一致的 `.swift` 文件中，包括取消控制器、权限状态对象和辅助视图。同一类的 `extension` 可按职责另存文件。新增文件必须加入 App 的 Compile Sources；完整项目中的工程生成脚本也会自动收集这些 Swift 文件。

## 内置 H5

- `Eluva/PerceptualEluOpenness/EluOpenness.eluva`：生产 H5 资源先以 raw DEFLATE 压缩，再经过两层独立 AES-256-GCM 加密。
- `Eluva/ResourcePackageKey.swift`：与密文包配套的随机密钥和完整性参数。两组密钥各40位，包含数字和字母。不可单独替换密文包或此文件。
- `Eluva/EncryptedWebResources.swift`：后台校验、解密和解包；缓存损坏自动重建，失败沿用启动页重试。
- `Eluva/NativeFonts`：仅保留原生启动失败提示使用的 Poppins Regular、重试按钮使用的 Plus Jakarta Sans SemiBold 两个字体文件。H5 所用的其他字体随加密包加载，无需在此重复复制。
- `Eluva/Licenses/ThirdPartyNotices.txt`：合并保存上述两款字体各自的完整版权声明和许可证，随 App 一起打包；资源同步时自动更新。
- `Assets.xcassets`：在解包前就需要的 App 图标和 LaunchScreen 素材。

运行时保留 `eluva://app/` 地址和唯一 Native Bridge，账户数据存储位置不变。解包缓存独立于用户数据；更新不会清空账号、动态、消息或订阅。

## 更新 H5

在完整 Vue 项目的根目录修改 `src`／`public` 后执行：

```sh
npm ci
npm run build
```

构建会审计资源并自动更新本目录中的加密包、配套 Swift 参数和原生资源。更新内容一致时复用已验证包；内容变化时生成新的随机密钥与 nonce。务必等命令成功结束，再启动 Xcode 构建或复制本文件夹。当前快照独立运行不需要 Vue 源码；要修改 H5，仍需完整 Vue 项目。

离线 App 必须携带解密能力，此加密用于避免直接查看打包资源和检测损坏，并不能保证抵抗设备端逆向提取。密钥不是账户凭证；请勿将其他服务的秘密密钥放入 H5 或此配置。
