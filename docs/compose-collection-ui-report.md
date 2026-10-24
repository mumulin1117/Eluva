### 📢 任务修改执行报告

1. **修改了哪些文件：** `src/components/CollectionEditor.vue`、`src/components/DraftImagePicker.vue`、`src/components/AppModal.vue`、`src/views/PostComposerView.vue`、`src/data/content-messages.js`、新增 `src/compose-collections.css`；新增两个本地原始切图资源 `public/images/p2/collection-cover-camera.png` 与 `collection-save-background.png`；新增隔离验证入口 `tests/fixtures/compose-collection.html`、本报告和证据。生产资源已同步iOS。
2. **每个文件解决了什么问题：**
   - CollectionEditor增加可选publishing视觉标识，仅从发布页传入。创建弹层使用原稿标题、封面相机切图、字段卡片和专属样式。原保存说明仅在本弹层转为辅助阅读文字，避免额外可见文案；校验、保存、取消、草稿和封面处理函数不变。
   - DraftImagePicker只新增可选add插槽，发布合集弹层以原始相机PNG替换通用图片图标。其余调用继续使用原默认外观；相册、相机、导入、替换、移除与唯一Bridge不变。
   - AppModal仅增加compose-collection变体类；复用既有遮罩、焦点约束、滚动、inert、关闭清理机制。PostComposer仅为其CollectionEditor传递publishing，选择列表、发布页面和其他弹层布局不改。
   - 专属CSS落实390×844基准：弹层 `[0,341,390,503]`；封面 `[15,408,360,140]`；字段 `[15,564,360,198]`；Save `[315,356,60,32]`。标题Plus Jakarta Sans 800 18/23，封面文字Poppins 500 12/20，字段占位15px。60×32保存按钮保留原始渐变、复杂光晕和独立文字；字体和图层位置未用整页截图代替。
   - 英文发布合集弹层标题独立为Create Collection，对齐附件；原列表入口Create a Collection及个人中心标题文案保留。法语完整覆盖。
3. **是否影响登录注册流程：** 否。
4. **是否影响本地用户数据：** 没有服务、数据模型、存储、账户或发布规则变更。原有草稿保留、成功自动选中合集、失败保留输入和一次提交规则继续生效；没有清空数据。验证均使用随机命名的隔离数据库与项目测试图片，未发布动态。
5. **是否检查了 iOS 适配和键盘交互：**
   - 英法六尺寸空封面12组、法语有封面6组，18组浏览器布局记录与截图通过；原稿基准几何四项均与标注一致。法语标题自然换行，Save允许随长文案增宽；不缩字体。
   - 320×360短可视区域验证内部滚动、当前输入可编辑、16px输入字体、顶部保存可达，以及点击标题空白处收焦点。此检查没有模拟真实系统键盘；真机、真实系统键盘及本弹层的可视WKWebView截图未执行。
6. **如何测试本次修改：**
   - `node --test tests/content.test.js tests/personal.test.js`：21项通过，覆盖草稿、发布、媒体、合集引用/所有权、失败/幂等和账户隔离。
   - 原生定向4项通过：英法打包页面与Native Bootstrap两项、合集引用/所有权及媒体引用保护两项。这些验证不冒充本弹层的可视WKWebView验收。
   - 浏览器实际导入封面，关闭/重进保留封面名称说明；保存成功回到原列表且自动选中，返回发布页保留正文；保存失败保留输入，切换语言保留，重试只创建一份合集，帖子仍为原10条。
   - Vite生产构建、资源审计、iOS同步、Xcode模拟器测试构建与无签名iPhoneOS构建通过。dist、iOS源Web、模拟器App及设备App各255资源哈希一致。

设计依据：蓝湖「选择合集--创建合集」`0a49147b-bb2d-410d-bb96-3ef9c3368e2b`，版本1，更新于 `2026-10-13T15:22:06.269998Z`。附件780×1688对应390×844的2倍图，目录195×422为半尺寸预览。已核对对应原图、图层与切图；Schema读取回退标注模式。上下游「发布动态--选择合集」仅用于确认来源，没有扩大修改其列表外观。

原始资源：相机Group1404按32×32逻辑尺寸使用原4倍PNG；Group1411原SVG只移除内嵌Save文字路径，其余渐变、遮罩与滤镜保留，预渲染为3倍PNG以避免WKWebView滤镜差异。实际输入字体使用16px避免iOS自动缩放，占位文字保留原15px；空名称时Save继续按原校验禁用，因此与原稿静态启用状态有意不同。

[验证证据目录](/Users/linqian/Documents/Eluva/docs/evidence/compose-collection-2026-10-20)内含设计原图、原始SVG、无文字背景、design-map.json、browser-matrix.json、browser-flow.json、short-viewport.json、原生摘要及全部构建日志。保留Vite原有大分块提示与测试退出时的WebKit进程回收日志，不声称控制台零警告。

![创建合集，英文390×844浏览器](/Users/linqian/Documents/Eluva/docs/evidence/compose-collection-2026-10-20/screenshots/empty-cover-en-390x844.jpg)
