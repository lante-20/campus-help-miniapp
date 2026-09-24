// app.js
App({
  globalData: {
    me: null
  },
  onLaunch() {
    this.globalData.me = wx.getStorageSync('me') || null;
    // 预热数据库连接（匿名登录）
    require('./utils/db.js');
  }
});
