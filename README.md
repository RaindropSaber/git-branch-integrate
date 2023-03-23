## 分支自动集成

通过脚本的方式，将一些分支全部合并集成到一个目标分支。

配合 CI 工具可以做到自动化集成，减少分支操作。

### 适用场景

- 多人协同场景
- 多任务开发场景

### 下载

```
npm i @xhs/branch-integrate --registry http://npm.devops.xiaohongshu.com:7001/ -g
```

### 使用方式

#### CLI

```shell
npx xhs-integrate -t release -s feat1 feat2 feat3

// 查看参数说明
npx xhs-integrate -h

```

#### Node

##### API

```js
const integrate = require('@xhs/branch-integrate');

const config = {
  target: 'release',
  source: ['feat1', 'feat2', 'feat3'],
};
await integrate(config);
```

##### Config

```ts
interface Config {
  baseline?: string; //基线分支，默认 master。
  target: string; //目标分支，合并成功后的目标分支名称。必填
  source: string; //来源分支，需要被集成的分支名称。必填
  current?: string; //当前所在的分支。 默认为当前环境 checkout 的分支
  autoRebase?: boolean; //是否需要在合并前，自动 rebase 基线分支，默认 true
}
```
