using System;
using System.Collections.Generic;
using System.IO;
using System.Runtime.InteropServices;
using System.Text;

namespace QMusicSupport.Win32Api;

internal static class RemoteQQMusicCommon
{
    private const string ModuleName = "QQMusicCommon.dll";
    private const string IsILikeSongExportName = "?IsILikeSong@@YAJKPAH0@Z";
    private const string GetILikeStatusExportName = "?GetILikeStatus@@YAJPAH@Z";

    private const uint TH32CS_SNAPMODULE = 0x00000008;
    private const uint TH32CS_SNAPMODULE32 = 0x00000010;
    private const uint PROCESS_CREATE_THREAD = 0x0002;
    private const uint PROCESS_QUERY_INFORMATION = 0x0400;
    private const uint PROCESS_VM_OPERATION = 0x0008;
    private const uint PROCESS_VM_WRITE = 0x0020;
    private const uint PROCESS_VM_READ = 0x0010;
    private const uint MEM_COMMIT = 0x1000;
    private const uint MEM_RESERVE = 0x2000;
    private const uint MEM_RELEASE = 0x8000;
    private const uint PAGE_EXECUTE_READWRITE = 0x40;
    private const uint WAIT_OBJECT_0 = 0;

    public static bool TryIsILikeSong(int pid, uint songId, out bool isFavorite)
    {
        isFavorite = false;

        if (!TryGetModule(pid, ModuleName, out var moduleBase, out var modulePath))
        {
            Console.WriteLine($"[DEBUG] TryGetModule failed for {ModuleName}");
            return false;
        }

        if (!TryGetExportRva(modulePath, IsILikeSongExportName, out var exportRva))
        {
            Console.WriteLine($"[DEBUG] TryGetExportRva failed for {IsILikeSongExportName}");
            return false;
        }

        Console.WriteLine($"[DEBUG] Module base: 0x{moduleBase:X8}");
        Console.WriteLine($"[DEBUG] IsILikeSong RVA: 0x{exportRva:X8}");

        var process = OpenProcess(
            PROCESS_CREATE_THREAD | PROCESS_QUERY_INFORMATION | PROCESS_VM_OPERATION | PROCESS_VM_WRITE | PROCESS_VM_READ,
            false,
            pid);

        if (process == IntPtr.Zero)
        {
            Console.WriteLine("[DEBUG] OpenProcess failed");
            return false;
        }

        var remoteMemory = IntPtr.Zero;
        var thread = IntPtr.Zero;

        try
        {
            remoteMemory = VirtualAllocEx(process, IntPtr.Zero, 0x1000, MEM_COMMIT | MEM_RESERVE, PAGE_EXECUTE_READWRITE);
            if (remoteMemory == IntPtr.Zero)
            {
                Console.WriteLine("[DEBUG] VirtualAllocEx failed");
                return false;
            }

            var codeAddress = unchecked((uint)remoteMemory.ToInt64());
            Console.WriteLine($"[DEBUG] Remote memory: 0x{codeAddress:X8}");

            var functionAddress = moduleBase + exportRva;
            // out1 and out2 for IsILikeSong(songId, int* out1, int* out2)
            var out1Address = codeAddress + 0x200;
            var out2Address = codeAddress + 0x204;
            var resultAddress = codeAddress + 0x208;
            var shellcode = BuildIsILikeSongShellcode(functionAddress, songId, out1Address, out2Address, resultAddress);

            Console.WriteLine($"[DEBUG] IsILikeSong function address: 0x{functionAddress:X8}");
            Console.WriteLine($"[DEBUG] Song ID: {songId}");

            if (!WriteProcessMemory(process, remoteMemory, shellcode, shellcode.Length, out _))
            {
                Console.WriteLine("[DEBUG] WriteProcessMemory failed for IsILikeSong shellcode");
                return false;
            }

            thread = CreateRemoteThread(process, IntPtr.Zero, 0, remoteMemory, IntPtr.Zero, 0, out _);
            if (thread == IntPtr.Zero)
            {
                Console.WriteLine("[DEBUG] CreateRemoteThread failed for IsILikeSong");
                return false;
            }

            if (WaitForSingleObject(thread, 2000) != WAIT_OBJECT_0)
            {
                Console.WriteLine("[DEBUG] WaitForSingleObject timeout for IsILikeSong");
                return false;
            }

            var hrBuffer = new byte[4];
            if (!ReadProcessMemory(process, (nint)resultAddress, hrBuffer, hrBuffer.Length, out _))
            {
                Console.WriteLine("[DEBUG] ReadProcessMemory failed for IsILikeSong result");
                return false;
            }

            var hr = BitConverter.ToInt32(hrBuffer, 0);
            Console.WriteLine($"[DEBUG] IsILikeSong HRESULT: 0x{hr:X8}");

            // Read both output parameters
            var out1Buffer = new byte[4];
            if (ReadProcessMemory(process, (nint)out1Address, out1Buffer, out1Buffer.Length, out _))
            {
                var out1Value = BitConverter.ToInt32(out1Buffer, 0);
                Console.WriteLine($"[DEBUG] out1 (a2) value: {out1Value}");
            }

            var out2Buffer = new byte[4];
            if (ReadProcessMemory(process, (nint)out2Address, out2Buffer, out2Buffer.Length, out _))
            {
                var out2Value = BitConverter.ToInt32(out2Buffer, 0);
                Console.WriteLine($"[DEBUG] out2 (a3) value: {out2Value}");
            }

            if (hr < 0)
            {
                Console.WriteLine("[DEBUG] IsILikeSong failed with error");
                return false;
            }

            // Read out1 as the favorite status
            var outBuffer = new byte[8];
            if (!ReadProcessMemory(process, (nint)out1Address, outBuffer, outBuffer.Length, out _))
            {
                Console.WriteLine("[DEBUG] ReadProcessMemory failed for out1");
                return false;
            }

            isFavorite = BitConverter.ToInt32(outBuffer, 0) != 0;
            Console.WriteLine($"[DEBUG] IsFavorite (from out1): {isFavorite}");
            return true;
        }
        finally
        {
            if (thread != IntPtr.Zero)
            {
                CloseHandle(thread);
            }

            if (remoteMemory != IntPtr.Zero)
            {
                VirtualFreeEx(process, remoteMemory, 0, MEM_RELEASE);
            }

            CloseHandle(process);
        }
    }

    public static bool TryGetILikeStatus(int pid, out int likeStatus)
    {
        likeStatus = 0;

        if (!TryGetModule(pid, ModuleName, out var moduleBase, out var modulePath))
        {
            Console.WriteLine($"[DEBUG] TryGetModule failed for {ModuleName}");
            return false;
        }

        if (!TryGetExportRva(modulePath, GetILikeStatusExportName, out var exportRva))
        {
            Console.WriteLine($"[DEBUG] TryGetExportRva failed for {GetILikeStatusExportName}");
            return false;
        }

        Console.WriteLine($"[DEBUG] GetILikeStatus RVA: 0x{exportRva:X8}");

        var process = OpenProcess(
            PROCESS_CREATE_THREAD | PROCESS_QUERY_INFORMATION | PROCESS_VM_OPERATION | PROCESS_VM_WRITE | PROCESS_VM_READ,
            false,
            pid);

        if (process == IntPtr.Zero)
        {
            Console.WriteLine("[DEBUG] OpenProcess failed");
            return false;
        }

        var remoteMemory = IntPtr.Zero;
        var thread = IntPtr.Zero;

        try
        {
            remoteMemory = VirtualAllocEx(process, IntPtr.Zero, 0x1000, MEM_COMMIT | MEM_RESERVE, PAGE_EXECUTE_READWRITE);
            if (remoteMemory == IntPtr.Zero)
            {
                Console.WriteLine("[DEBUG] VirtualAllocEx failed");
                return false;
            }

            var codeAddress = unchecked((uint)remoteMemory.ToInt64());
            var functionAddress = moduleBase + exportRva;
            var outAddress = codeAddress + 0x200;
            var resultAddress = codeAddress + 0x204;
            var shellcode = BuildGetILikeStatusShellcode(functionAddress, outAddress, resultAddress);

            Console.WriteLine($"[DEBUG] GetILikeStatus function address: 0x{functionAddress:X8}");

            if (!WriteProcessMemory(process, remoteMemory, shellcode, shellcode.Length, out _))
            {
                Console.WriteLine("[DEBUG] WriteProcessMemory failed");
                return false;
            }

            thread = CreateRemoteThread(process, IntPtr.Zero, 0, remoteMemory, IntPtr.Zero, 0, out _);
            if (thread == IntPtr.Zero)
            {
                Console.WriteLine("[DEBUG] CreateRemoteThread failed");
                return false;
            }

            if (WaitForSingleObject(thread, 2000) != WAIT_OBJECT_0)
            {
                Console.WriteLine("[DEBUG] WaitForSingleObject timeout");
                return false;
            }

            var hrBuffer = new byte[4];
            if (!ReadProcessMemory(process, (nint)resultAddress, hrBuffer, hrBuffer.Length, out _))
            {
                Console.WriteLine("[DEBUG] ReadProcessMemory failed for result");
                return false;
            }

            var hr = BitConverter.ToInt32(hrBuffer, 0);
            Console.WriteLine($"[DEBUG] GetILikeStatus HRESULT: 0x{hr:X8}");

            var outBuffer = new byte[4];
            if (!ReadProcessMemory(process, (nint)outAddress, outBuffer, outBuffer.Length, out _))
            {
                Console.WriteLine("[DEBUG] ReadProcessMemory failed for out");
                return false;
            }

            likeStatus = BitConverter.ToInt32(outBuffer, 0);
            Console.WriteLine($"[DEBUG] LikeStatus: {likeStatus}");
            return hr >= 0;
        }
        finally
        {
            if (thread != IntPtr.Zero)
            {
                CloseHandle(thread);
            }

            if (remoteMemory != IntPtr.Zero)
            {
                VirtualFreeEx(process, remoteMemory, 0, MEM_RELEASE);
            }

            CloseHandle(process);
        }
    }

    private static byte[] BuildIsILikeSongShellcode(uint functionAddress, uint songId, uint out1Address, uint out2Address, uint resultAddress)
    {
        var code = new List<byte>(40);

        EmitPush(code, out2Address);
        EmitPush(code, out1Address);
        EmitPush(code, songId);
        code.Add(0xB8); // mov eax, functionAddress
        code.AddRange(BitConverter.GetBytes(functionAddress));
        code.Add(0xFF); // call eax
        code.Add(0xD0);
        code.Add(0xA3); // mov [resultAddress], eax
        code.AddRange(BitConverter.GetBytes(resultAddress));
        code.Add(0x83); // add esp, 0x0c
        code.Add(0xC4);
        code.Add(0x0C);
        code.Add(0x31); // xor eax, eax
        code.Add(0xC0);
        code.Add(0xC3); // ret

        return code.ToArray();
    }

    private static byte[] BuildGetILikeStatusShellcode(uint functionAddress, uint outAddress, uint resultAddress)
    {
        var code = new List<byte>(30);

        EmitPush(code, outAddress);
        code.Add(0xB8); // mov eax, functionAddress
        code.AddRange(BitConverter.GetBytes(functionAddress));
        code.Add(0xFF); // call eax
        code.Add(0xD0);
        code.Add(0xA3); // mov [resultAddress], eax
        code.AddRange(BitConverter.GetBytes(resultAddress));
        code.Add(0x83); // add esp, 0x04
        code.Add(0xC4);
        code.Add(0x04);
        code.Add(0x31); // xor eax, eax
        code.Add(0xC0);
        code.Add(0xC3); // ret

        return code.ToArray();
    }

    private static void EmitPush(List<byte> code, uint value)
    {
        code.Add(0x68);
        code.AddRange(BitConverter.GetBytes(value));
    }

    private static bool TryGetModule(int pid, string moduleName, out uint moduleBase, out string modulePath)
    {
        moduleBase = 0;
        modulePath = string.Empty;

        var snapshot = CreateToolhelp32Snapshot(TH32CS_SNAPMODULE | TH32CS_SNAPMODULE32, (uint)pid);
        if (snapshot == IntPtr.Zero || snapshot == new IntPtr(-1))
        {
            return false;
        }

        try
        {
            var module = new MODULEENTRY32
            {
                dwSize = (uint)Marshal.SizeOf<MODULEENTRY32>(),
            };

            if (!Module32First(snapshot, ref module))
            {
                return false;
            }

            do
            {
                if (!moduleName.Equals(module.szModule, StringComparison.OrdinalIgnoreCase))
                {
                    continue;
                }

                moduleBase = unchecked((uint)module.modBaseAddr.ToInt64());
                modulePath = module.szExePath;
                return true;
            } while (Module32Next(snapshot, ref module));

            return false;
        }
        finally
        {
            CloseHandle(snapshot);
        }
    }

    private static bool TryGetExportRva(string modulePath, string exportName, out uint rva)
    {
        rva = 0;

        var image = File.ReadAllBytes(modulePath);
        if (BitConverter.ToUInt16(image, 0) != 0x5A4D)
        {
            return false;
        }

        var peOffset = BitConverter.ToInt32(image, 0x3C);
        if (BitConverter.ToUInt32(image, peOffset) != 0x00004550)
        {
            return false;
        }

        var optionalHeaderOffset = peOffset + 24;
        var magic = BitConverter.ToUInt16(image, optionalHeaderOffset);
        var exportDirectoryRvaOffset = magic == 0x20B ? optionalHeaderOffset + 0x70 : optionalHeaderOffset + 0x60;
        var exportDirectoryRva = BitConverter.ToUInt32(image, exportDirectoryRvaOffset);
        if (exportDirectoryRva == 0)
        {
            return false;
        }

        var exportDirectoryOffset = RvaToOffset(image, peOffset, exportDirectoryRva);
        var numberOfNames = BitConverter.ToUInt32(image, exportDirectoryOffset + 24);
        var addressOfFunctionsRva = BitConverter.ToUInt32(image, exportDirectoryOffset + 28);
        var addressOfNamesRva = BitConverter.ToUInt32(image, exportDirectoryOffset + 32);
        var addressOfOrdinalsRva = BitConverter.ToUInt32(image, exportDirectoryOffset + 36);

        var functionsOffset = RvaToOffset(image, peOffset, addressOfFunctionsRva);
        var namesOffset = RvaToOffset(image, peOffset, addressOfNamesRva);
        var ordinalsOffset = RvaToOffset(image, peOffset, addressOfOrdinalsRva);

        for (var i = 0; i < numberOfNames; i++)
        {
            var nameRva = BitConverter.ToUInt32(image, namesOffset + (i * 4));
            var nameOffset = RvaToOffset(image, peOffset, nameRva);
            var name = ReadAsciiNullTerminated(image, nameOffset);
            if (!exportName.Equals(name, StringComparison.Ordinal))
            {
                continue;
            }

            var ordinal = BitConverter.ToUInt16(image, ordinalsOffset + (i * 2));
            rva = BitConverter.ToUInt32(image, functionsOffset + (ordinal * 4));
            return rva != 0;
        }

        return false;
    }

    private static int RvaToOffset(byte[] image, int peOffset, uint rva)
    {
        var numberOfSections = BitConverter.ToUInt16(image, peOffset + 6);
        var optionalHeaderSize = BitConverter.ToUInt16(image, peOffset + 20);
        var sectionOffset = peOffset + 24 + optionalHeaderSize;

        for (var i = 0; i < numberOfSections; i++)
        {
            var current = sectionOffset + (i * 40);
            var virtualSize = BitConverter.ToUInt32(image, current + 8);
            var virtualAddress = BitConverter.ToUInt32(image, current + 12);
            var rawSize = BitConverter.ToUInt32(image, current + 16);
            var rawPointer = BitConverter.ToUInt32(image, current + 20);
            var size = Math.Max(virtualSize, rawSize);

            if (rva >= virtualAddress && rva < virtualAddress + size)
            {
                return (int)(rawPointer + (rva - virtualAddress));
            }
        }

        return (int)rva;
    }

    private static string ReadAsciiNullTerminated(byte[] image, int offset)
    {
        var end = offset;
        while (end < image.Length && image[end] != 0)
        {
            end++;
        }

        return Encoding.ASCII.GetString(image, offset, end - offset);
    }

    [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Auto)]
    private struct MODULEENTRY32
    {
        public uint dwSize;
        public uint th32ModuleID;
        public uint th32ProcessID;
        public uint GlblcntUsage;
        public uint ProccntUsage;
        public IntPtr modBaseAddr;
        public uint modBaseSize;
        public IntPtr hModule;

        [MarshalAs(UnmanagedType.ByValTStr, SizeConst = 256)]
        public string szModule;

        [MarshalAs(UnmanagedType.ByValTStr, SizeConst = 260)]
        public string szExePath;
    }

    [DllImport("kernel32.dll", SetLastError = true)]
    private static extern IntPtr CreateToolhelp32Snapshot(uint dwFlags, uint th32ProcessID);

    [DllImport("kernel32.dll", CharSet = CharSet.Auto, SetLastError = true)]
    private static extern bool Module32First(IntPtr hSnapshot, ref MODULEENTRY32 lpme);

    [DllImport("kernel32.dll", CharSet = CharSet.Auto, SetLastError = true)]
    private static extern bool Module32Next(IntPtr hSnapshot, ref MODULEENTRY32 lpme);

    [DllImport("kernel32.dll", SetLastError = true)]
    private static extern IntPtr OpenProcess(uint dwDesiredAccess, bool bInheritHandle, int dwProcessId);

    [DllImport("kernel32.dll", SetLastError = true)]
    private static extern IntPtr VirtualAllocEx(IntPtr hProcess, IntPtr lpAddress, uint dwSize, uint flAllocationType, uint flProtect);

    [DllImport("kernel32.dll", SetLastError = true)]
    private static extern bool VirtualFreeEx(IntPtr hProcess, IntPtr lpAddress, uint dwSize, uint dwFreeType);

    [DllImport("kernel32.dll", SetLastError = true)]
    private static extern bool WriteProcessMemory(IntPtr hProcess, IntPtr lpBaseAddress, byte[] lpBuffer, int nSize, out IntPtr lpNumberOfBytesWritten);

    [DllImport("kernel32.dll", SetLastError = true)]
    private static extern bool ReadProcessMemory(IntPtr hProcess, IntPtr lpBaseAddress, byte[] lpBuffer, int nSize, out IntPtr lpNumberOfBytesRead);

    [DllImport("kernel32.dll", SetLastError = true)]
    private static extern IntPtr CreateRemoteThread(
        IntPtr hProcess,
        IntPtr lpThreadAttributes,
        uint dwStackSize,
        IntPtr lpStartAddress,
        IntPtr lpParameter,
        uint dwCreationFlags,
        out uint lpThreadId);

    [DllImport("kernel32.dll", SetLastError = true)]
    private static extern uint WaitForSingleObject(IntPtr hHandle, uint dwMilliseconds);

    [DllImport("kernel32.dll", SetLastError = true)]
    private static extern bool CloseHandle(IntPtr hObject);
}
