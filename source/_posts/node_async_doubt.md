---
abbrlink: js
title: js异步之惑
date:  2015-03-20
description: 讲解js中异步的运行原理
categories:
- Javascript
---

## 1.异步是啥
与异步对应的就是同步，对于同步我们很好理解，就是代码顺序执行。但是一到异步代码，很多人多少有些理不清。异步，从功能上讲，就是在背后偷偷的执行，不堵塞当前运行的代码；从实现上讲，能够这么做的，就只能靠在当前运行代码中另一起线程或者进程了。举一个使用线程来实现异步的例子：


```java
public class MyAsync extends Thread {
	private volatile boolean done = false;

	public void run() {
		while (!done) {//子线程中的循环
			System.out.println("thread out x");
			try {
				Thread.sleep(500);
			} catch (InterruptedException e) {
				e.printStackTrace();
//				Thread.currentThread().interrupt();
			}
		}
	}

	public synchronized void setDone() {
		done = true;
	}

	public static void main(String argv[]) {
		MyAsync t = new MyAsync();
		t.start();//起子线程
		long last = System.currentTimeMillis();
		int count = 0;
		while(true) {//主线程中循环
			long now = System.currentTimeMillis();
			if (now - last > 1000 * 1) {
				last = now;
				count ++;
				System.out.println("the " + count + "th count.");
			}
			if (count > 2) {
				break;
			}
			
		}

		t.setDone();
	}
}
```
**代码1.1 线程示例**  
对于代码1.1的运行结果，有可能是这个样子的：  

	thread out x
	thread out x
	thread out x
	the 1th count.
	thread out x
	thread out x
	the 2th count.
	thread out x
	thread out x
	the 3th count.
代码27-38行起是主线程循环，7-15行是子线程循环，你多运行几次，就可以看出两个循环的输出是很随机的，但是不管运行多少次两个循环的输出都是交叉在一起的。这样我们就可以推断出，运行主线程的代码的时候，子线程的代码也在背后偷偷的运行，说白了两者是并行运行的。

## 2.js中的异步

就是因为异步这个特性，js如今被大家推崇，下面用一个小例子来演示一下js中异步的使用：  

```javascript
function synchronizedCode() {
	var last = new Date().getTime();
	var count = 0;
	while (true) {
		var now = new Date().getTime();
		if (now - last > 1000 * 2) {
			last = now;
			count++;
			console.log('the %dth count.',count);
		}
		if (count > 9) {
			console.log('exist while.');
			break;
		}
	}
}
(function() {
	setTimeout(function() {console.log('setTimeout 0 occured first.');},0);
	setTimeout(function() {console.log('setTimeout 0 occured second.');},0);
	
	synchronizedCode();
})();
```
**代码2.1 setTimeout的例子**  
我们运行代码2.1，然后不管运行多少次，输出都是这个样子的：

	the 1th count.
	the 2th count.
	the 3th count.
	the 4th count.
	the 5th count.
	exist while.
	setTimeout 0 occured first.
	setTimeout 0 occured second.
**输出2.1**  
跟java中的异步和同步代码会交叉输出相比，js中的异步其实是排好队输出的。由于js是单线程执行代码的，所以没有那种交叉输出的效果。那么还有一个问题，while循环明明运行了5秒钟，为何在这期间那两个setTimeout一直没有运行呢？这就和js代码的异步机制有关了。js代码中有帧的概念，对于同步代码是在当前帧运行的，异步代码是在下一帧运行的。对于代码2.1我们给代码运行画一幅图的话，应该是这样的：  
![js帧结构](https://blog.whyun.com/images/js_frame.png)  
**图2.1 js帧结构**  
那么为什么是第一个setTimeout先触发，第二个后触发呢，难道仅仅由于先后顺序？我们把第一个setTimeout改为`setTimeout(function() {console.log('setTimeout 0 occured first.');},100);`,那么输出的时候就会是先输出`setTimeout 0 occured second.`,在输出`setTimeout 0 occured first.`。也就是说在第二帧setTimeout的回调的执行顺序不仅与代码顺序有关还和延迟时间有关。  
在node.js中还有一个特殊的API，就是`process.nextTick`,虽然已经不推荐使用了，但是已经可以在很多代码中看到它的身影。例如如下代码：

```javascript
(function() {
	setTimeout(function() {console.log('setTimeout 0 occured first.');},0);
	setTimeout(function() {console.log('setTimeout 0 occured second.');},0);
	process.nextTick(function() {console.log('nextTick occured.');});
	
	synchronizedCode();
})();
```
**代码2.2**  
运行后输出：

	the 1th count.
	the 2th count.
	the 3th count.
	the 4th count.
	the 5th count.
	exist while.
	nextTick occured.
	setTimeout 0 occured first.
	setTimeout 0 occured second.  
**输出2.2**  
之所以nextTick排在所有异步的最前面，是由于nextTick是在第一帧运行的，而其他的都是在第二帧运行的。也就是说代码运行情况是这个样子的：  
![](http://blog.whyun.com/images/js_frame2.png)  
**图2.2 js帧结构**  
接下来再举几个异步API的例子，这次我们添加`setImmediate`和`mkdir`两个函数：

```javascript
var synchronizedCode = require('./sync');
(function() {
	setTimeout(function() {console.log('setTimeout 0 occured first.');},0);
	setTimeout(function() {console.log('setTimeout 0 occured second.');},0);
	process.nextTick(function() {console.log('nextTick occured.');});
	setImmediate(function() {console.log('setImmediate occured.')});
	
	var fs = require('fs');
	var crypto = require('crypto');
	var rand = crypto.pseudoRandomBytes(8).toString('hex');
	fs.mkdir('d:\\temp\\xx'+'\\'+rand,function(err) {
		if (err) {
			console.log(err,'错误',err.code);
		} else {
			console.log('create directory success.');
		}		
	});
	
	synchronizedCode();
})();  
```

**代码2.3**  
那么他的输出就应该是这样的：  

	the 1th count.
	the 2th count.
	the 3th count.
	the 4th count.
	the 5th count.
	exist while.
	nextTick occured.
	setTimeout 0 occured first.
	setTimeout 0 occured second.
	setImmediate occured.
	create directory success.  
**输出2.3**

等等，问题来了，这里最后一句才打印`create directory success`,那么是不是程序是在最后一步才创建的文件夹呢，如果真是这样，就有点低效了，起码这个创建文件的工作被那个while循环给延迟了得有5秒钟。不过幸好，这个想法是错误的！node.js中使用libuv来IO或者CPU计算量大的操作，而在libuv中处理这些耗时的操作都是用线程来解决，以避免堵塞住js线程（这一点和android的程序设计思路类似，android开发中使用子线程来处理耗时逻辑，避免对主线程造成卡顿）。这里我们来演示一个libuv的异步处理，在异步处理中模拟一个耗时操作：

```c++
#include <node.h>
#include <string>
#include <v8.h>
#include <nan.h>

#ifdef WINDOWS_SPECIFIC_DEFINE
#include <windows.h>
typedef DWORD ThreadId;
#else
#include <unistd.h>
#include <pthread.h>
typedef unsigned int ThreadId;
#endif
using namespace v8;

NAN_METHOD(async_hello);

static ThreadId __getThreadId() {
	ThreadId nThreadID;
#ifdef WINDOWS_SPECIFIC_DEFINE
	
	nThreadID = GetCurrentProcessId();
	nThreadID = (nThreadID << 16) + GetCurrentThreadId();
#else
	nThreadID = getpid();
	nThreadID = (nThreadID << 16) + pthread_self();
#endif
	return nThreadID;
}

static void __tsleep(unsigned int millisecond) {
#ifdef WINDOWS_SPECIFIC_DEFINE
	::Sleep(millisecond);
#else
	usleep(millisecond*1000);
#endif
}

class ThreadWoker : public NanAsyncWorker {
	private:
		std::string str;
	public:
		ThreadWoker(NanCallback *callback,std::string str)
			: NanAsyncWorker(callback), str(str) {}
		~ThreadWoker() {}
		//在该函数内模拟处理过程 ，如i/o阻塞或者cpu高消耗情形的处理。
		// 注意不能使用v8 api,这个线程不是在js主线程内
		void Execute() {
			printf("\n%s Thread id : gettid() == %d\n",__FUNCTION__,__getThreadId());
			for (int i=0;i<15;i++) {
				__tsleep(1000);
				printf("sleep 1 seconds in uv_work\n");
			}
		}
		void HandleOKCallback () {
			NanScope();

			Local<Value> argv[] = {
				NanNull(),
				NanNew("the result:"+str)
			};

			callback->Call(2, argv);
		};
};
NAN_METHOD(async_hello) {
    printf("\n%s Thread id : gettid() == %d\n",__FUNCTION__,__getThreadId());
    NanScope();
    if(args.Length() < 2) { 
    NanThrowError("Wrong number of arguments"); 
    NanReturnUndefined(); 
}


if (!args[0]->IsString() || !args[1]->IsFunction()) {
    NanThrowError("Wrong number of arguments");
    NanReturnUndefined();
}

// 强制转换成函数变量
NanCallback *callback = new NanCallback(args[1].As<Function>());
    NanUtf8String param1(args[0]);
    std::string str = std::string(*param1); 
    NanAsyncQueueWorker(new ThreadWoker(callback, str));
    NanReturnUndefined(); 
}

void Init(Handle<Object> exports) {
    exports->Set(NanNew<String>("async_hello"),
    NanNew<FunctionTemplate>(async_hello)->GetFunction());
}

NODE_MODULE(binding, Init);
```

**代码2.4**  
> 上述代码的编译参照[编译说明](http://git.oschina.net/yunnysunny/async-tutorial-code/blob/master/addon/readme.md "")，项目源码地址参加第3节。关于nan的使用，可以参照我的另一篇教程[《nan基础教程》](http://blog.whyun.com/posts/nan/)。

编写的测试代码，将其运行，就可以看出函数`Execute`根本就不在js线程中执行，也就是说它是可以和js线程并行的；函数`HandleOKCallback`中能够触发js中的回调函数，将处理完的结果交给js。下面就编译上面代码（需要node-gyp支持，执行`node-gpy rebuild`进行编译），来验证上述结论：  

```javascript
(function() {
	setTimeout(function() {synchronizedCode('timer1',3);},0);
	setTimeout(function() {console.log('setTimeout 0 occured second.');},0);
	process.nextTick(function() {console.log('nextTick occured.');});
	
	var addon = require('./addon/build/Release/binding');
	addon.async_hello("good",function(err, result) {
		console.log('node addon result',result);
	});
	
	setImmediate(function() {console.log('setImmediate occured.')});
	
	var fs = require('fs');
	var crypto = require('crypto');
	var rand = crypto.pseudoRandomBytes(8).toString('hex');
	fs.mkdir('d:\\temp\\xx'+'\\'+rand,function(err) {
		if (err) {
			console.log(err,'错误',err.code);
		} else {
			console.log('create directory success.');
		}		
	});
	
	synchronizedCode();
})();  
```
**代码2.5**  
我们在代码2.5中引入了代码2.4中的c++扩展，其输出内容如下

	async_hello Thread id : gettid() == 284953360
	
	call_work Thread id : gettid() == 284958096
	sleep 1 seconds in uv_work
	sleep 1 seconds in uv_work
	the 1th count.
	sleep 1 seconds in uv_work
	sleep 1 seconds in uv_work
	the 2th count.
	sleep 1 seconds in uv_work
	sleep 1 seconds in uv_work
	the 3th count.
	sleep 1 seconds in uv_work
	sleep 1 seconds in uv_work
	the 4th count.
	sleep 1 seconds in uv_work
	sleep 1 seconds in uv_work
	the 5th count.
	exist while.
	nextTick occured.
	sleep 1 seconds in uv_work
	sleep 1 seconds in uv_work
	the 1th count in [timer1].
	sleep 1 seconds in uv_work
	sleep 1 seconds in uv_work
	the 2th count in [timer1].
	sleep 1 seconds in uv_work
	the 3th count in [timer1].
	the 4th count in [timer1].
	exist while in [timer1].
	setTimeout 0 occured second.
	setImmediate occured.
	create directory success.
	
	call_work_after Thread id : gettid() == 284953360
	node addon result good--->hello world from c++
**输出2.5**  
我们终于看到开篇提到的类似java代码的交叉输出的效果了。libuv在处理任务时根本就和js不在一个线程中，所以才出现了libuv线程和js线程交叉输出的效果。我们在梳理一下代码2.5的异步流程，那么可以用下面这个图来展示出来：  
![](http://blog.whyun.com/images/js_frame3.png)  
**图2.3**  
在 node 中维护了一个回调的队列，那为什么调用插件的回调排在队列的最后面呢，是有于我们在**代码2.4**中故意将其代码设置成15秒之后才执行完成，这要远远长于其他的那些回调，所以它只能被追加到回调队列的最后一位。在第二帧中，node 中的事件轮询依次将这些回调队列中的任务取出来，进行触发调用。可以看出回调队列是个先进先出的结构。注意回调是按照队列中排队顺序执行的，同时它们执行的环境是 js 线程，要知道 js 线程可是个单线程，也就是说一旦某个回调中的同步代码耗时比较长，那么它后面的回调任务就得一直等着它运行完成，所以说一定不要在回调中写特别耗时的同步代码。

> 真实情况中，Node 的回调队列是有多个（例如 timer 回调在定时器回调队列中；文件操作和 C++ 插件操作的回调在 pending 回调队列中；setImmediate 在 check 回调队列中），本文为了方便初学者理解，将其描述为一个队列。
>
> 关于 Node 回调队列的内部调用顺序的详解可以参见[官方网站上的说明](https://nodejs.org/en/docs/guides/event-loop-timers-and-nexttick/)，或者是笔者写的另一篇教程[Node.js 体系结构](https://github.com/yunnysunny/nodebook/blob/master/text/01_node_introduce.md)。

## 3. 代码
本文用到代码发布在[http://git.oschina.net/yunnysunny/async-tutorial-code](http://git.oschina.net/yunnysunny/async-tutorial-code)