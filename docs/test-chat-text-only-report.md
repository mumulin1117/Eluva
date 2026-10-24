# 测试账号聊天历史改为文字

日期：2026-10-21。范围：固定账号 `eluva@gmail.com` 的两组预置会话，不调整聊天页面视觉、互动权限或实际录音功能。

## 修改文件

- `src/services/browser-repository.js`、`ios/Eluva/LocalRepository.swift`：新安装的两组测试会话不再生成 `echo-voice`、`notes-voice` 语音占位。
- `src/data/demo-fixtures.js`：展示迁移版本升为 2；公开用户／动态目录版本继续为 3。
- `src/domain/demo-upgrade.js`、`ios/Eluva/DemoFixtures.swift`：下次启动时，原子移除旧持久化数据中的两条指定语音，同时更新旧认证返回的会话夹具。必须同时匹配固定账号、稳定消息 ID、会话、收发用户、voice 类型、demo 标记与内置音频路径，并且没有真实 `mediaId`；其他消息与媒体文件保持原样。原有文案清理只在展示版本 0 时运行，版本 1 升级不会重置用户后来改回的名字或文字。
- `tests/accounts.test.js`、`tests/social.test.js`、`tests/demo-fixtures.test.js`：更新纯文字预置断言；新增旧数据迁移、写入失败回滚、重试、重新加载幂等，以及真实录音／其他账户／文字已读状态／凭证保留回归。
- `ios/EluvaTests/SocialTests.swift`、`ios/EluvaTests/DemoFixtureTests.swift`：同步原生夹具预期，新增等价迁移回归。
- `ios/EluvaTests/RealtimeTests.swift`：语音兼容能力测试改为在隔离测试中实际建立音频消息，不依赖产品预置语音。
- `ios/EluvaTests/WebBundleTests.swift`：英语／法语实际打包会话必须有文字、没有预置语音气泡；保留草稿返回检查，并保存六尺寸会话截图。
- `AGENTS.md`、`README.md`、`docs/app-flow-and-implementation-plan.md`、`docs/demo-data-catalog.json`：同步本次最新要求，避免旧“每个测试会话必须包含语音”规则再次生成占位记录。
- `ios/Eluva/Web`：生产资源同步产物；证据在 `docs/evidence/test-chat-text-only-2026-10-21/`。

## 数据和交互

两组测试好友、稳定会话 ID、上下文文字、关系状态、已读状态、用户凭证均保留。此次删除仅针对用户明确要求移除的两条内置语音历史；用户主动发送的录音、其他账户消息、图片与录音能力不受影响。不清空账户、不重新生成所有会话、不按“所有 voice 类型”过滤消息。

下一次安装更新包并启动时生效；迁移写入失败不会半删，原数据可在重试时继续处理。登录注册界面与认证规则没有改变。

## 验证记录

- Web：`npm test` 105 项通过、0 失败，见 `web-tests.log`。
- Vite 生产构建、资源审计和 iOS 同步通过，见 `build-final.log`。保留项目既有 chunk 大于 500kB 提示。
- 最终原生／WKWebView：8 项通过、0 失败；包括 6 项仓储及 2 项英法实际打包页面回归，保存 12 张会话六尺寸截图。结果见 `native-verified.log`、`native-summary.json`；构建编译阶段的旧失败日志保留，最终结果单独记录。
- iphoneos Release 无签名构建通过，见 `device-verified-build.log`。
- 四份生产资源各 260 文件、哈希完全一致，见 `resource-hashes.json`。
- 本轮未改 UI 结构，无需重新提取蓝湖素材。聊天继续复用原组件和唯一 Bridge；英法六尺寸的打包 WKWebView 记录验证文字会话、无语音气泡、无横向溢出、二级页隐藏 TabBar 与草稿返回保留。
- 原生仓储录音测试覆盖实际音频文件提交、失败回滚、重试、幂等及权限边界；这些是隔离测试，不是实体设备录音验证。

## 验证边界与复测

真机签名安装、真实软件键盘及实体设备触摸／录音没有执行。模拟器的离屏 WKWebView 截图不代表真机结论；顶部／底部 Safe Area 使用测试参数。当前请求不改变录音采集或键盘逻辑。

开发者复测：更新后启动 App → 登录固定测试账号 → Chats → 分别进入 Maya Brooks、Leo Martin 的会话。两组内置历史应只有文字；主动输入聊天仍可用，返回重入保留草稿。已有用户实际发送的语音仍应保留。
