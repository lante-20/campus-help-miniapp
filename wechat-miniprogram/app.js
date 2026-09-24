const session = require('./utils/session');
App({
  globalData: { me: null },
  onLaunch() {
    try {
      this.globalData.me = session.restore();
    } catch (error) {
      this.globalData.me = null;
      console.error('读取本机身份失败', error);
      wx.showToast({ title: error.message || '本地数据读取失败', icon: 'none' });
    }
  }
});
