# 他人主页、安全与合集证据

- source/: 精确ID原图、接口图层文本、版本切图与来源SVG。标注文本只移除接口中的损坏代理码/装饰emoji；数值和文字参数保留。
- page-state-design-map.json: 页面状态/ID/版本/时间/本地资源映射、已确认补齐与未完成视觉差异。
- browser-matrix.json: 七状态 × 英法 × 六视口，84组最终浏览器记录；browser-前缀截图对应这些记录。早期profile-前缀图片属于迭代，不作为最终矩阵。
- browser-flow.json / report-unknown-result.json: 草稿换语言、失败重试、读取重试、互关会话和持久化后回执丢失的去重验证。
- native-test-summary.json / native-final/: 最终原生摘要和附件；wkwebview-matrix.json为最终84组布局。native-attachments为较早一次已通过构建的历史附件，最终以native-final为准。
- wkwebview-delivery.log: 曾在尺寸切换时提前测量而失败的历史记录；最终只认wkwebview-accepted.log及最终结果包。
- resource-verification.json: 生产dist、iOS源Web、模拟器App和无签名设备App逐文件哈希核对。

真机、真实系统键盘和手指触摸未验证。玻璃卡完整材质参数和空态插画错配仍需设计资源补齐。
