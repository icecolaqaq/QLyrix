using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.Linq;
using System.Net;
using System.Runtime.InteropServices;
using System.Text;
using QMusicSupport.Models;
using QMusicSupport.Win32Api;

namespace QMusicSupport.Players;

internal sealed class Tencent : IMusicPlayer, IDisposable
{
    /*
       版本 20.43 结构
       struct CurrentSongInfo {
           std::string m_szSong; // 0x0
           std::string m_szArtist; // 0x18
           std::string m_szAlbum; // 0x30
           std::string m_szAlbumThumbnailUrl; // 0x48
           uint32_t m_nSongId; // 0x60
           private: char pad_64[0x4]; public:
           uint32_t m_nSongDuration; // 0x68
           uint32_t m_nSongSchedule; // 0x6c
           uint32_t m_nPlayStatus; // 0x70
       }; // Size: 0x74
     */

    // 如何更新Pattern:
    // 1. 在 QQMusic.dll 里搜字符串 "Tencent Technology (Shenzhen) Company Limited", 并且找到引用的函数（理论上只有一个引用）
    // 2. 引用到字符串的是一个初始化的函数，在引用到字符串的地方往上找类似这样的伪代码，理论上来讲这个伪代码会重复3次
    // byte_xxxxx = 0;
    // dword_xxxxx+0x10 = 0;
    // dword_xxxxx+0x14 = 15;
    // 这个是初始化 std::string, 我们要找的是第一个，这个是当前播放的歌的名字
    // 3. 选中然后在汇编页面生成Pattern
    private const string CurrentSongInfoPattern
        = "A2 ? ? ? ? A3 ? ? ? ? C7 05 ? ? ? ? ? ? ? ? A2 ? ? ? ? A3 ? ? ? ? C7 05 ? ? ? ? ? ? ? ? A2 ? ? ? ? A3";

    // QQMusic 22.76+: SetSelectedQualityLevel checks 0/1 and 7/8/9/10 before writing SelectedQualityLevel
    private const string SongQualitySetterPattern
        = "55 8B EC 8B 45 0C 39 05 ? ? ? ? 74 ? 83 F8 01 74 04 85 C0";

    private const string LegacySongQualitySetterPattern
        = "55 8B EC 8B 45 ? 39 05 ? ? ? ? 74 ? A3 ? ? ? ? 8B 45 ? 68 ? ? ? ? 83 78 ? ? 8D 48 ? 74 ?";

    // SelectedQualityLevel = 1; LastNormalSelectedQualityLevel = 1; LastHugeVipSelectedQualityLevel = 9;
    private const string SongQualityInitPattern
        = "C7 05 ? ? ? ? 01 00 00 00 C7 05 ? ? ? ? 01 00 00 00 C7 05 ? ? ? ? 09 00 00 00";

    private const string SongQualityConfigKey = "SelectedQualityLevel";

    private const int StdStringSize = 0x18;

    private readonly nint _currentSongInfoAddress;
    private readonly nint _songQualityAddress;
    private readonly nint _qqMusicDllBase;

    private readonly int mpid;
    private readonly ProcessMemory _process;
    private static readonly object AddressCacheLock = new();
    private static int cachedPid;
    private static nint cachedModuleBase;
    private static nint cachedCurrentSongInfoAddress;
    private static nint cachedSongQualityAddress;

    private static readonly object FavoriteCacheLock = new();
    private static uint favoriteCacheSongId;
    private static bool favoriteCacheValue;
    private static DateTime favoriteCacheTimeUtc = DateTime.MinValue;

    public Tencent(int pid)
    {
        mpid = pid;
        using var p = Process.GetProcessById(pid);
        
        foreach (ProcessModule module in p.Modules)
        {
            if (!"QQMusic.dll".Equals(module.ModuleName, StringComparison.OrdinalIgnoreCase))
            {
                continue;
            }

            var process = new ProcessMemory(pid);

            _qqMusicDllBase = module.BaseAddress;

            lock (AddressCacheLock)
            {
                if (cachedPid == pid
                    && cachedModuleBase == module.BaseAddress
                    && cachedCurrentSongInfoAddress != nint.Zero
                    && cachedSongQualityAddress != nint.Zero)
                {
                    _currentSongInfoAddress = cachedCurrentSongInfoAddress;
                    _songQualityAddress = cachedSongQualityAddress;
                    _process = process;
                    break;
                }
            }

            if (Memory.FindPattern(CurrentSongInfoPattern, pid, module.BaseAddress, out var patternAddress))
            {
                var currentSongAddress = process.ReadInt32(patternAddress, 1);
                _currentSongInfoAddress = currentSongAddress;
            }

            _songQualityAddress = ResolveSongQualityAddress(
                process,
                pid,
                module.BaseAddress,
                module.FileVersionInfo.FileVersion);

            if (_currentSongInfoAddress != nint.Zero && _songQualityAddress != nint.Zero)
            {
                lock (AddressCacheLock)
                {
                    cachedPid = pid;
                    cachedModuleBase = module.BaseAddress;
                    cachedCurrentSongInfoAddress = _currentSongInfoAddress;
                    cachedSongQualityAddress = _songQualityAddress;
                }
            }

            _process = process;

            break;
        }

        if (_process is null)
        {
            throw new EntryPointNotFoundException("Failed to find process");
        }

        if (_currentSongInfoAddress == 0)
        {
            throw new EntryPointNotFoundException("_currentSongInfoAddress is 0");
        }
    }

    public bool Validate(int pid)
        => mpid == pid;

    public PlayerInfo? GetPlayerInfo()
    {
        var id = GetSongIdentity();

        if (id == 0)
        {
            return null;
        }

        return new PlayerInfo
        {
            Identity = id.ToString(),
            Title = GetSongName(),
            Artists = GetArtistName(),
            Album = GetAlbumName(),
            Cover = GetAlbumThumbnailUrl(),
            Schedule = GetSongSchedule() * 0.001,
            Duration = GetSongDuration() * 0.001,
            Pause = IsPaused(),
            Quality = GetSongQulity(),
            IsFavorite = IsFavorite(id),

            // lock
            Url = $"https://y.qq.com/n/ryqq/songDetail/{id}",
        };
    }

    //获取音质 QQMusic 21.92 for Windows
    private int GetSongQulity() 
    {
        if (_songQualityAddress == nint.Zero)
        {
            return -1;
        }

        var quality = _process.ReadInt32(_songQualityAddress); // 0：标准 1：HQ 2：SQ 6：Hi-Res 7/8/9/10：臻品
        return IsSupportedQualityValue(quality) ? quality : -1;
    }
    private uint GetSongIdentity()
        => _process.ReadUInt32(_currentSongInfoAddress, StdStringSize * 4);

    private int GetSongDuration()
        => _process.ReadInt32(_currentSongInfoAddress, (StdStringSize * 4) + 8 /*跳过Id跟一个4字节大小的玩意*/);

    private int GetSongSchedule()
        => _process.ReadInt32(_currentSongInfoAddress, (StdStringSize * 4) + 12);

    private bool IsFavorite(uint songId)
    {
        lock (FavoriteCacheLock)
        {
            if (favoriteCacheSongId == songId && DateTime.UtcNow - favoriteCacheTimeUtc < TimeSpan.FromSeconds(1))
            {
                return favoriteCacheValue;
            }
        }

        var value = ReadFavoriteFlag();
        lock (FavoriteCacheLock)
        {
            favoriteCacheSongId = songId;
            favoriteCacheValue = value;
            favoriteCacheTimeUtc = DateTime.UtcNow;
        }

        return value;
    }

    /// <summary>
    /// 通过搜索getter函数的代码模式来定位喜欢状态标志。
    /// getter函数特征: test ecx,ecx; jnz +0x25; push 1D6h; ... ; mov eax,[dword_10C240BC]
    /// </summary>
    private bool ReadFavoriteFlag()
    {
        if (_qqMusicDllBase == nint.Zero) return false;

        var textStart = _qqMusicDllBase + 0x1000;
        var textSize = 0x97B000;
        var textBytes = _process.ReadBytes(textStart, textSize);

        // 搜索特征: test ecx,ecx (85 C9) + jnz short 25 (75 25) + push 1D6h (68 D6 01 00 00)
        byte[] pattern = { 0x85, 0xC9, 0x75, 0x25, 0x68, 0xD6, 0x01, 0x00, 0x00 };

        for (int i = 0; i < textBytes.Length - pattern.Length - 30; i++)
        {
            bool match = true;
            for (int j = 0; j < pattern.Length; j++)
            {
                if (textBytes[i + j] != pattern[j]) { match = false; break; }
            }

            if (match)
            {
                Console.WriteLine($"[DEBUG] Found pattern at text+0x{i:X}");
                // 找到特征，在后面搜索 A1 指令 (mov eax, [addr])
                for (int k = pattern.Length; k < 60; k++)
                {
                    if (textBytes[i + k] == 0xA1)
                    {
                        var dataAddr = BitConverter.ToUInt32(textBytes, i + k + 1);
                        var moduleBase = (uint)_qqMusicDllBase;
                        var relativeAddr = (int)(dataAddr - moduleBase);
                        Console.WriteLine($"[DEBUG]   Found A1 at offset +0x{k:X}, data_addr=0x{dataAddr:X8} (rel=0x{relativeAddr:X})");

                        // 检查是否在.data段范围内
                        if (relativeAddr >= 0xBF9000 && relativeAddr < 0xC97000)
                        {
                            var val = _process.ReadInt32((nint)dataAddr);
                            Console.WriteLine($"[DEBUG]   Value={val}");
                            if (val == 0 || val == 1)
                            {
                                return val != 0;
                            }
                        }
                    }
                }
            }
        }

        Console.WriteLine("[DEBUG] No pattern match found");
        return false;
    }

    public bool SetSongSchedule(int schedule)
    {
        var seeked = Memory.SetQQMusicPlayProgress(schedule, mpid)
                     || WindowsMediaSession.TrySetPosition(mpid, schedule).GetAwaiter().GetResult();
        if (seeked && _currentSongInfoAddress != nint.Zero)
        {
            _process.WriteInt32(_currentSongInfoAddress + (StdStringSize * 4) + 12, Math.Max(0, schedule));
        }

        return seeked;
    }

    private static nint ResolveSongQualityAddress(
        ProcessMemory process,
        int pid,
        nint moduleBase,
        string? moduleVersion)
    {
        var configAddress = ResolveSongQualityAddressByConfigKey(process, pid, moduleBase);
        if (configAddress != nint.Zero)
        {
            return configAddress;
        }

        if (Memory.FindPattern(SongQualitySetterPattern, pid, moduleBase, out var setterPatternAddress))
        {
            var address = Memory.ReadAbsoluteAddress32(process, setterPatternAddress, 8);
            if (Memory.IsAddressInModule(address, moduleBase)
                && IsSupportedQualityValue(process.ReadInt32(address)))
            {
                return address;
            }
        }

        if (Memory.FindPattern(SongQualityInitPattern, pid, moduleBase, out var initPatternAddress))
        {
            var address = Memory.ReadAbsoluteAddress32(process, initPatternAddress, 2);
            if (Memory.IsAddressInModule(address, moduleBase)
                && IsSupportedQualityValue(process.ReadInt32(address)))
            {
                return address;
            }
        }

        if (string.Equals(moduleVersion?.Trim(), "21.92", StringComparison.OrdinalIgnoreCase)
            && Memory.FindPattern(LegacySongQualitySetterPattern, pid, moduleBase, out var legacySetterAddress))
        {
            var address = Memory.ReadAbsoluteAddress32(process, legacySetterAddress, 8);
            if (Memory.IsAddressInModule(address, moduleBase)
                && IsSupportedQualityValue(process.ReadInt32(address)))
            {
                return address;
            }
        }

        return nint.Zero;
    }

    private static bool IsSupportedQualityValue(int value)
        => value is 0 or 1 or 2 or 6 or 7 or 8 or 9 or 10;

    private static nint ResolveSongQualityAddressByConfigKey(ProcessMemory process, int pid, nint moduleBase)
    {
        // Match null-terminated "SelectedQualityLevel\0" and skip substring matches such as
        // "LastHugeVipSelectedQualityLevel" or "LastNormalSelectedQualityLevel".
        var keyPattern = Memory.BytesToPattern(Encoding.Unicode.GetBytes($"{SongQualityConfigKey}\0"));
        var keyAddresses = Memory.FindPatternInModuleAll(keyPattern, pid, moduleBase);

        foreach (var keyAddress in keyAddresses)
        {
            if (keyAddress > moduleBase + 2 && process.ReadInt16(keyAddress, -2) != 0)
            {
                continue;
            }

            var refPattern = Memory.BytesToPattern(BitConverter.GetBytes((uint)keyAddress));
            foreach (var refAddress in Memory.FindTextPatternAll(refPattern, pid, moduleBase))
            {
                var start = refAddress - 0x20;
                var window = process.ReadBytes(start, 0x60);

                for (var i = 0; i <= window.Length - 6; i++)
                {
                    if (window[i] != 0xFF || window[i + 1] != 0x35)
                    {
                        continue;
                    }

                    var candidate = (nint)(long)BitConverter.ToUInt32(window, i + 2);
                    if (!Memory.IsAddressInModule(candidate, moduleBase))
                    {
                        continue;
                    }

                    var value = process.ReadInt32(candidate);
                    if (IsSupportedQualityValue(value))
                    {
                        return candidate;
                    }
                }
            }
        }

        return nint.Zero;
    }

    private string GetSongName()
        => ReadStdString(_currentSongInfoAddress);

    private string GetArtistName()
        => ReadStdString(_currentSongInfoAddress + StdStringSize);

    private string GetAlbumName()
        => ReadStdString(_currentSongInfoAddress + (StdStringSize * 2));

    private string GetAlbumThumbnailUrl()
        => ReadStdString(_currentSongInfoAddress + (StdStringSize * 3));

    private string ReadStdString(nint address)
    {
        var strLength = _process.ReadInt32(address, 0x10);

        if (strLength == 0)
        {
            return string.Empty;
        } // small string optimization

        byte[] strBuffer;

        if (strLength <= 15)
        {
            strBuffer = _process.ReadBytes(address, strLength);
        }
        else
        {
            var strAddress = _process.ReadInt32(address);
            strBuffer = _process.ReadBytes(strAddress, strLength);
        }

        return Encoding.UTF8.GetString(strBuffer);
    }

    // 0 暂停， 1播放， 3缓冲
    private bool IsPaused()
        => _process.ReadInt32(_currentSongInfoAddress, (StdStringSize * 4) + 16) == 0;

    public void Dispose()
    {
        _process?.Dispose();
        GC.SuppressFinalize(this);
    }

    [DllImport("kernel32.dll", EntryPoint = "OpenProcess")]
    public static extern IntPtr OpenProcess(int desiredAccess, bool heritHandle, int pocessID);//访问权限（16进制），是否继承句柄，进程ID
                                                                                               //关闭句柄
    [DllImport("kernel32.dll", EntryPoint = "CloseHandle")]
    public static extern void CloseHandle(IntPtr hObject);
    //读取内存
    [DllImport("kernel32.dll", EntryPoint = "ReadProcessMemory")]
    public static extern bool ReadProcessMemory(IntPtr hProcess, IntPtr baseadress, IntPtr buffer, int nsize, IntPtr bytesread);
    //写入内存
    [DllImport("kernel32.dll", EntryPoint = "WriteProcessMemory")]
    public static extern bool WriteProcessMemory(IntPtr hProcess, IntPtr baseadress, long[] buffer, int nSize, IntPtr byteswrite);
}
