### 📢 任务修改执行报告

2026-10-20。本轮同时完成 CHATS 下拉刷新与首次加载，以及 Just Light Up 二级页纠偏。

1. **修改了哪些文件：**
   - 页面与组件：`src/views/ChatsView.vue`、新增 `src/views/LightNoticesView.vue`、新增 `src/components/PullToRefresh.vue`、`src/components/AppModal.vue`、`src/views/ProfileView.vue`、`src/router.js`。
   - 状态与展示：`src/social-state.js`、`src/social.css`、`src/data/social-messages.js`。
   - 数据服务及账户清理：`src/domain/social.js`、`src/services/browser-social.js`、`src/domain/personal.js`、`ios/Eluva/SocialRepository.swift`、`ios/Eluva/PersonalRepository.swift`。
   - 原始本地素材：`public/images/light-notices/help.png`、`clear.png`、`profile-button.png`。
   - 测试：`tests/social.test.js`、新增 `tests/fixtures/chats.html`、`tests/fixtures/mark-read.html`、`ios/EluvaTests/SocialTests.swift`、`ios/EluvaTests/WebBundleTests.swift`。
   - 文档：实施计划、本报告与证据目录；生产包和 iOS Web 资源同步更新。23项实现文件的 SHA256 见 [source-files.json](/Users/linqian/Documents/Eluva/docs/evidence/chats-lights-2026-10-20/source-files.json)，另包含本报告和生成产物。
2. **每个文件解决了什么问题：**
   - ChatsView 移除可见 Refresh messages 按钮及其空占位，保留真实会话列表；首次访问显示四行头像/文字骨架，后续返回保留缓存内容和合理滚动位置。骨架跟随原有 social snapshot 实际读取，不设置固定延迟；本地读取很快时展示时间也较短。
   - PullToRefresh 直接监听既有 `.page-content`，没有增加第二层滚动容器。顶部下拉显示紫色玻璃胶囊、箭头及加载环；不足阈值松手回弹，达到阈值后松手读取一次，刷新中保留原列表并防止重复请求。覆盖独立 touch / pointer 输入、取消、失去捕获、背景切换、离页清理及拖动后的误点击抑制；减少动态效果时关闭骨架动画。保留仅供辅助技术和键盘使用的刷新操作，不恢复页面底部按钮。
   - `/chats/lights` 为独立二级页，返回 CHATS，隐藏 TabBar 并释放占位。头像、姓名、时间、原帖引文和 Profile 按钮连接实际数据；个人主页返回恢复该页。问号与清扫使用附件原PNG；英语 Profile 使用原按钮，法语为真实文本。
   - 首次说明在当前账户点击 Got It 并保存成功后不再自动弹出，问号仍可重开。保存失败留窗重试。首次读取失败后重试成功也会显示说明，不依赖新注册或首页 guideDone。
   - 数据层根据双方是否已有实际文字、图片、语音、表情或动态 Reply 初始消息计算 `lightOnly`。已有实际消息的用户对进入普通会话；未互关且 Reply 未获实际回复时仍不可持续发送。分类不建立关系、不授予消息权限；拉黑继续优先。
   - 清扫仅保存当前账户对应通知的 `dismissedEvents` 标记，清空该分类并同步未读角标；不取消点亮、不删除帖子或实际聊天，提供本次清扫的 Undo。清扫与恢复沿用唯一 Bridge 的 social 服务，具有原子保存与 commitId 去重；失败保留原列表。撤销的 ID 数组转换为普通数组，修复 WebKit 无法传递响应式数组的问题。旧数据仅增加兼容字段，不重置；删号时仅清理该账户标记。
3. **是否影响登录注册流程：** 否，未修改认证、固定验证码、EULA 或注册规则。
4. **是否影响本地用户数据：** 新增账户内提示已了解状态和通知隐藏标记；保留账户、帖子、点亮、消息、关系及既有已读记录。偏好保存不会覆盖提示状态。历史 `filter=lights` 在进入 CHATS 时迁回普通 All 入口，不再将一级页当作仅点亮分类页。
5. **是否检查了 iOS 适配和键盘交互：** 英法 × 六视口 × 消息列表/仅点亮列表/帮助弹窗，共36组最终浏览器记录与截图，无横向溢出和缺失图片；一级页有 TabBar，二级页无 TabBar。320宽法语允许卡片增高、正文换行和主内容滚动，帮助始终保留可见操作。Native 使用受控模拟器窗口及合成 Safe Area；下拉用合成 WebKit TouchEvent / PointerEvent 验证。页面没有编辑框，未修改键盘；实体 iPhone、系统键盘、真实手指手势与设备安全区仍未验证。
6. **如何测试本次修改：**
   - `npm test`：90项通过。新增分类迁移、一次 Reply 不额外解锁、清扫失败回滚、并发去重、撤销、保留原始消息/点亮和跨账户拒绝测试。
   - 最终 Xcode 功能定向测试5项通过：1项原生 Repository 分类/清扫/撤销测试，英法2项消息页与二级页 WKWebView 测试，以及原有英法2项批量已读弹窗回归。另在实际 UIWindowScene 的可见测试窗口中复跑英法2项，通过并导出8张有效像素截图，避免将空白图片当作视觉证据。
   - WKWebView 覆盖首次骨架、短拉取消、PointerCancel / TouchCancel、触摸刷新、重复手势仅一次读取、刷新失败保留列表、重试、六尺寸帮助、清扫失败/成功/撤销、返回后不重复首提示及问号重开。初次读取与刷新截图通过仅测试用的读取挂起观察，不进入生产。
   - 浏览器实际走通拖动刷新、进入二级页、首次提示、个人主页返回、清扫失败重试、撤销，以及 Reply 后从3张点亮卡变为2张，普通聊天出现待回复会话。隔离夹具原始3条点亮记录仍保留；没有清空生产账户或原有动态。
   - Vite 生产构建、资源审计与同步、模拟器构建/测试、iPhoneOS 无签名构建通过。235个资源在 dist、iOS Web源目录、模拟器App和设备目标App四处逐文件 SHA256 一致。Vite 有大于500kB的分包提示，未扩展本轮范围重构路由加载。无签名构建不等于安装或真机验证。

设计依据：蓝湖“消息--仅点亮” `1b615b7d-76c4-44c0-b769-2888905d8198` 与“弹窗-仅点亮的提示” `c436d532-d83d-49fc-b9e1-c5b96e53af60`，本轮均核对版本1，更新时间分别为 `2026-10-13T15:14:57.410461Z` / `.234526Z`。原图780×1688按390×844逻辑尺寸核对。DDS Schema 权限校验未通过，已使用接口返回的标注回退；没有使用整张设计图作为界面背景。

标注对应：标题 Poppins 18/600/27，姓名 Inter 16/700/19，时间 Plus Jakarta Sans 11/400/14，通知正文 Plus Jakarta Sans 15/500/20，卡片基准360×135、内容左右20、头像44，卡片间距16。帮助标题 Poppins20/600/30、正文16/400/24、按钮16/700/24。提示渐变未返回完整原始参数，采用附件的背景像素取样拟合：y900为(186,124,253)、y1568为(127,59,239)，端点使用rgba(187,125,253,1)与rgba(127,59,239,1)，是附件重建值，不宣称来自原始渐变图层。字体使用现有本地家族，未声称拥有设计师相同字体二进制。

三个附件PNG导入时直接复制并使用英文名称，没有重画图标。Profile PNG实际154×68，与切图logical_size75×32略不同；按原图比例显示，不拉伸为75×32。Downloads原路径在最终复核时已不存在，项目中的已导入资源完整保留，未声称再次与该路径做字节比对。卡片按实际姓名与原帖长度增高，不复制原图示例Hazel的数据。

验证过程保留首次中断和诊断日志：发现并修复普通会话包装层不可见、WebKit撤销参数兼容问题；补充受控测试窗口、真实容器宽高与动画帧稳定条件后，最终5项全部通过。随后发现旧截图窗口没有连接实际 UIWindowScene，生成的8张消息页PNG为全黑，已明确废弃为视觉证据；窗口连接场景并成为keyWindow后，额外2项复跑通过，8张消息页截图逐张检查存在有效像素并人工核对。模拟器有WebKit进程回收RBS/ProcessSuspension提示，不将其描述为真机控制台无告警。功能结论以 `wkwebview-release.log` 为准，新增页面的视觉结论以 `wkwebview-visible.log`、`native-visible` 和 screenshots 中最新同名PNG为准。

证据：[浏览器矩阵](/Users/linqian/Documents/Eluva/docs/evidence/chats-lights-2026-10-20/browser-matrix.json)、[交互记录](/Users/linqian/Documents/Eluva/docs/evidence/chats-lights-2026-10-20/browser-flow.json)、[原生功能摘要](/Users/linqian/Documents/Eluva/docs/evidence/chats-lights-2026-10-20/native-test-summary.json)、[可见窗口复核摘要](/Users/linqian/Documents/Eluva/docs/evidence/chats-lights-2026-10-20/native-visible-summary.json)、[有效原生截图与观察](/Users/linqian/Documents/Eluva/docs/evidence/chats-lights-2026-10-20/native-visible/manifest.json)、[资源校验](/Users/linqian/Documents/Eluva/docs/evidence/chats-lights-2026-10-20/resource-verification.json)、[设计来源](/Users/linqian/Documents/Eluva/docs/evidence/chats-lights-2026-10-20/design-reference.json)。

复测：进入 CHATS → 列表顶部下拉刷新 → 点 Just Light Up → 首次 Got It → Profile 返回 → 问号重开 → 清扫 → Undo；发送一次动态 Reply 后返回 CHATS，确认该会话移入普通列表且仍显示待回复限制。

![仅点亮列表英文390×844](/Users/linqian/Documents/Eluva/docs/evidence/chats-lights-2026-10-20/screenshots/lights-en-390x844.jpg)

![帮助弹窗英文390×844](/Users/linqian/Documents/Eluva/docs/evidence/chats-lights-2026-10-20/screenshots/help-en-390x844.jpg)

![WKWebView首次加载](/Users/linqian/Documents/Eluva/docs/evidence/chats-lights-2026-10-20/screenshots/Chats-en-initial-loading.png)
