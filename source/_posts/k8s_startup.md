---
abbrlink: k8s-startup
title: k8s 入门
date:  2021-10-26
description: 之前通过讲 [docker compose 教程](https://blog.whyun.com/posts/docker-compose-tutorial/) 初步了解容器编排技术。但是 docker compose 默认只能在单机模式下运行，如果想在多个宿主机上运行，你可以借助 [docker swarm](https://docs.docker.com/engine/swarm/) 技术，你可以方便的将 docker-compose.yml 文件运用到 swarm 集群创建中。不过由于 [kubernetes](https://kubernetes.io/zh/) 的出现，swarm 的市场受到了极大排挤，目前各大公司利用容器编排技术，一般都会选择 kubernetes。本文顺应时势，在讲解容器编排技术的时候也是选择了 kubernetes 作为入门教程。
typora-copy-images-to: ../images
typora-root-url: ..\
---

之前通过讲 [docker compose 教程](https://blog.whyun.com/posts/docker-compose-tutorial/) 初步了解容器编排技术。但是 docker compose 默认只能在单机模式下运行，如果想在多个宿主机上运行，你可以借助 [docker swarm](https://docs.docker.com/engine/swarm/) 技术，你可以方便的将 docker-compose.yml 文件运用到 swarm 集群创建中。不过由于 [kubernetes](https://kubernetes.io/zh/) 的出现，swarm 的市场受到了极大排挤，目前各大公司利用容器编排技术，一般都会选择 kubernetes。本文顺应时势，在讲解容器编排技术的时候也是选择了 kubernetes 作为入门教程。

## 1. 安装

### 1.1 Linux 下安装

处于演示目的，我们依然选择安装单机版 kubernets，在 Linux 下可以选择安装 [minikube](https://github.com/kubernetes/minikube) 这个工具。

```shell
wget https://github.com/kubernetes/minikube/releases/download/v1.23.2/minikube-linux-amd64
chmod +x minikube-linux-amd64
mv minikube-linux-amd64 /usr/local/bin/minikube
```
**代码 1.1.1**

> 上述代码中的下载地址，是从 minikube 的 github 项目的 release 页中找到的。你可以根据自己需要选择安装最新版本。

通过 `minikube start` 命令可以启动 minikube 服务，不过 minikube 默认不支持使用 root 用户启动，如果想使用 root 启动，可以使用

```shell
minikube start ----driver=none
```
**代码  1.1.2**

来启动（前提是你的宿主机中安装了 docker ，并且含有 systemd 守护服务）。

如果启动过程中报错 ` Exiting due to GUEST_MISSING_CONNTRACK: Sorry, Kubernetes 1.22.2 requires conntrack to be installed in root's path`，则证明你的系统中缺少 conntrack 组件，需要通过 `yum install conntrack -y` 来修复（debain 内核使用 `apt-get install conntrack -y`）。

不过使用**代码  1.1.2**后发现，初始化过程中需要下载依赖组件，而这些依赖组件由于众所周知的原因，我们下载不下来，通过在启动过程中改用阿里源即可解决

```shell
minikube start --driver=none --image-mirror-country='cn' --image-repository=registry.cn-hangzhou.aliyuncs.com/google_containers
```

**代码 1.1.3**

> 笔者在实验过程中发现即使指定了image-repository 参数，minikube 依然会从 https://k8s.gcr.io 上拉取镜像。所以当前在 Linux 上暂时没有调试成功。


### 1.2 Windows 下安装

Windows 下可以从 Docker Desktop 中直接开启 kubernetes 功能，它会通过创建 docker 容器的模式来提供 kubernetes 服务，不过由于众所周知的原因，其容器用到的镜像在国内无法下载，你需要使用这个 [k8s-for-docker-desktop](https://github.com/AliyunContainerService/k8s-for-docker-desktop) 项目提供的解决方案。

我们在设置里找到当前 docker-desktop 的版本

![](/images/docker_desktop_k8s.png)

**图 1.2.1**

笔者安装的是 1.21.5 版本，clone 一下 k8s-for-docker-desktop 项目，切换到 v1.21.5 分支

```shell
git clone https://github.com/AliyunContainerService/k8s-for-docker-desktop.git
git checkout v1.21.5
.\load_images.ps1
```

**代码 1.2.1**

接着还是在项目 k8s-for-docker-desktop 目录中，执行下述命令来配置 kubernetes 控制台：

```shell
kubectl create -f kubernetes-dashboard.yaml
kubectl proxy
```

**代码 1.2.2**

`kubectl proxy` 命令，会输出如下提示 `Starting to serve on 127.0.0.1:8001`，说明启动控制台成功，然后你需要在浏览器中访问下面地址

http://localhost:8001/api/v1/namespaces/kubernetes-dashboard/services/https:kubernetes-dashboard:/proxy/

这个地址会提示输入 token，在 Windows 中 token 可以通过在 powsershell 中执行如下命令获得：

```powershell
$TOKEN=((kubectl -n kube-system describe secret default | Select-String "token:") -split " +")[1]
kubectl config set-credentials docker-for-desktop --token="${TOKEN}"
echo $TOKEN
```

## 2 原理

kubernetes 将若干容器进行编排，形成一个集群，但是这个集群最终要对外提供访问能力，才能被使用。kubernetes 自带了 NodePort 和 LoadBalancer 两种模式来让使用者从外部访问集群内的机器。其中 NodePort 和原理和我们路由器中用到的[网络地址转化](https://zh.wikipedia.org/wiki/%E7%BD%91%E7%BB%9C%E5%9C%B0%E5%9D%80%E8%BD%AC%E6%8D%A2)（**N**etwork **A**ddress **T**ranslation，简称 `NAT`）是一样的。kubernetes 会对外提供一个端口，用来支持外部应用来访问内部的某一个服务。同时对于内部 pod 来说，每个部署当前服务的节点都会被分配一个特定端口，用来接收“路由器”转发过来的请求。

> pod 是 kubernetes 中的管理单元，其代表集群中一组正在运行的容器。所以说 kubernetes 集群和 pod 之间的数量级关系是 1：N，而 pod 和容器之间的数量级关系是 1：M。

对于外部访问者来说，它看到的一个服务的访问地址是“路由器”的IP，定义为 `IPV`，定义在这个“路由器”上的一个指定端口，定义为 `PORTD`，记这个服务本身为 `SERVICEX`。“路由器”在读取到这个数据时，首先读取网络层数据包的头部信息，这样就拿到了请求者的源地址。然后读取网络层正文部分数据的前四个字节，也就是传输层的头部信息的前四个字节，这样就得到了请求者的源端口，和它要访问的目的地的端口（也就是 `PORTD`）。

![](/images/network_layers.png)

**图 2.1**

**图 2.1** 中橙色的 `2` 字节的内容即为请求数据的目的端口号，也就是上面我们说到的 `PORTD` 的值，“路由器”识别到当前请求的端口是 `PORTD` 的时候，就知道用户是要访问 `SERVICEX`。然后它就去查找当前 `SERVICEX` 中部署的节点列表，从中挑选一个，记为 `Node1`，将请求数据包转发给这个 `Node1`，不过再转发前会将目的 IP 改为 `Node1` 的 IP，将目的端口号改为 `Node1` 上这个服务的监听端口号。

`Node1` 在处理完成之后，将数据包返给“路由器”，源地址写的是 `Node1` 的 IP，“路由器”收到数据包之后，将源地址改成自己的 IP，转发给请求者。

![](/images/nat_transform.png)

**图 2.2**

整个 `NAT` 过程如上图所示。

考虑到高可靠性的问题，一个服务不可能部署为单节点，为了展示数据流向，我们在 **图 2.2** 只画了一个节点，实际情况应该是多个节点（对于 kubernetes 来说，这个 “节点” 就称之为 pod）的拓扑结构。而在 kubernetes 中我们并不是需要一台专门的机器做路由，我们的路由被内置到了集群中的没一台机器中，对于集群中的每个服务来说在系统中都会映射出一个 `虚拟 IP`。用户编写代码如果要连接一个特定服务，只需要提供`虚拟 IP` 和服务端口号即可，内核层会自动查找到当前 `虚拟 IP` 对应的某一个 pod 节点，把你的网络数据包转发过去。这个转发过程，全都是在发起请求的 pod 上完成的（整个蓝色区域都是 `PodClient` 这台区域，虽然里面画了一个路由器，但是仅仅是用来类比**路由表**的功能），效率比较高。上面所说的转发，也就是完成了 **图2.2** 中的第 2 步。不过 `PodClient` `Pod1` - `PodN` 一系列机器都在一个网络中，在 **图 2.2** 中第 `3` `4` 步也就不需要了，某一个 `PodX` 在处理完数据之后请求者的源地址是直接可达的，所以不再需要做地址转化。`PodClient` 的内核态具体选择哪个 pod，kubernetes 内置了若干[算法](https://kubernetes.io/zh/docs/concepts/services-networking/service/#proxy-mode-ipvs)，比如说 `Round-Robin` `Least Connection`，更多说明参见算法链接（使用 IPVS 模式时支持若干算法，但是使用 iptables 时，支支持 `Round-Robin` 算法）。

![](/images/route_in_k8s.png)

**图 2.3**

同时由于集群内部服务的 pod 个数是动态增减的，这样才能灵活应对流量的激增和回退。所以**图 2.3** 中的路由表信息如果写死肯定不能应对这种情况。kubernetes 中使用 etcd 来存储数据，它通过 raft 一致性算法来保证数据一致性。一个关联的 pod 有增减之后，就会更改 etcd 数据，kubernetes 中的 kube-proxy 程序会自动监听节点变动，然后把数据同步到各个 pod 节点。


## 参考资料

1. https://segmentfault.com/a/1190000022685244