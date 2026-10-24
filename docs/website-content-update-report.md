### 📢 任务修改执行报告

日期：2026-10-22。范围：用户提供的静态官网 `/Users/linqian/Downloads/Eluva/`。文件已同步，未部署到远端网站。

1. **修改了哪些文件：**
   - `index.html`、`privacy.html`、`terms.html`、`support.html`、`about.html`，以及对应 `fr/` 下的五个页面。
   - `assets/js/main.js`、`assets/css/style.css`、新增 `assets/css/fonts.css`、16个 WOFF2 字体文件及3份 OFL 许可。
   - 新增 `content/site_content.py`、`content/home.html`、`scripts/build_site.py`；更新 `README.md`、`URLS.txt`；新增 `robots.txt`、`sitemap.xml`。
   - 提供完整 `publish/` 静态发布目录与 `Eluva-website.zip`。完整文件明细及哈希见本报告的证据目录。
2. **每个文件解决了什么问题：**
   - 隐私政策：补齐处理者、联系渠道、数据类别、用途、设备内保存、媒体权限、Apple交易、网站请求、语言偏好、第三方、保留和删除、隐私权利、18岁限制、安全和政策变更。
   - 用户协议：补齐账户、内容权利、可见性、合集引用、点亮与关注、私聊解锁、单条待回复限制、社区行为、举报与支持、媒体权限、自动续期、恢复、取消、退款、删号和法定权利。未添加评论功能、单向关注解锁私聊或不实的远端审核承诺。
   - 支持页：增加真实提供的联系邮箱、账户帮助、安全问题、订阅恢复/取消/退款、删号、媒体权限、Help Buddy及隐私请求说明。明确反馈记录不等于团队已收到支持请求。
   - 首页和关于页：保留原有视觉结构，准确描述互动条件；未上架入口显示 Coming soon / Bientôt，不编造 App Store 链接或等待中的真实用户。
   - 双语：原来不完整的 EN/DE 文本替换改为10个完整 EN/FR 静态页面；导航、标题、正文、说明和元数据同时覆盖。语言切换保持当前逻辑页面；主页记忆选择，直接访问明确语言的政策链接仍遵循该链接。JavaScript禁用时正文及普通链接依然可用。
   - 样式：CSS仅将远程字体导入改为站内同款字体，并按用户明确授权修正浅色内容区的正文/标题、眉题和日期颜色。字号、字重、行高、布局规则、渐变、动画、阴影及圆角未调整。CSS差异已保存。
   - 资源和发布：同一字体家族及原字重进入站内资源，取消 Google Fonts 运行时请求。补齐favicon、真实域名canonical/hreflang、10页站点地图及robots。脚本/CSS使用内容哈希版本参数，避免旧文件缓存。README改为实际存在的publish目录上传说明。
3. **是否影响登录注册流程：** 否。未修改App代码、认证流程、协议勾选或已存同意版本。
4. **是否影响本地用户数据：** 否。未读取、清空或迁移App账户、帖子、消息、订阅或隐私设置。官网仅使用浏览器语言偏好。同步前核对原目录18个文件未被并发修改，保存原始压缩备份；同步后91个文件逐项校验哈希，未删除原目录文件。
5. **是否检查了 iOS 适配和键盘交互：** 在浏览器检查英语、法语×五个页面×六种视口，共60项；另检查1440×1000桌面展示。覆盖320×568、375×667、375×812、390×844、393×852、430×932。页面无文字输入表单，本轮无输入键盘流程。语言选择和长文案已检查。本次没有进行iOS模拟器、WKWebView或真机验证；浏览器视口检查不代表这些结论。
6. **如何测试本次修改：**
   - Python内容源和生成脚本语法检查通过；JavaScript `node --check` 通过。
   - 10个页面、231项站内资源/链接引用、页面锚点、语言标签、canonical、hreflang、10个站点地图URL通过静态检查；16个字体文件均为有效WOFF2；无缺失资源、模板占位、德语入口或外部字体请求。
   - 政策/支持内容区5组文字颜色与渐变最深底色的对比度为5.10:1～15.20:1，均超过4.5:1。此结论仅针对本次批准修改的内容区，未将首页原有配色算作已修正。
   - 浏览器走通：英文政策→法文政策→英文政策、法文协议与支持导航、有效日期、mailto目标、重开首页记住法语、待上架入口及状态。未实际发送邮件、购买或提交任何用户数据。
   - 首页向下滚动验证4张原有App插图和品牌图片实际加载成功；本次浏览器控制台无错误或警告。
   - 已执行静态官网生成并同步publish目录。本轮不涉及Vue、iOS工程或原生资源；未执行Vite、Xcode构建及原生资源同步。

已确认的正式信息：Eluva Team；Eluva@gmail.com；https://www.eluvabloom.store/；生效日期2026-10-01；英语/法语。未提供的地址、所在国家、适用司法辖区及下载地址未编造，也未留下待填写栏。

保留项及发布前事项：

- 原稿首页在320px宽度下的装饰光晕最多导致约2px水平溢出，英法均存在；文字和交互控件没有越界。为遵守本次仅允许修正文字对比度、保留原布局与动画的要求，未修改该装饰层。60项检查中这两项记录为已知保留项，其余58项无页面宽度溢出。
- 法语网页沿用用户原有英文App截图，替代文字准确注明为英文界面。未伪造法语App截图；原德语图片保留为未引用素材，不在网页切换中展示。
- 实际上传部署、线上HTTPS/域名跳转/托管平台额外脚本和日志设置未验证。不能把本次文件更新视为线上域名内容已更新。
- 未发送测试邮件，邮箱接收能力未验证。App Store上架后需要填入正式下载链接；当前采用清楚的待上架状态。
- 官网说明依据本轮读取的实现编写，未把设备内保存改写成云端存储、未宣称真实邮件验证或远端客服受理。本次未同步修改App内打包的旧政策、协议和Help Buddy说明；发布App时仍应对齐这些内容与App Store隐私申报。不能仅凭官网内容更新认定整个App已经达到上架条件。

复测及部署：在官网目录执行 `python3 scripts/build_site.py` 重新生成，再将 `publish/` 的**内容**上传到域名HTTPS根目录；不要多套一层publish路径。打开首页、`privacy.html`、`terms.html`、`support.html`及`fr/`对应页面检查。文件ZIP本身即为可上传的静态内容，无需Node依赖。

交付与证据：

- [官网文件](/Users/linqian/Downloads/Eluva/index.html)
- [上传包](/Users/linqian/Downloads/Eluva/Eluva-website.zip)
- [部署说明](/Users/linqian/Downloads/Eluva/README.md)
- [原始网站备份](/Users/linqian/Documents/Eluva/docs/evidence/website-content-2026-10-22/original-website.zip)
- [修改明细](/Users/linqian/Documents/Eluva/docs/evidence/website-content-2026-10-22/changed-files.json)
- [同步哈希核验](/Users/linqian/Documents/Eluva/docs/evidence/website-content-2026-10-22/sync-verification.json)
- [CSS限定差异](/Users/linqian/Documents/Eluva/docs/evidence/website-content-2026-10-22/style-diff.patch)
- [60项尺寸矩阵](/Users/linqian/Documents/Eluva/docs/evidence/website-content-2026-10-22/viewport-matrix.json)
- [静态检查](/Users/linqian/Documents/Eluva/docs/evidence/website-content-2026-10-22/static-audit.json)
- [导航验证](/Users/linqian/Documents/Eluva/docs/evidence/website-content-2026-10-22/navigation-checks.json)
- [英文政策390×844](/Users/linqian/Documents/Eluva/docs/evidence/website-content-2026-10-22/en-privacy-390x844.png)
- [法文政策390×844](/Users/linqian/Documents/Eluva/docs/evidence/website-content-2026-10-22/fr-privacy-390x844.png)
- [桌面政策](/Users/linqian/Documents/Eluva/docs/evidence/website-content-2026-10-22/desktop-privacy.png)

规则参考：Apple [App Review Guidelines](https://developer.apple.com/app-store/review/guidelines/)、[自动续期订阅](https://developer.apple.com/app-store/subscriptions/)、[管理或取消订阅](https://support.apple.com/en-us/118428)、[退款入口](https://reportaproblem.apple.com/)。内容未假设特定发行地区的法律管辖和运营地址。
