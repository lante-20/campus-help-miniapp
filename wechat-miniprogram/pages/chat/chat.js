// pages/chat/chat.js
const { containsPhone } = require('../../utils/sensitive.js');
const db = require('../../utils/db.js');
Page({
  data: { msgs:[], input:'', taskId:'', otherWx:'' },
  onLoad(q){
    const me = getApp().globalData.me || {};
    this.setData({ taskId: q.taskId||'', otherWx: q.otherWx||'', meWx: me.wechat||'' });
    this.load();
    this._timer = setInterval(()=>this.load(), 3000);
  },
  onUnload(){ if(this._timer){ clearInterval(this._timer); this._timer=null; } },
  load(){
    db.ready.then((dd) => {
      dd.collection('messages').where({ taskId: this.data.taskId })
        .orderBy('time','asc').get().then((res)=>{
          this.setData({ msgs: res.data||res });
        }).catch(()=>{});
    });
  },
  onIn(e){ this.setData({ input:e.detail.value }); },
  send(){
    const v=this.data.input.trim();
    if(!v) return;
    if(containsPhone(v)){ wx.showModal({title:'已拦截',content:'平台禁止互换手机号，请通过微信号联系。',showCancel:false}); return; }
    const me = getApp().globalData.me || {};
    db.ready.then((dd) => {
      return dd.collection('messages').add({
        data:{ taskId:this.data.taskId, fromWx:me.wechat, fromName:me.nick, toWx:this.data.otherWx, text:v, time:new Date() }
      });
    }).then(()=>{ this.setData({ input:'' }); this.load(); })
      .catch(()=> wx.showToast({title:'发送失败',icon:'none'}));
  },
  report(){
    wx.showModal({ title:'举报', content:'确定举报该对话吗? 管理员将收到记录。', success:(r)=>{
      if(!r.confirm) return;
      db.ready.then((dd) => {
        return dd.collection('reports').add({
          data:{ taskId:this.data.taskId, reporterWx:(getApp().globalData.me||{}).wechat, targetWx:this.data.otherWx, reason:'聊天中违规', time:new Date() }
        });
      }).then(()=> wx.showToast({title:'已提交举报',icon:'success'}))
        .catch(()=> wx.showToast({title:'举报失败',icon:'none'}));
    }});
  }
});
