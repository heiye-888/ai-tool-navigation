# AI 工具导航

一个收集各种 AI 工具的导航网站，支持搜索、分类筛选、收藏、深浅色模式，以及本地账号注册登录。

## 在线访问

https://heiye-888.github.io/ai-tool-navigation/

## 功能

- 收录 112 款国内外主流 AI 工具
- 按对话、图像、视频、音频、编程、办公、搜索、设计、Agent、学习分类浏览
- 关键词搜索与标签筛选
- 收藏工具、查看详情
- 本地账号注册、登录、退出
- 深浅色模式

## 使用

直接用浏览器打开 `index.html` 即可，也可以部署到 GitHub Pages、Netlify、Vercel 等静态托管平台。

当前账号保存在浏览器本地存储中，适合个人试用；如果需要多设备共享账号，需要额外增加后端服务。

## 本地后台版

需要查看注册用户时，可以启动 Node 后台服务：

```bash
node server.js
```

然后访问：

- 网站：http://localhost:3000
- 后台管理：http://localhost:3000/admin.html

后台默认管理员账号为 `admin`，默认密码为 `admin888888`。正式使用前请通过环境变量修改：

```bash
ADMIN_USERNAME=你的管理员账号 ADMIN_PASSWORD=你的管理员密码 node server.js
```

后台版账号保存在服务器的 `server-data/users.json` 中，GitHub Pages 不支持运行 Node 服务，上线时需要部署到支持 Node 的平台。
