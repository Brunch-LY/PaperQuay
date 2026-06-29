# PaperQuay 数据迁移脚本
# 将开发版数据迁移到永久目录，并配置安装版使用它

Write-Host "=== PaperQuay 数据迁移 ===" -ForegroundColor Cyan

# 1. 选择或创建永久数据目录（与安装目录同盘符）
# 如 PaperQuay 在 E:\Program Files\PaperQuay，数据放在 E:\PaperQuayData
$installDir = "E:\Program Files\PaperQuay"
$dataDir = "E:\PaperQuayData"
New-Item -ItemType Directory -Path $dataDir -Force | Out-Null
Write-Host "永久数据目录: $dataDir" -ForegroundColor Green

# 2. 复制开发版数据（.dev-data\PaperQuay\ 下的内容直接复制到 PaperQuayData）
$devData = "E:\opencode_project\PaperQuay\.dev-data\PaperQuay"
if (Test-Path $devData) {
    Write-Host "正在复制开发版数据..." -ForegroundColor Yellow
    Copy-Item -Recurse -Force "$devData\*" "$dataDir\"
    Write-Host "开发版数据已复制" -ForegroundColor Green
} else {
    Write-Host "未找到开发版数据目录: $devData" -ForegroundColor Yellow
    Write-Host "将创建空白数据目录" -ForegroundColor Yellow
}

# 3. 创建配置文件（用户主目录，不受安装程序影响）
$configPath = "$env:USERPROFILE\.paperquay-datadir"
Set-Content -Path $configPath -Value $dataDir -NoNewline
Write-Host "配置文件已创建: $configPath" -ForegroundColor Green
Write-Host "  内容: $dataDir" -ForegroundColor Green

# 4. 验证
$dbPath = "$dataDir\paperquay-library.sqlite"
if (Test-Path $dbPath) {
    $size = (Get-Item $dbPath).Length
    Write-Host "数据库文件: $dbPath ($([math]::Round($size/1KB)) KB)" -ForegroundColor Green
} else {
    Write-Host "数据库文件不存在，安装版首次启动会自动创建" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "=== 迁移完成 ===" -ForegroundColor Cyan
Write-Host "现在运行安装版 PaperQuay 即可使用原有数据" -ForegroundColor Green
Write-Host "今后覆盖安装也不会影响数据（安装程序不碰 .paperquay-datadir 文件）" -ForegroundColor Green
