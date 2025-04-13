using System;
using System.Net;
using System.Net.WebSockets;
using System.Text;
using System.Threading;
using System.Threading.Tasks;
using QMusicSupport;
using System.Text.Json;
using System.Runtime.InteropServices;
using System.Diagnostics;
using System.Collections.Generic;
using QMusicSupport.Win32Api;



class Program
{


    static async Task Main(string[] args)
    {
        using (Mutex mutex = new Mutex(true, "QMusicSupport", out bool createdNew))
        {
            if (!createdNew)
            {
                Console.WriteLine("程序已在运行中，即将结束进程");
                Environment.Exit(0);
                return;
            }

            HttpListener httpListener;
            int port = 12689; // 初始端口
            try
            {

                while (true)
                {
                    try
                    {
                        httpListener = new HttpListener();
                        //httpListener.Prefixes.Clear();
                        httpListener.Prefixes.Add($"http://127.0.0.1:{port}/");
                        httpListener.Start();
                        Console.WriteLine($"服务已启动，连接地址：ws://localhost:{port}/");
                        break; // 成功绑定端口，退出循环
                    }
                    catch (HttpListenerException ex) when (ex.ErrorCode == 183 || ex.ErrorCode == 32) // 端口冲突
                    {
                        Console.WriteLine($"端口 {port} 被占用，尝试下一个端口...");
                        port++; // 尝试下一个端口
                    }
                }

                while (!httpListener.IsListening) await Task.Delay(100);

                while (true)
                {
                    try
                    {
                        HttpListenerContext context = await httpListener.GetContextAsync();
                        if (context.Request.IsWebSocketRequest)
                        {
                            HttpListenerWebSocketContext webSocketContext = await context.AcceptWebSocketAsync(null);
                            _ = Task.Run(() => SendMusicInfo(webSocketContext.WebSocket));
                        }
                        else
                        {
                            context.Response.StatusCode = 400;
                            context.Response.Close();
                        }
                    }
                    catch (Exception ex)
                    {
                        Console.WriteLine($"主循环错误: {ex.Message}");
                        await Task.Delay(5000);
                    }
                }
            }
            catch (HttpListenerException ex)
            {
                Console.WriteLine($"HTTP监听错误: {ex.ErrorCode} - {ex.Message}");
            }
            finally
            {
                //httpListener.Stop();
                Console.WriteLine("WebSocket服务停止");
            }
        }
    }
    
    

    private static async Task SendMusicInfo(WebSocket webSocket)
    {
        try
        {
         
            var cts = new CancellationTokenSource();
            var receiveTask = Task.Run(async () =>
            {
                var buffer = new byte[1024];
                while (webSocket.State == WebSocketState.Open)
                {
                    var receiveResult = await webSocket.ReceiveAsync(new ArraySegment<byte>(buffer), cts.Token);
                    if (receiveResult.MessageType == WebSocketMessageType.Text)
                    {
                        var jsonstr = Encoding.UTF8.GetString(buffer, 0, receiveResult.Count);
                        Console.WriteLine($"Received: {jsonstr}");
                        var jsonDocument = JsonDocument.Parse(jsonstr);
                        if (jsonDocument.RootElement.TryGetProperty("command", out JsonElement commandElement) &&
                            jsonDocument.RootElement.TryGetProperty("arg", out JsonElement argElement))
                        {
                            var command = commandElement.GetString();
                            var arg = argElement.GetInt32();
                            HandleMediaCommand(command, arg);
                        }
                    }
                }
            }, cts.Token);

            using (webSocket)
            {
                while (webSocket.State == WebSocketState.Open)
                {
                    TencentMusic tencentMusic = new TencentMusic();
                    var trackInfo = tencentMusic.GetCurrentTrack(null);

                    var currentVolume = Control.GetVolume();
                    var trackInfoDict = JsonSerializer.Deserialize<Dictionary<string, object>>(JsonSerializer.Serialize(trackInfo));
                    trackInfoDict["volume"] = currentVolume;

                    var json = JsonSerializer.Serialize(trackInfoDict, new JsonSerializerOptions
                    {
                        IgnoreNullValues = true,
                        PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
                        WriteIndented = false
                    });

                    var buffer = Encoding.UTF8.GetBytes(json);

                    try
                    {
                        await webSocket.SendAsync(new ArraySegment<byte>(buffer), WebSocketMessageType.Text, true, CancellationToken.None);
                        await Task.Delay(500, cts.Token);
                    }
                    catch
                    {
                        break;
                    }
                }
            }
        }
        catch (WebSocketException ex)
        {
            Console.WriteLine($"WebSocket错误 [{webSocket?.State}]: {ex.Message}");
        }
        finally
        {
            if (webSocket?.State == WebSocketState.Open || webSocket?.State == WebSocketState.CloseReceived)
            {
                await webSocket.CloseAsync(WebSocketCloseStatus.NormalClosure, "Closing", CancellationToken.None);
            }
            webSocket?.Dispose();
            Console.WriteLine($"WebSocket连接关闭: {webSocket?.CloseStatus ?? WebSocketCloseStatus.Empty}");
        }
    }




    private static void HandleMediaCommand(string command, int arg)
    {
        switch (command.ToLower())
        {
            case "play":
            case "stop":  // Play/Pause使用同一个物理按键
                Control.PlayPause();
                Console.WriteLine($"已发送播放/暂停命令");
                break;
            case "next":
                Control.Next();
                Console.WriteLine("已发送下一首命令");
                break;
            case "prev":
                Control.Prev();
                Console.WriteLine("已发送上一首命令");
                break;
            case "volume":
                Control.SetVolume(arg);
                Console.WriteLine($"已设置音量: {arg}");
                break;
            case "progress":
                TencentMusic tencentMusic = new TencentMusic();
                tencentMusic.SetCurrentTrack(arg);
                Console.WriteLine($"已设置进度: {arg}");
                break;
            default:
                Console.WriteLine($"未知命令: {command}，参数: {arg}");
                break;
        }
    }
}
