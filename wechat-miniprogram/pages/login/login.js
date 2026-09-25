const session = require('../../utils/session');
Page({
  data: { avatar: '', nick: '', wechat: '', saving: false },
  onLoad() {
    const me = session.current();
    if (me) wx.switchTab({ url: '/pages/index/index' });
  },
  chooseAvatar(e) { this.setData({ avatar: e.detail.avatarUrl }); },
  clearAvatar() { this.setData({ avatar: '' }); },
  onNick(e) { this.setData({ nick: e.detail.value }); },
  onWechat(e) { this.setData({ wechat: e.detail.value.trim() }); },
  goDocument(e) { wx.navigateTo({ url: '/pages/' + e.currentTarget.dataset.page + '/' + e.currentTarget.dataset.page }); },
  async login() {
    if (this.data.saving) return;
    this.setData({ saving: true });
    try {
      await session.login(this.data);
      wx.switchTab({ url: '/pages/index/index' });
    } catch (error) {
      wx.showModal({ title: '无法进入', content: error.message || '本地保存失败，请重试', showCancel: false });
    } finally {
      this.setData({ saving: false });
    }
  }
});
