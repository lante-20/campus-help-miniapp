const session = require('../../utils/session');
const service = require('../../utils/task-service');
Page({
  data: { t: null, loading: true, error: '', saving: false },
  onLoad(q) { this._id = q.id || ''; },
  onShow() { if (session.ensurePage()) this.load(); },
  async load() {
    this.setData({ loading: true, error: '' });
    try {
      const task = await service.getTask(this._id);
      this.setData({ t: service.decorate(task, session.current()) });
    } catch (error) { this.setData({ t: null, error: error.message || '加载失败，请重试' }); }
    finally { this.setData({ loading: false }); }
  },
  goAccept() {
    if (this.data.t && this.data.t.canAccept) wx.navigateTo({ url: '/pages/accept/accept?id=' + encodeURIComponent(this._id) });
  },
  contact() {
    if (this.data.t && this.data.t.canContact) wx.navigateTo({ url: '/pages/chat/chat?taskId=' + encodeURIComponent(this._id) });
  },
  finishTask() {
    if (!this.data.t || !this.data.t.canFinish || this.data.saving) return;
    wx.showModal({ title: this.data.t.finishLabel, content: '结束后该任务将无法继续接取，确认操作吗？', success: async result => {
      if (!result.confirm || this.data.saving) return;
      this.setData({ saving: true });
      try {
        await service.finish(this._id);
        await this.load();
        wx.showToast({ title: '任务已结束', icon: 'success' });
      } catch (error) { wx.showModal({ title: '操作失败', content: error.message, showCancel: false }); }
      finally { this.setData({ saving: false }); }
    } });
  }
});
