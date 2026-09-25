const db = require('../../utils/db');
const config = require('../../config');
const session = require('../../utils/session');
const service = require('../../utils/task-service');
Page({
  data: {
    list: [], filter: 'all', loading: false, error: '', hasMore: false,
    chips: [{ value: 'all', label: '全部' }, { value: 'express', label: '代拿快递' },
      { value: 'food', label: '代拿外卖' }, { value: 'lost', label: '失物招领' }]
  },
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
      const condition = { status: dd.command.in(['approved', 'ongoing']) };
      if (this.data.filter !== 'all') condition.type = this.data.filter;
      const result = await dd.collection('tasks').where(condition)
        .orderBy('createTime', 'desc').orderBy('_id', 'desc')
        .skip(offset).limit(config.pageSize + 1).get();
      if (request !== this._request) return;
      const rows = result.data.slice(0, config.pageSize).map(task => service.decorate(task, me));
      this.setData({ list: (reset ? [] : this.data.list).concat(rows), hasMore: result.data.length > config.pageSize });
    } catch (error) {
      if (request === this._request) this.setData({ error: error.message || '加载失败，请重试' });
    } finally {
      if (request === this._request) this.setData({ loading: false });
      wx.stopPullDownRefresh();
    }
  },
  setFilter(e) {
    this.setData({ filter: e.currentTarget.dataset.k });
    this.load();
  },
  goDetail(e) { wx.navigateTo({ url: '/pages/detail/detail?id=' + encodeURIComponent(e.currentTarget.dataset.id) }); }
});
