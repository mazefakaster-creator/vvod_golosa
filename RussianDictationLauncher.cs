using System;
using System.Diagnostics;
using System.IO;

internal static class RussianDictationLauncher
{
    [STAThread]
    private static void Main()
    {
        string appDir = AppDomain.CurrentDomain.BaseDirectory;
        string script = Path.Combine(appDir, "Launch-RussianDictation.ps1");

        if (!File.Exists(script))
        {
            return;
        }

        var startInfo = new ProcessStartInfo
        {
            FileName = Path.Combine(
                Environment.GetFolderPath(Environment.SpecialFolder.System),
                @"WindowsPowerShell\v1.0\powershell.exe"),
            Arguments = "-NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File \"" + script + "\"",
            WorkingDirectory = appDir,
            CreateNoWindow = true,
            UseShellExecute = false,
            WindowStyle = ProcessWindowStyle.Hidden
        };

        Process.Start(startInfo);
    }
}
