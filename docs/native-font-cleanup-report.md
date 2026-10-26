### 📢 任务修改执行报告

1. **修改了哪些文件：** `ios/Eluva/NativeFonts/`、`ios/Eluva/Info.plist`、`scripts/sync-ios.mjs`、`ios/README.md`，以及本报告和核对证据。
2. **每个文件解决了什么问题：** NativeFonts删除15个无原生消费者的文件；Info.plist从8项注册精简为实际使用的2项；同步脚本由复制整个H5字体目录改为仅复制2款字体和2份许可证；iOS说明同步记录这一区别。没有修改H5字体或样式。
3. **是否影响登录注册流程：** 否。只精简重复的原生字体资源；登录注册流程与页面资源不变。
4. **是否影响本地用户数据：** 否。不改持久化、账户、消息、草稿、订阅或加密密钥。
5. **是否检查了 iOS 适配和键盘交互：** 在隔离iPhone SE第3代／iOS17.5上以法语实际启动WKWebView并截图，首屏字体与资源正常。本轮未修改布局、Safe Area或键盘，未重新执行六尺寸及键盘全流程，未进行真机验证。
6. **如何测试本次修改：** 全量原生字体引用核对、TTF内部PostScript名称核对、plist校验、Vite构建及资源同步、重复同步、Xcode Debug模拟器构建、最终.app资源清单核对及WKWebView启动通过。没有增加测试源码或测试入口。

| 保留文件 | 使用位置／原因 |
| --- | --- |
| `poppins-regular.ttf` | `WebViewController.swift`原生启动失败说明，`UIFont(name: "Poppins-Regular", size: 14)`。 |
| `plusjakartasans-semibold.ttf` | 同页重试按钮，`UIFont(name: "PlusJakartaSans-SemiBold", size: 14)`。 |
| `poppins-ofl.txt` | Poppins授权说明。 |
| `jakarta-ofl.txt` | Plus Jakarta Sans授权说明。 |

此前同步脚本复制了整个`dist/fonts`目录，造成NativeFonts中多份仅供H5使用的字体重复打包。现由明确的4文件白名单同步，构建时移除旧目录后发布新的资源集合，不会重新带回多余文件。两个TTF的内部PostScript名称均与原生调用一致。

原生资源由19文件、2,256,634字节精简为4文件、265,699字节；减少1,990,935字节（约1.90MiB，88.2%），其中删除11个多余TTF及4份不再对应原生字体的许可证。删除清单和前后SHA256见[核对记录](evidence/native-font-cleanup-2026-10-26/manifest.json)。

H5使用的其他字体继续保存在`public/fonts`和加密资源包中。构建后加密包SHA256与清理前完全相同，仍包含265个生产资源。最终`.app/NativeFonts`与源目录一致，仅4文件，无增量构建残留。

构建通过，保留既有Vite chunk大小提示及Xcode未依赖AppIntents的元数据跳过提示，无构建错误。证据位于[本轮目录](evidence/native-font-cleanup-2026-10-26/)。可复测：执行`npm run build`检查NativeFonts仍为4文件，再用Xcode运行Eluva。

已另外生成当前iOS工程交付包：`.build/deliverables/Eluva-iOS-standalone-2026-10-26.zip`。保留10月24日旧包作为历史快照，转交时请使用新包或当前整个`ios`目录。
