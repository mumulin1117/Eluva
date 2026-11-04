# H5 资源包改名（2026-11-04）

- 将 `ios/Eluva/PerceptualEluOpenness/resources.eluva` 改为 `EluOpenness.eluva`。
- `scripts/sync-ios.mjs` 同步更新正式路径及暂存文件名；以后执行 H5 构建继续生成新名称。
- `ios/Eluva/CognitiveFlexibility.swift` 更新 Bundle 资源查找名称，沿用既有字符串编码方式。
- Xcode 通过 `PerceptualEluOpenness` 文件夹引用收集资源，无需修改工程引用；构建产物及实际安装包均仅包含新名称。
- 同步 `ios/README.md`、`docs/encrypted-h5-report.md` 中的资源路径。
- 构建发现现有原生解码方法已更名为 `eluvaresonantInterval`，生成脚本仍使用旧名。同步修正 `scripts/swift-string-codec.mjs`、`scripts/test-swift-strings.mjs` 与配套生成文件 `MoodAwarenessCoherence.swift`；解析保留旧格式兼容。

## 验证

- Vite 生产构建与 265 项资源审计、加密同步通过。
- Swift 字符串检查通过：4152 个原生表达式、394 个 Unicode／转义样例、枚举和清单解码；隔离资源的首次生成及重复同步复用通过。
- 使用独立 DerivedData 目录执行 Xcode Debug 模拟器构建通过；新包与源码包摘要一致，无旧文件名残留。
- iPhone 17 模拟器覆盖安装并重新启动，WKWebView 正常进入已登录首页；实际安装包名称及摘要再次核对通过。
- 不修改 H5 页面、登录注册逻辑或账户数据存储位置，未卸载或清空账户。
- 本轮未重新执行全页面六尺寸、键盘回归或物理真机验证；页面样式与输入逻辑没有修改。

构建日志和启动截图见 `docs/evidence/resource-package-rename-2026-11-04/`。
