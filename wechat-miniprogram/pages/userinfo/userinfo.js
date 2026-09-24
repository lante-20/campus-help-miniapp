// pages/userinfo/userinfo.js
Page({
  data: { info:{} },
  onLoad(){ this.setData({ info: wx.getStorageSync('me') || {} }); },
  onIn(e){ this.setData({ ['info.'+e.currentTarget.dataset.f]: e.detail.value }); },
  save(){
    wx.setStorageSync('me', this.data.info);
    getApp().globalData.me = this.data.info;
    wx.showToast({ title:'已保存', icon:'success' });
    setTimeout(()=> wx.navigateBack(), 700);
  }
});
