---
abbrlink: routers-on-cloudflare-pages
title: cloudflare page 教程（一）路由配置
date: 2024-06-27
description: 在之前的文章中，谈到了如何初始化 cloudflare pages。这篇文章将更输入的展开，讲解如何使用 pages 中的路由功能，和如何在实际中进行应用。
hide: false
categories:
  - cloudflare
  - Serverless
  - CDN
---
在之前的文章中，谈到了如何初始化 cloudflare Pages。这篇文章将更输入的展开，讲解如何使用 pages 中的路由功能，和如何在实际中进行应用。

## 1. 跳转路由
Pages 提供了静态路由跳转的功能，方便你将一些旧有的页面路由迁移到新版本上去。注意这种路由是静态配置，不经过 Workers 代码动态处理，在 cloudflare 上是完全免费的，所以对于静态文件的跳转规则优先使用跳转路由。其实现方式也很简单，在项目构建目录中放置一个 `_redirects` 文件即可。
### 1.1 跨域名跳转
笔者之前是使用 github Pages 功能的，默认所有的开启 github Pages 的项目都挂载到一个域名上，但是 cloudflare Pages 支持每个项目单独设置域名。我将 yunnysunny/yunnysunny.github.io yunnysunny/nodebook 两个项目都迁移到了 cloudflare Pages，迁移后前者域名为 blog.whyun.com，后者域名为 node.whyun.com ；迁移前我将 yunnysunny.github.io 前面配置了 CDN 进行反代，CDN 的域名同样为 blog.whyun.com，所以迁移前两者对应的 github Pages 的访问地址分别为 https://blog.whyun.com 和 https://blog.whyun.com/nodebook 。迁移后，这里我们需要一个跳转规则保证在访问域名 blog.whyun.com 的 nodebook 路径时能够正常跳转到域名 node.whyun.com，为了实现上述目的我们在 `_redirects` 中写入如下一行配置即可：
```
/nodebook/* https://node.whyun.com/:splat 301
```
**代码 1.1.1**

>上述代码中我们使用了 301 跳转，是由于 /nodebook 路径在 blog.whyun.com 已经不再使用了，我们使用 301 是为了让新增的域名 node.whyun.com SEO 更友好。 
>我们将 `_redirects` 放置在项目根目录了，但是如果想让其生效你需要在构建的时候，将其拷贝到构建输出目录中，除非你的构建输出目录就是你的项目根目录。

### 1.2 项目中跳转
假定你有一个静态页项目，里面的目录结构如下：
```
.
├── browser.js
├── changelog.md
├── package.json
├── readme.md
└── test
    └── index.html
```
我们程序的源代码在 browser.js 中编写，在 test 文件见下有一个测试网页 index.html ，为了方便双击 index.html 就能测试，我们在其内部通过`<script src="../browser.js" type="text/javascript"></script>` 来引入 browser.js 。现在我们想将这个项目部署到 cloudflare Pages 上去，想达到部署完之后输入域名就能打开这个 index.html 的目的，那么肯定需要将 test 文件夹设置为 Pages 的构建路径。但是这个 test 文件夹中没有 browser.js ，这个好办构建命令中将其拷贝到 test 文件夹即可。即使拷贝完成了，也有一个问题需要解决，index.html 中是通过 ../browser.js 引入的 js 文件，可现在它跟 index.html 在同一个目录了，这么写肯定是找不到文件的。解决这个问题的好方法还是使用 `_redirects` 文件做个声明：
```
../browser.js /browser.js 200
```
**代码 1.2.1**

配置了上述代码之后，../browser.js 请求发送到 Pages 服务之后，其会自动去读取 /browser.js 路径映射的资源文件，这样就能完美的解决我们的问题。

> 我们之所以没有使用 1.1 小节的解决方案，是由于它会触发浏览器跳转，效率上不如当前直接代理请求。
> 上述配置的示例项目代码参见 [yunnysunny/whyun-player](https://github.com/yunnysunny/whyun-player) 。

## 2. 动态路由
前面讲的是静态文件的路由，Pages 作为一个全栈解决方案，可以通过编写 Functions 代码来实现后端请求，我们学习 Node 后端框架（比如 Express、Koa ）等，首先要学的就是路由怎么写，可见路由在任何框架中都是关键技术。

Functions 作为后起之秀，借鉴了一些其他框架的先进思想，它的路由设计和常见的 Next.js 有些类似，通过文件所在的相对路径来映射到 HTTP 的请求 Path 上。

我们现在假定，你想实现 `/v1/user/add` `/v1/user/remove` `/v1/user/modify` 三个路由，那么你可以在 functions 文件夹中放置如下文件：
```
.
└── functions
    └── v1
        └── user
            ├── add.js
            ├── modify.js
            └── remove.js
```
**目录结构 2.1**

如果你嫌上述目录太分散了，不适合编写通用逻辑，那么你可以直接在 `v1` 文件夹下放置 `[user].js` 文件，做如下目录结构：
```
.
└── functions
    └── v1
        └── [user].js
```
**目录结构 2.2**

对于 **目录结构 2.1** 我们在每个 js 文件中，直接编写业务逻辑即可
```javascript
export async function onRequest(context) {
  // 处理逻辑
  return Response.json({code:0, data: {userId: 'xxxx'}});
}
```
**代码 2.1 add.js**

但是对于目录结构 2.2 来说，你需要手动判断当前请求路径，在逻辑代码中再做一层路由：
```javascript
const funMap = {
	'/v1/user/add': (body) => {},
	'/v1/user/remove': (body) => {},
	'/v1/user/modify': (body) => {},
};
export async function onRequest(context) {
  const request = context.request
  const url = new URL(request.url);
  const path = url.pathname;
  const logicalFun = funMap[path];
  // 处理逻辑
  const data = logicalFun(request.body);//业务逻辑数据
  return Response.json({code:0, data});
}
```
**代码 2.2 [user].js**

你也可以将 `[user].js` 改名为 `[[user]].js`，前者只能涵盖 `/v1/user/xxx` 这种路由，但是如果你有一个 `/v1/user/internal/xxx` 的路由，就必须得用 `[[user]].js`，它能够涵盖所有以 `/v1/user/` 开头的路由。假设你想写一个反向代理服务，使用 `[[]]` 这种格式是比较方便的。下面是一段代理请求到 dockerhub 的代码：
```javascript
export async function onRequest(context) {
  const request = context.request
  const url = new URL(request.url);
  const path = url.pathname;
  const originalHost = request.headers.get("host");
  const registryHost = "registry-1.docker.io";
  const headers = new Headers(request.headers);
  headers.set("host", registryHost);
  const registryUrl = `https://${registryHost}${path}`;
  const registryRequest = new Request(registryUrl, {
    method: request.method,
    headers: headers,
    body: request.body,
    // redirect: "manual",
    redirect: "follow",
  });
  const registryResponse = await fetch(registryRequest);
  console.log(registryResponse.status);
  const responseHeaders = new Headers(registryResponse.headers);
  responseHeaders.set("access-control-allow-origin", originalHost);
  responseHeaders.set("access-control-allow-headers", "Authorization");
  return new Response(registryResponse.body, {
    status: registryResponse.status,
    statusText: registryResponse.statusText,
    headers: responseHeaders,
  });
}
```
**代码 2.3 `[[api]].js`**

上述文件 `[[api]].js` 放置到 `functions/v2` 目录下，然后将你的项目部署到 Pages 上，即可快速实现一个 dockerhub 镜像站的功能。

> 上述完整项目代码参见 [whyun-pages/docker-registry (github.com)](https://github.com/whyun-pages/docker-registry) 。