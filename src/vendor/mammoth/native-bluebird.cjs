/*! @license GPL-2.0-or-later | https://github.com/phphtmledit/editor */
'use strict';

class MammothPromise extends Promise {
  tap(callback) {
    return this.then((value) =>
      MammothPromise.resolve(callback(value)).then(() => value),
    );
  }

  caught(callback) {
    return this.catch(callback);
  }

  done(onFulfilled, onRejected) {
    this.then(onFulfilled, onRejected).catch((error) => {
      queueMicrotask(() => {
        throw error;
      });
    });
  }
}

MammothPromise.Promise = MammothPromise;
MammothPromise.resolve = (value) => Promise.resolve.call(MammothPromise, value);
MammothPromise.reject = (reason) => Promise.reject.call(MammothPromise, reason);
MammothPromise.all = (values) => Promise.all.call(MammothPromise, values);
MammothPromise.props = (object) => {
  const entries = Object.entries(object);
  return MammothPromise.all(entries.map(([, value]) => value)).then((values) =>
    Object.fromEntries(entries.map(([key], index) => [key, values[index]])),
  );
};
MammothPromise.promisify = (func) => function promisified(...args) {
  return new MammothPromise((resolve, reject) => {
    func.call(this, ...args, (error, value) => {
      if (error) reject(error);
      else resolve(value);
    });
  });
};
MammothPromise.mapSeries = (values, callback) => {
  const results = [];
  return Array.from(values).reduce(
    (chain, value, index) => chain
      .then(() => callback(value, index, values.length))
      .then((result) => {
        results.push(result);
      }),
    MammothPromise.resolve(),
  ).then(() => results);
};
MammothPromise.attempt = (callback) => {
  try {
    return MammothPromise.resolve(callback());
  } catch (error) {
    return MammothPromise.reject(error);
  }
};

module.exports = function createMammothPromise() {
  return MammothPromise;
};
