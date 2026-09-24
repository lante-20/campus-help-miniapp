// pages/index/index.js
const TYPES = { express:'代拿快递', food:'代拿外卖', lost:'失物招领' };
const db = require('../../utils/db.js');
Page({
  data: { list: [], chips:[['all','全部'],['express','代拿快递'],['food','代拿外卖'],['lost','失物招领']], filter:'all', typeLabel:TYPES },
  onShow(){
    if(!getApp().globalData.me){ wx.redirectTo({ url:'/pages/login/login' }); return; }
    this.load();
  },
  onPullDownRefresh(){ this.load(); },
  load(){
    db.ready.then((d) => {
      d.collection('tasks').where({ status: d.command.in(['approved','ongoing']) })
        .orderBy('createTime','desc').limit(50).get()
        .then((res) => {
          const arr = res.data || res;
          console.log('[首页] 读到任务数:', arr.length, arr);
          this._raw = arr; this.applyFilter();
          wx.stopPullDownRefresh();
        })
        .catch((e)=>{ console.error(e); wx.stopPullDownRefresh(); });
    });
  },
  applyFilter(){
    const all = this._raw || [];
    this.setData({ list: this.data.filter==='all' ? all : all.filter(t=>t.type===this.data.filter) });
  },
  setFilter(e){ this.setData({ filter:e.currentTarget.dataset.k }, ()=>this.applyFilter()); },
  goDetail(e){ wx.navigateTo({ url:'/pages/detail/detail?id='+e.currentTarget.dataset.id }); }
});
