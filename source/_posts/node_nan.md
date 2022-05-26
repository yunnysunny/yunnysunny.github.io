---
abbrlink: nan
title: nan入门教程
date:  2015-05-24
description: node的c++ API在不同版本中差异是巨大的，那么怎么解决这个问题呢，幸好有nan这个模块，它通过宏定义的方式把不同版本的API统一起来，极大简化了代码编写过程。
typora-root-url: ..\
categories:
- Node
---
Node.js在升级到0.12后，c++ API部分发生了翻天覆地的变化，如果你之前的代码是按照0.10的API编写的，将其改成0.12的形式是需要耗费一番精力的，但是问题又来了，你如果改为0.12形式，0.10又不能够被兼容了。幸好有[nan](https://github.com/nodejs/nan "")，其实它的核心是一个头文件，通过宏定义来做不同版本的node的c++ API的兼容。

## 1.配置
首先你通过 `npm install nan --save` 来安装 nan ,然后在binding.gyp中配置：

    "include_dirs" : [
        "<!(node -e \"require('nan')\")"
    ]
 最后在使用`nan`的c++文件中引入头文件`#include<nan.h>`。

## 2.demo
 下面的demo摘自nan的readme文档

     // addon.cc
    #include <node.h>
    #include <nan.h>
    // ..引入async.h或者sync.h
    
    using v8::FunctionTemplate;
    using v8::Handle;
    using v8::Object;
    using v8::String;
    
    void InitAll(Handle<Object> exports) {
      exports->Set(NanNew<String>("calculateSync"),
        NanNew<FunctionTemplate>(CalculateSync)->GetFunction());
    
      exports->Set(NanNew<String>("calculateAsync"),
        NanNew<FunctionTemplate>(CalculateAsync)->GetFunction());
    }
    
    NODE_MODULE(addon, InitAll)   

**代码2.1 addon.cc**

首先就是导出函数部分，`nan`中写法为`exports->Set(NanNew<String>("calculateSync"),
        NanNew<FunctionTemplate>(CalculateSync)->GetFunction());`，对于c++ api来说，在nan中全部都要用`NanNew`来声明，在0.10中这句话被写作`exports->Set(String::NewSymbol("calculateSync"),FunctionTemplate::New(CalculateAsync)->GetFunction());`在0.12中是`NODE_SET_METHOD(exports, "calculateSync", CalculateAsync); `。
 正常情况下需要引入函数`CalculateAsync`所在的头文件的，但是官方文档给出了两个`CalculateAsync`函数的实现，一个同步版，一个异步版。同步版仅仅是直接调用：

    // sync.h
    #include <node.h>
    #include <nan.h>
    
    NAN_METHOD(CalculateSync);
**代码2.2 sync.h**

通过头文件就可以看出，函数声明的方式需要使用`NAN_METHOD(CalculateSync)`，这等同于0.10中的`Handle<Value> CalculateSync(const Arguments& args)`,在0.12中要这么写`void CalculateSync(const FunctionCallbackInfo<Value>& args)`。

    // sync.cc
    #include <node.h>
    #include <nan.h>
    #include "./sync.h"
    // ...引入第三方类库头文件
    
    using v8::Number;
    
    // Simple synchronous access to the `Estimate()` function
    NAN_METHOD(CalculateSync) {
      NanScope();
    
      // expect a number as the first argument
      int points = args[0]->Uint32Value();
      double est = Estimate(points);//Estimate是一个第三方类库的函数，这里可以不用理会
    
      NanReturnValue(NanNew<Number>(est));
    }
**代码2.3 sync.cc**
首先是函数`NanScope();`,他来完成node0.10中的`HandleScope scope;`的功能，在node0.12中是：

    Isolate* isolate = Isolate::GetCurrent();
    HandleScope scope(isolate);
函数结束返回值操作也变成由函数（确切的说应该是宏定义）NanReturnValue来代替。

更令人振奋的是，nan中还对libuv中的函数`uv_queue_work`进行了抽象，可以通过继承类`NanAsyncWorker`来实现异步话操作，省去了为了使用`uv_queue_work`而自定义数据结构的步骤。下面就是async.cc的代码：

    // async.cc
    #include <node.h>
    #include <nan.h>
    #include "./async.h"
    
    // ...引入第三方类库
    
    using v8::Function;
    using v8::Local;
    using v8::Null;
    using v8::Number;
    using v8::Value;
    
    class PiWorker : public NanAsyncWorker {
     public:
      PiWorker(NanCallback *callback, int points)
        : NanAsyncWorker(callback), points(points) {}
      ~PiWorker() {}
    
      //这个函数运行在工作线程，而不是v8线程，所以不能访问v8的数据
      void Execute () {
        estimate = Estimate(points);
      }
    
      //这个是libuv的回调函数，在这里可以使用v8的数据
      void HandleOKCallback () {
        NanScope();
    
        Local<Value> argv[] = {
            NanNull()
          , NanNew<Number>(estimate)
        };
    
        callback->Call(2, argv);
      };
    
     private:
      int points;
      double estimate;
    };
    
    // Asynchronous access to the `Estimate()` function
    NAN_METHOD(CalculateAsync) {
      NanScope();
    
      int points = args[0]->Uint32Value();
      NanCallback *callback = new NanCallback(args[1].As<Function>());
    
      NanAsyncQueueWorker(new PiWorker(callback, points));
      NanReturnUndefined();
    }
**代码2.4 async.cc**    
[这里](https://gitlab.com/yunnysunny/async-tutorial-code/tree/master/addon "")有一个利用[nan](https://github.com/nodejs/nan)和node0.10/0.12来完成异步操作的对比。

这篇教程仅仅是一个入门操作，就讲到这里了，详细的使用请参考nan的readme文档。