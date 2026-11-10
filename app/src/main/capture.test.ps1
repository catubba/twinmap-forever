# The test window of capture.test.ts: a borderless window whose top and bottom rows are known
# pixels, drawn one by one. Colors are the strip's own: red, green and blue each fully on or off.
param([string]$Title, [int]$Width, [int]$Height)

Add-Type -AssemblyName System.Windows.Forms, System.Drawing
Add-Type -Namespace Win -Name Dpi -MemberDefinition '[DllImport("user32.dll")] public static extern bool SetProcessDPIAware();'
[void][Win.Dpi]::SetProcessDPIAware() # one bitmap pixel = one screen pixel

function Cell([int]$v) {
  [System.Drawing.Color]::FromArgb($(if ($v -band 4) { 255 } else { 0 }), $(if ($v -band 2) { 255 } else { 0 }), $(if ($v -band 1) { 255 } else { 0 }))
}

$form = New-Object System.Windows.Forms.Form
$form.Text = $Title
$form.FormBorderStyle = 'None'
$form.StartPosition = 'Manual'
$form.Location = New-Object System.Drawing.Point 0, 0
$form.ClientSize = New-Object System.Drawing.Size $Width, $Height
$form.TopMost = $true
$form.ShowInTaskbar = $false

# Windows may not grant the size asked for: the rows go where the window really ends.
$size = $form.ClientSize
$bitmap = New-Object System.Drawing.Bitmap $size.Width, $size.Height
for ($x = 0; $x -lt $size.Width; $x++) {
  $bitmap.SetPixel($x, 0, (Cell (($x * 7 + 3) % 8)))
  $bitmap.SetPixel($x, $size.Height - 1, (Cell (($x * 5 + 1) % 8)))
}
$form.BackgroundImage = $bitmap
$form.BackgroundImageLayout = 'None'
[System.Windows.Forms.Application]::Run($form)
