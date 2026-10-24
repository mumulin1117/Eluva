### 📢 任务修改执行报告

1. **修改了哪些文件：** 涉及 35 个源码／测试／配置文件、README 和实施计划；逐文件用途及修改前后 SHA-256 见[文件记录](./evidence/presentation-polish-2026-10-19/source-files.json)。生成的 Web 资源通过既有构建流程同步至 iOS，213 个文件列于[资源清单](./evidence/presentation-polish-2026-10-19/build-manifest.json)。
2. **每个文件解决了什么问题：** 英文和法文统一使用普通产品文案；移除 Demo、本地数据、开发预览标签；隐藏生产环境诊断工具；更新隐私、协议、举报、帮助、验证、失败和权限用途说明。旧固定账号只升级精确匹配的原厂默认展示内容，保留用户编辑、关系和数据。下方附逐文件说明。
3. **是否影响登录注册流程：** 不改变流程、凭据、验证码、校验、Onboarding 或原子提交规则。固定账号退出后已实际重新登录；Welcome、登录与忘记密码入口已检查。固定验证码仍为 `567567`，通过“获取验证码”显示该值，不显示邮件已发送。已有协议同意状态及 `LEGAL_VERSION` 未重置。
4. **是否影响本地用户数据：** 有受限的展示升级：固定账号默认名 `Eluva Demo` 改为 `Alex Morgan`，两条原始默认问候改为自然文案，原厂会话标题改为人物名，修正一条申请与动态的文案关联。只匹配已知记录及原始默认值；其他账号、已修改文字、原始十条动态、帖子、评论、点亮、关系、已读和凭据保留。新增 `presentationVersion: 1`；写入失败回滚、重试和幂等经过 Web／原生测试。界面 `ELV10001` 是固定账号的显示别名，底层稳定 ID 不变。
5. **是否检查了 iOS 适配和键盘交互：** 英法两种语言 × 六种规定视口 × 首页／消息／我的／举报／隐私页，共 60 张矩阵截图；另有 20 张实际路径截图。所有截图像素尺寸与 DOM 视口逐次核对，未发现横向溢出或图片加载失败。一级 Home 保留 TabBar，Settings 无 TabBar；语言入口仍仅在设置。原生测试含两项实际打包 WKWebView 测试，但属于离屏自动化。本轮未执行模拟器界面手动操作、系统键盘及真机权限弹窗验证；不能据浏览器截图宣称这些检查已完成。
6. **如何测试本次修改：** Web 75/75、iOS 48/48 通过；Vite 构建、资源同步、Simulator 编译及未签名 iOS 设备编译通过。四份 213 文件 SHA-256 一致。1716 条翻译／协议字符串及三份权限声明扫描未检出 Demo／local 类展示文案。生产版本实际未显示诊断入口，浏览器控制台本轮 warn/error 为 0。详情见[验证摘要](./evidence/presentation-polish-2026-10-19/verification-summary.json)。

### 展示与业务边界

本轮落实用户 2026-10-19 的最新展示要求，覆盖旧规范中“普通界面必须标注本地演示”的视觉描述。数据仓储、唯一 Native Bridge、安全限制及持久化方式不变；内部 ID、错误码、兼容匹配字符串、资源文件名及历史证据不做关键词重命名。用户自己输入的 Demo／local 等内容不批量清洗。

- 举报使用“Report recorded / Signalement enregistré”，不承诺已发送给审核团队、封号或人工处理。举报表单的双语大小屏与取消返回已实际检查，本轮未对人物提交虚假举报；保存与失败路径由现有仓储测试验证。
- 帮助使用正常功能指引和“已记录”反馈。浏览器实际保存了一条“Comment fonctionne Eluva ?”功能问题并显示对应预置指引；不冒充人工客服或云端 AI。
- 固定验证码不变，“Get verification code / Obtenir le code de vérification”显示真实可用的 `567567`，不声称邮件发送成功。
- 视频入口使用摄像头预览／录制视频的准确名称，不显示虚假的对方在线或连接成功。头像、主题和摄像头的正常“预览”含义保留。
- StoreKit 商品读取、恢复入口、禁止购买状态保留。没有添加演示价格或模拟到账；实际 sandbox／Xcode 测试交易仍保留环境标识，避免误认为真实扣款。
- 协议／隐私正文去掉开发预览和本地假数据说明，采用已实现的资料、可见性、权限、安全及账户控制说明。运营主体、联系方式和发布法律审核尚未提供或完成；本次文案调整不是法律签核，也没有发布线上政策或接受新的法律协议。

### 逐文件用途

- `src/i18n.js`：认证、启动、验证、通用提示与错误的双语产品文案。
- `src/data/content-messages.js`：动态、发现、发布、引导、举报和失败提示的双语文案。
- `src/data/social-messages.js`：关系、消息、帮助、举报与保存反馈的双语文案。
- `src/data/personal-messages.js`：我的、资料、设置、反馈和账户操作的双语文案。
- `src/data/realtime-messages.js`：录音、视频、转写、翻译与恢复提示；能力名称保持准确。
- `src/data/commerce-messages.js`：购买不可用、余额与恢复提示；真实交易环境标识保留。
- `src/data/legal.js`：四类协议／隐私／社区说明的英法正文。
- `src/services/presentation.js`：诊断入口仅在 DEV 且显式 opt-in 时启用，生产永远关闭。
- `src/App.vue`：移除全局弹层中的开发协议标签，保留同意状态及操作。
- `src/views/WelcomeView.vue`：移除欢迎页 Demo 标记，保留协议入口与复选框。
- `src/views/AuthView.vue`：移除认证页本地流程说明，保留表单与反馈。
- `src/views/LegalView.vue`：移除开发协议提示条，展示普通正文。
- `src/views/HomeView.vue`：移除本地预览标签，约束诊断按钮及弹层。
- `src/components/PostCard.vue`：移除动态卡片的示例标识，不改图片填充与数据。
- `src/views/PostDetailView.vue`：移除详情示例说明，不改点亮、评论及举报能力。
- `src/views/PostListView.vue`：移除列表中的本地数据提示。
- `src/views/ProfileView.vue`：移除人物资料示例标记，保留关系与动态轮播。
- `src/views/FriendsView.vue`：移除好友／申请页本地说明。
- `src/views/ChatsView.vue`：移除本地社交说明，约束诊断入口及弹层。
- `src/views/ConversationView.vue`：移除会话 Demo 说明，保留实际消息与媒体状态。
- `src/views/MainView.vue`：移除我的页本地提示；固定账号显示自然姓名与显示 ID；约束诊断入口。
- `src/views/CollectionsView.vue`：移除合集的开发说明，保留实际限制与保存流程。
- `src/views/SettingsView.vue`：移除本地推送／协议开发标签，保留真实通知权限状态与唯一语言入口。
- `src/views/StoreView.vue`：移除未冻结商业规则的开发说明，保留不可购买、重试及恢复路径。
- `src/data/demo-fixtures.js`：统一展示升级版本、默认名、问候与申请文案；十条原文及稳定 ID 保留。
- `src/domain/demo-upgrade.js`：浏览器精确匹配旧默认文案，版本化幂等升级。
- `src/services/browser-repository.js`：在启动初始化原子持久化展示升级，失败可重试，不清库。
- `scripts/prepare-assets.mjs`：构建输出浏览器与原生共用的展示文案配置。
- `ios/Eluva/DemoFixtures.swift`：与 Web 对等的精确默认文案升级及幂等边界。
- `ios/Eluva/LocalRepository.swift`：加密 vault 初始化时原子持久化展示升级。
- `ios/Eluva/Info.plist`：英语 fallback 权限用途说明同步移除 Demo 文案。
- `ios/Eluva/en.lproj/InfoPlist.strings`：英语相机、麦克风和转写权限说明。
- `ios/Eluva/fr.lproj/InfoPlist.strings`：对应法语权限说明。
- `tests/demo-fixtures.test.js`：保护自定义资料／原文、跨账号与旧库失败回滚、重试及升级幂等。
- `ios/EluvaTests/DemoFixtureTests.swift`：对应原生资料保护、失败回滚与幂等检查。
- `README.md`：更新当前展示方式、诊断开关、验证码和实际技术边界。
- `docs/app-flow-and-implementation-plan.md`：记录用户最新展示要求及其对旧标签要求的覆盖关系。

### 设计与验证证据

本轮为文案、标签与诊断入口调整，沿用现有蓝湖组件、素材、字体、页面倍率和响应式布局，未引入新的视觉素材或第二套组件体系。重新读取的蓝湖索引见[设计来源](./evidence/presentation-polish-2026-10-19/design-sources.json)：Home `53ecd7cf-131b-4976-b8c8-52c10658774e`、Chats `a8a527a2-8862-4c27-a433-35f27599044a`、Mine `78750ef7-6763-4785-bdf0-08309be4ad4c`、Settings `ca85d44a-3696-4475-9f83-2fc4fea1b5b1`、Report `bf781331-8a70-4ced-8dfd-711ec4ded211`。本轮未重新完成全部图层的逐参数签核，不将文案检查等同设计全量验收。

- [浏览器逐次观察与截图路径](./evidence/presentation-polish-2026-10-19/browser-observations.json)
- [翻译／协议／权限文案扫描](./evidence/presentation-polish-2026-10-19/copy-audit.json)
- [生产资源四份校验](./evidence/presentation-polish-2026-10-19/resource-sync.json)
- [导航与语言入口观察](./evidence/presentation-polish-2026-10-19/navigation-checks.json)
- [浏览器最终 bundle](./evidence/presentation-polish-2026-10-19/browser-bundle.json)
- [Web 测试](./evidence/presentation-polish-2026-10-19/logs/web-tests.log)、[原生测试](./evidence/presentation-polish-2026-10-19/logs/native-tests-final.log)、[Simulator 编译](./evidence/presentation-polish-2026-10-19/logs/simulator-build.log)、[未签名设备编译](./evidence/presentation-polish-2026-10-19/logs/device-build-fallback.log)

原生自动化在 WKWebView 退出时仍有 RBS／ProcessSuspension 系统日志，编译有无 AppIntents 依赖的 metadata extraction 提示；测试和编译成功，不将其描述为原生控制台完全无告警。真实 iPhone 权限、键盘、原生界面及实际 sandbox 交易未在本轮执行。未接入真实后端、邮件或远端呼叫。

开发者复测：运行 `npm test`、`npm run build` 后启动预览；以固定账号登录，检查首页／我的／Chats 无 Demo 标签，查看英法协议和举报弹层，取消后返回；在设置保存法语并核对长文本，重新登录确认资料及关系保留。Xcode 运行 Eluva scheme 后在设备主动触发相机／麦克风／转写，核对新的系统用途说明及拒绝恢复，这一步仍需补做。
