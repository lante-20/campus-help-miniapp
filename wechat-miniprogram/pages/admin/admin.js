const db = require('../../utils/db');
const session = require('../../utils/session');
Page({
  data: { reports: [], loading: false, error: '' },
  onShow() { if (session.ensurePage()) this.load(); },
  async load() {
    this.setData({ loading: true, error: '' });
    try {
      const dd = await db.ready;
      const result = await dd.collection('reports').orderBy('time', 'desc').get();
      this.setData({ reports: result.data });
    } catch (error) { this.setData({ error: error.message || '读取举报失败，请重试' }); }
    finally { this.setData({ loading: false }); }
  }
});
