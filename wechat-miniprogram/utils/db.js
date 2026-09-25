// 本机存储适配器。接口检查只保障演示流程，不是服务端鉴权。
const config = require('../config');
const PREFIX = 'col_';
let sequence = 0;

function assertMode() {
  if (config.mode !== 'local') throw new Error('云端模式尚未实现，请使用 local 模式');
}
function clone(value) {
  return value === undefined ? undefined : JSON.parse(JSON.stringify(value));
}
function readCol(name) {
  assertMode();
  const value = wx.getStorageSync(PREFIX + name);
  if (value === '' || value === undefined || value === null) return [];
  if (!Array.isArray(value)) throw new Error('本地数据格式异常，请先备份数据后再处理');
  return clone(value);
}
function writeCol(name, docs) {
  wx.setStorageSync(PREFIX + name, clone(docs));
}
function valueAt(doc, field) {
  return field.split('.').reduce((value, key) => value == null ? undefined : value[key], doc);
}
function match(doc, condition) {
  if (!condition) return true;
  if (condition.__or) return condition.__or.some(part => match(doc, part));
  return Object.keys(condition).every(field => {
    const expected = condition[field], actual = valueAt(doc, field);
    if (expected && expected.__op === 'in') return expected.values.indexOf(actual) !== -1;
    return actual === expected;
  });
}
function compareValue(value, field) {
  // 兼容旧演示数据中的 ISO 日期字符串和新版时间戳。
  if (field === 'time' || field === 'createTime') {
    const parsed = typeof value === 'number' ? value : Date.parse(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return value;
}
function Query(name, condition, order, limit, offset) {
  this.name = name;
  this.condition = condition || {};
  this.order = order || [];
  this.max = limit === undefined ? Infinity : limit;
  this.offset = offset || 0;
}
Query.prototype.where = function(condition) {
  return new Query(this.name, condition, this.order, this.max, this.offset);
};
Query.prototype.orderBy = function(field, direction) {
  return new Query(this.name, this.condition,
    this.order.concat([{ field, direction }]), this.max, this.offset);
};
Query.prototype.limit = function(count) {
  return new Query(this.name, this.condition, this.order, Math.max(0, count), this.offset);
};
Query.prototype.skip = function(count) {
  return new Query(this.name, this.condition, this.order, this.max, Math.max(0, count));
};
Query.prototype.get = function() {
  return Promise.resolve().then(() => {
    let docs = readCol(this.name).filter(doc => match(doc, this.condition));
    docs.sort((a, b) => {
      for (const order of this.order) {
        const av = compareValue(valueAt(a, order.field), order.field);
        const bv = compareValue(valueAt(b, order.field), order.field);
        if (av < bv) return order.direction === 'desc' ? 1 : -1;
        if (av > bv) return order.direction === 'desc' ? -1 : 1;
      }
      return 0;
    });
    return { data: docs.slice(this.offset, this.offset + this.max) };
  });
};
function Collection(name) {
  Query.call(this, name);
}
Collection.prototype = Object.create(Query.prototype);
Collection.prototype.constructor = Collection;
Collection.prototype.add = function({ data }) {
  return Promise.resolve().then(() => {
    const docs = readCol(this.name);
    const id = data._id || 'id_' + Date.now() + '_' + (++sequence) + '_' + Math.random().toString(36).slice(2, 9);
    if (docs.some(doc => doc._id === id)) throw new Error('记录已存在，请勿重复提交');
    docs.push(Object.assign({}, clone(data), { _id: id }));
    writeCol(this.name, docs);
    return { _id: id };
  });
};
Collection.prototype.doc = function(id) {
  const name = this.name;
  function update(data, expected) {
    return Promise.resolve().then(() => {
      const docs = readCol(name);
      const index = docs.findIndex(doc => doc._id === id);
      if (index < 0) throw new Error('记录不存在或已被删除');
      if (expected && !match(docs[index], expected)) throw new Error('任务状态已变化，请刷新后重试');
      // 单个 JS 上下文内同步检查并写入，中间没有 await；不代表云端事务。
      docs[index] = Object.assign({}, docs[index], clone(data), { _id: id });
      writeCol(name, docs);
      return { stats: { updated: 1 } };
    });
  }
  return {
    get() {
      return Promise.resolve().then(() => {
        const doc = readCol(name).find(item => item._id === id);
        if (!doc) throw new Error('记录不存在或已被删除');
        return { data: doc };
      });
    },
    update({ data }) { return update(data); },
    updateIf(expected, { data }) { return update(data, expected); }
  };
};
const db = {
  command: {
    in: values => ({ __op: 'in', values }),
    or: conditions => ({ __or: conditions })
  },
  collection: name => new Collection(name)
};
module.exports = {
  ready: Promise.resolve(db),
  db: () => Promise.resolve(db),
  collection: name => Promise.resolve(db.collection(name))
};
