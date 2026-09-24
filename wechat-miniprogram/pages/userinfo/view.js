// 兼容旧页面链接，不将 URL 参数用作身份或权限依据。
Page({
  data: { d: {} },
  onLoad(q) {
    try {
      const raw = JSON.parse(decodeURIComponent(q.data || '{}'));
      const d = {};
      ['nick', 'wechat', 'avatar', 'realName', 'college', 'grade'].forEach(field => {
        d[field] = typeof raw[field] === 'string' ? raw[field].slice(0, 300) : '';
      });
      this.setData({ d });
    } catch (error) {
      wx.showToast({ title: '资料链接无效', icon: 'none' });
    }
  }
});
