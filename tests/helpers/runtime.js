const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const appRoot = path.resolve(__dirname, '../../wechat-miniprogram');
const copy = value => value === undefined ? undefined : JSON.parse(JSON.stringify(value));

function createRuntime(initial = {}) {
  const storage = copy(initial), calls = [], timers = new Map(), cache = new Map();
  let app = { globalData: { me: null } }, pageDefinition, timerId = 0;
  const failures = { read: null, write: null, remove: null };
  const wx = {
    getStorageSync(key) {
      if (failures.read === key) throw new Error('storage read failed');
      return key in storage ? copy(storage[key]) : '';
    },
    setStorageSync(key, value) {
      if (failures.write === key) throw new Error('storage write failed');
      storage[key] = copy(value);
    },
    removeStorageSync(key) {
      if (failures.remove === key) throw new Error('storage remove failed');
      delete storage[key];
    },
    showToast(options) { calls.push(['toast', options]); },
    showModal(options) { calls.push(['modal', options]); },
    switchTab(options) { calls.push(['switchTab', options]); },
    reLaunch(options) { calls.push(['reLaunch', options]); },
    navigateTo(options) { calls.push(['navigateTo', options]); },
    navigateBack() { calls.push(['navigateBack']); },
    stopPullDownRefresh() {},
    env: { USER_DATA_PATH: '/demo-data' },
    getFileSystemManager() { return { copyFileSync: (src, dest) => calls.push(['copyFile', src, dest]) }; },
    login() { throw new Error('local mode must not call wx.login'); }
  };
  Object.defineProperty(wx, 'cloud', { get() { throw new Error('local mode must not use wx.cloud'); } });
  const context = vm.createContext({
    wx, console, getApp: () => app,
    Page: definition => { pageDefinition = definition; },
    App: definition => { app = definition; app.onLaunch.call(app); },
    setTimeout(fn) { const id = ++timerId; timers.set(id, fn); return id; },
    clearTimeout(id) { timers.delete(id); }
  });
  function load(file, parent = path.join(appRoot, 'app.js')) {
    let fullPath = file.startsWith('.') ? path.resolve(path.dirname(parent), file) : path.resolve(appRoot, file);
    if (!path.extname(fullPath)) fullPath += '.js';
    if (!fullPath.startsWith(appRoot + path.sep)) throw new Error('Test loader only permits app files');
    if (cache.has(fullPath)) return cache.get(fullPath).exports;
    const module = { exports: {} };
    cache.set(fullPath, module);
    const wrapper = vm.runInContext('(function(require,module,exports){\n' + fs.readFileSync(fullPath, 'utf8') + '\n})', context, { filename: fullPath });
    wrapper(request => {
      if (!request.startsWith('.')) throw new Error('External module in local app: ' + request);
      return load(request, fullPath);
    }, module, module.exports);
    return module.exports;
  }
  function page(route) {
    const file = path.join(appRoot, route + '.js');
    cache.delete(file);
    load(route + '.js');
    const instance = Object.assign({}, pageDefinition, { data: copy(pageDefinition.data), updates: [] });
    instance.setData = function(update, callback) {
      this.updates.push(Object.keys(update));
      Object.entries(update).forEach(([field, value]) => {
        const keys = field.split('.');
        let object = this.data;
        keys.slice(0, -1).forEach(key => { object = object[key] || (object[key] = {}); });
        object[keys[keys.length - 1]] = copy(value);
      });
      if (callback) callback();
    };
    return instance;
  }
  return { storage, failures, calls, timers, load, page, wx, me: () => app.globalData.me,
    setMe: me => { app.globalData.me = copy(me); } };
}
module.exports = { createRuntime, appRoot, copy, flush: () => new Promise(resolve => setImmediate(resolve)) };
