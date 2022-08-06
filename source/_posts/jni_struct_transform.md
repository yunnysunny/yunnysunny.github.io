---
abbrlink: jni/2-struct-transform
title: JNI系列教程二——数据结构
date: 2015-11-25
description: JNI和java的数据结构的相互转化，JNI和java的函数相互调用
categories:
- [Java, JNI]
---

JNI和java相互调用，一个不可避免的问题就是两者的数据结构要相互转换。这一节正是要讲这个重头戏。

> 本文源地址http://blog.whyun.com/posts/jni/2-struct-transform/ 转载请注明出处。

## 2.1 基本类型

基本数据类型大都是数字类型表2.1.1中给出了java和jni的对应关系。

| Java 类型              | 本地类型     | 说明       |
| -------------------- | -------- | -------- |
| boolean              | jboolean | 无符号，8 位  |
| byte                 | jbyte    | 无符号，8 位  |
| char                 | jchar    | 无符号，16 位 |
| short                | jshort   | 有符号，16 位 |
| int                  | jint     | 有符号，32 位 |
| long                 | jlong    | 有符号，64 位 |
| float                | jfloat   | 32 位     |
| double               | jdouble  | 64 位     |
| **表2.1.1 基本数据类型对照表** |          |          |

## 2.2 对象类型

对象类型的对照关系牵扯到的知识点比较多，所以下面决定通过具体例子来让大家更好的学习它。
首先在java代码有这么两行行声明

    public native int getSum(int a, int b);
    public native int getSum(byte [] array);

第一个函数是一个基本数据类型，第二个函数是一个数组，虽然两个函数在java中是同名的，但是生成的c文件却不能使用同名文件，

```c
/*
 * Class:     com_whyun_jni_chapter2_StructDemo
 * Method:    getSum
 * Signature: (II)I
 */
JNIEXPORT jint JNICALL Java_com_whyun_jni_chapter2_StructDemo_getSum__II
    (JNIEnv *env, jobject obj, jint a, jint b) {
        return a+b;
};

/*
 * Class:     com_whyun_jni_chapter2_StructDemo
 * Method:    getSum
 * Signature: ([B)I
 */
JNIEXPORT jint JNICALL Java_com_whyun_jni_chapter2_StructDemo_getSum___3B
  (JNIEnv *env, jobject obj, jbyteArray arr) {
      int sum = 0;
      char *data = (char*)(*env)->GetByteArrayElements(env,arr,NULL);
      int dataLen = (int)(*env)->GetArrayLength(env,arr);
      int i = 0;
      for (i=0;i<dataLen;i++) {
          sum += data[i];
      }
      (*env)->ReleaseByteArrayElements(env,arr,data,0);
      return (jint)sum;
}
```

我们通过`javah`生成头文件时，就会发现生成的getSum的函数后缀是不一样的。这里重点看JNI中对数组的操作，在实际编程中我们常常要处理二进制数据，那么自己数组便是经常要使用的一个数据结构了。java中的byte[]最终在JNI中被转化为jbyteArray，但是jbyteArray要想在C语言中使用，还必须得到一个C语言中可识别的char类型指针的形式，这就是函数GetByteArrayElements的作用。要想知道当前数组的长度，可以使用函数GetArrayLength。我们可以推断出GetByteArrayElements内部申请了一块内存，也就是说变量`data`是通过类似于malloc之类的函数申请得到的，所以最终在使用完成之后是需要释放的，所以才有了函数最后调用ReleaseByteArrayElements函数的代码。

下面看一个复杂的例子通过JNI来调用java函数,直接上JNI的代码：

```c
/*
 * Class:     com_whyun_jni_chapter2_StructDemo
 * Method:    getUserList
 * Signature: (I)Ljava/util/ArrayList;
 */
JNIEXPORT jobject JNICALL Java_com_whyun_jni_chapter2_StructDemo_getUserList
  (JNIEnv *env, jobject obj, jint num) {
    int count = (int)num,i=0;
    jclass clsUserBean = (*env)->FindClass(env,"com/whyun/jni/bean/UserBean");
    jclass clsArrayList = (*env)->FindClass(env,"java/util/ArrayList");
    jmethodID userBeanConstructor = (*env)->GetMethodID(env,clsUserBean,"<init>","()V");
    jmethodID userBeanSetAge = (*env)->GetMethodID(env,clsUserBean,"setAge","(I)V");
    jmethodID userBeanSetName = (*env)->GetMethodID(env,clsUserBean,"setName","(Ljava/lang/String;)V");
    jmethodID arrayListContructor = (*env)->GetMethodID(env,clsArrayList,"<init>","(I)V");
    jmethodID arrayListAdd = (*env)->GetMethodID(env,clsArrayList,"add","(ILjava/lang/Object;)V");

    jobject arrayList = (*env)->NewObject(env,clsArrayList,arrayListContructor,num);

    char nameStr[5] = {0};
    int index = 0;
    jstring name;

    for(i=0;i<count;i++) {
        jobject userBean = (*env)->NewObject(env,clsUserBean,userBeanConstructor);

        for (index=0;index<4;index++) {
            nameStr[index] = randStr[(i+7)%5];
        }
        name = (*env)->NewStringUTF(env,(const char *)nameStr);
        (*env)->CallVoidMethod(env,userBean,userBeanSetAge,(jint)(20+i));
        (*env)->CallVoidMethod(env,userBean,userBeanSetName,name);

        (*env)->CallVoidMethod(env,arrayList,arrayListAdd,(jint)i,userBean);
    }
    return arrayList;
}
```

如果你稍加揣测的话，这段代码翻译成java代码应该是这么写的：

```java
public ArrayList<UserBean> getUserList(int count) {
    ArrayList<UserBean> list = new ArrayList<UserBean>(count);
    for(int i=0;i<count;i++) {
        UserBean bean = new UserBean();
        bean.setAge(i+20);
        bean.setName("name"+i);
        list.add(i,bean);
    }
    return list;
}
```

看上去java代码要简单许多，在JNI中包括类、成员函数、对象之类的数据都需要先创建再使用。在java中创建对象用`new UserBean()`就够了，但是在JNI中，你首先要通过`FindClass`函数来找到类定义，然后通过类定义用函数`GetMethodID`来找到构造函数，然后根据类定义和构造函数通过函数`NewObject`来获取一个对象，下面分别对这三个函数进行讲解。  
`FindClass`函数的第二个参数是要加载的类的类名全称，在java中我们应该写作`com.whyun.jni.bean.UserBean`,在JNI中就是把`.`换成了`/`而已。  
`GetMethodID`函数的第二个参数是`FindClass`函数得到的类变量`clsUserBean`,第二个参数是函数名，一般来说函数名直接写函数名称就行了，比如说你再往下看一行代码获取UserBean的`setAge`函数的时候就直接写的函数名，但是构造函数就不同了，所有类的构造函数在JNI中统一叫`<init>`。最后一个参数很重要，它是java函数的签名，java中每个函数和属性都有一个它的标识，这个标识用来指出当前函数的参数、返回值类型或者属性的类名，可能有些人第一听说这个概念，其实获取这个标识有一个很简单的方法，就是命令`javap`，下面先做个小实验，运行`javap -s java.lang.String`，会输出如下内容：

```
Compiled from "String.java"
public final class java.lang.String implements java.io.Serializable, java.lang.Comparable<java.lang.String>, java.lang.CharSequence {
  public static final java.util.Comparator<java.lang.String> CASE_INSENSITIVE_ORDER;
    Signature: Ljava/util/Comparator;
  public java.lang.String();
    Signature: ()V

  public java.lang.String(java.lang.String);
    Signature: (Ljava/lang/String;)V

  public java.lang.String(char[]);
    Signature: ([C)V

  public java.lang.String(char[], int, int);
    Signature: ([CII)V

  public java.lang.String(int[], int, int);
    Signature: ([III)V
由于文件内容比较多，所以省略掉下面内容    
```

由于java是支持重载的，一个函数可能会拥有多种实现方式，比如`String`类的构造函数就有N多个，那么你在调用其函数的时候，就必须得依靠参数和返回值类型来区分不同的函数了，而签名正提供了一种简介的方式来表示一个函数的参数和返回值。通过刚才`javap`命令的输出，我们可以得到对于没有参数的String构造函数，其签名为`()V`；对于参数为字符数组的构造函数签名为`([C)V`。
接着讲函数`NewObject`,前面经过`FindClass`和`GetMethodID`一顿折腾，我们拿到了两个变量类变量`clsUserBean`和函数变量`userBeanConstructor`,将其传到`NewObject`中就能得到一个对象。在我们的代码中还有一个对于ArrayList类型的对象的构造，他调用`NewObject`的时候比`UserBean`多了一个参数，那是由于我们使用的构造函数为`ArrayList(int i)`，故需要传递一个ArrayList的长度参数，这里需要声明的是`NewObject`函数的参数个数是可变的，调用的构造函数有参数，就依次追加到后面即可。
终于讲到真正调用java函数这一步了，就是代码中的`CallVoidMethod`,和`NewObject`一样，它也是可变参数，参数形式也一样。除了`CallVoidMethod`，JNI中还有各种`Call[Type]Method`，这个Type就代表了java函数的返回值，它可以是`Object` `Boolean` `Byte` `Char` `Short` `Int` `Long` `Float` `Double`。

## 2.3 使用异常

c语言中没有异常这个概念，使用c代码的时候多是通过返回码来判断是否调用成功，然而对于java程序来说判断有没有成功，往往是看有没有异常抛出，所以说编写一个java友好的JNI程序，我们需要将错误码转成java异常。直接上例子：

```c
/*
 * Class:     com_whyun_jni_chapter2_StructDemo
 * Method:    showException
 * Signature: ()V
 */
JNIEXPORT void JNICALL Java_com_whyun_jni_chapter2_StructDemo_showException
  (JNIEnv *env, jobject obj) {
      jclass exception = (*env)->FindClass(env,"java/lang/Exception");
      (*env)->ThrowNew(env,exception,"This is a exception.");
}
```

这里ThrowNew转成java的话，就是`throw new Exception("This is a exception.");`其它的我就不多说了。
