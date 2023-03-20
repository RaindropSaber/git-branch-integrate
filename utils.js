const colors = require('colors/safe');
const linkExecPormiseFn = (pl) => {
  let next = Promise.resolve();
  const resList = [];
  pl.forEach((p) => {
    next = next.then((res) => {
      resList.push(res);
      return p();
    });
  });
  return next.then((res) => {
    resList.push(res);
    resList.shift();
    return resList;
  });
};

const asyncMap = (arr, fn) => {
  return linkExecPormiseFn(
    arr.map(
      (...arg) =>
        () =>
          fn(...arg)
    )
  );
};

class Logger {
  success(...arg) {
    console.log(...arg.map((s) => colors.green(s)));
  }
  info(...arg) {
    console.log(...arg.map((s) => colors.blue(s)));
  }
  log(...arg) {
    console.log(...arg);
  }
  error(...arg) {
    console.log(...arg.map((s) => colors.red(s)));
  }
  warn(...arg) {
    console.log(...arg.map((s) => colors.yellow(s)));
  }
}
module.exports = {
  asyncMap,
  Logger,
};
