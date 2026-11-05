$ErrorActionPreference='Stop'
$idleCompiler=Join-Path $env:WINDIR 'Microsoft.NET\Framework64\v4.0.30319\csc.exe'
if(-not (Test-Path -LiteralPath $idleCompiler)){$idleCompiler=Join-Path $env:WINDIR 'Microsoft.NET\Framework\v4.0.30319\csc.exe'}
Push-Location $PSScriptRoot
try {
 & $idleCompiler /nologo /target:winexe /out:PC미사용자동종료.exe /reference:System.Windows.Forms.dll /reference:System.Drawing.dll IdlePolicy.cs IdleShutdown.cs
 if($LASTEXITCODE -ne 0){throw 'Program compilation failed'}
 & $idleCompiler /nologo /target:exe /out:PolicyTests.exe IdlePolicy.cs PolicyTests.cs
 if($LASTEXITCODE -ne 0){throw 'Test compilation failed'}
 & '.\PolicyTests.exe'
 if($LASTEXITCODE -ne 0){throw 'Policy tests failed'}
} finally {Pop-Location}
