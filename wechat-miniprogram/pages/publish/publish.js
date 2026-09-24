// pages/publish/publish.js
const { check } = require('../../utils/sensitive.js');
const db = require('../../utils/db.js');
Page({
  data: { types:[['express','代拿快递'],['food','代拿外卖'],['lost','失物招领']], typeIdx:0, type:'express',
    item:'', pickup:'', building:'', weight:'', deadline:'', reward:'', remark:'', showWarn:false },
  onType(e){ const i=+e.detail.value; this.setData({ typeIdx:i, type:this.data.types[i][0], reward: i===2?'':this.data.reward }); },
  onIn(e){ this.setData({ [e.currentTarget.dataset.f]: e.detail.value }); },
  submit(){
    const d=this.data;
    if(!d.pickup||!d.building||!d.deadline){ wx.showToast({title:'请填全取件/送达/截止时间',icon:'none'}); return; }
    if(d.type!=='lost'){
      if(!d.item){ wx.showToast({title:'请填要拿的东西',icon:'none'}); return; }
      if(!d.reward){ wx.showToast({title:'请填报酬金额',icon:'none'}); return; }
    }
    const c=check(d.remark+' '+d.pickup+' '+d.item); if(!c.ok){ wx.showModal({title:'无法发布',content:c.msg,showCancel:false}); return; }
    this.setData({ showWarn:true });
  },
  confirmWarn(){
    if(this._sending) return; this._sending = true;
    this.setData({ showWarn:false });
    const me = getApp().globalData.me || {};
    const d = this.data;
    wx.showLoading({ title:'发布中' });
    db.ready.then((dd) => {
      return dd.collection('tasks').add({
        data: {
          type: d.type, item: d.item, pickup: d.pickup, building: d.building, weight: d.weight,
          deadline: d.deadline, reward: d.type==='lost' ? '' : d.reward,
          remark: d.remark,
          status: 'approved',
          pubOpenid: '', pubName: me.nick||'同学', pubWechat: me.wechat||'',
          pubAvatar: me.avatar||'', pubInfo: { realName: me.realName||'', college: me.college||'', grade: me.grade||'' },
          acceptor: null,
          createTime: new Date()
        }
      });
    }).then(()=>{
      wx.hideLoading(); this._sending = false;
      console.log('[发布] 已写入任务');
      wx.showToast({ title:'发布成功', icon:'success' });
      setTimeout(()=> wx.switchTab({ url:'/pages/index/index' }), 700);
    }).catch((e)=>{
      wx.hideLoading(); this._sending = false;
      console.error(e);
      wx.showModal({ title:'发布失败', content:(e&&e.message)||'请稍后重试', showCancel:false });
    });
  },
  cancelWarn(){ this.setData({ showWarn:false }); }
});
