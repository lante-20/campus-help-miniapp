// pages/userinfo/view.js
Page({
  data: { d:{} },
  onLoad(q){ if(q.data) this.setData({ d: JSON.parse(decodeURIComponent(q.data)) }); }
});
