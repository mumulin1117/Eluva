### 📢 任务修改执行报告

1. **修改了哪些文件：** 发布、资料编辑、个人中心、他人主页及权益页；共享头像与会员状态；Web／iOS 内容和资料仓储；英法文案；测试与契约。逐文件清单见下文。生产 H5 已同步到 iOS。
2. **每个文件解决了什么问题：** 移除 Audience 与头像框的固定锁定，接通当前账户已验证订阅状态；保存筛选和头像框并独立校验；补 PRO 身份展示和三项 Available 文案。
3. **是否影响登录注册流程：** 否。没有修改认证、注册资料顺序、账户凭证、协议同意或 Bridge 协议。
4. **是否影响本地用户数据：** 增加可选 `profile.avatarFrameId`；发布保留真实 `audienceFilter`。不清空账户、交易、关系、消息或动态。旧资料编辑器缺少头像框字段时保留历史选择，失败保持旧资料和草稿。
5. **是否检查了 iOS 适配和键盘交互：** 英法六视口覆盖头像框、Audience 和权益页；320 宽头像网格溢出已修复。小屏法语筛选允许弹层内部滚动，保存按钮可见，二级页无 TabBar。真实 WKWebView 页面验证通过；本轮没有实际弹起系统键盘或进行真机验证。
6. **如何测试本次修改：** Web 241 项通过；独立原生仓储 7 项和真实 WKWebView 4 项通过；Vite 构建／265 项资源审计同步／Xcode Debug 与无签名 iOS Release 构建通过。最终五处运行资源逐字节相同。测试使用独立存储与明确的收据夹具，没有发起购买或恢复。

问题来自页面与业务能力没有接通：Audience 的 Pro 按钮固定禁用；头像框点击固定打开会员提示，也没有保存选择；权益表的 Pro 列统一写成 Unavailable。已存在的订阅记录本身不需要删除、重新购买或手工延长。

本轮有效行为：

- 有效会员及有效账单宽限期会员，可选 Men Only、Women Only、Exclude Men、Exclude Women，保存回发布草稿并真实发布。筛选只决定推荐对象，不改变 Private、好友可见、主页展示或拉黑规则。Include 只匹配明确填写对应性别的用户；Exclude 排除对应性别，其余保留。
- 六款原始透明 PNG 头像框直接叠加当前头像，可预览、保存及清除。到期／撤销时隐藏展示而保留已保存选择；重新有效后恢复。过期用户仍能编辑其他资料并保留旧选择，不能换新框。
- **Profile badge 是会员有效期内的 PRO 身份标识**，在共享头像和个人主页资料中显示，不代表身份认证，也不解锁私信、单向关注或安全权限。已在权益页加入英法解释。
- Explore the benefits 的 Pro 列仅 People filters、Profile badge、Avatar frames 显示 **Available**，法语 **Disponible**。原有其他行和商业额度保持原样，没有照抄稿中的免费次数或无限承诺。
- 同账户会员首读、加载失败与重试独立处理。未读取不显示“去开通”来冒充非会员；冷启动直接进入自己的动态也会触发共享首读。多头像共享时钟与请求，不为每个头像创建轮询。
- 发布和保存的 Web／Swift 仓储再次检查订阅归属、到期及撤销状态。伪造 `proActive`、静态 policy、另一账户的收据或 UI 选中状态不能授权；待批准不授予权益。
- 他人的 PRO 与框来自读取时的安全公开投影，只含是否有效和框 ID，不泄露交易、金额、到期日或账户 token。该装饰随下一次资料读取更新；本地项目没有远端实时推送机制。

逐文件清单：

- `src/views/PostComposerView.vue`：按会员解锁，实际选中和保存回显；会员读取中／失败／重试；提交按当前状态校验。
- `src/views/ProfileEditView.vue`：选框、当前头像预览、无框选项及保存；非会员才显示原会员弹窗，保留草稿和失败重试。
- `src/components/AvatarFrame.vue`：只渲染白名单内的六款本地原始透明图。
- `src/components/PersonAvatar.vue`：独立圆形照片、装饰框和 PRO 标签，处理当前账户与安全公开投影、照片失败和首读。
- `src/views/MainView.vue`：个人中心使用共享头像，避免重复徽章。
- `src/views/ProfileView.vue`、`src/profile.css`：姓名旁的 PRO 标识与换行布局。
- `src/views/StoreView.vue`、`src/commerce.css`：三项 Available 和 badge 说明，保持现有表格体系。
- `src/personal.css`：头像选择按钮和预览布局，修复 320 宽网格溢出。
- `src/composables-membership.js`：共享到期时钟、页面刷新和只读头像缺失快照首读，清理计时器与监听器。
- `src/commerce-state.js`：多个安静读取等待同一请求的真实结果；账号切换与取消仍丢弃迟到结果。
- `src/domain/commerce.js`：从已有账户收据投影有效权益；不因读取初始化或伪造会员。
- `src/domain/content.js`：稳定筛选枚举及发现资格；原帖可读权限保持独立。
- `src/services/browser-content.js`、`ios/Eluva/ContentRepository.swift`：当前账户有效策略、真实筛选保存和发现资格。
- `src/domain/personal.js`、`src/services/browser-personal.js`、`ios/Eluva/PersonalRepository.swift`：头像框白名单、保存兼容和公开装饰投影。
- `src/domain/social.js`、`ios/Eluva/SocialRepository.swift`：公开资料只合并经过验证的装饰字段，忽略可编辑资料中的伪造状态。
- `ios/Eluva/CommerceRepository.swift`：原生复用相同的有效权益判断。
- `src/data/content-messages.js`、`commerce-messages.js`、`personal-messages.js`：英法功能、读取失败、会员要求和权益说明。
- `tests/pro-entitlements.test.js`、`pro-appearance.test.js`、`membership-composable.test.js`、`commerce-state.test.js`：权益、账户隔离、发现与访问边界、原子保存、公开字段和并发读取回归。
- `tests/fixtures/pro-benefits.html`：独立 IndexedDB 的有效／过期／撤销／宽限期／无会员及读取延迟失败夹具；不打入生产入口。
- `tests/native-pro/`：独立宿主、原生及 WK 测试、只向 `.build` 输出的生成器与复运行说明，不改变生产 Xcode target。
- `docs/app-flow-and-implementation-plan.md`、`p2-route-contracts.json`、`p6-route-contracts.json`：替换本轮相关的待确认／固定锁定描述，保留其他商业限制未确认边界。
- `dist/`、`ios/Eluva/Web/`：最终生产构建与同步资源（生成目录）。

设计与资源：

本轮重新读取蓝湖 Audience `4a029226-5e3e-4349-8e9a-f5c5d355fce5`、资料编辑 `7b1e83c6-51b7-4e0d-8fe8-97629eca6f5a`、权益表 `bff19b3d-1f29-42a7-a935-c674940b9443` 原图与标注。现有契约固定版本 1；本次目录返回设计 ID、画布和更新时间，但没有版本数字，未冒称核对了新的编号版本。195 单位画布、390 CSS 设计宽和 780px 参考 PNG 分别处理，保留当前页面布局。资料编辑原图标题为 Feedback，与页面名称不符，继续沿用已有 Edit Profile，不将图内示例标题复制到产品。

直接复用 `public/images/p5/avatar-frame-1.png` 至 `avatar-frame-6.png` 与 `public/images/p6/pro-badge.svg`。六图已检查透明中心与内容，无示例人物或固定业务文字；保留原图比例，没有新生成插画或 emoji。图 3 的头像开孔较大，使用独立头像内缩值匹配。原图及资源 SHA 见证据目录。

证据：

- [浏览器头像交互和 12 视口记录](./evidence/pro-entitlements-2026-10-24/browser-verified-summary.json)、[Audience／权益页另 24 视口和读取异常](./evidence/pro-entitlements-2026-10-24/browser-root-matrix.json)。六尺寸为 320×568、375×667、375×812、390×844、393×852、430×932，英法均完成；尺寸改变或弹层滚动后等待稳定再核实选中状态。
- [最终 WK 截图与 DOM](./evidence/pro-entitlements-2026-10-24/wk-final-attachments/manifest.json)、[11 项原生／WK 日志](./evidence/pro-entitlements-2026-10-24/native-final-tests.log)。独立 iOS 26.5、iPhone 17 模拟器；真实生产 controller、scheme handler、Vue 资源与唯一 Native Bridge。WK 视口 402×874，不能将浏览器六尺寸说成六台原生设备。
- [Web 测试](./evidence/pro-entitlements-2026-10-24/web-tests.log)、[构建和同步](./evidence/pro-entitlements-2026-10-24/vite-build.log)、[Debug](./evidence/pro-entitlements-2026-10-24/xcode-debug.log)、[Release](./evidence/pro-entitlements-2026-10-24/xcode-release.log)、[运行资源一致性](./evidence/pro-entitlements-2026-10-24/final-packaged-resource-audit.json)。

测试夹具只写独立临时库、密钥和偏好域，未修改用户正在使用的模拟器、会员或动态。浏览器控件区明确标为测试，未加入正式 UI。最终 native 测试源可按 `tests/native-pro/README.md` 重复运行。浏览器中断后的未执行列表是阶段记录，后续 root 完成的检查单独附在同一摘要中，未覆盖历史事实。

未验证／限制：没有进行本轮 Apple 沙盒实购、付款页、真实 Restore、跨设备同步、签名真机或系统键盘实测。当前项目仍采用已有本地数据模式。Vite 有大于 500kB 的单包体积提示；Xcode 有无 AppIntents 依赖的元数据提示。WK 测试窗口销毁附近出现一次 RPC delivery 和系统 WebKit/RBS 进程清理日志，未持续出现布局约束、资源缺失或渲染错误，11 项断言全部通过。既有用户修改及上一轮订阅 ID／代码清理改动保持原状，不混入本轮权益说明。
