param(
  [ValidateSet('up', 'down', 'restart', 'status', 'logs')]
  [string]$Action = 'up',

  [switch]$Build,
  [switch]$Detach = $true,
  [switch]$RemoveVolumes
)

$ErrorActionPreference = 'Stop'

Set-Location $PSScriptRoot

function Invoke-Compose {
  param(
    [string[]]$Arguments
  )

  $compose = @('compose') + $Arguments
  & docker @compose
}

switch ($Action) {
  'up' {
    $args = @('up')
    if ($Build) { $args += '--build' }
    if ($Detach) { $args += '-d' }
    Invoke-Compose -Arguments $args
  }
  'down' {
    $args = @('down')
    if ($RemoveVolumes) { $args += '-v' }
    Invoke-Compose -Arguments $args
  }
  'restart' {
    Invoke-Compose -Arguments @('down')
    $args = @('up')
    if ($Build) { $args += '--build' }
    if ($Detach) { $args += '-d' }
    Invoke-Compose -Arguments $args
  }
  'status' {
    Invoke-Compose -Arguments @('ps')
  }
  'logs' {
    Invoke-Compose -Arguments @('logs', '-f')
  }
}