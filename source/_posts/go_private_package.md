---
title: go 私有化包构建路
date:  2021-09-18
description: 使用私有托管的 go 包仓库的折腾之路
abbrlink: go-private-package
---

一般学习一门新的编程语言的时候，都要顺便学习一下它的包管理知识。go 语言起步的时候，包管理还比较粗糙，从 1.11 版本开始逐步引入 GO Module 机制，通过设置环境 `GO111MODULE=on` 来开启其支持，从 1.16 开始这个环境变量默认为 `on`。如果不确定可以通过 `go env | grep GO111MODULE` 来查看下。

按理来说通过 go get 就能下载托管在 github 上的包，但是很多时候，我们想将自己的某一部分代码抽离出来做成一个包，但是这部分代码又不能公开，最适合就是托管到公司代码仓库上去，比如说 gitlab。那么从私有镜像仓库下载 go 包，就成为一个特别紧迫的需求。

## 1. git 配置
其实 go 官方是支持这种功能的。假设你公司的 gitlab 域名为 gitlab.your-company.com ，首先我们要设置环境变量 `GOPRIVATE`，通过命令 

 `go env -w GOPRIVATE=gitlab.your-company.com` 

**代码 1.0**

即可设置完成。然后就是配置 git 授权，让 go 能够正确的从 git 仓库中下载源代码。go 默认使用 https 协议来跟 git 服务器通信，所以通过再 .netrc 文件（此文件在 HOME 目录下，Linux 下在 $HOME 中，Windows 下在 %USERPROFILE% 中）中增加如下配置，可以让 go 可以跟 git 服务正确的通信。

```
machine gitlab.your-company.com
login 你内网 gitlab 的用户名
password 你内网 gitlab 的密码
```
**代码 1.1**

然后大家 git 的惯用用法是使用 ssh 模式跟 git 服务器通信。所以单独配置一个 https 的访问模式显得不伦不类，可以使用 git 自带的 url 替换配置，强制让 go 在跟 git 服务器端通信的时候，修改 .gitconfig 文件（此文件在用户根目录下，Linux 下在 $HOME 中，Windows 下在 %USERPROFILE% 中）就能达到这种目的。

```
[url "git@gitlab.your-company.com:"]
    insteadOf = https://gitlab.your-company.com/
```

**代码 1.2**

如果你的 git 服务器使用的端口号并不是标准的 22 端口，你可能对于上述配置比较疑惑，为何配置中不需要加端口号呢，其实一个默认的 ssh 格式的 git 链接是这种格式的 git@github.com:yunnysunny/nodebook.git 这里拿 github 上的一个项目举例，其中 yunnysunny 为账号，nodebook 为项目名。假设 git 没有开启默认的端口 22 作为 ssh 访问端口，而是使用 1234 的话，我们的 ssh 地址应该是这样子：git@github.com:1234/yunnysunny/nodebook.git，也就是说  git@github.com: 是固定格式，那端口号的配置从哪里获取呢，答案是 .ssh 目录（此目录在 Linux 下在 $HOME 中，Windows 下在 %USERPROFILE% 中）下的 config 文件，如果你的 git 服务开启的是 1234 的，应该会有如下配置

```
Host gitlab.your-company.com
  Hostname gitlab.your-company.com
  User 你内网 gitlab 的用户名
  IdentityFile ~/.ssh/私钥文件
  Port 1234
```

**代码 1.3**

git 程序最终在 config 这个文件中读取的端口号，你也可以通过 `ssh -vT gitlab.your-company.com` 来手动验证这个过程，不出意外的话，最终会有如下输出：

```
Welcome to GitLab, @你内网 gitlab 的用户名!
debug1: client_input_channel_req: channel 0 rtype exit-status reply 0
debug1: client_input_channel_req: channel 0 rtype eow@openssh.com reply 0
debug1: channel 0: free: client-session, nchannels 1
```

## 2. 编写模块

在内网 gitlab 上你的账号域下创建一个 mod-test 的项目，然后我们就得到了这么一个项目 http://gitlab.your-company.com/your-account/mod-test 其中 your-account 为你的内网 gitlab 账号名。

接着在本地任意目录中执行

```
git clone ssh://git@gitlab.your-company.com:your-account/mod-test
```

然后进入文件夹 mod-test，执行 

```
go mod init  gitlab.your-company.com/your-account/mod-test
```

其中 your-account 为你的本地 gitlab 账号

接下来就是写一个测试模块

```go
package main
import (
    "fmt"
)
func MyShow(param string) {
    fmt.Println("the param is", param)
}
```

**代码 2.1 my.go**

我们将代码 push 到本地 gitlab，然后打一个 tag，起名 v0.0.0。

接着写一个测试用的项目来引用这个 mod-test 模块，新建目录 use-mod，进入后执行 `go mod init use-mod`。接着我们使用命令 `go get gitlab.your-company.com/your-account/mod-test` 来安装依赖包，然后会翻车：

```
go get: unrecognized import path "gitlab.your-company.com/your-account/mod-test": parse https://gitlab.your-company.com/your-account/mod-test?go-get=1: no go-import meta tags (meta tag gitlab.your-company.com:1234/your-account/mod-test did not match import path gitlab.your-company.com/your-account/mod-test)
```

顺蔓摸瓜 ，`curl  https://gitlab.your-company.com/your-account/mod-test?go-get=1` 会发现他有如下输出：

```html
<html><head><meta name="go-import" content="gitlab.your-company.com:1234/your-account/mod-test git http://gitlab.your-company.com:1234/your-account/mod-test.git" /></head></html>
```
究其原因应该是由于我们公司的 gitlab 搭建在 docker 中，内部端口开启的是 1234，然后内置一个 nginx 做反向代理，nginx 对外开放 80 和 443。

如果你使用的内网 gitlab 没有这种幺蛾子，刚才的操作就已经成功了。如果你非要在这种模式下使用，也不是没有办法，只不过步骤会复杂些。首先我们手动编辑 use-mod 项目中的 go.mod:

```
module use-mod

go 1.17

require gitlab.your-company.com/your-account/mod-test v0.0.0

replace gitlab.your-company.com/your-account/mod-test v0.0.0 => gitlab.your-company.com/your-account/mod-test.git v0.0.0
```
**代码 2.2**

然后编写我们的 go 代码

```go
package main

import (
	"fmt"
	"gitlab.your-company.com/your-account/mod-test"
)

func main() {
	fmt.Println("begin");
}
```
**代码 2.3**

执行 `go mod tidy` 发现依赖包终于可以正常下载了，不过执行 `go run test.go` 又报错了：

```
test.go:5:2: import "gitlab.your-company.com/your-account/mod-test" is a program, not an importable package
```

我们不能 import 一个 module 中 main 包中的代码，需要修改项目 mod-test，新建一个文件夹 my，把 **代码 2.1** 移动到 my 文件夹，然后修改第一行为 `package my`。

重新对项目 mod-test 打 tag ，tag 名字为 `v0.0.1`，然后修改 **代码 2.2** ，将里面的版本号相应的改为 `v0.0.1`。

修改 **代码 2.3** 改为如下：

```go
package main

import (
	"fmt"
	"gitlab.your-company.com/your-account/mod-test/my"
)

func main() {
	my.MyShow("bcd")
	fmt.Println("begin");
}
```

**代码 2.4**

执行 go mod tidy 来安装依赖包，然后执行 go build 就能正常生成的可执行程序。

## 3. 总结

通过 **代码 1.0** 设置完 GO_PRIVATE 环境变量之后，go 在下载前缀符合 GO_PRIVATE 值的 module 的时候，会尝试请求地址 https://gitlab.your-company.com/your-account/your-mod-name?go-get=1 ，正常情况下会返回如下格式

```html
<html><head><meta name="go-import" content="gitlab.your-company.com/your-account/your-mod-name git http://gitlab.your-company.com/your-account/your-mod-name.git" /></head></html>
```

**代码 3.0**

返回的**代码 3.0** 中，如果域名后面没有跟端口号，是比较简单的，调用者直接使用 `go get gitlab.your-company.com/your-account/your-mod-name` 进行安装就行。但如果含有端口号，则需要手动编辑调用项目的 go.mod 文件，保证有如下 **代码 3.1** 配置，然后通过 go mod download 或者 go mod tidy 安装（后者需要起码在代码中有一处 import 该私有 module 中包的声明）

```
# 这里假设你使用的版本号为v0.0.0
require gitlab.your-company.com/your-account/myour-mod-name v0.0.0

replace gitlab.your-company.com/your-account/your-mod-name v0.0.0 => gitlab.your-company.com/your-account/your-mod-name.git v0.0.0
```

**代码 3.1**

由于在 **代码 3.0** 中指示了 go 要使用 git 方式下载代码，所以要正确的使用 **代码 1.1** 或者 **代码1.2** 做配置，保证 go 能过正常和 git 服务器做通信。

最后需要留意的是，你的调用某一个 module 时，只能调用其非 main 包中的代码。

> 初学者还容易搞混的一个概念，就是 go 中的 module 和 package 的概念，使用 go get 下载的单元为一个 module，在代码中调用的时候，是调用 module 中的某一个 package。换句话说，就是一个 module 可以包含多一个 package （每个 package 的代码放置在同一个文件夹中）。 

## 4. 其他问题

如果在下载私有 module 的时候，出现如下问题：

```
go mod download: gitlab.your-company.com/your-account/mod-test.git@v0.0.3: invalid version: git ls-remote -q origin in /root/go/pkg/mod/cache/vcs/49e4f4ef52d3227f1c09bb8a8db5321ccf5cd277662d5a9ad607ffd2ff57b32d: exit status 128:
        fatal: unable to connect to gitlab.17zuoye.net:
        gitlab.your-company.com[0: 192.168.1.10]: errno=Connection refused
```

通过提示信息上来看是版本号找不到，但是真实的原因可能并不如此。需要做两方面的检查，一方面确认 git 仓库上是否有 `v0.0.3` 这个 tag；另一方面也需要确认当前系统中配置的 ssh 私钥（**代码 1.3** 中的配置）是否有访问 mod-test 这个项目的权限，如果没有权限，同样会报 `invalid version` 这个错误。

