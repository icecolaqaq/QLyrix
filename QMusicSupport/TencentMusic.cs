using System;
using System.Diagnostics;
using System.Runtime.InteropServices;
using QMusicSupport.Models;
using QMusicSupport.Players;
using static System.Windows.Forms.AxHost;
using static QMusicSupport.Players.Tencent;

namespace QMusicSupport
{
    [ComVisible(true)]
    [Guid("6D437C8B-8B86-4B6F-9F78-9F3D801F0C3C")]
    public class TencentMusic
    {
        public dynamic GetCurrentTrack(dynamic input)
        {
            try
            {
                var processes = Process.GetProcessesByName("QQMusic");
                if (processes.Length == 0)
                    return new { state = 0 }; //"QQMusic未运行"

                using var player = new Tencent(processes[0].Id);
                PlayerInfo? info = player.GetPlayerInfo();
                PlayerInfo minfo = (PlayerInfo)info;
                return info == null ? 
                    new { state = 1 } :  //未检测到播放内容
                    new {
                        id = minfo.Identity,
                        title = minfo.Title,
                        artist = minfo.Artists,
                        album = minfo.Album,
                        cover = minfo.Cover,
                        progress = (int)(minfo.Schedule * 1000),
                        duration = (int)(minfo.Duration * 1000),
                        pause = minfo.Pause,
                        quality = minfo.Quality,
                        state = 2,
                    };
            }
            catch (Exception ex)
            {
                return new { state = 3 };
            }
        }

        public void SetCurrentTrack(int Schedule) {
            var processes = Process.GetProcessesByName("QQMusic");
            if (processes.Length == 0) {
                Console.WriteLine("QQMusic未运行");
            }
            using var player = new Tencent(processes[0].Id);
            if (player.SetSongSchedule(Schedule)) {

                Console.WriteLine($"设置播放进度为 {Schedule} 毫秒");
            }
            else
            {
                Console.WriteLine("设置播放进度失败");
            }
        }

        
    }
}