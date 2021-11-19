---
abbrlink: the-defect-of-node
title: Node 的缺陷
date:  2021-11-17
description: 提起 Node.js ，大家可能认为对其的优劣已经分辨的很清楚：由于其默认单线程，所以不适合做计算密集型操作；由于其异步 IO 特性，所以对于 IO 处理比较友好。但这其实是一种误解，当 IO 并发到一定的量级，一样会损耗 CPU 资源。在 Node.js 引以为豪的 IO 处理方面，依然有其做的不完善的地方，本篇文章就给大家一一解密。
typora-copy-images-to: ..\images
typora-root-url: ..\
---
提起 Node.js ，大家可能认为对其的优劣已经分辨的很清楚：由于其默认单线程，所以不适合做计算密集型操作；由于其异步 IO 特性，所以对于 IO 处理比较友好。但这其实是一种误解，当 IO 并发到一定的量级，一样会损耗 CPU 资源。在 Node.js 引以为豪的 IO 处理方面，依然有其做的不完善的地方，本篇文章就给大家一一解密。 

## 1. 问题

## 1.1 负载均衡问题

Node.js 在起步之初，语言层面只能利用单进程，后来官方引入了 [Cluster](https://nodejs.org/dist/latest-v16.x/docs/api/cluster.html) 模块来解决这个问题。但是在操作系统中一个端口号默认只能被一个句柄监听，也就是说不经过特殊设置，服务监听端口只能调用 listen 函数一次。但是我们现在使用了 Cluster 之后，要求每个工作进程都可以接受客户端的请求，该如何实现呢？

（在 Linux 下）Node 底层会采取两种策略，一种是在主进程监听端口完成之后，顺便完成 socket 的 accept 操作，然后将接收的 socket 句柄通过进程间通信平均分发到工作进程中去；一种是主进程监听端口完成之后，直接把这个监听完成的句柄发送给工作进程，每个工作进程都自己做 accept 操作。前者的负载均衡由用户端代码控制，后者的负载均衡由操作系统控制，但是后者的负载均衡的分配会出现不均匀的情况，并且会因为惊群效应，导致性能低下，所以 Node 默认使用的是第一种策略。

> 这里不考虑  Windows 下的场景。

对于第一种策略，主进程会先将接收到的 socket 放入本地数组中，然后再依次从数组头部中截取元素，发送到某一个工作进程中。初步看上去这个流程没有问题，特别是你的请求 QPS 不是很大的时候。但是一旦并发请求量过大，就会出现 socket 句柄在前面提到的本地数组中堆积的现象，数组长度一大对于数组的截取操作就变成了一个慢操作，引起主进程 CPU 升高，主进程 CPU 升高会进一步削弱其给工作进程分发 socket 句柄的能力，从而导致本地数组进一步增大，如此恶行循环，最终会导致主进程的老生代内存被撑爆，触发 OOM，主进程被迫退出。

> 默认策略性能低下问题，笔者已经给官方提交了 issue [#37343](https://github.com/nodejs/node/issues/37343) 。

> 如果你的主进程使用 PM2，并且因为 OOM 而退出，会在 ~/.pm2/pm2.log 找到类似日志：
>
> ```
> <--- Last few GCs --->
> 
> [65994:0x3c57eb0] 20952120 ms: Scavenge 874.5 (894.1) -> 858.5 (894.1) MB, 0.9 / 0.0 ms  (average mu = 0.995, current mu = 0.993) allocation failure 
> [65994:0x3c57eb0] 20952493 ms: Scavenge 874.5 (894.1) -> 858.5 (894.1) MB, 1.4 / 0.0 ms  (average mu = 0.995, current mu = 0.993) allocation failure 
> [65994:0x3c57eb0] 20952859 ms: Scavenge 874.5 (894.1) -> 858.5 (894.1) MB, 0.9 / 0.0 ms  (average mu = 0.995, current mu = 0.993) allocation failure 
> 
> 
> <--- JS stacktrace --->
> 
> ==== JS stack trace =========================================
> 
>     0: ExitFrame [pc: 0x1381859]
> Security context: 0x0a5f87230cc9 <JSObject>
>     1: /* anonymous */ [0x354d92c72169] [internal/cluster/round_robin_handle.js:~32] [pc=0x1be20be0065](this=0x3cd6cfa14001 <TCP map = 0x2e9326ca19f1>,-24,0x10a4561c04a9 <undefined>)
>     2: InternalFrame [pc: 0x12ff49d]
>     3: EntryFrame [pc: 0x12ff278]
> 
> ==== Details ================================================
> 
> [0]: ExitFrame [pc: 0x1381859]
> [1]: /* anonymou...
> 
> FATAL ERROR: invalid array length Allocation failed - JavaScript heap out of memory
> 
> Failed to open Node.js report file: report.20210123.192612.65994.0.001.json (errno: 24)
>  1: 0x9dbd20 node::Abort() [PM2 v4.1.2: God Daemon (/root/.pm2)]
>  2: 0x9dced6 node::OnFatalError(char const*, char const*) [PM2 v4.1.2: God Daemon (/root/.pm2)]
>  3: 0xb3d96e v8::Utils::ReportOOMFailure(v8::internal::Isolate*, char const*, bool) [PM2 v4.1.2: God Daemon (/root/.pm2)]
>  4: 0xb3dce9 v8::internal::V8::FatalProcessOutOfMemory(v8::internal::Isolate*, char const*, bool) [PM2 v4.1.2: God Daemon (/root/.pm2)]
>  5: 0xcea835  [PM2 v4.1.2: God Daemon (/root/.pm2)]
>  6: 0xcc1340 v8::internal::Factory::NewUninitializedFixedArray(int, v8::internal::AllocationType) [PM2 v4.1.2: God Daemon (/root/.pm2)]
>  7: 0xe2c261  [PM2 v4.1.2: God Daemon (/root/.pm2)]
>  8: 0xe2c510  [PM2 v4.1.2: God Daemon (/root/.pm2)]
>  9: 0xfd41db v8::internal::Runtime_GrowArrayElements(int, unsigned long*, v8::internal::Isolate*) [PM2 v4.1.2: God Daemon (/root/.pm2)]
> 10: 0x1381859  [PM2 v4.1.2: God Daemon (/root/.pm2)]
> ```
>
> internal/cluster/round_robin_handle.js 正是 Node 中处理主进程给工作进程分发 socket 句柄的逻辑的代码。

解决当前问题的思路，无怪乎有三种：提高当前策略的效率，换一个更高效稳定的策略，降低客户端连接建立频率。对于第一种解决方案，在 pull request [#40615](https://github.com/nodejs/node/pull/40615) 中得到改善，不过 Node 官方成员不承认性能问题的存在；对于第二种方案，可以使用 Linux 内核 3.9+ 中新出来的 SO_REUSEPORT 特性来解决，需要同时改造 libuv 和 Node 源码，参见 pull request [#3198](https://github.com/libuv/libuv/pull/3198)，不过目前依然没有得到官方的合并通过。

> 两个 pull request 都是同一个作者 @**[theanarkh](https://github.com/theanarkh)** 所为。

那么我们能实操的就只有方案三了，有高并发的服务一般都是大量用户同时访问导致的，对于这种从用户端来的流量，我们按照管理都会在前面架设 nginx，来做 https 证书解析和反向代理。我们就可以在这个 nginx 上做文章。

比如说我们有如下 nginx 配置：

```nginx
upstream service1 {
    server 192.168.1.3:8000;
    server 192.168.1.5:8000;
}

server {
    listen       8080;
	location =/ {
        add_header Content-Type text/html;
		add_header Cache-Control no-cache,max-age=0;
		return 200 "This is home";
    }
    location / {
        proxy_pass  http://service1;
        proxy_redirect off;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header Host $http_host;
        proxy_connect_timeout   120;
        proxy_send_timeout      120;
        proxy_read_timeout      120;
    }    
}
```

**代码 1.1.1**

上述代码看上去没有什么问题，一般网上的资料在配置反向代理的时候，也都跟上述代码差不多。但是如果使用上述配置那么 nginx 和 node 服务之间使用的就是 HTTP 1.0 版本的协议，也就是说对于每次请求来说底层都会创建一个 socket 句柄。随着并发量的增多，积压在主进程中的待发送句柄就会增多，正好暴露出来了我们之前提到的主进程默认负载策略效率低下的问题。

解决方案也挺简单，就是改用 HTTP 1.1

```nginx
upstream service1 {
    server 192.168.1.3:8000 max_conns=128;
    server 192.168.1.5:8000 max_conns=128;
	
    keepalive_timeout 1800s;
    keepalive_requests 10000000;
    least_conn;
    keepalive 256;
}

server {
    listen       8080;
	location =/ {
        add_header Content-Type text/html;
		add_header Cache-Control no-cache,max-age=0;
		return 200 "This is home";
    }
    location / {
        proxy_pass  http://service1;
        proxy_redirect off;
        proxy_http_version              1.1;
        proxy_set_header                Connection "";
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header Host $http_host;
        
        proxy_connect_timeout   120;
        proxy_send_timeout      120;
        proxy_read_timeout      120;
    }    
}
```

**代码 1.1.2**

在 location 代码块中需要加入 `proxy_http_version 1.1;` `proxy_set_header Connection "";` 这两行，同时留意到我们在 upstream 代码块中加入了 `max_conns` `keepalive_timeout` `keepalive_requests` `least_conn` `keepalive` 这几个新的指令（或者属性）。首先是 `keepalive` 这个指令，它的使用经常会让大家产生误解，以为这个是 nginx 和 upstream 服务的最大连接数，其实不然。`keepalive` 限制的是每个 nginx 工作进程和 upstream 服务列表中的服务的最大空闲连接数，超过这个连接数的连接，会被 nginx 工作进程回收掉。而 `server` 指令中的 `max_conns` 属性才是当前 `server` 指令所指向的服务器和各个 nginx 工作进程之间的最大连接数。考虑这么一种情况，如果当前请求的并发量相当之大，QPS 为 1000/s，那么在短时间内发送到 nginx 的句柄就有 1000 个之多，简单考虑，我们的 nginx 只启动了一个工作进程，如果不设置 `max_conns` 的话，那么 upstream 中的两个 server 每个都要承载 500 的并发，假设当前没有空闲句柄的话，每个 server 端都会和 nginx 建立 500 个 socket 句柄。而如果设置了 `max_conns` 时，nginx 工作进程就会自己维护一个句柄池，借用之前创建的句柄来发送新的请求。

> nginx 和 node 比较类似的地方是，他也分工作进程和主进程。

`keepalive_timeout` 和 `keepalive_requests` 这两个指令，大家在查阅资料的时候，一定要擦亮眼睛，因为两个指令可以同时存在 upstream 代码块中和 http 代码块中，大家一定要看 [upstream](http://nginx.org/en/docs/http/ngx_http_upstream_module.html) 模块的文档。这两个指令用来规定空闲句柄的回收策略，如果一个空闲句柄超过了 `keepalive_timeout` 时间了，或者一个句柄发送过 `keepalive_requests` 次请求了，那么就会被 nginx 强制回收。

最后讲到的是 `least_conn` 指令，它告诉 nginx 工作进程，在进行负载均衡的时候，挑选那个何其建立句柄数最少的服务器进行发送。由于我们要控制 upstream 服务的句柄数，所以这里选择了使用 `least_conn` 这个策略，nginx 的默认策略是轮询策略。

> 需要指出的是，如果你的 `server` 指令配置的是域名，并且这个域名会被随机解析出不同 IP 的话，使用免费版本的 nginx 不能很好的解决这个问题。虽然 upstream 代码块中可以设置 `resolve`  指令来动态解析域名，不过你需要付费购买收费版本才能使用这个指令。

改完 nginx 端配置后，同样也需要修改 Node 端的代码：

```javascript
const TIMEOUT_SERVER = 1000 * 60 * 30;

const server = http.createServer((req, res) => {
    res.writeHead(200);
    res.end('hello world\n');
}).listen(8000);
server.timeout = TIMEOUT_SERVER;
server.keepAliveTimeout = TIMEOUT_SERVER;
```

**代码 1.1.3**

我们只关注最后两句即可，Node 端同样需要设置空闲时间，否则服务端默认 5s 内没有从当前 socket 句柄中接收到请求，就自己强制断开当前句柄。

做完上述改动后，我们单条连接的生命周期被拉长，不会出现单位时间内创建过多 socket 句柄的现象。但是我们依然要考虑到，当前的 socket 句柄依然是有生命周期的，特别是在服务器端（这里指 Node 端）检测到空闲超时后，一样会断开连接，但是这时候恰巧有客户端（这里指 Nginx 端）的请求正在发送的路上，服务器端接收到这个迟来的请求后，会直接拒绝。这是一个边界的小概率问题，但是不代表不会发生。出现这种情况，如果是 GET 请求还好说，让用户端程序直接重试即；如果是 POST 请求，就要和用户端程序协商好，如何做到幂等性。

### 1.2 Socket 写入问题



