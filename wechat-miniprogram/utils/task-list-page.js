const db = require('./db');
const config = require('../config');
const session = require('./session');
const service = require('./task-service');

module.exports = function taskListPage(kind) {
  return {
    data: { list: [], loading: false, error: '', hasMore: false },
    onShow() { if (session.ensurePage()) this.load(); },
    onHide() { this._request = (this._request || 0) + 1; },
    onPullDownRefresh() { this.load(); },
    onReachBottom() { this.loadMore(); },
    load() { return this.fetchList(true); },
    loadMore() { if (this.data.hasMore && !this.data.loading) return this.fetchList(false); },
    async fetchList(reset) {
      const me = session.current();
      if (!me) return;
      const request = this._request = (this._request || 0) + 1;
      const offset = reset ? 0 : this.data.list.length;
      this.setData({ loading: true, error: '', list: reset ? [] : this.data.list });
      try {
        const dd = await db.ready;
        let condition;
        if (kind === 'published') condition = { pubWechat: me.wechat };
        else if (kind === 'accepted') condition = { 'acceptor.wechat': me.wechat };
        else condition = dd.command.or([{ pubWechat: me.wechat }, { 'acceptor.wechat': me.wechat }]);
        // 本机列表先过滤出确实存在的对话，再分页，避免空对话占用页数。
        const result = await dd.collection('tasks').where(condition)
          .orderBy('createTime', 'desc').orderBy('_id', 'desc').get();
        const rows = kind === 'messages' ? result.data.filter(task =>
          task.acceptor && ['ongoing', 'done'].indexOf(task.status) >= 0) : result.data;
        if (request !== this._request) return;
        const next = rows.slice(offset, offset + config.pageSize).map(task => service.decorate(task, me));
        this.setData({ list: (reset ? [] : this.data.list).concat(next), hasMore: rows.length > offset + next.length });
      } catch (error) {
        if (request === this._request) this.setData({ error: error.message || '加载失败，请重试' });
      } finally {
        if (request === this._request) this.setData({ loading: false });
        wx.stopPullDownRefresh();
      }
    },
    goDetail(e) {
      wx.navigateTo({ url: '/pages/detail/detail?id=' + encodeURIComponent(e.currentTarget.dataset.id) });
    },
    goChat(e) {
      wx.navigateTo({ url: '/pages/chat/chat?taskId=' + encodeURIComponent(e.currentTarget.dataset.id) });
    }
  };
};
