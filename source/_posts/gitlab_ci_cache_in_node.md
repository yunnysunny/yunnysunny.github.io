---
abbrlink: gitlab-ci-cache-in-node
title: gitlab ci 系列教程（三）—— 在 Node.js 项目中使用缓存
date: 2024-02-06
description: 大家使用 CI 的一个初衷就是用来构建编译产物，很多编程语言都有自己的包管理系统，可以借助社区的力量快速搭建自己的业务代码。但是由于依赖包安装过程太过缓慢，会严重影响 CI 运行的时间，所以我们在使用 CI 时一般倾向于将初次安装后的依赖包缓存下来，来加快后续或者下次的 CI 构建流程。本篇文章将会拿 Node.js 为例来讲解如何在 gitlab CI 中使用缓存。
categories:
  - - CI
---

大家使用 CI 的一个初衷就是用来构建编译产物，很多编程语言都有自己的包管理系统，可以借助社区的力量快速搭建自己的业务代码。但是由于依赖包安装过程太过缓慢，会严重影响 CI 运行的时间，所以我们在使用 CI 时一般倾向于将初次安装后的依赖包缓存下来，来加快后续或者下次的 CI 构建流程。本篇文章将会拿 Node.js 为例来讲解如何在 gitlab CI 中使用缓存。
## 1. 实现方式
### 1.1 直接缓存安装目录

Node.js 的包默认会安装在项目中的 node_modules 文件夹下，所以首先想到的就是直接将这个文件缓存起来备用。带着这个目标，我们写出如下 gitlab-ci.yml 文件：
```yaml
image: node:latest

variables:
  CI: 1
  NPM_INSTALL_CMD: 'npm i --no-audit --no-fund --verbose'

# Caches
.node_modules-cache: &node_modules-cache
  key:
    files:
      - package-lock.json
  paths:
    - node_modules
  policy: pull
.check_node_modules:
  script: &check-node-modules
    - |
      set -v
      echo "check cache..."
      if [ -d node_modules ] ; then
        echo "show 10 deps:" && (ls node_modules/ | head) && echo "cache exist"
      else
        eval $NPM_INSTALL_CMD
      fi
before_script:
  - git --version
  - node -v
  - npm -v

stages:
  - prepare
  - build
  - image

.when-to-run: &when_to_run
  rules:
    - if: $CI_COMMIT_MESSAGE !~ /^\d+.\d+.\d+/
    - if: $CI_COMMIT_TAG =~ /^v\d+.\d+.\d+\S*$/

# prepare
job:prepare:
  stage: prepare

  script:
    - eval $NPM_INSTALL_CMD
  cache:
    - <<: *node_modules-cache
      policy: pull-push # We override the policy
  allow_failure: false
  <<: *when_to_run

# build: eslint
job:build:eslint:
  stage: build

  script:
    - *check-node-modules
    - npm run eslint
  allow_failure: false
  cache:
    - <<: *node_modules-cache
  <<: *when_to_run

# build: build
job:build:build:
  stage: build

  artifacts:
    expire_in: 10min
    paths:
      - dist/
  script:
    - *check-node-modules
    - npm run build
  cache:
    - <<: *node_modules-cache
  allow_failure: false
  <<: *when_to_run
```
**代码 1.1.1**
首先需要指出的是 gitlab 中的缓存是不可靠性，生成的缓存可以手动清除掉，清除的方法可以手动去 runner 机器上删除缓存所在目录，或者在 Pipelines 页面上手动点击 `Clear runner caches` 按钮均可清除缓存。所以我们在 CI 文件中增加了缓存是否判断的判断，如果不存在就重新安装一遍，这也就是 `check_node_modules` 代码块的作用。
为了更加精确的控制缓存版本，这里 package-lock.json 作为缓存的 key，在 gitlab 运行时会对该文件做 md5 计算，以计算得到的 md5 值为 key，查询 gitlab 中是否存在对应的缓存。这样做的好处是，一旦有包的增删 package-lock.json 就会产生变化，这就代表着之前的缓存失效，需要重新安装。
Node.js 中自带的包管理器 npm，很多情况下性能比较低下，一旦当前 package-lock.json 和 node_modules 中有差异的时候，其在安装过程中会进行差分计算，算的比较慢。所以这里直接用 pcakge-lock.json 作为缓存 key，就是想让其尽量节省安装时间。不过 package-lock.json 有一个副作用，它内部会冗余一个项目的 version 字段，假设你运行 npm version 命令来手动打一个 git tag 的时候，这个命令会自动修改 package-lock.json 中的 version 字段，这会直接导致我们使用 package-lock.json 作为 key 的缓存失效。

### 1.2 使用 Node.js 自带的缓存命令
Node.js 的 npm 命令可以支持在安装的时候，手动指定缓存文件夹，这样可以做到优先使用缓存文件夹中的数据，如果缓存文件夹中没有找到所需要的包，才会从网上去下载。下面是一个使用 npm cache 参数的 CI 代码：
```yaml
image: node:latest

variables:
  CI: 1

# Caches
.node_modules-cache: &node_modules-cache
  key: for-all
  paths:
    - .npm
  policy: pull
  
before_script:
  - git --version
  - node -v
  - npm -v
  - ls .npm -lh  | head || true
  - npm i  --cache .npm --prefer-offline --no-audit --no-fund  --verbose

stages:
  - prepare
  - build
  - image

.when-to-run: &when_to_run
  rules:
    - if: $CI_COMMIT_MESSAGE !~ /^\d+.\d+.\d+/
    - if: $CI_COMMIT_TAG =~ /^v\d+.\d+.\d+\S*$/

# prepare
job:prepare:
  stage: prepare

  script:
    - echo prepare
  cache:
    - <<: *node_modules-cache
      policy: pull-push # We override the policy
  allow_failure: false
  <<: *when_to_run

# build: eslint
job:build:eslint:
  stage: build

  script:
    - npm run eslint
  allow_failure: false
  cache:
    - <<: *node_modules-cache
  <<: *when_to_run

# build: build
job:build:build:
  stage: build

  artifacts:
    expire_in: 10min
    paths:
      - dist/
  script:
    - npm run build
  cache:
    - <<: *node_modules-cache
  allow_failure: false
  <<: *when_to_run
```
**代码 1.2.1**
首先我们通过 npm 的 --cache 参数将缓存写入项目根目录下的 .npm 文件夹。如果我们不使用缓存指令的话，它在每次 job 执行完成之后，这个文件夹也随之消逝了，所以我们通过 job 的 cache 指令，将 .npm 文件夹缓存起来。注意我们在配置缓存的 key 的时候直接将其名字写为 `for-all`，虽然这个名字是随便起的，但是会导致缓存将会在所有代码分支、tag 中可用。
同时我们在 npm 命令中使用 --prefer-offline 参数，它将可以保证首先使用本地缓存的安装包，本地缓存没有找到可用包时才从网上下载。
我们这里使用的代码结构也跟之前不一样，在 **代码 1.1.1** 中，只在 prepare 阶段才显式的安装依赖，但是在 **代码 1.2.1** 中，在所有阶段都运行了安装命令。这是由于我们缓存的文件夹是 .npm 而不是 node_modules ，所以需要每次通过安装命令来生成 node_modules 目录。
不论像 **代码 1.1.1** 那样缓存 node_modules ，还是像 **代码 1.2.1** 那样缓存 .npm 目录，两者都各有利弊。对于前者来说缓存一旦生成，下次可以直接使用缓存从而跳过安装步骤，但是缓存 key 选择 package-lock.json 时容易因为修改 packge 的 version 属性导致缓存失效。对于 后者，能够使用全局缓存来保证缓存生命周期一直有效，但是每次执行安装过程还是会耗费一定时间，缓存命中时 job 的执行时间比前者要慢。
## 2. 其他解释
### 2.1 为何不用 npm ci 命令
网上的很多教程在 CI 中安装 Node 依赖的时候都是使用 npm ci 命令，那么它和 npm install 的区别是啥呢，首先 npm ci 在安装的时候会删除 node_modules  文件夹，但是我们的 CI  运行在 docker 中，node_modules 初始化的时候就是空的。其次，npm ci 只使用 package-lock.json 来安装依赖包，但是一旦有人不按照规范来安装依赖包，就会导致安装完的包不能用。如果为了约束安装行为可以使用 npm ci，如果为了更好的兼容性可以使用 npm install 。
### 2.2 为何使用 docker 模式的时候缓存生成后不能读取
使用 docker 模式时，会通过挂载宿主机目录的方式来加载缓存，但是默认会随机挂载一个宿主机目录。这样上一个 docker job 生成的缓存文件，在下一个 job 中将会失效。直接将 gitlab runner 中的挂载的 /cache 目录，映射到一个固定宿主目录即可。例如下面这个配置，`volumes` 属性默认为 `["/cache"]` ，gitlab runner 关联的 docker 启动后将会随机映射宿主机目录，这里将其关联 `/tmp` 目录后，将会直接关联宿主机 `/tmp` 目录，保证缓存能够复用成功。
```toml
[[runners]]
  name = "My Docker Runner"
  url = "https://gitlab.com"
  id = 1234567
  token = "你的注册token"
  token_obtained_at = 2023-12-16T12:54:50Z
  token_expires_at = 0001-01-01T00:00:00Z
  executor = "docker"
  [runners.cache]
    MaxUploadedArchiveSize = 0
  [runners.docker]
    tls_verify = false
    image = "docker:20.10.16"
    privileged = true
    disable_entrypoint_overwrite = false
    oom_kill_disable = false
    disable_cache = false
    volumes = ["/var/run/docker.sock:/var/run/docker.sock","/tmp:/cache"]
    shm_size = 0
    network_mtu = 0
```
**代码 2.2.1**
### 2.3 既然 npm 使用缓存如此拉跨，有没有替代方案
npm 的 package-lock.json 冗余 version 字段确实给我们使用缓存带来的很多不变，但是如果我们切换为其他包管理工具，例如 yarn 或者 pnpm 却不会有这么烦人的问题，它们的 lock 文件比较纯粹，只有依赖包的信息，使用类似 1.1 小节的解决方案是完全可以的。
下面给出一个使用 yarn 作为包管理工具的 CI 示例文件：
```yaml
image: node:latest

variables:
  CI: 1

# Caches
.node_modules-cache: &node_modules-cache
  key:
    files:
      - yarn.lock
  paths:
    - node_modules
  policy: pull
  
.check_node_modules:
  script: &check-node-modules
    - |
      set -v
      echo "check cache..."
      if [ -d node_modules ] ; then
        echo "show 10 deps:" && (ls node_modules/ | head) && echo "cache exist"
      else
        yarn install
      fi

stages:
  - prepare
  - build
  - image

.when-to-run: &when_to_run
  rules:
    - if: $CI_COMMIT_MESSAGE !~ /^\d+.\d+.\d+/
    - if: $CI_COMMIT_TAG =~ /^v\d+.\d+.\d+\S*$/

# prepare
job:prepare:
  stage: prepare

  script:
    - yarn install
    - npm run eslint
  cache:
    - <<: *node_modules-cache
      policy: pull-push # We override the policy
  allow_failure: false
  <<: *when_to_run

# build: build
job:build:build:
  stage: build

  artifacts:
    expire_in: 10min
    paths:
      - dist/
  before_script:
    - *check-node-modules
  script:
    - npm run build
  cache:
    - <<: *node_modules-cache
  allow_failure: false
  <<: *when_to_run

# build: test
job:build:test:
  stage: build

  coverage: '/All files[^|]*\|[^|]*\s+([\d\.]+)/'
  variables:
    NODE_ENV: test
  before_script:
    - *check-node-modules
  script:
    - npm run test:ci
  artifacts:
    when: always
    reports:
      junit: junit.xml
      coverage_report:
        coverage_format: cobertura
        path: coverage/cobertura-coverage.xml
  cache:
    - <<: *node_modules-cache
  allow_failure: false
  <<: *when_to_run
  dependencies: []
```
**代码 2.3.1**