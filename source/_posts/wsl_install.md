---
abbrlink: wsl-and-docker-desktop-install
title: wsl 和 docker desktop 的安装教程
date:  2021-09-09
description: win10 中提供了 wsl 的解决方案，可以在 Windows 中直接开启 linux 子系统，十分方便开发者使用。同时一些重要的功能也要依赖于 wsl 才能启动，比如说 docker desktop。本教程就是演示一下如何在 win10 中配置 wsl ，并且如何正常使用 docker desktop。
typora-copy-images-to: ..\images
typora-root-url: ..
---

win10 中提供了 wsl 的解决方案，可以在 Windows 中直接开启 linux 子系统，十分方便开发者使用。同时一些重要的功能也要依赖于 wsl 才能启动，比如说 docker desktop。本教程就是演示一下如何在 win10 中配置 wsl ，并且如何正常使用 docker desktop。

## 1. 安装
### 1.1 安装 wsl
#### 1.1.1 启用 linux 子系统
用管理员身份打开 powershell ，然后输入如下命令回车：
```powershell
dism.exe /online /enable-feature /featurename:Microsoft-Windows-Subsystem-Linux /all /norestart
```

#### 1.1.2 启动虚拟机功能
由于我们后续要安装 docker desktop，需要依赖于 wsl 2，所以需要启动 Windows 自带的虚拟机平台功能，同样是管理员身份打开 powershell，然后输入如下命令：
```powershell
dism.exe /online /enable-feature /featurename:Microsoft-Windows-Subsystem-Linux /all /norestart
```

#### 1.1.3 安装 Linux 内核更新包

下载 [适用于 x64 计算机的 WSL2 Linux 内核更新包](https://wslstorestorage.blob.core.windows.net/wslblob/wsl_update_x64.msi) ，然后安装。

#### 1.1.4 设置 wsl 版本为 wsl 2

打开 powershell ，然后运行如下命令，即可将默认 wsl 版本切换为 wsl 2，默认为 wsl 1

```powershell
wsl --set-default-version 2
```

至此 wsl 的安装就完成了，下面就是选择一个 Linux 子系统进行安装。

### 1.2 安装 Linux 子系统

wsl 支持很多 Linux 发行版系统，比如说 [Ubuntu](https://www.microsoft.com/store/apps/9n6svws3rx71) [openSUSE](https://www.microsoft.com/store/apps/9NJFZK00FGKV) [Debian](https://www.microsoft.com/store/apps/9MSVKQC78PK6) [Fedora](https://www.microsoft.com/store/apps/9n6gdm4k2hnc) [Alpine](https://www.microsoft.com/store/apps/9p804crf0395) 等。鉴于大家使用最多的就是 Ubuntu，下面就显示如何安装 Ubuntu，根据上面的链接，打开 Microsoft Store，然后选择 **获取** 按钮。

![](/images/install_wsl_ubuntu.png)

**图 1.2.1**

> 由于我已经安装了 Ubuntu 20.04，所以这里使用的 Ubuntu 18.04 的展示界面截的图。

安装完成后，可以从开始菜单中找到 Ubuntu 的快捷方式，点击打开后第一次运行，会要求输入用户名、密码，等待几分钟后初始化完成，以后就可以直接点击快捷方式进入 Ubuntu 系统了。

### 1.3 安装 docker desktop

docker desktop 基于 WSL2，所以要完成 1.1 小节所有的安装步骤，否则安装完成后无法启动。docker desktop 的安装包可以从官网下载 https://www.docker.com/products/docker-desktop 。

### 1.4 docker desktop 下配置 kubernetes

Windows 下可以从 Docker Desktop 中直接开启 kubernetes 功能，它会通过创建 docker 容器的模式来提供 kubernetes 服务，不过由于众所周知的原因，其容器用到的镜像在国内无法下载，你需要使用这个 [k8s-for-docker-desktop](https://github.com/AliyunContainerService/k8s-for-docker-desktop) 项目提供的解决方案。

我们在设置里找到当前 docker-desktop 的版本

![](/images/docker_desktop_k8s.png)

**图 1.4.1**

笔者安装的是 1.21.5 版本，clone 一下 k8s-for-docker-desktop 项目，切换到 v1.21.5 分支

```shell
git clone https://github.com/AliyunContainerService/k8s-for-docker-desktop.git
git checkout v1.21.5
.\load_images.ps1
```

**代码 1.4.1**

接着还是在项目 k8s-for-docker-desktop 目录中，执行下述命令来配置 kubernetes 控制台：

```shell
kubectl create -f kubernetes-dashboard.yaml
kubectl proxy
```

**代码 1.4.2**

`kubectl proxy` 命令，会输出如下提示 `Starting to serve on 127.0.0.1:8001`，说明启动控制台成功，然后你需要在浏览器中访问下面地址

http://localhost:8001/api/v1/namespaces/kubernetes-dashboard/services/https:kubernetes-dashboard:/proxy/

这个地址会提示输入 token，在 Windows 中 token 可以通过在 powsershell 中执行如下命令获得：

```powershell
$TOKEN=((kubectl -n kube-system describe secret default | Select-String "token:") -split " +")[1]
kubectl config set-credentials docker-for-desktop --token="${TOKEN}"
echo $TOKEN
```

## 2 问题总结

### 2.1 Win10 下 WSL2 预留端口

win10 下的 wsl2 默认会预留若干端口，导致我们程序中无法再使用这些端口做监听，在启动时程序会报错误 `listen EACCES: permission denied`，通过命令 `netsh interface ipv4 show excludedportrange protocol=tcp` 可以查看哪些端口被占用了。

### 2.2 WSL2 下运行 docker 命令提示无权限

运行 docker 命令后提示 `Got permission denied while trying to connect to the Docker daemon socket at unix:///var/run/docker.sock`，则证明当前运行 docker 命令的用户不是 root 用户，需要加 sudo 来运行。

### 2.3 docker 命令在 WSL2 中找不到

在 WSL 命令行中执行 docker 命令，如果有如下输出，则证明 docker desktop 中没有开启对于当前 WSL 系统的支持。

```
The command 'docker' could not be found in this WSL 2 distro.
We recommend to activate the WSL integration in Docker Desktop settings.

See https://docs.docker.com/docker-for-windows/wsl/ for details.
```

需要手动开启一下，找到  **Resources** >  **WSL Integration**，选中 **Enableinteration with my default WSL distro**， 如果这个复选框已经处于选中状态，说明当前你用的 WSL 系统不是默认的 WSL 系统，可以通过 `wsl --set-default <distro name>`，或者在下面的 **Enable integration with additional distros** 中选中你使用的系统。最后选择 **Apply & Restart** 按钮即可，更加详细的说明参见[官方文档](https://docs.docker.com/desktop/windows/wsl/#install)。

![](/images/enable_docker_for_wsl.png)

**图 2.3.1**

### 2.4 无法从私有镜像仓库拉取镜像

拉取私有镜像仓库时提示如下错误：

```
 => ERROR [internal] load metadata for private-registry-domian:port/image-name:latest                                            0.0s
------
 > [internal] load metadata for private-registry-domian:port/image-name:latest:
------
failed to solve with frontend dockerfile.v0: failed to create LLB definition: failed to do request: Head https://private-registry-domian:port/image-name/manifests/latest: http: server gave HTTP response to HTTPS client
```

究其原因是由于私有镜像仓库没有启用 https 文件，需要更改 docker 的配置文件，让其信任私有的镜像仓库。在 在 Docker Desktop 中，需要在设置界面中进行修改

![](/images/insecure_registries.png)



在 `insecure-registries` 数组中添加公司的镜像仓库根地址。

### 2.5 WSL2 无法启动

启动时显示错误 **0x80070003** 或错误 **0x80370102**，这种情况一般出现在新出厂的电脑上，或者 BIOS 升级后的电脑上，很多品牌电脑的 BIOS 默认关闭了 CPU 的虚拟化功能，需要进入 BIOS 自己手动开启，然后才能启动 WSL2。

### 2.6 WSL2 内的 DNS 不稳定

wsl2 算是新出的技术，很多方面并不稳定，DNS 解析也隔三岔五会出现问题。通过查看 /etc/resolv.conf 发现里面配置的是一个内网 DNS 服务地址

```
# This file was automatically generated by WSL. To stop automatic generation of this file, add the following entry to /etc/wsl.conf:
# [network]
# generateResolvConf = false
nameserver 172.29.48.1
```

如果你使用 WSL 的时候，只解析公网域名的话，比较简单，直接改成公网的域名服务地址即可，比如说 114.114.114.114 ；不过如果你有解析内网域名的需求话，也可以将其改成你的内网 DNS 的服务地址。但是如果你的电脑是移动电脑，同时会在内网环境下和外网环境下都使用，那么配置成内网 DNS 的话，出了内网就没法解析域名了(当然你可以通过播 VPN 来解决，不过那样会比较麻烦)。这个时候就需要派上我们的 Dnsmasq 这个工具了，它是一个 DNS 分流工具，可以根据不同域名后缀来使用不同 DNS server 进行解析。以下的教程同样以 Ubuntu 为例进行讲解。

> 类似的工具还有好多，比如 [CoreDns](https://coredns.io/) 这个工具也能实现 DNS 分流的工作。

首先我们需要卸载 systemd-resolved，这个程序默认会占用 53 端口，跟我们的 Dnsmasq 是冲突的。

```shell
sudo systemctl disable systemd-resolved 
sudo systemctl stop systemd-resolved
```

按理来说，我们需要修改 /etc/resolv.conf 文件，不过在 wsl 中 /etc/resolv.conf 默认会在 WSL 启动的时候被重写，所以需要先修改 /etc/wsl.conf 文件。这个文件默认不存在，所以不存在的时候，可以创建一个：

```
[network]
generateResolvConf = false
```

> 修改完配置后，还需要在 Windows 命令中执行 `wsl.exe --shutdown`，然后重新打开 wsl 命令行才能生效。

接下来运行 `sudo apt-get install dnsmasq` 来安装 Dnsmasq ，安装完之后，会生成一个 /etc/dnsmasq.conf  文件。我们可以在其最后追加一行配置

```
conf-dir=/etc/dnsmasq.d/,*.conf
```

 这样我们自定义的域名配置，就可以都放在 /etc/dnsmasq.d 目录下，在这个目录下创建一个文件 mydns.conf ，然后写入如下配置

```
server=/your_inner_domian/your_inner_dns_server
server=/your_inner_domian/::
server=119.29.29.29
server=223.5.5.5
```

上面配置文件的第一行代表如果要解析的域名中包含 your_inner_domian 字符，则使用 dns 服务器 your_inner_dns_server 进行解析。这是一个子字符串匹配，不论你的域名为 `your_inner_domian.com` 或者 `your_inner_domain.net`，使用 your_inner_domian 都可匹配成功。 如果你的 your_inner_dns_server 不支持 ipv6，记得要加入第二行配置，它是用来禁用 ipv6 dns 解析用的（如果你的内网 DNS 服务器不支持 ipv6 协议的话，这个配置特别有用），不过这个功能仅支持 dnsmasq 2.80 及以上版本（使用 Ubuntu 20.02 安装的 Dnsmasq 是 2.80 版本，可以放心使用）。最后一行是留一个默认的 DNS 服务器（`119.29.29.29` 是腾讯的公共 DNS，`223.5.5.5` 是阿里的公共 DNS，这里之所有没有使用常用的 114 DNS，是由于它解析国外域名的时候，经常会失败），用来解析公网域名。

配置完成后，修改 /etc/resolv.conf，将里面的 `nameserver` 修改为 `127.0.0.1`。最后执行  `service dnsmasq start` 来启动 dnsmasq，就可以测试我们的配置了。执行 `dig baidu.com`，正常情况下会有如下输出：

```
; <<>> DiG 9.16.1-Ubuntu <<>> baidu.com
;; global options: +cmd
;; Got answer:
;; ->>HEADER<<- opcode: QUERY, status: NOERROR, id: 56800
;; flags: qr rd ra; QUERY: 1, ANSWER: 2, AUTHORITY: 0, ADDITIONAL: 1

;; OPT PSEUDOSECTION:
; EDNS: version: 0, flags:; udp: 4096
;; QUESTION SECTION:
;baidu.com.                     IN      A

;; ANSWER SECTION:
baidu.com.              200     IN      A       220.181.38.148
baidu.com.              200     IN      A       220.181.38.251

;; Query time: 0 msec
;; SERVER: 127.0.0.1#53(127.0.0.1)
;; WHEN: Mon Sep 13 14:52:44 CST 2021
;; MSG SIZE  rcvd: 70
```

上面输出中 `ANSWER SECTION` 中列出来了解析出来的 IP，代表解析成功。同样执行 dig 内网域名，也能被正常解析则证明配置正确。

最后需要说明的是 wsl 不好做 service 的开机自启动，下次启动后需要手动执行 `sudo service dnsmasq start` 才能启动 dnsmasq 。这样就显得不是很友好，可以修改 /etc/resolv.conf，在 `nameserver 127.0.0.1` 的后面再追加一行 `nameserver 119.29.29.29` 这样 dnsmasq 没有启动时，可以保证公网域名能解析。



