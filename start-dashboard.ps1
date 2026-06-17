# 宗教者紹介ダッシュボード 起動スクリプト
Set-Location $PSScriptRoot

Write-Host "宗教者紹介ダッシュボードを起動します..."
Write-Host "URL: http://localhost:3001"

$env:PORT = "3001"
npx next start -p 3001
