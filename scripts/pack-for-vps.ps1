# Cria um arquivo compactado do luditeca-vps para enviar por SCP/SFTP (exclui artefactos pesados).
# Uso (na pasta luditeca-vps): .\scripts\pack-for-vps.ps1
# Saida: ..\luditeca-vps-deploy.tgz na pasta pai do repositorio.

$ErrorActionPreference = "Stop"
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$root = Split-Path -Parent $scriptDir
$parent = Split-Path -Parent $root
$name = Split-Path -Leaf $root
$out = Join-Path $parent "luditeca-vps-deploy.tgz"

Push-Location $parent
try {
  if (Test-Path $out) { Remove-Item -LiteralPath $out -Force }
  Write-Host "A criar: $out"
  # Arquivo inclui a pasta $name/... para extrair em /opt sem misturar ficheiros.
  tar -czf $out `
    --exclude="$name/node_modules" `
    --exclude="$name/frontend/node_modules" `
    --exclude="$name/backend/node_modules" `
    --exclude="$name/frontend/.next" `
    --exclude="$name/backend/dist" `
    --exclude="$name/pgdata" `
    --exclude="*.tgz" `
    --exclude="$name/.git" `
    $name
  Write-Host "Concluido. Envie o ficheiro para a VPS, ex.:"
  Write-Host "  scp `"$out`" utilizador@servidor:/opt/"
} finally {
  Pop-Location
}
