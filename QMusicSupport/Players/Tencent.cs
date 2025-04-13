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

    private const int StdStringSize = 0x18;

    private readonly nint _currentSongInfoAddress;

    private readonly int mpid;
    private readonly ProcessMemory _process;

    nint address = 0x00;

    public Tencent(int pid)
    {
        mpid = pid;
        using var p = Process.GetProcessById(pid);
        
        foreach (ProcessModule module in p.Modules)
        {
            if (!"QQMusic.dll".Equals(module.ModuleName))
            {
                continue;
            }

            var process = new ProcessMemory(pid);
            address = module.BaseAddress;

            if (Memory.FindPattern(CurrentSongInfoPattern, pid, address, out var patternAddress))
            {
                var currentSongAddress = process.ReadInt32(patternAddress, 1);
                _currentSongInfoAddress = currentSongAddress;
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

            // lock
            Url = $"https://y.qq.com/n/ryqq/songDetail/{id}",
        };
    }

    //获取音质 QQMusic 21.31 for Windows
    private int GetSongQulity() 
    {
        var ptr = address + 0x00552510;
        ptr = _process.ReadInt32(ptr);
        var quality = _process.ReadInt32(ptr); //0：标准 1：HQ高品质 2：SQ无损 10：臻品全景声
        return quality;
    }
    private uint GetSongIdentity()
        => _process.ReadUInt32(_currentSongInfoAddress, StdStringSize * 4);

    private int GetSongDuration()
        => _process.ReadInt32(_currentSongInfoAddress, (StdStringSize * 4) + 8 /*跳过Id跟一个4字节大小的玩意*/);

    private int GetSongSchedule()
        => _process.ReadInt32(_currentSongInfoAddress, (StdStringSize * 4) + 12);

    public bool SetSongSchedule(int schedule)
    {
        return _ = Memory.SetQQMusicPlayProgress(schedule);
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
