---
abbrlink: dockerfile-tutorials
title: dockerfile 使用教程
date:  2021-10-09
description: dockerfile 的使用教程，讲解 dockerfile 的 FROM COPY RUN ENTRYPOINT CMD 等指令的使用。
typora-copy-images-to: ..\images
typora-root-url: ..\
---

## 0 安装

### 0.1 Linux

```shell
curl -sSL https://get.daocloud.io/docker | sh
```

### 0.2 Windows

安装 [docker desktop](https://www.docker.com/products/docker-desktop)。其基于 WSL2，需要安装 [WSL2](https://docs.microsoft.com/en-us/windows/wsl/install-win10#manual-installation-steps) ，否则无法启动。具体教程可以参见之前的博文 [wsl 和 docker desktop 的安装教程](https://blog.whyun.com/posts/wsl-and-docker-desktop-install/)。

## 1 dockerfile

### 1.1 简单示例

一个简单 dockerfile 的示例：

```dockerfile
FROM centos:7
COPY CentOS-Base.repo /etc/yum.repos.d/CentOS-Base.repo
```

**代码 1.1.1 Dockerfile**

使用 `docker build . -t mycentos`

```shell
# docker build . -t mycentos
Sending build context to Docker daemon   5.12kB
Step 1/2 : FROM centos:7
 ---> 8652b9f0cb4c
Step 2/2 : COPY CentOS-Base.repo /etc/yum.repos.d/CentOS-Base.repo
 ---> f3e54049025a
Successfully built f3e54049025a
Successfully tagged mycentos:latest
```

**输出 1.1.1**

注意命令中有一个 `.` 代表从命令行运行目录中寻找要构建的文件，**代码 1.1.1** 的第二行有一个 COPY 操作，其构建的时候会将当前目录中的 `CentOS-Base.repo` 拷贝覆盖到 `/etc/yum.repos.d/CentOS-Base.repo`。如果说你构建所需的文件都在命令行运行的上层目录，则可以把 `.` 换成 `..`，如果构建所需的文件都在 `/xx` 目录中，可以把 `.` 换成 `/xx`。

如果你运行docker build 的目录中没有 dockerfile，或者其名字不叫 `Dockerfile`, 可以使用 `-f`( 或者 `--file` ) 参数来手动指定，比如说 `docker build -f ./somepath/xx.Dockerfile`，将读取 `somepath` 子目录下的 `xx.Dockerfile` 文件。

`-t` 参数指定构建出来的镜像的标签，执行 `docker images` 命令，可以查看当前构建好（或者下载好）的镜像列表：

```shell
# docker images
REPOSITORY TAG        IMAGE ID       CREATED         SIZE
mycentos   latest     f3e54049025a   6 minutes ago   204MB
```

如果 docker build 没有指定 -t 参数的话，`REPOSITORY` 栏和 `TAG` 栏会显示为 `<none>`。-t 参数指定标签的时候的语法是 `${name}[:${version}]`， `${version}` 没有指定的话，默认为 `latest`。

**代码 1.1.1 ** 中的每一个命令在构建的时候，docker 都会创建一个临时 docker 来执行对应的命令，**输出 1.1.1** 中可以看出一共做了两步构建，生成了两个临时 docker（`8652b9f0cb4c` 和 `f3e54049025a`）。

对于第一个命令 `FROM centos:7`, 如果你是第一次在某个 dockerfile 中使用的话，会触发一次初始化拉取动作，由于我之前已经拉取过 centos:7 这个镜像了，所以 **输出 1.1.1** 并没有显示拉取操作。对于 FROM 命令来说，其指定的镜像如果本地存在，则直接使用本地的，所以如果你想保持追踪最新的父镜像，则需要在执行 docker build 命令之前，先执行一下 `docker pull 父镜像`，比如说对于 **代码 1.1.1** 来说，需要运行 `docker pull centos:7`。

对于 COPY 命令来说，其会将当前文件的权限一块拷贝到镜像中，如果当前待拷贝的是脚本文件，且希望其后续能被执行，则需要确保其有可执行权限。在 Windows 中，默认就是有执行权限的。但是我们一般是将 dockerfile push 到远程 git 仓库，然后触发 CI 来构建镜像，这个时候你需要确保在 git 中当前脚本文件具有可执行权限，对应的 git 命令为 `git update-index --chmod +x somefile`，注意你需要通过 git add 将其添加到 git 仓库后才能运行 git update-index 命令。由于我们当前要添加的文件，仅仅是个配置文件，不需要可执行权限，所以这里没有更改其权限的必要。

**输出 1.1.1** 中显示了构建出来的镜像的 ID，即 `IMAGE ID` 栏显示的 `f3e54049025a`，这个也在 docker images 命令中显示出来。

docker 本身具有缓存机制，命令在本地运行过一次后，下次运行就会走缓存，我们再运行一次 build 命令：

```shell
docker build . -t mycentos
Sending build context to Docker daemon   5.12kB
Step 1/2 : FROM centos:7
 ---> 8652b9f0cb4c
Step 2/2 : COPY CentOS-Base.repo /etc/yum.repos.d/CentOS-Base.repo
 ---> Using cache
 ---> f3e54049025a
Successfully built f3e54049025a
Successfully tagged mycentos:latest
```

**输出 1.1.2**

会看到 Step 2/2 中显示的是使用缓存(`Using cache`)，并且镜像 ID 还是为 `f3e54049025a`，跟第一次构建时生成的一样。

### 1.2 传递参数

Dockerfile 中可以支持传递参数来做个性化构建，如果你需要构建的镜像中使用的软件包有多个版本，那么你就可以通过传递参数的方式指定当前要构建的软件的版本号，从而生成不同的镜像。

举个例子，以下是一个构建 zookeeper 的 Dockerfile（**代码1.2.1**可以从[这里](https://code.aliyun.com/yunnysunny/dockerfiles/tree/master/zookeeper/Dockerfile)找到）

```dockerfile
FROM openjdk:11

COPY install_zk.sh /data/install_zk.sh
RUN sed -i 's/deb.debian.org/mirrors.ustc.edu.cn/g' /etc/apt/sources.list
RUN apt-get update
RUN apt-get install wget -y
ARG ZOOKEEPER_VERSION
# ENV ZOOKEEPER_VERSION $ZOOKEEPER_VERSION
RUN /data/install_zk.sh

CMD ["/opt/zookeeper/bin/zkServer.sh", "start-foreground"]
```

**代码 1.2.1**

为了方便我们构建镜像，我们先新建一个 build.sh 文件（[代码](https://code.aliyun.com/yunnysunny/dockerfiles/tree/master/zookeeper/build.sh)可以从这里找到）：

```shell
#!/bin/bash
set -e
ZOOKEEPER_VERSION=3.7.0

docker pull openjdk:11
docker build . -f Dockerfile -t registry.cn-hangzhou.aliyuncs.com/whyun/base:zookeeper-${ZOOKEEPER_VERSION} --build-arg ZOOKEEPER_VERSION=${ZOOKEEPER_VERSION}
if [ "$NEED_PUSH" = "1" ] ; then
    docker push registry.cn-hangzhou.aliyuncs.com/whyun/base:zookeeper-${ZOOKEEPER_VERSION}
fi
```

**代码 1.2.2**

> **代码 1.2.1** 中 FROM 参数中使用的镜像是托管在 dockerhub 上的，很多公司都会自建镜像仓库，比如说我在 代码 1.2.2 中将构建出来的镜像推送到了阿里云仓库中。如果有新的镜像要依赖于我刚才构建出来的镜像，那么 FROM 会写成这样：
>
> ```dockerfile
> FROM registry.cn-hangzhou.aliyuncs.com/whyun/base:zookeeper-3.7.0
> ```
>
> docker 遇到这句话的时候，会自动拼接一个 https 的地址进行请求。不过有一种特殊情况就是，公司的运维人员在搭建自建镜像仓库的时候，没有启用 https ，而是直接用了 http 协议，那么 FROM 指令可能就是这样的：
>
> ```dockerfile
> FROM registry.private.com:port/image-name:tag-name
> ```
>
> 那么你就需要更改你的 docker 的配置文件，Linux 下位于 /etc/docker/daemon.json，添加如下配置：
>
> ```json
> "insecure-registries": [
>     "registry.private.com:port"
> ]
> ```
>
> Windows 下，直接在设置界面的 Docker Engine 菜单做修改。修改完成后都需要重启 docker 服务。

**代码 1.2.2** 中我们先做了一个 docker pull 操作，保证我们用的父镜像是最新的。然后做 docker build 的时候，增加了一个 --build-arg 参数。启用来指定构建参数 ZOOKEEPER_VERSION 为 3.7.0，同时在 **代码 1.2.1** 中通过 `ARG ZOOKEEPER_VERSION` 来做声明，这句话是必须的，否则传递过来的 --build-arg 不会被读取。

我们在脚本 `install_zk.sh` （完整代码可以从[这里](https://code.aliyun.com/yunnysunny/dockerfiles/tree/master/zookeeper/install_zk.sh)找到）中可以引用了环境变量 `ZOOKEEPER_VERSION`，这个变量的值就是通过 `ARG ZOOKEEPER_VERSION` 传递过来的:

```shell
#!/bin/bash

ZOOKEEPER_FILENAME=apache-zookeeper-$ZOOKEEPER_VERSION-bin
ZOOKEEPER_ARCHIVE_NAME=$ZOOKEEPER_FILENAME.tar.gz

ZOOKEEPER_DOWNLOAD_ADDRESS=https://mirrors.bfsu.edu.cn/apache/zookeeper/zookeeper-$ZOOKEEPER_VERSION/$ZOOKEEPER_ARCHIVE_NAME
```

**代码 1.2.3 install_zk.sh 的部分代码**

> 为了方便查阅，在 **代码 1.2.1** 中一般还会添加一个 ENV 指令（就是代码中注释掉的那句指令，之所以这里注释掉，是为了演示单纯使用 ARG 指令，也能在 RUN 命令中读取 ARG 指定的变量的值），这样保证在镜像制作完成后，以当前镜像启动的 docker 中也可以读取到环境变量 `ZOOKEEPER_VERSION`的值，方便排查问题。

由于我们这里使用了可执行脚本，所以在推送到 git 仓库之前，需要运行 git update-index 命令，以保证在 Linux 上能够正常执行。

```shell
# 查看当前文件权限
# git ls-tree HEAD
100644 blob e35843f658466b724a6a8bdf8f60694fb72aeb24    Dockerfile
100644 blob e69de29bb2d1d6434b8b29ae775ad8c2e48c5391    build.sh
100644 blob e678cd6d070eb2790c4bfee000ffdab3753f30ae    install_zk.sh
100644 blob 93262ed2b85d2381ddce1ceda9c56fb74a73f948    start_zk.sh
100644 blob 94167794dba6420ad4625af45586c467f0550ab4    zookeeper
# 修改权限
# git update-index --chmod +x build.sh
# git update-index --chmod +x install_zk.sh
# git update-index --chmod +x start_zk.sh
# git update-index --chmod +x zookeeper
```

> 存储在 git 仓库中文件的权限只有 644 和 755 两种，如果你在 docker 中需要使用一些比较特殊的权限，不如说 ~/.ssh 目录下的文件，必须是 600 权限，你还是必须在 dockerfile 中使用 RUN 指令强制将 ~/.ssh 下的目录 chmod 成 600。

然后重新 commit，提交代码到远程 git 仓库，就可以保证在 Linux 下正常使用了。

由于我们的安装操作比较复杂，我们这里做了一个 shell 文件来执行 RUN 指令，假设你想执行的命令并不负责也可以直接写在 dockerfile 中

```dockerfile
RUN command1 && command2 && command3
```

**代码 1.2.4**

如果单条命令比较长，也可以使用换行

```dockerfile
RUN command1 \
	&& command2 \
	&& command3
```

**代码 1.2.5**

docker 默认启动时，是使用 root 用户进行登录，但是有一些第三方程序在设计的时候，不支持使用 root 用户来执行，这时候你必须切换到一个非 root 用户。以下代码节选自 nodebook 项目中的 [Dockerfile](https://github.com/yunnysunny/nodebook/blob/master/Dockerfile) 文件：

```dockerfile
RUN useradd -ms /bin/bash gitbook
RUN chown gitbook:gitbook -R /opt

USER gitbook
RUN gitbook current
WORKDIR /opt
COPY . /opt
RUN gitbook pdf .
```

**代码 1.2.6**

由于 gitbook pdf 命令不支持使用 root 用户运行，所以这里先通过 useradd 命令创建一个名字为 `gitbook` 的用户。然后将 /opt 的归属权更改位 `gitbook` 用户，接着使用 USER 指令将 docker 的用户切换位 `gitbook`，后面的 RUN 指令中的命令就会使用 `gitbook` 用户来运行。

### 1.3 启动命令

一般制作基础镜像时，会在 dockerfile 中指定一个 `ENTRYPOINT` 指令来 docker 启动时的自运行脚本文件；同时 dockerfile 中还可以使用 `CMD` 指令，它可以直接指定启动命令。

docker 在使用这两个指定的策略是这样的：

如果当前 dockerfile 和其应用的父级（包括其父级的父级） dockerfile 中没有任何 `ENTRYPOINT` 和 `CMD` 指定，则制作好的镜像在进行 docker run 时立即退出，其实这种情况下制作的镜像没有任何意义。

当前镜像有 `ENTRYPOINT`，则容器在启用的时候会执行 `ENTRYPOINT` 指定的脚本文本，这里我们演示一下：

```dockerfile
FROM centos:7
ADD hang.sh /hang.sh
ENTRYPOINT [ "/hang.sh" ]
```

**代码 1.3.1 hang.Dockerfile**

执行 ` docker build . -t hang -f hang.Dockerfile` 构建镜像，然后执行 `docker run --rm --name myhang hang`  来在前台运行我们的 docker 容器，这里加了一个 `--rm` 参数，这样我们使用 CTRL + C 退出控制台的时候，容器会被 stop 并且级联删除，省的我们自己手动删了。 然后我们重新打开一个控制台窗口，输入命令 `docker exec -it myhang bash` 即可进入我们当前创建的容器，在里面可以执行 shell 命令行做调试工作。
看上去使用 `ENTRYPOINT` 指令已经完美解决我们的问题，`CMD` 命令感觉比较多余，其实并不是这样，`ENTRYPOINT` 和 `CMD` 有一个隐藏功能。考虑一个简单情况，当两者都出现一个 dockerfile 中：

```dockerfile
FROM centos:7
COPY parent.sh /parent.sh
COPY sub.sh /sub.sh
COPY hang.sh /hang.sh
ENTRYPOINT [ "/parent.sh" ]
CMD [ "/sub.sh" ]
```

**代码 1.3.2 both.Dockerfile**

```shell
#!/bin/bash

echo 'this is from entrypoint'
# some init shell

exec "$@"
```

**代码 1.3.3 parent.sh**

```shell
#!/bin/bash

echo 'this is from cmd'

#other command...
/hang.sh
```

**代码 1.3.4 sub.sh**

这里同时指定了 ENTRYPOINT 和 CMD 指令，那么运行结果是后者覆盖前者吗？先别下结论，我们构建出来镜像运行看看。

运行如下命令

```shell
docker build . -t both -f both.Dockerfile
docker run --rm --name myboth both
```

 会直接输出

```shell
this is from entrypoint
this is from cmd
```

两个脚本的内容都输出了，难道是 ENTRYPOINT 和 CMD 两个指令先后被执行吗？注意代码 1.3.3 中的最后一行 `exec "$@"`，其意思是将脚本命令行中输入的参数当成命令来运行。对于 `both.Dockerfile` 来说其制作出来的镜像，最终启动的命令为 `/parent.sh /sub.sh`（CMD 指令被当成了 ENTRYPOINT 指令的参数），这个命令中的`/sub.sh` 被当成了 `parent.sh` 的命令行参数，也就是 `$@` 的值为 `/sub.sh`。

总结一下，如果 ENTRYPOINT 和 CMD 同时出现时，最终运行效果为 CMD 中的指令会被当成 ENTRYPOINT 中脚本的参数。这个特性隐藏的比较深，可能好多初学者不清楚。同时它会给我们启发，我可以在父层镜像中指定 ENTRYPOINT 来做初始化操作，在最后一行加上 `exec "$@"`，然后子镜像中使用的 CMD 就可以执行个性化的命令了。

为了做对比，我们再做一个镜像文件：

```dockerfile
FROM centos:7
COPY single.sh /single.sh
COPY sub.sh /sub.sh
COPY hang.sh /hang.sh
ENTRYPOINT [ "/single.sh" ]
CMD [ "/sub.sh" ]
```

**代码 1.3.5 single.Dockerfile**

```shell
#!/bin/bash

echo 'this is from entrypoint'
# some init shell
```

**代码 1.3.6 single.sh**

single.sh 和 parent.sh 相比少了 `exec "$@"`，我们通过如下命令来进行构建和运行：

```shell
docker build . -t single -f single.Dockerfile
docker run --rm --name mysingle single
```

运行完成之后，docker 立即退出了，`/sub.sh` 未被执行。

父子镜像组合使用 `CMD` 和 `ENTRYPOINT` 时，可能出现更为复杂的情况，总结如下：

|   父镜像   |   子镜像   |            结果             |
| :--------: | :--------: | :-------------------------: |
|    CMD     |    CMD     |        只执行子 CMD         |
|    CMD     | ENTRYPOINT |     只执行子 ENTRYPOINT     |
| ENTRYPOINT |    CMD     | 父ENTRYPOINT，子CMD均被执行 |
| ENTRYPOINT | ENTRYPOINT |     只执行子 ENTRYPOINT     |

> 同一指令后者会覆盖前者，`ENTRYPOINT` 是 docker 启动的入口点，而 `CMD` 是入口点的传参。当未显式设置 `ENTRYPOINT` 时，可以理解成默认的 `ENTRYPOINT` 为 `exec "$@"`。

### 1.4 构建阶段

我们通过 docker 来构建镜像的时候，免不了要做代码编译打包等操作，很多编程语言需要编译环境来能构建可执行应用包，但是这些编译环境个头比较大，而且服务器环境运行应用时很多编译用的工具根本不需要，如果在镜像中包含这些工具，平白无故会增加很多体积。构建阶段就是在这种场景下应运而生的。

```dockerfile
# 这个基础镜像的构建文件位于这里：https://code.aliyun.com/yunnysunny/dockerfiles/blob/master/go 
FROM registry.cn-hangzhou.aliyuncs.com/whyun/base:golang-1.17.2 AS build-stage
COPY . /opt
WORKDIR /opt
# RUN ssh -vT git@gitlab.com
RUN mkdir -p bin && go mod tidy && go build -o bin/use-my

FROM scratch AS export-stage
COPY --from=build-stage /opt/bin/use-my /
```

**代码 1.4.1 bin.Dockerfile**

docker build 时通过 `--target ${targetName}` 可以手动运行的阶段，如果不指定的话，就从头到尾运行完整个 dockerfile。比如说 代码 1.4.1 中 使用参数 `--target build-stage` 可以直接执行 build-stage 阶段的构建，忽略 export-stage 阶段的构建。不加参数的话，会构建 export-stage 阶段，当然也会级联构建 build-stage 阶段。

scratch 镜像是一个特殊的镜像，里面没有任何文件，一般是用来配合将镜像中的生成物做导出用的。不过这个导出功能属于新特性，目前只有在开启 [BuildKit](https://docs.docker.com/develop/develop-images/build_enhancements/) 特性的情况下才支持。下面给出 **代码 1.4.1** 的构建脚本：

```shell
mkdir -p bin
docker pull registry.cn-hangzhou.aliyuncs.com/whyun/base:golang-1.17.2
DOCKER_BUILDKIT=1 docker build --file bin.Dockerfile --output bin .
```

**代码 1.4.2**

> 代码 1.4.1 和 代码 1.4.2 , 可以从项目 [use-my](https://gitlab.com/yunnysunny/use-my) 中找到。

## 2 已知问题

### 2.1 清理磁盘

在 **1.1** 小节讲到 dockerfile 中的每一个命令都会创建一个临时 docker，但是如果你的 dockerfile 文件有问题，执行到一半退出了，那么这些临时 docker 不会被删除，同时这些临时 docker 还会对应临时镜像，也会被保留，素以我们需要定期清理。

docker 1.13 版本开始提供了一个实用的命令, `docker system prune` 可以用来清理没有用的镜像，通过 `docker system df` 可以查看当前所有镜像占用的磁盘统计信息。

如果你的 docker 版本低于 1.13，可以执行以下脚本来删除： 

```shell
#!/bin/bash
docker stop $(docker ps -a | grep "Exited" | awk '{print $1 }')
docker rm $(docker ps -a | grep "Exited" | awk '{print $1 }')
docker rmi $(docker images | grep "none" | awk '{print $3}')
```

**代码 2.1.1 清理 docker 镜像脚本**

### 2.2 拉取基础镜像缓慢

默认的镜像仓库地址是托管在 dockerhub 上，由于众所周知的原因，国外的网站在咱们这里访问并不稳定，并且 dockerhub 本身处于商业考量，还会对用户的访问进行限速，所以我们一般会在 docker 的配置文件中修改镜像仓库地址，将其指向国内地址。

具体配置文件在 Linux 下是 /etc/docker/daemon.json，修改其中的 `registry-mirrors` 属性即可：

```json
{
  "registry-mirrors": [
    "https://docker.mirrors.ustc.edu.cn",
    "https://hub-mirror.c.163.com",
    "https://mirror.baidubce.com",
    "https://registry.docker-cn.com"
  ]
}
```

 **代码 2.2.1**

这个属性是一个数组，可以填入多个镜像仓库地址。修改完成之后，使用命令 `service docker restart` 重启守护进行即可。

如果是在 Docker Desktop 中，则点击设置按钮，定位到 **Docker Engine** 选项卡，就可以看到 `registry-mirrors` 的属性配置了。修改完成后点击 **Apply & Restart** 重启即可。

![image-20211026145858747](/images/image-20211026145858747.png)

**图 2.2.1**

### 2.3 生成的镜像个头大

有的时候，明明你感觉 dockerfile 中做的操作很少，生成的镜像却出其意料的大，那么你就需要一款对于 dockerfile 中指令进行分析的工具。

dockerfile 中首先会指定一个基础镜像（通过 FROM 指令指定），接着后面代码中每一个新指令都会在前面指令的基础上叠加一层，产生一个新的临时镜像，直到 dockerfile 中所有指令执行完成，得到一个新的完整的镜像。

考虑下面一个 dockerfile

```dockerfile
FROM centos:7 as base

# 更改 yum 源
RUN mv /etc/yum.repos.d/CentOS-Base.repo /etc/yum.repos.d/CentOS-Base.repo.backup
COPY docker/etc/yum.repos.d /etc/yum.repos.d
RUN sed -i -e '/plugins=1/d' -e '/plugins=0/d' /etc/yum.conf

RUN yum install epel-release -y 
RUN yum install wget curl make tcpdump net-tools bind-utils telnet \
    logrotate ca-certificates which crontabs -y
```

**代码 2.3.1 first.Dockerfile**

我们想自己制作一个 centos 的基础镜像，以后在制作其他应用的镜像的时候，可以拿这个镜像做基础镜像。我们的需求也很简单，增加一些常用的依赖包即可。

通过 `docker build . -f first.Dockerfile --progress=plain --no-cache -t first-centos` 来构建，运行完之后通过 `docker images first-centos`查看镜像体积，通过输出发现镜像有五百多 MB

```
REPOSITORY     TAG       IMAGE ID       CREATED          SIZE
first-centos   latest    af7fadc07b7a   15 minutes ago   523MB
```

但是我们查看 centos 的镜像大小 `docker images centos:7`：

```
REPOSITORY   TAG       IMAGE ID       CREATED       SIZE
centos       7         eeb6ee3f44bd   5 weeks ago   204MB
```

原始的镜像只有两百多 MB，那么到底是哪行命令导致的呢？这个时候，你可以使用 [dive](https://github.com/wagoodman/dive) 这个工具。将其安装完成之后直接用 dive first-centos 命令即可查看 first-centos 这个镜像中对应的 dockerfile 中每行指令所产生的“层”的大小。

> 官方提供的使用 go get 安装的模式，经过笔者测试在 go 1.16+ 下无法运行(可以参见 [issue 371](https://github.com/wagoodman/dive/issues/371))。Windows 中安装二进制文件后，在命令行中排版有问题。推荐使用 Ubuntu 安装 deb 包的模式进行安装。

使用 `dive first-centos` 来查看各个层的文件变动，加载完界面后，按 `Tab` 键激活左右命令行区域，切换到右侧区域后，按 `CTRL+U`键可以过滤掉未修改的文件，只显示被修改的文件。然后再通过 `Tab` 键回到左侧区域，通过方向键切换查看各个指令，对应右侧区域会显示镜像内有哪些文件被更改。

![查看 first-centos 的各层空间占用](/images/dive-first.gif)

**图 2.3.1 查看 first-centos 的各层空间占用**

可以看到最后两个 yum 命令，会在 /var/cache 中生成大量缓存文件，是导致我们镜像内容变动的原因。yum 的在运行 install 命令时，会检测包元数据的缓存数据是否存在，如果不存在就会重新生成。所以我们在查看 yum install 命令的级联文件变动的时候，会在 /var/cache 下显示如此大的磁盘新增量。

接着我们修改一下 **代码 2.3.1** ,增加缓存清理机制：

```dockerfile
FROM centos:7 as base

# 更改 yum 源
RUN mv /etc/yum.repos.d/CentOS-Base.repo /etc/yum.repos.d/CentOS-Base.repo.backup
COPY docker/etc/yum.repos.d /etc/yum.repos.d
RUN sed -i -e '/plugins=1/d' -e '/plugins=0/d' /etc/yum.conf

RUN yum install epel-release -y && yum clean all && rm -rf /var/cache/yum
RUN yum install wget curl make tcpdump net-tools bind-utils telnet \
    logrotate ca-certificates which crontabs -y && yum clean all && rm -rf /var/cache/yum
```

**代码 2.3.2 second.Dockerfile**

使用命令 `docker build . -f second.Dockerfile --progress=plain  -t second-centos` 构建完成之后，再用命令 `dive second-centos` 查看，可以发现各个层的文件大小正常了：

![image-20211027162450032](/images/image-20211027162450032.png) 

**图 2.3.2**

