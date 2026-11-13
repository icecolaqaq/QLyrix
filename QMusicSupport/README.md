# QMusicSupport

## 项目概述

QMusicSupport 是一个用于读取QQ音乐的播放信息应用程序。
该项目采用 .NET 9.0 框架开发，仅支持 Windows 平台
QQ音乐21.31 win11 测试通过

## 功能

读取QQ音乐客户端的当前播放信息，并启动一个websocket服务，提供给其他应用程序使用。
接受以下命令：

- `play`：播放音乐
- `stop`：暂停播放
- `next`：播放下一首音乐
- `prev`：播放上一首音乐
  其他命令请阅读源码,随时可能因QQ音乐更新失效^.^

## 使用方法

运行 `QMusicSupport.exe` 即可启动服务。

### 环境要求

- **操作系统**：Windows
- **.NET 运行时**：.NET 9.0

## Thanks

- [NetEase-Cloud-Music-DiscordRPC](https://github.com/Kxnrl/NetEase-Cloud-Music-DiscordRPC/)：核心代码实现

## Others

Made with ❤️ by ifeng in 2025-04-01
