---
abbrlink: micro-reform-milestones
title: 微服务改造心路历程
date:  2022-02-20
description: 本文讲述了在笔者在直播间项目组工作时，践行微服务过程中的一系列趟坑的心路历程。
typora-copy-images-to: ..\images
typora-root-url: ..
categories:
- Micro Service
---

## 1. 改造前现状

直播间逻辑服务，包含了直播间内答题互动、聊天、抢红包等消息的逻辑处理。刚开始设计的时候，所有的消息混在一起处理，后来为了给优先级高的请求让路，逻辑服务后期根据消息类型拆分成了三类服务，很长一段时间内逻辑服务的拓扑结构是这样的：

![](images/current_service_cell.png)

**图 1.1 基于优先级的服务拓扑结构**

> 本教程原始链接：https://blog.whyun.com/posts/micro-reform-milestones/ ，转载请注明出处。

不过随着业务的深入发展，具体到某一个消息类型的处理流程可能会越来越复杂。拿答题上报来说，我们第一版的流程是这样的：

![](images/answer_report_flow1.png)

**图 1.2 第一版的答题上报流程**

不过随着后期需求的改进增加了以班组为单位的答题正确率的排行榜、学生在班组内的答题时间排行榜、学生在直播间内的答题时间排行榜等需求，流程图就变成了这个样子：

![](images/answer_report_flow2.png)

**图 1.3 第二版答题上报流程**

最近答题的需求还要进行改进，增加诸如给连续答对的用户打标签的逻辑，这样最终演变的逻辑将会比 **图 1.3** 中的流程更加复杂，这样就会导致答题处理的后端代码越来越臃肿，难以为继。

## 2. 初步改造方案

重新分析一下答题上报流程，以上报者的视角来看，其实只关心上报是否成功，至于各个选项、各种人数的统计，上报者自身并不关心。将上报流程再次进行一次抽象，那么数据处理的答题分为两类：一类是学生自己关心的，比如说是否重复答题、同班同学都在学的提示语；一类是老师关心的，比如说各种统计。根据这个思路我们可以在答题流程中仅仅处理学生关心的流程，然后将统计处理丢到另外一个服务中进行处理。基于这个思想对现有服务拓扑结构做改造：

![](images/future_service_cell.png)

**图 2.1 未来的服务器拓扑结构**

## 3. 演进过程

首先的挑战是重构带来的时间成本，第二个就是新增服务后，维护成本会上升。同时由于对微服务的理解不是很完善，当中也历经了几次比较大的改进过程。

### 3.1 全部使用消息队列进行通信

![](images/all_kafka.png)

**图 3.1.1**

> 图中 logical 代表逻辑服务，micro 代表微服务，下同。

由于做微服务的初衷是将可以异步处理的部分抽离出来，所以很容易想到的就是在 logical 和 micro 之间假设一个消息队列。考虑一个答题连对的场景

![](images/right_continue_flow.png)

**图 3.1.2**

一个老师触发答题时，logical 服务要做三个动作，发送开始答题消息到micro、给老师端答题响应、广播消息给学生，学生端收到广播后进行答题，如果答题正确服务器端会下发连对的提醒。正常情况下，这个时序是没有问题的，但是由于我们 logical 和 micro 之间使用的是异步通信，理论上 `2.1` 和 `2.3` 的时序是不能得到保证的。这个服务在上线后也遇到了问题，在极小概率下，用户答对了题，但是连对却没有出现，究其原因就是因为 `2.1`这一步出现了延迟。

### 3.2 引入 RPC

将 `2.1` 步做成带有事务的 grpc 调用，等待当前调用返回数据时，再触发 `2.2` 和 `2.3` 步。这样解决了异步操作没有事务的问题。看上去一切都很完美了，但是随着业务的迭代，微服务越来越多，可能老师端做一个操作的时候，流程变成这样。

![](images/add_rpc.png)

**图 3.2.1 引入rpc**

细品这个流程，其实跟 **图 1.3** 会面临同样的问题，请求处理函数代码会越写越长，最终难以维护。

### 3.3 引入消息总线

后来总结了一下，一个上行消息到达后，我们通知各个微服务的请求的数据内容其实是相同的，这时候其实可以直接引入一条消息总线，会让代码简洁很多。微服务只需要监听自己关心的消息总线即可。

![](images/add_event_bus.png)

**图 3.3.1**

不过这样同样会导致一个问题，就是数据流重新回到了类似使用消息队列的模式，所有的 logical 和 micro 之间的通信又变成了异步的了。目前解决的方法就是在微服务端增加 **待处理** 队列，如果在一个事务中学生的消息先到，就先先加入待处理带队中，等待老师的消息到来后，一并处理。





