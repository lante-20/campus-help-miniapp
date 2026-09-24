const session = require('../../utils/session');
Page({
  data: { me: {} },
  onShow() {
    if (session.ensurePage()) this.setData({ me: session.current() });
  },
  avatarError() { this.setData({ 'me.avatar': '' }); },
  go(e) { wx.navigateTo({ url: e.currentTarget.dataset.url }); },
  logout() {
    try {
      session.logout();
      wx.reLaunch({ url: '/pages/login/login' });
    } catch (error) {
      wx.showModal({ title: '切换失败', content: error.message || '本地存储不可用，请重试', showCancel: false });
    }
  }
});
