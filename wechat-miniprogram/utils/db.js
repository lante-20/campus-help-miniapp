// utils/db.js — 本地存储版数据库（无需服务器，免费）
// 模拟 wx.cloud 的异步 API，所有页面不用改
const PREFIX = 'col_';

function readCol(name) {
  try { return wx.getStorageSync(PREFIX + name) || []; } catch(e){ return []; }
}
function writeCol(name, arr) {
  wx.setStorageSync(PREFIX + name, arr);
}

function match(doc, where) {
  if (!where || typeof where !== 'object') return true;
  for (const k in where) {
    const cond = where[k];
    if (cond && typeof cond === 'object' && cond.__op) {
      if (cond.__op === 'in') { if (cond.values.indexOf(doc[k]) < 0) return false; }
    } else if (cond && typeof cond === 'object' && cond.__or) {
      // or([...]) handled by caller
    } else {
      if (doc[k] !== cond) return false;
    }
  }
  return true;
}

function Query(colName, where, orGroup) {
  this.colName = colName; this.where = where || {}; this.orGroup = orGroup || null;
  this._orderBy = null; this._limit = 999;
}
Query.prototype.orderBy = function(f, dir) { this._orderBy = {f, dir}; return this; };
Query.prototype.limit = function(n) { this._limit = n; return this; };
Query.prototype.get = function() {
  let arr = readCol(this.colName);
  if (this.orGroup) {
    arr = arr.filter(doc => this.orGroup.some(cond => match(doc, cond)));
  } else {
    arr = arr.filter(doc => match(doc, this.where));
  }
  if (this._orderBy) {
    const f = this._orderBy.f, d = this._orderBy.dir === 'desc' ? -1 : 1;
    arr = arr.slice().sort((a,b)=>{
      const av = a[f], bv = b[f];
      if (av < bv) return -1*d; if (av > bv) return 1*d; return 0;
    });
  }
  arr = arr.slice(0, this._limit);
  return Promise.resolve({ data: arr });
};

function Collection(name) { this.name = name; }
Collection.prototype.add = function({ data }) {
  const arr = readCol(this.name);
  const doc = Object.assign({ _id: 'id' + Date.now() + Math.floor(Math.random()*1000) }, data);
  arr.push(doc); writeCol(this.name, arr);
  return Promise.resolve({ _id: doc._id });
};
Collection.prototype.where = function(w) {
  if (w && w.__or) return new Query(this.name, null, w.__or);
  return new Query(this.name, w);
};
Collection.prototype.doc = function(id) {
  const self = this;
  return {
    update({ data }) {
      const arr = readCol(self.name);
      for (let i=0;i<arr.length;i++){ if(arr[i]._id===id){ arr[i]=Object.assign({},arr[i],data); } }
      writeCol(self.name, arr);
      return Promise.resolve({});
    },
    get() {
      const arr = readCol(self.name);
      const found = arr.find(x=>x._id===id);
      return Promise.resolve({ data: found });
    }
  };
};

const db = {
  command: {
    in: (values) => ({ __op:'in', values }),
    or: (arr) => ({ __or: arr })
  },
  collection(name) { return new Collection(name); }
};

module.exports = {
  ready: Promise.resolve(db),
  db: () => Promise.resolve(db),
  collection: (name) => Promise.resolve(new Collection(name))
};
