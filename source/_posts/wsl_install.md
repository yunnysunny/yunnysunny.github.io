---
abbrlink: wsl-and-docker-desktop-install
title: wsl 和 docker desktop 的安装教程
date:  2021-09-09
description: win10 中提供了 wsl 的解决方案，可以在 Windows 中直接开启 linux 子系统，十分方便开发者使用。同时一些重要的功能也要依赖于 wsl 才能启动，比如说 docker desktop。本教程就是演示一下如何在 win10 中配置 wsl ，并且如何正常使用 docker desktop。
typora-copy-images-to: ..\images
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

