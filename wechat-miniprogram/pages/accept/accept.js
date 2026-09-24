const session = require('../../utils/session');
const service = require('../../utils/task-service');
Page({
  data: { id: '', saving: false },
  onLoad(q) { this.setData({ id: q.id || '' }); },
  onShow() { session.ensurePage(); },
  async confirm() {
    if (this.data.saving || !session.ensurePage()) return;
    this.setData({ saving: true });
    try {
      await service.accept(this.data.id);
      wx.showModal({ title: '接取成功', content: '可以在任务详情或“消息”中查看本机演示对话。', showCancel: false, success: () => wx.navigateBack() });
    } catch (error) {
      wx.showModal({ title: '无法接取', content: error.message || '请刷新后重试', showCancel: false });
    } finally { this.setData({ saving: false }); }
  }
});
