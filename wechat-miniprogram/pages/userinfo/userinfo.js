const session = require('../../utils/session');
Page({
  data: { info: {}, saving: false },
  onShow() { if (session.ensurePage()) this.setData({ info: Object.assign({}, session.current()) }); },
  onIn(e) {
    const field = e.currentTarget.dataset.f;
    if (['realName', 'college', 'grade', 'building'].indexOf(field) >= 0) this.setData({ ['info.' + field]: e.detail.value });
  },
  async save() {
    if (this.data.saving) return;
    this.setData({ saving: true });
    try {
      await session.saveInfo(this.data.info);
      wx.showToast({ title: '已保存', icon: 'success' });
      wx.navigateBack();
    } catch (error) { wx.showModal({ title: '保存失败', content: error.message, showCancel: false }); }
    finally { this.setData({ saving: false }); }
  }
});
