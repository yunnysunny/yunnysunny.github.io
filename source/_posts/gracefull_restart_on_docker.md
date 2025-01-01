---
abbrlink: gracefully-restart-on-docker
title: docker 容器的优雅重启方案
date:  2021-10-12
description: 当我们将编写的程序部署到服务器之后，免不了会面临未知 bug 导致的程序崩溃退出问题，这个时候快速的将程序进行重启，显得尤为重要，特别是那种在后端和用户之间维持会话的服务。这篇文章就是讲一下，如果你的程序部署到 docker 后，如何做到优雅重启。
typora-copy-images-to: ..\images
typora-root-url: ..\
categories:
- [Cloud Native, Docker]
---



当我们将编写的程序部署到服务器之后，免不了会面临未知 bug 导致的程序崩溃退出问题，这个时候快速的将程序进行重启，显得尤为重要，特别是那种在后端和用户之间维持会话的服务。这篇文章就是讲一下，如果你的程序部署到 docker 后，如何做到优雅重启。

## 1. 自带解决方案

docker 本身在启动的时候，会可以加参数做到容器崩溃后自动重启的，在 `docker run` 的时候增加 `--restart always` 即可。但是并不是在所有情况下，docker 的重启策略都会生效，官方还给出了以下几点要求

重启只能是在容器启动成功后才能生效，并且给出了容器启动成功的指标，那就是容器起码正常启动 10s，在这期间没有发生退出。

如果你手动使用 `docker stop` 命令关闭了容器，那么重启策略也会失效。

还有一点是跟 docker swarm 相关的，由于这个组件现在用的比较少，这里略过。

下面是一个例子用来演示在给定的时间后异常退出当前进程。

> 当前例子的代码都可以从[这里](https://gitee.com/yunnysunny/docker-start/tree/main/start_always)找到

```go
package main

import (
	"fmt"
	"os"
	"strconv"
	"time"
)

func main() {
	fmt.Println("begin", time.Now().Format("2006-01-02 15:04:05"))
	seconds := 11
	if len (os.Args) == 2 {
		secondsFromCli, _ := strconv.Atoi( os.Args[1] )
		if secondsFromCli > 0 {
			seconds = secondsFromCli
		}
	}
	time.Sleep(time.Duration(seconds) * time.Second)
	fmt.Println("exit", time.Now().Format("2006-01-02 15:04:05"))
	os.Exit(1)
}
```

**代码 1.1 delay_exit.go**

我们制作一个 [dockerfile]https://gitee.com/yunnysunny/docker-start/blob/main/start_always/start_always.Dockerfile) ，指定 entrypoint 脚本内容如下

```shell
#!/bin/bash

date
/opt/delay-exit "$@"
```

**代码 1.2 start.sh**

将 **代码 1.1** 构建，生成可执行文件，放置于 /opt/delay-exit 。我们在 docker run 的时候可以指定任意一个进程退出的等待时间，如果不指定则 11s 后退出。

```shell
#!/bin/bash

source ./common.sh
docker run --restart always --name always-test $TAG_LATEST "$@"
```

**代码 1.3 test_always.sh**

**代码 1.3** 是我们准备好的测试文件，其中 `$TAG_LATEST` 是制作好的，含有 delay_exit.go 的编译生成可执行程序的镜像。

首先看正常 11s 退出的情况，`./test_always.sh` 即可启动容器，然后通过 `docker logs always-test` 来看启动容器的运行日志：

```
Tue Oct 12 16:20:24 CST 2021
begin 2021-10-12 16:20:24
exit 2021-10-12 16:20:35
Tue Oct 12 16:20:35 CST 2021
begin 2021-10-12 16:20:35
exit 2021-10-12 16:20:46
Tue Oct 12 16:20:47 CST 2021
begin 2021-10-12 16:20:47
exit 2021-10-12 16:20:58
Tue Oct 12 16:20:59 CST 2021
begin 2021-10-12 16:20:59
exit 2021-10-12 16:21:10
Tue Oct 12 16:21:10 CST 2021
begin 2021-10-12 16:21:10
exit 2021-10-12 16:21:21
Tue Oct 12 16:21:22 CST 2021
begin 2021-10-12 16:21:22
exit 2021-10-12 16:21:33
Tue Oct 12 16:21:33 CST 2021
begin 2021-10-12 16:21:33
exit 2021-10-12 16:21:44
Tue Oct 12 16:21:45 CST 2021
begin 2021-10-12 16:21:45
exit 2021-10-12 16:21:56
Tue Oct 12 16:21:56 CST 2021
begin 2021-10-12 16:21:56
exit 2021-10-12 16:22:07
Tue Oct 12 16:22:08 CST 2021
```

exit 语句下面是 /start.sh 脚本中 `date` 命令的输出内容，可以看到容器退出到重启在 1s 之内完成，说明还是挺高效的。

使用 `docker stop always-test && docker rm always-test`，删除当前容器，重新启动，这次增加一个启动参数 `./test_always.sh 2`，即更改默认退出等待时间为 2s 。再次查看容器日志：

```
Tue Oct 12 16:16:14 CST 2021
begin 2021-10-12 16:16:14
exit 2021-10-12 16:16:16
Tue Oct 12 16:16:16 CST 2021
begin 2021-10-12 16:16:16
exit 2021-10-12 16:16:18
Tue Oct 12 16:16:19 CST 2021
begin 2021-10-12 16:16:19
exit 2021-10-12 16:16:21
Tue Oct 12 16:16:21 CST 2021
begin 2021-10-12 16:16:21
exit 2021-10-12 16:16:23 #从这一次开始重启等待时间被拉长
Tue Oct 12 16:16:25 CST 2021
begin 2021-10-12 16:16:25
exit 2021-10-12 16:16:27
Tue Oct 12 16:16:29 CST 2021
begin 2021-10-12 16:16:29
exit 2021-10-12 16:16:31
Tue Oct 12 16:16:34 CST 2021
begin 2021-10-12 16:16:34
exit 2021-10-12 16:16:36
Tue Oct 12 16:16:43 CST 2021
```

会发现启动时间不足 10s，docker 不会立即重启退出的容器，随着重启次数增多，会逐渐拉长启动时间。

## 2. 宿主机守护进程

docker 容器启动时，会在启动 docker 容器的宿主机上产生一个进程，如果 docker 容器异常退出，这个进程也会退出，所以我们也可以在宿主机上使用 [systemd](https://freedesktop.org/wiki/Software/systemd/) [upstart](http://upstart.ubuntu.com/) [supervisor](http://supervisord.org/) 等工具通过监听进程状态来达到重启目的，但是从使用便捷性上来说不如直接使用 `docker run` 的 `--restart always` 参数。

## 3. 容器内部守护进程

还有最后一个途径，就是直接将进程重启监听放置到 docker 容器内部，这个做法官方是不推荐的，因为这样子 docker 守护进程本身无法感知到应用的运行状态。但是考虑到这种情况，为了保障服务的高可用性，我们一般会配合使用日志收集、异常启动报警、性能指标采集、服务发现等组件。如果你使用 [Kubernetes](https://kubernetes.io/) 这种容器编排系统的时候，可以把上述组件每个组成单独的容器，然后和应用容器共享同一个 pod 的模式来进行统一管理。但是目前很多中小型公司，并没有在使用 Kubernetes；再考虑一种更复杂的情况，有一些公司的部署结构是混合的，一部分位于 Kubernetes 集群中，另一部分运行在老旧的、不支持编排的容器系统中，但是出于通用性和可维护性的考量，又不想引入太多异构的部署模型。这些上述描述情况，看上去最合适的解决方案就是将这些组件也内置到容器内部，那么使用容器内部的进程重启监控程序，就显得更加适合。这里我们选择使用 supervisor，因为这个程序是在 docker 中安装方便，只需要有 python 即可，如果使用 systemd 的话，需要 docker 开启特殊权限，并且有一些公司的运维出于安全考虑还会禁用掉特权模式。

首先是构建 supervisor 的基础镜像

> 本小节中的代码都能从[这里]()找到源代码

```dockerfile
FROM centos:7 as base

# 更改 yum 源
RUN mv /etc/yum.repos.d/CentOS-Base.repo /etc/yum.repos.d/CentOS-Base.repo.backup
COPY docker/etc/yum.repos.d /etc/yum.repos.d
RUN sed -i -e '/plugins=1/d' -e '/plugins=0/d' /etc/yum.conf
RUN yum clean all

RUN yum install epel-release -y
RUN yum install wget curl make tcpdump net-tools bind-utils telnet python3 python3-pip logrotate ca-certificates which crontabs -y

# 安装 supervisor
COPY docker/root/.pip /root/.pip
RUN pip3 install supervisor
RUN mkdir -p /data/supervisor/log
COPY docker/etc/supervisord.conf /etc
COPY docker/etc/supervisor.d /etc/supervisor.d
# 配置 logrotate
COPY docker/etc/logrotate.d /etc/logrotate.d

# 使用东八区时区
RUN ln -sf /usr/share/zoneinfo/Asia/Shanghai /etc/localtime
# 必须添加这两个环境变量，否则 supervisor 无法在 python3 下启动
ENV LC_ALL "en_US.UTF-8"
ENV LANG "en_US.UTF-8"

# 添加启动脚本
COPY docker/app_init.sh /
COPY docker/app.init.d  /app.init.d
COPY docker/entrypoint.sh /
ENTRYPOINT [ "/entrypoint.sh" ]
```

**代码 3.1**

supervisor 是一个 python 2.7 编写的工具，由于 python 2.7 已经处在停止维护阶段，这里选择安装了 python 3。但是发现如果不设置 `LC_ALL` `LANG` 这两个环境变量的话，会报错：

```
Error: 'ascii' codec can't decode byte
```

所以在 **代码 3.1** 中专门设置了这两个环境变量。

接着看入口文件 entrypoint.sh:

```bash
#!/bin/bash

/app_init.sh

"$@"
# 前台 启动 supervisor 的守护进程 supervisord
exec supervisord -c /etc/supervisord.conf -n
```

**代码 3.2 entrypoint.sh**

首先看最后一行 exec 的用法。我们使用 supervisor 作为守护进程，也就是说对于使用这个镜像的容器来说，它所运行的应用是 supervisor，那么在 supervisor 异常退出之后，当前容器是不可用的，也就是说我们应该让 docker 感知到当前 supervisor 是否可用。docker 感知容器是否正常的方式，就是容器内部 pid 为 1 的进程是否退出，这个 pid 为 1 的进程，就是通过 ENTRYPOINT （如果没有 ENTRYPOINT 的话，是CMD ）指令指定的程序运行后产生的。显然这里我们要做的是要将 supervisord 的运行进程 ID 置为 1。如果我们在 entrypoint.sh 脚本中运行 supervisord 时没有使用 exec 的话，进程 ID 为 1 的进程，将是 entrypoint.sh ，而使用 exec 后，entrypoint.sh 进程将会被 supervisord 替代，也就是说 supervisord 就会成为 1 号进程。最终也就实现了 supervisord 进程退出能被 docker 感知到的目的。

我们将所有通过 supervisor 收录的应用的配置文件统一放置在目录 /etc/supervisor.d 中，在我们的镜像中安装了 crontabs ，并通过 supervisor 对其守护，下面是它的配置文件：

```ini
# crond 为项目名，可以根据实际情况制定
[program:crond]
#脚本目录
directory=/usr/sbin
#脚本执行命令
command=/usr/sbin/crond -n

#supervisor启动的时候是否随着同时启动，默认true
autostart=true
#当程序exit的时候，这个program不会自动重启,默认unexpected，设置子进程挂掉后自动重启的情况，有三个选项，false,unexpected和true。如果为false的时候，无论什么情况下，都不会被重新启动，如果为unexpected，只有当进程的退出码不在下面的exitcodes里面定义的
autorestart=true
#这个选项是子进程启动多少秒之后，此时状态如果是running，则我们认为启动成功了。默认值为1
startsecs=1

#设置日志输出 
stdout_logfile=/data/supervisor/log/crond.log 
stderr_logfile=/data/supervisor/log/crond.log 
#把stderr重定向到stdout，默认 false
# redirect_stderr = false
#stdout日志文件大小，由于我们配置了 logrotate 进行日志拆分，所以这里设置为 0
stdout_logfile_maxbytes = 0
#stdout日志文件备份数
stdout_logfile_backups = 0
```

**代码 3.3 crontab.ini**

首先要留意 command 属性，我们在启动 crond 程序的时候添加了 `-n` 参数，这代表 crond 要在前台运行，也就是说如果你手动在命令行中运行 `crond -n` 时，当前命令行不退出，必须手动执行 CTRL + C 才能退出当前程序。supervisor 是应用级别的守护进程，跟 systemd 这种系统级别的守护进程还是有区别的，后者启动程序后在后台运行也能识别出来运行状态，但是 supervisor 如果启动程序在后台运行，它是识别不出来运行的程序是哪个的，这也导致你的应用必须得在前台运行。具体到 **代码 3.3**，我们给 crond 的启动加 `-n` 参数，就是这个原因。再举一个例子，如果你用 supervisor 启动 nginx 的话，也需要指定参数 `-g "daemon off;"` 让其在前台启动，否则你就会发现 supervisor 会报 nginx 启动失败。

接着就是日志配置，supervisor 默认支持日志拆分功能，这里我们将其禁用掉（`stdout_logfile_maxbytes` 和 `stdout_logfile_backups` 都设置为零），因为我们在系统中添加了 logrotate，我们将日志切分工作交给了 logrotate 来处理。

最终如果你开发了一个新的应用做部署的时候，可以基于这个 supervisor 镜像来制作一个子镜像，然后将配置文件放置到 /etc/supervisor.d 目录下即可。如果感觉编译麻烦也可以直接用笔者制作好的镜像：registry.cn-hangzhou.aliyuncs.com/whyun/base:supervisor-latest。



