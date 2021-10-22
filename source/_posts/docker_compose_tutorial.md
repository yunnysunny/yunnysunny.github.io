---
abbrlink: docker-compose-tutorial
title: docker compose 教程
date:  2021-10-21
description: 
typora-copy-images-to: ..\images
---

docker 容器提供了一种封装格式，可以将应用和其运行环境封装在一起，但是在线上实践过程中，应用和应用之间难免要产生依赖，一个上游的应用，可能会依赖于下游的一个或者几个应用给其提供数据。正所谓一个好汉三个帮，现实情况中，一个服务部署完成之后，对外不产生依赖的情况还是比较少的，但是 docker 在开始设计的时候没有过多考虑到容器之间依赖关系的处理。为了解决这个问题，在后续的发展中，一系列的容器编排的技术出现，比如说 `Docker Swarm` `Marathon` `Kubernetes` 等。上面提到的编排工具都是可以用在生产环境上的解决方案，不过本文要讲一下 `Docker Compose` 这个官方给出的编排解决方案，由于其功能比较简单，一般出于测试目的来使用，不过正式由于其简单，对于理解更高级的编排工具来说，算是一个好的入门。

## 1. 安装

由于在 Mac 和 Windows 的桌面程序 Docker Desktop 上，docker compose 是自带的，下面仅给出 Linux 下的安装命令：

```shell
sudo curl -L "https://github.com/docker/compose/releases/download/1.29.2/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose
```
**代码 1.1**

确保 /usr/local/bin 处在 PATH 环境变量中，就可以在命令行中使用  docker-compose 命令了，正常情况下运行 `docker-compose --version` 会显示当前的版本号。

## 2. 使用

### 2.1 服务依赖

为了方便举例，这里使用 kafka 这款软件来做演示，因为这款软件天生要依赖于 zookeeper 。简单起见，还是先做一个只启动 zookeeper 的配置文件：

```yaml
version: "3"
services:
  my-zookeeper:
    image: 'bitnami/zookeeper:latest'
    user: root
    restart: always
    container_name: my-zk
    ports:
      - '2981:2181'
    environment:
      - ALLOW_ANONYMOUS_LOGIN=yes
```

**代码 2.1.1**

将 代码 2.1 保存为文件 docker-compose.yml ，然后再其所在目录中执行 `docker-compose up` 即可成功启动配置文件中的 docker。运行完成之后会在控制台有如下输出：

![image-20211021182438597](/images/image-20211021182438597.png)

**图 2.1.1**

由于 docker 镜像中部署的应用大都是在前台运行的，使用 docker-compose 的时候也沿袭了这一个特性，使用 CTRL + C 才可退出当前容器。如果想在后台运行，使用  `docker-compose up -d` 即可。

其实看 **代码 2.1.1** 转化成 docker run 命令的话，就是  `docker run --name my-zk --restart always --user root -e ALLOW_ANONYMOUS_LOGIN=yes -p 2981:2181  bitnami/zookeeper:latest`。如果 docker-compose 配置文件中只有一个 docker 容器的配置的话，其优势不大。

下面在刚才的 docker-compose.yml 中再添加 kafka 的配置：

```yaml
version: "3"
services:
  my-zookeeper:
    image: 'bitnami/zookeeper:latest'
    user: root
    restart: always
    container_name: my-zk
    ports:
      - '2981:2181'
    environment:
      - ALLOW_ANONYMOUS_LOGIN=yes
  my-kafka:
    image: 'bitnami/kafka:latest'
    user: root
    restart: always
    container_name: my-kfk
    ports:
      - '9892:9892'
    environment:
      - KAFKA_BROKER_ID=1
      - KAFKA_LISTENERS=PLAINTEXT://:9892
      - KAFKA_ADVERTISED_LISTENERS=PLAINTEXT://localhost:9892
      - KAFKA_ZOOKEEPER_CONNECT=my-zookeeper:2181
      - ALLOW_PLAINTEXT_LISTENER=yes
    depends_on:
      - my-zookeeper
```

**代码 2.1.2**

注意上述代码中的 depends_on 属性，这里填写了 my-zookeeper，则代表 my-kafka 这个 service 将会在 my-zookeeper 启动之后再启动。

> 虽然在 docker-compose 中每个 service 下面仅仅包含一个容器，但是 docker-compose 还是在容器的基础上抽象了一层，管它叫 service。

但是这里面会有一个坑，首先考虑这么一个问题，就是如何判定一个 service 启动完成呢？docker-compose 认为只要运行了 docker 的启动脚本，就算启动完成了。但真实情况是运行完一个服务程序后，它自己本身要做大量初始准备工作，这些工作并不能在瞬时完成。具体到我们上面的例子，在 zookeeper 服务没有准备好的情况下如果依赖于它的 kafka 这时候也处在启动阶段，就会出现报错信息。所以一个更优雅的解决方案，是在 kafka 的启动服务中判断 zookeeper 的监听端口是否可用，等待其可用后再启动其自身服务。

![image-20211021203923577](/images/image-20211021203923577.png)

**图 2.1.2**

我们从 **图 2.1.2** 的输出中可以看出，kakfa 和 zookeeper 的日志是交替打印的，如果 kafka 早于 zookeeper 启动，就会出现找不到 zookeeper 服务的现象（然后 kafka 服务内部会有重试策略，但是还是会出现错误日志打印，给排查问题造成困扰）。

在 kafka 启动前先检测 zookeeper 端口是否可用的方案，很遗憾没有在 bitnami 的 dockerfile [github 项目](https://github.com/bitnami/bitnami-docker-kafka)中实现。不过 docker [官方文档](https://docs.docker.com/compose/startup-order/)中给出的解决方案是使用 [wait-for](https://github.com/Eficode/wait-for) 等工具来完成。

### 2.2 网络

**代码 2.1.2** 中 kafka 之所以能够和 zookeeper 通信，是由于两者在同一个网络中。docker-compose 在启动当前配置文件的时候，默认会创建一个单独的网络，然后把当前配置文件中的所有容器都加入其中。

> docker-compose 的 network 在底层会使用 docker network create 命令进行创建网络。使用教程可以参见[官方文档](https://docs.docker.com/engine/reference/commandline/network_create/)。

我们通过 `docker network ls` 可以查看当前系统的 docker 创建的网卡：

```
PS C:\Users\lenovo> docker network ls
NETWORK ID     NAME                   DRIVER    SCOPE
f81f27e241f7   2_default              bridge    local
9dea2e94021d   bridge                 bridge    local
2dff57895828   host                   host      local
a9e1acde9ceb   multi_cluster_consul   bridge    local
c85a7f7e1a68   none                   null      local
```

其中 `2_default` 是通过 **代码 2.1.2** 启动的 docker 组件生成的网络配置。其格式为 `${project-name}_default`，其中 `${project-name}` 默认为 docker-compose 的所在文件夹的名字（不过如果你的文件夹名中有 `.` 的话，会取 `.` 前部的名字）。你也可以运行 docker-compose 命令时使用 `--project-name` 参数来指定项目名称，使用 `docker-compose up --project mycs` 重新运行 **代码 2.1.2**（如果之前已经运行了，需要先运行 `docker-compose down`，否则会启动报错，提示容器已经存在）。重复运行 `docker network ls` 可以发现网络名称已经更换了：

```
PS C:\Users\lenovo> docker network ls
NETWORK ID     NAME                   DRIVER    SCOPE
9dea2e94021d   bridge                 bridge    local
2dff57895828   host                   host      local
a9e1acde9ceb   multi_cluster_consul   bridge    local
029b23c6ff51   mycs_default           bridge    local
c85a7f7e1a68   none                   null      local
```

当然你也可以在 docker-compose.yml 文件中手动指定 network 名称，假设 docker-compose 中有三个容器，可以把 容器 1 和容器 2 使用一个网络，容器 2 和容器 3 使用一个网络，容器 1 和 容器 3 之间网络不能直接访问。上述用法在实践中用的比较少，这里省略不讲。如果读者比较关心，可以参考官方文档的[例子](https://docs.docker.com/compose/networking/#specify-custom-networks)。

由于大家的使用习惯是在 docker-compose.yml 文件中直接使用 `docker-compose up -d` 来拉起一组 docker 容器，这时候一定要留意你不同 yml 文件所在的文件名要做成不一样的，否则它在创建 network 名称的时候会冲突。

> 本教程源代码项目：https://gitlab.com/yunnysunny/docker-compose-tutorial

