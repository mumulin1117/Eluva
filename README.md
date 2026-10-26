# Eluva · 开发与验证记录

2026-10-24：已移除自动化测试、浏览器夹具、独立原生测试宿主、开发诊断面板及故障注入；不再提供 `npm test` 或 Xcode 测试 target。下文的测试次数和截图属于历史验证记录。固定账号、共享模拟数据、正常失败重试和生产构建审计保留。详见[清理报告](docs/test-code-removal-report.md)。

2026-10-22：帮助入口统一为 Help Buddy，新增标题40×40客服头像、44px输入框和完整英法说明。自由问题显示五秒加载后回复未找到合适答案，预设问题即时回答；离页返回保留草稿和原等待时间。Web 107项及英法WKWebView测试通过，详见[修改报告](docs/help-buddy-update-report.md)。

2026-10-22：聊天发送、Help buddy 发送以及他人主页关注／取消关注不再显示 Saved 成功提示，消息下方也移除 Saved 标签；已有已读及失败反馈保留。Web 105 项与英法 WKWebView 两项测试通过，双语六尺寸和生产／iOS 构建已验证，详见[修改报告](docs/silent-social-success-report.md)。

2026-10-19 认证方向已纠偏：用户确认改用蓝湖连续对话、资料顺序与快速问答，手机号改邮箱，旧九步不再是新注册链路。当前已实施同一会话内的欢迎、邮箱注册／登录、验证、忘记密码、六阶段资料、十题问答与简介确认。Web 79 项与 iOS 全套 50 项通过，最终增量另跑双语 WKWebView 集成测试。详见[实施报告](docs/auth-conversation-implementation-report.md)、[逐状态设计映射](docs/auth-conversation-state-map.json)与[契约](docs/auth-conversation-contract.json)。真机签名和完整视觉签核仍未完成；历史 P1 证据不作为新流程证明。

2026-10-19 展示文案已统一为普通产品体验：移除 UI 中 Demo／local data／local social、协议开发预览和本地数据说明，生产版本隐藏诊断工具；两种语言、权限用途说明、帮助、错误提示及旧固定账号默认展示文案同步更新。底层仍使用既有本地仓储，未接入线上服务、邮件、远端通话或人工审核；举报／反馈使用“已记录”结果。原始用户内容及内部稳定 ID 不做关键词清洗。详见[展示文案修改报告](docs/presentation-polish-report.md)。

界面语言的唯一手动入口为“个人中心 → 设置 → App language / Langue de l’application”。其他页面的语言按钮、下拉框及语言弹层已移除，系统首次语言匹配、已保存偏好和设置页保存逻辑保持不变。见[语言入口修改报告](docs/language-entry-report.md)。

最新 UI 补充：他人主页多图动态自动轮播，支持手动切换与暂停；Home 推荐图片以 ScaleAspectFill 填满图片框。见[本轮修改与验证报告](docs/post-carousel-report.md)。数据集成阶段的日志和截图仍保留原版本边界。

2026-10-19 已接入用户提供的 20 张头像、10 条英文动态和 19 张动态图片。App 共享 20 位虚构示例人物，2026-10-26 起 Nora Ellis 和 Liam Carter 对应两组预置好友会话，与十位动态作者分离；人物主页、消息、好友申请与动态共用稳定 ID。旧账户原子升级，保留自行发布内容、评论、点亮、已读和关系状态。详见[本轮数据报告](docs/demo-data-integration-report.md)、[人物及动态对应清单](docs/demo-data-catalog.json)和[验证摘要](docs/evidence/demo-data-2026-10-19/verification-summary.json)。本轮 Web 70 / 原生 47 项测试通过，生产资源 213 文件四份 SHA-256 一致；108 张双语六尺寸浏览器截图与实际模拟器 WKWebView 首页分别留证，未进行真机交互验证。

Vue 3 + Vite H5，UIKit + WKWebView 本地封装。P7 完成可执行的逐页审计、双语六尺寸浏览器回归、缺陷修复、生产资源四份核对及最终 Xcode 测试/构建。**P7 未达到发布验收：正式设计签核、原生交互、真机及商业冻结仍有待办。** 详情见 [P7 报告](docs/p7-implementation-report.md)、[页面与状态登记](docs/p7-acceptance-registry.json)、[视觉差异](docs/p7-visual-audit.json)和[证据摘要](docs/evidence/p7/verification-summary.json)。登记状态不等于通过状态，浏览器、离屏 WKWebView、原生界面和真机结论分别记录。

## 运行

```sh
npm ci
npm run dev
npm run build
npm run ios:build
```

`build` 会检查生产资源，压缩并进行两层 AES-256-GCM 加密，自动同步到 `ios/Eluva/PerceptualEluOpenness`，同时更新配套密钥与原生字体。运行时后台校验解包后再启动 H5 和数据服务。工程文件已经生成，日常可直接打开 `ios/Eluva.xcodeproj`，使用 Eluva scheme。整个 `ios` 文件夹可以独立交付，接收者无需 Node、Ruby 或本机目录，详见 [iOS 交付说明](ios/README.md)。需要重建工程时执行 `npm run ios:project`，依赖 Ruby 的 `xcodeproj` gem；已修改的签名或构建配置应先同步进生成脚本。

日常构建证据默认写到 `.build/evidence`，不覆盖阶段历史记录。`build` 保留生产资源引用审计与 iOS 同步。

模拟器构建使用专属本地签名与 `Simulator.entitlements`，以支持真实 Keychain；不要使用 `CODE_SIGNING_ALLOWED=NO` 运行模拟器账户流程。该权限文件仅对 Simulator 生效，不能用作真机签名。2026-10-21 用户确认正式 Bundle ID 为 `com.eluva.app`，工程和生成脚本已同步；开发团队/真机签名仍待配置。旧 `com.eluva.local` App 数据未删除，也未自动跨沙盒迁移。模拟器 Keychain access group 与 vault service 保留原命名以兼容旧密钥。

## 本地账户与数据边界

- 固定测试账号：`eluva@gmail.com` / `123qweasd`。
- 注册与重置验证码始终为 `567567`；“获取验证码”会明确显示该验证码，界面不声称已发送邮件。
- 新账户必须完成全部资料步骤并在 Complete 提交后才能登录。中途退出或重载不产生正式账户。
- 浏览器使用 IndexedDB；iOS 使用 Keychain 密钥加密的本地 vault 和沙盒媒体。两者数据彼此独立。
- 账户、草稿、照片和会话不会上传到服务端。协议／隐私页已改为产品功能与控制说明，不再展示开发预览标签；这不是法律签核或已上线政策，运营主体、正式条款和联系方式仍须在发布前审定。本轮不重置既有同意记录。

完整变更、来源及待办见 [P6 实施报告](docs/p6-implementation-report.md)、[逐页契约](docs/p6-route-contracts.json)、[文件清单](docs/evidence/p6/source-files.json)和[验证摘要](docs/evidence/p6/verification-summary.json)。[P1](docs/p1-implementation-report.md)／[P2](docs/p2-implementation-report.md)／[P3](docs/p3-implementation-report.md)／[P4](docs/p4-implementation-report.md)／[P5](docs/p5-implementation-report.md)为历史阶段记录；[实施计划](docs/app-flow-and-implementation-plan.md)区分实施、假设和待验。

`src/domain/commerce.js` 是唯一商业策略来源，构建生成原生共用 `commerce-policy.json`。2026-10-24 已按用户更正的ID配置同组自动续期商品 `eluva_monthly_promembe`（1月）、`eluva_quarterly_promembe`（3月）、`eluva_annualy_promembe`（1年），页面展示USD4.99／12.99／39.99，确认购买时读取StoreKit实际报价；验证交易保存后再 finish，Mine/订阅页同步 Pro 与 Apple 到期日，右上角 Restore 显式恢复，另有系统订阅管理入口。详见[商品ID更新报告](docs/subscription-id-update-report.md)及[原订阅实现报告](docs/subscriptions-implementation-report.md)。免费/奖励/金币数值、时区及其他 Pro 限制未新增冻结，既有发布边界维持。公开发布与流水原子写入，私密/失败/同 commit 重试不重复消耗；production/sandbox/xcode 分账，浏览器不产生付费余额。恢复不重发已消费金币，不承诺迁移跨设备本地钱包。StoreKitTest 已验，Apple 沙盒付款页和真机仍待办。

P5 资料/主题/反馈与合集按账户隔离，保存前不污染权威记录，退出保留正式资料；暂存清理兼容旧注册照片。删除容器保留原帖、帖子删除清理引用、删号只处理目标账户及关联内容，均有仓储原子/回滚测试。浏览器最终不可恢复删除待具体确认，三个本地 QA 对象保持原样。多合集引用、技术预览上限、固定测试账号删除保护和 16px 编辑文字适配仍不是用户新增确认要求。

固定账号 Chats 具有 Nora Ellis、Liam Carter 两组预置互关好友和纯文字会话（均没有预置动态）、来自 Chloe Martin 的收到申请及向 Theo Brooks 发出的申请；人物均使用本轮提供的对应头像。已改变的关系与已读不重置，新注册账号不会继承固定账号的私信、申请和关系，但可以浏览全部共享人物与公开动态。持续私聊通过双方互关或动态 Reply 获得实际回复解锁，单向关注和点亮不解锁。拉黑后消息、媒体、资料和内容权限立即受限，解除不补发且暂保留原好友实体；忽略后再次申请政策尚待确认，当前不自动重发。

介绍500字素、消息/反馈2000字素、单张图片或单个贴纸附说明是尚未正式确认的技术预览方案；图片20MiB沿用现有安全限制。发送不会消费金币/额度；已读只来自接收者实际读取，不伪造远端状态。帮助中心保存反馈并显示预置功能说明，不接人工客服或云 AI；UI 使用普通帮助文案，不冒充真人回复。

好友会话麦克风入口先显示权限解释，用户启用后重新按住录音，松开发送、上滑取消。原始录音转存失败可重试，发送失败保留语音和独立文字草稿。浏览器不假装原生录音成功，可导入真实PCM WAV（QA素材 `public/demo/local-voice.wav`）。权限拒绝/不支持均有恢复说明。1–60秒、10MiB和上滑72逻辑像素是可逆的技术预览假设，未当成用户已确认规则；时长/大小配置由 `src/domain/realtime.js` 构建生成原生共用JSON。

视频按钮只进行本机摄像头预览或明确标识的录制样片，不发起远端呼叫。麦克风默认关闭；打开后仅显示本地输入电平，不上传或播放给别人。样片模式禁用开麦和换摄像头，摄像头按钮明确改为样片暂停/继续。后台/离页/拉黑/挂断结束作用域，原生硬件释放成功仍待真机验收。

P7 补充无人接受的本地来电演示超时：30秒后经既有 Bridge 原子结束并释放占用，迟到的离页清理不覆盖超时原因。30秒是可调整的技术预览默认值，不是已确认业务门槛；接受进入视频同意页后不沿用来电横幅计时器。浏览器不支持相机时可改选图库，只有原生权限拒绝/受限才提供系统设置恢复。

2026-10-19 用户明确移除设计中不存在的语言帮助：动态、评论、文字和语音消息均不再提供翻译、转写、源语言选择及结果面板；历史原文、消息和派生缓存保留。英语／法语界面切换仍只位于个人中心 → 设置 → 语言。详见[语言帮助移除报告](docs/language-help-removal-report.md)。

App 预置恰好 10 条共享展示动态，正文保持用户提供的英文原文，切换法语不覆盖内容。原有两个帖子 ID 继续使用，另外增加八条；已有用户帖子保留，因此已有测试库总数可以多于 10。所有账号（包括新注册账号）均可按可见性、拉黑和筛选规则浏览这些帖子；不会给新账号复制测试会话。

发布草稿在当前运行会话内保留，返回、弹层取消和切换语言不丢内容；关闭或重载整个应用不承诺恢复未提交正文。发布成功后才形成正式帖子。私密帖子回到“我的发布”，不进入发现、不扣公开额度。

`src/domain/content.js` 的策略是浏览器和原生共用来源，构建生成 `public/config/content-policy.json`。正文2000字素、9图或1个60秒/50MiB视频等为待确认的技术预览假设。每日3条、免费2个合集没有确认，不强制实施；当前每日限额为 null，UI 显示未设每日上限。Pro筛选保持锁定。

通用设备的无签名编译可使用：

```sh
xcodebuild -project ios/Eluva.xcodeproj -scheme Eluva -configuration Debug -destination 'generic/platform=iOS' -derivedDataPath .build/device CODE_SIGNING_ALLOWED=NO build
```

2026-10-21 已修正共享目录与 Chats 读取：预置 20 用户、10 动态取消固定账号可见限制，版本3增量迁移保留原始 ID 与所有账户数据；Chats 空快照结束加载并展示双语占位，失败显示重试。详见[本轮报告](docs/shared-content-new-account-report.md)。

2026-10-21：固定测试账号两组会话采用纯文字历史，不再预置语音。展示迁移版本 2 定向移除旧版本两条内置语音占位，保留实际录音、其他账户、关系与文字记录。详见 [测试会话纯文字历史报告](docs/test-chat-text-only-report.md)。

2026-10-21：聊天视频入口采用蓝湖“接通后”版本1的头像连接中布局，入页通过现有Bridge准备摄像头／麦克风权限，授权不接通，挂断返回会话。详见 [视频连接页报告](docs/video-connecting-report.md)。
