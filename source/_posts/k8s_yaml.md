---
abbrlink: k8s-yaml
title: k8s 部署文件简谈
date:  2022-02-27
description: 这篇文章通过讲解 k8s 中 yaml 配置文件的编写过程，来让大家熟悉如何在 k8s 中部署应用；同时会讲解初学者如何使用免费 k8s 环境来做练习。
typora-copy-images-to: ..\images
typora-root-url: ..
categories:
- [Cloud Native, K8s]
---

在之前的教程 [k8s 网络原理入门](https://blog.whyun.com/posts/k8s-startup/) 中，我们了解到更多的是 k8s 如何保证集群内部各个服务在网络上互通。而这篇教程主要是讲实操的内容，会讲如何在 k8s 内部部署服务。

## 1. 基本操作

### 1.1 deployment

首先跟 docker 类似，k8s 的运行基本单元称之为 pod，我们通常会将一组 pod 作为一个部署单元部署到 k8s 集群中，这组 pod 里面的镜像等信息都是相同的。在 k8s 中，这种部署单元被称之为 `depolyment`，比如说下面这个配置文件就是一个 `depolyment`：

```yaml
apiVersion: apps/v1	#与k8s集群版本有关，使用 kubectl api-versions 即可查看当前集群支持的版本
kind: Deployment	#该配置的类型，我们使用的是 Deployment
metadata:	        #译名为元数据，即 Deployment 的一些基本属性和信息
  name: nginx-deployment	#Deployment 的名称
  labels:	    #标签，可以灵活定位一个或多个资源，其中key和value均可自定义，可以定义多组，目前不需要理解
    app: nginx	#为该Deployment设置key为app，value为nginx的标签
spec:	        #这是关于该Deployment的描述，可以理解为你期待该Deployment在k8s中如何使用
  replicas: 1	#使用该Deployment创建一个应用程序实例
  selector:	    #标签选择器，与上面的标签共同作用，目前不需要理解
    matchLabels: #选择包含标签app:nginx的资源
      app: nginx
  template:	    #这是选择或创建的Pod的模板
    metadata:	#Pod的元数据
      labels:	#Pod的标签，上面的selector即选择包含标签app:nginx的Pod
        app: nginx
    spec:	    #期望Pod实现的功能（即在pod中部署）
      containers:	#生成container，与docker中的container是同一种
      - name: nginx	#container的名称
        image: nginx:1.21	#使用镜像nginx:1.21创建container，该container默认80端口可访问
```

**代码 1.1.1 nginx-deployment.yaml**

注意到上述代码中的 `spec.replicas` 属性为 `1`，这代表当前部署中仅包含一个 pod，使用 `kubectl apply -f nginx-deployment.yaml` 可以将当前 `deployment` 部署到集群。

> 如果本地没有安装 k8s 环境，可以使用免费的 [okteto](https://cloud.okteto.com/) 服务，具体参见教程第 2 节部分。

部署完之后通过 `kubectl get pods` 命令，可以看到我们部署成功的 pod 信息：

```
NAME                                READY   STATUS    RESTARTS   AGE
nginx-deployment-5c95dfd78d-27kmw   1/1     Running   0          6s
```

通过命令 `kubectl get deployments` 即可以 `deployment` 的维度查看到刚才部署的 `nginx-deployment` (这个名字由 **代码 1.1.1** 中的 `metadata.name` 指定)

```
NAME               READY   UP-TO-DATE   AVAILABLE   AGE
nginx-deployment   1/1     1            1           44m
```

如果你感觉当前只有一个 pod 不够使，那么可以通过简单的命令就可以进行扩容 `kubectl scale deployment nginx-deployment --replicas 2` 上述命令会将 `nginx-deployment` 的 pod 个数增长为 2。再次通过运行 `kubectl get pods` 命令，会发现新增了一个 pod：

```
NAME                                READY   STATUS    RESTARTS   AGE
nginx-deployment-5c95dfd78d-27kmw   1/1     Running   0          58m
nginx-deployment-5c95dfd78d-z5qnh   1/1     Running   0          3s
```

### 1.2 service

我们在上一节中已经将我们的应用部署到了 k8s 集群中，但是目前为止，部署的应用还是不能访问的，如果想让应用能够对外访问需要在 yaml 文件中定义 service。

```yaml
apiVersion: v1
kind: Service
metadata:
  name: nginx
  labels:
    app: nginx
spec:
  ports:
  - port: 80
    #nodePort: 31701
    protocol: TCP
  selector:
    app: nginx
```

**代码 1.2.1 nginx-svc.yaml**

注意 **代码 1.2.1** 中的 `spec.selector` 属性，他会筛选所有 pod 中 lable 名字为 `app` 且值为 `nginx` 的节点添加到当前 service 中。同时，根据字段 `metadata.name` 决定了当前 service 的名字为 `nginx`。

运行命令 `kubectl apply -f nginx-svc.yaml` 可以在 k8s 集群中创建当前 service。

同时留意到我们指定属性 `spec.ports[0].port` 的值为 `80`，这个属性将新建一个 `Cluster IP`，同时指定 `Cluster IP` 上开放 80 端口，作为集群内部机器的访问端口。如果想让集群外部访问，需要指定 `nodePort` 端口，这个端口会绑定到集群中所有宿主机节点的外网 IP 上（要想启用 nodePort 属性，需要指定 `spec.type` 属性为 `NodePort`，`sepc.type` 的默认值为 `ClusterIp`）。

通过命令 `kubectl get svc nginx` 可以查看当前创建的 service 的简介：

```
NAME    TYPE        CLUSTER-IP       EXTERNAL-IP   PORT(S)   AGE
nginx   ClusterIP   10.155.128.177   <none>        80/TCP    19m
```

从上面输出可以得出 nginx 服务的 `Cluster IP 为 `10.155.128.177`

我们通过命令 `kubectl run curl --image=radial/busyboxplus:curl -i --tty` 可以创建一个带有 curl 命令支持的 pod，并进入其控制台。输入命令 `curl http://10.155.128.177:80` ，会得到如下输出：

```html
<!DOCTYPE html>
<html>
<head>
<title>Welcome to nginx!</title>
<style>
html { color-scheme: light dark; }
body { width: 35em; margin: 0 auto;
font-family: Tahoma, Verdana, Arial, sans-serif; }
</style>
</head>
<body>
<h1>Welcome to nginx!</h1>
<p>If you see this page, the nginx web server is successfully installed and
working. Further configuration is required.</p>

<p>For online documentation and support please refer to
<a href="http://nginx.org/">nginx.org</a>.<br/>
Commercial support is available at
<a href="http://nginx.com/">nginx.com</a>.</p>

<p><em>Thank you for using nginx.</em></p>
</body>
</html>
```

代表我们的服务没有问题。

### 1.3 负载均衡

在之前教程 [k8s 网络原理入门](https://blog.whyun.com/posts/k8s-startup/) 中讲到 k8s 中通过 `虚 IP`，也就是 `Cluster IP` 来做请求入口 IP，操作系统内核根据  `虚 IP` 和 请求端口做 NAT 转发。但是这个端口转发还有一个特性，一旦 TCP 报文被转发过一次后，操作系统就记住了当前的请求者的源 IP、源端口号、目的 IP、目的端口号的映射关系，下次报文再过来的时候，就不用再做转发了。这本来是一个利于性能的方案，但是同样会导致新的问题。

如果当前的请求是 http 1.0 协议或者没有启动 keep alive 的 1.1 协议，那么请求在发送完一次后，句柄立马就销毁了，下次请求会重新创建新的句柄，操作系统内核会重新走一遍端口转发，由于操作系统做 NAT 的时候，是随机选择一个 pod IP，所以从客户端的角度来说，负载可以认为均衡的。

不过如果我们的请求是长连接（比如普通 TCP 请求、启用了 keep alive 的 http 1.1、http 2.0 等创建的连接），那么请求者在发送完一次请求后，句柄还是复用的。这时候如果请求者的数目低于服务者的数目，就会导致一个很尴尬的事情，有些服务器可能不会得到请求者的光临而处于饥饿状态。

k8s 本身没有提供负载均衡解决方案，虽然它预留了 `LoadBalancer` 类型的 service 定义（也就是将 **代码 1.2.1** 中的 `spec.type` 改为 `LoadBalancer` ），但是官方却没有给出具体实现方式。也就是说你自建一个 k8s 集群的话，是没有负载均衡功能的，不过你使用 阿里云、谷歌云之类的云服务倒是都实现 `LoadBalancer`，不过那就需要牵扯到付费服务了。

业内对于这个问题的解决方案大体上分为一下几个个思路，一个是使用类似 Istio 、Linkerd 这些 Service Mesh 解决方案，不但给你解决负载均衡问题，还令带给你解决流量管控等问题，不过这种全家桶类型的解决方案对于原有架构来说是一个重大的升级。如果想追求，还可以使用一些第三方的反代工具，比如说 Envoy 。还有一种方案是直接对接 k8s 的 API，在客户端做服务发现和负载均衡，彻底做到自研。当然如果你想脱离 k8s 自身的服务转而使用第三方的服务发现组件，比如说 consul，也算是一种选择，主要看当前项目组在哪方面技术积累更深厚了。

## 2. 免费 k8s 资源

由于 k8s 环境搭建需要一定的时间，且需要耗费一定的硬件资源，如果手动暂时没有 k8s 环境的话，可能连第 1 小节练习 k8s 命令的机会都没有。不过，不要慌，https://cloud.okteto.com/ 上可以申请免费的 k8s 资源，只需要用 github 账户登录即可。它最多可以创建 10 个 pod，一般练习使用够用了。不过毕竟是免费的，有一些功能是不能用的，比如说创建 NodePort 类型的 service、修改操作系统内核参数等若干影响到宿主机的功能是不给提供的。

接着点击左侧 **Settings** 菜单，然后点击按钮 **Download Config File**，然后会弹出设置 `KUBECONFIG` 环境变量的提示框，将其命令拷贝到终端执行，则当前终端中就能直接找到 k8s 的配置文件，否则的话你执行 kubectl 命令的时候，都需要添加 ` --kubeconfig ` 的参数。

![image-20220227203214263](/images/image-20220227203214263.png)

**图 2.1**

<img src="/images/image-20220227203127277.png" alt="image-20220227203127277" style="zoom: 80%;" />

**图 2.2**

## 3. 实践与扩展

由于 k8s 可以方便的做扩容，所以在执行压测程序时特别方便，这里给出一个在 k8s 中做打压的实例。

```yaml
apiVersion: apps/v1 #与k8s集群版本有关，使用 kubectl api-versions 即可查看当前集群支持的版本
kind: Deployment #该配置的类型，我们使用的是 Deployment
metadata: #译名为元数据，即 Deployment 的一些基本属性和信息
  name: hello-deployment #Deployment 的名称
  labels: #标签，可以灵活定位一个或多个资源，其中key和value均可自定义，可以定义多组，目前不需要理解
    app: hello #为该Deployment设置key为app，value为nginx的标签
spec: #这是关于该Deployment的描述，可以理解为你期待该Deployment在k8s中如何使用
  replicas: 1 #使用该Deployment创建一个应用程序实例
  selector: #标签选择器，与上面的标签共同作用，目前不需要理解
    matchLabels: #选择包含标签app:nginx的资源
      app: hello
  template: #这是选择或创建的Pod的模板
    metadata:
      name: hello-app
      labels:
        app: hello
    spec:
      initContainers:
      - image: busybox
        command:
        - sh
        - -c
        - |
          sysctl -w net.core.somaxconn=10240
          sysctl -w net.ipv4.ip_local_port_range="1024 65535"
          sysctl -w net.ipv4.tcp_tw_reuse=1
          sysctl -w fs.file-max=6048576
        name: setsysctl
        securityContext:
          privileged: true
      containers:
        - name: hello-app
          image: registry.cn-hangzhou.aliyuncs.com/whyun/base:hello-latest
          imagePullPolicy: Always
          resources:
            requests:
              cpu: 2000m
              memory: 2Gi
            limits:
              cpu: 4000m
              memory: 4Gi
          env:
            - name: test
              value: "1"


---
kind: Service
apiVersion: v1
metadata:
  name: hello-service
spec:
  selector:
    app: hello
  ports:
    - port: 8000 # Default port for image


---
apiVersion: apps/v1 #与k8s集群版本有关，使用 kubectl api-versions 即可查看当前集群支持的版本
kind: Deployment #该配置的类型，我们使用的是 Deployment
metadata: #译名为元数据，即 Deployment 的一些基本属性和信息
  name: bench-deployment #Deployment 的名称
  labels: #标签，可以灵活定位一个或多个资源，其中key和value均可自定义，可以定义多组，目前不需要理解
    app: bench #为该Deployment设置key为app，value为nginx的标签
spec: #这是关于该Deployment的描述，可以理解为你期待该Deployment在k8s中如何使用
  replicas: 6 #使用该Deployment创建一个应用程序实例
  selector: #标签选择器，与上面的标签共同作用，目前不需要理解
    matchLabels: #选择包含标签app:nginx的资源
      app: bench
  template: #这是选择或创建的Pod的模板
    metadata:
      name: bench-node
      labels:
        app: bench
    spec:
      initContainers:
      - image: busybox
        command:
        - sh
        - -c
        - |
          sysctl -w net.core.somaxconn=10240
          sysctl -w net.ipv4.ip_local_port_range="1024 65535"
          sysctl -w net.ipv4.tcp_tw_reuse=1
          sysctl -w fs.file-max=1048576
        name: setsysctl
        securityContext:
          privileged: true
      containers:
        - name: bench-node
          image: registry.cn-hangzhou.aliyuncs.com/whyun/base:node-bench-0.2.0
          env:
            - name: REQ_URL
              value: http://hello-service:8000/
            - name: REQ_INTERVAL_MS
              value: "5"
            - name: REQ_TIMEOUT_MS
              value: "20"
```

**代码 3.1**

从肉眼上看，明显看的出来上述代码比较长，而且中间会有 `---` 分隔符，这是 yaml 文件中固有语法，可以用来分割多个配置。

同时在 `spec.template.spec` 属性下多了一个 `initContainers` 属性，它一般用来执行一些初始化操作的命令，运行完成后就退出，这里可以指定若干初始化容器，按照顺序指定，初始化容器都执行完成后，才会轮到应用容器启动。不过这里我们使用 initContainers 的一个重要原因，还在于我们需要修改操作系统内核参数，这在普通容器中是做不到的。也就是由于我们要修改内核参数，所以这个例子在 okteto 中无法运行。

同时还新增了  `spec.template.spec.containers[0].env` 属性，用来指定容器启动时的环境变量。它比 Dockerfile 中的 ENV 指定定义的环境变量要高。

## 代码

本文代码 https://gitlab.com/yunnysunny/k8s-learn

本文中引用的部分镜像代码来源于 https://github.com/yunnysunny/dockerfiles

