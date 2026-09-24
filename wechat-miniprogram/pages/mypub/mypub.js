// pages/mypub/mypub.js
const db = require('../../utils/db.js');
Page({
  data: { list: [] },
  onShow(){
    const me = getApp().globalData.me || {};
    if(!me.wechat){ return; }
    db.ready.then((dd) => {
      dd.collection('tasks').where({ pubWechat: me.wechat })
        .orderBy('createTime','desc').get()
        .then(res=> this.setData({ list: res.data||res }))
        .catch(()=>{});
    });
  }
});
