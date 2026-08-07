Add-Type -AssemblyName System.Drawing

function ConvertTo-RealPng {
    param (
        [string]$filePath,
        [int]$width = 0,
        [int]$height = 0
    )
    
    if (-not (Test-Path $filePath)) { 
        Write-Host "File not found: $filePath"
        return 
    }
    
    Write-Host "Processing $filePath..."
    $origImage = [System.Drawing.Image]::FromFile($filePath)
    
    $targetW = if ($width -gt 0) { $width } else { $origImage.Width }
    $targetH = if ($height -gt 0) { $height } else { $origImage.Height }
    
    $bmp = New-Object System.Drawing.Bitmap($targetW, $targetH)
    $g = [System.Drawing.Graphics]::FromImage($bmp)
    $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
    $g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
    $g.CompositingQuality = [System.Drawing.Drawing2D.CompositingQuality]::HighQuality
    
    $g.DrawImage($origImage, 0, 0, $targetW, $targetH)
    
    $origImage.Dispose()
    $g.Dispose()
    
    # Save to temp PNG file first
    $tempPath = $filePath + ".tmp.png"
    $bmp.Save($tempPath, [System.Drawing.Imaging.ImageFormat]::Png)
    $bmp.Dispose()
    
    # Replace original file with real PNG file
    Remove-Item $filePath -Force
    Move-Item $tempPath $filePath -Force
    Write-Host "Successfully converted $filePath to Real PNG ($targetW x $targetH)"
}

ConvertTo-RealPng "d:\ScholacticBase\Mobile app\website\ScholasticBase\public\appicon.png" 512 512
ConvertTo-RealPng "d:\ScholacticBase\Mobile app\website\ScholasticBase\public\greenfield_logo.png" 0 0
ConvertTo-RealPng "d:\ScholacticBase\Mobile app\website\ScholasticBase\public\icons\icon-192x192.png" 192 192
ConvertTo-RealPng "d:\ScholacticBase\Mobile app\website\ScholasticBase\public\icons\icon-192-maskable.png" 192 192
ConvertTo-RealPng "d:\ScholacticBase\Mobile app\website\ScholasticBase\public\icons\icon-512x512.png" 512 512
ConvertTo-RealPng "d:\ScholacticBase\Mobile app\website\ScholasticBase\public\icons\icon-512-maskable.png" 512 512
ConvertTo-RealPng "d:\ScholacticBase\Mobile app\website\ScholasticBase\public\screenshots\desktop.png" 1280 720
ConvertTo-RealPng "d:\ScholacticBase\Mobile app\website\ScholasticBase\public\screenshots\mobile.png" 750 1334
ConvertTo-RealPng "d:\ScholacticBase\Mobile app\website\ScholasticBase\src\greenfield_logo.png" 0 0
ConvertTo-RealPng "d:\ScholacticBase\Mobile app\website\ScholasticBase\src\school_hallway.png" 0 0
ConvertTo-RealPng "d:\ScholacticBase\Mobile app\website\ScholasticBase\src\school_silhouette.png" 0 0
