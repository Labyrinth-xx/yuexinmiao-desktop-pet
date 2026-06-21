// 极简持久化设置：存到 userData/settings.json，无第三方依赖。
const { app } = require('electron');
const fs = require('fs');
const path = require('path');

class Settings {
  constructor() {
    this.file = path.join(app.getPath('userData'), 'settings.json');
    try {
      this.data = JSON.parse(fs.readFileSync(this.file, 'utf8'));
    } catch {
      this.data = {};
    }
  }

  get(key) {
    return this.data[key];
  }

  set(key, value) {
    this.data[key] = value;
    try {
      fs.writeFileSync(this.file, JSON.stringify(this.data));
    } catch {
      /* 写失败不致命，忽略 */
    }
  }
}

module.exports = Settings;
