---
abbrlink: node-desktop-hack
title: 独辟蹊径使用 node 开发桌面程序
date:  2023-02-25
description: 使用 node 作为 Windows service，提供 http 服务，然后用浏览器访问 http 服务来加载网页，来实现类桌面程序的使用效果。

categories:
- Node
---
## 1. 背景

一般使用node开发桌面程序会采用electron等技术栈，它们会将chromium内核直接打到最终的安装包中。但是很多情况下 我们的桌面程序比较简单 仅仅是完成一些增删改查之类的操作 逻辑代码量并不大 但是如果加一个chromium内核进来 安装包体积会陡增。这种情况下 不如考虑如下解决方案，将业务逻辑直接做到http服务中 然后通过网页访问http服务实现业务的增删改查，看上去这个解决方案是传统bs的解决方案，但是如果将http服务部署在本地呢？那么我们只需要在本地打开浏览器，就可以操作数据了。不过看上去 这么操作跟直接部署一个网站 然后用浏览器访问依然没啥区别。但是如果你操作的数据只在本地存储 不需要上传到云端 ，做一个网站显得太浪费资源；又或者你需要操作本地原生API和操作系统进行交互，做网站无法组成这种调用，这种本地http客户端就提现出来了优越性。

但是如果将这种模式演变为一个成熟产品时，有好多体验性优化需要处理。首先是node主进程 如何做到崩溃后自动重启。在windows中能够做到这种功能就是windows service。同时利用其可以做到 开机自启动的目的。

其中作为一个桌面程序 肯定需要有一个安装包 方便进行安装和卸载。这个可以通过 [nsis](https://nsis.sourceforge.io/Main_Page) 来实现。

## 2. nsis 脚本编写
一个最简单的安装包
> 为了实现后面的流程，你需要先下载安装 nsis 的[安装包](https://nsis.sourceforge.io/Download)。可以把安装后的目录追加到系统环境变量 PATH 中，这样我们就可以在命令行中调用 `makensis` 命令进行脚本编译。

首先创建一个空文件夹，随便起一个名字，这里叫 `first`，然后在其下新建文件 first.nsi，打开文件贴入如下代码：
```nsis
Section "First Program"
  SetOutPath $INSTDIR
  File "D:\node\node.exe"
SectionEnd
```
代码 2.1 first.nsi
在当前目录运行命令 `makensis .\first.nsi` 之后，会生成一个 first.exe 的安装包，这个安装包符合压缩文件的格式标准，右键选择使用 7zip 之类的解压缩软件可以打开看到里面有一个我们指定的 node.exe 文件。双击这个 first.exe 文件，就会弹出安装界面，一路点击下一步之后，就会把 node.exe 安装到当前安装包所在路径的磁盘根目录。比如说在 D 盘某个文件夹下运行 first.exe ，则会直接安装到 D 盘根目录。

单纯打包一个 node.exe 是不够的，我们还需要将我们的应用代码打包进去，安装到磁盘根目录也很不灵活，我们需要指定一个自己想要的路径：

```nsis
InstallDir "$PROGRAMFILES\my_program"
Section "My Program"
  SetOutPath $INSTDIR
  SetOverwrite ifnewer
  File "D:\node\node.exe"
  File /r app\*.*
SectionEnd
```
代码 2.2 second.nsi

我们在 app 目录中创建一个 express 项目，然后运行 `makensis .\second.nsi` ，重新打包生成一个 second.exe 文件，使用 7zip 打开这个文件后，可以看到压缩包中包含 app 文件夹中所有文件和 node.exe 文件。运行 second.exe 后，会将所有的文件安装到 C:\Program Files (x86)\my_program 文件夹下。

不过这样的安装包，安装完之后依然没法直接运行，我们还需要在里面添加启动脚本。新建一个 start.cmd 文件，
```bat
@echo off
"%~dp0/node" "%~dp0/src/bin/www.js" --name demo
```
代码 2.3 start.cmd

将其放到 app 目录下。

这样虽然添加了启动脚本，但是还是需要手动执行才行。











