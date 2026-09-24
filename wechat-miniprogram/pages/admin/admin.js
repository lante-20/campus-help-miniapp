// pages/admin/admin.js
const db = require('../../utils/db.js');
Page({
  data: { reports: [] },
  onShow(){
    db.ready.then((dd) => {
      dd.collection('reports').orderBy('time','desc').get()
        .then(res=> this.setData({ reports: res.data||res }))
        .catch(()=>{});
    });
  }
});
