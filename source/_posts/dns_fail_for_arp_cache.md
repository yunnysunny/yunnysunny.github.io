---
abbrlink: dns-lookup-failed-due-to-udp-cache
title: DNS 解析失败问题追踪
date:  2022-08-22
description: 一个困扰了一年半的问题，应用程序老是报 DNS 解析失败，一开始怀疑是 DNS 服务器或者操作系统负载高的问题，但是随着问题暴漏的越来越频繁，我逐渐觉得问题不是那么简单。
categories:

- [DNS, UDP]
---

这篇文章主要是回顾之前解决的一个老大难的 DNS 解析失败的问题，当时起码困扰了有一年半载的时间了，但是在某一个时间节点上我们实在是无法忍受了，所以决定亲自攻克这个问题。

我刚才排查的时候，先从 gitlab-runner 入手，因为它上面的错误信息比较明确：

```
ERROR: Verifying runner... failed                   runner=5ce326a7 status=couldn't execute POST against http://gitlab.xxx.net/api/v4/runners/verify: Post http://gitlab.xxx.net/api/v4/runners/verify: dial tcp: lookup gitlab.xxx.net on 127.0.0.11:53: write udp 127.0.0.1:46184->127.0.0.11:53: write: invalid argument
```

针对这个问题我首先咨询了 运维，他给的答复是 CPU 的 load 过高导致的。但是我对于这个答复比较持怀疑态度，当时高峰时期 CPU load 确实是实际核心数的两倍，但是 CPU 当时还有接近 50% 的 idle 存留，通过 top 命令看每个核心的实际占用，都还有 idle 余量，按理还说不至于在运算量如此小的 DNS 上卡死。

后来又有同事反馈 nginx 所在机器上做 dig 域名的操作都会报错， 而且报错是一个毕现的错误，那台机器上根本就没有负载，最重要的是报错的提示还跟 gitlab-runner 那台机器如此相似：

```
# dig @127.0.0.1 -p 8600 my-http.service.dc1.consul
../../../../lib/isc/unix/socket.c:2171: internal_send: 127.0.0.1#8600: Invalid argument
```

于是我们就顺着这个错误提示进行谷歌，然后就找到了这篇文章: https://bugs.launchpad.net/ubuntu/+source/dnsmasq/+bug/1702726 ，虽然是说出现在 dnsmasq 上的文章，但是跟我们的错误原因是相同的，其中里面一个网友的下面描述解开了我们多年的疑惑：

> Testing this, the results are not quite as clear-cut as the example. I
> don't always see the same errors.
> 
> Also, I don't understand why the send() calls in dig, which are sending
> UDP packets over the loopback interface, should return the invalid
> argument. ARP is not needed over loopback, surely?
> 
> Looking at an strace of dnsmasq, what I see is that either the query
> never arrives at dnsmasq, or it gets answered correctly but the answers
> never makes it back to dig: the UDP packets are being dropped in the
> kernel. (In the later case, the send() of the reply gets the same
> invalid argument error that dig is seeing)
> 
> The lesson here is that if the arp-cache overflows, UDP, (even over lo)
> drops packets. There's really not much dnsmasq can do about that. I
> guess the only answer is "don't let your arp-cache overflow".
> 
> (or possibly, work on getting the kernel to behave better under these
> circumstances)
> 
> TL;DR not a dnsmasq bug.

总结一下就是如果操作系统的 arp 缓冲区不够，是没法发送 UDP 数据包的，而 DNS 请求就是基于 UDP 协议的。解决方案就是增加其缓冲区大小，但是这个需要改宿主机的配置，最终把如下命令发给运维来执行：

```shell
sysctl -w net.ipv4.neigh.default.gc_thresh1=1048576
sysctl -w net.ipv4.neigh.default.gc_thresh2=4194304
sysctl -w net.ipv4.neigh.default.gc_thresh3=4194304
```

等命令执行完成后，整个世界终于清净了。
