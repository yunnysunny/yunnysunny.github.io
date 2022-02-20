---
abbrlink: node0-12capi
title: 即将面临的Node0.12中的C++API的改变
date:  2015-05-19
description: Node0.12和Node0.10的C++API方面发生了重大变化，nodejs官方文档中给出仅仅是几个简单例子，在具体使用过程中依靠这几个例子是不够的，当初在将Node0.10的扩展迁移到Node0.12时遇到了各种问题，直到遇到了这篇文章，我想我不得不将它翻译出来共享给大家了
categories:
- Node
---

原文地址：https://strongloop.com/strongblog/node-js-v0-12-c-apis-breaking/

> 编者注：欢迎阅读旨在帮你快速了解，在即将发布的node0.12中（ *作者写这篇文章的时候Node0.12还没有发布，译者注* ）的API变化三系列教程的第三部分。在[第一部分](http://strongloop.com/strongblog/node-js-v0-12-new-apis/ "")，[Alex Gorbatchev](https://github.com/alexgorbatchev "")列出来没有变化的API，在[第二部分](http://strongloop.com/strongblog/node-js-v0-12-apis-breaking/ "")中他指出了变化的部分。在第三部分，[Ben Noordhuis](http://strongloop.com/strongblog/node-js-v0-12-apis-breaking/ "")将会详细描述C++API部分的差别。  

在Node v0.10和v0.12之间有大量的差异。我不会试图把每一个细节都点出来，我将把这些差异分类，按照从“更重要”到“次重要”的次序进行排序，然后解释怎样合理的更新你的代码。  
本文大部分讲述V8 API，因为这正是大量差异出现的地方。欢迎通过[ben at strongloop.com](mailto:ben@strongloop.com "")来给我提供建议和反馈。  

## 原生函数的参数已经被更改  
在node v0.10中你这么写： 
```c++
    v8::Handle<v8::Value>FortyTwo(const v8::Arguments&args){
      v8::HandleScope handle_scope;
      returnhandle_scope.Close(v8::Integer::New(42));
    }
```
在node v0.12中你这么写：
```c++
    void FortyTwo(const v8::FunctionCallbackInfo<v8::Value>&info){
      // Don't need a HandleScope in this particular example.
      info.GetReturnValue().Set(42);
    }
```
一些重要的变化如下:  

1. 返回类型是`void`。
2. 返回值通过`v8::ReturnValue::Set()`,`v8::ReturnValue::SetEmptyString()`,`v8::ReturnValue::SetNull()`,`v8::ReturnValue::SetUndefined()`来设置。
3. 如果没有显式的设置返回值，将会返回`undefined`。

`v8::ReturnValue::Set()`拥有一个数字类型的重载函数可以是使用不同的数据类型。如果你的编译器处理时出现问题或者报歧义错误，那么就是使用`static_cast<>`来将参数转为支持的类型：  
```c++
    void FortyTwo(const v8::FunctionCallbackInfo<v8::Value>& info) {
      const int64_t value = 42;
      // error: call of overloaded 'Set(const int64_t&)' is ambiguous
      info.GetReturnValue().Set(value);
      // but this works
      info.GetReturnValue().Set(static_cast<int32_t>(value));
      // as does this
      info.GetReturnValue().Set(static_cast<double>(value));
    }
```
当然你需要挑选合适的类型来转换。当转化为窄数据类型，以至于无法承载原始数据据时，将会产生不可预期的结果。  
注意，`v8::FunctionCallbackInfo<v8::Value>`是对于`v8::Arguments`的重命名和参数化（parameterized ）。除了名字和额外的`GetReturnValue()`函数，他们没有表面上的差别。

## 大部分V8 API现在需要使用v8::Isolate*
在Node v0.10中你这么写：
```c++
    v8::Local<v8::Integer> a = v8::Integer::New(42);
    v8::Local<v8::Number> b = v8::Number::New(13.37);
    v8::Local<v8::FunctionTemplate> ft = v8::FunctionTemplate::New(Foo);
```
在Node v0.12中你这么写：
```c++
    v8::Isolate* isolate = /* ... */;
    v8::Local<v8::Integer> a = v8::Integer::New(isolate, 42);
    v8::Local<v8::Number> b = v8::Number::New(isolate, 13.37);
    v8::Local<v8::FunctionTemplate> ft = v8::FunctionTemplate::New(isolate, Foo);
```
你可以通过若干的方法获取当前的`v8::Isolate`的指针：  
```c++
    void FortyTwo(const v8::FunctionCallbackInfo<v8::Value>& info) {
      v8::Isolate* isolate;
      isolate = info.GetIsolate();
      // or:
      isolate = info.GetReturnValue().GetIsolate();
      // or even:
      isolate = v8::Isolate::GetCurrent();
    }
```
注意，V8团队已经指出，`v8::Isolate::GetCurrent()`将会被逐步淘汰。如果你想编写向后兼容的代码，你最好显式的传递isolate参数。
## V8 string函数现在需要显式声明编码  
在Node v0.10中你这么写：
```c++
    // create a UTF-8 string
    v8::Local<v8::String> utf8 = v8::String::New("42");
    // create a UTF-16 string from input in system endianness
    static const uint16_t chars[] = { '4', '2', 0 };
    v8::Local<v8::String> utf16 = v8::String::New(chars);
```
在Node v0.12中你这么写：
```c++
    v8::Isolate* isolate = /* ... */;
    // create a UTF-8 string
    v8::Local<v8::String> utf8 = v8::String::NewFromUtf8(isolate, "42");
    // create a UTF-16 string from input in system endianness
    static const uint16_t chars[] = { '4', '2', 0 };
    v8::Local<v8::String> utf16 = v8::String::NewFromTwoByte(isolate, chars);
    // create a ISO-8859-1 a.k.a. Latin1 string
    const uint8_t* octets = reinterpret_cast<const uint8_t*>("42");
    v8::Local<v8::String> latin1 = v8::String::NewFromOneByte(isolate, octets);
```
`v8::String::NewFromTwoByte()`稍微有点命名的不合适，因为他并不是一个严格的双字节编码。他能够识别surrogate pairs【 链接：https://msdn.microsoft.com/en-us/library/windows/desktop/dd374069(v=vs.85).aspx 】， 所以它应该被称作[UTF-16](https://zh.wikipedia.org/wiki/UTF-16 "")，而不是[UCS-2](https://zh.wikipedia.org/wiki/Universal_Character_Set "")。

## 去除了v8::String::NewSymbol()和v8::String::NewUndetectable()
在Node v0.10中你这么写：
```c++
    v8::Local<v8::String> symbol = v8::String::NewSymbol("42");
    v8::Local<v8::String> hidden = v8::String::NewUndetectable("42");
```
在Node v0.12中你这么写：
```c++
    v8::Isolate* isolate = /* ... */;
    v8::Local<v8::String> symbol =
        v8::String::NewFromUtf8(isolate, "42", v8::String::kInternalizedString);
    v8::Local<v8::String> hidden =
        v8::String::NewFromUtf8(isolate, "42", v8::String::kUndetectableString);
```
## 去除了v8::String::AsciiValue
在Node v0.10中你这么写：
```c++
    v8::Local<v8::String> string = /* ... */;
    v8::String::AsciiValue s(string);
    puts(s);
```
在Node v0.12中你这么写：
Nothing! `v8::String::AsciiValue`本来就有问题：它的名字告诉大家要返回7比特的ASCII数据，但是实际上返回8比特的二进制数据。同时它搞混了多字节字符的字节序。  
使用`v8::String::Utf8Value`或者`v8::String::Value`(适用于UTF-16)来进行替代。如果你想获取一个字符串的原始二进制数据，你可以这么做：
```c++
    v8::Local<v8::String> string = /* ... */;
    const int length = string->Utf8Length() + 1;  // Add one for trailing zero byte.
    uint8_t* buffer = new uint8_t[length];
    string->WriteOneByte(buffer, /* start */ 0, length);
```
注意：`v8::String::Utf8Length()`会迭代字符串中的每一个字符，这就是为啥对于大字符串来说会(很)慢的原因。
## 去除了v8::HandleScope::Close()
在Node v0.10中你这么写：
```c++
    v8::Local<v8::Value> Example() {
      v8::HandleScope handle_scope;
      return handle_scope.Close(v8::Integer::New(42));
    }
```
在Node v0.12中你这么写：
```c++
    v8::Local<v8::Value> Example(v8::Isolate* isolate) {
      v8::EscapableHandleScope handle_scope(isolate);
      return handle_scope.Escape(v8::Integer::New(isolate, 42));
    }
```
## v8::Persistent<T>不再继承自v8::Handle<T>
`v8::Persistent<T>`不再是`v8::Handle<T>`类型的对象。这就意味着，你不能在直接访问指向的句柄了。做出如此大变革的动机是由于在v0.10中这么操作太容易导致资源泄露或者导致在释放之后再访问其存储的内容。  
在Node v0.10中你这么写：
```c++
    v8::Local<v8::Value> value = /* ... */;
    v8::Persistent<v8::Value> persistent = v8::Persistent<v8::Value>::New(value);
    // ...
    v8::Local<v8::Value> value_again = *persistent;
    // ...
    persistent.Dispose();
    persistent.Clear();
```
在Node v0.12中你这么写：
```c++
    v8::Isolate* isolate = /* ... */
    v8::Local<v8::Value> value = /* ... */;
    v8::Persistent<v8::Value> persistent(isolate, value);
    // or:
    v8::Persistent<v8::Value> persistent;
    persistent.Reset(isolate, value);
    // ...
    v8::Local<v8::Value> value_again =
        v8::Local<v8::Value>::New(isolate, persistent);  // rematerialize handle
    // ...
    persistent.Reset();
```
另外一个变化是，persistent 句柄现在不能被拷贝。在Node v0.10中你这么写：
```c++
    v8::Local<v8::Value> value = /* ... */;
    v8::Persistent<v8::Value> a = v8::Persistent<v8::Value>::New(value);
    v8::Persistent<v8::Value> b = a;  // a and b now point to |value|
```
在Node v0.12中你这么写：
```c++
    v8::Isolate* isolate = /* ... */
    v8::Local<v8::Value> value = /* ... */;
    v8::Persistent<v8::Value> a(isolate, value);
    v8::Persistent<v8::Value> b(isolate, a);
    // or:
    v8::Persistent<v8::Value> b;
    b.Reset(isolate, a);
```
由于`v8::Persistent<T>`没有在语法上提供拷贝功能，所以现在使用STL容器类的时候会更困难。鉴于此，V8在`v8-util.h`中提供了若干工具类。

举个例子：  
```c++
    #include "v8-util.h"
 
    void Example(v8:Isolate* isolate) {
      v8::StdPersistentValueMap<int, v8::String> map(isolate);
      v8::Local<v8::String> value = v8::String::NewFromUtf8(isolate, "fortytwo");
      map.Set(42, value);
      assert(map.Contains(42));
      assert(map.Get(42)->StrictEquals(value));
      assert(map.Get(21).IsEmpty());
      assert(1 == map.Size());
      map.Remove(42);
      assert(0 == map.Size());
      map.Clear();  // or we could just call .Clear()
    }
```
如果你使用`[C++](https://zh.wikipedia.org/wiki/CBB11 "%3")`,你可以在标准容器类的[移动语义](http://www.cprogramming.com/c++11/rvalue-references-and-move-semantics-in-c++11.html "")中使用`v8::UniquePersistent<T>`。  
或者，你可以通过具有拷贝特性的`v8::Persistent<T>`,但是要保证这么做不会导致资源泄露或者在释放后再使用的问题：  
```c++
    v8::Isolate* isolate = /* ... */;
    v8::CopyablePersistentTraits<v8::Value>::CopyablePersistent persistent;
    persistent.Reset(isolate, /* ... */);
```
## 弱引用persistent句柄的回调函数参数更改
一个正常的persistent句柄会被垃圾回收器忽略掉，一直到程序手动释放才会被回收。  
相反，弱引用persistent句柄会被垃圾回收器跟踪，当需要回收时，回收器会通过回调函数通知程序。接着程序释放掉关联的资源或者复用这个句柄如果对象还要在后续使用的话。  
在Node v0.10中这么写：  
```c++
    void WeakCallback(v8::Persistent<v8::Value> object, void* arg) {
      puts(static_cast<const char*>(arg));
      object.Dispose();  // or .ClearWeak() if you want to keep it around
    }
     
    void Example() {
      v8::HandleScope handle_scope;
      v8::Local<v8::Object> object = v8::Object::New();
      v8::Persistent<v8::Object> persistent =
          v8::Persistent<v8::Object>::New(object);
      persistent.MakeWeak(const_cast<char*>("fortytwo"), WeakCallback);
    }
```
在Node v0.12中这么写：
```c++
    void WeakCallback(const v8::WeakCallbackData<v8::Value, const char*>& data) {
      puts(data.GetParameter());
      //persistent的存储单元将会自动清除。
      //如果你想保持对原始v8::Persistent<T>的引用，你可以使用.ClearWeak()来复用它。
    }
     
    void Example(v8::Isolate* isolate) {
      v8::HandleScope handle_scope(isolate);
      v8::Local<v8::Object> object = v8::Object::New(isolate);
      v8::Persistent<v8::Object> persistent(isolate, object);
      persistent.SetWeak("fortytwo", WeakCallback);
    }
```
## v8::ThrowException()现在变成了 v8::Isolate::ThrowException()
在Node v0.10中这么写：
```c++
    v8::Local<v8::Value> exception = /* ... */;
    v8::ThrowException(exception);
```
在Node v0.12中这么写：
```c++
    v8::Isolate* isolate = /* ... */
    v8::Local<v8::Value> exception = /* ... */;
    isolate->ThrowException(exception);
```