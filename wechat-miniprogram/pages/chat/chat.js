const db = require('../../utils/db');
const config = require('../../config');
const session = require('../../utils/session');
const service = require('../../utils/task-service');
Page({
  data: { msgs: [], input: '', taskId: '', meWx: '', loading: false, error: '', sending: false, reporting: false, hasMore: false, scrollTarget: '' },
  onLoad(q) {
    this._limit = config.chatPageSize;
    this.setData({ taskId: q.taskId || '' });
  },
  onShow() {
    if (!session.ensurePage()) return;
    this._visible = true;
    this.load();
  },
  onHide() { this.stop(); },
  onUnload() { this.stop(); },
  stop() {
    this._visible = false;
    this._request = (this._request || 0) + 1;
    this._loading = false;
    if (this._timer) clearTimeout(this._timer);
    this._timer = null;
  },
  async load() {
    if (!this._visible || this._loading) return;
    if (this._timer) clearTimeout(this._timer);
    this._timer = null;
    this._loading = true;
    const request = this._request = (this._request || 0) + 1;
    this.setData({ loading: true });
    try {
      const ctx = await service.conversation(this.data.taskId);
      const dd = await db.ready;
      const pairs = dd.command.or([
        { taskId: this.data.taskId, fromWx: ctx.me.wechat, toWx: ctx.otherWx },
        { taskId: this.data.taskId, fromWx: ctx.otherWx, toWx: ctx.me.wechat }
      ]);
      const result = await dd.collection('messages').where(pairs).orderBy('time', 'desc')
        .orderBy('_id', 'desc').limit(this._limit + 1).get();
      if (request !== this._request || !this._visible) return;
      const msgs = result.data.slice(0, this._limit).reverse();
      const signature = JSON.stringify(msgs);
      const changed = signature !== this._signature;
      const previous = this.data.msgs[this.data.msgs.length - 1];
      const latest = msgs[msgs.length - 1];
      const update = { meWx: ctx.me.wechat, hasMore: result.data.length > this._limit, error: '' };
      if (changed) {
        update.msgs = msgs;
        this._signature = signature;
        // 加载旧消息时保持阅读位置；出现新消息时定位最后一条。
        if (latest && (!previous || latest._id !== previous._id)) update.scrollTarget = 'm_' + latest._id;
      }
      this.setData(update);
    } catch (error) {
      if (request === this._request) this.setData({ error: error.message || '消息加载失败，请重试' });
    } finally {
      if (request === this._request) {
        this._loading = false;
        this.setData({ loading: false });
        if (this._visible && !this.data.error) this._timer = setTimeout(() => this.load(), config.chatPollInterval);
      }
    }
  },
  loadEarlier() {
    if (this._loading) return;
    this._limit += config.chatPageSize;
    return this.load();
  },
  onIn(e) { this.setData({ input: e.detail.value }); },
  async send() {
    if (this.data.sending || !this.data.input.trim()) return;
    const input = this.data.input;
    this.setData({ sending: true });
    try {
      await service.sendMessage(this.data.taskId, input);
      // 保留发送期间继续输入的文字。
      if (this.data.input === input) this.setData({ input: '' });
      await this.load();
    } catch (error) { wx.showModal({ title: '发送失败', content: error.message, showCancel: false }); }
    finally { this.setData({ sending: false }); }
  },
  report() {
    if (this.data.reporting) return;
    wx.showModal({ title: '举报演示', content: '将这段对话的举报记录保存到本机？', success: async result => {
      if (!result.confirm || this.data.reporting) return;
      this.setData({ reporting: true });
      try {
        await service.report(this.data.taskId);
        wx.showToast({ title: '已保存本机举报', icon: 'success' });
      } catch (error) { wx.showModal({ title: '提交失败', content: error.message, showCancel: false }); }
      finally { this.setData({ reporting: false }); }
    } });
  }
});
