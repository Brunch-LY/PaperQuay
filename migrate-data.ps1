# PaperQuay 数据迁移脚本
# 将开发版数据迁移到永久目录，并配置安装版使用它

Write-Host "=== PaperQuay 数据迁移 ===" -ForegroundColor Cyan

# 1. 选择或创建永久数据目录
$dataDir = "E:\PaperQuayData"
New-Item -ItemType Directory -Path $dataDir -Force | Out-Null
Write-Host "永久数据目录: $dataDir" -ForegroundColor Green

# 2. 复制开发版数据
$devData = "E:\opencode_project\PaperQuay\.dev-data\PaperQuay"
if (Test-Path $devData) {
    Write-Host "正在复制开发版数据..." -ForegroundColor Yellow
    Copy-Item -Recurse -Force "$devData\*" "$dataDir\PaperQuay\"
    Write-Host "开发版数据已复制" -ForegroundColor Green
} else {
    Write-Host "未找到开发版数据目录: $devData" -ForegroundColor Yellow
    Write-Host "将创建空白数据目录" -ForegroundColor Yellow
}

# 3. 在安装目录创建 .paperquay-datadir 配置文件
$installDir = "E:\Program Files\PaperQuay"
if (Test-Path $installDir) {
    Set-Content -Path "$installDir\.paperquay-datadir" -Value $dataDir -NoNewline
    Write-Host "配置文件已创建: $installDir\.paperquay-datadir" -ForegroundColor Green
    Write-Host "  内容: $dataDir" -ForegroundColor Green
} else {
    Write-Host "未找到安装目录: $installDir" -ForegroundColor Yellow
    Write-Host "请手动创建文件 $installDir\.paperquay-datadir，内容为: $dataDir" -ForegroundColor Yellow
}

# 4. 验证
$dbPath = "$dataDir\PaperQuay\paperquay-library.sqlite"
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
