---
abbrlink: k8s-startup
title: k8s 原理入门
date:  2021-10-26
description: 之前通过讲 [docker compose 教程](https://blog.whyun.com/posts/docker-compose-tutorial/) 初步了解容器编排技术。但是 docker compose 默认只能在单机模式下运行，如果想在多个宿主机上运行，你可以借助 [docker swarm](https://docs.docker.com/engine/swarm/) 技术，你可以方便的将 docker-compose.yml 文件运用到 swarm 集群创建中。不过由于 [kubernetes](https://kubernetes.io/zh/) 的出现，swarm 的市场受到了极大排挤，目前各大公司利用容器编排技术，一般都会选择 kubernetes。本文顺应时势，在讲解容器编排技术的时候也是选择了 kubernetes 作为入门教程。
typora-copy-images-to: ../images
typora-root-url: ..
---

之前通过讲 [docker compose 教程](https://blog.whyun.com/posts/docker-compose-tutorial/) 初步了解容器编排技术。但是 docker compose 默认只能在单机模式下运行，如果想在多个宿主机上运行，你可以借助 [docker swarm](https://docs.docker.com/engine/swarm/) 技术，你可以方便的将 docker-compose.yml 文件运用到 swarm 集群创建中。不过由于 [kubernetes](https://kubernetes.io/zh/) 的出现，swarm 的市场受到了极大排挤，目前各大公司利用容器编排技术，一般都会选择 kubernetes。本文顺应时势，在讲解容器编排技术的时候也是选择了 kubernetes 作为入门教程。本文主要讲解 kubernetes 的安装和内部原理。

## 1. 安装

### 1.1 Linux 下安装

可以参见这篇文章 [使用kubeadm搭建k8s集群-ubuntu/debian发行版](https://blog.ideabeat.cn/2021/11/29/%E4%BD%BF%E7%94%A8kubeadm%E6%90%AD%E5%BB%BAk8s%E9%9B%86%E7%BE%A4-ubuntu-debian%E5%8F%91%E8%A1%8C%E7%89%88/) 。


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

考虑到高可靠性的问题，一个服务不可能部署为单节点，为了展示数据流向，我们在 **图 2.2** 只画了一个节点，实际情况应该是多个节点（对于 kubernetes 来说，这个 “节点” 就称之为 pod）的拓扑结构。而在 kubernetes 中我们并不是需要一台专门的机器做路由，我们的路由被内置到了集群中的没一台机器中，对于集群中的每个服务来说在系统中都会映射出一个 `虚拟 IP`。用户编写代码如果要连接一个特定服务，只需要提供`虚拟 IP` 和服务端口号即可，内核层会自动查找到当前 `虚拟 IP` 对应的某一个 pod 节点，把你的网络数据包转发过去。这个转发过程，全都是在一台主机上完成的（橙色区域写的内核空间，由于我们描述的是一台主机的情况，所以各个 pod 是共享的内核。里面画了一个路由器，但是仅仅是用来类比**路由表**的功能。），效率比较高。上面所说的转发，也就是完成了 **图2.2** 中的第 2 步。不过 `PodClient` `Pod1` - `PodN` 一系列机器都在一个网络中，在 **图 2.2** 中第 `3` `4` 步也就不需要了，某一个 `PodX` 在处理完数据之后请求者的源地址是直接可达的，所以不再需要做地址转化。`PodClient` 的内核态具体选择哪个 pod，kubernetes 内置了若干[算法](https://kubernetes.io/zh/docs/concepts/services-networking/service/#proxy-mode-ipvs)，比如说 `Round-Robin` `Least Connection`，更多说明参见算法链接（使用 IPVS 模式时支持若干算法，但是使用 iptables 时，支支持 `Round-Robin` 算法）。

> 真实的情况下，kubernetes 集群中肯定会部署多台主机，网络情况比当前举例的要更复杂。简单起见这里仅仅描述一台主机的情况。

![](/images/route_in_k8s.png)

**图 2.3**

同时由于集群内部服务的 pod 个数是动态增减的，这样才能灵活应对流量的激增和回退。所以**图 2.3** 中的路由表信息如果写死肯定不能应对这种情况。kubernetes 中使用 etcd 来存储数据，它通过 raft 一致性算法来保证数据一致性。一个关联的 pod 有增减之后，就会更改 etcd 数据，kubernetes 中的 kube-proxy 程序会自动监听节点变动，然后把同步修改主机上的路由表（或者 IPVS 信息）。

![](/images/pod_meta_update.png)

**图 2.4**


## 参考资料

1. LVS负载均衡（LVS简介、三种工作模式、调度原理以及十种调度算法） https://blog.51cto.com/u_14359196/2424034
3. Cracking kubernetes node proxy (aka kube-proxy) https://arthurchiao.art/blog/cracking-k8s-node-proxy/