---
abbrlink: project-init-on-cloudflare-pages
title: cloudflare page 教程（一）项目初始化
date: 2024-05-24
description: 在之前的文章中，谈到了笔者的博客被攻击，在尝试了各种国内 CDN 解决方案后都无解，最后靠 cloudflare 提供的免费 page 服务完美解决。从这篇文章起，笔者将开始深入探究 page 的使用方法，让更多的人能够用上这种惠民的服务。作为开篇之作，本文重点关注 cloudflare page 的项目初始化和部署相关的内容。
hide: true
categories:
  - cloudflare
  - Serverless
  - CDN
---
在之前的文章中，谈到了笔者的博客被攻击，在尝试了各种国内 CDN 解决方案后都无解，最后靠 cloudflare 提供的免费 pages 服务完美解决。从这篇文章起，笔者将开始深入探究 pages 的使用方法，让更多的人能够用上这种惠民的服务。作为开篇之作，本文重点关注 cloudflare pages 的项目初始化和部署相关的内容。
对于 cloudflare pages 来说，其提供了两方面的内容，即可托管静态页面和可以通过其 Functions 功能来提供 Serverless 服务，所以总体来说  pages 产品实现了 静态 CDN + Serverless 的全栈开发能力。
## pages 可以用来干啥
前面提到了 pages 相当于一个 静态 CDN + Serverless 的组合套件，那么对于大多数人来吸引力最大的就是其静态 CDN 功能，因为对于用户来说，这部分功能是完全免费的，不管你的访问量流量有多大，统统免费。
其次就是其 Functions 功能，对于免费用户来说每天 10万次请求，每分钟一千次峰值请求，对于个人用户甚至绝大多数小公司来说都是够用的。


