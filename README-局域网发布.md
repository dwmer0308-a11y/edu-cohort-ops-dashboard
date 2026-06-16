# 营期转化监控看板：局域网发布

## 适用场景

如果希望同一个办公室 Wi-Fi / 局域网里的其他人也能访问看板，可以启动局域网服务器版本。

## 启动方式

双击：

```text
启动局域网服务器.command
```

或在终端运行：

```bash
HOST=0.0.0.0 PORT=8765 python3 server.py
```

启动后终端会显示类似：

```text
局域网访问地址：http://192.168.1.23:8765
```

把这个地址发给同一个局域网下的人即可。

## 注意

1. 对方必须和你在同一个 Wi-Fi / 局域网。
2. 你的电脑需要保持开机，终端窗口不要关闭。
3. 如果 macOS 弹出防火墙提示，需要允许 Python 接受传入连接。
4. 配置仍然保存在本机：

```text
data/config.json
```

也就是说，大家访问的是你这台电脑上的同一套服务器版本。

## 常驻后台运行

如果不想一直开着终端窗口，可以双击：

```text
安装为局域网常驻服务.command
```

它会把看板注册成 macOS 用户级后台服务，保持运行，并在登录后自动启动。

查看、重启或停止服务：

```text
管理看板服务.command
```

服务健康检查地址：

```text
http://127.0.0.1:8765/api/health
```

命令行停止常驻服务：

```bash
launchctl unload ~/Library/LaunchAgents/com.calligraphy.dashboard.lan.plist
```
