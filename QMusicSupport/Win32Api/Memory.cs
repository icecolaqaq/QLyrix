using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.Linq;
using System.Net;
using System.Runtime.InteropServices;

namespace QMusicSupport.Win32Api;

internal static class Memory
{
    private const string QQMediaPlayerModuleName = "QQMediaPlayer.dll";

    // QQMusic 22.76+: CKernel* is stored at [*g_pKernelHolder + 0x54] via setter:
    // 55 8B EC 51 A1 <g_pKernelHolder> 8B 4D 08 39 48 54 74 03 89 48 54 C9 C2 04 00
    private const string KernelHolderSetterPattern
        = "55 8B EC 51 A1 ? ? ? ? 8B 4D 08 39 48 ? 74 03 89 48 ? C9 C2 04 00";

    private const string KernelInstancePattern
        = "8B 1D ? ? ? ? 33 F6";

    private const string PlayerStartTimeSetterPattern
        = "55 8B EC FF 75 ? 8D 81";

    private const uint WmMediaPlayerSeek = 0x0404; // WM_USER + 4 handled by CMediaPlayer::ProcessWindowMessage
    private const uint MemCommit = 0x1000;
    private const uint MemReserve = 0x2000;
    private const uint MemRelease = 0x8000;
    private const uint PageExecuteReadWrite = 0x40;

    public static bool FindPattern(string pattern, int processId, nint address, out nint pointer)
    {
        using var memory = new ProcessMemory(processId);

        var ntOffset = memory.ReadInt32(address, 0x3C);
        var ntHeader = address + ntOffset;

        // IMAGE
        var fileHeader  = ntHeader + 4;
        var sections    = memory.ReadInt16(ntHeader,   6);
        var sectionSize = memory.ReadInt16(fileHeader, 16);

        // OPT HEADER
        var optHeader     = fileHeader + 20;
        var sectionHeader = optHeader  + sectionSize;

        var cursor = sectionHeader;

        var pStart      = nint.Zero;
        var memoryBlock = new List<byte>();

        for (var i = 0; i < sections; i++)
        {
            var name = memory.ReadInt64(cursor);

            if (name == 0x747865742E)
            {
                var offset = memory.ReadInt32(cursor, 12);
                pStart = address + offset;
                var size   = memory.ReadInt32(cursor, 8);
                var buffer = memory.ReadBytes(pStart, size);
                memoryBlock.AddRange(buffer);
                break;
            }

            cursor += 40;
        }

        pointer = FindPattern(pattern, pStart, memoryBlock);

        return pointer != nint.Zero;
    }

    public static bool FindPatternInModule(string pattern, int processId, nint address, out nint pointer)
    {
        using var memory = new ProcessMemory(processId);
        pointer = nint.Zero;

        foreach (var section in ReadSections(memory, address))
        {
            var buffer = memory.ReadBytes(section.Start, section.Size);
            pointer = FindPattern(pattern, section.Start, new List<byte>(buffer));
            if (pointer != nint.Zero)
            {
                return true;
            }
        }

        return false;
    }

    public static IReadOnlyList<nint> FindPatternInModuleAll(string pattern, int processId, nint address)
    {
        using var memory = new ProcessMemory(processId);
        var result = new List<nint>();

        foreach (var section in ReadSections(memory, address))
        {
            var buffer = memory.ReadBytes(section.Start, section.Size);
            result.AddRange(FindPatternAll(pattern, section.Start, new List<byte>(buffer)));
        }

        return result;
    }

    public static IReadOnlyList<nint> FindTextPatternAll(string pattern, int processId, nint address)
    {
        using var memory = new ProcessMemory(processId);
        foreach (var section in ReadSections(memory, address))
        {
            if (!".text".Equals(section.Name, StringComparison.OrdinalIgnoreCase))
            {
                continue;
            }

            var buffer = memory.ReadBytes(section.Start, section.Size);
            return FindPatternAll(pattern, section.Start, new List<byte>(buffer));
        }

        return Array.Empty<nint>();
    }

    public static string BytesToPattern(byte[] bytes)
        => string.Join(' ', bytes.Select(item => item.ToString("X2")));

    public static bool IsAddressInModule(nint address, nint moduleBase, int maxModuleSize = 0x2000000)
        => address >= moduleBase && address < moduleBase + maxModuleSize;

    private static IReadOnlyList<(string Name, nint Start, int Size)> ReadSections(ProcessMemory memory, nint address)
    {
        var ntOffset = memory.ReadInt32(address, 0x3C);
        var ntHeader = address + ntOffset;

        var fileHeader  = ntHeader + 4;
        var sections    = memory.ReadInt16(ntHeader,   6);
        var sectionSize = memory.ReadInt16(fileHeader, 16);

        var optHeader     = fileHeader + 20;
        var sectionHeader = optHeader  + sectionSize;

        var cursor = sectionHeader;
        var result = new List<(string Name, nint Start, int Size)>();

        for (var i = 0; i < sections; i++)
        {
            var nameBytes = memory.ReadBytes(cursor, 8);
            var zeroIndex = Array.IndexOf(nameBytes, (byte)0);
            var name = System.Text.Encoding.ASCII.GetString(nameBytes, 0, zeroIndex >= 0 ? zeroIndex : nameBytes.Length);
            var offset = memory.ReadInt32(cursor, 12);
            var size = memory.ReadInt32(cursor, 8);

            if (size > 0)
            {
                result.Add((name, address + offset, size));
            }

            cursor += 40;
        }

        return result;
    }

    private static nint FindPattern(string pattern, nint pStart, List<byte> memoryBlock)
    {
        if (pattern.Length == 0 || pStart == nint.Zero || memoryBlock.Count == 0)
        {
            return nint.Zero;
        }

        var bytes  = ParseSignature(pattern);
        var first  = bytes[0];
        var result = nint.Zero;

        var range = memoryBlock.Count - bytes.Length;

        for (var i = 0; i <= range; i++)
        {
            if (first != 0xFFFF)
            {
                i = memoryBlock.IndexOf((byte) first, i);

                if (i == -1)
                {
                    break;
                }
            }

            var found = true;

            for (var j = 1; j < bytes.Length; j++)
            {
                var wildcard = bytes[j] == 0xFFFF;
                var equals   = bytes[j] == memoryBlock[i + j];

                if (wildcard || equals)
                {
                    continue;
                }

                found = false;

                break;
            }

            if (!found)
            {
                continue;
            }

            result = nint.Add(pStart, i);

            break;
        }

        return result;
    }

    private static IReadOnlyList<nint> FindPatternAll(string pattern, nint pStart, List<byte> memoryBlock)
    {
        var result = new List<nint>();

        if (pattern.Length == 0 || pStart == nint.Zero || memoryBlock.Count == 0)
        {
            return result;
        }

        var bytes = ParseSignature(pattern);
        var first = bytes[0];
        var range = memoryBlock.Count - bytes.Length;

        for (var i = 0; i <= range; i++)
        {
            if (first != 0xFFFF)
            {
                i = memoryBlock.IndexOf((byte)first, i);

                if (i == -1)
                {
                    break;
                }
            }

            var found = true;
            for (var j = 1; j < bytes.Length; j++)
            {
                var wildcard = bytes[j] == 0xFFFF;
                var equals = bytes[j] == memoryBlock[i + j];

                if (wildcard || equals)
                {
                    continue;
                }

                found = false;
                break;
            }

            if (found)
            {
                result.Add(nint.Add(pStart, i));
            }
        }

        return result;
    }

    public static bool TryGetModuleBaseAddress(Process process, string moduleName, out nint baseAddress)
    {
        foreach (ProcessModule module in process.Modules)
        {
            if (!module.ModuleName.Equals(moduleName, StringComparison.OrdinalIgnoreCase))
            {
                continue;
            }

            baseAddress = module.BaseAddress;
            return true;
        }

        baseAddress = nint.Zero;
        return false;
    }

    public static nint ReadAbsoluteAddress32(ProcessMemory process, nint instructionAddress, int operandOffset)
        => (nint)(long)process.ReadUInt32(instructionAddress, operandOffset);

    private static ushort[] ParseSignature(string signature)
    {
        var bytesStr = signature.Split(' ').AsSpan();

        var bytes = new ushort[bytesStr.Length];

        for (var i = 0; i < bytes.Length; i++)
        {
            var str = bytesStr[i];

            if (str.Contains('?'))
            {
                bytes[i] = 0xFFFF;

                continue;
            }

            bytes[i] = Convert.ToByte(str, 16);
        }

        return bytes;
    }

    public static bool SetQQMusicPlayProgress(int schedule)
    {
        Process[] processes = Process.GetProcessesByName("QQMusic");
        if (processes.Length == 0)
        {
            Console.WriteLine("未找到QQ音乐进程");
            return false;
        }

        return SetQQMusicPlayProgress(schedule, processes[0].Id);
    }

    // Locate CKernel and seek via CMediaPlayer's window message (22.76+) or CPlayer::m_dwTheStartTime fallback (21.92).
    public static bool SetQQMusicPlayProgress(int schedule, int processId)
    {
        if (schedule < 0)
        {
            schedule = 0;
        }

        Process process;
        try
        {
            process = Process.GetProcessById(processId);
        }
        catch
        {
            return false;
        }

        using (process)
        {
            try
            {
                if (!TryGetModuleBaseAddress(process, QQMediaPlayerModuleName, out var moduleBase))
                {
                    Console.WriteLine("未找到QQMediaPlayer.dll模块");
                    return false;
                }

                using var memory = new ProcessMemory(processId);
                var kernelAddress = ResolveKernelAddress(memory, processId, moduleBase);
                if (kernelAddress == nint.Zero)
                {
                    return false;
                }

                var playerAddress = memory.ReadPointer32(kernelAddress, 0x1C);
                if (playerAddress == nint.Zero)
                {
                    return false;
                }

                // Prefer posting WM_USER + 4 (0x0404) to CMediaPlayer's message window so CPlayer::Seek
                // executes safely on QQMusic's main UI thread and seeks the active audio decoder.
                if (TrySeekViaMediaPlayerWindow(process, memory, processId, kernelAddress, playerAddress, schedule))
                {
                    return true;
                }

                // Legacy fallback: write CPlayer::m_dwTheStartTime directly.
                if (!FindPattern(PlayerStartTimeSetterPattern, processId, moduleBase, out var setterPatternAddress))
                {
                    return false;
                }

                var startTimeOffset = memory.ReadInt32(setterPatternAddress, 8);
                return memory.WriteInt32(playerAddress + startTimeOffset, schedule);
            }
            catch
            {
                return false;
            }
        }
    }

    private static nint ResolveKernelAddress(ProcessMemory memory, int processId, nint moduleBase)
    {
        // QQMusic 22.76+: CKernel* is stored inside a holder object at [*g_pKernelHolder + offset].
        if (FindPattern(KernelHolderSetterPattern, processId, moduleBase, out var holderSetterAddress))
        {
            var holderGlobalAddress = ReadAbsoluteAddress32(memory, holderSetterAddress, 5);
            var holderOffset = memory.ReadBytes(holderSetterAddress + 14, 1)[0];
            var holderAddress = memory.ReadPointer32(holderGlobalAddress);
            if (holderAddress != nint.Zero)
            {
                var kernelAddress = memory.ReadPointer32(holderAddress, holderOffset);
                if (kernelAddress != nint.Zero)
                {
                    return kernelAddress;
                }
            }
        }

        // Legacy QQMusic (e.g. 21.92): CKernel* is stored directly at a global pointer.
        if (FindPattern(KernelInstancePattern, processId, moduleBase, out var kernelPatternAddress))
        {
            var kernelGlobalAddress = ReadAbsoluteAddress32(memory, kernelPatternAddress, 2);
            return memory.ReadPointer32(kernelGlobalAddress);
        }

        return nint.Zero;
    }

    private static bool TrySeekViaMediaPlayerWindow(
        Process process,
        ProcessMemory memory,
        int processId,
        nint kernelAddress,
        nint playerAddress,
        int schedule)
    {
        // CMediaPlayer's CWindowImpl m_hWnd is stored at [kernelAddress - 0x34] and [playerAddress + 0x10].
        var hwnd = memory.ReadPointer32(kernelAddress, -0x34);
        if (hwnd == nint.Zero)
        {
            hwnd = memory.ReadPointer32(playerAddress, 0x10);
        }

        if (hwnd == nint.Zero)
        {
            return false;
        }

        if (IsWindow(hwnd) && PostMessageW(hwnd, WmMediaPlayerSeek, (nuint)(uint)schedule, playerAddress))
        {
            return true;
        }

        return TryRemotePostMessage(process, processId, hwnd, WmMediaPlayerSeek, (uint)schedule, (uint)playerAddress);
    }

    private static bool TryRemotePostMessage(
        Process process,
        int processId,
        nint hwnd,
        uint message,
        uint wParam,
        uint lParam)
    {
        if (!TryGetRemoteProcAddress(process, processId, "user32.dll", "PostMessageW", out var postMessageAddress))
        {
            return false;
        }

        var hProcess = ProcessMemory.OpenProcess(0x1F0FFF, false, processId);
        if (hProcess == nint.Zero)
        {
            return false;
        }

        var remoteStub = nint.Zero;
        var hThread = nint.Zero;
        try
        {
            remoteStub = VirtualAllocEx(hProcess, nint.Zero, 0x40, MemCommit | MemReserve, PageExecuteReadWrite);
            if (remoteStub == nint.Zero)
            {
                return false;
            }

            // x86 stdcall stub:
            // push lParam
            // push wParam
            // push message
            // push hwnd
            // mov eax, PostMessageW
            // call eax
            // ret 4
            var code = new List<byte>(28)
            {
                0x68
            };
            code.AddRange(BitConverter.GetBytes(lParam));
            code.Add(0x68);
            code.AddRange(BitConverter.GetBytes(wParam));
            code.Add(0x68);
            code.AddRange(BitConverter.GetBytes(message));
            code.Add(0x68);
            code.AddRange(BitConverter.GetBytes((uint)hwnd));
            code.Add(0xB8);
            code.AddRange(BitConverter.GetBytes((uint)postMessageAddress));
            code.AddRange(new byte[] { 0xFF, 0xD0, 0xC2, 0x04, 0x00 });

            var buffer = code.ToArray();
            if (!ProcessMemory.WriteProcessMemory(hProcess, remoteStub, buffer, buffer.Length, out var written)
                || written != buffer.Length)
            {
                return false;
            }

            hThread = CreateRemoteThread(hProcess, nint.Zero, 0, remoteStub, nint.Zero, 0, out _);
            if (hThread == nint.Zero)
            {
                return false;
            }

            if (WaitForSingleObject(hThread, 2000) != 0)
            {
                return false;
            }

            return GetExitCodeThread(hThread, out var exitCode) && exitCode != 0;
        }
        finally
        {
            if (hThread != nint.Zero)
            {
                CloseHandle(hThread);
            }

            if (remoteStub != nint.Zero)
            {
                VirtualFreeEx(hProcess, remoteStub, 0, MemRelease);
            }

            CloseHandle(hProcess);
        }
    }

    private static bool TryGetRemoteProcAddress(
        Process process,
        int processId,
        string moduleName,
        string functionName,
        out nint procAddress)
    {
        procAddress = nint.Zero;
        if (!TryGetModuleBaseAddress(process, moduleName, out var moduleBase) || moduleBase == nint.Zero)
        {
            return false;
        }

        using var memory = new ProcessMemory(processId);
        var eLfanew = memory.ReadInt32(moduleBase, 0x3C);
        if (eLfanew <= 0 || eLfanew > 0x1000)
        {
            return false;
        }

        var ntHeader = moduleBase + eLfanew;
        var exportDirRva = memory.ReadInt32(ntHeader, 0x78);
        if (exportDirRva <= 0)
        {
            return false;
        }

        var exportDir = moduleBase + exportDirRva;
        var numberOfNames = memory.ReadInt32(exportDir, 0x18);
        var addressOfFunctions = memory.ReadInt32(exportDir, 0x1C);
        var addressOfNames = memory.ReadInt32(exportDir, 0x20);
        var addressOfNameOrdinals = memory.ReadInt32(exportDir, 0x24);

        for (var i = 0; i < numberOfNames; i++)
        {
            var nameRva = memory.ReadInt32(moduleBase + addressOfNames, i * 4);
            var nameBytes = memory.ReadBytes(moduleBase + nameRva, functionName.Length + 1);
            var zeroIdx = Array.IndexOf(nameBytes, (byte)0);
            if (zeroIdx != functionName.Length)
            {
                continue;
            }

            var exportName = System.Text.Encoding.ASCII.GetString(nameBytes, 0, zeroIdx);
            if (!string.Equals(exportName, functionName, StringComparison.Ordinal))
            {
                continue;
            }

            var ordinal = memory.ReadInt16(moduleBase + addressOfNameOrdinals, i * 2);
            var funcRva = memory.ReadInt32(moduleBase + addressOfFunctions, ordinal * 4);
            procAddress = moduleBase + funcRva;
            return true;
        }

        return false;
    }

    [DllImport("user32.dll", SetLastError = true)]
    private static extern bool PostMessageW(nint hWnd, uint msg, nuint wParam, nint lParam);

    [DllImport("user32.dll")]
    private static extern bool IsWindow(nint hWnd);

    [DllImport("kernel32.dll", SetLastError = true)]
    private static extern nint VirtualAllocEx(nint hProcess, nint lpAddress, uint dwSize, uint flAllocationType, uint flProtect);

    [DllImport("kernel32.dll", SetLastError = true)]
    private static extern bool VirtualFreeEx(nint hProcess, nint lpAddress, uint dwSize, uint dwFreeType);

    [DllImport("kernel32.dll", SetLastError = true)]
    private static extern nint CreateRemoteThread(
        nint hProcess,
        nint lpThreadAttributes,
        uint dwStackSize,
        nint lpStartAddress,
        nint lpParameter,
        uint dwCreationFlags,
        out uint lpThreadId);

    [DllImport("kernel32.dll", SetLastError = true)]
    private static extern uint WaitForSingleObject(nint hHandle, uint dwMilliseconds);

    [DllImport("kernel32.dll", SetLastError = true)]
    private static extern bool GetExitCodeThread(nint hThread, out uint lpExitCode);

    [DllImport("kernel32.dll", SetLastError = true)]
    private static extern bool CloseHandle(nint hObject);
}

internal sealed class ProcessMemory : IDisposable
{
    private readonly nint _process;
    private readonly bool _ownsHandle;

    public ProcessMemory(nint process)
    {
        _process = process;
        _ownsHandle = false;
    }

    public ProcessMemory(int processId)
    {
        _process = OpenProcess(0x1F0FFF, IntPtr.Zero, processId);
        _ownsHandle = _process != nint.Zero;
    }

    public void Dispose()
    {
        if (_ownsHandle && _process != nint.Zero)
        {
            CloseHandle(_process);
        }
    }

    public byte[] ReadBytes(IntPtr offset, int length)
    {
        var bytes = new byte[length];
        ReadProcessMemory(_process, offset, bytes, length, IntPtr.Zero);

        return bytes;
    }

    public float ReadFloat(IntPtr address, int offset = 0)
        => BitConverter.ToSingle(ReadBytes(IntPtr.Add(address, offset), 4), 0);

    public double ReadDouble(IntPtr address, int offset = 0)
        => BitConverter.ToDouble(ReadBytes(IntPtr.Add(address, offset), 8), 0);

    public long ReadInt64(IntPtr address, int offset = 0)
        => BitConverter.ToInt64(ReadBytes(IntPtr.Add(address, offset), 8), 0);

    public ulong ReadUInt64(IntPtr address, int offset = 0)
        => BitConverter.ToUInt64(ReadBytes(IntPtr.Add(address, offset), 8), 0);

    public short ReadInt16(IntPtr address, int offset = 0)
        => BitConverter.ToInt16(ReadBytes(IntPtr.Add(address, offset), 2), 0);

    public int ReadInt32(IntPtr address, int offset = 0)
        => BitConverter.ToInt32(ReadBytes(IntPtr.Add(address, offset), 4), 0);

    public uint ReadUInt32(IntPtr address, int offset = 0)
        => BitConverter.ToUInt32(ReadBytes(IntPtr.Add(address, offset), 4), 0);

    public nint ReadPointer32(IntPtr address, int offset = 0)
        => (nint)(long)ReadUInt32(address, offset);

    public bool WriteInt32(IntPtr address, int value)
    {
        var buffer = BitConverter.GetBytes(value);
        return WriteProcessMemory(_process, address, buffer, buffer.Length, out var bytesWritten)
               && bytesWritten == buffer.Length;
    }

    [DllImport("kernel32.dll", SetLastError = true)]
    private static extern bool ReadProcessMemory(IntPtr pHandle, IntPtr address, byte[] buffer, int size, IntPtr bytesRead);

    [DllImport("kernel32.dll")]
    public static extern bool ReadProcessMemory(IntPtr hProcess, IntPtr lpBaseAddress, byte[] lpBuffer, int dwSize, out int lpNumberOfBytesRead);

    [DllImport("kernel32.dll", SetLastError = true)]
    private static extern IntPtr OpenProcess(int dwDesiredAccess, IntPtr bInheritHandle, int dwProcessId);

    [DllImport("kernel32.dll")]
    public static extern IntPtr OpenProcess(int dwDesiredAccess, bool bInheritHandle, int dwProcessId);

    [DllImport("kernel32.dll", SetLastError = true)]
    public static extern bool WriteProcessMemory(IntPtr hProcess, IntPtr lpBaseAddress, byte[] lpBuffer, int nSize, out int lpNumberOfBytesWritten);

    [DllImport("kernel32.dll", SetLastError = true)]
    private static extern bool CloseHandle(IntPtr hObject);

}
