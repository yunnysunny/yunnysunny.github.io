---
abbrlink: /the-design-of-sso-between-diffrent-domain
title: 跨越万水千山认识你,跨根域的单点登陆设计
date:  2018-05-27
description: 介绍单点登陆的原理和实现
typora-root-url: ..\
categories:
- Engineering Design
---


现在我们越来越喜欢使用第三方账号（QQ、微博）来登陆各种网站，比如说只要你的 QQ 在线，点几下鼠标就可以登陆一个第三方网站，最多让你在第一次登陆的时候补充一下手机号或者邮箱地址，下次就可以直接使用 QQ登陆了。但是，我们这篇文章并不是解释这种登陆模式的，这种登陆模式用户体系其实在 QQ 和 微博获取，如果需要单点登陆的网站的用户数据本来就拿到，就不用费这么都周折了，比如说下面这种。

> 本教程链接 https://blog.whyun.com/posts//the-design-of-sso-between-diffrent-domain/ ，转载请注明出处

想想这种情况，假设你是一个电商网站，叫某宝，后来你的业务发展了，你又做了一个子产品网站，叫某猫，你肯定想用户登陆一次，就能畅游两个网站。也许你会想，某宝和某猫可以做成挂在同一个一级域名下的二级域名，比如说 tao.xxx.com 和 mao.xxx.com，然后登陆的时候 cookie 写入 xxx.com，就能实现 session 共享了。很遗憾的告诉你，某宝和某猫是两个平行的子公司，根本就不会共用一个一级域名。我们姑且将这两个公司的域名记为 tao.com 和 mao.com 。

用户在一个节点登陆完成之后，我们在前端需要将登陆凭证写入 cookie ，这样用户再在这个节点上发起请求的时候，会把 cookie 带入请求头发给这个节点的服务器端，服务器端就能判断用户是否在线了。不过现在用户在节点 A 登陆后，根本就没法将 cookie 写入 B 节点，好像问题陷入了死结。我们再来从头分析一下，问题的症结是 cookie 不能跨一级域名写入，那么我们就让它写入一个节点好了，解决问题的关键就是增加一个中心节点，专门用来记录 cookie，哪个节点需要读取 cookie，就从这个中心节点读取即可了。

![sso登陆时序图](/images/sso.png)

关键的一个步骤，就是第 2 步，jsonp 的原理其实就是生成一个异域的 script 标签，但是这里请求 sso.com 的时候，会在请求上带入 sso.com 本身的 cookie！然后我们再在 JavaScript 代码中将这个 cookie 信息赋值给 js 变量，这样 tao.com 就能通过 js 得到 sso.com 的 cookie 了。

为了简化教程，这里只给出 tao.com 前端代码：

```html
<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8">
    <title>首页</title>
    <link rel='stylesheet' href='/stylesheets/style.css' />
  </head>
  <body>
    <h1>首页</h1>
    <input type="hidden" id="js-data-hidden" js-domain="<%=domain%>">
    <script src="https://upcdn.b0.upaiyun.com/libs/jquery/jquery-2.0.3.min.js"></script>
    <script>
        $(document).ready(function() {
            var $data = $('#js-data-hidden');
            var domain = $data.attr('js-domain');
            var redirect = encodeURIComponent ('http://' + domain);
            var ssoBaseUrl = 'http://sso.com';
            $.getJSON(ssoBaseUrl + '/get-ticket?callback=?').then(function(data) {
                if (data.ticket) {
                    return $.get('/get-user-info?ticket='+data.ticket);
                }
                location.href = ssoBaseUrl + '/login?redirect=' + redirect;
            }).then(function(result) {
                if (result.code != 0) {
                    return alert(result.msg || '逻辑错误');
                }
                location.href = '/user-backend';
            }).fail(function() {
                alert('网络错误');
            });
        });
    </script>
  </body>
</html>
```

**代码 1.1 tao.com 登陆状态获取**

这里我们用 ticket 来表示登陆成功之后写入 sso.com 的 cookie 的变量。上面代码的逻辑还是比较清晰的，首先通过 jsonp 获取 ticket ：如果获取到了就到了就在 tao.com 的后端，通过 ticket 查询出对应的用户 ID 回来，然后将登陆用户数据写入 tao.com 本身的 session中；如果没有获取到 ticket，就跳转到 sso.com 完成登陆，并生产成 ticket，登陆完成后再跳转会 tao.com。

> 本教程关联的完整代码，参见这里 https://gitlab.com/yunnysunny/sso-demo

