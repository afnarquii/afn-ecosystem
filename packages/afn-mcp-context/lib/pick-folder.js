/**
 * Diálogo nativo de carpeta. El navegador no entrega la ruta real de un input file.
 */
import path from 'node:path';
import { spawn } from 'node:child_process';

const PICK_PS = `
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Windows.Forms
Add-Type @"
using System;
using System.Runtime.InteropServices;
public class AfnFore {
  [DllImport("user32.dll")] static extern IntPtr GetForegroundWindow();
  [DllImport("user32.dll")] static extern uint GetWindowThreadProcessId(IntPtr hWnd, IntPtr pid);
  [DllImport("kernel32.dll")] static extern uint GetCurrentThreadId();
  [DllImport("user32.dll")] static extern bool AttachThreadInput(uint a, uint b, bool attach);
  [DllImport("user32.dll")] static extern bool SetForegroundWindow(IntPtr hWnd);
  [DllImport("user32.dll")] static extern bool BringWindowToTop(IntPtr hWnd);
  [DllImport("user32.dll")] static extern void keybd_event(byte bVk, byte bScan, uint dwFlags, UIntPtr extra);
  public static void Lift(IntPtr hwnd) {
    keybd_event(0x12, 0, 0, UIntPtr.Zero);
    keybd_event(0x12, 0, 2, UIntPtr.Zero);
    IntPtr fore = GetForegroundWindow();
    uint foreThread = GetWindowThreadProcessId(fore, IntPtr.Zero);
    uint appThread = GetCurrentThreadId();
    if (foreThread != appThread) AttachThreadInput(foreThread, appThread, true);
    BringWindowToTop(hwnd);
    SetForegroundWindow(hwnd);
    if (foreThread != appThread) AttachThreadInput(foreThread, appThread, false);
  }
}
"@
$owner = New-Object System.Windows.Forms.Form
$owner.TopMost = $true
$owner.ShowInTaskbar = $false
$owner.StartPosition = 'CenterScreen'
$owner.Size = New-Object System.Drawing.Size(1, 1)
$owner.Opacity = 0
$owner.Show() | Out-Null
[AfnFore]::Lift($owner.Handle)
$dlg = New-Object System.Windows.Forms.FolderBrowserDialog
$dlg.Description = 'Elegi la carpeta del proyecto'
$dlg.AutoUpgradeEnabled = $true
$ok = $dlg.ShowDialog($owner) -eq [System.Windows.Forms.DialogResult]::OK
$owner.Dispose()
if ($ok) { Write-Output $dlg.SelectedPath }
`;

const PICK_FILE_PS = `
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Windows.Forms
Add-Type @"
using System;
using System.Runtime.InteropServices;
public class AfnForeFile {
  [DllImport("user32.dll")] static extern IntPtr GetForegroundWindow();
  [DllImport("user32.dll")] static extern uint GetWindowThreadProcessId(IntPtr hWnd, IntPtr pid);
  [DllImport("kernel32.dll")] static extern uint GetCurrentThreadId();
  [DllImport("user32.dll")] static extern bool AttachThreadInput(uint a, uint b, bool attach);
  [DllImport("user32.dll")] static extern bool SetForegroundWindow(IntPtr hWnd);
  [DllImport("user32.dll")] static extern bool BringWindowToTop(IntPtr hWnd);
  [DllImport("user32.dll")] static extern void keybd_event(byte bVk, byte bScan, uint dwFlags, UIntPtr extra);
  public static void Lift(IntPtr hwnd) {
    keybd_event(0x12, 0, 0, UIntPtr.Zero);
    keybd_event(0x12, 0, 2, UIntPtr.Zero);
    IntPtr fore = GetForegroundWindow();
    uint foreThread = GetWindowThreadProcessId(fore, IntPtr.Zero);
    uint appThread = GetCurrentThreadId();
    if (foreThread != appThread) AttachThreadInput(foreThread, appThread, true);
    BringWindowToTop(hwnd);
    SetForegroundWindow(hwnd);
    if (foreThread != appThread) AttachThreadInput(foreThread, appThread, false);
  }
}
"@
$owner = New-Object System.Windows.Forms.Form
$owner.TopMost = $true
$owner.ShowInTaskbar = $false
$owner.StartPosition = 'CenterScreen'
$owner.Size = New-Object System.Drawing.Size(1, 1)
$owner.Opacity = 0
$owner.Show() | Out-Null
[AfnForeFile]::Lift($owner.Handle)
$dlg = New-Object System.Windows.Forms.OpenFileDialog
$dlg.Title = 'Elegi el script'
$dlg.Filter = 'Scripts (*.py;*.js;*.mjs;*.cjs)|*.py;*.js;*.mjs;*.cjs|Python (*.py)|*.py|Node (*.js;*.mjs;*.cjs)|*.js;*.mjs;*.cjs'
$dlg.CheckFileExists = $true
$dlg.Multiselect = $false
$ok = $dlg.ShowDialog($owner) -eq [System.Windows.Forms.DialogResult]::OK
$owner.Dispose()
if ($ok) { Write-Output $dlg.FileName }
`;

function runWindowsDialog(script) {
  return new Promise((resolve) => {
    const child = spawn('powershell.exe', ['-NoProfile', '-STA', '-Command', script], { windowsHide: false });
    let out = '';
    let err = '';
    child.stdout.on('data', (d) => { out += String(d); });
    child.stderr.on('data', (d) => { err += String(d); });
    child.on('error', () => resolve({ ok: false, error: 'unsupported' }));
    child.on('close', (code) => {
      const picked = out.trim().split(/\r?\n/).map((l) => l.trim()).filter(Boolean).pop() || '';
      if (!picked) {
        resolve({ ok: false, error: code === 0 ? 'cancelled' : 'unsupported', detail: err.slice(0, 180) });
        return;
      }
      resolve({ ok: true, path: picked, name: path.basename(picked) });
    });
  });
}

/**
 * @param {{ dialog?: () => Promise<{ ok: boolean, path?: string, error?: string }> }} [opts]
 */
export function pickFolder(opts = {}) {
  if (typeof opts.dialog === 'function') return Promise.resolve(opts.dialog());
  if (process.platform !== 'win32') return Promise.resolve({ ok: false, error: 'unsupported' });
  return runWindowsDialog(PICK_PS);
}

export function pickScriptFile(opts = {}) {
  if (typeof opts.dialog === 'function') return Promise.resolve(opts.dialog());
  if (process.platform !== 'win32') return Promise.resolve({ ok: false, error: 'unsupported' });
  return runWindowsDialog(PICK_FILE_PS);
}
