// pages/detail/detail.js
const TYPES = { express:'代拿快递', food:'代拿外卖', lost:'失物招领' };
const db = require('../../utils/db.js');
Page({
  data: { t:{}, isPub:false, statusText:'' },
  onLoad(q){
    this._id = q.id;
    const me = getApp().globalData.me || {};
    this._myWx = me.wechat || '';
    this.load();
  },
  onShow(){ if(this._id) this.load(); },
  load(){
    db.ready.then((dd) => {
      dd.collection('tasks').doc(this._id).get().then((res) => {
        const t = res.data || res;
        if(!t) return;
        this.setData({ t, typeLabel: TYPES[t.type]||'', isPub: t.pubWechat===this._myWx,
          statusText: t.status==='ongoing' ? '进行中' : (t.status==='done'?'已完成':'待接单') });
      }).catch((e)=>console.error(e));
    });
  },
  copyWechat(){ if(this.data.t.pubWechat) wx.setClipboardData({ data:this.data.t.pubWechat }); },
  viewPub(){
    const d = Object.assign({}, this.data.t.pubInfo, { nick:this.data.t.pubName, wechat:this.data.t.pubWechat, avatar:this.data.t.pubAvatar });
    wx.navigateTo({ url:'/pages/userinfo/view?data='+encodeURIComponent(JSON.stringify(d)) });
  },
  goAccept(){ wx.navigateTo({ url:'/pages/accept/accept?id='+this._id }); },
  contact(){
    const other = this.data.t.pubWechat===this._myWx ? (this.data.t.acceptor&&this.data.t.acceptor.wechat) : this.data.t.pubWechat;
    wx.navigateTo({ url:'/pages/chat/chat?taskId='+this._id+'&otherWx='+(other||'') });
  },
  finishTask(){
    wx.showModal({ title:'结束任务', content:'确认任务已完成并下线吗?', success:(r)=>{
      if(!r.confirm) return;
      db.ready.then((dd) => {
        dd.collection('tasks').doc(this._id).update({ data:{ status:'done' } })
          .then(()=>{
            wx.showToast({title:'已下架',icon:'success'});
            setTimeout(()=> wx.switchTab({ url:'/pages/index/index' }), 600);
          })
          .catch(()=> wx.showToast({title:'操作失败',icon:'none'}));
      });
    }});
  }
});
