// pages/messages/messages.js
const db = require('../../utils/db.js');
Page({
  data: { list: [], meWx:'' },
  onShow(){
    const me = getApp().globalData.me || {};
    if(!me.wechat) return;
    this.setData({ meWx: me.wechat });
    db.ready.then((dd) => {
      dd.collection('tasks').where(dd.command.or([{pubWechat:me.wechat},{'acceptor.wechat':me.wechat}]))
        .orderBy('createTime','desc').get()
        .then(res=>{
          const arr = (res.data||res).filter(t=>t.status==='ongoing' || t.acceptor);
          this.setData({ list: arr });
        })
        .catch(()=>{});
    });
  },
  goChat(e){
    const t = e.currentTarget.dataset.t;
    const meWx = (getApp().globalData.me||{}).wechat;
    const other = t.pubWechat===meWx ? (t.acceptor&&t.acceptor.wechat) : t.pubWechat;
    wx.navigateTo({ url:'/pages/chat/chat?taskId='+t._id+'&otherWx='+(other||'') });
  }
});
