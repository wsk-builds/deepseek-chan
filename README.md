# DeepSeek-chan

大肥鱼 / DeepSeekちゃん 的公开 Live2D 模型，以及一个可以拉近查看细节、切换动作和装扮的演示页。

**演示：** https://wsk-builds.github.io/deepseek-chan/

## 演示里可以做什么

- 滚轮对准画面拉近、拉远，或用底部的「拉近 / 拉远」和镜头预设
- 拖拽平移，双击在全身和面部之间切换
- 鼠标移动时模型会看向指针
- 切换待机、脱捕，以及举手、狗尾草、竖食指
- 切换眼睛、脸红、眼镜、钢盆、裙长、体型和尾巴

## 仓库内容

| 路径 | 内容 |
| --- | --- |
| `DeepSeek/` | VTube Studio 可用的模型、动作、表情和 4096 贴图 |
| `DeepSeek/viewer.model3.json` | 演示页使用的模型入口，补上了动作引用 |
| `psd/` | 分层 PSD。文件超过 GitHub 单文件限制，通过 Git LFS 存放 |
| `index.html` | GitHub Pages 演示 |

原始的 `大肥鱼.model3.json` 没有改动，仍然按原来的方式给 VTube Studio 使用。

## 本地预览

在仓库根目录启动静态服务器后打开页面。直接双击 `index.html` 会因浏览器的本地文件限制而加载失败。

```bash
python -m http.server 8765
```

然后访问 http://localhost:8765/

页面从 Live2D 官方地址加载 Cubism Core，仓库里没有再分发这份运行库。Live2D 是 Live2D Inc. 的商标。
