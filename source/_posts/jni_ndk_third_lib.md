---
abbrlink: jni/use-thrid-part-library-in-ndk
title: JNI系列教程之四——在NDK中使用第三方库
date:  2015-12-31
description: 主要讲述如何在NDK中使用第三方库
categories:
- [Java, JNI]
---

## 4.1 背景
既然使用NDK，一般两个常见的原因，一个就是java代码运行效率低，还有一个就是之前和c相关的类库已经在其它项目中准备好了，这样使用NDK就可以尽可能的复用代码。

> 本文源地址：http://blog.whyun.com/posts/jni/use-thrid-part-library-in-ndk/ 转载请注明出处。

## 4.2 使用第三方库源码
假设你将第三方库做成动态库，并且你在JNI中还引用了这个动态库，不要企盼着把你的JNI库和这个第三方库放到同一个目录（比如说android项目的`libs/armeabi`目录）下就万事大吉了，很不幸的告诉你，JNI代码在被运行在android上时不能引用非`/system/lib`下的动态库。安卓操作系统的系统库文件都是放到`/system/lib`下的，如果你的JNI代码想引用一些第三方库的功能，就得考虑将第三方库做成静态库，继而打入你生成的jni库中。  
再假设你就是第三方库的提供方，你需要将你写的代码提供给你的客户，而且你还想在做完库文件后还有一个测试程序，那么你可以在`Android.mk`中先编译出来一个静态库，然后再编译一个测试用的JNI动态库。你可能会有疑问，同一个`Android.mk`可以生成多个文件吗，答案是肯定的。  
还是先看一个官方的例子，在NDK路径下，进入目录`sample\two-libs`,然后打开`jni`目录中的`Android.mk`：
```
LOCAL_PATH:= $(call my-dir)

# first lib, which will be built statically
#
include $(CLEAR_VARS)

LOCAL_MODULE    := libtwolib-first
LOCAL_SRC_FILES := first.c

include $(BUILD_STATIC_LIBRARY)

# second lib, which will depend on and include the first one
#
include $(CLEAR_VARS)

LOCAL_MODULE    := libtwolib-second
LOCAL_SRC_FILES := second.c

LOCAL_STATIC_LIBRARIES := libtwolib-first

include $(BUILD_SHARED_LIBRARY)
```
**代码4.2.1 Android.mk**  
一般情况下，我们都会写`include $(BUILD_SHARED_LIBRARY)`来生成JNI库，但是这个项目在编译动态库之前先编译生成了一个静态库，编译静态库的时候同样指定了参数`LOCAL_MODULE`和`LOCAL_SRC_FILES`参数，但是下面编译动态库的时候也指定了这两个参数啊，难道不冲突？当然不冲突，因为我们用了这句话——`include $(CLEAR_VARS)`,调用了它就会把之前所有定义的`LOCAL_`开头的变量全部清空。配置的前半部分生成了静态库`libtwolib-first.a`，配置的后半部分注意`LOCAL_STATIC_LIBRARIES`这个变量，其值正是静态库的`LOCAL_MODULE`名称。  
## 4.3 使用第三方库文件
我们在4.2中做出来了一个静态库（那个静态库在项目的`obj\local\{abi}`目录可以得到，abi为具体的cpu类型），本意是给客户提供一个可以调用的库文件，现在假设你就是那个客户，手里拿到了库文件，但是没有源码，该怎么使用来？这就要提到`PREBUILD_`类型变量，先看例子：
```
LOCAL_PATH:= $(call my-dir)

# first lib, which will be built statically
#
include $(CLEAR_VARS)

#$(info $(TARGET_ARCH_ABI))

LOCAL_MODULE := libtwolib-first
LOCAL_SRC_FILES := ../obj/local/$(TARGET_ARCH_ABI)/libtwolib-first.a
include $(PREBUILT_STATIC_LIBRARY)

# second lib, which will depend on and include the first one
#
include $(CLEAR_VARS)

LOCAL_MODULE    := libtwolib-second
LOCAL_SRC_FILES := second.c

LOCAL_STATIC_LIBRARIES := libtwolib-first

include $(BUILD_SHARED_LIBRARY)
```
**代码 4.3.1 Android-static.mk**  
一般`LOCAL_SRC_FILES`是要写c/c++文件的，现在却直接写了一个动态库文件，然后引入`PREBUILT_STATIC_LIBRARY`来使用NDK的预编译功能，告诉编译器这个库文件已经编译好了，可以直接在下面的编译的中引用。我们看到最终在编译`twolib-second`库中，使用变量`LOCAL_STATIC_LIBRARIES`来将其引入。
最后运行`ndk-build APP_BUILD_SCRIPT=Android-static.mk`进行编译，因为我们这里没有使用默认的mk文件名，所以使用参数`APP_BUILD_SCRIPT`来指定使用的mk文件。
## 4.4 指定预编译库的头文件路径
一些成熟的开源库提供了对于安卓环境的编译支持，你可以使用`ndk-build`来生成库文件。然后使用4.3的方法引入预编译库，但是对于这种开源库，我们引入头文件都是采用`#include<xxx.h>`这种方式，这时候就需要指定一个头文件的搜索路径，这就是`LOCAL_EXPORT_C_INCLUDES `变量的作用。下面是一个引用openssl的例子:
```
LOCAL_PATH := $(call my-dir)

include $(CLEAR_VARS)
LOCAL_MODULE := crypto
LOCAL_SRC_FILES := libcrypto.so
LOCAL_EXPORT_C_INCLUDES := $(LOCAL_PATH)/include
include $(PREBUILT_SHARED_LIBRARY)

include $(CLEAR_VARS)

LOCAL_MODULE    := libchapter4
#LOCAL_C_INCLUDES := $(SYSROOT)/usr/include
LOCAL_LDLIBS := -L$(SYSROOT)/usr/lib -llog

LOCAL_SRC_FILES := chapter4.c

LOCAL_SHARED_LIBRARIES := crypto
include $(BUILD_SHARED_LIBRARY)

TARGET_PLATFORM := android-3
```
这里在和`chapter4.c`同级的目录下，须有有个`include`文件夹，然后在里面放openssl文件夹，当然这个openssl文件夹里就是一堆openssl的头文件。这样我们在代码中就可以这么写了：  
`#include <openssl/pkcs12.h>`  
在编译的时候，编译器就会去加载jni目录下的`include/openssl/pkcs12.h`文件。  
>其实libcrypto.so在安卓系统的`/system/lib`就存在了，虽然编译完成之后libcrypto.so会被拷贝到安卓项目的libs目录的armeabi下，但是在APP运行时读取的还是`/system/lib`下的libcrypto.so。可以把libcrypto.so和openssl文件目录分别拷贝到NDK目录下的`platforms\android-3\arch-arm\usr`中的`lib`和`include`目录，这样不需要写`include $(PREBUILT_SHARED_LIBRARY)`代码块了。

    本文用的代码可以从https://gitlab.com/yunnysunny/ndk/-/tree/master/chapter4 获取。