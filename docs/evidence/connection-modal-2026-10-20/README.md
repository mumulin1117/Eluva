# 已发送消息提示框

最终范围：输入框保持原样，只修改发送成功/等待回复/再次进入的说明弹窗。成功后自动显示叠层星星卡片，不仅显示底部notice。

- browser-matrix.json及screenshots：实际发送后sent、waiting、主页introduction三状态，英法六尺寸36组。
- browser-flow.json：原输入框不变、失败保留、成功弹窗无toast、关闭及再次打开。
- native-test-summary.json、native-final/、wkwebview-final.log：最终6项原生定向检查。
- resource-verification.json：四份253文件资源一致，用户原始图片字节不变。
- design-map.json和design-reference.png：设计版本/标注/原附件/适配与缺失资源记录。
- first-attempt/、native-attachments/和wkwebview.log：用户纠正范围前的历史迭代证据，不作最终结论。

提示框可视证据为浏览器截图；真机与真实系统键盘未验证，未将offscreen DOM称作真机或可视WKWebView验证。
