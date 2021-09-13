---
abbrlink: /
title: 同步和异步回调
date:  2015-02-18
description: 同步和异步API的设计指南
---

# 同步和异步回调
*作者：havoc (原文地址：[http://blog.ometer.com/2011/07/24/callbacks-synchronous-and-asynchronous/](http://blog.ometer.com/2011/07/24/callbacks-synchronous-and-asynchronous/))*

这里讲两个使用callback设计API的指南，并且添加到我的杂记[posts about minor API design points](http://blog.ometer.com/2011/01/20/boolean-parameters-are-wrong/ "作者显然是贴错地址了，译者注")中。我之前多次在不同的场合发起过关于“sync vs. async”回调的问题。这个问题着实困扰着API设计者和使用者。  
最近，这个问题在我处理[Hammersmith](https://github.com/bwmcadams/hammersmith)（一个基于callback回调的MongoDB的Scale API）又被提起。我认为这（这里指基于回调的API，译者注）对大量的JVM代码编写者来说稍微有些 *不习惯（new consideration）* ，因为传统的JVM使用堵塞API和线程。对于我来说，已经很熟悉编写基于[事件循环](https://developer.gnome.org/glib/unstable/glib-The-Main-Event-Loop.html)的客户端代码。
## 介绍
- 一个**同步（synchronous）**回调在函数返回之前执行，也就是说， *当API在调用时callback也处在上下文中(这句话的原文是：while the API receiving the callback remains on the stack)* 。例子可以是这样的：`list.foreach(callback);`在`foreach()`返回时，你可以预期到callback已经在所有元素上都被执行了。
- 一个**异步（asynchronous）**或者**延迟（deferred）**回调，在函数返回之后执行，或者至少在另一个线程的栈空间中执行。延迟（deferral）的架构包括线程和主循环【main loops】(其他名字包括event loops,dispatchers,executors)。异步回调在IO相关的API中很流行，例如`socket.connect(callback);`，你会预期在`connect（）`返回时，callback可能还没有被调用，因为他正在等待连接建立完毕。
## 指南
基于过往经验，我使用这两条规则：

- 给出的回调不能一直是同步的或者异步的，而是应该将其作为API文档的一部分加以说明。
- 异步回调需要被主循环中或者 *中心分发组件（central dispatch mechanism）* 直接调用，也就是说，别在回调执行的栈中存在非必须的代码块，特别是这些代码块可能含有锁的时候。

## 同步回调和异步回调有啥不同？
同步和异步回调对于包括app和类库在内的开发者造成问题是不一样的。  
同步回调：
  
- 在 *原始（original）* 线程中执行（触发回调和回调执行是一个线程，这里原始线程被指做回调触发的线程，译者注），所以自身不需要关心线程安全。
- 在类C/C++语言中，可以读取存储在栈上的数据，比如说本地变量。
- 在任一语言中，他们可以访问绑定到当前线程上的数据，比如说thread-local类型变量。比如许多java web框架在当前事务或者请求中创建thread-local类型的变量。
- 可以假定某些应用程序的状态不变，比如说对象存在、定时器没有被触发、IO访问没有发生，或者任一一个程序关联的结构的状态。
异步回调：

- 可能会在另一个线程（在基于线程的异步架构中）中被调用，所以应用需要使回调同步访问的任意一个资源。
- 不能访问任意一个 *原始* 堆栈或者线程，比如说局部变量或者thread-local类型数据。
- 如果 *原始* 线程中持有锁，那么回调应在锁的外面被调用。
- 需要假定其他的线程或者事件可能已经修改了应用程序的状态。

不能说哪个回调方式更好，都有其优点。试想一下：  
`list.foreach(callback)`  
大多数情况下，如果callback被延迟调用并且在当前线程中没有做任何操作，你可能会十分惊讶。  
但是：  
`socket.connect(callback)`  
如果不延迟调用callback就显得完全没有意义了，为啥要设置一个callback呢？  
这两个例子告诉我们为什么一个给出的回调要被定义为同步或者异步，它们是不可以互换的，同时也拥有不同的用途。
## 选择同步或者异步，但是不能同时使用
显而易见，可能在某些场景中需要立即执行回调（当数据已经准备好了情况），在另外一些场景回调需要延迟调用（socket没有准备好的情况）。一个很诱人的做法是，在可能的情况下同步执行回调，在另外的情况的异步执行。但是不是一个好想法。  
因为同步和异步拥有不同的规则，他们产生不同的bug。在测试环境下触发异步回调，但是生产环境的某些不常见场景下，按照同步来运行了，是很典型的。  
要求应用程序开发者同时对同步和异步情况进行规划和测试是很困难的，所以最简单的就是用库函数来实现：**如果一个回调在某些情况下延迟支持，那么一直使用延迟的方式**。
## 例子：GIO
在GIO库中的[GSimpleAsyncResult文档](http://developer.gnome.org/gio/unstable/GSimpleAsyncResult.html)有一个针对当前问题的典型例子，直接滑过描述章节，看异步烘烤蛋糕的例子。（GSimpleAsyncResult可以等同于一些框架中的future或者promise。）这个类中提供了两个方法， [complete_in_idle() ](http://developer.gnome.org/gio/unstable/GSimpleAsyncResult.html#g-simple-async-result-complete-in-idle)函数将回调交由一个“空闲句柄”（ *是一个立即调度的一次性事件循环，原文是：just an immediately-dispatched one-shot main loop event* ）来延迟调用；普通的[complete()](http://developer.gnome.org/gio/unstable/GSimpleAsyncResult.html#g-simple-async-result-complete)函数同步触发回调。文档中建议，尽量使用complete_in_idle()，除非你知道你已经处在一个没有持有任何锁的回调中（也就是说，你正好处在从一个异步回调到另一个函数的调用链上，那就没有必要再做异步处理了）。  

GSimpleAsyncResult旨在实现类似于[g_file_read_async()](http://developer.gnome.org/gio/unstable/GFile.html#g-file-read-async " g_file_read_async()")这种IO API，开发者可以假定所有使用这些API的回调都是异步的。

GIO使用这种方式并且在文档中强制声明出来，因为开发者开发的时候曾经（因为文档不明确，译者注）备受煎熬。

## 同步资源需要延迟运行所有它们触发的回调函数
事实上，这个规则是说，一个类库需要在回调触发之前释放掉它持有的所有锁。释放掉所有锁的最简单的方式就是使回调异步，延迟调用它直到上下文回到主循环或者在另一个线程的上下文中调用它。(也就是说在当前上下文环境中所有代码——包括释放掉锁的代码——执行完毕，然后才在主循环或者另一线程中执行回调，译者注)

这一点很重要，因为不能预计到应用程序不在回调内部接触你的API。如果你持有锁并且程序（在回调内部，译者注）接触到了你的API，程序就会死锁。（或者如果你使用递归锁，你同样会遇到可怕的问题。）

与其将回调延迟到主循环或者线程中，同步的资源可以尝试释放掉它所有的锁；但是他是**非常**痛苦的，因为锁可能恰好在上下文中，你最终需要使每个上下文中的函数返回回调函数，将回调函数一直留存给最外部锁的持有者，然后释放掉锁并且触发回调。呸。
## 例子：不使用Akka的Hammersmith
在前面提到的Hammersmith中，下面给出的伪码会产生死锁：

	connection.query({ cursor => /* iterate cursor here, touching connection again */ })

遍历游标时会反过来访问MongoDB的connection。在connection对象的代码中触发query的回调函数...，而这个connection对象还持有连接锁。虽然不能正常工作，但是这种代码对于开发者来说是很顺手的。如果一个类库不延迟调用回调函数，应用开发者需要自己延迟调用它。大多数应用开发者在开始的时候都会出错，一旦他们捕获到错误并且修正，他们的代码就会被一些异步架构搞的乱七八糟。

Hammersmith从Netty中继承了这个问题，Netty也是这样使用connection的；Netty没有试图去延迟调用回调函数（我可以立即这种行为，毕竟在java中没有一个明确的 默认/标准/通用/有效 方式来延迟调用回调函数）。

起初，我对它的修正是添加[一个线程池来运行程序的回调](https://github.com/havocp/hammersmith/commit/48c6d4b486357d9af17bf4ee5f8042a4944c41bf)。不幸的是，这个推荐的和Netty一起使用的线程池类并没有解决死锁问题，[我只能接着修复它](https://github.com/havocp/hammersmith/commit/16fb3103851af00d6aa7780c182169e68c41aa45)。（所有解决死锁问题的线程池都得拥有无限的容量和资源……）

最终它终于能用了，但是想想一下，如果基于回调的API流行起来之后，每个jar包你都在它的API中使用回调函数，那么就必须拥有一个线程池。想想也是醉了。这很有可能就是为啥Netty在这个问题上要赌一把。在一个底层网络类库上太难做策略控制了。
## 例子：AKKA Actor
部分由于要寻找一个更有的解决方案，之后我将[Hammersmith](https://github.com/bwmcadams/hammersmith) 迁移到 [Akka](http://akka.io/) 上来。Akka实现了[Actor模式](https://zh.wikipedia.org/wiki/%E5%8F%83%E8%88%87%E8%80%85%E6%A8%A1%E5%BC%8F)。Actor是基于消息而不是基于回调的，一般来说消息还**必须**得是延迟发送的。事实上，Akka还特意强制你使用一个[ActorRef](http://akka.io/api/akka/snapshot/akka/actor/ActorRef.html)用来和actor进行通信，所有关联ActoRref的消息都经过一个dispatcher（事件循环）。假定你有两个actor进行通信，他们将使用`!`或者“发送消息”函数：

	actorOne ! Request("Hello")
	// then in actorOne
	sender ! Reply("World")
这些消息都通过事件循环进行分发的。我希望我的死锁问题能够在这种模式下得到解决，但是我在调用带有锁的回调函数时，还是遇到了小麻烦——同样的问题又被触发了。这次的锁是在actor处理消息时锁住actor本身。

Akka中的actor可以从其他actor或者从`Future`中接收消息，Akka将发送者封装在一个称作`Channel`的对象中。通过`!`来发送消息到一个actor时，就会将这个消息交给dispather来做延迟，但是发送到future就不会；因此，在API约定上，`Channel`上的`!`方法并没有决定是当前是使用同步还是异步。

那么问题来了，actor模式中的一个重点就是一个actor在同一时间内仅仅只能运行在一个线程中；actor在处理某个消息的时候是不允许另一个消息再进入的。因此，在actor外部产生同步调用是很危险的；在actor上有锁，如果同步调用时试图在回调中再次使用actor本身，就会产生死锁。

我将MongoDB connection包装成一个actor，立马就重现了和Netty中同样的死锁问题，也就是在query的回调中试图在遍历游标的时候再次访问connection。query的回调是由`!`方法在发送到future上时触发的。这个`Channel`上的`!`方法打破了我的第一条原则（它没有在API约定上定义成同步或者异步），但是我期望它能够一直都是异步的；结果我还意外的打破了我的第二条原则，触发回调时还持有锁。

如果是我，我将在API约定中吧`Channel.!`置为延迟，来修正这个问题；但是，正如Akka写的那样，如果你实现这样一个actor，发送回复，并且你程序的回复处理句柄想反回来重新使用actor本身，你必须手动延迟发送这些回复。我偶然间发现了这个实现方式，然而应该还有一个更好的实现方式：
	
	private def asyncSend(channel: AkkaChannel[Any], message: Any) = {
	    Future(channel ! message, self.timeout)(self.dispatcher)
	}

这个解决方案令人不爽的地方是，为了将回复交给future做异步处理，那么对于actor的回复就是两次异步了。

还好，对于Akka来说至少它**拥有**解决方案——使用dispatcher。如果使用纯Netty，我就不得不使用一个专门的线程池了。

Akka给出了“如何是回调异步”的答案，但是它还需要一些特殊用途的（special-casing）future来保证它们确实是异步的。  
（**更新：**Akka团队已经准备解决这个问题，[详情查看](https://www.assembla.com/spaces/akka/tickets/1054-complete-futures-asynchronously-when-replying-through-a-channel)。）

## 总结
相对于我发现的Akka的小麻烦，没有使用Akka的JVM环境下的情况将会更糟，因为这时是没有一个dispatcher可供使用的。  
**基于回调的API在有事件循环的时候会运行的很好** ，因为拥有异步触发回调的功能是很重要的。  
这也就是为啥在客户端javascript和[node.js](http://nodejs.org/)还有类似于[GTK+](http://www.gtk.org/)的UI组件库中回调运行的很完美。但是如果你在JVM中开始编写基于回调的API，就是没有默认解决方案的。你不得不借鉴一些事件循环类库（Akka工作的很好），或者重新造轮子，或者随处使用线程池。

鉴于基于回调的API如此的时髦……如果你准备写一个，我想前面的这个话题你也会遇到。打完收工。
