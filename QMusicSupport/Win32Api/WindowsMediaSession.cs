using System;
using System.Linq;
using System.Threading.Tasks;
using Windows.Media.Control;

namespace QMusicSupport.Win32Api;

internal static class WindowsMediaSession
{
    public static async Task<bool> TrySetPosition(int processId, int positionMilliseconds)
    {
        if (!OperatingSystem.IsWindowsVersionAtLeast(10, 0, 17763))
        {
            return false;
        }

        try
        {
            var manager = await GlobalSystemMediaTransportControlsSessionManager.RequestAsync();
            var process = System.Diagnostics.Process.GetProcessById(processId);
            var processName = process.ProcessName;

            var session = manager.GetSessions().FirstOrDefault(candidate => IsQMusicSession(candidate, processName));
            if (session is null || session.GetPlaybackInfo()?.Controls?.IsPlaybackPositionEnabled != true)
            {
                return false;
            }

            var timeline = session.GetTimelineProperties();
            var requestedPosition = TimeSpan.FromMilliseconds(Math.Max(0, positionMilliseconds));
            if (timeline.EndTime > timeline.StartTime)
            {
                requestedPosition = TimeSpan.FromTicks(Math.Clamp(
                    requestedPosition.Ticks,
                    timeline.StartTime.Ticks,
                    timeline.EndTime.Ticks));
            }

            return await session.TryChangePlaybackPositionAsync(requestedPosition.Ticks);
        }
        catch
        {
            // QQ 音乐可能没有可控制的 SMTC 会话，调用方会回退到进程内存兼容方案。
            return false;
        }
    }

    private static bool IsQMusicSession(
        GlobalSystemMediaTransportControlsSession session,
        string processName)
    {
        if (!OperatingSystem.IsWindowsVersionAtLeast(10, 0, 17763))
        {
            return false;
        }

        return session.SourceAppUserModelId.Contains(processName, StringComparison.OrdinalIgnoreCase)
               || session.SourceAppUserModelId.Contains("QQMusic", StringComparison.OrdinalIgnoreCase);
    }
}
