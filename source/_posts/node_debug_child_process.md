---
abbrlink: node
title: node中调试子进程
date:  2014-07-31
description: 解决intellij idea中无法调试fork出来的子进程问题
typora-root-url: ..\
---

现在node.js在单步调试中做的最好的，就要数intellij idea了，但是node在使用cluster的时候，无法开启调试，stackoverflow上有对这个问题的描述与解答（点击[这里](http://stackoverflow.com/questions/16840623/how-to-debug-node-js-child-forked-process)查看）。但是这里要将的解决方案确实通过增加启动参数控制，摒弃多进程模式来实现调试，比如说在本地测试的时候启动单进程，在运营环境中使用多进程。

node.js中可以读取环境变量，使用方法为`process.env.环境变量名`，也就是说可以通过下列方式来控制是否启用多进程：


	if (process.env.DEBUG_LOCAL == 'true') {
	    //单进程代码处理
	} else {
	    //cluster代码处理
	}
**代码1.1**

剩下的就是在idea中配置环境变量了，点击调试的配置功能，即点击图1.1位置。  
![选择配置](/images/edit_config.jpg)  
**图1.1 选择配置**

在打开的界面中点击环境变量配置功能按钮  
![配置界面](/images/set_env_show.jpg)  
**图1.2 配置界面**

添加一个环境变量  
![添加环境变量](/images/add_env.jpg)  
**图1.3 添加环境变量**  

至此完成配置，点击调试后，就会将当前的代码运行成单进程，在生产环境中不加环境变量启动，则运行到正常的cluster代码中。