/**
 * Diálogo nativo de carpeta. El navegador no entrega la ruta real de un input file.
 */
import path from 'node:path';
import { spawn } from 'node:child_process';

const PICK_PS = `
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Windows.Forms
$owner = New-Object System.Windows.Forms.Form
$owner.TopMost = $true
$owner.ShowInTaskbar = $false
$owner.Opacity = 0
$owner.Show() | Out-Null
$owner.Activate() | Out-Null
$dlg = New-Object System.Windows.Forms.FolderBrowserDialog
$dlg.Description = 'Elegi la carpeta del proyecto'
$ok = $dlg.ShowDialog($owner) -eq [System.Windows.Forms.DialogResult]::OK
$owner.Dispose()
if ($ok) { Write-Output $dlg.SelectedPath }
`;

/**
 * @param {{ dialog?: () => Promise<{ ok: boolean, path?: string, error?: string }> }} [opts]
 */
export function pickFolder(opts = {}) {
  if (typeof opts.dialog === 'function') return Promise.resolve(opts.dialog());
  if (process.platform !== 'win32') return Promise.resolve({ ok: false, error: 'unsupported' });
  return new Promise((resolve) => {
    const child = spawn('powershell.exe', ['-NoProfile', '-STA', '-Command', PICK_PS], { windowsHide: false });
    let out = '';
    let err = '';
    child.stdout.on('data', (d) => { out += String(d); });
    child.stderr.on('data', (d) => { err += String(d); });
    child.on('error', () => resolve({ ok: false, error: 'unsupported' }));
    child.on('close', (code) => {
      const folder = out.trim().split(/\r?\n/).map((l) => l.trim()).filter(Boolean).pop() || '';
      if (!folder) {
        resolve({ ok: false, error: code === 0 ? 'cancelled' : 'unsupported', detail: err.slice(0, 180) });
        return;
      }
      resolve({ ok: true, path: folder, name: path.basename(folder) });
    });
  });
}
