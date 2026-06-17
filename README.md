# 静态图片放这里

无 R2 方案下，推荐把精选图片放在这个目录，再在网站“开发者权限 -> 管图 -> 添加静态路径”里填写路径。

示例：

- `assets/images/food/canteen-01.jpg`
- `assets/images/dorm/dorm-01.jpg`
- `assets/images/library/library-01.jpg`

建议：

1. 不要上传 1G 原图到网页后台。
2. 先在电脑上压缩成适合网页的 JPG/WebP，单张建议 200KB～500KB 左右。
3. 每张卡片精选 2～4 张。
4. 文件名尽量用英文、数字和短横线，避免空格和中文路径。

把图片提交到 GitHub 仓库后，Cloudflare Pages 重新部署，所有浏览器和手机都能通过这些路径看到图片。
