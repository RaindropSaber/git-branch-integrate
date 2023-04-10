const { simpleGit } = require('simple-git');
const { asyncMap, Logger } = require('./utils');
const git = simpleGit();
const logger = new Logger();

const checkout = async (branch, baseline) => {
  // logger.log(`签出到:${branch}`);
  try {
    if (baseline) return git.checkout(['-b', branch, baseline]).catch(() => git.checkout([branch]));
    return git.checkout([branch]);
  } catch (e) {
    logger.error(`checkout  ${branch} from ${baseline} 失败`, e);
    return Promise.reject(e);
  }
};
const checkoutRemote = async (branch) => {
  return checkout(branch, `origin/${branch}`);
};

const integrateTask = async ({ baseline, target, source, tempBranch, autoRebase }) => {
  // 依次 将集成分支合入 temp-xxxx
  const integrateRes = await asyncMap(source, async (source) => {
    logger.info(`正在集成 ${source} 到 ${target}`);
    try {
      await checkoutRemote(source);
    } catch (e) {
      logger.warn(`未发现远端分支：${source}，跳过集成`);
      return [null, { msg: `未发现远端分支：${source}，跳过集成`, source, target }];
    }
    if (autoRebase) {
      logger.info('检测是否需要 rebase');
      const baselineLastedCommit = await git.revparse([baseline]);
      const sourceForkCommit = (await git.raw(['merge-base', baseline, source])).replace(/\r|\n/gi, '');
      if (!sourceForkCommit) {
        logger.warn(`获取祖先节点失败，不进行 rebase`);
      }else if (baselineLastedCommit !== sourceForkCommit) {
        logger.log(`基线最新的提交记录:${baselineLastedCommit}`);
        logger.log(`从基线拉出时的提交:${sourceForkCommit}`);
        try {
          logger.warn(`${source}落后于${baseline}，尝试 rebase ${baseline}`);
          await git.raw(['rebase', baseline]);
          logger.log(`${source} rebase ${baseline} 成功`);
        } catch (err) {
          logger.error(`${source} rebase ${baseline} 失败,请在本地 rebase 后重新提交`);
          await git.rebase({ '--abort': true }).catch(() => {});
          return [err, { err, message: `${source} rebase ${baseline} 失败,请在本地 rebase 后重新提交` }];
        }
      } else {
        logger.info('不需要 rebase ');
      }
    }
    await checkout(tempBranch);
    const [err, res] = await git
      .mergeFromTo(`${source}`, tempBranch)
      .then((res) => [null, { ...JSON.parse(JSON.stringify(res)), source, target }])
      .catch(async (err) => {
        logger.error('merge error', err, err.git, Object.keys(err), JSON.stringify(err));
        const conflictsList = err.git.conflicts.map(({ file }) => file);
        await git.merge({ '--abort': true });
        const conflictsBranch = (
          await asyncMap(conflictsList, async (file) => {
            const fileLog = await git.log({ file });
            const commitRef = await git.branch(['-r', '--contains', fileLog.latest.hash]);
            return commitRef.all;
          })
        ).reduce((acc, item) => [...new Set([...acc, ...item])], []);
        conflictsBranch.forEach((conflictBranch) => {
          logger.error(`${source} 和 ${conflictBranch} 可能存在冲突,请在本地 rebase 后重新提交`);
        });
        return [err, { ...JSON.parse(JSON.stringify(err)), source, target, conflictsBranch }];
      });
    logger[err ? 'error' : 'success'](`集成 ${source} 到 ${target} ${err ? '失败' : '成功'}`);
    return [err, res];
  });
  const errIntegrateRes = integrateRes.filter(([err, res]) => err);
  if (errIntegrateRes.length > 0) {
    return { success: false, msg: '集成失败', data: errIntegrateRes.map(([err, res]) => res) };
  }

  //删除远端目标分支
  logger.log(`删除远端${target}分支`);
  await git.branch(['-D', target]).catch(() => {});
  await git.push(['origin', '-d', target]).catch(() => {});

  //从temp-xxxx拉取 target 分支并推送
  logger.log(`创建新的${target}分支`);
  await checkout(target, tempBranch);
  await git.push(['-u', 'origin', target]);
  return {
    success: true,
    data: integrateRes.map(([err, res]) => res),
    msg: '集成成功',
  };
};

const integrate = async ({ baseline, target, source, current, autoRebase } = { baseline: 'master' }) => {
  if (!target || !source || source.length === 0) {
    logger.warn('无集成目标分支或集成来源分支');
    return { success: true };
  }
  if (!current) {
    //获取需要集成的分支和目标分支
    current = (await git.branch()).current;
  }
  const tempBranch = `temp-${new Date().getTime()}`;

  logger.log('当前分支', current);
  logger.log('主干分支', baseline);
  logger.log('临时分支', tempBranch);
  logger.log('集成分支', target);
  logger.log('来源分支', source);
  logger.log('自动rebase', autoRebase);
  if (!source.includes(current) && baseline !== current) {
    logger.warn('当前分支不属于集成分支');
    return { success: true };
  }
  if (baseline === current) logger.warn('主干分支更新,主动更新');
  await checkoutRemote(baseline);
  await checkout(tempBranch, baseline);

  logger.info('集成任务开始');
  let taskRes;
  try {
    taskRes = await integrateTask({ current, baseline, target, source, tempBranch, autoRebase });
    logger[taskRes.success ? 'success' : 'error']('集成任务结果', JSON.stringify(taskRes));
  } catch (e) {
    logger.error('集成任务异常，中断集成', e);
  }
  logger.log(`还原目录及分支`);
  await checkout(current);
  await git.branch(['-D', tempBranch]);
  logger[taskRes.success ? 'success' : 'error'](`集成任务结束`);
  return taskRes;
};

module.exports = integrate;
