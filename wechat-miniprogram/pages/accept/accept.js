// pages/accept/accept.js
const db = require('../../utils/db.js');
Page({
  data: { id:'' },
  onLoad(q){ this.setData({ id: q.id }); },
  confirm(){
    const me = getApp().globalData.me || {};
    if(!me.wechat){ wx.showToast({title:'请先在我的页填微信号',icon:'none'}); return; }
    wx.showLoading({ title:'接单中' });
    db.ready.then((dd) => {
      return dd.collection('tasks').doc(this.data.id).update({
        data: { status:'ongoing', acceptor:{ name:me.nick, wechat:me.wechat, avatar:me.avatar } }
      });
    }).then(()=>{
      wx.hideLoading();
      wx.showModal({ title:'接单成功', content:'已为你和发布者开启沟通，请尽快加微信联系取件。交易与安全风险自负。', showCancel:false, success:()=>wx.navigateBack() });
    }).catch((e)=>{
      wx.hideLoading(); console.error(e);
      wx.showToast({ title:'接单失败，请重试', icon:'none' });
    });
  }
});
