// pages/profile/profile.js
Page({
  data: { me:{} },
  onShow(){ this.setData({ me: getApp().globalData.me || wx.getStorageSync('me') || {} }); },
  go(e){ wx.navigateTo({ url:e.currentTarget.dataset.url }); },
  logout(){
    wx.removeStorageSync('me');
    getApp().globalData.me = null;
    wx.reLaunch({ url:'/pages/login/login' });
  }
});
