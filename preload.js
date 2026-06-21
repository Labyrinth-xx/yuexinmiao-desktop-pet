// 渲染进程 <-> 主进程 的受控桥：只暴露这几个动作，不开放 Node 能力。
// （sandbox 默认开启，这里只用 electron 模块，安全）
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('pet', {
  // 资源真实路径由主进程算好返回（避免 asar 内相对路径解析问题）
  getAssets: () => ipcRenderer.invoke('pet:assets'),
  // 命中检测结果：在猫身上 -> 可交互(可拖)；在透明区 -> 穿透
  setInteractive: (on) => ipcRenderer.send('pet:interactive', !!on),
  // 拖拽：按下记起点，移动报相对位移，松开结束
  dragStart: () => ipcRenderer.send('pet:dragStart'),
  dragMove: (dx, dy) => ipcRenderer.send('pet:dragMove', dx, dy),
  dragEnd: () => ipcRenderer.send('pet:dragEnd'),
});
