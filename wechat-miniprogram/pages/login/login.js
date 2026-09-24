// pages/login/login.js
Page({
  data: { avatar:'', nick:'', wechat:'', code:'', phone:'' },
  onLoad(){
    wx.login({ success: (res) => this.setData({ code: res.code }) });
  },
  chooseAvatar(e){ this.setData({ avatar: e.detail.avatarUrl }); },
  onNick(e){ this.setData({ nick: e.detail.value }); },
  onWechat(e){ this.setData({ wechat: e.detail.value.trim() }); },
  onGetPhone(e){
    if(!e.detail.code){ wx.showToast({ title:'已取消授权', icon:'none' }); return; }
    wx.showLoading({ title:'校验中' });
    wx.cloud.callFunction({
      name:'getPhoneNumber',
      data:{ code: e.detail.code },
      success: (r)=>{
        wx.hideLoading();
        if(r.result && r.result.ok){
          const p = r.result.purePhone || r.result.phone;
          this.setData({ phone: p ? p.replace(/(\d{3})\d{4}(\d{4})/, '$1****$2') : '' });
          wx.showToast({ title:'手机号已授权', icon:'success' });
        } else {
          wx.showModal({ title:'提示', content:(r.result&&r.result.msg)||'手机号授权失败,可跳过,不影响登录', showCancel:false });
        }
      },
      fail: ()=>{ wx.hideLoading(); wx.showModal({ title:'提示', content:'云函数未部署,手机号可跳过,先登录体验。详见说明。', showCancel:false }); }
    });
  },
  login(){
    if(!this.data.avatar){ wx.showToast({title:'请点头像授权',icon:'none'}); return; }
    if(!this.data.nick){ wx.showToast({title:'请填写昵称',icon:'none'}); return; }
    if(!this.data.wechat){ wx.showToast({title:'请填写微信号(必填)',icon:'none'}); return; }
    if(!/^[a-zA-Z][a-zA-Z0-9_-]{5,19}$/.test(this.data.wechat)){ wx.showToast({title:'微信号格式不对(6-20位字母开头)',icon:'none'}); return; }
    const me = {
      avatar: this.data.avatar, nick: this.data.nick,
      wechat: this.data.wechat, phone: this.data.phone || '', code: this.data.code || ''
    };
    wx.setStorageSync('me', me);
    getApp().globalData.me = me;
    // 同步到 users 集合
    wx.cloud.database().collection('users').where({ wechat: me.wechat }).get()
      .then(r=>{
        if(r.data.length){ wx.cloud.database().collection('users').doc(r.data[0]._id).update({data:me}); }
        else { wx.cloud.database().collection('users').add({ data: me }); }
      }).catch(()=>{});
    wx.showToast({ title:'登录成功', icon:'success' });
    setTimeout(()=> wx.switchTab({ url:'/pages/index/index' }), 600);
  }
});
